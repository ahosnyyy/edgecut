import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  templates,
  templateVariables,
  templatePieces,
  profileSystems,
} from "../db/schema.js";
import type { Env } from "../index.js";

export const templatesRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// ─── GET /api/templates — List all templates ─────────────────────────────────

templatesRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(templates).orderBy(templates.name);
  return c.json(rows);
});

// ─── GET /api/templates/:id — Get template with variables + pieces ───────────

templatesRoutes.get("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const tpl = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);
  if (tpl.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }

  const vars = await db
    .select()
    .from(templateVariables)
    .where(eq(templateVariables.templateId, id))
    .orderBy(templateVariables.sortOrder);

  const pieces = await db
    .select()
    .from(templatePieces)
    .where(eq(templatePieces.templateId, id))
    .orderBy(templatePieces.sortOrder);

  return c.json({ ...tpl[0], variables: vars, pieces });
});

// ─── POST /api/templates — Create template with variables + pieces ───────────

templatesRoutes.post("/", async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json<{
    name: string;
    type: "window" | "door";
    category?: string;
    profileSystemId?: string | null;
    variables?: { name: string; label: string; defaultValue: number }[];
    pieces?: {
      label: string;
      profileType: string;
      lengthFormula: string;
      quantity: number;
    }[];
  }>();

  if (!body.name || !body.type) {
    return c.json({ error: "name and type are required" }, 400);
  }

  const now = Date.now();
  const id = generateId();

  await db.insert(templates).values({
    id,
    name: body.name,
    type: body.type,
    category: body.category ?? "General",
    profileSystemId: body.profileSystemId ?? null,
    isBuiltin: false,
    createdAt: now,
    updatedAt: now,
  });

  // Auto-populate variables from profile system if no explicit variables provided
  let variablesToSave = body.variables;
  if (!variablesToSave && body.profileSystemId) {
    const sys = await db
      .select()
      .from(profileSystems)
      .where(eq(profileSystems.id, body.profileSystemId))
      .limit(1);
    if (sys.length > 0) {
      try {
        const constants = JSON.parse(sys[0].constants) as { name: string; label: string; defaultValue: number }[];
        variablesToSave = constants;
      } catch {
        // ignore parse errors
      }
    }
  }

  if (variablesToSave) {
    for (let i = 0; i < variablesToSave.length; i++) {
      const v = variablesToSave[i];
      await db.insert(templateVariables).values({
        id: generateId(),
        templateId: id,
        name: v.name,
        label: v.label,
        defaultValue: v.defaultValue,
        sortOrder: i,
      });
    }
  }

  if (body.pieces) {
    for (let i = 0; i < body.pieces.length; i++) {
      const p = body.pieces[i];
      await db.insert(templatePieces).values({
        id: generateId(),
        templateId: id,
        label: p.label,
        profileType: p.profileType as "frame" | "sash" | "mullion" | "bead" | "custom",
        lengthFormula: p.lengthFormula,
        quantity: p.quantity,
        sortOrder: i,
      });
    }
  }

  return c.json({ id, name: body.name, type: body.type, category: body.category ?? "General", profileSystemId: body.profileSystemId ?? null, isBuiltin: false }, 201);
});

// ─── PUT /api/templates/:id — Update template (only non-builtin) ─────────────

templatesRoutes.put("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }
  if (existing[0].isBuiltin) {
    return c.json({ error: "Built-in templates cannot be edited" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    type?: "window" | "door";
    category?: string;
    profileSystemId?: string | null;
    variables?: { name: string; label: string; defaultValue: number }[];
    pieces?: {
      label: string;
      profileType: string;
      lengthFormula: string;
      quantity: number;
    }[];
  }>();

  const now = Date.now();
  await db
    .update(templates)
    .set({
      name: body.name ?? existing[0].name,
      type: body.type ?? existing[0].type,
      category: body.category ?? existing[0].category,
      profileSystemId: body.profileSystemId !== undefined ? body.profileSystemId : existing[0].profileSystemId,
      updatedAt: now,
    })
    .where(eq(templates.id, id));

  // Auto-populate variables from profile system if no explicit variables provided
  let variablesToSave = body.variables;
  if (variablesToSave === undefined && body.profileSystemId !== undefined && body.profileSystemId) {
    const sys = await db
      .select()
      .from(profileSystems)
      .where(eq(profileSystems.id, body.profileSystemId))
      .limit(1);
    if (sys.length > 0) {
      try {
        const constants = JSON.parse(sys[0].constants) as { name: string; label: string; defaultValue: number }[];
        variablesToSave = constants;
      } catch {
        // ignore parse errors
      }
    }
  }

  if (variablesToSave) {
    await db
      .delete(templateVariables)
      .where(eq(templateVariables.templateId, id));
    for (let i = 0; i < variablesToSave.length; i++) {
      const v = variablesToSave[i];
      await db.insert(templateVariables).values({
        id: generateId(),
        templateId: id,
        name: v.name,
        label: v.label,
        defaultValue: v.defaultValue,
        sortOrder: i,
      });
    }
  }

  if (body.pieces) {
    await db.delete(templatePieces).where(eq(templatePieces.templateId, id));
    for (let i = 0; i < body.pieces.length; i++) {
      const p = body.pieces[i];
      await db.insert(templatePieces).values({
        id: generateId(),
        templateId: id,
        label: p.label,
        profileType: p.profileType as "frame" | "sash" | "mullion" | "bead" | "custom",
        lengthFormula: p.lengthFormula,
        quantity: p.quantity,
        sortOrder: i,
      });
    }
  }

  return c.json({ id, updated: true });
});

// ─── DELETE /api/templates/:id — Delete template ─────────────────────────────

templatesRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }

  await db.delete(templates).where(eq(templates.id, id));
  return c.json({ deleted: true });
});

// ─── POST /api/templates/:id/duplicate — Duplicate a template ────────────────

templatesRoutes.post("/:id/duplicate", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const tpl = await db
    .select()
    .from(templates)
    .where(eq(templates.id, id))
    .limit(1);
  if (tpl.length === 0) {
    return c.json({ error: "Template not found" }, 404);
  }

  const vars = await db
    .select()
    .from(templateVariables)
    .where(eq(templateVariables.templateId, id))
    .orderBy(templateVariables.sortOrder);

  const pieces = await db
    .select()
    .from(templatePieces)
    .where(eq(templatePieces.templateId, id))
    .orderBy(templatePieces.sortOrder);

  const now = Date.now();
  const newId = generateId();

  await db.insert(templates).values({
    id: newId,
    name: `${tpl[0].name} (Copy)`,
    type: tpl[0].type,
    category: tpl[0].category,
    profileSystemId: tpl[0].profileSystemId,
    isBuiltin: false,
    createdAt: now,
    updatedAt: now,
  });

  for (let i = 0; i < vars.length; i++) {
    const v = vars[i];
    await db.insert(templateVariables).values({
      id: generateId(),
      templateId: newId,
      name: v.name,
      label: v.label,
      defaultValue: v.defaultValue,
      sortOrder: i,
    });
  }

  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    await db.insert(templatePieces).values({
      id: generateId(),
      templateId: newId,
      label: p.label,
      profileType: p.profileType,
      lengthFormula: p.lengthFormula,
      quantity: p.quantity,
      sortOrder: i,
    });
  }

  return c.json({ id: newId, name: `${tpl[0].name} (Copy)` }, 201);
});

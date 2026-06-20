import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  templates,
  templateVariables,
  templatePieces,
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
    category: string;
    variables?: { name: string; label: string; defaultValue: number }[];
    pieces?: {
      label: string;
      profileType: string;
      lengthFormula: string;
      quantity: number;
    }[];
  }>();

  if (!body.name || !body.type || !body.category) {
    return c.json({ error: "name, type, and category are required" }, 400);
  }

  const now = Date.now();
  const id = generateId();

  await db.insert(templates).values({
    id,
    name: body.name,
    type: body.type,
    category: body.category,
    isBuiltin: false,
    createdAt: now,
    updatedAt: now,
  });

  if (body.variables) {
    for (let i = 0; i < body.variables.length; i++) {
      const v = body.variables[i];
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

  return c.json({ id, name: body.name, type: body.type, category: body.category, isBuiltin: false }, 201);
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
      updatedAt: now,
    })
    .where(eq(templates.id, id));

  if (body.variables) {
    await db
      .delete(templateVariables)
      .where(eq(templateVariables.templateId, id));
    for (let i = 0; i < body.variables.length; i++) {
      const v = body.variables[i];
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

// ─── DELETE /api/templates/:id — Delete template (only non-builtin) ──────────

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
  if (existing[0].isBuiltin) {
    return c.json({ error: "Built-in templates cannot be deleted" }, 403);
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

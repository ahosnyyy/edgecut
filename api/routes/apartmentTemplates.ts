import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  apartmentTemplates,
  apartmentTemplateOpenings,
  templates,
} from "../db/schema.js";
import type { Env } from "../index.js";

export const apartmentTemplateRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// ─── GET /api/apartment-templates — List all ──────────────────────────────────

apartmentTemplateRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select()
    .from(apartmentTemplates)
    .orderBy(apartmentTemplates.name);
  return c.json(rows);
});

// ─── GET /api/apartment-templates/:id — Get with openings ─────────────────────

apartmentTemplateRoutes.get("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const tpl = await db
    .select()
    .from(apartmentTemplates)
    .where(eq(apartmentTemplates.id, id))
    .limit(1);
  if (tpl.length === 0) {
    return c.json({ error: "Apartment template not found" }, 404);
  }

  const openings = await db
    .select({
      id: apartmentTemplateOpenings.id,
      label: apartmentTemplateOpenings.label,
      pieceTemplateId: apartmentTemplateOpenings.pieceTemplateId,
      sortOrder: apartmentTemplateOpenings.sortOrder,
      templateName: templates.name,
      templateType: templates.type,
    })
    .from(apartmentTemplateOpenings)
    .leftJoin(templates, eq(apartmentTemplateOpenings.pieceTemplateId, templates.id))
    .where(eq(apartmentTemplateOpenings.apartmentTemplateId, id))
    .orderBy(apartmentTemplateOpenings.sortOrder);

  return c.json({ ...tpl[0], openings });
});

// ─── POST /api/apartment-templates — Create ───────────────────────────────────

apartmentTemplateRoutes.post("/", async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json<{
    name: string;
    description?: string;
    openings?: {
      label: string;
      pieceTemplateId: string;
    }[];
  }>();

  if (!body.name?.trim()) {
    return c.json({ error: "Name is required" }, 400);
  }

  const now = Date.now();
  const id = generateId();

  await db.insert(apartmentTemplates).values({
    id,
    name: body.name,
    description: body.description ?? null,
    createdAt: now,
    updatedAt: now,
  });

  if (body.openings) {
    for (let i = 0; i < body.openings.length; i++) {
      const o = body.openings[i];
      await db.insert(apartmentTemplateOpenings).values({
        id: generateId(),
        apartmentTemplateId: id,
        label: o.label,
        pieceTemplateId: o.pieceTemplateId,
        sortOrder: i,
      });
    }
  }

  return c.json({ id, name: body.name }, 201);
});

// ─── PUT /api/apartment-templates/:id — Update ────────────────────────────────

apartmentTemplateRoutes.put("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(apartmentTemplates)
    .where(eq(apartmentTemplates.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Apartment template not found" }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    description?: string;
    openings?: {
      label: string;
      pieceTemplateId: string;
    }[];
  }>();

  const now = Date.now();
  await db
    .update(apartmentTemplates)
    .set({
      name: body.name ?? existing[0].name,
      description: body.description ?? existing[0].description,
      updatedAt: now,
    })
    .where(eq(apartmentTemplates.id, id));

  if (body.openings) {
    await db
      .delete(apartmentTemplateOpenings)
      .where(eq(apartmentTemplateOpenings.apartmentTemplateId, id));
    for (let i = 0; i < body.openings.length; i++) {
      const o = body.openings[i];
      await db.insert(apartmentTemplateOpenings).values({
        id: generateId(),
        apartmentTemplateId: id,
        label: o.label,
        pieceTemplateId: o.pieceTemplateId,
        sortOrder: i,
      });
    }
  }

  return c.json({ id, updated: true });
});

// ─── DELETE /api/apartment-templates/:id — Delete ─────────────────────────────

apartmentTemplateRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(apartmentTemplates)
    .where(eq(apartmentTemplates.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Apartment template not found" }, 404);
  }

  await db.delete(apartmentTemplates).where(eq(apartmentTemplates.id, id));
  return c.json({ deleted: true });
});

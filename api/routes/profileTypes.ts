import { Hono } from "hono";
import { eq, asc, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { profileTypes, templatePieces, templates, stockCatalog, stock } from "../db/schema.js";
import type { Env } from "../index.js";

export const profileTypeRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// GET /api/profile-types — list all
profileTypeRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(profileTypes).orderBy(asc(profileTypes.sortOrder));
  return c.json(rows);
});

// POST /api/profile-types — create
profileTypeRoutes.post("/", async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json<{ key: string; label: string }>();

  if (!body.key?.trim() || !body.label?.trim()) {
    return c.json({ error: "Key and label are required" }, 400);
  }

  const key = body.key.trim().toLowerCase();
  const id = generateId();
  const now = Date.now();

  const maxOrder = await db.select().from(profileTypes);
  const sortOrder = maxOrder.length;

  await db.insert(profileTypes).values({
    id,
    key,
    label: body.label.trim(),
    sortOrder,
    createdAt: now,
  });

  return c.json({ id }, 201);
});

// PUT /api/profile-types/:id — update
profileTypeRoutes.put("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const body = await c.req.json<{ label?: string }>();

  const existing = await db.select().from(profileTypes).where(eq(profileTypes.id, id));
  if (existing.length === 0) {
    return c.json({ error: "Profile type not found" }, 404);
  }

  const updates: Partial<typeof profileTypes.$inferInsert> = {};
  if (body.label?.trim()) {
    updates.label = body.label.trim();
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: "No fields to update" }, 400);
  }

  await db.update(profileTypes).set(updates).where(eq(profileTypes.id, id));
  return c.json({ ok: true });
});

// GET /api/profile-types/:id/usage — check if profile type is used by any piece templates
profileTypeRoutes.get("/:id/usage", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db.select().from(profileTypes).where(eq(profileTypes.id, id));
  if (existing.length === 0) {
    return c.json({ error: "Profile type not found" }, 404);
  }

  const key = existing[0].key;

  const templateRows = await db
    .select({
      id: templatePieces.id,
      templateName: templates.name,
    })
    .from(templatePieces)
    .innerJoin(templates, eq(templates.id, templatePieces.templateId))
    .where(sql`${templatePieces.profileType} = ${key}`);

  const catalogRows = await db
    .select({ id: stockCatalog.id, label: stockCatalog.label })
    .from(stockCatalog)
    .where(sql`${stockCatalog.profileType} = ${key}`);

  const stockRows = await db
    .select({ id: stock.id, label: stock.label })
    .from(stock)
    .where(sql`${stock.profileType} = ${key}`);

  const references = [
    ...templateRows.map((r) => ({ type: "piece_template", id: r.id, name: r.templateName })),
    ...catalogRows.map((r) => ({ type: "stock_catalog", id: r.id, name: r.label ?? "Stock catalog entry" })),
    ...stockRows.map((r) => ({ type: "project_stock", id: r.id, name: r.label ?? "Project stock entry" })),
  ];

  const uniqueByName = new Map(references.map((r) => [`${r.type}|${r.name}`, r]));

  return c.json({
    canDelete: references.length === 0,
    references: [...uniqueByName.values()],
  });
});

// DELETE /api/profile-types/:id — delete (blocked if in use)
profileTypeRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db.select().from(profileTypes).where(eq(profileTypes.id, id));
  if (existing.length === 0) {
    return c.json({ error: "Profile type not found" }, 404);
  }

  const key = existing[0].key;
  const templateRows = await db
    .select({ id: templatePieces.id })
    .from(templatePieces)
    .where(sql`${templatePieces.profileType} = ${key}`);
  const catalogRows = await db
    .select({ id: stockCatalog.id })
    .from(stockCatalog)
    .where(sql`${stockCatalog.profileType} = ${key}`);
  const stockRows = await db
    .select({ id: stock.id })
    .from(stock)
    .where(sql`${stock.profileType} = ${key}`);

  const totalRefs = templateRows.length + catalogRows.length + stockRows.length;
  if (totalRefs > 0) {
    return c.json({
      error: `Cannot delete: this profile type is used by ${totalRefs} reference${totalRefs !== 1 ? "s" : ""}`,
    }, 400);
  }

  await db.delete(profileTypes).where(eq(profileTypes.id, id));
  return c.json({ ok: true });
});

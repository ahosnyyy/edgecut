import { Hono } from "hono";
import { eq, asc } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { profileTypes } from "../db/schema.js";
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
    isReserved: false,
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

// DELETE /api/profile-types/:id — delete (blocked if reserved)
profileTypeRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db.select().from(profileTypes).where(eq(profileTypes.id, id));
  if (existing.length === 0) {
    return c.json({ error: "Profile type not found" }, 404);
  }

  if (existing[0].isReserved) {
    return c.json({ error: "Cannot delete a reserved profile type" }, 400);
  }

  await db.delete(profileTypes).where(eq(profileTypes.id, id));
  return c.json({ ok: true });
});

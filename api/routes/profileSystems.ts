import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { profileSystems } from "../db/schema.js";
import type { Env } from "../index.js";

export const profileSystemRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

interface SystemConstant {
  name: string;
  label: string;
  defaultValue: number;
}

interface DefaultPiece {
  label: string;
  profileType: string;
  lengthFormula: string;
  quantity: number;
}

// ─── GET /api/profile-systems — List all ──────────────────────────────────────

profileSystemRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db.select().from(profileSystems).orderBy(profileSystems.name);
  return c.json(rows);
});

// ─── GET /api/profile-systems/:id — Get single ────────────────────────────────

profileSystemRoutes.get("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const row = await db
    .select()
    .from(profileSystems)
    .where(eq(profileSystems.id, id))
    .limit(1);
  if (row.length === 0) {
    return c.json({ error: "Profile system not found" }, 404);
  }
  return c.json(row[0]);
});

// ─── POST /api/profile-systems — Create ───────────────────────────────────────

profileSystemRoutes.post("/", async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json<{
    name: string;
    key: string;
    constants?: SystemConstant[];
    defaultPieces?: DefaultPiece[];
  }>();

  if (!body.name?.trim() || !body.key?.trim()) {
    return c.json({ error: "Name and key are required" }, 400);
  }

  const now = Date.now();
  const id = generateId();
  await db.insert(profileSystems).values({
    id,
    name: body.name.trim(),
    key: body.key.trim().toLowerCase().replace(/\s+/g, "_"),
    constants: JSON.stringify(body.constants ?? []),
    defaultPieces: body.defaultPieces ? JSON.stringify(body.defaultPieces) : null,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ id }, 201);
});

// ─── PUT /api/profile-systems/:id — Update ────────────────────────────────────

profileSystemRoutes.put("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(profileSystems)
    .where(eq(profileSystems.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Profile system not found" }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    key?: string;
    constants?: SystemConstant[];
    defaultPieces?: DefaultPiece[];
  }>();

  const updates: Record<string, unknown> = { updatedAt: Date.now() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.key !== undefined) updates.key = body.key.trim().toLowerCase().replace(/\s+/g, "_");
  if (body.constants !== undefined) updates.constants = JSON.stringify(body.constants);
  if (body.defaultPieces !== undefined) updates.defaultPieces = JSON.stringify(body.defaultPieces);

  await db
    .update(profileSystems)
    .set(updates)
    .where(eq(profileSystems.id, id));

  return c.json({ id, updated: true });
});

// ─── DELETE /api/profile-systems/:id — Delete ─────────────────────────────────

profileSystemRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(profileSystems)
    .where(eq(profileSystems.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Profile system not found" }, 404);
  }

  await db.delete(profileSystems).where(eq(profileSystems.id, id));
  return c.json({ deleted: true });
});

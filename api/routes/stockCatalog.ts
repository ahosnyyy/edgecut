import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { stockCatalog } from "../db/schema.js";
import type { Env } from "../index.js";

export const stockCatalogRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// ─── GET /api/stock-catalog — List all (optionally filtered by profileSystem) ─

stockCatalogRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const profileSystems = c.req.queries("profileSystem");

  const rows = profileSystems && profileSystems.length > 0
    ? await db.select().from(stockCatalog).where(inArray(stockCatalog.profileSystem, profileSystems as ("manazil" | "premier")[]))
    : await db.select().from(stockCatalog);

  return c.json(rows);
});

// ─── POST /api/stock-catalog — Add stock catalog entry ────────────────────────

stockCatalogRoutes.post("/", async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json<{
    profileSystem: "manazil" | "premier";
    profileType: string;
    color: string;
    length: number;
    quantity?: number;
    label?: string;
  }>();

  const id = generateId();
  await db.insert(stockCatalog).values({
    id,
    profileSystem: body.profileSystem,
    profileType: body.profileType,
    color: body.color,
    length: body.length,
    quantity: body.quantity ?? -1,
    label: body.label ?? null,
  });

  return c.json({ id }, 201);
});

// ─── PUT /api/stock-catalog/:id — Update stock catalog entry ──────────────────

stockCatalogRoutes.put("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(stockCatalog)
    .where(eq(stockCatalog.id, id))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Stock catalog entry not found" }, 404);
  }

  const body = await c.req.json<{
    profileType?: string;
    color?: string;
    length?: number;
    quantity?: number;
    label?: string;
  }>();

  await db
    .update(stockCatalog)
    .set({
      profileType: body.profileType ?? existing[0].profileType,
      color: body.color ?? existing[0].color,
      length: body.length ?? existing[0].length,
      quantity: body.quantity ?? existing[0].quantity,
      label: body.label !== undefined ? body.label : existing[0].label,
    })
    .where(eq(stockCatalog.id, id));

  return c.json({ id, updated: true });
});

// ─── DELETE /api/stock-catalog/:id — Delete stock catalog entry ───────────────

stockCatalogRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  await db.delete(stockCatalog).where(eq(stockCatalog.id, id));
  return c.json({ deleted: true });
});

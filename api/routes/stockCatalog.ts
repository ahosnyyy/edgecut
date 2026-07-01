import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { stockCatalog, stock, projects } from "../db/schema.js";
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

  const updates: Record<string, unknown> = {
    profileType: body.profileType ?? existing[0].profileType,
    color: body.color ?? existing[0].color,
    length: body.length ?? existing[0].length,
    label: body.label !== undefined ? body.label : existing[0].label,
  };

  if (body.quantity !== undefined) {
    if (body.quantity !== -1 && body.quantity < existing[0].reservedQty) {
      return c.json({
        error: `Cannot reduce quantity to ${body.quantity}: ${existing[0].reservedQty} bars are already reserved by projects. Reduce project stock first.`,
      }, 400);
    }
    updates.quantity = body.quantity;
    if (body.quantity === -1) {
      updates.reservedQty = 0;
    }
  }

  await db
    .update(stockCatalog)
    .set(updates)
    .where(eq(stockCatalog.id, id));

  // Propagate field changes to linked project stock entries
  const linkedStock = await db
    .select()
    .from(stock)
    .where(eq(stock.sourceDefaultId, id));

  if (linkedStock.length > 0) {
    const stockUpdates: Record<string, unknown> = {};
    if (body.length !== undefined) stockUpdates.length = body.length;
    if (body.profileType !== undefined) stockUpdates.profileType = body.profileType;
    if (body.color !== undefined) stockUpdates.color = body.color;
    if (body.label !== undefined) stockUpdates.label = body.label;

    if (Object.keys(stockUpdates).length > 0) {
      for (const entry of linkedStock) {
        await db
          .update(stock)
          .set(stockUpdates)
          .where(eq(stock.id, entry.id));
      }
    }
  }

  return c.json({ id, updated: true });
});

// ─── GET /api/stock-catalog/:id/usage — Check references before delete ────────

stockCatalogRoutes.get("/:id/usage", async (c) => {
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

  const refs = await db
    .select({
      stockId: stock.id,
      projectId: stock.projectId,
      projectName: projects.name,
      label: stock.label,
    })
    .from(stock)
    .innerJoin(projects, eq(stock.projectId, projects.id))
    .where(eq(stock.sourceDefaultId, id));

  const uniqueProjects = new Map<string, { name: string; count: number }>();
  for (const r of refs) {
    if (!uniqueProjects.has(r.projectId)) {
      uniqueProjects.set(r.projectId, { name: r.projectName, count: 0 });
    }
    uniqueProjects.get(r.projectId)!.count++;
  }

  const references = Array.from(uniqueProjects.entries()).map(([pid, info]) => ({
    type: "project" as const,
    id: pid,
    name: info.name,
    detail: `${info.count} stock entr${info.count === 1 ? "y" : "ies"}`,
  }));

  if (existing[0].usedQty > 0) {
    references.push({
      type: "consumed" as const,
      id: "consumed",
      name: `${existing[0].usedQty} bars have been consumed by applied cutting plans`,
    });
  }

  return c.json({ canDelete: references.length === 0, references });
});

// ─── DELETE /api/stock-catalog/:id — Delete stock catalog entry ───────────────

stockCatalogRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  await db.delete(stockCatalog).where(eq(stockCatalog.id, id));
  return c.json({ deleted: true });
});

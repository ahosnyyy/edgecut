import { Hono } from "hono";
import { eq, and, or, like } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { cuttingPlans, stockCatalog, stock, projects } from "../db/schema.js";
import type { Env } from "../index.js";

export const cuttingPlanRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

async function resolveProjectId(db: ReturnType<typeof getDb>, identifier: string): Promise<string | null> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(or(eq(projects.slug, identifier), eq(projects.id, identifier)))
    .limit(1);
  return rows.length > 0 ? rows[0].id : null;
}

// ─── GET /api/projects/:id/cutting-plans — list plans (optionally filtered) ──

cuttingPlanRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");
  if (!identifier) return c.json({ error: "Project ID required" }, 400);

  const projectId = await resolveProjectId(db, identifier);
  if (!projectId) return c.json({ error: "Project not found" }, 404);

  const scope = c.req.query("scope");
  const scopeId = c.req.query("scopeId");

  const conditions = [eq(cuttingPlans.projectId, projectId)];
  if (scope) {
    conditions.push(
      eq(cuttingPlans.scope, scope as "project" | "building" | "level" | "apartment"),
    );
  }
  if (scopeId) {
    conditions.push(eq(cuttingPlans.scopeId, scopeId));
  }

  const rows = await db
    .select()
    .from(cuttingPlans)
    .where(and(...conditions))
    .orderBy(cuttingPlans.createdAt);

  return c.json(rows);
});

// ─── GET /api/projects/:id/cutting-plans/:planId — get single plan ────────────

cuttingPlanRoutes.get("/:planId", async (c) => {
  const db = getDb(c.env);
  const planId = c.req.param("planId");

  const rows = await db
    .select()
    .from(cuttingPlans)
    .where(eq(cuttingPlans.id, planId))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: "Cutting plan not found" }, 404);
  }

  return c.json(rows[0]);
});

// ─── POST /api/projects/:id/cutting-plans — save a plan ───────────────────────

cuttingPlanRoutes.post("/", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");
  if (!identifier) return c.json({ error: "Project ID required" }, 400);

  const projectId = await resolveProjectId(db, identifier);
  if (!projectId) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.json<{
    scope: "project" | "building" | "level" | "apartment";
    scopeId?: string | null;
    profileType: string;
    color: string;
    bars: unknown;
    summary: unknown;
    kerfWidth: number;
    strategy: string;
  }>();

  const id = generateId();
  const now = Date.now();

  await db.insert(cuttingPlans).values({
    id,
    projectId,
    scope: body.scope,
    scopeId: body.scopeId ?? null,
    profileType: body.profileType,
    color: body.color,
    bars: JSON.stringify(body.bars),
    summary: JSON.stringify(body.summary),
    kerfWidth: body.kerfWidth,
    strategy: body.strategy,
    isApplied: false,
    createdAt: now,
  });

  return c.json({ id, isApplied: false }, 201);
});

// ─── PUT /api/projects/:id/cutting-plans/:planId — update a plan ──────────────

cuttingPlanRoutes.put("/:planId", async (c) => {
  const db = getDb(c.env);
  const planId = c.req.param("planId");

  const existing = await db
    .select()
    .from(cuttingPlans)
    .where(eq(cuttingPlans.id, planId))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Cutting plan not found" }, 404);
  }

  const body = await c.req.json<{
    bars?: unknown;
    summary?: unknown;
    kerfWidth?: number;
    strategy?: string;
  }>();

  const updates: Record<string, unknown> = {};

  if (body.bars !== undefined) updates.bars = JSON.stringify(body.bars);
  if (body.summary !== undefined) updates.summary = JSON.stringify(body.summary);
  if (body.kerfWidth !== undefined) updates.kerfWidth = body.kerfWidth;
  if (body.strategy !== undefined) updates.strategy = body.strategy;

  if (Object.keys(updates).length > 0) {
    await db
      .update(cuttingPlans)
      .set(updates)
      .where(eq(cuttingPlans.id, planId));
  }

  return c.json({ id: planId, updated: true });
});

// ─── DELETE /api/projects/:id/cutting-plans/:planId — delete a plan ───────────

cuttingPlanRoutes.delete("/:planId", async (c) => {
  const db = getDb(c.env);
  const planId = c.req.param("planId");

  const existing = await db
    .select()
    .from(cuttingPlans)
    .where(eq(cuttingPlans.id, planId))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Cutting plan not found" }, 404);
  }

  if (existing[0].isApplied) {
    return c.json({
      error: "Cannot delete an applied cutting plan. Un-apply it first.",
    }, 400);
  }

  await db.delete(cuttingPlans).where(eq(cuttingPlans.id, planId));
  return c.json({ deleted: true });
});

// ─── POST /api/projects/:id/cutting-plans/:planId/apply — apply plan ──────────

cuttingPlanRoutes.post("/:planId/apply", async (c) => {
  const db = getDb(c.env);
  const planId = c.req.param("planId");

  const plan = await db
    .select()
    .from(cuttingPlans)
    .where(eq(cuttingPlans.id, planId))
    .limit(1);

  if (plan.length === 0) {
    return c.json({ error: "Cutting plan not found" }, 404);
  }

  if (plan[0].isApplied) {
    return c.json({ error: "Plan is already applied" }, 400);
  }

  // Check for an existing applied plan with the same (scope, scopeId, profileType, color)
  const conflicting = await db
    .select()
    .from(cuttingPlans)
    .where(
      and(
        eq(cuttingPlans.projectId, plan[0].projectId),
        eq(cuttingPlans.scope, plan[0].scope),
        eq(cuttingPlans.scopeId, plan[0].scopeId ?? ""),
        eq(cuttingPlans.profileType, plan[0].profileType),
        eq(cuttingPlans.color, plan[0].color),
        eq(cuttingPlans.isApplied, true),
      ),
    );

  // Un-apply any conflicting plan first
  if (conflicting.length > 0) {
    await reverseStockMovements(db, conflicting[0]);
    await db
      .update(cuttingPlans)
      .set({ isApplied: false })
      .where(eq(cuttingPlans.id, conflicting[0].id));
  }

  // Apply the new plan
  await applyStockMovements(db, plan[0]);
  await db
    .update(cuttingPlans)
    .set({ isApplied: true })
    .where(eq(cuttingPlans.id, planId));

  return c.json({ id: planId, isApplied: true });
});

// ─── POST /api/projects/:id/cutting-plans/:planId/unapply — un-apply plan ────

cuttingPlanRoutes.post("/:planId/unapply", async (c) => {
  const db = getDb(c.env);
  const planId = c.req.param("planId");

  const plan = await db
    .select()
    .from(cuttingPlans)
    .where(eq(cuttingPlans.id, planId))
    .limit(1);

  if (plan.length === 0) {
    return c.json({ error: "Cutting plan not found" }, 404);
  }

  if (!plan[0].isApplied) {
    return c.json({ error: "Plan is not applied" }, 400);
  }

  await reverseStockMovements(db, plan[0]);
  await db
    .update(cuttingPlans)
    .set({ isApplied: false })
    .where(eq(cuttingPlans.id, planId));

  return c.json({ id: planId, isApplied: false });
});

// ─── Stock movement helpers ───────────────────────────────────────────────────

interface BarFromPlan {
  stockLengthId?: string;
}

/**
 * Apply stock movements for a cutting plan.
 * For each bar, consume one unit from the source stock entry.
 * - Catalog-linked: catalog.quantity -= 1, catalog.reservedQty -= 1, catalog.usedQty += 1
 * - Project-local: stock.quantity -= 1
 * - Unlimited stock (quantity === -1): no-op
 */
async function applyStockMovements(
  db: ReturnType<typeof getDb>,
  plan: typeof cuttingPlans.$inferSelect,
): Promise<void> {
  const bars = JSON.parse(plan.bars) as BarFromPlan[];

  // Count how many bars consume each stock entry
  const consumption = new Map<string, number>();
  for (const bar of bars) {
    if (!bar.stockLengthId) continue;
    consumption.set(bar.stockLengthId, (consumption.get(bar.stockLengthId) ?? 0) + 1);
  }

  // Fetch all affected stock entries in one pass
  const stockIds = [...consumption.keys()];
  const stockEntries = await db.select().from(stock).where(
    stockIds.length === 1
      ? eq(stock.id, stockIds[0])
      : or(...stockIds.map((id) => eq(stock.id, id))),
  );

  // Collect catalog IDs to fetch
  const catalogIds = new Set<string>();
  for (const entry of stockEntries) {
    if (entry.sourceDefaultId) catalogIds.add(entry.sourceDefaultId);
  }

  // Fetch all catalog entries in one pass
  let catalogEntries: typeof stockCatalog.$inferSelect[] = [];
  if (catalogIds.size > 0) {
    const catIds = [...catalogIds];
    catalogEntries = await db.select().from(stockCatalog).where(
      catIds.length === 1
        ? eq(stockCatalog.id, catIds[0])
        : or(...catIds.map((id) => eq(stockCatalog.id, id))),
    );
  }

  const catalogMap = new Map(catalogEntries.map((c) => [c.id, c]));

  // Apply stock updates (one UPDATE per stock entry)
  for (const entry of stockEntries) {
    const count = consumption.get(entry.id) ?? 0;

    if (entry.sourceDefaultId) {
      const catalog = catalogMap.get(entry.sourceDefaultId);
      if (catalog && catalog.quantity !== -1) {
        await db
          .update(stockCatalog)
          .set({
            quantity: catalog.quantity - count,
            reservedQty: Math.max(0, catalog.reservedQty - count),
            usedQty: catalog.usedQty + count,
          })
          .where(eq(stockCatalog.id, catalog.id));
      }
    }

    if (entry.quantity !== -1) {
      await db
        .update(stock)
        .set({ quantity: entry.quantity - count })
        .where(eq(stock.id, entry.id));
    }
  }
}

/**
 * Reverse stock movements for a cutting plan (un-apply).
 * Restores consumed bars back to stock.
 */
export async function reverseStockMovements(
  db: ReturnType<typeof getDb>,
  plan: typeof cuttingPlans.$inferSelect,
): Promise<void> {
  const bars = JSON.parse(plan.bars) as BarFromPlan[];

  // Count how many bars restore each stock entry
  const restoration = new Map<string, number>();
  for (const bar of bars) {
    if (!bar.stockLengthId) continue;
    restoration.set(bar.stockLengthId, (restoration.get(bar.stockLengthId) ?? 0) + 1);
  }

  // Fetch all affected stock entries in one pass
  const stockIds = [...restoration.keys()];
  const stockEntries = await db.select().from(stock).where(
    stockIds.length === 1
      ? eq(stock.id, stockIds[0])
      : or(...stockIds.map((id) => eq(stock.id, id))),
  );

  // Collect catalog IDs to fetch
  const catalogIds = new Set<string>();
  for (const entry of stockEntries) {
    if (entry.sourceDefaultId) catalogIds.add(entry.sourceDefaultId);
  }

  // Fetch all catalog entries in one pass
  let catalogEntries: typeof stockCatalog.$inferSelect[] = [];
  if (catalogIds.size > 0) {
    const catIds = [...catalogIds];
    catalogEntries = await db.select().from(stockCatalog).where(
      catIds.length === 1
        ? eq(stockCatalog.id, catIds[0])
        : or(...catIds.map((id) => eq(stockCatalog.id, id))),
    );
  }

  const catalogMap = new Map(catalogEntries.map((c) => [c.id, c]));

  // Restore stock (one UPDATE per stock entry)
  for (const entry of stockEntries) {
    const count = restoration.get(entry.id) ?? 0;

    if (entry.sourceDefaultId) {
      const catalog = catalogMap.get(entry.sourceDefaultId);
      if (catalog && catalog.quantity !== -1) {
        await db
          .update(stockCatalog)
          .set({
            quantity: catalog.quantity + count,
            reservedQty: catalog.reservedQty + count,
            usedQty: Math.max(0, catalog.usedQty - count),
          })
          .where(eq(stockCatalog.id, catalog.id));
      }
    }

    if (entry.quantity !== -1) {
      await db
        .update(stock)
        .set({ quantity: entry.quantity + count })
        .where(eq(stock.id, entry.id));
    }
  }
}

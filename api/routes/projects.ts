import { Hono } from "hono";
import { eq, and, sql, or, like } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  projects,
  buildings,
  projectFloorAssignments,
  projectOpeningSizes,
  apartmentTemplateOpenings,
  templates,
  templateVariables,
  templatePieces,
  stock,
  stockCatalog,
  profileSystems,
  cuttingPlans,
} from "../db/schema.js";
import type { Env } from "../index.js";
import { evalFormula } from "../lib/formula.js";
import { nameToSlug, generateUniqueSlug } from "../lib/slug.js";
import { reverseStockMovements } from "./cuttingPlans.js";

export const projectRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Resolve a project by slug or UUID.
 * Returns the project row or null.
 */
async function resolveProject(db: ReturnType<typeof getDb>, identifier: string) {
  const rows = await db
    .select()
    .from(projects)
    .where(or(eq(projects.slug, identifier), eq(projects.id, identifier)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Resolve a building by slug or UUID within a project.
 * Returns the building row or null.
 */
async function resolveBuilding(db: ReturnType<typeof getDb>, projectId: string, identifier: string) {
  const rows = await db
    .select()
    .from(buildings)
    .where(
      and(
        eq(buildings.projectId, projectId),
        or(eq(buildings.slug, identifier), eq(buildings.id, identifier)),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

type BuildingStatus = "draft" | "active" | "completed" | "archived";

function deriveProjectStatus(statuses: BuildingStatus[]): BuildingStatus {
  if (statuses.length === 0) return "draft";
  if (statuses.every((s) => s === "archived")) return "archived";
  if (statuses.every((s) => s === "completed" || s === "archived") && statuses.some((s) => s === "completed")) return "completed";
  if (statuses.some((s) => s === "active" || s === "completed")) return "active";
  return "draft";
}

// ─── GET /api/projects — List all ─────────────────────────────────────────────

projectRoutes.get("/", async (c) => {
  const db = getDb(c.env);
  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      name: projects.name,
      client: projects.client,
      status: projects.status,
      notes: projects.notes,
      floors: projects.floors,
      apartmentsPerFloor: projects.apartmentsPerFloor,
      floorLabels: projects.floorLabels,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      buildingCount: sql<number>`(SELECT COUNT(*) FROM buildings WHERE project_id = "projects"."id")`,
      completedBuildings: sql<number>`(SELECT COUNT(*) FROM buildings WHERE project_id = "projects"."id" AND status = 'completed')`,
    })
    .from(projects)
    .orderBy(projects.name);
  return c.json(rows);
});

// ─── GET /api/projects/:id — Full project with buildings + assignments + sizes ─

projectRoutes.get("/:id", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");

  const proj = await resolveProject(db, identifier);
  if (!proj) {
    return c.json({ error: "Project not found" }, 404);
  }

  const bldgs = await db
    .select()
    .from(buildings)
    .where(eq(buildings.projectId, proj.id))
    .orderBy(buildings.sortOrder);

  const assignments = await db
    .select()
    .from(projectFloorAssignments)
    .where(eq(projectFloorAssignments.projectId, proj.id));

  const sizes = await db
    .select()
    .from(projectOpeningSizes)
    .where(eq(projectOpeningSizes.projectId, proj.id));

  return c.json({
    ...proj,
    profileSystem: JSON.parse(proj.profileSystem),
    buildings: bldgs,
    assignments,
    openingSizes: sizes,
  });
});

// ─── POST /api/projects — Create with default building ────────────────────────

projectRoutes.post("/", async (c) => {
  const db = getDb(c.env);
  const body = await c.req.json<{
    name: string;
    client?: string;
    notes?: string;
  }>();

  if (!body.name?.trim()) {
    return c.json({ error: "Name is required" }, 400);
  }

  // Generate unique project slug
  const existingProjectSlugs = await db.select({ slug: projects.slug }).from(projects);
  const slugSet = new Set(existingProjectSlugs.map((p) => p.slug));
  const projectSlug = generateUniqueSlug(body.name, slugSet);

  const now = Date.now();
  const id = generateId();
  const buildingId = generateId();

  await db.insert(projects).values({
    id,
    slug: projectSlug,
    name: body.name,
    client: body.client ?? null,
    notes: body.notes ?? null,
    floors: 1,
    apartmentsPerFloor: 1,
    floorLabels: JSON.stringify(["A"]),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  // Auto-create a default building
  await db.insert(buildings).values({
    id: buildingId,
    projectId: id,
    slug: "building-a",
    name: "Building A",
    floors: 6,
    apartmentsPerFloor: 4,
    floorLabels: JSON.stringify(["A", "B", "C", "D", "E", "F"]),
    sortOrder: 0,
    createdAt: now,
  });

  return c.json({ id, slug: projectSlug, name: body.name, buildingId }, 201);
});

// ─── PUT /api/projects/:id — Update basic info ────────────────────────────────

projectRoutes.put("/:id", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");

  const existing = await resolveProject(db, identifier);
  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    client?: string;
    notes?: string;
    status?: string;
    measurementSystem?: string;
    unit?: string;
    kerfWidth?: number;
    pricePerBar?: number;
    optimizationStrategy?: string;
    profileSystem?: string[];
  }>();

  // Regenerate slug if name changed
  let newSlug = existing.slug;
  if (body.name && body.name !== existing.name) {
    const existingProjectSlugs = await db
      .select({ slug: projects.slug })
      .from(projects)
      .where(sql`${projects.id} != ${existing.id}`);
    const slugSet = new Set(existingProjectSlugs.map((p) => p.slug));
    newSlug = generateUniqueSlug(body.name, slugSet);
  }

  const now = Date.now();
  const newStatus = (body.status as "draft" | "active" | "completed" | "archived") ?? existing.status;
  await db
    .update(projects)
    .set({
      slug: newSlug,
      name: body.name ?? existing.name,
      client: body.client ?? existing.client,
      notes: body.notes ?? existing.notes,
      status: newStatus,
      measurementSystem: (body.measurementSystem as "metric" | "imperial") ?? existing.measurementSystem,
      unit: body.unit ?? existing.unit,
      kerfWidth: body.kerfWidth ?? existing.kerfWidth,
      pricePerBar: body.pricePerBar ?? existing.pricePerBar,
      optimizationStrategy: (body.optimizationStrategy as "balanced" | "maximize_large_bars") ?? existing.optimizationStrategy,
      profileSystem: body.profileSystem ? JSON.stringify(body.profileSystem) : existing.profileSystem,
      updatedAt: now,
    })
    .where(eq(projects.id, existing.id));

  // When archiving project, archive all buildings too
  if (newStatus === "archived") {
    await db
      .update(buildings)
      .set({ status: "archived" })
      .where(eq(buildings.projectId, existing.id));
  }

  return c.json({ id: existing.id, slug: newSlug, updated: true });
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────

projectRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");

  const proj = await resolveProject(db, identifier);
  if (!proj) {
    return c.json({ error: "Project not found" }, 404);
  }
  const id = proj.id;

  // Un-apply all applied cutting plans (reverse stock movements)
  const appliedPlans = await db
    .select()
    .from(cuttingPlans)
    .where(and(eq(cuttingPlans.projectId, id), eq(cuttingPlans.isApplied, true)));

  for (const plan of appliedPlans) {
    await reverseStockMovements(db, plan);
    await db
      .update(cuttingPlans)
      .set({ isApplied: false })
      .where(eq(cuttingPlans.id, plan.id));
  }

  // Release reservedQty on linked stock defaults for all project stock entries
  const projectStock = await db
    .select()
    .from(stock)
    .where(eq(stock.projectId, id));

  for (const entry of projectStock) {
    if (entry.sourceDefaultId && entry.quantity > 0) {
      const def = await db
        .select()
        .from(stockCatalog)
        .where(eq(stockCatalog.id, entry.sourceDefaultId))
        .limit(1);
      if (def.length > 0 && def[0].quantity !== -1) {
        await db
          .update(stockCatalog)
          .set({ reservedQty: Math.max(0, def[0].reservedQty - entry.quantity) })
          .where(eq(stockCatalog.id, entry.sourceDefaultId));
      }
    }
  }

  // Delete all project data
  await db.delete(stock).where(eq(stock.projectId, id));
  await db.delete(projectFloorAssignments).where(eq(projectFloorAssignments.projectId, id));
  await db.delete(projectOpeningSizes).where(eq(projectOpeningSizes.projectId, id));
  await db.delete(buildings).where(eq(buildings.projectId, id));
  await db.delete(projects).where(eq(projects.id, id));

  return c.json({ deleted: true });
});

// ─── POST /api/projects/:id/buildings — Add building ──────────────────────────

projectRoutes.post("/:id/buildings", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");
  const body = await c.req.json<{
    name: string;
    floors?: number;
    apartmentsPerFloor?: number;
    floorLabels?: string[];
    status?: string;
  }>();

  if (!body.name?.trim()) {
    return c.json({ error: "Building name is required" }, 400);
  }

  const proj = await resolveProject(db, identifier);
  if (!proj) {
    return c.json({ error: "Project not found" }, 404);
  }
  const id = proj.id;

  const existing = await db
    .select()
    .from(buildings)
    .where(eq(buildings.projectId, id));
  const sortOrder = existing.length;

  // Generate unique building slug within project
  const existingSlugs = new Set(existing.map((b) => b.slug));
  const buildingSlug = generateUniqueSlug(body.name, existingSlugs);

  const buildingId = generateId();
  await db.insert(buildings).values({
    id: buildingId,
    projectId: id,
    slug: buildingSlug,
    name: body.name,
    floors: body.floors ?? 6,
    apartmentsPerFloor: body.apartmentsPerFloor ?? 4,
    floorLabels: JSON.stringify(body.floorLabels ?? ["A", "B", "C", "D", "E", "F"]),
    sortOrder,
    status: "draft",
    createdAt: Date.now(),
  });

  return c.json({ id: buildingId, slug: buildingSlug, name: body.name }, 201);
});

// ─── PUT /api/projects/:id/buildings/:buildingId — Update building ────────────

projectRoutes.put("/:id/buildings/:buildingId", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");
  const buildingIdentifier = c.req.param("buildingId");

  const proj = await resolveProject(db, identifier);
  if (!proj) {
    return c.json({ error: "Project not found" }, 404);
  }

  const existing = await resolveBuilding(db, proj.id, buildingIdentifier);
  if (!existing) {
    return c.json({ error: "Building not found" }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    floors?: number;
    apartmentsPerFloor?: number;
    floorLabels?: string[];
    status?: string;
  }>();

  // Regenerate slug if name changed
  let newSlug = existing.slug;
  if (body.name && body.name !== existing.name) {
    const siblings = await db
      .select({ slug: buildings.slug })
      .from(buildings)
      .where(sql`${buildings.projectId} = ${proj.id} AND ${buildings.id} != ${existing.id}`);
    const slugSet = new Set(siblings.map((b) => b.slug));
    newSlug = generateUniqueSlug(body.name, slugSet);
  }

  await db
    .update(buildings)
    .set({
      slug: newSlug,
      name: body.name ?? existing.name,
      floors: body.floors ?? existing.floors,
      apartmentsPerFloor: body.apartmentsPerFloor ?? existing.apartmentsPerFloor,
      floorLabels: body.floorLabels
        ? JSON.stringify(body.floorLabels)
        : existing.floorLabels,
      status: (body.status as "draft" | "active" | "completed" | "archived") ?? existing.status,
    })
    .where(eq(buildings.id, existing.id));

  // Derive project status from building statuses
  const allBuildings = await db
    .select({ status: buildings.status })
    .from(buildings)
    .where(eq(buildings.projectId, proj.id));

  const derivedStatus = deriveProjectStatus(allBuildings.map((b) => b.status));
  await db
    .update(projects)
    .set({ status: derivedStatus, updatedAt: Date.now() })
    .where(eq(projects.id, proj.id));

  return c.json({ id: existing.id, slug: newSlug, updated: true, projectStatus: derivedStatus });
});

// ─── DELETE /api/projects/:id/buildings/:buildingId ───────────────────────────

projectRoutes.delete("/:id/buildings/:buildingId", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");
  const buildingIdentifier = c.req.param("buildingId");

  const proj = await resolveProject(db, identifier);
  if (!proj) {
    return c.json({ error: "Project not found" }, 404);
  }

  const bldg = await resolveBuilding(db, proj.id, buildingIdentifier);
  if (!bldg) {
    return c.json({ error: "Building not found" }, 404);
  }
  const buildingId = bldg.id;

  await db.delete(projectFloorAssignments).where(eq(projectFloorAssignments.buildingId, buildingId));
  await db.delete(projectOpeningSizes).where(eq(projectOpeningSizes.buildingId, buildingId));
  await db.delete(buildings).where(eq(buildings.id, buildingId));

  // Re-derive project status
  const remaining = await db
    .select({ status: buildings.status })
    .from(buildings)
    .where(eq(buildings.projectId, proj.id));
  const derivedStatus = deriveProjectStatus(remaining.map((b) => b.status));
  await db
    .update(projects)
    .set({ status: derivedStatus, updatedAt: Date.now() })
    .where(eq(projects.id, proj.id));

  return c.json({ deleted: true, projectStatus: derivedStatus });
});

// ─── PUT /api/projects/:id/buildings/:buildingId/assignments ──────────────────

projectRoutes.put("/:id/buildings/:buildingId/assignments", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");
  const buildingIdentifier = c.req.param("buildingId");

  const proj = await resolveProject(db, identifier);
  if (!proj) return c.json({ error: "Project not found" }, 404);
  const bldg = await resolveBuilding(db, proj.id, buildingIdentifier);
  if (!bldg) return c.json({ error: "Building not found" }, 404);

  const id = proj.id;
  const buildingId = bldg.id;
  const body = await c.req.json<{
    assignments: {
      floor: number;
      apartmentIndex: number;
      apartmentTemplateId: string | null;
    }[];
  }>();

  await db
    .delete(projectFloorAssignments)
    .where(eq(projectFloorAssignments.buildingId, buildingId));

  for (const a of body.assignments) {
    if (a.apartmentTemplateId) {
      await db.insert(projectFloorAssignments).values({
        id: generateId(),
        projectId: id,
        buildingId,
        floor: a.floor,
        apartmentIndex: a.apartmentIndex,
        apartmentTemplateId: a.apartmentTemplateId,
      });
    }
  }

  return c.json({ saved: true });
});

// ─── PUT /api/projects/:id/buildings/:buildingId/opening-sizes ────────────────

projectRoutes.put("/:id/buildings/:buildingId/opening-sizes", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");
  const buildingIdentifier = c.req.param("buildingId");

  const proj = await resolveProject(db, identifier);
  if (!proj) return c.json({ error: "Project not found" }, 404);
  const bldg = await resolveBuilding(db, proj.id, buildingIdentifier);
  if (!bldg) return c.json({ error: "Building not found" }, 404);

  const id = proj.id;
  const buildingId = bldg.id;
  const body = await c.req.json<{
    sizes: {
      apartmentTemplateOpeningId: string;
      floor: number;
      apartmentIndex: number;
      width: number;
      height: number;
    }[];
  }>();

  await db
    .delete(projectOpeningSizes)
    .where(eq(projectOpeningSizes.buildingId, buildingId));

  if (body.sizes.length > 0) {
    await db.insert(projectOpeningSizes).values(
      body.sizes.map((s) => ({
        id: generateId(),
        projectId: id,
        buildingId,
        apartmentTemplateOpeningId: s.apartmentTemplateOpeningId,
        floor: s.floor,
        apartmentIndex: s.apartmentIndex,
        width: s.width,
        height: s.height,
      })),
    );
  }

  return c.json({ saved: true });
});

// ─── GET /api/projects/:id/pieces — Aggregate all pieces for optimization ─────

projectRoutes.get("/:id/pieces", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");

  const proj = await resolveProject(db, identifier);
  if (!proj) {
    return c.json({ error: "Project not found" }, 404);
  }
  const id = proj.id;

  const bldgs = await db
    .select()
    .from(buildings)
    .where(eq(buildings.projectId, id))
    .orderBy(buildings.sortOrder);

  const sizes = await db
    .select()
    .from(projectOpeningSizes)
    .where(eq(projectOpeningSizes.projectId, id));

  const pools: Record<string, {
    pieceTemplateId: string;
    templateName: string;
    profileType: string;
    profileSystemKey: string | null;
    pieces: { label: string; length: number; quantity: number; source: string }[];
  }> = {};

  // Build a map of building names for source labels
  const buildingNames: Record<string, string> = {};
  for (const b of bldgs) {
    buildingNames[b.id] = b.name;
  }

  for (const size of sizes) {
    // Find the opening instance
    const opening = await db
      .select()
      .from(apartmentTemplateOpenings)
      .where(eq(apartmentTemplateOpenings.id, size.apartmentTemplateOpeningId))
      .limit(1);
    if (opening.length === 0) continue;

    const pieceTemplateId = opening[0].pieceTemplateId;

    // Get the piece template (for name + profile system)
    const tpl = await db
      .select()
      .from(templates)
      .where(eq(templates.id, pieceTemplateId))
      .limit(1);

    const templateName = tpl[0]?.name ?? "Unknown";
    const profileSystemId = tpl[0]?.profileSystemId ?? null;

    // Resolve profile system key and constants
    let profileSystemKey: string | null = null;
    let sysConstants: Record<string, number> = {};
    if (profileSystemId) {
      const sys = await db
        .select({ key: profileSystems.key, constants: profileSystems.constants })
        .from(profileSystems)
        .where(eq(profileSystems.id, profileSystemId))
        .limit(1);
      profileSystemKey = sys[0]?.key ?? null;
      try {
        const consts = JSON.parse(sys[0]?.constants ?? "[]") as { name: string; defaultValue: number }[];
        for (const c of consts) sysConstants[c.name] = c.defaultValue;
      } catch {}
    }

    // Get template variables
    const vars = await db
      .select()
      .from(templateVariables)
      .where(eq(templateVariables.templateId, pieceTemplateId))
      .orderBy(templateVariables.sortOrder);

    // Get template pieces
    const pieces = await db
      .select()
      .from(templatePieces)
      .where(eq(templatePieces.templateId, pieceTemplateId))
      .orderBy(templatePieces.sortOrder);

    const buildingName = buildingNames[size.buildingId] ?? "Unknown";

    // Build formula context: W, H + profile system constants + template variables
    const ctx: Record<string, number> = {
      W: size.width,
      H: size.height,
      ...sysConstants,
    };
    for (const v of vars) {
      ctx[v.name] = v.defaultValue;
    }

    // Evaluate each piece
    for (const piece of pieces) {
      const poolKey = `${pieceTemplateId}__${piece.profileType}__${profileSystemKey ?? "none"}`;
      if (!pools[poolKey]) {
        pools[poolKey] = {
          pieceTemplateId,
          templateName,
          profileType: piece.profileType,
          profileSystemKey,
          pieces: [],
        };
      }

      // Simple formula evaluation (reuse the engine logic inline for the API)
      let length = 0;
      try {
        length = evalFormula(piece.lengthFormula, ctx);
      } catch {
        continue;
      }

      pools[poolKey].pieces.push({
        label: `${buildingName} ${opening[0].label} F${size.floor} A${size.apartmentIndex} — ${piece.label}`,
        length,
        quantity: piece.quantity,
        source: `${buildingName} F${size.floor}A${size.apartmentIndex}`,
      });
    }
  }

  return c.json({
    project: proj,
    buildings: bldgs,
    pools: Object.values(pools),
  });
});

// ─── GET /api/projects/:id/stock — List project stock ──────────────────────────

projectRoutes.get("/:id/stock", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");

  const proj = await resolveProject(db, identifier);
  if (!proj) return c.json({ error: "Project not found" }, 404);

  const rows = await db
    .select()
    .from(stock)
    .where(eq(stock.projectId, proj.id));

  return c.json(rows);
});

// ─── POST /api/projects/:id/stock — Add stock entry ───────────────────────────

projectRoutes.post("/:id/stock", async (c) => {
  const db = getDb(c.env);
  const identifier = c.req.param("id");

  const proj = await resolveProject(db, identifier);
  if (!proj) return c.json({ error: "Project not found" }, 404);
  const id = proj.id;
  const body = await c.req.json<{
    profileType: string;
    color: string;
    length?: number;
    label?: string;
    quantity?: number;
    isRemnant?: boolean;
    sourceDefaultId?: string;
  }>();

  const entryId = generateId();
  const qty = body.quantity ?? -1;

  // Copy profileSystem from catalog entry if linked
  let profileSystem: string | null = null;
  if (body.sourceDefaultId) {
    const def = await db
      .select()
      .from(stockCatalog)
      .where(eq(stockCatalog.id, body.sourceDefaultId))
      .limit(1);
    if (def.length > 0) {
      profileSystem = def[0].profileSystem;
    }
  }

  await db.insert(stock).values({
    id: entryId,
    projectId: id,
    profileSystem,
    profileType: body.profileType,
    color: body.color,
    length: body.length ?? null,
    label: body.label ?? null,
    quantity: qty,
    isRemnant: body.isRemnant ?? false,
    sourceDefaultId: body.sourceDefaultId ?? null,
  });

  // Reserve inventory on the stock default if linked and quantity is tracked
  if (body.sourceDefaultId && qty > 0) {
    const def = await db
      .select()
      .from(stockCatalog)
      .where(eq(stockCatalog.id, body.sourceDefaultId))
      .limit(1);
    if (def.length > 0 && def[0].quantity !== -1) {
      await db
        .update(stockCatalog)
        .set({ reservedQty: def[0].reservedQty + qty })
        .where(eq(stockCatalog.id, body.sourceDefaultId));
    }
  }

  return c.json({ id: entryId }, 201);
});

// ─── PUT /api/projects/:id/stock/:stockId — Update stock entry ────────────────

projectRoutes.put("/:id/stock/:stockId", async (c) => {
  const db = getDb(c.env);
  const stockId = c.req.param("stockId");

  const existing = await db
    .select()
    .from(stock)
    .where(eq(stock.id, stockId))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Stock entry not found" }, 404);
  }

  const body = await c.req.json<{
    profileType?: string;
    color?: string;
    length?: number;
    label?: string;
    quantity?: number;
    isRemnant?: boolean;
  }>();

  await db
    .update(stock)
    .set({
      profileType: body.profileType ?? existing[0].profileType,
      color: body.color ?? existing[0].color,
      length: body.length !== undefined ? body.length : existing[0].length,
      label: body.label !== undefined ? body.label : existing[0].label,
      quantity: body.quantity ?? existing[0].quantity,
      isRemnant: body.isRemnant ?? existing[0].isRemnant,
    })
    .where(eq(stock.id, stockId));

  // Adjust reservedQty on the linked stock default if quantity changed
  if (body.quantity !== undefined && existing[0].sourceDefaultId) {
    const oldQty = existing[0].quantity === -1 ? 0 : existing[0].quantity;
    const newQty = body.quantity === -1 ? 0 : body.quantity;
    const delta = newQty - oldQty;
    if (delta !== 0) {
      const def = await db
        .select()
        .from(stockCatalog)
        .where(eq(stockCatalog.id, existing[0].sourceDefaultId))
        .limit(1);
      if (def.length > 0 && def[0].quantity !== -1) {
        await db
          .update(stockCatalog)
          .set({ reservedQty: Math.max(0, def[0].reservedQty + delta) })
          .where(eq(stockCatalog.id, existing[0].sourceDefaultId));
      }
    }
  }

  return c.json({ id: stockId, updated: true });
});

// ─── GET /api/projects/:id/stock/:stockId/usage — Check references before delete

projectRoutes.get("/:id/stock/:stockId/usage", async (c) => {
  const db = getDb(c.env);
  const stockId = c.req.param("stockId");

  const existing = await db
    .select()
    .from(stock)
    .where(eq(stock.id, stockId))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Stock entry not found" }, 404);
  }

  const references: { type: string; id: string; name: string; detail?: string }[] = [];

  // Check if any applied cutting plan references this stock entry
  const appliedPlans = await db
    .select()
    .from(cuttingPlans)
    .where(
      and(
        eq(cuttingPlans.projectId, existing[0].projectId),
        eq(cuttingPlans.isApplied, true),
      ),
    );

  for (const plan of appliedPlans) {
    const bars = JSON.parse(plan.bars) as { stockLengthId?: string }[];
    if (bars.some((b) => b.stockLengthId === stockId)) {
      references.push({
        type: "applied_plan",
        id: plan.id,
        name: `Applied cutting plan (${plan.profileType})`,
        detail: "Un-apply the plan before deleting this stock entry",
      });
    }
  }

  return c.json({ canDelete: references.length === 0, references });
});

// ─── DELETE /api/projects/:id/stock/:stockId — Delete stock entry ─────────────

projectRoutes.delete("/:id/stock/:stockId", async (c) => {
  const db = getDb(c.env);
  const stockId = c.req.param("stockId");

  // Find the stock entry to check for sourceDefaultId before deleting
  const existing = await db
    .select()
    .from(stock)
    .where(eq(stock.id, stockId))
    .limit(1);

  if (existing.length === 0) {
    return c.json({ error: "Stock entry not found" }, 404);
  }

  // Check if any applied cutting plan references this stock entry
  const appliedPlans = await db
    .select()
    .from(cuttingPlans)
    .where(
      and(
        eq(cuttingPlans.projectId, existing[0].projectId),
        eq(cuttingPlans.isApplied, true),
      ),
    );

  for (const plan of appliedPlans) {
    const bars = JSON.parse(plan.bars) as { stockLengthId?: string }[];
    if (bars.some((b) => b.stockLengthId === stockId)) {
      return c.json({
        error: "Cannot delete: this stock entry is referenced by an applied cutting plan. Un-apply the plan first.",
      }, 400);
    }
  }

  await db.delete(stock).where(eq(stock.id, stockId));

  // Release reservation on the stock default if linked
  if (existing.length > 0 && existing[0].sourceDefaultId && existing[0].quantity > 0) {
    const def = await db
      .select()
      .from(stockCatalog)
      .where(eq(stockCatalog.id, existing[0].sourceDefaultId!))
      .limit(1);
    if (def.length > 0 && def[0].quantity !== -1) {
      await db
        .update(stockCatalog)
        .set({ reservedQty: Math.max(0, def[0].reservedQty - existing[0].quantity) })
        .where(eq(stockCatalog.id, existing[0].sourceDefaultId!));
    }
  }

  return c.json({ deleted: true });
});


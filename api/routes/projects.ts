import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
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
} from "../db/schema.js";
import type { Env } from "../index.js";

export const projectRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
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
      name: projects.name,
      client: projects.client,
      status: projects.status,
      notes: projects.notes,
      floors: projects.floors,
      apartmentsPerFloor: projects.apartmentsPerFloor,
      apartmentLabels: projects.apartmentLabels,
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
  const id = c.req.param("id");

  const proj = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (proj.length === 0) {
    return c.json({ error: "Project not found" }, 404);
  }

  const bldgs = await db
    .select()
    .from(buildings)
    .where(eq(buildings.projectId, id))
    .orderBy(buildings.sortOrder);

  const assignments = await db
    .select()
    .from(projectFloorAssignments)
    .where(eq(projectFloorAssignments.projectId, id));

  const sizes = await db
    .select()
    .from(projectOpeningSizes)
    .where(eq(projectOpeningSizes.projectId, id));

  return c.json({
    ...proj[0],
    profileSystem: JSON.parse(proj[0].profileSystem),
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

  const now = Date.now();
  const id = generateId();
  const buildingId = generateId();

  await db.insert(projects).values({
    id,
    name: body.name,
    client: body.client ?? null,
    notes: body.notes ?? null,
    floors: 1,
    apartmentsPerFloor: 1,
    apartmentLabels: JSON.stringify(["A"]),
    status: "draft",
    createdAt: now,
    updatedAt: now,
  });

  // Auto-create a default building
  await db.insert(buildings).values({
    id: buildingId,
    projectId: id,
    name: "Building A",
    floors: 6,
    apartmentsPerFloor: 4,
    apartmentLabels: JSON.stringify(["A", "B", "C", "D"]),
    sortOrder: 0,
    createdAt: now,
  });

  return c.json({ id, name: body.name, buildingId }, 201);
});

// ─── PUT /api/projects/:id — Update basic info ────────────────────────────────

projectRoutes.put("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (existing.length === 0) {
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

  const now = Date.now();
  const newStatus = (body.status as "draft" | "active" | "completed" | "archived") ?? existing[0].status;
  await db
    .update(projects)
    .set({
      name: body.name ?? existing[0].name,
      client: body.client ?? existing[0].client,
      notes: body.notes ?? existing[0].notes,
      status: newStatus,
      measurementSystem: (body.measurementSystem as "metric" | "imperial") ?? existing[0].measurementSystem,
      unit: body.unit ?? existing[0].unit,
      kerfWidth: body.kerfWidth ?? existing[0].kerfWidth,
      pricePerBar: body.pricePerBar ?? existing[0].pricePerBar,
      optimizationStrategy: (body.optimizationStrategy as "balanced" | "maximize_large_bars") ?? existing[0].optimizationStrategy,
      profileSystem: body.profileSystem ? JSON.stringify(body.profileSystem) : existing[0].profileSystem,
      updatedAt: now,
    })
    .where(eq(projects.id, id));

  // When archiving project, archive all buildings too
  if (newStatus === "archived") {
    await db
      .update(buildings)
      .set({ status: "archived" })
      .where(eq(buildings.projectId, id));
  }

  return c.json({ id, updated: true });
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────

projectRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

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
  const id = c.req.param("id");
  const body = await c.req.json<{
    name: string;
    floors?: number;
    apartmentsPerFloor?: number;
    apartmentLabels?: string[];
    status?: string;
  }>();

  if (!body.name?.trim()) {
    return c.json({ error: "Building name is required" }, 400);
  }

  const existing = await db
    .select()
    .from(buildings)
    .where(eq(buildings.projectId, id));
  const sortOrder = existing.length;

  const buildingId = generateId();
  await db.insert(buildings).values({
    id: buildingId,
    projectId: id,
    name: body.name,
    floors: body.floors ?? 6,
    apartmentsPerFloor: body.apartmentsPerFloor ?? 4,
    apartmentLabels: JSON.stringify(body.apartmentLabels ?? ["A", "B", "C", "D"]),
    sortOrder,
    status: "draft",
    createdAt: Date.now(),
  });

  return c.json({ id: buildingId, name: body.name }, 201);
});

// ─── PUT /api/projects/:id/buildings/:buildingId — Update building ────────────

projectRoutes.put("/:id/buildings/:buildingId", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const buildingId = c.req.param("buildingId");

  const existing = await db
    .select()
    .from(buildings)
    .where(eq(buildings.id, buildingId))
    .limit(1);
  if (existing.length === 0) {
    return c.json({ error: "Building not found" }, 404);
  }

  const body = await c.req.json<{
    name?: string;
    floors?: number;
    apartmentsPerFloor?: number;
    apartmentLabels?: string[];
    status?: string;
  }>();

  await db
    .update(buildings)
    .set({
      name: body.name ?? existing[0].name,
      floors: body.floors ?? existing[0].floors,
      apartmentsPerFloor: body.apartmentsPerFloor ?? existing[0].apartmentsPerFloor,
      apartmentLabels: body.apartmentLabels
        ? JSON.stringify(body.apartmentLabels)
        : existing[0].apartmentLabels,
      status: (body.status as "draft" | "active" | "completed" | "archived") ?? existing[0].status,
    })
    .where(eq(buildings.id, buildingId));

  // Derive project status from building statuses
  const allBuildings = await db
    .select({ status: buildings.status })
    .from(buildings)
    .where(eq(buildings.projectId, id));

  const derivedStatus = deriveProjectStatus(allBuildings.map((b) => b.status));
  await db
    .update(projects)
    .set({ status: derivedStatus, updatedAt: Date.now() })
    .where(eq(projects.id, id));

  return c.json({ id: buildingId, updated: true, projectStatus: derivedStatus });
});

// ─── DELETE /api/projects/:id/buildings/:buildingId ───────────────────────────

projectRoutes.delete("/:id/buildings/:buildingId", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const buildingId = c.req.param("buildingId");

  await db.delete(buildings).where(eq(buildings.id, buildingId));

  // Re-derive project status
  const remaining = await db
    .select({ status: buildings.status })
    .from(buildings)
    .where(eq(buildings.projectId, id));
  const derivedStatus = deriveProjectStatus(remaining.map((b) => b.status));
  await db
    .update(projects)
    .set({ status: derivedStatus, updatedAt: Date.now() })
    .where(eq(projects.id, id));

  return c.json({ deleted: true, projectStatus: derivedStatus });
});

// ─── PUT /api/projects/:id/buildings/:buildingId/assignments ──────────────────

projectRoutes.put("/:id/buildings/:buildingId/assignments", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
  const buildingId = c.req.param("buildingId");
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
  const id = c.req.param("id");
  const buildingId = c.req.param("buildingId");
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

  for (const s of body.sizes) {
    await db.insert(projectOpeningSizes).values({
      id: generateId(),
      projectId: id,
      buildingId,
      apartmentTemplateOpeningId: s.apartmentTemplateOpeningId,
      floor: s.floor,
      apartmentIndex: s.apartmentIndex,
      width: s.width,
      height: s.height,
    });
  }

  return c.json({ saved: true });
});

// ─── GET /api/projects/:id/pieces — Aggregate all pieces for optimization ─────

projectRoutes.get("/:id/pieces", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const proj = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (proj.length === 0) {
    return c.json({ error: "Project not found" }, 404);
  }

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

    // Resolve profile system key
    let profileSystemKey: string | null = null;
    if (profileSystemId) {
      const sys = await db
        .select({ key: profileSystems.key })
        .from(profileSystems)
        .where(eq(profileSystems.id, profileSystemId))
        .limit(1);
      profileSystemKey = sys[0]?.key ?? null;
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

    // Build formula context
    const ctx: Record<string, number> = {
      W: size.width,
      H: size.height,
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
    project: proj[0],
    buildings: bldgs,
    pools: Object.values(pools),
  });
});

// Simple inline formula evaluator for the API side
function evalFormula(formula: string, ctx: Record<string, number>): number {
  const tokens = tokenize(formula);
  const rpn = toRPN(tokens);
  return evalRPN(rpn, ctx);
}

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === " " || ch === "\t" || ch === "\n") { i++; continue; }
    if (ch === "(" || ch === ")") { tokens.push(ch); i++; continue; }
    if ("+-*/".includes(ch)) { tokens.push(ch); i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push(num);
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { ident += expr[i]; i++; }
      tokens.push(ident);
      continue;
    }
    throw new Error(`Unexpected character: "${ch}"`);
  }
  return tokens;
}

const OPS: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

function toRPN(tokens: string[]): string[] {
  const output: string[] = [];
  const stack: string[] = [];
  for (const token of tokens) {
    if (token === "(") { stack.push(token); }
    else if (token === ")") {
      while (stack.length && stack[stack.length - 1] !== "(") output.push(stack.pop()!);
      stack.pop();
    } else if (token in OPS) {
      while (stack.length && stack[stack.length - 1] in OPS && OPS[stack[stack.length - 1]] >= OPS[token]) {
        output.push(stack.pop()!);
      }
      stack.push(token);
    } else { output.push(token); }
  }
  while (stack.length) output.push(stack.pop()!);
  return output;
}

function evalRPN(rpn: string[], ctx: Record<string, number>): number {
  const stack: number[] = [];
  for (const token of rpn) {
    if (token in OPS) {
      const b = stack.pop()!;
      const a = stack.pop()!;
      switch (token) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/": if (b === 0) throw new Error("Division by zero"); stack.push(a / b); break;
      }
    } else if (/^[0-9.]+$/.test(token)) {
      stack.push(parseFloat(token));
    } else {
      if (!(token in ctx)) throw new Error(`Unknown variable: ${token}`);
      stack.push(ctx[token]);
    }
  }
  const result = stack[0];
  return Math.round(result * 100) / 100;
}

// ─── GET /api/projects/:id/stock — List project stock ──────────────────────────

projectRoutes.get("/:id/stock", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const rows = await db
    .select()
    .from(stock)
    .where(eq(stock.projectId, id));

  return c.json(rows);
});

// ─── POST /api/projects/:id/stock — Add stock entry ───────────────────────────

projectRoutes.post("/:id/stock", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");
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


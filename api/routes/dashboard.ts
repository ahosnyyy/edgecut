import { Hono } from "hono";
import { inArray } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  projects,
  projectOpeningSizes,
  apartmentTemplateOpenings,
  templates,
  templateVariables,
  templatePieces,
  profileSystems,
  stockCatalog,
} from "../db/schema.js";
import type { Env } from "../index.js";
import { evalFormula } from "../lib/formula.js";

export const dashboardRoutes = new Hono<{ Bindings: Env }>();

interface Shortfall {
  system: string;
  profileType: string;
  demandLength: number;
  availableLength: number;
  deficitLength: number;
}

interface DemandCombo {
  system: string;
  profileType: string;
  demandLength: number;
  availableLength: number;
  covered: boolean;
  unlimited: boolean;
  deficitBars: number;
  barLength: number;
}

interface ProfileConstant {
  name: string;
  label: string;
  defaultValue: number;
}

// ─── GET /api/dashboard/stock-coverage ───────────────────────────────────────
// Computes whether current stock can fulfill the linear-length demand of all
// active/draft projects, broken down by (profile system, profile type).
// Uses batched queries (no per-row N+1) so it scales with project count.

dashboardRoutes.get("/stock-coverage", async (c) => {
  const db = getDb(c.env);

  // 1. Active + draft projects (the relevant workload).
  const activeProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.status, ["active", "draft"]));

  if (activeProjects.length === 0) {
    return c.json({ hasData: false, coveragePct: 100, totalCombos: 0, coveredCombos: 0, demandLength: 0, shortfalls: [] });
  }
  const projectIds = activeProjects.map((p) => p.id);

  // 2. All opening sizes for those projects.
  const sizes = await db
    .select()
    .from(projectOpeningSizes)
    .where(inArray(projectOpeningSizes.projectId, projectIds));

  if (sizes.length === 0) {
    return c.json({ hasData: false, coveragePct: 100, totalCombos: 0, coveredCombos: 0, demandLength: 0, shortfalls: [] });
  }

  // 3. Lookup tables (small, loaded in full and indexed in memory).
  const [openings, tpls, systems, pieces, vars, catalog] = await Promise.all([
    db.select().from(apartmentTemplateOpenings),
    db.select().from(templates),
    db.select().from(profileSystems),
    db.select().from(templatePieces),
    db.select().from(templateVariables),
    db.select().from(stockCatalog),
  ]);

  const openingToTemplate = new Map<string, string>();
  for (const o of openings) openingToTemplate.set(o.id, o.pieceTemplateId);

  const templateToSystemId = new Map<string, string | null>();
  for (const t of tpls) templateToSystemId.set(t.id, t.profileSystemId);

  const systemIdToKey = new Map<string, string>();
  for (const s of systems) systemIdToKey.set(s.id, s.key);

  // Parse profile system constants (JSON) — these provide formula variables
  // like weldingAllowance, frameDepth, etc. that are NOT in template_variables.
  const systemConstants = new Map<string, Record<string, number>>();
  for (const s of systems) {
    const parsed: Record<string, number> = {};
    try {
      const consts = JSON.parse(s.constants ?? "[]") as ProfileConstant[];
      for (const c of consts) parsed[c.name] = c.defaultValue;
    } catch {}
    systemConstants.set(s.id, parsed);
  }

  const piecesByTemplate = new Map<string, typeof pieces>();
  for (const p of pieces) {
    const list = piecesByTemplate.get(p.templateId) ?? [];
    list.push(p);
    piecesByTemplate.set(p.templateId, list);
  }

  const varsByTemplate = new Map<string, typeof vars>();
  for (const v of vars) {
    const list = varsByTemplate.get(v.templateId) ?? [];
    list.push(v);
    varsByTemplate.set(v.templateId, list);
  }

  // 4. Demand: total linear length per (systemKey | profileType).
  const demand = new Map<string, { system: string; profileType: string; length: number }>();
  for (const size of sizes) {
    const pieceTemplateId = openingToTemplate.get(size.apartmentTemplateOpeningId);
    if (!pieceTemplateId) continue;

    const systemId = templateToSystemId.get(pieceTemplateId) ?? null;
    const systemKey = systemId ? systemIdToKey.get(systemId) ?? "unassigned" : "unassigned";
    const tplPieces = piecesByTemplate.get(pieceTemplateId) ?? [];
    const tplVars = varsByTemplate.get(pieceTemplateId) ?? [];

    // Build formula context: W, H + profile system constants + template variables
    const ctx: Record<string, number> = { W: size.width, H: size.height };
    const sysConsts = systemId ? systemConstants.get(systemId) : null;
    if (sysConsts) Object.assign(ctx, sysConsts);
    for (const v of tplVars) ctx[v.name] = v.defaultValue;

    for (const piece of tplPieces) {
      let length = 0;
      try {
        length = evalFormula(piece.lengthFormula, ctx);
      } catch {
        continue;
      }
      if (length <= 0) continue;
      const key = `${systemKey}|${piece.profileType}`;
      const entry = demand.get(key) ?? { system: systemKey, profileType: piece.profileType, length: 0 };
      entry.length += length * piece.quantity;
      demand.set(key, entry);
    }
  }

  // 5. Supply: available linear length per (system | profileType).
  // Also track bar length per type for deficit bar calculation.
  const supply = new Map<string, { length: number; unlimited: boolean; barLength: number }>();
  for (const e of catalog) {
    const key = `${e.profileSystem}|${e.profileType}`;
    const cur = supply.get(key) ?? { length: 0, unlimited: false, barLength: e.length };
    if (e.quantity === -1) {
      cur.unlimited = true;
    } else {
      const available = e.quantity - e.reservedQty;
      if (available > 0) cur.length += available * e.length;
    }
    // Use the first non-zero bar length found for this type
    if (cur.barLength === 0 && e.length > 0) cur.barLength = e.length;
    supply.set(key, cur);
  }

  // 6. Coverage (demand-weighted fraction of demand that can be met).
  let totalDemand = 0;
  let totalMet = 0;
  let coveredCombos = 0;
  const shortfalls: Shortfall[] = [];
  const demandBreakdown: DemandCombo[] = [];

  for (const [key, d] of demand) {
    const sup = supply.get(key);
    const availableLength = sup?.length ?? 0;
    const unlimited = sup?.unlimited ?? false;
    const met = unlimited ? d.length : Math.min(d.length, availableLength);
    const covered = unlimited || availableLength + 0.01 >= d.length;

    totalDemand += d.length;
    totalMet += met;
    if (covered) {
      coveredCombos += 1;
    } else {
      shortfalls.push({
        system: d.system,
        profileType: d.profileType,
        demandLength: Math.round(d.length),
        availableLength: Math.round(availableLength),
        deficitLength: Math.round(d.length - availableLength),
      });
    }
    const deficitLength = unlimited ? 0 : Math.max(0, d.length - availableLength);
    const barLength = sup?.barLength ?? 0;
    const deficitBars = deficitLength > 0 && barLength > 0
      ? Math.ceil(deficitLength / barLength)
      : 0;

    demandBreakdown.push({
      system: d.system,
      profileType: d.profileType,
      demandLength: Math.round(d.length),
      availableLength: Math.round(availableLength),
      covered,
      unlimited,
      deficitBars,
      barLength,
    });
  }

  shortfalls.sort((a, b) => b.deficitLength - a.deficitLength);
  demandBreakdown.sort((a, b) => b.demandLength - a.demandLength);

  return c.json({
    hasData: true,
    coveragePct: totalDemand > 0 ? Math.round((totalMet / totalDemand) * 100) : 100,
    totalCombos: demand.size,
    coveredCombos,
    demandLength: Math.round(totalDemand),
    shortfalls: shortfalls.slice(0, 6),
    demandBreakdown: demandBreakdown.slice(0, 20),
  });
});

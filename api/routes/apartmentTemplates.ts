import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  apartmentTemplates,
  apartmentTemplateOpenings,
  templates,
  profileSystems,
  projectFloorAssignments,
  projects,
  buildings,
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
    .select({
      id: apartmentTemplates.id,
      name: apartmentTemplates.name,
      description: apartmentTemplates.description,
      createdAt: apartmentTemplates.createdAt,
      updatedAt: apartmentTemplates.updatedAt,
      openingCount: sql<number>`(SELECT COUNT(*) FROM apartment_template_openings ato WHERE ato.apartment_template_id = ${sql.raw('"apartment_templates"."id"')})`.as("opening_count"),
      profileSystemKeys: sql<string | null>`(SELECT GROUP_CONCAT(DISTINCT ps.key) FROM apartment_template_openings ato JOIN templates t ON t.id = ato.piece_template_id JOIN profile_systems ps ON ps.id = t.profile_system_id WHERE ato.apartment_template_id = ${sql.raw('"apartment_templates"."id"')})`.as("profile_system_keys"),
    })
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

// ─── GET /api/apartment-templates/:id/usage — Check references before delete ──

apartmentTemplateRoutes.get("/:id/usage", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const assignments = await db
    .select({
      projectId: projectFloorAssignments.projectId,
      buildingId: projectFloorAssignments.buildingId,
      projectName: projects.name,
      buildingName: buildings.name,
    })
    .from(projectFloorAssignments)
    .innerJoin(projects, eq(projectFloorAssignments.projectId, projects.id))
    .innerJoin(buildings, eq(projectFloorAssignments.buildingId, buildings.id))
    .where(eq(projectFloorAssignments.apartmentTemplateId, id));

  const uniqueProjects = new Map<string, { name: string; buildings: Set<string> }>();
  for (const a of assignments) {
    if (!uniqueProjects.has(a.projectId)) {
      uniqueProjects.set(a.projectId, { name: a.projectName, buildings: new Set() });
    }
    uniqueProjects.get(a.projectId)!.buildings.add(a.buildingName);
  }

  const references = Array.from(uniqueProjects.entries()).map(([pid, info]) => ({
    type: "project" as const,
    id: pid,
    name: info.name,
    detail: `${info.buildings.size} building(s): ${Array.from(info.buildings).join(", ")}`,
  }));

  return c.json({ canDelete: references.length === 0, references });
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

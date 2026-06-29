import { Hono } from "hono";
import { eq, like, or } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  profileSystems,
  templates,
  apartmentTemplates,
  apartmentTemplateOpenings,
  projects,
} from "../db/schema.js";
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

// ─── GET /api/profile-systems/:id/usage — Check references before delete ──────

profileSystemRoutes.get("/:id/usage", async (c) => {
  const db = getDb(c.env);
  const id = c.req.param("id");

  const system = await db
    .select({ key: profileSystems.key, name: profileSystems.name })
    .from(profileSystems)
    .where(eq(profileSystems.id, id))
    .limit(1);

  if (system.length === 0) {
    return c.json({ error: "Profile system not found" }, 404);
  }

  const key = system[0].key;
  const references: { type: string; id: string; name: string; detail?: string }[] = [];

  // Check templates (piece templates) referencing this profile system
  const tplRefs = await db
    .select({ id: templates.id, name: templates.name })
    .from(templates)
    .where(eq(templates.profileSystemId, id));
  for (const t of tplRefs) {
    references.push({ type: "piece_template", id: t.id, name: t.name });
  }

  // Check apartment templates referencing this profile system key
  const aptTplRefs = await db
    .select({ id: apartmentTemplates.id, name: apartmentTemplates.name })
    .from(apartmentTemplates)
    .where(like(apartmentTemplates.id, `%${key}%`));

  // Apartment templates store profileSystemKeys as comma-separated in a separate query
  // We need to check via the openings → pieceTemplate → profileSystemId chain
  const aptWithSystem = await db
    .select({
      aptId: apartmentTemplates.id,
      aptName: apartmentTemplates.name,
    })
    .from(apartmentTemplates)
    .innerJoin(
      apartmentTemplateOpenings,
      eq(apartmentTemplateOpenings.apartmentTemplateId, apartmentTemplates.id)
    )
    .innerJoin(templates, eq(apartmentTemplateOpenings.pieceTemplateId, templates.id))
    .where(eq(templates.profileSystemId, id));

  const uniqueApt = new Map<string, string>();
  for (const a of aptWithSystem) {
    uniqueApt.set(a.aptId, a.aptName);
  }
  for (const [aid, aname] of uniqueApt) {
    references.push({ type: "apartment_template", id: aid, name: aname });
  }

  // Check projects referencing this profile system key
  const allProjects = await db
    .select({ id: projects.id, name: projects.name, profileSystem: projects.profileSystem })
    .from(projects);
  for (const p of allProjects) {
    try {
      const systems = JSON.parse(p.profileSystem) as string[];
      if (systems.includes(key)) {
        references.push({ type: "project", id: p.id, name: p.name });
      }
    } catch {
      // ignore parse errors
    }
  }

  return c.json({ canDelete: references.length === 0, references });
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

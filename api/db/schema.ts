import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: integer("created_at").notNull(),
});

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  client: text("client"),
  status: text("status", {
    enum: ["draft", "active", "completed", "archived"],
})
    .notNull()
    .default("draft"),
  notes: text("notes"),
  floors: integer("floors").notNull().default(1),
  apartmentsPerFloor: integer("apartments_per_floor").notNull().default(1),
  floorLabels: text("floor_labels").notNull().default("[]"),
  // Optimizer settings
  measurementSystem: text("measurement_system", {
    enum: ["metric", "imperial"],
  })
    .notNull()
    .default("metric"),
  unit: text("unit").notNull().default("cm"),
  kerfWidth: real("kerf_width").notNull().default(5),
  pricePerBar: real("price_per_bar").notNull().default(0),
  optimizationStrategy: text("optimization_strategy", {
    enum: ["balanced", "maximize_large_bars"],
  })
    .notNull()
    .default("maximize_large_bars"),
  profileSystem: text("profile_system").notNull().default('["manazil"]'),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ─── Apartment Types (per project — default room/opening definitions) ─────────

export const apartmentTypes = sqliteTable("apartment_types", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at").notNull(),
});

// ─── Room Definitions (per apartment type) ───────────────────────────────────

export const roomDefinitions = sqliteTable("room_definitions", {
  id: text("id").primaryKey(),
  apartmentTypeId: text("apartment_type_id")
    .notNull()
    .references(() => apartmentTypes.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Opening Definitions (per room definition — the default) ─────────────────

export const openingDefinitions = sqliteTable("opening_definitions", {
  id: text("id").primaryKey(),
  roomDefinitionId: text("room_definition_id")
    .notNull()
    .references(() => roomDefinitions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  templateId: text("template_id")
    .notNull()
    .references(() => templates.id),
  width: real("width").notNull(),
  height: real("height").notNull(),
  quantity: integer("quantity").notNull().default(1),
  color: text("color").notNull().default("White"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Buildings ───────────────────────────────────────────────────────────────

export const buildings = sqliteTable("buildings", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  floors: integer("floors").notNull().default(1),
  apartmentsPerFloor: integer("apartments_per_floor").notNull().default(1),
  floorLabels: text("floor_labels").notNull().default("[]"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status", {
    enum: ["draft", "active", "completed", "archived"],
  })
    .notNull()
    .default("draft"),
  createdAt: integer("created_at").notNull(),
}, (table) => ({
  projectSlugIdx: uniqueIndex("buildings_project_slug_idx").on(table.projectId, table.slug),
}));

// ─── Levels (floors in a building) ───────────────────────────────────────────

export const levels = sqliteTable("levels", {
  id: text("id").primaryKey(),
  buildingId: text("building_id")
    .notNull()
    .references(() => buildings.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

// ─── Apartments (assigned to a level, linked to apartment type) ──────────────

export const apartments = sqliteTable("apartments", {
  id: text("id").primaryKey(),
  levelId: text("level_id")
    .notNull()
    .references(() => levels.id, { onDelete: "cascade" }),
  apartmentTypeId: text("apartment_type_id")
    .notNull()
    .references(() => apartmentTypes.id),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

// ─── Rooms (generated from room_definitions when apartment is created) ───────

export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  apartmentId: text("apartment_id")
    .notNull()
    .references(() => apartments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  roomDefinitionId: text("room_definition_id"),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Openings (generated from opening_definitions, can be overridden) ────────

export const openings = sqliteTable("openings", {
  id: text("id").primaryKey(),
  roomId: text("room_id")
    .notNull()
    .references(() => rooms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  templateId: text("template_id")
    .notNull()
    .references(() => templates.id),
  width: real("width").notNull(),
  height: real("height").notNull(),
  quantity: integer("quantity").notNull().default(1),
  color: text("color").notNull().default("White"),
  openingDefinitionId: text("opening_definition_id"),
  isOverride: integer("is_override", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at").notNull(),
});

// ─── Apartment Templates (reusable recipes of opening instances) ─────────────

export const apartmentTemplates = sqliteTable("apartment_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ─── Apartment Template Openings (one row per opening instance) ──────────────

export const apartmentTemplateOpenings = sqliteTable("apartment_template_openings", {
  id: text("id").primaryKey(),
  apartmentTemplateId: text("apartment_template_id")
    .notNull()
    .references(() => apartmentTemplates.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  pieceTemplateId: text("piece_template_id")
    .notNull()
    .references(() => templates.id),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Project Floor Assignments (which apt template per floor×apt cell) ───────

export const projectFloorAssignments = sqliteTable("project_floor_assignments", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => buildings.id, { onDelete: "cascade" }),
  floor: integer("floor").notNull(),
  apartmentIndex: integer("apartment_index").notNull(),
  apartmentTemplateId: text("apartment_template_id").references(() => apartmentTemplates.id),
});

// ─── Project Opening Sizes (W×H per opening instance per floor×apt cell) ─────

export const projectOpeningSizes = sqliteTable("project_opening_sizes", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  buildingId: text("building_id")
    .notNull()
    .references(() => buildings.id, { onDelete: "cascade" }),
  apartmentTemplateOpeningId: text("apartment_template_opening_id")
    .notNull()
    .references(() => apartmentTemplateOpenings.id, { onDelete: "cascade" }),
  floor: integer("floor").notNull(),
  apartmentIndex: integer("apartment_index").notNull(),
  width: real("width").notNull(),
  height: real("height").notNull(),
});

// ─── Profile Systems (defines cutting constants per manufacturer/series) ─────

export const profileTypes = sqliteTable("profile_types", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const profileSystems = sqliteTable("profile_systems", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  constants: text("constants").notNull(),
  defaultPieces: text("default_pieces"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ─── Templates ───────────────────────────────────────────────────────────────

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["window", "door"] }).notNull(),
  profileSystemId: text("profile_system_id"),
  isBuiltin: integer("is_builtin", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ─── Template Variables (named variables per template) ───────────────────────

export const templateVariables = sqliteTable("template_variables", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => templates.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  label: text("label").notNull(),
  defaultValue: real("default_value").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Template Pieces (formula per piece) ─────────────────────────────────────

export const templatePieces = sqliteTable("template_pieces", {
  id: text("id").primaryKey(),
  templateId: text("template_id")
    .notNull()
    .references(() => templates.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  profileType: text("profile_type", {
    enum: ["frame", "sash", "mullion", "bead", "custom"],
  }).notNull(),
  lengthFormula: text("length_formula").notNull(),
  quantity: integer("quantity").notNull().default(1),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ─── Stock Catalog (global, reusable across projects) ────────────────────────

export const stockCatalog = sqliteTable("stock_catalog", {
  id: text("id").primaryKey(),
  profileSystem: text("profile_system", {
    enum: ["manazil", "premier"],
  })
    .notNull()
    .default("manazil"),
  profileType: text("profile_type").notNull(),
  color: text("color").notNull(),
  length: real("length").notNull(),
  quantity: integer("quantity").notNull().default(-1),
  label: text("label"),
  reservedQty: integer("reserved_qty").notNull().default(0),
  usedQty: integer("used_qty").notNull().default(0),
});

// ─── Stock (per-project overrides + remnants) ────────────────────────────────

export const stock = sqliteTable("stock", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  profileSystem: text("profile_system"),
  profileType: text("profile_type").notNull(),
  color: text("color").notNull(),
  length: real("length"),
  label: text("label"),
  quantity: integer("quantity").notNull().default(-1),
  isRemnant: integer("is_remnant", { mode: "boolean" })
    .notNull()
    .default(false),
  sourceDefaultId: text("source_default_id"),
});

// ─── Cutting Plans (saved optimization results) ──────────────────────────────

export const cuttingPlans = sqliteTable("cutting_plans", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  scope: text("scope", {
    enum: ["project", "building", "level", "apartment"],
  }).notNull(),
  scopeId: text("scope_id"),
  profileType: text("profile_type").notNull(),
  color: text("color").notNull(),
  bars: text("bars").notNull(),
  summary: text("summary").notNull(),
  kerfWidth: real("kerf_width").notNull(),
  strategy: text("strategy").notNull(),
  isApplied: integer("is_applied", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at").notNull(),
});

import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./db/schema.js";
import bcrypt from "bcryptjs";

const TURSO_URL = process.env.TURSO_URL!;
const TURSO_TOKEN = process.env.TURSO_TOKEN!;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("Missing TURSO_URL or TURSO_TOKEN environment variables");
  process.exit(1);
}

const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
const db = drizzle(client, { schema });

function generateId(): string {
  return crypto.randomUUID();
}

const now = Date.now();

// ─── Built-in Templates ──────────────────────────────────────────────────────

interface TemplateSeed {
  name: string;
  type: "window" | "door";
  category: string;
  variables: { name: string; label: string; defaultValue: number }[];
  pieces: {
    label: string;
    profileType: "frame" | "sash" | "mullion" | "bead" | "custom";
    lengthFormula: string;
    quantity: number;
  }[];
}

const builtinTemplates: TemplateSeed[] = [
  {
    name: "Fixed Window",
    type: "window",
    category: "Fixed",
    variables: [{ name: "frameDepth", label: "Frame Depth", defaultValue: 60 }],
    pieces: [
      { label: "Frame Top", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Bottom", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Left", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Frame Right", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Bead Top", profileType: "bead", lengthFormula: "W - 2*frameDepth", quantity: 1 },
      { label: "Bead Bottom", profileType: "bead", lengthFormula: "W - 2*frameDepth", quantity: 1 },
      { label: "Bead Left", profileType: "bead", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Bead Right", profileType: "bead", lengthFormula: "H - 2*frameDepth", quantity: 1 },
    ],
  },
  {
    name: "Single Casement Window",
    type: "window",
    category: "Casement",
    variables: [
      { name: "frameDepth", label: "Frame Depth", defaultValue: 60 },
      { name: "sashOverlap", label: "Sash Overlap", defaultValue: 8 },
    ],
    pieces: [
      { label: "Frame Top", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Bottom", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Left", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Frame Right", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Sash Top", profileType: "sash", lengthFormula: "W - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Bottom", profileType: "sash", lengthFormula: "W - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Left", profileType: "sash", lengthFormula: "H - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Right", profileType: "sash", lengthFormula: "H - 2*frameDepth - sashOverlap", quantity: 1 },
    ],
  },
  {
    name: "Sliding 2-Panel Window",
    type: "window",
    category: "Sliding",
    variables: [
      { name: "frameDepth", label: "Frame Depth", defaultValue: 60 },
      { name: "sashOverlap", label: "Sash Overlap", defaultValue: 12 },
      { name: "mullionDeduction", label: "Mullion Deduction", defaultValue: 30 },
    ],
    pieces: [
      { label: "Frame Top", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Bottom", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Left", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Frame Right", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Interlock Mullion", profileType: "mullion", lengthFormula: "H - 2*frameDepth - mullionDeduction", quantity: 1 },
      { label: "Sash Top (Active)", profileType: "sash", lengthFormula: "W/2 - frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Bottom (Active)", profileType: "sash", lengthFormula: "W/2 - frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Left (Active)", profileType: "sash", lengthFormula: "H - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Right (Active)", profileType: "sash", lengthFormula: "H - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Top (Fixed)", profileType: "sash", lengthFormula: "W/2 - frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Bottom (Fixed)", profileType: "sash", lengthFormula: "W/2 - frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Left (Fixed)", profileType: "sash", lengthFormula: "H - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Right (Fixed)", profileType: "sash", lengthFormula: "H - 2*frameDepth - sashOverlap", quantity: 1 },
    ],
  },
  {
    name: "Single Door",
    type: "door",
    category: "Casement",
    variables: [
      { name: "frameDepth", label: "Frame Depth", defaultValue: 60 },
      { name: "sashOverlap", label: "Sash Overlap", defaultValue: 8 },
    ],
    pieces: [
      { label: "Frame Top", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Bottom", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Left", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Frame Right", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Mid-Rail", profileType: "mullion", lengthFormula: "W - 2*frameDepth", quantity: 1 },
      { label: "Sash Top", profileType: "sash", lengthFormula: "W - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Bottom", profileType: "sash", lengthFormula: "W - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Left", profileType: "sash", lengthFormula: "H - 2*frameDepth - sashOverlap", quantity: 1 },
      { label: "Sash Right", profileType: "sash", lengthFormula: "H - 2*frameDepth - sashOverlap", quantity: 1 },
    ],
  },
  {
    name: "Stair Small Window",
    type: "window",
    category: "Fixed",
    variables: [{ name: "frameDepth", label: "Frame Depth", defaultValue: 45 }],
    pieces: [
      { label: "Frame Top", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Bottom", profileType: "frame", lengthFormula: "W", quantity: 1 },
      { label: "Frame Left", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
      { label: "Frame Right", profileType: "frame", lengthFormula: "H - 2*frameDepth", quantity: 1 },
    ],
  },
];

async function seed() {
  console.log("Seeding profile types...");

  const defaultProfileTypes = [
    { key: "frame", label: "Frame" },
    { key: "sash", label: "Sash" },
    { key: "mullion", label: "Mullion" },
    { key: "bead", label: "Bead" },
    { key: "custom", label: "Custom" },
  ];

  for (let i = 0; i < defaultProfileTypes.length; i++) {
    const pt = defaultProfileTypes[i];
    await db.insert(schema.profileTypes).values({
      id: generateId(),
      key: pt.key,
      label: pt.label,
      sortOrder: i,
      createdAt: now,
    });
    console.log(`  ✓ ${pt.label} (${pt.key})`);
  }

  console.log("\nSeeding built-in templates...");

  for (const tpl of builtinTemplates) {
    const templateId = generateId();

    await db.insert(schema.templates).values({
      id: templateId,
      name: tpl.name,
      type: tpl.type,
      category: tpl.category,
      isBuiltin: true,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < tpl.variables.length; i++) {
      const v = tpl.variables[i];
      await db.insert(schema.templateVariables).values({
        id: generateId(),
        templateId,
        name: v.name,
        label: v.label,
        defaultValue: v.defaultValue,
        sortOrder: i,
      });
    }

    for (let i = 0; i < tpl.pieces.length; i++) {
      const p = tpl.pieces[i];
      await db.insert(schema.templatePieces).values({
        id: generateId(),
        templateId,
        label: p.label,
        profileType: p.profileType,
        lengthFormula: p.lengthFormula,
        quantity: p.quantity,
        sortOrder: i,
      });
    }

    console.log(`  ✓ ${tpl.name} (${tpl.pieces.length} pieces, ${tpl.variables.length} variables)`);
  }

  console.log("\nSeeding default user...");
  const passwordHash = await bcrypt.hash("admin123", 10);
  await db.insert(schema.users).values({
    id: generateId(),
    email: "admin@edgecut.local",
    passwordHash,
    name: "Admin",
    createdAt: now,
  });
  console.log("  ✓ Default user created (email: admin@edgecut.local, password: admin123)");

  console.log("\nDone! Seeded 5 built-in templates and 1 default user.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

import { createClient } from "@libsql/client";

const client = createClient({
  url: "libsql://edgecut-ahosny.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE5NDY0MzAsImlkIjoiMDE5ZWU0NDgtNGYwMS03ZjgzLTgzZWQtZDI3MDU3YWIyMjgxIiwicmlkIjoiOGE5NTI4OTctZTBhZi00YmY2LTllNjctZjhiOTBiODJhOWJmIn0.zWJCqDEp0KF9eHpI8cdpc2y0tECQJlG7CnUhsjjAGRhEnsoYlWI2tY06G7c4vHtMNC9wY_gcWnnXHaHk73hsDA",
});

const MANAZIL_CONSTANTS = JSON.stringify([
  { name: "weldingAllowance", label: "Welding Allowance (mm/end)", defaultValue: 3 },
  { name: "frameDepth", label: "Frame Depth (mm)", defaultValue: 60 },
  { name: "sashDepth", label: "Sash Depth (mm)", defaultValue: 70 },
  { name: "sashOverlap", label: "Sash Overlap (mm)", defaultValue: 8 },
  { name: "mullionDepth", label: "Mullion Depth (mm)", defaultValue: 60 },
]);

const PREMIER_CONSTANTS = JSON.stringify([
  { name: "weldingAllowance", label: "Welding Allowance (mm/end)", defaultValue: 4 },
  { name: "frameDepth", label: "Frame Depth (mm)", defaultValue: 70 },
  { name: "sashDepth", label: "Sash Depth (mm)", defaultValue: 80 },
  { name: "sashOverlap", label: "Sash Overlap (mm)", defaultValue: 10 },
  { name: "mullionDepth", label: "Mullion Depth (mm)", defaultValue: 70 },
]);

async function main() {
  console.log("Creating profile_systems table...");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS profile_systems (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      key TEXT NOT NULL UNIQUE,
      constants TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
  console.log("✓ Table created");

  const now = Date.now();

  // Check if Manazil already exists
  const existing = await client.execute("SELECT id FROM profile_systems WHERE key = 'manazil'");
  if (existing.rows.length === 0) {
    await client.execute({
      sql: "INSERT INTO profile_systems (id, name, key, constants, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), "Manazil 60 Series", "manazil", MANAZIL_CONSTANTS, now, now],
    });
    console.log("✓ Seeded Manazil 60 Series");
  } else {
    console.log("  Manazil already exists, skipping");
  }

  // Check if Premier already exists
  const existingPremier = await client.execute("SELECT id FROM profile_systems WHERE key = 'premier'");
  if (existingPremier.rows.length === 0) {
    await client.execute({
      sql: "INSERT INTO profile_systems (id, name, key, constants, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [crypto.randomUUID(), "Premier 70 Series", "premier", PREMIER_CONSTANTS, now, now],
    });
    console.log("✓ Seeded Premier 70 Series");
  } else {
    console.log("  Premier already exists, skipping");
  }

  console.log("\nDone!");
  const all = await client.execute("SELECT id, name, key FROM profile_systems");
  console.log(`Profile systems in DB: ${all.rows.length}`);
  for (const row of all.rows) {
    console.log(`  - ${row.name} (${row.key})`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

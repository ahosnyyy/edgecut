import { createClient } from "@libsql/client";

const client = createClient({
  url: "libsql://edgecut-ahosny.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE5NDY0MzAsImlkIjoiMDE5ZWU0NDgtNGYwMS03ZjgzLTgzZWQtZDI3MDU3YWIyMjgxIiwicmlkIjoiOGE5NTI4OTctZTBhZi00YmY2LTllNjctZjhiOTBiODJhOWJmIn0.zWJCqDEp0KF9eHpI8cdpc2y0tECQJlG7CnUhsjjAGRhEnsoYlWI2tY06G7c4vHtMNC9wY_gcWnnXHaHk73hsDA",
});

async function main() {
  console.log("Adding profile_system column to stock table...");

  const cols = await client.execute("PRAGMA table_info(stock)");
  const hasColumn = cols.rows.some((r) => r.name === "profile_system");

  if (hasColumn) {
    console.log("  Column already exists, skipping");
  } else {
    await client.execute("ALTER TABLE stock ADD COLUMN profile_system TEXT");
    console.log("✓ Column added");
  }

  // Backfill existing stock entries from their source catalog entries
  console.log("Backfilling profile_system from stock_catalog...");
  const entries = await client.execute(
    "SELECT s.id, s.source_default_id, sc.profile_system FROM stock s LEFT JOIN stock_catalog sc ON sc.id = s.source_default_id WHERE s.profile_system IS NULL AND sc.profile_system IS NOT NULL"
  );
  let updated = 0;
  for (const row of entries.rows) {
    await client.execute({
      sql: "UPDATE stock SET profile_system = ? WHERE id = ?",
      args: [row.profile_system as string, row.id as string],
    });
    updated++;
  }
  console.log(`✓ Backfilled ${updated} entries`);

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

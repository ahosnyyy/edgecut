import { createClient } from "@libsql/client";

const client = createClient({
  url: "libsql://edgecut-ahosny.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE5NDY0MzAsImlkIjoiMDE5ZWU0NDgtNGYwMS03ZjgzLTgzZWQtZDI3MDU3YWIyMjgxIiwicmlkIjoiOGE5NTI4OTctZTBhZi00YmY2LTllNjctZjhiOTBiODJhOWJmIn0.zWJCqDEp0KF9eHpI8cdpc2y0tECQJlG7CnUhsjjAGRhEnsoYlWI2tY06G7c4vHtMNC9wY_gcWnnXHaHk73hsDA",
});

async function main() {
  console.log("Adding profile_system_id column to templates table...");

  // Check if column already exists
  const cols = await client.execute("PRAGMA table_info(templates)");
  const hasColumn = cols.rows.some((r) => r.name === "profile_system_id");

  if (hasColumn) {
    console.log("  Column already exists, skipping");
  } else {
    await client.execute("ALTER TABLE templates ADD COLUMN profile_system_id TEXT");
    console.log("✓ Column added");
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

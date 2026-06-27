import { createClient } from "@libsql/client";

const client = createClient({
  url: "libsql://edgecut-ahosny.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE5NDY0MzAsImlkIjoiMDE5ZWU0NDgtNGYwMS03ZjgzLTgzZWQtZDI3MDU3YWIyMjgxIiwicmlkIjoiOGE5NTI4OTctZTBhZi00YmY2LTllNjctZjhiOTBiODJhOWJmIn0.zWJCqDEp0KF9eHpI8cdpc2y0tECQJlG7CnUhsjjAGRhEnsoYlWI2tY06G7c4vHtMNC9wY_gcWnnXHaHk73hsDA",
});

interface DefaultPiece {
  label: string;
  profileType: string;
  lengthFormula: string;
  quantity: number;
}

const STANDARD_PIECES: DefaultPiece[] = [
  { label: "Frame Top", profileType: "frame", lengthFormula: "W - 2 * weldingAllowance", quantity: 1 },
  { label: "Frame Bottom", profileType: "frame", lengthFormula: "W - 2 * weldingAllowance", quantity: 1 },
  { label: "Frame Left", profileType: "frame", lengthFormula: "H - 2 * weldingAllowance", quantity: 1 },
  { label: "Frame Right", profileType: "frame", lengthFormula: "H - 2 * weldingAllowance", quantity: 1 },
  { label: "Sash Top", profileType: "sash", lengthFormula: "W - 2 * (weldingAllowance + sashOverlap)", quantity: 1 },
  { label: "Sash Bottom", profileType: "sash", lengthFormula: "W - 2 * (weldingAllowance + sashOverlap)", quantity: 1 },
  { label: "Sash Left", profileType: "sash", lengthFormula: "H - 2 * (weldingAllowance + sashOverlap)", quantity: 1 },
  { label: "Sash Right", profileType: "sash", lengthFormula: "H - 2 * (weldingAllowance + sashOverlap)", quantity: 1 },
  { label: "Mullion", profileType: "mullion", lengthFormula: "H - 2 * weldingAllowance - mullionDepth", quantity: 1 },
  { label: "Bead Top", profileType: "bead", lengthFormula: "W - 2 * (frameDepth + sashDepth)", quantity: 1 },
  { label: "Bead Bottom", profileType: "bead", lengthFormula: "W - 2 * (frameDepth + sashDepth)", quantity: 1 },
  { label: "Bead Left", profileType: "bead", lengthFormula: "H - 2 * (frameDepth + sashDepth)", quantity: 1 },
  { label: "Bead Right", profileType: "bead", lengthFormula: "H - 2 * (frameDepth + sashDepth)", quantity: 1 },
];

async function main() {
  console.log("Adding default_pieces column to profile_systems table...");

  const cols = await client.execute("PRAGMA table_info(profile_systems)");
  const hasColumn = cols.rows.some((r) => r.name === "default_pieces");

  if (hasColumn) {
    console.log("  Column already exists, skipping");
  } else {
    await client.execute("ALTER TABLE profile_systems ADD COLUMN default_pieces TEXT");
    console.log("✓ Column added");
  }

  // Seed default pieces for all existing systems
  console.log("Seeding default pieces for existing systems...");
  const systems = await client.execute("SELECT id, key, name FROM profile_systems WHERE default_pieces IS NULL");
  const defaultPiecesJson = JSON.stringify(STANDARD_PIECES);

  for (const sys of systems.rows) {
    await client.execute({
      sql: "UPDATE profile_systems SET default_pieces = ? WHERE id = ?",
      args: [defaultPiecesJson, sys.id as string],
    });
    console.log(`  ✓ Seeded ${sys.key} (${sys.name})`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});

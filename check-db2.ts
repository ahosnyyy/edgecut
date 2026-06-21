import { createClient } from "@libsql/client";

const c = createClient({
  url: "libsql://edgecut-ahosny.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE5NDY0MzAsImlkIjoiMDE5ZWU0NDgtNGYwMS03ZjgzLTgzZWQtZDI3MDU3YWIyMjgxIiwicmlkIjoiOGE5NTI4OTctZTBhZi00YmY2LTllNjctZjhiOTBiODJhOWJmIn0.zWJCqDEp0KF9eHpI8cdpc2y0tECQJlG7CnUhsjjAGRhEnsoYlWI2tY06G7c4vHtMNC9wY_gcWnnXHaHk73hsDA",
});

async function main() {
  // Test the exact subquery
  const r1 = await c.execute(
    "SELECT (SELECT COUNT(*) FROM buildings WHERE buildings.project_id = projects.id) as bc, (SELECT COUNT(*) FROM buildings WHERE buildings.project_id = projects.id AND buildings.status = 'completed') as cb FROM projects"
  );
  console.log("Counts:", JSON.stringify(r1.rows, null, 2));
}

main().catch(console.error);

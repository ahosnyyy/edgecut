import { createClient } from "@libsql/client";

const c = createClient({
  url: "libsql://edgecut-ahosny.aws-eu-west-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODE5NDY0MzAsImlkIjoiMDE5ZWU0NDgtNGYwMS03ZjgzLTgzZWQtZDI3MDU3YWIyMjgxIiwicmlkIjoiOGE5NTI4OTctZTBhZi00YmY2LTllNjctZjhiOTBiODJhOWJmIn0.zWJCqDEp0KF9eHpI8cdpc2y0tECQJlG7CnUhsjjAGRhEnsoYlWI2tY06G7c4vHtMNC9wY_gcWnnXHaHk73hsDA",
});

async function main() {
  const r = await c.execute("SELECT id, name, status FROM buildings LIMIT 10");
  console.log("Buildings:", JSON.stringify(r.rows, null, 2));

  const p = await c.execute("SELECT id, name, status FROM projects LIMIT 10");
  console.log("Projects:", JSON.stringify(p.rows, null, 2));
}

main().catch(console.error);

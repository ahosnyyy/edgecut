import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema.js";

export function getDb(env: { TURSO_URL: string; TURSO_TOKEN: string }) {
  const client = createClient({
    url: env.TURSO_URL,
    authToken: env.TURSO_TOKEN,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof getDb>;

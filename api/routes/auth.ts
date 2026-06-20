import { Hono } from "hono";
import { SignJWT } from "jose";
import { hash, compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import type { Env } from "../index.js";

const JWT_EXPIRY = "7d";
const JWT_SECRET = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);

export const authRoutes = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

// ─── POST /api/setup — First-run user creation (disabled after first user) ───

authRoutes.post("/setup", async (c) => {
  const db = getDb(c.env);

  // Check if any user already exists
  const existing = await db.select().from(users).limit(1);
  if (existing.length > 0) {
    return c.json({ error: "Setup already completed. Use /api/login instead." }, 400);
  }

  const body = await c.req.json<{
    email: string;
    password: string;
    name?: string;
  }>();

  if (!body.email || !body.password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  if (body.password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }

  const passwordHash = await hash(body.password, 10);
  const now = Date.now();
  const id = generateId();

  await db.insert(users).values({
    id,
    email: body.email,
    passwordHash,
    name: body.name ?? null,
    createdAt: now,
  });

  const token = await new SignJWT({ email: body.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET(c.env));

  return c.json({
    token,
    user: { id, email: body.email, name: body.name ?? null },
  });
});

// ─── POST /api/login — Verify credentials and issue JWT ──────────────────────

authRoutes.post("/login", async (c) => {
  const db = getDb(c.env);

  const body = await c.req.json<{ email: string; password: string }>();

  if (!body.email || !body.password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const found = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1);

  if (found.length === 0) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const user = found[0];
  const valid = await compare(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET(c.env));

  return c.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

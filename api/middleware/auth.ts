import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";
import type { Env } from "../index.js";

const JWT_SECRET = (env: Env) => new TextEncoder().encode(env.JWT_SECRET);

export interface AuthVariables {
  userId: string;
  email: string;
}

export const apiAuthMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AuthVariables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header" }, 401);
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET(c.env));
    c.set("userId", payload.sub as string);
    c.set("email", payload.email as string);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});

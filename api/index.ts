import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth.js";
import { templatesRoutes } from "./routes/templates.js";
import { apartmentTemplateRoutes } from "./routes/apartmentTemplates.js";
import { projectRoutes } from "./routes/projects.js";
import { stockCatalogRoutes } from "./routes/stockCatalog.js";
import { profileSystemRoutes } from "./routes/profileSystems.js";
import { apiAuthMiddleware } from "./middleware/auth.js";

export interface Env {
  TURSO_URL: string;
  TURSO_TOKEN: string;
  JWT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:4173"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

// Public routes (no JWT required)
app.route("/api", authRoutes);

// Protected routes (JWT required)
const protectedApi = new Hono<{ Bindings: Env }>();
protectedApi.use("*", apiAuthMiddleware);

// CRUD route groups
protectedApi.route("/templates", templatesRoutes);
protectedApi.route("/apartment-templates", apartmentTemplateRoutes);
protectedApi.route("/projects", projectRoutes);
protectedApi.route("/stock-catalog", stockCatalogRoutes);
protectedApi.route("/profile-systems", profileSystemRoutes);

app.route("/api", protectedApi);

export default app;

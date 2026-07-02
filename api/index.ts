import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authRoutes } from "./routes/auth.js";
import { templatesRoutes } from "./routes/templates.js";
import { apartmentTemplateRoutes } from "./routes/apartmentTemplates.js";
import { projectRoutes } from "./routes/projects.js";
import { stockCatalogRoutes } from "./routes/stockCatalog.js";
import { profileSystemRoutes } from "./routes/profileSystems.js";
import { profileTypeRoutes } from "./routes/profileTypes.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { cuttingPlanRoutes } from "./routes/cuttingPlans.js";
import { apiAuthMiddleware } from "./middleware/auth.js";

export interface Env {
  TURSO_URL: string;
  TURSO_TOKEN: string;
  JWT_SECRET: string;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin,
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
projectRoutes.route("/:id/cutting-plans", cuttingPlanRoutes);
protectedApi.route("/projects", projectRoutes);
protectedApi.route("/stock-catalog", stockCatalogRoutes);
protectedApi.route("/profile-systems", profileSystemRoutes);
protectedApi.route("/profile-types", profileTypeRoutes);
protectedApi.route("/dashboard", dashboardRoutes);

app.route("/api", protectedApi);

// SPA fallback: serve index.html for any non-API GET request
app.get("*", (c) => c.env.ASSETS.fetch(new Request(new URL("/", c.req.url))));

export default app;

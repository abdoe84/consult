// backend/src/app.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { ok } from "./utils/response.js";

// Routes (keep your existing imports)
import { authRoutes } from "./routes/auth.routes.js";
import { serviceRequestsRoutes } from "./routes/serviceRequests.routes.js";
import { offersRoutes } from "./routes/offers.routes.js";
import { contractsRoutes } from "./routes/contracts.routes.js";
import { projectsRoutes } from "./routes/projects.routes.js";
import { publicRoutes } from "./routes/public.routes.js";
import { adminUsersRoutes } from "./routes/adminUsers.routes.js";
import { usersDirectoryRoutes } from "./routes/usersDirectory.routes.js";
import { projectExecutionRoutes } from "./routes/projectExecution.routes.js";

const app = express();

// ✅ Disable ETag to avoid 304 for API JSON
app.disable("etag");

// Configure Helmet with CSP that allows CDN resources and inline scripts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.tailwindcss.com",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // For onclick, etc. in intake HTML
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com"
      ],
      fontSrc: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com"
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:"
      ],
      connectSrc: [
        "'self'",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com"
      ]
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

// ✅ Force no-store for all API routes
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
  next();
});

// Health
app.get("/api/health", (req, res) => ok(res, { status: "ok" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/service-requests", serviceRequestsRoutes);
app.use("/api/offers", offersRoutes);
app.use("/api/contracts", contractsRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/admin/users", adminUsersRoutes);
app.use("/api/users", usersDirectoryRoutes);
app.use("/api/project-execution", projectExecutionRoutes);

// Redirect root to intake page
app.get("/", (req, res) => res.redirect("/intake/"));

// Serve frontend static files (for production deployment – same origin as API)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.join(__dirname, "../../frontend/public");
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

export default app;

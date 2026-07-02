import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import planningsRouter from "./routes/plannings";
import { ipAllowlist } from "./middleware/ipAllowlist";

const app = express();
const PORT = process.env.PORT ?? 3001;

// Security headers
app.use(helmet());

// IP allowlist — must come before all routes.
// Set TRUSTED_PROXIES=<kong-ip> in production; empty = allow all (dev).
app.use(ipAllowlist);

// CORS — allow origins listed in ALLOWED_ORIGINS env var (comma-separated) or localhost defaults
const rawOrigins = process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173";
const allowedOrigins = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

// Rate limiting — 200 requests per minute per IP
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use(express.json({ limit: "2mb" }));

// Optional path prefix — set API_PREFIX=/7k-planner when Kong does NOT strip the path.
// Leave empty (default) when Kong strips the prefix before forwarding (strip_path=true).
const prefix = (process.env.API_PREFIX ?? "").replace(/\/+$/, ""); // strip trailing slash

app.use(`${prefix}/api/plannings`, planningsRouter);

app.get(`${prefix}/health`, (_req, res) => res.json({ status: "ok" }));

const server = app.listen(PORT, () => {
  console.log(`Guild Boss Planner API running on http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

export default app;

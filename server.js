// server.js — Main Express server for B4 Police Station API
require("dotenv").config();
const express      = require("express");
const cors         = require("cors");
const helmet       = require("helmet");
const rateLimit    = require("express-rate-limit");

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Security ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
  ].filter(Boolean),
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ───────────────────────────────────────────────────
app.use("/api/", rateLimit({
  windowMs: 15 * 60 * 1000, max: 300,
  message: { error: "Too many requests. Please try again in 15 minutes." }
}));
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { error: "Too many login attempts. Please wait 15 minutes." }
}));

// ── Routes ──────────────────────────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/cases",    require("./routes/cases"));
app.use("/api/accused",  require("./routes/accused"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/users",    require("./routes/users"));

// ── Health Check ────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status:    "ok",
    station:   process.env.STATION_NAME || "B4 Police Station",
    version:   "9.0",
    timestamp: new Date().toISOString(),
  });
});

// ── Root ─────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ message: "B4 Police Station API — Running ✅" });
});

// ── Error Handler ────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log("\n🚔  B4 Police Station — Backend API");
  console.log(`📡  Port:     ${PORT}`);
  console.log(`🌐  CORS:     ${process.env.FRONTEND_URL}`);
  console.log(`🏛️   Station:  ${process.env.STATION_NAME || "B4 Police Station"}`);
  console.log("✅  Server ready\n");
});

module.exports = app;

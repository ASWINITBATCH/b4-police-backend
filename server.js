require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const { pool } = require("./db/database");

const app = express();
const PORT = process.env.PORT || 3001;

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL, "http://localhost:5173"].filter(Boolean),
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization"],
}));
app.use(express.json({ limit: "10mb" }));
app.use("/api/", rateLimit({ windowMs: 15*60*1000, max: 300 }));
app.use("/api/auth/login", rateLimit({ windowMs: 15*60*1000, max: 20 }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/cases", require("./routes/cases"));
app.use("/api/accused", require("./routes/accused"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/users", require("./routes/users"));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", station: process.env.STATION_NAME || "B4 Police Station" });
});

app.get("/", (req, res) => {
  res.json({ message: "B4 Police Station API Running" });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: "Internal server error" });
});

async function initDB() {
  try {
    await pool.query("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username VARCHAR(50) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, name VARCHAR(100) NOT NULL, rank VARCHAR(50) NOT NULL, role VARCHAR(10) NOT NULL, active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query("CREATE TABLE IF NOT EXISTS cases (id SERIAL PRIMARY KEY, fir_no VARCHAR(50) UNIQUE NOT NULL, year INTEGER, fir_date DATE, section_of_law TEXT, category VARCHAR(100), subtype VARCHAR(100), io_name VARCHAR(100), accused_name TEXT, num_accused INTEGER DEFAULT 0, victim_name TEXT, rough_sketch VARCHAR(10), obs_mahazar VARCHAR(10), witness_smt VARCHAR(10), cd1_complete VARCHAR(10), arrest_made VARCHAR(10), num_arrests INTEGER DEFAULT 0, remand_report VARCHAR(20), absconding_accused VARCHAR(20), fir_sent_court DATE, wound_cert_received VARCHAR(10), wound_cert_no VARCHAR(50), viscera_sent_court VARCHAR(10), pmc_received VARCHAR(10), vehicle_sent_mv VARCHAR(10), mv_report_received VARCHAR(10), fsl_obtained VARCHAR(10), wc_due DATE, mv_due DATE, cs_due DATE, cs_filed_date DATE, current_stage VARCHAR(100), next_action VARCHAR(100), final_disposal VARCHAR(100), remarks TEXT, created_by INTEGER, updated_by INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query("CREATE TABLE IF NOT EXISTS accused (id SERIAL PRIMARY KEY, fir_no VARCHAR(50), accused_name VARCHAR(100) NOT NULL, age INTEGER, gender VARCHAR(20), address TEXT, alias VARCHAR(100), status VARCHAR(50), arrest_date DATE, arrested_by VARCHAR(100), remand_date DATE, court_name VARCHAR(100), bail_status VARCHAR(50), nbw_issued VARCHAR(10) DEFAULT 'No', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query("CREATE TABLE IF NOT EXISTS vehicles (id SERIAL PRIMARY KEY, fir_no VARCHAR(50), case_type VARCHAR(50), veh_type VARCHAR(50), make_model VARCHAR(100), reg_no VARCHAR(30), owner_name VARCHAR(100), owner_address TEXT, date_seized DATE, place_stored VARCHAR(100), court_prop_no VARCHAR(50), status VARCHAR(50) DEFAULT 'In Custody', disposal_stage VARCHAR(50) DEFAULT 'In Custody', disposal_date DATE, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    await pool.query("CREATE TABLE IF NOT EXISTS audit_log (id SERIAL PRIMARY KEY, user_id INTEGER, username VARCHAR(50), action VARCHAR(50), table_name VARCHAR(50), record_id INTEGER, details TEXT, ip VARCHAR(50), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
    const check = await pool.query("SELECT COUNT(*) FROM users");
    if (parseInt(check.rows[0].count) === 0) {
      const users = [
        ["sho_admin","sho123","Inspector K. Suresh","Inspector","SHO"],
        ["si_rajan","io123","SI Rajan","SI","IO"],
        ["asi_kumar","io123","ASI Kumar","ASI","IO"],
        ["hc_senthil","io123","HC Senthil","HC","IO"],
        ["si_meena","io123","SI Meena","SI","IO"],
        ["hc_balu","io123","HC Balu","HC","IO"],
        ["dsp_view","dsp123","DSP R. Krishnan","DSP","DSP"],
      ];
      for (const [un, pw, name, rank, role] of users) {
        const hash = await bcrypt.hash(pw, 12);
        await pool.query(
          "INSERT INTO users (username,password,name,rank,role) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
          [un, hash, name, rank, role]
        );
      }
      console.log("Default users created");
    }
    console.log("Database ready");
  } catch (err) {
    console.error("DB init error:", err.message);
  }
}

initDB();

app.listen(PORT, () => {
  console.log("B4 Police Station API running on port " + PORT);
});

module.exports = app;

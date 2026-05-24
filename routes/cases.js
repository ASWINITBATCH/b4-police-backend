// routes/cases.js — Full CRUD for Case Register
const express = require("express");
const { pool } = require("../db/database");
const { authenticate, notDSP, requireRole, logAction } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

// ── Helper: build filters ──────────────────────────────────────────
function buildFilters(q) {
  const conditions = [];
  const params = [];
  let i = 1;
  if (q.year && q.year !== "All") { conditions.push(`year = $${i++}`); params.push(+q.year); }
  if (q.category)  { conditions.push(`category = $${i++}`);  params.push(q.category); }
  if (q.io_name)   { conditions.push(`io_name = $${i++}`);   params.push(q.io_name); }
  if (q.status === "ui") conditions.push(`(cs_filed_date IS NULL)`);
  if (q.status === "cs") conditions.push(`cs_filed_date IS NOT NULL`);
  if (q.search) {
    conditions.push(`(fir_no ILIKE $${i} OR victim_name ILIKE $${i} OR accused_name ILIKE $${i} OR io_name ILIKE $${i} OR section_of_law ILIKE $${i})`);
    params.push(`%${q.search}%`); i++;
  }
  return { conditions, params };
}

// GET /api/cases
router.get("/", async (req, res) => {
  try {
    const { conditions, params } = buildFilters(req.query);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(
      `SELECT * FROM cases ${where} ORDER BY fir_date DESC NULLS LAST`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get cases error:", err);
    res.status(500).json({ error: "Failed to fetch cases" });
  }
});

// GET /api/cases/stats
router.get("/stats", async (req, res) => {
  try {
    const [total, cs, absconding, nbw, veh] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM cases"),
      pool.query("SELECT COUNT(*) FROM cases WHERE cs_filed_date IS NOT NULL"),
      pool.query("SELECT COUNT(*) FROM accused WHERE status = 'Absconding'"),
      pool.query("SELECT COUNT(*) FROM accused WHERE nbw_issued = 'Yes'"),
      pool.query("SELECT COUNT(*) FROM vehicles WHERE status = 'In Custody'"),
    ]);
    res.json({
      total:       +total.rows[0].count,
      cs_filed:    +cs.rows[0].count,
      ui:          +total.rows[0].count - +cs.rows[0].count,
      absconding:  +absconding.rows[0].count,
      nbw:         +nbw.rows[0].count,
      veh_custody: +veh.rows[0].count,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// GET /api/cases/:id
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM cases WHERE id = $1", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Case not found" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch case" });
  }
});

// POST /api/cases
router.post("/", notDSP, async (req, res) => {
  const b = req.body;
  if (!b.fir_no) return res.status(400).json({ error: "FIR number is required" });
  try {
    const dup = await pool.query("SELECT id FROM cases WHERE fir_no = $1", [b.fir_no]);
    if (dup.rows.length) return res.status(409).json({ error: `FIR ${b.fir_no} already exists` });

    const year = b.fir_date ? new Date(b.fir_date).getFullYear() : new Date().getFullYear();
    const result = await pool.query(`
      INSERT INTO cases (fir_no,year,fir_date,section_of_law,category,subtype,io_name,
        accused_name,num_accused,victim_name,rough_sketch,obs_mahazar,witness_smt,cd1_complete,
        arrest_made,num_arrests,remand_report,absconding_accused,fir_sent_court,
        wound_cert_received,wound_cert_no,viscera_sent_court,pmc_received,
        vehicle_sent_mv,mv_report_received,fsl_obtained,wc_due,mv_due,cs_due,cs_filed_date,
        current_stage,next_action,final_disposal,remarks,created_by,updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,
              $22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$35)
      RETURNING *`,
      [b.fir_no,year,b.fir_date||null,b.section_of_law,b.category,b.subtype,b.io_name,
       b.accused_name,b.num_accused||0,b.victim_name,b.rough_sketch,b.obs_mahazar,b.witness_smt,
       b.cd1_complete,b.arrest_made,b.num_arrests||0,b.remand_report,b.absconding_accused,
       b.fir_sent_court||null,b.wound_cert_received,b.wound_cert_no,b.viscera_sent_court,
       b.pmc_received,b.vehicle_sent_mv,b.mv_report_received,b.fsl_obtained,
       b.wc_due||null,b.mv_due||null,b.cs_due||null,b.cs_filed_date||null,
       b.current_stage,b.next_action,b.final_disposal,b.remarks,req.user.id]
    );
    await logAction(pool, req.user.id, req.user.username, "CREATE", "cases", result.rows[0].id, `FIR: ${b.fir_no}`, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create case error:", err);
    res.status(500).json({ error: "Failed to create case" });
  }
});

// PUT /api/cases/:id
router.put("/:id", notDSP, async (req, res) => {
  const b = req.body;
  try {
    const year = b.fir_date ? new Date(b.fir_date).getFullYear() : null;
    const result = await pool.query(`
      UPDATE cases SET
        fir_no=$1,year=$2,fir_date=$3,section_of_law=$4,category=$5,subtype=$6,io_name=$7,
        accused_name=$8,num_accused=$9,victim_name=$10,rough_sketch=$11,obs_mahazar=$12,
        witness_smt=$13,cd1_complete=$14,arrest_made=$15,num_arrests=$16,remand_report=$17,
        absconding_accused=$18,fir_sent_court=$19,wound_cert_received=$20,wound_cert_no=$21,
        viscera_sent_court=$22,pmc_received=$23,vehicle_sent_mv=$24,mv_report_received=$25,
        fsl_obtained=$26,wc_due=$27,mv_due=$28,cs_due=$29,cs_filed_date=$30,
        current_stage=$31,next_action=$32,final_disposal=$33,remarks=$34,
        updated_by=$35,updated_at=NOW()
      WHERE id=$36 RETURNING *`,
      [b.fir_no,year,b.fir_date||null,b.section_of_law,b.category,b.subtype,b.io_name,
       b.accused_name,b.num_accused||0,b.victim_name,b.rough_sketch,b.obs_mahazar,b.witness_smt,
       b.cd1_complete,b.arrest_made,b.num_arrests||0,b.remand_report,b.absconding_accused,
       b.fir_sent_court||null,b.wound_cert_received,b.wound_cert_no,b.viscera_sent_court,
       b.pmc_received,b.vehicle_sent_mv,b.mv_report_received,b.fsl_obtained,
       b.wc_due||null,b.mv_due||null,b.cs_due||null,b.cs_filed_date||null,
       b.current_stage,b.next_action,b.final_disposal,b.remarks,
       req.user.id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Case not found" });
    await logAction(pool, req.user.id, req.user.username, "UPDATE", "cases", req.params.id, `FIR: ${b.fir_no}`, req.ip);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Update case error:", err);
    res.status(500).json({ error: "Failed to update case" });
  }
});

// DELETE /api/cases/:id — SHO only
router.delete("/:id", requireRole("SHO"), async (req, res) => {
  try {
    const c = await pool.query("SELECT fir_no FROM cases WHERE id=$1", [req.params.id]);
    if (!c.rows.length) return res.status(404).json({ error: "Case not found" });
    await pool.query("DELETE FROM cases WHERE id=$1", [req.params.id]);
    await logAction(pool, req.user.id, req.user.username, "DELETE", "cases", req.params.id, `FIR: ${c.rows[0].fir_no}`, req.ip);
    res.json({ message: "Case deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete case" });
  }
});

module.exports = router;

// routes/accused.js
const express = require("express");
const { pool } = require("../db/database");
const { authenticate, notDSP, requireRole, logAction } = require("../middleware/auth");
const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const { fir_no, status, search } = req.query;
    const conditions = []; const params = []; let i = 1;
    if (fir_no)  { conditions.push(`fir_no = $${i++}`);  params.push(fir_no); }
    if (status)  { conditions.push(`status = $${i++}`);  params.push(status); }
    if (search) {
      conditions.push(`(accused_name ILIKE $${i} OR fir_no ILIKE $${i} OR alias ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM accused ${where} ORDER BY created_at DESC`, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch accused" }); }
});

router.post("/", notDSP, async (req, res) => {
  const b = req.body;
  if (!b.fir_no || !b.accused_name) return res.status(400).json({ error: "FIR No and Accused Name required" });
  try {
    const result = await pool.query(`
      INSERT INTO accused (fir_no,accused_name,age,gender,address,alias,status,
        arrest_date,arrested_by,remand_date,court_name,bail_status,nbw_issued,remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [b.fir_no,b.accused_name,b.age||null,b.gender,b.address,b.alias,b.status,
       b.arrest_date||null,b.arrested_by,b.remand_date||null,b.court_name,b.bail_status,b.nbw_issued||"No",b.remarks]
    );
    await logAction(pool, req.user.id, req.user.username, "CREATE", "accused", result.rows[0].id, `Accused: ${b.accused_name}`, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create accused error:", err);
    res.status(500).json({ error: "Failed to add accused" });
  }
});

router.put("/:id", notDSP, async (req, res) => {
  const b = req.body;
  try {
    const result = await pool.query(`
      UPDATE accused SET fir_no=$1,accused_name=$2,age=$3,gender=$4,address=$5,alias=$6,
        status=$7,arrest_date=$8,arrested_by=$9,remand_date=$10,court_name=$11,
        bail_status=$12,nbw_issued=$13,remarks=$14,updated_at=NOW()
      WHERE id=$15 RETURNING *`,
      [b.fir_no,b.accused_name,b.age||null,b.gender,b.address,b.alias,b.status,
       b.arrest_date||null,b.arrested_by,b.remand_date||null,b.court_name,b.bail_status,
       b.nbw_issued||"No",b.remarks,req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Accused not found" });
    await logAction(pool, req.user.id, req.user.username, "UPDATE", "accused", req.params.id, null, req.ip);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to update accused" }); }
});

router.delete("/:id", requireRole("SHO"), async (req, res) => {
  try {
    await pool.query("DELETE FROM accused WHERE id=$1", [req.params.id]);
    await logAction(pool, req.user.id, req.user.username, "DELETE", "accused", req.params.id, null, req.ip);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

module.exports = router;

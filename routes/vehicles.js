// routes/vehicles.js
const express = require("express");
const { pool } = require("../db/database");
const { authenticate, notDSP, requireRole, logAction } = require("../middleware/auth");
const router = express.Router();
router.use(authenticate);

router.get("/", async (req, res) => {
  try {
    const { status, search } = req.query;
    const conditions = []; const params = []; let i = 1;
    if (status) { conditions.push(`status = $${i++}`); params.push(status); }
    if (search) {
      conditions.push(`(fir_no ILIKE $${i} OR reg_no ILIKE $${i} OR owner_name ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const result = await pool.query(`SELECT * FROM vehicles ${where} ORDER BY date_seized DESC NULLS LAST`, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch vehicles" }); }
});

router.post("/", notDSP, async (req, res) => {
  const b = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO vehicles (fir_no,case_type,veh_type,make_model,reg_no,owner_name,
        owner_address,date_seized,place_stored,court_prop_no,status,disposal_stage,disposal_date,remarks)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [b.fir_no,b.case_type,b.veh_type,b.make_model,b.reg_no,b.owner_name,b.owner_address,
       b.date_seized||null,b.place_stored,b.court_prop_no,b.status||"In Custody",
       b.disposal_stage||"In Custody",b.disposal_date||null,b.remarks]
    );
    await logAction(pool, req.user.id, req.user.username, "CREATE", "vehicles", result.rows[0].id, `Reg: ${b.reg_no}`, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create vehicle error:", err);
    res.status(500).json({ error: "Failed to add vehicle" });
  }
});

router.put("/:id", notDSP, async (req, res) => {
  const b = req.body;
  try {
    const result = await pool.query(`
      UPDATE vehicles SET fir_no=$1,case_type=$2,veh_type=$3,make_model=$4,reg_no=$5,
        owner_name=$6,owner_address=$7,date_seized=$8,place_stored=$9,court_prop_no=$10,
        status=$11,disposal_stage=$12,disposal_date=$13,remarks=$14,updated_at=NOW()
      WHERE id=$15 RETURNING *`,
      [b.fir_no,b.case_type,b.veh_type,b.make_model,b.reg_no,b.owner_name,b.owner_address,
       b.date_seized||null,b.place_stored,b.court_prop_no,b.status,b.disposal_stage,
       b.disposal_date||null,b.remarks,req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Vehicle not found" });
    await logAction(pool, req.user.id, req.user.username, "UPDATE", "vehicles", req.params.id, null, req.ip);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to update vehicle" }); }
});

router.delete("/:id", requireRole("SHO"), async (req, res) => {
  try {
    await pool.query("DELETE FROM vehicles WHERE id=$1", [req.params.id]);
    await logAction(pool, req.user.id, req.user.username, "DELETE", "vehicles", req.params.id, null, req.ip);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: "Failed to delete" }); }
});

module.exports = router;

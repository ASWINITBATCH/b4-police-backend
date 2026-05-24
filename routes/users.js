// routes/users.js — User management (SHO only)
const express = require("express");
const bcrypt  = require("bcryptjs");
const { pool } = require("../db/database");
const { authenticate, requireRole, logAction } = require("../middleware/auth");
const router = express.Router();
router.use(authenticate, requireRole("SHO"));

// GET all users
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id,username,name,rank,role,active,created_at FROM users ORDER BY role,name"
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Failed to fetch users" }); }
});

// POST create user
router.post("/", async (req, res) => {
  const { username, password, name, rank, role } = req.body;
  if (!username || !password || !name || !rank || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (!["SHO","IO","DSP"].includes(role)) {
    return res.status(400).json({ error: "Invalid role" });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }
  try {
    const dup = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
    if (dup.rows.length) return res.status(409).json({ error: "Username already exists" });
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (username,password,name,rank,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,username,name,rank,role,active",
      [username, hash, name, rank, role]
    );
    await logAction(pool, req.user.id, req.user.username, "CREATE_USER", "users", result.rows[0].id, `Created: ${username}`, req.ip);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Create user error:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT update user details
router.put("/:id", async (req, res) => {
  const { name, rank, role } = req.body;
  try {
    const result = await pool.query(
      "UPDATE users SET name=$1,rank=$2,role=$3,updated_at=NOW() WHERE id=$4 RETURNING id,username,name,rank,role,active",
      [name, rank, role, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "User not found" });
    await logAction(pool, req.user.id, req.user.username, "UPDATE_USER", "users", req.params.id, null, req.ip);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to update user" }); }
});

// POST reset password
router.post("/:id/reset-password", async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: "Password must be at least 4 characters" });
  }
  try {
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query("UPDATE users SET password=$1,updated_at=NOW() WHERE id=$2", [hash, req.params.id]);
    await logAction(pool, req.user.id, req.user.username, "RESET_PASSWORD", "users", req.params.id, null, req.ip);
    res.json({ message: "Password reset successfully" });
  } catch (err) { res.status(500).json({ error: "Failed to reset password" }); }
});

// PATCH deactivate/reactivate user
router.patch("/:id/status", async (req, res) => {
  const { active } = req.body;
  if (+req.params.id === req.user.id) {
    return res.status(400).json({ error: "You cannot deactivate your own account" });
  }
  try {
    if (!active) {
      const shoCount = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role='SHO' AND active=true AND id != $1",
        [req.params.id]
      );
      if (+shoCount.rows[0].count === 0) {
        return res.status(400).json({ error: "Cannot deactivate — at least one SHO must remain active" });
      }
    }
    const result = await pool.query(
      "UPDATE users SET active=$1,updated_at=NOW() WHERE id=$2 RETURNING id,username,name,rank,role,active",
      [active, req.params.id]
    );
    await logAction(pool, req.user.id, req.user.username, active?"REACTIVATE":"DEACTIVATE", "users", req.params.id, null, req.ip);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Failed to update user status" }); }
});

// DELETE user permanently
router.delete("/:id", async (req, res) => {
  if (+req.params.id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  try {
    await pool.query("DELETE FROM users WHERE id=$1", [req.params.id]);
    await logAction(pool, req.user.id, req.user.username, "DELETE_USER", "users", req.params.id, null, req.ip);
    res.json({ message: "User deleted" });
  } catch (err) { res.status(500).json({ error: "Failed to delete user" }); }
});

module.exports = router;

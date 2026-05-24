// routes/auth.js — Login, logout, change password
const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { pool } = require("../db/database");
const { authenticate, logAction } = require("../middleware/auth");

const router = express.Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1", [username]
    );
    const user = result.rows[0];

    if (!user) {
      await logAction(pool, null, username, "LOGIN_FAILED", null, null, "User not found", req.ip);
      return res.status(401).json({ error: "Invalid username or password" });
    }
    if (!user.active) {
      return res.status(401).json({ error: "Account deactivated. Contact your SHO." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await logAction(pool, user.id, username, "LOGIN_FAILED", null, null, "Wrong password", req.ip);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role, rank: user.rank },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    await logAction(pool, user.id, username, "LOGIN", null, null, "Login successful", req.ip);

    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role, rank: user.rank }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// GET /api/auth/me — verify token
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post("/logout", authenticate, async (req, res) => {
  await logAction(pool, req.user.id, req.user.username, "LOGOUT", null, null, null, req.ip);
  res.json({ message: "Logged out successfully" });
});

// POST /api/auth/change-password
router.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Both current and new password required" });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: "New password must be at least 4 characters" });
  }
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    const user = result.rows[0];
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      "UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2",
      [hash, req.user.id]
    );
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

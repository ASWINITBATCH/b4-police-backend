// middleware/auth.js — JWT authentication & role guards
const jwt = require("jsonwebtoken");

// Verify JWT token
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided. Please login." });
  }
  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    if (e.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Session expired. Please login again." });
    }
    return res.status(401).json({ error: "Invalid token. Please login again." });
  }
}

// Only allow specific roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(" or ")}` });
    }
    next();
  };
}

// Block DSP from making changes (read-only)
function notDSP(req, res, next) {
  if (req.user.role === "DSP") {
    return res.status(403).json({ error: "DSP role is read-only. Contact SHO to make changes." });
  }
  next();
}

// Log all actions to audit_log
async function logAction(pool, userId, username, action, tableName, recordId, details, ip) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, username, action, table_name, record_id, details, ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, username, action, tableName, recordId, details, ip]
    );
  } catch (e) {
    console.error("Audit log error:", e.message);
  }
}

module.exports = { authenticate, requireRole, notDSP, logAction };

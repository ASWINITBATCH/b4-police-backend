// ═══════════════════════════════════════════════════════════════════
// src/api.js  —  Copy this file into your frontend src/ folder
// All API calls to the backend are centralized here
// ═══════════════════════════════════════════════════════════════════

// ⚠️ IMPORTANT: Replace this URL with your actual Render.com backend URL
// after deploying. e.g. "https://b4-police-backend.onrender.com"
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ── Token storage ──────────────────────────────────────────────────
const getToken  = () => localStorage.getItem("b4_token");
const setToken  = (t) => localStorage.setItem("b4_token", t);
const clearToken = () => localStorage.removeItem("b4_token");

// ── Core request function ──────────────────────────────────────────
async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Token expired or invalid — force logout
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────
export const api = {
  // Auth
  login: async (username, password) => {
    const data = await request("POST", "/auth/login", { username, password });
    if (data?.token) setToken(data.token);
    return data;
  },
  logout: async () => {
    await request("POST", "/auth/logout").catch(() => {});
    clearToken();
  },
  me: () => request("GET", "/auth/me"),
  changePassword: (currentPassword, newPassword) =>
    request("POST", "/auth/change-password", { currentPassword, newPassword }),

  // Cases
  getCases:   (params) => request("GET",    `/cases${params ? "?" + new URLSearchParams(params) : ""}`),
  getCase:    (id)     => request("GET",    `/cases/${id}`),
  createCase: (data)   => request("POST",   "/cases", data),
  updateCase: (id, d)  => request("PUT",    `/cases/${id}`, d),
  deleteCase: (id)     => request("DELETE", `/cases/${id}`),
  getCaseStats: ()     => request("GET",    "/cases/stats"),

  // Accused
  getAccused:    (params) => request("GET",    `/accused${params ? "?" + new URLSearchParams(params) : ""}`),
  createAccused: (data)   => request("POST",   "/accused", data),
  updateAccused: (id, d)  => request("PUT",    `/accused/${id}`, d),
  deleteAccused: (id)     => request("DELETE", `/accused/${id}`),

  // Vehicles
  getVehicles:    (params) => request("GET",    `/vehicles${params ? "?" + new URLSearchParams(params) : ""}`),
  createVehicle:  (data)   => request("POST",   "/vehicles", data),
  updateVehicle:  (id, d)  => request("PUT",    `/vehicles/${id}`, d),
  deleteVehicle:  (id)     => request("DELETE", `/vehicles/${id}`),

  // Users (SHO only)
  getUsers:         ()           => request("GET",    "/users"),
  createUser:       (data)       => request("POST",   "/users", data),
  updateUser:       (id, data)   => request("PUT",    `/users/${id}`, data),
  resetPassword:    (id, newPwd) => request("POST",   `/users/${id}/reset-password`, { newPassword: newPwd }),
  setUserStatus:    (id, active) => request("PATCH",  `/users/${id}/status`, { active }),
  deleteUser:       (id)         => request("DELETE", `/users/${id}`),

  // Health check
  health: () => request("GET", "/health"),
};

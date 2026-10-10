const crypto = require("crypto");

class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pageOpts = (q, def = 10, max = 100) => {
  const limit = Math.min(max, Math.max(1, parseInt(q.limit, 10) || def));
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  return { page, limit, skip: (page - 1) * limit };
};
const pagination = (p, total) => ({ page: p.page, limit: p.limit, total, pages: Math.ceil(total / p.limit) });
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("hex");
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const pick = (obj, keys) => keys.reduce((o, k) => (obj[k] !== undefined ? ((o[k] = obj[k]), o) : o), {});
const num = (v) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : undefined);
const round2 = (n) => Math.round(n * 100) / 100;
const same = (a, b) => a != null && b != null && String(a._id ?? a) === String(b._id ?? b);
const toPoint = (lat, lng) => (lat != null && lng != null ? { type: "Point", coordinates: [lng, lat] } : undefined);
const haversineKm = (a, b) => {
  if (!a || !b) return undefined;
  const R = 6371, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b[1] - a[1]), dLng = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
};
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

module.exports = {
  AppError, asyncHandler, escapeRegex, pageOpts, pagination, sha256, randomToken, safeEqual,
  pick, num, round2, same, toPoint, haversineKm, escHtml,
};

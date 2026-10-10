const rateLimit = require("express-rate-limit");

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { success: false, message } });

// NoSQL-injection guard: drop keys starting with "$" or containing "."
const clean = (o) => {
  if (Array.isArray(o)) return o.forEach(clean);
  if (o && typeof o === "object") {
    for (const k of Object.keys(o)) {
      if (k.startsWith("$") || k.includes(".")) delete o[k];
      else clean(o[k]);
    }
  }
};
const sanitize = (req, res, next) => { clean(req.body); clean(req.query); clean(req.params); next(); };

module.exports = {
  sanitize,
  globalLimiter: limiter(15 * 60 * 1000, 600, "Too many requests, please try again later."),
  authLimiter: limiter(15 * 60 * 1000, 20, "Too many attempts, please try again in a few minutes."),
  messageLimiter: limiter(60 * 1000, 30, "You are sending messages too quickly."),
  uploadLimiter: limiter(60 * 60 * 1000, 60, "Upload limit reached, try again later."),
};

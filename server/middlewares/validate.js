const { AppError } = require("../utils/helpers");

// Validates + strips unknown keys (prevents mass assignment such as {type:"admin"})
const validate = (schema, src = "body") => (req, res, next) => {
  const r = schema.safeParse(req[src] || {});
  if (!r.success) {
    return next(new AppError(r.error.issues.map((i) => `${i.path.join(".") || src}: ${i.message}`).join("; "), 400));
  }
  req[src] = r.data;
  next();
};
// multipart forms send "" for blank inputs
const dropEmpty = (req, res, next) => {
  for (const k of Object.keys(req.body || {})) if (req.body[k] === "") delete req.body[k];
  next();
};
module.exports = { validate, dropEmpty };

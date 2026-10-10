// Authenticated, authorised file access. There is NO public static /uploads folder any more.
const router = require("express").Router();
const env = require("../config/env");
const path = require("path");
const { Job, WorkerProfile } = require("../models");
const { AppError, asyncHandler, same } = require("../utils/helpers");
const { authenticate } = require("../middlewares/auth");

router.get("/:bucket/:name", authenticate, asyncHandler(async (req, res) => {
  const { bucket, name } = req.params, u = req.user;
  if (!["jobs", "avatars", "ids"].includes(bucket) || !/^[a-f0-9-]{36}\.(jpg|png|webp|pdf)$/.test(name)) throw new AppError("File not found", 404);
  let ok = bucket === "avatars" || u.type === "admin";
  if (!ok && bucket === "jobs") {
    const job = await Job.findOne({ $or: [{ "photos.filename": name }, { "afterPhotos.filename": name }] }).select("userId workerId status").lean();
    ok = !!job && (same(job.userId, u._id) || same(job.workerId, u._id) || (u.type === "worker" && !job.workerId && job.status === "pending"));
  }
  if (!ok && bucket === "ids") {
    const wp = await WorkerProfile.findOne({ "verification.filename": name }).select("userId").lean();
    ok = !!wp && same(wp.userId, u._id);
  }
  if (!ok) throw new AppError("File not found", 404);
  res.set({ "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" });
  res.sendFile(name, { root: path.join(env.uploadDir, bucket), dotfiles: "deny" }, (err) => {
    if (err && !res.headersSent) res.status(404).send({ success: false, message: "File not found" });
  });
}));
module.exports = router;

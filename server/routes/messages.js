// Per-job chat between the customer and the assigned worker (REST + polling via ?since=)
const router = require("express").Router();
const { Job, Message, Notification } = require("../models");
const { z } = require("../utils/schemas");
const { AppError, asyncHandler, same } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { messageLimiter } = require("../middlewares/security");
const { notify } = require("../utils/notify");
router.use(authenticate);

async function loadJob(req) {
  const job = await Job.findById(req.params.jobId).select("userId workerId status").lean();
  if (!job) throw new AppError("Job not found", 404);
  const isAdmin = req.user.type === "admin";
  if (!isAdmin && !same(job.userId, req.user._id) && !same(job.workerId, req.user._id)) throw new AppError("Job not found", 404);
  return { job, isAdmin };
}

router.get("/:jobId", asyncHandler(async (req, res) => {
  const { job, isAdmin } = await loadJob(req);
  const f = { jobId: job._id };
  if (req.query.since && !Number.isNaN(Date.parse(req.query.since))) f.createdAt = { $gt: new Date(req.query.since) };
  const messages = await Message.find(f).sort({ createdAt: 1 }).limit(200).lean();
  if (!isAdmin) await Message.updateMany({ jobId: job._id, receiverId: req.user._id, readAt: null }, { readAt: new Date() });
  res.send({ success: true, messages });
}));

router.post("/:jobId", messageLimiter, validate(z.object({ text: z.string().trim().min(1).max(2000) })), asyncHandler(async (req, res) => {
  const { job, isAdmin } = await loadJob(req);
  if (isAdmin) throw new AppError("Admins have read-only access", 403);
  if (!job.workerId) throw new AppError("Chat opens once a worker is assigned", 409);
  if (["cancelled"].includes(job.status)) throw new AppError("This job was cancelled", 409);
  const receiverId = same(job.userId, req.user._id) ? job.workerId : job.userId;
  const msg = await Message.create({ jobId: job._id, senderId: req.user._id, receiverId, text: req.body.text });
  // one unread "new message" notification per job (avoids spam)
  if (!(await Notification.exists({ userId: receiverId, jobId: job._id, type: "new_message", read: false }))) {
    notify(receiverId, { type: "new_message", params: { name: req.user.name }, jobId: job._id });
  }
  res.status(201).send({ success: true, message: msg });
}));

module.exports = router;

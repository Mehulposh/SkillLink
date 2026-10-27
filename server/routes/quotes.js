const router = require("express").Router();
const { Job, Quote, User, WorkerProfile } = require("../models");
const { z, objectId } = require("../utils/schemas");
const { AppError, asyncHandler, same } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, restrictTo, requireVerified } = require("../middlewares/auth");
const { assertWorkerFree } = require("../utils/schedule");
const { notify } = require("../utils/notify");
router.use(authenticate);

const quoteSchema = z.object({ jobId: objectId, amount: z.number().positive().max(1e7),
  message: z.string().trim().max(500).optional(), etaHours: z.number().positive().max(720).optional() });

// Worker sends (or revises) a quote on an open job
router.post("/", restrictTo("worker"), requireVerified, validate(quoteSchema), asyncHandler(async (req, res) => {
  const job = await Job.findById(req.body.jobId).select("userId workerId status scheduledAt").lean();
  if (!job || job.workerId || job.status !== "pending") throw new AppError("This job is not open for quotes", 409);
  await assertWorkerFree(req.user._id, job.scheduledAt);
  const { jobId, ...rest } = req.body;
  let quote = await Quote.findOne({ jobId, workerId: req.user._id });
  if (quote) {
    // Keep a timestamped snapshot of every previous offer before updating it.
    quote.negotiationHistory.push({
      amount: quote.amount,
      message: quote.message || "",
      etaHours: quote.etaHours,
      changedAt: quote.updatedAt || quote.createdAt || new Date(),
    });
    quote.amount = rest.amount;
    quote.message = rest.message || "";
    quote.etaHours = rest.etaHours;
    quote.status = "pending";
    await quote.save();
  } else {
    quote = await Quote.create({ jobId, workerId: req.user._id, ...rest, status: "pending" });
  }
  notify(job.userId, { type: "new_quote", params: { worker: req.user.name, amount: rest.amount }, jobId, email: true });
  res.status(201).send({ success: true, quote });
}));

router.get("/mine", restrictTo("worker"), asyncHandler(async (req, res) => {
  const quotes = await Quote.find({ workerId: req.user._id }).sort({ createdAt: -1 }).limit(100)
    .populate("jobId", "name city category status scheduledAt budget").lean();
  res.send({ success: true, quotes });
}));

// Customer compares quotes (with worker rating / verified badge)
router.get("/job/:jobId", restrictTo("user", "admin"), asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.jobId).select("userId").lean();
  if (!job || (req.user.type !== "admin" && !same(job.userId, req.user._id))) throw new AppError("Job not found", 404);
  const quotes = await Quote.find({ jobId: job._id, status: { $in: ["pending", "accepted"] } }).sort({ amount: 1 }).populate("workerId", "name profilePicture").lean();
  const profiles = await WorkerProfile.find({ userId: { $in: quotes.map((q) => q.workerId?._id) } }).select("userId ratingAvg ratingCount specialized experience verification.status").lean();
  const by = Object.fromEntries(profiles.map((p) => [String(p.userId), p]));
  res.send({ success: true, quotes: quotes.map(({ workerId: w, ...q }) => ({ ...q, worker: w && { _id: w._id, name: w.name, profilePicture: w.profilePicture,
    rating: by[String(w._id)]?.ratingAvg, ratingCount: by[String(w._id)]?.ratingCount, specialized: by[String(w._id)]?.specialized,
    experience: by[String(w._id)]?.experience, verified: by[String(w._id)]?.verification?.status === "approved" } })) });
}));

router.post("/:id/accept", restrictTo("user"), asyncHandler(async (req, res) => {
  const quote = await Quote.findById(req.params.id);
  if (!quote || quote.status !== "pending") throw new AppError("Quote not found", 404);
  const job = await Job.findById(quote.jobId).select("userId scheduledAt name").lean();
  if (!job || !same(job.userId, req.user._id)) throw new AppError("Quote not found", 404);
  const worker = await User.findOne({ _id: quote.workerId, type: "worker", isBlocked: false }).select("name");
  if (!worker) throw new AppError("This worker is no longer available", 409);
  await assertWorkerFree(worker._id, job.scheduledAt);
  const updated = await Job.findOneAndUpdate({ _id: job._id, workerId: null, status: "pending" },
    { $set: { workerId: worker._id, assigned: worker.name, status: "assigned", agreedPrice: quote.amount },
      $push: { timeline: { status: "assigned", by: req.user._id, note: `Quote of ₹${quote.amount} accepted` } } }, { new: true });
  if (!updated) throw new AppError("This job is no longer open", 409);
  quote.status = "accepted"; await quote.save();
  const others = await Quote.find({ jobId: job._id, _id: { $ne: quote._id }, status: "pending" }).select("workerId");
  await Quote.updateMany({ _id: { $in: others.map((o) => o._id) } }, { status: "rejected" });
  notify(worker._id, { type: "quote_accepted", params: { amount: quote.amount }, jobId: job._id, email: true, sms: true });
  others.forEach((o) => notify(o.workerId, { type: "quote_rejected", jobId: job._id }));
  res.send({ success: true, message: "Quote accepted. The worker has been assigned.", job: updated });
}));

router.post("/:id/reject", restrictTo("user"), asyncHandler(async (req, res) => {
  const quote = await Quote.findById(req.params.id);
  const job = quote && (await Job.findById(quote.jobId).select("userId").lean());
  if (!quote || !job || !same(job.userId, req.user._id) || quote.status !== "pending") throw new AppError("Quote not found", 404);
  quote.status = "rejected"; await quote.save();
  notify(quote.workerId, { type: "quote_rejected", jobId: quote.jobId });
  res.send({ success: true });
}));

router.delete("/:id", restrictTo("worker"), asyncHandler(async (req, res) => {
  const r = await Quote.updateOne({ _id: req.params.id, workerId: req.user._id, status: "pending" }, { status: "withdrawn" });
  if (!r.modifiedCount) throw new AppError("Quote not found", 404);
  res.send({ success: true });
}));

module.exports = router;

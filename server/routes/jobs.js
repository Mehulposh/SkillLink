const router = require("express").Router();
const { Job, User, WorkerProfile, Quote, Review, Payment, Category } = require("../models");
const { z, objectId, bool, phone, pincode, lat, lng, futureDate } = require("../utils/schemas");
const { STATUS, TRANSITIONS, WORKER_CAN_SET } = require("../utils/constants");
const { AppError, asyncHandler, escapeRegex, pageOpts, pagination, pick, num, same, toPoint, haversineKm } = require("../utils/helpers");
const { validate, dropEmpty } = require("../middlewares/validate");
const { authenticate, restrictTo, requireVerified } = require("../middlewares/auth");
const { uploadLimiter } = require("../middlewares/security");
const { uploaders, verifyFiles, filesOf, photoDoc, removeStored } = require("../middlewares/upload");
const { assertWorkerFree } = require("../utils/schedule");
const { notify, notifyMany } = require("../utils/notify");
const fs = require("fs");
const path = require("path");
const env = require("../config/env");

const fields = {
  name: z.string().trim().min(2).max(80), address: z.string().trim().min(3).max(200),
  city: z.string().trim().min(2).max(60), state: z.string().trim().min(2).max(60),
  pincode, phone, comment: z.string().trim().min(3).max(1000),
  category: z.string().trim().max(50), urgent: bool, scheduledAt: futureDate,
  budget: z.coerce.number().positive().max(1e7), lat, lng,
};
const createSchema = z.object({ ...fields, category: fields.category.optional(), urgent: bool.optional(), scheduledAt: futureDate.optional(),
  budget: fields.budget.optional(), lat: lat.optional(), lng: lng.optional(), workerId: objectId.optional() });
const editSchema = z.object({ address: fields.address, city: fields.city, state: fields.state, pincode, phone, comment: fields.comment,
  category: fields.category, urgent: bool, scheduledAt: futureDate, budget: fields.budget, lat, lng }).partial();

const assertCategory = async (name) => {
  if (name && !(await Category.exists({ name, active: true }))) throw new AppError("Unknown category", 400);
};
const loadJob = async (id) => { const j = await Job.findById(id); if (!j) throw new AppError("Job not found", 404); return j; };
const maskOpen = ({ phone, address, userId, timeline, ...rest }) => ({ ...rest, address: "", phone: "" }); // privacy until accepted
const listResponse = (res, items, p, total) =>
  res.send({ success: true, jobs: items, allProblems: items, pagination: pagination(p, total) }); // both keys for legacy UI

// ---------- create ----------
const create = asyncHandler(async (req, res) => {
  const b = req.body;
  const files = filesOf(req).filter((f) => ["photos", "file"].includes(f.fieldname));
  await assertCategory(b.category);
  let worker = null;
  if (b.workerId) {
    worker = await User.findOne({ _id: b.workerId, type: "worker", isBlocked: false }).select("name");
    if (!worker) throw new AppError("Worker not found", 404);
    await assertWorkerFree(worker._id, b.scheduledAt);
  }
  const photos = files.map(photoDoc);
  const job = new Job({
    ...pick(b, ["name", "address", "city", "state", "pincode", "phone", "comment", "category", "urgent", "scheduledAt", "budget"]),
    userId: req.user._id, location: toPoint(b.lat, b.lng), photos,
    file: photos[0] ? { name: photos[0].originalName, path: photos[0].url } : undefined,
    workerId: worker?._id, assigned: worker?.name || "", status: worker ? "assigned" : "pending",
    agreedPrice: worker ? b.budget : undefined,
  });
  job.timeline.push({ status: job.status, by: req.user._id, note: worker ? "Requested directly from a worker" : "Request created" });
  await job.save();

  if (worker) {
    notify(worker._id, { type: "job_requested", params: { name: job.name, city: job.city }, jobId: job._id, email: true, sms: job.urgent });
  } else if (job.urgent) {
    const q = { available: { $ne: false } };
    if (job.category) q.$or = [{ categories: job.category }, { specialized: new RegExp(escapeRegex(job.category), "i") }];
    const ps = await WorkerProfile.find({ ...q, city: new RegExp(`^${escapeRegex(job.city)}$`, "i") }).select("userId").limit(50).lean();
    notifyMany(ps.map((p) => p.userId), { type: "urgent_job", params: { city: job.city, category: job.category || "service" }, jobId: job._id, sms: true });
  }
  res.status(201).send({ success: true, message: "Problem sent successfully", job });
});

// ---------- lists ----------
const mine = asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 50, 100), f = { userId: req.user._id };
  if (STATUS.includes(req.query.status)) f.status = req.query.status;
  const [items, total] = await Promise.all([
    Job.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), Job.countDocuments(f)]);
  listResponse(res, items, p, total);
});

const workerJobs = asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 50, 100), f = { workerId: req.user._id };
  if (STATUS.includes(req.query.status)) f.status = req.query.status;
  const [items, total] = await Promise.all([
    Job.find(f).sort({ scheduledAt: 1, createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), Job.countDocuments(f)]);
  listResponse(res, items, p, total);
});

// Open jobs for workers: filters, search, urgency, budget, and "near me" (profile location or lat/lng)
const available = asyncHandler(async (req, res) => {
  const q = req.query, p = pageOpts(q, 20, 100);
  const f = { workerId: null, status: "pending" };
  for (const k of ["category", "state"]) if (q[k]) f[k] = new RegExp(`^${escapeRegex(q[k])}$`, "i");
  if (q.city) f.city = new RegExp(`^${escapeRegex(q.city)}$`, "i");
  if (q.pincode && /^\d{6}$/.test(q.pincode)) f.pincode = q.pincode;
  if (q.urgent === "true") f.urgent = true;
  if (num(q.minBudget) !== undefined || num(q.maxBudget) !== undefined) {
    f.budget = {};
    if (num(q.minBudget) !== undefined) f.budget.$gte = num(q.minBudget);
    if (num(q.maxBudget) !== undefined) f.budget.$lte = num(q.maxBudget);
  }
  if (q.q) { const rx = new RegExp(escapeRegex(String(q.q).slice(0, 60)), "i"); f.$or = [{ comment: rx }, { category: rx }, { name: rx }]; }

  let origin, radius = num(q.radiusKm) || 25;
  if (num(q.lat) !== undefined && num(q.lng) !== undefined) origin = [num(q.lng), num(q.lat)];
  else if (q.near === "me") {
    const wp = await WorkerProfile.findOne({ userId: req.user._id }).select("location serviceRadiusKm").lean();
    if (wp?.location?.coordinates?.length === 2) { origin = wp.location.coordinates; radius = num(q.radiusKm) || wp.serviceRadiusKm || 25; }
  }
  if (origin) f.location = { $geoWithin: { $centerSphere: [origin, radius / 6378.1] } };

  const sorts = { newest: { createdAt: -1 }, budget: { budget: -1, createdAt: -1 }, schedule: { scheduledAt: 1 }, urgent: { urgent: -1, createdAt: -1 } };
  const [items, total] = await Promise.all([
    Job.find(f).select("-timeline").sort(sorts[q.sort] || sorts.urgent).skip(p.skip).limit(p.limit).lean(),
    Job.countDocuments(f),
  ]);
  let out = items.map((j) => ({ ...maskOpen(j), distanceKm: origin ? haversineKm(origin, j.location?.coordinates) : undefined }));
  if (q.sort === "distance" && origin) out.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  listResponse(res, out, p, total);
});

// ---------- single job ----------
const getOne = asyncHandler(async (req, res) => {
  const j = await Job.findById(req.params.id).lean();
  if (!j) throw new AppError("Job not found", 404);
  const u = req.user, isAdmin = u.type === "admin", isOwner = same(j.userId, u._id), isWorker = same(j.workerId, u._id);
  const open = u.type === "worker" && !j.workerId && j.status === "pending";
  if (!isAdmin && !isOwner && !isWorker && !open) throw new AppError("Job not found", 404);
  if (open) return res.send({ success: true, job: maskOpen(j) });

  const out = { ...j };
  const [review, payment, pendingQuotes] = await Promise.all([
    Review.findOne({ jobId: j._id }).lean(),
    Payment.findOne({ jobId: j._id }).sort({ createdAt: -1 }).select("-razorpayOrderId").lean(),
    isOwner || isAdmin ? Quote.countDocuments({ jobId: j._id, status: "pending" }) : 0,
  ]);
  Object.assign(out, { review, payment, pendingQuotes });
  if ((isOwner || isAdmin) && j.workerId) {
    const [w, wp] = await Promise.all([
      User.findById(j.workerId).select("name phoneNumber profilePicture").lean(),
      WorkerProfile.findOne({ userId: j.workerId }).select("ratingAvg ratingCount phoneNumber specialized verification.status").lean(),
    ]);
    out.worker = w && { _id: w._id, name: w.name, profilePicture: w.profilePicture, phoneNumber: wp?.phoneNumber || w.phoneNumber,
      specialized: wp?.specialized, ratingAvg: wp?.ratingAvg, ratingCount: wp?.ratingCount, verified: wp?.verification?.status === "approved" };
  }
  res.send({ success: true, job: out });
});

// ---------- edit / photos / price / cancel ----------
const edit = asyncHandler(async (req, res) => {
  const job = await loadJob(req.params.id);
  if (!same(job.userId, req.user._id)) throw new AppError("Job not found", 404);
  if (job.status !== "pending") throw new AppError("Only open (pending) requests can be edited", 409);
  await assertCategory(req.body.category);
  const { lat: la, lng: ln, ...rest } = req.body;
  Object.assign(job, rest);
  if (la != null && ln != null) job.location = toPoint(la, ln);
  await job.save();
  res.send({ success: true, message: "Request updated", job });
});

const addPhotos = (key) => asyncHandler(async (req, res) => {
  const job = await loadJob(req.params.id);
  const owner = same(job.userId, req.user._id), worker = same(job.workerId, req.user._id);
  if (key === "photos" ? !owner : !worker) throw new AppError("Job not found", 404);
  if (["cancelled", "completed"].includes(job.status) && key === "photos") throw new AppError("Job is closed", 409);
  const files = filesOf(req);
  if (!files.length) throw new AppError("No photos uploaded", 400);
  if (job[key].length + files.length > 10) throw new AppError("Maximum 10 photos per group", 400);
  job[key].push(...files.map(photoDoc));
  await job.save();
  res.send({ success: true, [key]: job[key] });
});

const setPrice = asyncHandler(async (req, res) => {
  const job = await loadJob(req.params.id);
  if (!same(job.workerId, req.user._id)) throw new AppError("Job not found", 404);
  if (job.agreedPrice) throw new AppError("A price has already been agreed for this job", 409);
  if (!["in-progress", "completed"].includes(job.status) || job.paymentStatus === "paid") throw new AppError("Price can be set while the job is in progress or completed", 409);
  job.agreedPrice = req.body.amount;
  await job.save();
  notify(job.userId, { type: "price_set", params: { worker: req.user.name, amount: req.body.amount }, jobId: job._id });
  res.send({ success: true, agreedPrice: job.agreedPrice });
});

const cancel = asyncHandler(async (req, res) => {
  const job = await loadJob(req.params.id);
  const isAdmin = req.user.type === "admin";
  if (!isAdmin && !same(job.userId, req.user._id)) throw new AppError("Job not found", 404);
  if (!["pending", "assigned"].includes(job.status) && !isAdmin) throw new AppError("This job can no longer be cancelled", 409);
  if (!TRANSITIONS[job.status].includes("cancelled")) throw new AppError("This job can no longer be cancelled", 409);
  if (job.paymentStatus === "paid") throw new AppError("Paid jobs must go through a dispute/refund", 409);
  const worker = job.workerId;
  job.cancelReason = req.body.reason;
  job.pushStatus("cancelled", req.user._id, req.body.reason || "Cancelled");
  await job.save();
  await Quote.updateMany({ jobId: job._id, status: { $in: ["pending", "accepted"] } }, { status: "rejected" });
  if (worker && !same(worker, req.user._id)) notify(worker, { type: "job_cancelled", params: { name: job.name }, jobId: job._id, email: true });
  res.send({ success: true, message: "Request cancelled" });
});

// ---------- worker actions ----------
const accept = asyncHandler(async (req, res) => {
  const pre = await loadJob(req.params.id);
  if (pre.workerId || pre.status !== "pending") throw new AppError("Job is no longer available", 409);
  await assertWorkerFree(req.user._id, pre.scheduledAt);
  const set = { workerId: req.user._id, status: "assigned", assigned: req.user.name };
  if (pre.budget && !pre.agreedPrice) set.agreedPrice = pre.budget;
  // atomic compare-and-set: two workers can never accept the same job
  const job = await Job.findOneAndUpdate(
    { _id: pre._id, workerId: null, status: "pending" },
    { $set: set, $push: { timeline: { status: "assigned", by: req.user._id, note: "Accepted by worker" } } }, { new: true });
  if (!job) throw new AppError("Job was just taken by another worker", 409);
  await Quote.updateMany({ jobId: job._id, status: "pending" }, { status: "rejected" });
  notify(job.userId, { type: "job_accepted", params: { worker: req.user.name }, jobId: job._id, email: true, sms: job.urgent });
  res.send({ success: true, message: "Job accepted successfully" });
});

const changeStatus = asyncHandler(async (req, res) => {
  const job = await loadJob(req.params.id);
  const { status, note } = req.body, u = req.user;
  const isAdmin = u.type === "admin", isOwner = same(job.userId, u._id), isWorker = same(job.workerId, u._id);
  if (!isAdmin && !isOwner && !isWorker) throw new AppError("Job not found", 404);
  if (!isAdmin) {
    const allowed = isWorker ? WORKER_CAN_SET : isOwner ? ["cancelled"] : [];
    if (!allowed.includes(status)) throw new AppError(`You cannot set status "${status}"`, 403);
  }
  if (!TRANSITIONS[job.status].includes(status)) throw new AppError(`Cannot change status from "${job.status}" to "${status}"`, 409);
  if (status === "cancelled" && job.paymentStatus === "paid") throw new AppError("Paid jobs must go through a dispute/refund", 409);
  job.pushStatus(status, u._id, note);
  await job.save();
  if (status === "completed") await WorkerProfile.updateOne({ userId: job.workerId }, { $inc: { completedJobs: 1 } });
  const other = isWorker ? job.userId : job.workerId;
  if (other && !same(other, u._id)) notify(other, { type: "status_changed", params: { status }, jobId: job._id, email: status === "completed" });
  res.send({ success: true, message: "Problem status changed", status });
});

const unassign = asyncHandler(async (req, res) => {
  const job = await loadJob(req.params.id);
  if (!same(job.workerId, req.user._id)) throw new AppError("Not authorized to unassign this job", 403);
  if (job.status !== "assigned") throw new AppError("Only jobs that have not started can be given back", 409);
  job.workerId = null; job.assigned = ""; job.agreedPrice = job.budget || undefined;
  job.pushStatus("pending", req.user._id, "Worker gave the job back");
  await job.save();
  await Quote.updateMany({ jobId: job._id, workerId: req.user._id, status: "accepted" }, { status: "withdrawn" });
  notify(job.userId, { type: "job_unassigned", params: { worker: req.user.name }, jobId: job._id, email: true });
  res.send({ success: true, message: "Job unassigned successfully" });
});

const dashboard = asyncHandler(async (req, res) => {
  const w = req.user._id;
  const [counts, recentJobs] = await Promise.all([
    Job.aggregate([{ $match: { workerId: w } }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
    Job.find({ workerId: w }).sort({ createdAt: -1 }).limit(5).select("-timeline").lean(),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x._id, x.n]));
  res.send({ success: true, recentJobs, stats: {
    totalJobs: counts.reduce((a, x) => a + x.n, 0), acceptedJobs: c.assigned || 0, inProgressJobs: c["in-progress"] || 0, completedJobs: c.completed || 0 } });
});

// legacy download endpoint; new clients can use the url in job.photos[].url
const download = asyncHandler(async (req, res) => {
  const job = await Job.findById(req.query.problemId).lean();
  const u = req.user;
  if (!job || !(u.type === "admin" || same(job.userId, u._id) || same(job.workerId, u._id) || (u.type === "worker" && !job.workerId))) throw new AppError("File not found", 404);
  const photo = job.photos?.[0];
  if (!photo) throw new AppError("This job has no attachment", 404);
  const full = path.join(env.uploadDir, "jobs", path.basename(photo.filename));
  if (!fs.existsSync(full)) throw new AppError("File not found", 404);
  res.download(full, photo.originalName || photo.filename);
});

// ---------- routes ----------
router.use(authenticate);
router.post("/", restrictTo("user"), requireVerified, uploadLimiter, uploaders.jobPhotos, verifyFiles, dropEmpty, validate(createSchema), create);
router.get("/mine", restrictTo("user"), mine);
router.get("/worker", restrictTo("worker"), workerJobs);
router.get("/available", restrictTo("worker"), available);
router.get("/worker/dashboard", restrictTo("worker"), dashboard);
router.get("/:id", getOne);
router.patch("/:id", restrictTo("user"), validate(editSchema), edit);
router.post("/:id/photos", restrictTo("user"), uploadLimiter, uploaders.morePhotos, verifyFiles, addPhotos("photos"));
router.post("/:id/after-photos", restrictTo("worker"), uploadLimiter, uploaders.morePhotos, verifyFiles, addPhotos("afterPhotos"));
router.post("/:id/price", restrictTo("worker"), validate(z.object({ amount: z.number().positive().max(1e7) })), setPrice);
router.post("/:id/cancel", restrictTo("user", "admin"), validate(z.object({ reason: z.string().trim().max(300).optional() })), cancel);
router.post("/:id/accept", restrictTo("worker"), requireVerified, accept);
router.post("/:id/status", validate(z.object({ status: z.enum(STATUS), note: z.string().trim().max(300).optional() })), changeStatus);
router.post("/:id/unassign", restrictTo("worker"), unassign);

module.exports = router;
module.exports.handlers = { create, createSchema, mine, workerJobs, available, accept, changeStatus, unassign, dashboard, download, changeStatusSchema: z.object({ status: z.enum(STATUS), note: z.string().trim().max(300).optional() }) };

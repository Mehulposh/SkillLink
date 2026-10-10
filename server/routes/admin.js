const router = require("express").Router();
const bcrypt = require("bcryptjs");
const env = require("../config/env");
const { User, Job, WorkerProfile, Payment, Dispute, Promo, Category, Review } = require("../models");
const { z, objectId, bool } = require("../utils/schemas");
const { AppError, asyncHandler, escapeRegex, pageOpts, pagination, safeEqual, same } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, restrictTo } = require("../middlewares/auth");
const { authLimiter } = require("../middlewares/security");
const { removeByName } = require("../middlewares/upload");
const { assertWorkerFree } = require("../utils/schedule");
const { notify, notifyMany } = require("../utils/notify");
const A = require("./auth").handlers;
const { refundPayment } = require("./payments");
const { STATUS } = require("../utils/constants");

// ---------- public admin auth ----------
// Admin accounts can only be created with the server-side ADMIN_REGISTRATION_KEY (or `npm run create-admin`).
router.post("/register", authLimiter,
  (req, res, next) => (env.adminKey && safeEqual(req.get("x-admin-key") || "", env.adminKey) ? next() : next(new AppError("Admin registration is disabled or the key is invalid", 403))),
  validate(A.registerSchema.omit({ type: true, referralCode: true })),
  asyncHandler(async (req, res) => {
    if (await User.exists({ email: req.body.email })) throw new AppError("Admin already exists", 400);
    const admin = await User.create({ name: req.body.name, email: req.body.email, type: "admin", emailVerified: true, password: await bcrypt.hash(req.body.password, 12) });
    res.status(201).send({ success: true, message: "Admin registered successfully", admin: { _id: admin._id, name: admin.name, email: admin.email, type: admin.type } });
  }));
router.post("/login", authLimiter, validate(A.loginSchema), A.adminLogin);

router.use(authenticate, restrictTo("admin"));
router.get("/current", (req, res) => res.send({ success: true, admin: req.user.toJSON() }));

// ---------- users ----------
const listUsers = asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 100, 500), f = {}, q = req.query;
  if (["user", "worker", "admin"].includes(q.type)) f.type = q.type;
  if (q.blocked === "true") f.isBlocked = true;
  if (q.request === "yes") f.request = "yes";
  if (q.q) { const rx = new RegExp(escapeRegex(String(q.q).slice(0, 60)), "i"); f.$or = [{ name: rx }, { email: rx }]; }
  const [users, total] = await Promise.all([User.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), User.countDocuments(f)]);
  const profiles = await WorkerProfile.find({ userId: { $in: users.filter((u) => u.type === "worker").map((u) => u._id) } }).lean();
  const by = Object.fromEntries(profiles.map((x) => [String(x.userId), x]));
  res.send({ success: true, users: users.map((u) => (by[String(u._id)] ? { ...u, work_description: by[String(u._id)] } : u)), pagination: pagination(p, total) });
});
router.get("/getallusers", listUsers);
router.get("/users", listUsers);

router.post("/changetype/:userId", asyncHandler(async (req, res) => { // approve "become a worker" request
  const user = await User.findById(req.params.userId);
  if (!user) throw new AppError("User not found!", 404);
  if (user.type === "admin") throw new AppError("Cannot change an admin", 400);
  user.type = "worker"; user.request = "no";
  await user.save();
  const wd = user.work_description;
  if (wd) await WorkerProfile.findOneAndUpdate({ userId: user._id }, { $set: { specialized: String(wd.specialized || "").slice(0, 80), experience: Math.min(60, Number(wd.experience) || 0), address: wd.address || "", phoneNumber: wd.phoneNumber || "" } }, { upsert: true, setDefaultsOnInsert: true });
  notify(user._id, { type: "worker_approved", email: true });
  res.send({ success: true, message: "type change successfully" });
}));
router.post("/users/:id/reject-request", asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.params.id, type: "user" }, { request: "no" });
  res.send({ success: true });
}));
router.post("/users/:id/block", validate(z.object({ blocked: z.boolean(), reason: z.string().trim().max(300).optional() })), asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) throw new AppError("User not found", 404);
  if (u.type === "admin" || same(u._id, req.user._id)) throw new AppError("Admins cannot be blocked here", 400);
  u.isBlocked = req.body.blocked; u.blockedReason = req.body.blocked ? req.body.reason : undefined;
  await u.save();
  res.send({ success: true, message: req.body.blocked ? "User blocked" : "User unblocked" });
}));

// ---------- jobs ----------
router.get("/getallworks", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 200, 500);
  const [allworks, allworkers] = await Promise.all([
    Job.find().sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(),
    User.find({ type: "worker" }).select("name email phoneNumber isBlocked").lean()]);
  res.send({ success: true, allworks, allworkers });
}));
router.get("/jobs", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 25, 200), q = req.query, f = {};
  if (STATUS.includes(q.status)) f.status = q.status;
  if (q.category) f.category = q.category;
  if (q.city) f.city = new RegExp(`^${escapeRegex(q.city)}$`, "i");
  if (q.q) { const rx = new RegExp(escapeRegex(String(q.q).slice(0, 60)), "i"); f.$or = [{ name: rx }, { comment: rx }]; }
  const [jobs, total] = await Promise.all([Job.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), Job.countDocuments(f)]);
  res.send({ success: true, jobs, pagination: pagination(p, total) });
}));
router.post("/selectworker/:id", validate(z.object({ workerID: objectId }).or(z.object({ workerId: objectId })).transform((b) => ({ workerID: b.workerID || b.workerId }))), asyncHandler(async (req, res) => {
  const job = await Job.findById(req.params.id);
  if (!job) throw new AppError("Problem not found", 404);
  if (!["pending", "assigned"].includes(job.status)) throw new AppError("This job can no longer be (re)assigned", 409);
  const worker = await User.findOne({ _id: req.body.workerID, type: "worker", isBlocked: false });
  if (!worker) throw new AppError("Worker not found", 404);
  await assertWorkerFree(worker._id, job.scheduledAt, job._id);
  const prev = job.workerId;
  job.workerId = worker._id; job.assigned = worker.name;
  job.pushStatus("assigned", req.user._id, "Assigned by admin");
  await job.save();
  notify(worker._id, { type: "job_assigned", params: { name: job.name }, jobId: job._id, email: true, sms: job.urgent });
  notify(job.userId, { type: "job_accepted", params: { worker: worker.name }, jobId: job._id, email: true });
  if (prev && !same(prev, worker._id)) notify(prev, { type: "job_cancelled", params: { name: job.name }, jobId: job._id });
  res.send({ success: true, message: `Problem ${job._id} has been assigned to ${worker.name}.` });
}));

// ---------- worker verification ----------
router.get("/verifications", asyncHandler(async (req, res) => {
  const f = { "verification.status": ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "pending" };
  const items = await WorkerProfile.find(f).sort({ "verification.submittedAt": 1 }).limit(200).populate("userId", "name email").lean();
  res.send({ success: true, verifications: items.map((w) => ({ userId: w.userId?._id, name: w.userId?.name, email: w.userId?.email, specialized: w.specialized,
    docType: w.verification.docType, submittedAt: w.verification.submittedAt, status: w.verification.status, documentUrl: w.verification.filename ? `/api/files/ids/${w.verification.filename}` : null })) });
}));
router.post("/verifications/:userId", validate(z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().trim().max(300).optional() })), asyncHandler(async (req, res) => {
  const wp = await WorkerProfile.findOne({ userId: req.params.userId });
  if (!wp || wp.verification.status !== "pending") throw new AppError("No pending verification for this worker", 404);
  const file = wp.verification.filename;
  Object.assign(wp.verification, { status: req.body.decision, note: req.body.note, reviewedAt: new Date(), reviewedBy: req.user._id, filename: undefined, originalName: undefined });
  await wp.save();
  removeByName("ids", file); // data minimisation: ID image is deleted once reviewed
  notify(wp.userId, { type: `verification_${req.body.decision}`, params: { note: req.body.note || "see your profile" }, email: true });
  res.send({ success: true, message: `Verification ${req.body.decision}` });
}));

// ---------- disputes / payments ----------
router.get("/disputes", asyncHandler(async (req, res) => {
  const f = ["open", "resolved", "rejected"].includes(req.query.status) ? { status: req.query.status } : {};
  res.send({ success: true, disputes: await Dispute.find(f).sort({ createdAt: -1 }).limit(200).populate("raisedBy against", "name email").lean() });
}));
router.post("/disputes/:id/resolve", validate(z.object({ decision: z.enum(["resolved", "rejected"]), outcome: z.enum(["completed", "cancelled", "refund"]), note: z.string().trim().max(500).optional() })), asyncHandler(async (req, res) => {
  const d = await Dispute.findById(req.params.id);
  if (!d || d.status !== "open") throw new AppError("Open dispute not found", 404);
  const job = await Job.findById(d.jobId);
  const { decision, outcome, note } = req.body;
  if (outcome === "refund") {
    const pay = await Payment.findOne({ jobId: job._id, status: "paid" });
    if (!pay) throw new AppError("There is no paid payment to refund", 409);
    await refundPayment(pay);
  }
  const next = decision === "rejected" ? d.previousStatus || "completed" : outcome === "completed" ? "completed" : "cancelled";
  if (next === "completed" && d.previousStatus !== "completed" && job.workerId) await WorkerProfile.updateOne({ userId: job.workerId }, { $inc: { completedJobs: 1 } });
  job.pushStatus(next, req.user._id, `Dispute ${decision}: ${note || outcome}`);
  await job.save();
  Object.assign(d, { status: decision, outcome, adminNote: note, resolvedBy: req.user._id, resolvedAt: new Date() });
  await d.save();
  notifyMany([d.raisedBy, d.against], { type: "dispute_resolved", params: { outcome, note: note || "" }, jobId: job._id, email: true });
  res.send({ success: true, dispute: d });
}));
router.get("/payments", asyncHandler(async (req, res) => {
  const p = pageOpts(req.query, 25, 200), f = ["created", "paid", "failed", "refunded"].includes(req.query.status) ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([Payment.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).lean(), Payment.countDocuments(f)]);
  res.send({ success: true, payments: items, pagination: pagination(p, total) });
}));
router.post("/payments/:id/refund", asyncHandler(async (req, res) => {
  const pay = await Payment.findById(req.params.id);
  if (!pay) throw new AppError("Payment not found", 404);
  res.send({ success: true, payment: await refundPayment(pay) });
}));

// ---------- promos / categories ----------
const promoSchema = z.object({ code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/), type: z.enum(["percent", "flat"]), value: z.number().positive(),
  maxDiscount: z.number().positive().optional(), minAmount: z.number().positive().optional(), maxUses: z.number().int().min(0).optional(), expiresAt: z.coerce.date().optional(), restrictedTo: objectId.optional() })
  .refine((p) => p.type !== "percent" || p.value <= 100, "percent value must be ≤ 100");
router.post("/promos", validate(promoSchema), asyncHandler(async (req, res) => res.status(201).send({ success: true, promo: await Promo.create(req.body) })));
router.get("/promos", asyncHandler(async (req, res) => res.send({ success: true, promos: await Promo.find().sort({ createdAt: -1 }).select("-usedBy").limit(200).lean() })));
router.patch("/promos/:id", validate(z.object({ active: z.boolean().optional(), expiresAt: z.coerce.date().optional(), maxUses: z.number().int().min(0).optional() })), asyncHandler(async (req, res) => {
  const promo = await Promo.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!promo) throw new AppError("Promo not found", 404);
  res.send({ success: true, promo });
}));
router.post("/categories", validate(z.object({ name: z.string().trim().min(2).max(50) })), asyncHandler(async (req, res) => res.status(201).send({ success: true, category: await Category.create(req.body) })));
router.patch("/categories/:id", validate(z.object({ name: z.string().trim().min(2).max(50).optional(), active: z.boolean().optional() })), asyncHandler(async (req, res) => {
  const c = await Category.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
  if (!c) throw new AppError("Category not found", 404);
  res.send({ success: true, category: c });
}));

// ---------- reports ----------
router.get("/reports/overview", asyncHandler(async (req, res) => {
  const months = Math.min(36, Math.max(1, parseInt(req.query.months, 10) || 12));
  const from = new Date(); from.setMonth(from.getMonth() - (months - 1), 1); from.setHours(0, 0, 0, 0);
  const ym = (f) => ({ y: { $year: f }, m: { $month: f } });
  const label = (r) => ({ month: `${r._id.y}-${String(r._id.m).padStart(2, "0")}` });
  const [byStatus, byCategory, jobsByMonth, workersBySpec, usersByRole, revenue, topWorkers, openDisputes, pendingVerifications, ratings] = await Promise.all([
    Job.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Job.aggregate([{ $group: { _id: { $ifNull: ["$category", "Uncategorised"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Job.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: ym("$createdAt"), total: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } } } }, { $sort: { "_id.y": 1, "_id.m": 1 } }]),
    WorkerProfile.aggregate([{ $group: { _id: { $cond: [{ $in: ["$specialized", ["", null]] }, "Not specified", "$specialized"] }, count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    User.aggregate([{ $group: { _id: "$type", count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: "paid", paidAt: { $gte: from } } }, { $group: { _id: ym("$paidAt"), gross: { $sum: "$amount" }, platformFees: { $sum: "$platformFee" }, payments: { $sum: 1 } } }, { $sort: { "_id.y": 1, "_id.m": 1 } }]),
    WorkerProfile.find({ completedJobs: { $gt: 0 } }).sort({ completedJobs: -1, ratingAvg: -1 }).limit(10).populate("userId", "name").select("userId completedJobs ratingAvg ratingCount").lean(),
    Dispute.countDocuments({ status: "open" }), WorkerProfile.countDocuments({ "verification.status": "pending" }),
    Review.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]),
  ]);
  const status = Object.fromEntries(byStatus.map((s) => [s._id, s.count])), total = byStatus.reduce((a, s) => a + s.count, 0);
  res.send({ success: true, range: { from, months },
    totals: { jobs: total, completionRate: total ? Math.round(((status.completed || 0) / total) * 1000) / 10 : 0, openDisputes, pendingVerifications,
      grossRevenue: revenue.reduce((a, r) => a + r.gross, 0), platformRevenue: revenue.reduce((a, r) => a + r.platformFees, 0),
      avgRating: ratings[0] ? Math.round(ratings[0].avg * 10) / 10 : 0, reviews: ratings[0]?.n || 0 },
    jobsByStatus: status, jobsByCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
    jobsByMonth: jobsByMonth.map((r) => ({ ...label(r), total: r.total, completed: r.completed })),
    revenueByMonth: revenue.map((r) => ({ ...label(r), gross: r.gross, platformFees: r.platformFees, payments: r.payments })),
    workersBySpecialization: Object.fromEntries(workersBySpec.map((w) => [w._id, w.count])),
    usersByRole: Object.fromEntries(usersByRole.map((u) => [u._id, u.count])),
    topWorkers: topWorkers.map((w) => ({ workerId: w.userId?._id, name: w.userId?.name, completedJobs: w.completedJobs, rating: w.ratingAvg, ratingCount: w.ratingCount })) });
}));

module.exports = router;

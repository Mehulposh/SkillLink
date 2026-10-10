const router = require("express").Router();
const { User, WorkerProfile, Review, Job, Payment } = require("../models");
const { z, objectId, bool, phone, pincode, lat, lng, HHMM } = require("../utils/schemas");
const { ID_DOC_TYPES } = require("../utils/constants");
const { AppError, asyncHandler, escapeRegex, pageOpts, pagination, num, toPoint, haversineKm } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, restrictTo } = require("../middlewares/auth");
const { uploadLimiter } = require("../middlewares/security");
const { uploaders, verifyFiles, removeByName } = require("../middlewares/upload");
const { notifyAdmins } = require("../utils/notify");

const slot = z.object({ day: z.number().int().min(0).max(6), start: HHMM, end: HHMM }).refine((s) => s.start < s.end, "start must be before end");
const profileSchema = z.object({
  specialized: z.string().trim().max(80), experience: z.coerce.number().min(0).max(60),
  address: z.string().trim().max(200), phoneNumber: phone,
  city: z.string().trim().max(60), state: z.string().trim().max(60), pincode,
  bio: z.string().trim().max(500), categories: z.array(z.string().trim().max(50)).max(10),
  available: bool, serviceRadiusKm: z.coerce.number().min(1).max(200),
  availability: z.array(slot).max(21), lat, lng,
}).partial();
// the old frontend sends { work_description: {...} }
const unwrap = (req, res, next) => { if (req.body?.work_description) req.body = { ...req.body.work_description }; next(); };

const publicProfile = (wp, origin) => {
  const u = wp.userId && wp.userId._id ? wp.userId : {};
  return {
    _id: u._id || wp.userId, name: u.name, profilePicture: u.profilePicture,
    rating: wp.ratingAvg, ratingCount: wp.ratingCount, completedJobs: wp.completedJobs,
    verified: wp.verification?.status === "approved", available: wp.available,
    specialized: wp.specialized, categories: wp.categories, bio: wp.bio, experience: wp.experience,
    city: wp.city, state: wp.state, serviceRadiusKm: wp.serviceRadiusKm, availability: wp.availability,
    distanceKm: origin ? haversineKm(origin, wp.location?.coordinates) : undefined,
    work_description: { specialized: wp.specialized, experience: wp.experience, address: wp.city || wp.address }, // legacy card shape
  };
};

// ---------- search ----------
const search = asyncHandler(async (req, res) => {
  const q = req.query, p = pageOpts(q, 12, 50), and = [];
  const blocked = await User.distinct("_id", { type: "worker", isBlocked: true });
  const f = { userId: { $nin: blocked } };
  const ci = (s) => new RegExp(`^${escapeRegex(String(s).slice(0, 60))}$`, "i");
  const has = (s) => new RegExp(escapeRegex(String(s).slice(0, 60)), "i");
  if (q.category) and.push({ $or: [{ categories: ci(q.category) }, { specialized: has(q.category) }] });
  if (q.specialization) f.specialized = has(q.specialization);
  if (q.city) f.city = ci(q.city);
  if (q.state) f.state = ci(q.state);
  if (q.pincode && /^\d{6}$/.test(q.pincode)) f.pincode = q.pincode;
  if (num(q.minRating) !== undefined) f.ratingAvg = { $gte: num(q.minRating) };
  if (num(q.minExperience) !== undefined) f.experience = { $gte: num(q.minExperience) };
  if (q.verified === "true") f["verification.status"] = "approved";
  if (q.available === "true") f.available = true;
  if (q.q) {
    const rx = has(q.q), ids = await User.distinct("_id", { type: "worker", name: rx });
    and.push({ $or: [{ specialized: rx }, { bio: rx }, { categories: rx }, { city: rx }, { userId: { $in: ids } }] });
  }
  if (and.length) f.$and = and;
  const origin = num(q.lat) !== undefined && num(q.lng) !== undefined ? [num(q.lng), num(q.lat)] : undefined;
  if (origin) f.location = { $geoWithin: { $centerSphere: [origin, (num(q.radiusKm) || 25) / 6378.1] } };

  const sorts = { rating: { ratingAvg: -1, ratingCount: -1, completedJobs: -1 }, experience: { experience: -1 }, jobs: { completedJobs: -1 }, newest: { createdAt: -1 } };
  const [rows, total] = await Promise.all([
    WorkerProfile.find(f).sort(sorts[q.sort] || sorts.rating).skip(p.skip).limit(p.limit)
      .populate("userId", "name profilePicture").select("-verification.filename -verification.originalName").lean(),
    WorkerProfile.countDocuments(f),
  ]);
  const workers = rows.filter((r) => r.userId).map((r) => {
    const w = publicProfile(r, origin);
    if (req.user.type === "admin") w.work_description.phoneNumber = r.phoneNumber; // contact details are not public
    return w;
  });
  if (q.sort === "distance" && origin) workers.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  res.send({ success: true, message: "Workers fetched successfully", workers, pagination: pagination(p, total) });
});

const getOne = asyncHandler(async (req, res) => {
  const wp = await WorkerProfile.findOne({ userId: req.params.id }).populate("userId", "name profilePicture")
    .select("-verification.filename -verification.originalName").lean();
  if (!wp || !wp.userId) throw new AppError("Worker not found", 404);
  const reviews = await Review.find({ workerId: wp.userId._id }).sort({ createdAt: -1 }).limit(5).populate("userId", "name").lean();
  res.send({ success: true, worker: publicProfile(wp), reviews: reviews.map(({ userId, ...r }) => ({ ...r, reviewer: userId?.name })) });
});

// ---------- own profile ----------
const myProfile = asyncHandler(async (req, res) => {
  const wp = await WorkerProfile.findOne({ userId: req.user._id }).select("-verification.filename").lean();
  const user = req.user.toJSON();
  res.send({ success: true, message: "Worker profile fetched successfully", profile: wp || null, worker: {
    ...user, phoneNumber: wp?.phoneNumber || user.phoneNumber,
    work_description: wp ? { specialized: wp.specialized, experience: wp.experience, address: wp.address, phoneNumber: wp.phoneNumber } : null,
  } });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { lat: la, lng: ln, ...rest } = req.body;
  const set = { ...rest };
  if (la != null && ln != null) set.location = toPoint(la, ln);
  const profile = await WorkerProfile.findOneAndUpdate({ userId: req.user._id }, { $set: set },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  if (rest.phoneNumber) await User.updateOne({ _id: req.user._id }, { phoneNumber: rest.phoneNumber });
  res.send({ success: true, message: "Worker profile updated successfully", profile });
});

// ---------- identity verification (ID is private; deleted after the admin decides) ----------
const submitVerification = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("Upload a clear photo or PDF of your ID", 400);
  const parsed = z.enum(ID_DOC_TYPES).safeParse(req.body.docType);
  if (!parsed.success) throw new AppError(`docType must be one of: ${ID_DOC_TYPES.join(", ")}`, 400);
  const wp = await WorkerProfile.findOne({ userId: req.user._id });
  if (!wp) throw new AppError("Complete your worker profile first", 409);
  if (wp.verification?.status === "approved") throw new AppError("You are already verified", 409);
  const old = wp.verification?.filename;
  wp.verification = { status: "pending", docType: parsed.data, filename: req.file.filename,
    originalName: req.file.originalname.replace(/[^\w.\- ]/g, "_").slice(0, 100), submittedAt: new Date() };
  await wp.save();
  removeByName("ids", old);
  notifyAdmins({ type: "verification_submitted", params: { name: req.user.name } });
  res.send({ success: true, message: "Submitted. An admin will review your document.", status: "pending" });
});

// ---------- earnings ----------
const earnings = asyncHandler(async (req, res) => {
  const w = req.user._id, since = new Date();
  since.setMonth(since.getMonth() - 11, 1); since.setHours(0, 0, 0, 0);
  const [tot, monthly, pending] = await Promise.all([
    Payment.aggregate([{ $match: { workerId: w, status: "paid" } }, { $group: { _id: null, gross: { $sum: "$amount" }, net: { $sum: "$workerEarning" }, fees: { $sum: "$platformFee" }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { workerId: w, status: "paid", paidAt: { $gte: since } } },
      { $group: { _id: { y: { $year: "$paidAt" }, m: { $month: "$paidAt" } }, net: { $sum: "$workerEarning" }, count: { $sum: 1 } } }, { $sort: { "_id.y": 1, "_id.m": 1 } }]),
    Job.aggregate([{ $match: { workerId: w, status: "completed", paymentStatus: "unpaid", agreedPrice: { $gt: 0 } } }, { $group: { _id: null, amount: { $sum: "$agreedPrice" }, jobs: { $sum: 1 } } }]),
  ]);
  const t = tot[0] || { gross: 0, net: 0, fees: 0, count: 0 };
  res.send({ success: true, totals: { gross: t.gross, net: t.net, platformFees: t.fees, paidJobs: t.count },
    awaitingPayment: pending[0] ? { amount: pending[0].amount, jobs: pending[0].jobs } : { amount: 0, jobs: 0 },
    monthly: monthly.map((m) => ({ month: `${m._id.y}-${String(m._id.m).padStart(2, "0")}`, net: m.net, jobs: m.count })) });
});

router.use(authenticate);
router.get("/", search);
router.get("/me", restrictTo("worker"), myProfile);
router.put("/me", restrictTo("worker"), unwrap, validate(profileSchema), updateProfile);
router.get("/me/earnings", restrictTo("worker"), earnings);
router.post("/me/verification", restrictTo("worker"), uploadLimiter, uploaders.idDoc, verifyFiles, submitVerification);
router.get("/:id", validate(z.object({ id: objectId }), "params"), getOne);

module.exports = router;
module.exports.handlers = { search, myProfile, updateProfile, profileSchema, unwrap };

const router = require("express").Router();
const { Job, Review, WorkerProfile } = require("../models");
const { z, objectId } = require("../utils/schemas");
const { AppError, asyncHandler, same, pageOpts, pagination } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, restrictTo } = require("../middlewares/auth");
const { notify } = require("../utils/notify");

async function refreshRating(workerId) {
  const [r] = await Review.aggregate([{ $match: { workerId } }, { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]);
  await WorkerProfile.updateOne({ userId: workerId }, { ratingAvg: r ? Math.round(r.avg * 10) / 10 : 0, ratingCount: r ? r.n : 0 });
}

const schema = z.object({ jobId: objectId, rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });

// Customer rates a worker after the job is completed (one review per job)
router.post("/", authenticate, restrictTo("user"), validate(schema), asyncHandler(async (req, res) => {
  const job = await Job.findById(req.body.jobId);
  if (!job || !same(job.userId, req.user._id)) throw new AppError("Job not found", 404);
  if (job.status !== "completed" || !job.workerId) throw new AppError("You can review only completed jobs", 409);
  const review = await Review.create({ jobId: job._id, userId: req.user._id, workerId: job.workerId, rating: req.body.rating, comment: req.body.comment });
  await refreshRating(job.workerId);
  notify(job.workerId, { type: "review_received", params: { name: req.user.name, rating: req.body.rating }, jobId: job._id });
  res.status(201).send({ success: true, message: "Thanks for your review", review });
}));

router.get("/worker/:workerId", authenticate, asyncHandler(async (req, res) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.workerId)) throw new AppError("Invalid worker id", 400);
  const p = pageOpts(req.query, 10, 50), f = { workerId: req.params.workerId };
  const [items, total, dist] = await Promise.all([
    Review.find(f).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit).populate("userId", "name profilePicture").lean(),
    Review.countDocuments(f),
    Review.aggregate([{ $match: { workerId: require("mongoose").Types.ObjectId.createFromHexString(req.params.workerId) } }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
  ]);
  res.send({
    success: true,
    reviews: items.map(({ userId, ...r }) => ({ ...r, reviewer: userId ? { name: userId.name, profilePicture: userId.profilePicture } : null })),
    distribution: Object.fromEntries([1, 2, 3, 4, 5].map((s) => [s, dist.find((d) => d._id === s)?.n || 0])),
    pagination: pagination(p, total),
  });
}));

// moderation
router.delete("/:id", authenticate, restrictTo("admin"), asyncHandler(async (req, res) => {
  const r = await Review.findByIdAndDelete(req.params.id);
  if (!r) throw new AppError("Review not found", 404);
  await refreshRating(r.workerId);
  res.send({ success: true, message: "Review removed" });
}));

module.exports = router;
module.exports.refreshRating = refreshRating;

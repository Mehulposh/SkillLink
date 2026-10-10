const router = require("express").Router();
const { Job, Dispute } = require("../models");
const { z, objectId } = require("../utils/schemas");
const { AppError, asyncHandler, same } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate } = require("../middlewares/auth");
const { notify, notifyAdmins } = require("../utils/notify");
router.use(authenticate);

const schema = z.object({ jobId: objectId, reason: z.enum(["poor_quality", "no_show", "overcharge", "damage", "payment", "other"]), details: z.string().trim().max(2000).optional() });

router.post("/", validate(schema), asyncHandler(async (req, res) => {
  const job = await Job.findById(req.body.jobId);
  const isOwner = job && same(job.userId, req.user._id), isWorker = job && same(job.workerId, req.user._id);
  if (!job || (!isOwner && !isWorker)) throw new AppError("Job not found", 404);
  if (!["assigned", "in-progress", "completed"].includes(job.status)) throw new AppError("A dispute can be opened only on active or completed jobs", 409);
  if (await Dispute.exists({ jobId: job._id, status: "open" })) throw new AppError("A dispute is already open for this job", 409);
  const against = isOwner ? job.workerId : job.userId;
  const dispute = await Dispute.create({ ...req.body, raisedBy: req.user._id, against, previousStatus: job.status });
  job.pushStatus("disputed", req.user._id, `Dispute: ${req.body.reason}`);
  await job.save();
  notify(against, { type: "dispute_opened", params: { reason: req.body.reason }, jobId: job._id, email: true });
  notifyAdmins({ type: "dispute_opened", params: { reason: req.body.reason }, jobId: job._id });
  res.status(201).send({ success: true, dispute });
}));

router.get("/mine", asyncHandler(async (req, res) => {
  const disputes = await Dispute.find({ $or: [{ raisedBy: req.user._id }, { against: req.user._id }] }).sort({ createdAt: -1 }).limit(100).lean();
  res.send({ success: true, disputes });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const d = await Dispute.findById(req.params.id).lean();
  if (!d || (req.user.type !== "admin" && !same(d.raisedBy, req.user._id) && !same(d.against, req.user._id))) throw new AppError("Dispute not found", 404);
  res.send({ success: true, dispute: d });
}));
module.exports = router;

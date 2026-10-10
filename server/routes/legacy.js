// Keeps every URL the existing React frontend already calls (/api/user/...) working,
// but routed through the hardened handlers. New code should use /api/jobs, /api/workers, /api/auth.
const router = require("express").Router();
const { User, UserProfile } = require("../models");
const { z, phone, pincode, lat, lng } = require("../utils/schemas");
const { AppError, asyncHandler, toPoint } = require("../utils/helpers");
const { validate, dropEmpty } = require("../middlewares/validate");
const { authenticate, restrictTo, requireVerified } = require("../middlewares/auth");
const { authLimiter, uploadLimiter } = require("../middlewares/security");
const { uploaders, verifyFiles } = require("../middlewares/upload");
const { notifyAdmins } = require("../utils/notify");
const A = require("./auth").handlers, J = require("./jobs").handlers, W = require("./workers").handlers;

router.post("/register", authLimiter, validate(A.registerSchema), A.register);
router.post("/login", authLimiter, validate(A.loginSchema), A.login);
router.post("/logout", A.logout);

const workerRequest = z.object({ specialized: z.string().trim().min(2).max(80), experience: z.coerce.number().min(0).max(60), address: z.string().trim().min(2).max(200), phoneNumber: phone });
router.post("/requestchangeusertype/:userId", authenticate, restrictTo("user"), W.unwrap, validate(workerRequest), asyncHandler(async (req, res) => {
  if (req.params.userId !== String(req.user._id)) throw new AppError("You can only request this for your own account", 403); // was an IDOR
  req.user.request = "yes"; req.user.work_description = req.body;
  await req.user.save();
  notifyAdmins({ type: "verification_submitted", params: { name: req.user.name } });
  res.send({ success: true, message: "Request sent successfully to Admin" });
}));

router.post("/sendcomplaint", authenticate, restrictTo("user"), requireVerified, uploadLimiter, uploaders.jobPhotos, verifyFiles, dropEmpty, validate(J.createSchema), J.create);
router.get("/allproblems", authenticate, restrictTo("user"), J.mine);
router.get(["/worker/allproblems", "/worker/acceptedjobs"], authenticate, restrictTo("worker"), J.workerJobs);
router.get("/worker/getfiledownload", authenticate, J.download);
router.post("/worker/changestatus/:id", authenticate, restrictTo("worker"), validate(J.changeStatusSchema), J.changeStatus);
router.post("/worker/unassign/:id", authenticate, restrictTo("worker"), J.unassign);
router.get("/allworkers", authenticate, W.search);
router.get(["/availableproblems", "/worker/availablejobs"], authenticate, restrictTo("worker"), J.available);
router.post("/worker/acceptjob/:id", authenticate, restrictTo("worker"), requireVerified, J.accept);
router.post("/updateworkerprofile", authenticate, restrictTo("worker"), W.unwrap, validate(W.profileSchema), W.updateProfile);
router.get("/worker/profile", authenticate, restrictTo("worker"), W.myProfile);
router.get("/worker/dashboard", authenticate, restrictTo("worker"), J.dashboard);

const userProfileSchema = z.object({ address: z.string().trim().max(200), phoneNumber: phone, city: z.string().trim().max(60), state: z.string().trim().max(60), pincode, lat, lng }).partial();
router.get("/userprofile", authenticate, asyncHandler(async (req, res) => {
  const p = await UserProfile.findOne({ userId: req.user._id }).lean();
  res.send({ success: true, message: "User profile fetched successfully",
    user: { ...req.user.toJSON(), address: p?.address || "", phoneNumber: p?.phoneNumber || "", city: p?.city || "", state: p?.state || "", pincode: p?.pincode || "" } });
}));
router.post("/updateuserprofile", authenticate, validate(userProfileSchema), asyncHandler(async (req, res) => {
  const { lat: la, lng: ln, ...rest } = req.body, set = { ...rest };
  if (la != null && ln != null) set.location = toPoint(la, ln);
  await UserProfile.findOneAndUpdate({ userId: req.user._id }, { $set: set }, { upsert: true, runValidators: true, setDefaultsOnInsert: true });
  if (rest.phoneNumber) await User.updateOne({ _id: req.user._id }, { phoneNumber: rest.phoneNumber });
  res.send({ success: true, message: "User profile updated successfully" });
}));

module.exports = router;

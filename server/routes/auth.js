const router = require("express").Router();
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const env = require("../config/env");
const { User } = require("../models");
const { z, password } = require("../utils/schemas");
const { AppError, asyncHandler, sha256, randomToken } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, signToken, setAuthCookie, clearAuthCookie } = require("../middlewares/auth");
const { authLimiter, uploadLimiter } = require("../middlewares/security");
const { uploaders, verifyFiles, photoDoc, removeByName } = require("../middlewares/upload");
const { sendMail, notify } = require("../utils/notify");

const ROUNDS = 12, MAX_FAILS = 5, LOCK_MIN = 15;
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", ROUNDS); // equalises timing for unknown emails
const email = z.string().trim().toLowerCase().email().max(120);
const link = (path, token) => `${env.clientUrls[0]}${path}?token=${token}`;

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email, password,
  type: z.enum(["user", "worker"]).default("user"), // "admin" can never be self-assigned
  language: z.enum(["en", "hi"]).optional(),
  referralCode: z.string().trim().max(20).optional(),
});
const loginSchema = z.object({ email, password: z.string().min(1).max(72) });

const register = asyncHandler(async (req, res) => {
  const { name, email, password, type, language, referralCode } = req.body;
  if (await User.exists({ email })) return res.status(200).send({ message: "User already exists", success: false });
  let referredBy;
  if (referralCode) referredBy = (await User.findOne({ referralCode: referralCode.toUpperCase() }).select("_id"))?._id;
  const token = randomToken();
  const user = await User.create({
    name, email, type, language, referredBy,
    password: await bcrypt.hash(password, ROUNDS),
    referralCode: crypto.randomBytes(4).toString("hex").toUpperCase(),
    emailVerifyToken: sha256(token), emailVerifyExpires: new Date(Date.now() + 24 * 3600e3),
  });
  sendMail(user.email, "Verify your email", `Hi ${user.name},\n\nPlease verify your email: ${link("/verify-email", token)}\nThe link expires in 24 hours.`)
    .catch((e) => console.error("mail failed:", e.message));
  if (referredBy) notify(referredBy, { type: "referral_joined", params: { name: user.name } });
  res.status(201).send({ message: "Register Successfully", success: true });
});

// NOTE: failures return HTTP 200 + success:false so the existing frontend (which redirects on any 401) keeps showing the message.
const loginHandler = (role) => asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select("+password");
  const fail = (m = "Invalid email or password") => res.status(200).send({ success: false, message: m });
  if (user?.lockUntil && user.lockUntil > new Date()) return fail("Too many failed attempts. Try again in a few minutes.");
  const match = await bcrypt.compare(req.body.password, user?.password || DUMMY_HASH);
  if (!user || !match || (role === "admin" && user.type !== "admin")) {
    if (user && !match) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MIN * 60e3); user.failedLogins = 0; }
      await user.save();
    }
    return fail();
  }
  if (user.isBlocked) return fail("This account has been suspended");
  if (user.failedLogins || user.lockUntil) { user.failedLogins = 0; user.lockUntil = undefined; await user.save(); }
  setAuthCookie(res, signToken(user)); // httpOnly cookie; token is never exposed to JS
  const data = user.toJSON();
  res.send({ success: true, message: "Login success successfully", userData: data, admin: user.type === "admin" ? data : undefined });
});

const logout = (req, res) => { clearAuthCookie(res); res.send({ success: true, message: "Logged out successfully" }); };

router.post("/register", authLimiter, validate(registerSchema), register);
router.post("/login", authLimiter, validate(loginSchema), loginHandler("any"));
router.post("/logout", logout);
router.get("/me", authenticate, (req, res) => res.send({ success: true, user: req.user.toJSON() }));

router.post("/verify-email", authLimiter, validate(z.object({ token: z.string().length(64) })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ emailVerifyToken: sha256(req.body.token), emailVerifyExpires: { $gt: new Date() } })
    .select("+emailVerifyToken +emailVerifyExpires");
  if (!user) throw new AppError("Verification link is invalid or has expired", 400);
  user.emailVerified = true; user.emailVerifyToken = undefined; user.emailVerifyExpires = undefined;
  await user.save();
  res.send({ success: true, message: "Email verified" });
}));

router.post("/resend-verification", authenticate, authLimiter, asyncHandler(async (req, res) => {
  if (req.user.emailVerified) return res.send({ success: true, message: "Already verified" });
  const token = randomToken();
  await User.updateOne({ _id: req.user._id }, { emailVerifyToken: sha256(token), emailVerifyExpires: new Date(Date.now() + 24 * 3600e3) });
  sendMail(req.user.email, "Verify your email", `Verify your email: ${link("/verify-email", token)}`).catch(() => {});
  res.send({ success: true, message: "Verification email sent" });
}));

router.post("/forgot-password", authLimiter, validate(z.object({ email })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && !user.isBlocked) {
    const token = randomToken();
    await User.updateOne({ _id: user._id }, { resetToken: sha256(token), resetExpires: new Date(Date.now() + 3600e3) });
    sendMail(user.email, "Reset your password", `Reset your password (valid for 1 hour): ${link("/reset-password", token)}\nIf you did not ask for this, ignore this email.`).catch(() => {});
  }
  res.send({ success: true, message: "If that email exists, a reset link has been sent." }); // same answer either way
}));

const setPassword = (user, plain) => bcrypt.hash(plain, ROUNDS).then((h) => {
  user.password = h;
  user.passwordChangedAt = new Date(Date.now() - 2000); // invalidates all older JWTs
  user.failedLogins = 0; user.lockUntil = undefined;
});

router.post("/reset-password", authLimiter, validate(z.object({ token: z.string().length(64), password })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetToken: sha256(req.body.token), resetExpires: { $gt: new Date() } }).select("+resetToken +resetExpires");
  if (!user) throw new AppError("Reset link is invalid or has expired", 400);
  await setPassword(user, req.body.password);
  user.resetToken = undefined; user.resetExpires = undefined;
  await user.save();
  res.send({ success: true, message: "Password updated. Please log in." });
}));

router.post("/change-password", authenticate, authLimiter, validate(z.object({ currentPassword: z.string().min(1).max(72), newPassword: password })), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select("+password");
  if (!(await bcrypt.compare(req.body.currentPassword, user.password))) throw new AppError("Current password is incorrect", 400);
  await setPassword(user, req.body.newPassword);
  await user.save();
  setAuthCookie(res, signToken(user));
  res.send({ success: true, message: "Password changed" });
}));

const settingsSchema = z.object({ language: z.enum(["en", "hi"]).optional(), smsOptIn: z.boolean().optional(), name: z.string().trim().min(2).max(80).optional() });
router.patch("/settings", authenticate, validate(settingsSchema), asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.send({ success: true, user: req.user.toJSON() });
}));

router.post("/avatar", authenticate, uploadLimiter, uploaders.avatar, verifyFiles, asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("No image uploaded", 400);
  const old = req.user.profilePicture?.split("/").pop();
  req.user.profilePicture = photoDoc(req.file).url;
  await req.user.save();
  removeByName("avatars", old);
  res.send({ success: true, profilePicture: req.user.profilePicture });
}));

module.exports = router;
module.exports.handlers = { register, login: loginHandler("any"), adminLogin: loginHandler("admin"), logout, registerSchema, loginSchema, setPassword };

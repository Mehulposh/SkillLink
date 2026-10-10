const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { User } = require("../models");
const { AppError, asyncHandler } = require("../utils/helpers");

const COOKIE = "sw_token";
const LEGACY_COOKIES = ["user_jwt", "admin_jwt", "worker_jwt"];

const signToken = (user) => jwt.sign({ id: user._id, type: user.type }, env.jwtSecret, { algorithm: "HS256", expiresIn: env.jwtExpires });
const cookieOpts = () => ({ httpOnly: true, secure: env.isProd, sameSite: env.cookieSameSite, path: "/" });
const setAuthCookie = (res, token) => res.cookie(COOKIE, token, { ...cookieOpts(), maxAge: 24 * 3600 * 1000 });
const clearAuthCookie = (res) => [COOKIE, ...LEGACY_COOKIES].forEach((c) => res.clearCookie(c, cookieOpts()));

const authenticate = asyncHandler(async (req, res, next) => {
  const h = req.get("Authorization");
  const token = req.cookies?.[COOKIE] || (h && h.startsWith("Bearer ") ? h.slice(7) : null);
  if (!token) throw new AppError("Authentication required", 401);
  let decoded;
  try { decoded = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }); }
  catch (e) { throw new AppError(e.name === "TokenExpiredError" ? "Session expired. Please log in again." : "Invalid token", 401); }
  const user = await User.findById(decoded.id);
  if (!user) throw new AppError("User not found", 401);
  if (user.isBlocked) throw new AppError("This account has been suspended", 403);
  if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
    throw new AppError("Password was changed. Please log in again.", 401);
  }
  req.user = user;
  next();
});

const restrictTo = (...roles) => (req, res, next) =>
  roles.includes(req.user?.type) ? next() : next(new AppError("You do not have permission to do this", 403));

const requireVerified = (req, res, next) =>
  !env.requireEmailVerification || req.user.emailVerified ? next() : next(new AppError("Please verify your email first", 403));

module.exports = { COOKIE, signToken, setAuthCookie, clearAuthCookie, authenticate, restrictTo, requireVerified };

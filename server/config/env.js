const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const isProd = process.env.NODE_ENV === "production";
for (const k of ["MONGO_DB", "JWT_SECRET"]) {
  if (!process.env[k]) {
    console.error(`FATAL: ${k} is not set. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}
if (isProd && process.env.JWT_SECRET.length < 32) {
  console.error("FATAL: JWT_SECRET must be at least 32 characters in production.");
  process.exit(1);
}
const list = (v, d) => (v || d).split(",").map((s) => s.trim()).filter(Boolean);
const bool = (v) => String(v).toLowerCase() === "true";

module.exports = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_DB,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpires: process.env.JWT_EXPIRES || "1d",
  clientUrls: list(process.env.CLIENT_URL, "http://localhost:5173"),
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  cookieSameSite: process.env.COOKIE_SAMESITE || "lax",
  tzOffsetMinutes: Number(process.env.TZ_OFFSET_MINUTES ?? 330),
  adminKey: process.env.ADMIN_REGISTRATION_KEY || "",
  requireEmailVerification: bool(process.env.REQUIRE_EMAIL_VERIFICATION),
  requireWorkerVerification: bool(process.env.REQUIRE_WORKER_VERIFICATION),
  smtp: {
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER, pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || "Skilled Workers <no-reply@localhost>",
  },
  twilio: { sid: process.env.TWILIO_SID, token: process.env.TWILIO_TOKEN, from: process.env.TWILIO_FROM },
  countryCode: process.env.DEFAULT_COUNTRY_CODE || "+91",
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID, keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT ?? 10),
  referralRewardRs: Number(process.env.REFERRAL_REWARD_RS ?? 100),
  uploadDir: path.resolve(__dirname, "../uploads"),
};

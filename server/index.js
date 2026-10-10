const env = require("./config/env");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { sanitize, globalLimiter } = require("./middlewares/security");
const { notFound, errorHandler } = require("./middlewares/error");
const { AppError } = require("./utils/helpers");

const app = express();
app.disable("x-powered-by");
if (env.trustProxy) app.set("trust proxy", env.trustProxy);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: (origin, cb) => (!origin || env.clientUrls.includes(origin) ? cb(null, true) : cb(new AppError("Origin not allowed", 403))),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
}));
app.use(globalLimiter);
app.use(express.json({ limit: "100kb", verify: (req, res, buf) => { if (req.originalUrl.startsWith("/api/payments/webhook")) req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(cookieParser());
app.use(sanitize);

app.get("/health", (req, res) => res.send({ status: "ok", db: mongoose.connection.readyState === 1 }));

// New API
app.use("/api/auth", require("./routes/auth"));
app.use("/api/jobs", require("./routes/jobs"));
app.use("/api/workers", require("./routes/workers"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/quotes", require("./routes/quotes"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/disputes", require("./routes/disputes"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/files", require("./routes/files"));
// Legacy-compatible URLs used by the current frontend
app.use("/api/user", require("./routes/legacy"));
app.use("/api/admin", require("./routes/admin"));

app.use(notFound);
app.use(errorHandler);

connectDB().then(() => {
  const server = app.listen(env.port, () => console.log(`API running on port ${env.port}`));
  const stop = () => server.close(() => mongoose.connection.close().then(() => process.exit(0)));
  process.on("SIGTERM", stop); process.on("SIGINT", stop);
});
process.on("unhandledRejection", (e) => console.error("Unhandled rejection:", e));

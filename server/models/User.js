const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String, required: [true, "name is required"], trim: true, maxlength: 80,
      set: (v) => (typeof v === "string" ? v.trim().replace(/^./, (c) => c.toUpperCase()) : v),
    },
    email: { type: String, required: [true, "email is required"], lowercase: true, trim: true, unique: true, maxlength: 120 },
    password: { type: String, required: true, select: false },
    type: { type: String, enum: ["user", "admin", "worker"], default: "user" },
    request: { type: String, enum: ["no", "yes"], default: "no" }, // user -> worker upgrade request
    work_description: { type: Object },
    address: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    profilePicture: { type: String, default: "" },
    language: { type: String, enum: ["en", "hi"], default: "en" },
    smsOptIn: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    emailVerifyToken: { type: String, select: false },
    emailVerifyExpires: { type: Date, select: false },
    resetToken: { type: String, select: false },
    resetExpires: { type: Date, select: false },
    passwordChangedAt: Date,
    failedLogins: { type: Number, default: 0 },
    lockUntil: Date,
    isBlocked: { type: Boolean, default: false },
    blockedReason: String,
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  },
  { timestamps: true }
);

userSchema.set("toJSON", {
  transform: (doc, ret) => {
    ["password", "emailVerifyToken", "emailVerifyExpires", "resetToken", "resetExpires", "failedLogins", "lockUntil", "__v"]
      .forEach((k) => delete ret[k]);
    return ret;
  },
});

module.exports = mongoose.model("user", userSchema);

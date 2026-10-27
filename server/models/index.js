const mongoose = require("mongoose");
const { Schema } = mongoose;
const ref = (m) => ({ type: Schema.Types.ObjectId, ref: m });

const Review = mongoose.model("review", new Schema({
  jobId: { ...ref("problem"), required: true, unique: true },
  userId: { ...ref("user"), required: true },
  workerId: { ...ref("user"), required: true, index: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, maxlength: 1000, default: "" },
}, { timestamps: true }));

const Notification = mongoose.model("notification", new Schema({
  userId: { ...ref("user"), required: true },
  type: String, title: String, body: String, jobId: ref("problem"),
  read: { type: Boolean, default: false },
}, { timestamps: true }).index({ userId: 1, read: 1, createdAt: -1 }));

const Message = mongoose.model("message", new Schema({
  jobId: { ...ref("problem"), required: true },
  senderId: { ...ref("user"), required: true },
  receiverId: { ...ref("user"), required: true },
  text: { type: String, required: true, maxlength: 2000 },
  readAt: Date,
}, { timestamps: true }).index({ jobId: 1, createdAt: 1 }));

const Quote = mongoose.model("quote", new Schema({
  jobId: { ...ref("problem"), required: true },
  workerId: { ...ref("user"), required: true },
  amount: { type: Number, required: true, min: 1 },
  message: { type: String, maxlength: 500, default: "" },
  etaHours: Number,
  negotiationHistory: [{
    amount: { type: Number, required: true },
    message: { type: String, default: "" },
    etaHours: Number,
    changedAt: { type: Date, default: Date.now },
  }],
  status: { type: String, enum: ["pending", "accepted", "rejected", "withdrawn"], default: "pending" },
}, { timestamps: true }).index({ jobId: 1, workerId: 1 }, { unique: true }));

const Payment = mongoose.model("payment", new Schema({
  jobId: { ...ref("problem"), required: true, index: true },
  userId: { ...ref("user"), required: true },
  workerId: { ...ref("user"), required: true, index: true },
  baseAmount: Number, discount: { type: Number, default: 0 }, amount: Number,
  platformFee: Number, workerEarning: Number,
  promoCode: String,
  method: { type: String, enum: ["online", "cash"], required: true },
  status: { type: String, enum: ["created", "paid", "failed", "refunded"], default: "created" },
  razorpayOrderId: { type: String, index: true }, razorpayPaymentId: String,
  invoiceNumber: { type: String, unique: true, sparse: true },
  paidAt: Date,
}, { timestamps: true }));

const Dispute = mongoose.model("dispute", new Schema({
  jobId: { ...ref("problem"), required: true, index: true },
  raisedBy: { ...ref("user"), required: true },
  against: { ...ref("user"), required: true },
  reason: { type: String, enum: ["poor_quality", "no_show", "overcharge", "damage", "payment", "other"], required: true },
  details: { type: String, maxlength: 2000, default: "" },
  previousStatus: String,
  status: { type: String, enum: ["open", "resolved", "rejected"], default: "open" },
  outcome: { type: String, enum: ["completed", "cancelled", "refund"] },
  adminNote: String, resolvedBy: ref("user"), resolvedAt: Date,
}, { timestamps: true }));

const Promo = mongoose.model("promo", new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  type: { type: String, enum: ["percent", "flat"], required: true },
  value: { type: Number, required: true, min: 1 },
  maxDiscount: Number, minAmount: Number,
  maxUses: { type: Number, default: 0 }, // 0 = unlimited
  usedCount: { type: Number, default: 0 },
  usedBy: [ref("user")],
  restrictedTo: ref("user"),
  expiresAt: Date,
  active: { type: Boolean, default: true },
}, { timestamps: true }));

const Category = mongoose.model("category", new Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 50 },
  active: { type: Boolean, default: true },
}));

module.exports = {
  User: require("./User"), Job: require("./Job"), ...require("./Worker"),
  Review, Notification, Message, Quote, Payment, Dispute, Promo, Category,
};

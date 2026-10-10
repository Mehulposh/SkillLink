const mongoose = require("mongoose");
const { Schema } = mongoose;
const { STATUS } = require("../utils/constants");
const photo = new Schema({ filename: String, originalName: String, url: String }, { _id: false });

const jobSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true },
    workerId: { type: Schema.Types.ObjectId, ref: "user", default: null },
    name: { type: String, required: [true, "name is required"], trim: true, maxlength: 80 },
    address: { type: String, required: [true, "address is required"], maxlength: 200 },
    city: { type: String, required: [true, "city is required"], trim: true },
    state: { type: String, required: [true, "state is required"], trim: true },
    pincode: { type: String, required: [true, "pincode is required"] },
    phone: { type: String, required: [true, "phone number is required"] },
    comment: { type: String, maxLength: 1000 },
    category: { type: String, trim: true, index: true },
    urgent: { type: Boolean, default: false },
    scheduledAt: Date,
    budget: { type: Number, min: 0 },
    agreedPrice: { type: Number, min: 0 },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "refunded"], default: "unpaid" },
    file: { type: Object }, // legacy single attachment (first photo)
    photos: { type: [photo], default: [] },
    afterPhotos: { type: [photo], default: [] },
    location: { type: { type: String, enum: ["Point"] }, coordinates: { type: [Number], default: undefined } },
    status: { type: String, enum: STATUS, default: "pending" },
    assigned: { type: String, default: "" }, // assigned worker's display name (legacy)
    timeline: [{
      _id: false, status: String, by: { type: Schema.Types.ObjectId, ref: "user" },
      note: String, at: { type: Date, default: Date.now },
    }],
    completedAt: Date,
    cancelReason: String,
  },
  { timestamps: true }
);

jobSchema.methods.pushStatus = function (status, by, note) {
  this.status = status;
  this.timeline.push({ status, by, note });
  if (status === "completed") this.completedAt = new Date();
};
jobSchema.index({ userId: 1, createdAt: -1 });
jobSchema.index({ workerId: 1, status: 1 });
jobSchema.index({ status: 1, workerId: 1, urgent: -1, createdAt: -1 });
jobSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("problem", jobSchema); // keeps the legacy "problems" collection

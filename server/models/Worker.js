const mongoose = require("mongoose");
const { Schema } = mongoose;
const geo = { type: { type: String, enum: ["Point"] }, coordinates: { type: [Number], default: undefined } };

const workerProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true, unique: true },
    specialized: { type: String, default: "", trim: true, maxlength: 80 },
    categories: { type: [String], default: [] },
    bio: { type: String, default: "", maxlength: 500 },
    experience: { type: Number, default: 0, min: 0, max: 60 },
    address: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    pincode: { type: String, default: "" },
    location: geo,
    serviceRadiusKm: { type: Number, default: 25, min: 1, max: 200 },
    available: { type: Boolean, default: true },
    availability: [{ _id: false, day: { type: Number, min: 0, max: 6 }, start: String, end: String }],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    verification: {
      status: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
      docType: String, filename: String, originalName: String,
      submittedAt: Date, reviewedAt: Date, reviewedBy: { type: Schema.Types.ObjectId, ref: "user" }, note: String,
    },
  },
  { timestamps: true }
);
workerProfileSchema.index({ location: "2dsphere" });
workerProfileSchema.index({ ratingAvg: -1, ratingCount: -1 });
workerProfileSchema.index({ city: 1, specialized: 1 });

const userProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true, unique: true },
    address: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },
    city: String, state: String, pincode: String,
    location: geo,
  },
  { timestamps: true }
);
userProfileSchema.index({ location: "2dsphere" });

module.exports = {
  WorkerProfile: mongoose.model("workerprofile", workerProfileSchema, "workerprofile"),
  UserProfile: mongoose.model("userprofile", userProfileSchema, "userprofile"),
};

const Job = require("../models/Job");
const { WorkerProfile } = require("../models/Worker");
const env = require("../config/env");
const { AppError } = require("./helpers");

const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };

// Throws 409 if the worker is switched off, outside their weekly slots, or double-booked (±2h)
async function assertWorkerFree(workerId, scheduledAt, ignoreJobId) {
  const profile = await WorkerProfile.findOne({ userId: workerId }).lean();
  if (env.requireWorkerVerification && profile?.verification?.status !== "approved") {
    throw new AppError("Only verified workers can take jobs", 403);
  }
  if (profile && profile.available === false) throw new AppError("Worker is not accepting jobs right now", 409);
  if (!scheduledAt) return profile;
  const when = new Date(scheduledAt);
  if (profile?.availability?.length) {
    const local = new Date(when.getTime() + env.tzOffsetMinutes * 60000);
    const day = local.getUTCDay();
    const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
    const ok = profile.availability.some((s) => s.day === day && mins >= toMin(s.start) && mins < toMin(s.end));
    if (!ok) throw new AppError("Worker is not available at the requested time", 409);
  }
  const filter = {
    workerId, status: { $in: ["assigned", "in-progress"] },
    scheduledAt: { $gt: new Date(when.getTime() - 2 * 3600e3), $lt: new Date(when.getTime() + 2 * 3600e3) },
  };
  if (ignoreJobId) filter._id = { $ne: ignoreJobId };
  if (await Job.exists(filter)) throw new AppError("Worker already has a job around that time", 409);
  return profile;
}
module.exports = { assertWorkerFree };

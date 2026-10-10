// One-off migration for data created by the OLD backend. Safe to re-run. Usage: npm run migrate
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const env = require("../config/env");
const models = require("../models");
const { User, Job } = models;

const STATUS_MAP = { Pending: "pending", Assigned: "assigned", "In Progress": "in-progress", "in progress": "in-progress", Completed: "completed", Cancelled: "cancelled" };
const EXT = { ".jpg": ".jpg", ".jpeg": ".jpg", ".png": ".png", ".webp": ".webp" };

(async () => {
  await mongoose.connect(env.mongoUri);
  // 1. emails -> lowercase (report duplicates instead of merging accounts)
  const seen = new Map();
  for (const u of await User.find().select("email").lean()) {
    const e = String(u.email).trim().toLowerCase();
    if (seen.has(e)) { console.warn(`DUPLICATE email after lowercasing: ${e} (${seen.get(e)} and ${u._id}) - resolve manually`); continue; }
    seen.set(e, u._id);
    if (e !== u.email) await User.collection.updateOne({ _id: u._id }, { $set: { email: e } });
  }
  // 2. existing users are treated as verified; give everyone a referral code
  await User.collection.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
  for (const u of await User.find({ referralCode: { $exists: false } }).select("_id").lean())
    await User.collection.updateOne({ _id: u._id }, { $set: { referralCode: crypto.randomBytes(4).toString("hex").toUpperCase() } });
  // 3. job statuses, timeline, legacy attachment -> private bucket
  fs.mkdirSync(path.join(env.uploadDir, "jobs"), { recursive: true });
  let moved = 0;
  for (const j of await Job.collection.find({}).toArray()) {
    const set = {};
    if (STATUS_MAP[j.status]) set.status = STATUS_MAP[j.status];
    if (!j.timeline || !j.timeline.length) set.timeline = [{ status: set.status || j.status || "pending", note: "Imported from previous version", at: j.createdAt || new Date() }];
    if ((!j.photos || !j.photos.length) && j.file?.path) {
      const src = path.join(env.uploadDir, path.basename(String(j.file.path)));
      const ext = EXT[path.extname(src).toLowerCase()];
      if (ext && fs.existsSync(src)) {
        const filename = crypto.randomUUID() + ext;
        fs.copyFileSync(src, path.join(env.uploadDir, "jobs", filename));
        const url = `/api/files/jobs/${filename}`;
        set.photos = [{ filename, originalName: j.file.name, url }];
        set.file = { name: j.file.name, path: url }; moved++;
      }
    }
    if (Object.keys(set).length) await Job.collection.updateOne({ _id: j._id }, { $set: set });
  }
  console.log(`Copied ${moved} legacy attachment(s) into uploads/jobs`);
  // 4. indexes
  for (const m of Object.values(models)) { try { await m.syncIndexes(); } catch (e) { console.warn(`Index sync failed for ${m.modelName}: ${e.message}`); } }
  // 5. old public files
  const leftovers = fs.existsSync(env.uploadDir) ? fs.readdirSync(env.uploadDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name) : [];
  if (leftovers.length) console.warn(`\nSECURITY: ${leftovers.length} file(s) remain in the old public uploads folder (${leftovers.slice(0, 5).join(", ")}...).\nThey are no longer served. Review them and DELETE any ID documents (e.g. Aadhaar images) or personal photos.`);
  console.log("Migration finished");
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });

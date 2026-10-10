const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const env = require("../config/env");
const { AppError, asyncHandler } = require("../utils/helpers");

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf" };
const IMG = ["image/jpeg", "image/png", "image/webp"];
const SIG = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 4).toString("hex") === "89504e47",
  "image/webp": (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP",
  "application/pdf": (b) => b.subarray(0, 4).toString() === "%PDF",
};

// Random server-side names (never the client's file name), per-bucket folders, strict type + size limits
const make = (bucket, allowed, maxMB, maxFiles) =>
  multer({
    storage: multer.diskStorage({
      destination: (req, f, cb) => {
        const dir = path.join(env.uploadDir, bucket);
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, f, cb) => cb(null, crypto.randomUUID() + EXT[f.mimetype]),
    }),
    limits: { fileSize: maxMB * 1024 * 1024, files: maxFiles },
    fileFilter: (req, f, cb) => (allowed.includes(f.mimetype) ? cb(null, true) : cb(new AppError("Unsupported file type", 400))),
  });

const uploaders = {
  jobPhotos: make("jobs", IMG, 5, 6).fields([{ name: "photos", maxCount: 5 }, { name: "file", maxCount: 1 }]),
  morePhotos: make("jobs", IMG, 5, 5).array("photos", 5),
  avatar: make("avatars", IMG, 2, 1).single("avatar"),
  idDoc: make("ids", [...IMG, "application/pdf"], 5, 1).single("document"),
};

const filesOf = (req) => {
  const all = [];
  if (req.file) all.push(req.file);
  if (Array.isArray(req.files)) all.push(...req.files);
  else if (req.files) Object.values(req.files).forEach((a) => all.push(...a));
  return all;
};
const photoDoc = (f) => ({
  filename: f.filename,
  originalName: path.basename(f.originalname).replace(/[^\w.\- ]/g, "_").slice(0, 100),
  url: `/api/files/${path.basename(f.destination)}/${f.filename}`,
});
const removeStored = (files) => Promise.all(files.map((f) => fs.promises.unlink(f.path).catch(() => {})));
const removeByName = (bucket, filename) =>
  filename && /^[a-f0-9-]{36}\.\w+$/.test(filename)
    ? fs.promises.unlink(path.join(env.uploadDir, bucket, filename)).catch(() => {}) : Promise.resolve();

// Check magic bytes so a renamed .exe/.html cannot pass as an image
const verifyFiles = asyncHandler(async (req, res, next) => {
  for (const f of filesOf(req)) {
    const fh = await fs.promises.open(f.path, "r");
    const buf = Buffer.alloc(12);
    await fh.read(buf, 0, 12, 0);
    await fh.close();
    if (!SIG[f.mimetype] || !SIG[f.mimetype](buf)) throw new AppError("File content does not match its type", 400);
  }
  next();
});

module.exports = { uploaders, verifyFiles, filesOf, photoDoc, removeStored, removeByName };

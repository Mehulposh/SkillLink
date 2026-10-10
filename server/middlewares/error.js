const env = require("../config/env");
const { AppError } = require("../utils/helpers");
const { filesOf, removeStored } = require("./upload");

const notFound = (req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.path}`, 404));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // delete files uploaded by a request that ultimately failed
  removeStored(filesOf(req));

  let status = err.status || 500, message = err.message;
  if (err.name === "MulterError") { status = 400; message = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message; }
  else if (err.name === "ValidationError") { status = 400; message = Object.values(err.errors).map((e) => e.message).join("; "); }
  else if (err.name === "CastError") { status = 400; message = "Invalid id or value"; }
  else if (err.code === 11000) { status = 409; message = "A record with this value already exists"; }
  else if (err.type === "entity.parse.failed") { status = 400; message = "Malformed JSON body"; }
  else if (err.type === "entity.too.large") { status = 413; message = "Request body too large"; }

  if (status >= 500) {
    console.error(err);
    if (env.isProd) message = "Something went wrong";
  }
  res.status(status).send({ success: false, message });
};
module.exports = { notFound, errorHandler };

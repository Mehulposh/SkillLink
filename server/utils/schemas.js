const { z } = require("zod");
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "invalid id");
const bool = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);
const phone = z.string().trim().regex(/^\+?\d{10,13}$/, "invalid phone number");
const pincode = z.string().trim().regex(/^\d{6}$/, "pincode must be 6 digits");
const lat = z.coerce.number().min(-90).max(90);
const lng = z.coerce.number().min(-180).max(180);
const futureDate = z.coerce.date().refine((d) => d.getTime() > Date.now() - 60000, "must be in the future");
const password = z.string().min(8, "at least 8 characters").max(72)
  .regex(/[A-Za-z]/, "must contain a letter").regex(/\d/, "must contain a number");
const HHMM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM");
module.exports = { z, objectId, bool, phone, pincode, lat, lng, futureDate, password, HHMM };

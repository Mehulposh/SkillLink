// Usage: node scripts/createAdmin.js "Full Name" admin@example.com 'StrongPass123'
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const env = require("../config/env");
const { User } = require("../models");
const { password } = require("../utils/schemas");

(async () => {
  const [name, email, pass] = process.argv.slice(2);
  if (!name || !email || !pass) { console.error('Usage: node scripts/createAdmin.js "Name" email password'); process.exit(1); }
  const ok = password.safeParse(pass);
  if (!ok.success) { console.error("Weak password:", ok.error.issues.map((i) => i.message).join(", ")); process.exit(1); }
  await mongoose.connect(env.mongoUri);
  if (await User.exists({ email: email.toLowerCase() })) { console.error("A user with this email already exists"); process.exit(1); }
  await User.create({ name, email, type: "admin", emailVerified: true, password: await bcrypt.hash(pass, 12) });
  console.log("Admin created:", email);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });

const env = require("../config/env");
const T = require("./i18n");
const { User, Notification } = require("../models");

let transporter;
const getTransporter = () => {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = require("nodemailer").createTransport({
      host: env.smtp.host, port: env.smtp.port, secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
};

async function sendMail(to, subject, text) {
  const t = getTransporter();
  if (!t) {
    // Never print message bodies (they can contain reset/verify links) in production
    console.log(env.isProd ? `[mail] SMTP not configured, skipped "${subject}"` : `[mail:dev] to=${to}\n${subject}\n${text}\n`);
    return;
  }
  await t.sendMail({ from: env.smtp.from, to, subject, text });
}

async function sendSms(to, body) {
  const { sid, token, from } = env.twilio;
  if (!sid || !token || !from) { if (!env.isProd) console.log(`[sms:dev] ${to}: ${body}`); return; }
  const e164 = to.startsWith("+") ? to : `${env.countryCode}${to}`;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: e164, From: from, Body: body }),
  });
  if (!r.ok) throw new Error(`SMS failed (${r.status})`);
}

const fill = (s, p) => s.replace(/\{(\w+)\}/g, (_, k) => p[k] ?? "");

/** Create an in-app notification (+ optional email / SMS). Never throws. */
async function notify(userId, { type, params = {}, jobId, email = false, sms = false }) {
  try {
    const u = await User.findById(userId).select("email phoneNumber language smsOptIn isBlocked");
    if (!u || u.isBlocked) return;
    const tpl = (T[u.language] && T[u.language][type]) || T.en[type];
    if (!tpl) return;
    const title = fill(tpl.title, params), body = fill(tpl.body, params);
    await Notification.create({ userId, type, title, body, jobId });
    if (email) sendMail(u.email, title, body).catch((e) => console.error("mail failed:", e.message));
    if (sms && u.smsOptIn && u.phoneNumber) sendSms(u.phoneNumber, `${title}: ${body}`).catch((e) => console.error(e.message));
  } catch (e) { console.error("notify failed:", e.message); }
}
const notifyMany = (ids, payload) => Promise.all([...new Set(ids.map(String))].map((id) => notify(id, payload)));
const notifyAdmins = async (payload) => {
  const admins = await User.find({ type: "admin", isBlocked: false }).select("_id").lean();
  return notifyMany(admins.map((a) => a._id), payload);
};

module.exports = { notify, notifyMany, notifyAdmins, sendMail, sendSms };

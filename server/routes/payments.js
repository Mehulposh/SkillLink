const router = require("express").Router();
const crypto = require("crypto");
const env = require("../config/env");
const { Job, Payment, Promo, User } = require("../models");
const { z, objectId } = require("../utils/schemas");
const { AppError, asyncHandler, same, round2, escHtml } = require("../utils/helpers");
const { validate } = require("../middlewares/validate");
const { authenticate, restrictTo } = require("../middlewares/auth");
const rzp = require("../utils/razorpay");
const { notify } = require("../utils/notify");

async function findPromo(code, userId, amount) {
  if (!code) return null;
  const bad = (m) => { throw new AppError(m, 400); };
  const p = await Promo.findOne({ code: code.toUpperCase().trim(), active: true });
  if (!p) bad("Invalid promo code");
  if (p.expiresAt && p.expiresAt < new Date()) bad("Promo code has expired");
  if (p.maxUses && p.usedCount >= p.maxUses) bad("Promo code usage limit reached");
  if (p.restrictedTo && !same(p.restrictedTo, userId)) bad("Invalid promo code");
  if (p.usedBy.some((u) => same(u, userId))) bad("You have already used this promo code");
  if (p.minAmount && amount < p.minAmount) bad(`Minimum order amount for this code is ₹${p.minAmount}`);
  return p;
}
function price(job, promo) {
  const base = job.agreedPrice;
  if (!base || base <= 0) throw new AppError("The final price has not been agreed yet", 409);
  let discount = 0;
  if (promo) {
    discount = promo.type === "percent" ? Math.min((base * promo.value) / 100, promo.maxDiscount || Infinity) : promo.value;
    discount = Math.min(round2(discount), base);
  }
  const amount = round2(base - discount), platformFee = round2((amount * env.platformFeePercent) / 100);
  return { baseAmount: base, discount, amount, platformFee, workerEarning: round2(amount - platformFee) };
}
async function loadPayableJob(jobId, user) {
  const job = await Job.findById(jobId);
  if (!job || !same(job.userId, user._id)) throw new AppError("Job not found", 404);
  if (job.status !== "completed" || !job.workerId) throw new AppError("You can pay once the job is marked completed", 409);
  if (job.paymentStatus === "paid") throw new AppError("This job is already paid", 409);
  return job;
}

// Atomically flips created -> paid exactly once (safe against double webhook/verify calls)
async function markPaid(filter, extra = {}) {
  const pay = await Payment.findOneAndUpdate({ ...filter, status: "created" }, { $set: { status: "paid", paidAt: new Date(),
    invoiceNumber: `INV-${new Date().getFullYear()}-${crypto.randomInt(0, 1e8).toString().padStart(8, "0")}`, ...extra } }, { new: true });
  if (!pay) return null;
  await Job.updateOne({ _id: pay.jobId }, { paymentStatus: "paid" });
  if (pay.promoCode) {
    await Promo.updateOne({ code: pay.promoCode, $or: [{ maxUses: 0 }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] }, { $inc: { usedCount: 1 }, $addToSet: { usedBy: pay.userId } });
  }
  notify(pay.workerId, { type: "payment_received", params: { amount: pay.workerEarning, invoice: pay.invoiceNumber }, jobId: pay.jobId, email: true });
  // referral reward: when a referred customer pays for their first job
  const buyer = await User.findById(pay.userId).select("referredBy").lean();
  if (buyer?.referredBy && (await Payment.countDocuments({ userId: pay.userId, status: "paid" })) === 1) {
    const code = `REF${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await Promo.create({ code, type: "flat", value: env.referralRewardRs, maxUses: 1, restrictedTo: buyer.referredBy, expiresAt: new Date(Date.now() + 90 * 864e5) });
    notify(buyer.referredBy, { type: "referral_reward", params: { code, amount: env.referralRewardRs } });
  }
  return pay;
}

router.post("/webhook", asyncHandler(async (req, res) => { // no auth: verified by HMAC signature
  if (!rzp.verifyWebhook(req.rawBody, req.get("x-razorpay-signature"))) return res.status(400).send({ success: false });
  const e = req.body?.payload?.payment?.entity;
  if (["payment.captured", "order.paid"].includes(req.body?.event) && e?.order_id) await markPaid({ razorpayOrderId: e.order_id }, { razorpayPaymentId: e.id });
  res.send({ success: true });
}));

router.use(authenticate);

router.post("/promo/validate", restrictTo("user"), validate(z.object({ jobId: objectId, code: z.string().trim().min(3).max(30) })), asyncHandler(async (req, res) => {
  const job = await loadPayableJob(req.body.jobId, req.user);
  const p = price(job, await findPromo(req.body.code, req.user._id, job.agreedPrice));
  res.send({ success: true, pricing: p });
}));

router.post("/order", restrictTo("user"), validate(z.object({ jobId: objectId, method: z.enum(["online", "cash"]), promoCode: z.string().trim().max(30).optional() })), asyncHandler(async (req, res) => {
  const { jobId, method, promoCode } = req.body;
  const job = await loadPayableJob(jobId, req.user);
  if (method === "online" && !rzp.enabled()) throw new AppError("Online payments are not enabled on this server", 501);
  const promo = await findPromo(promoCode, req.user._id, job.agreedPrice);
  const p = price(job, promo);
  await Payment.deleteMany({ jobId, status: "created" }); // replace any abandoned attempt
  const pay = await Payment.create({ jobId, userId: req.user._id, workerId: job.workerId, method, promoCode: promo?.code, ...p });
  if (method === "cash") return res.status(201).send({ success: true, payment: pay, message: "Pay the worker in cash; they will confirm receipt." });
  const order = await rzp.createOrder({ amountPaise: Math.round(p.amount * 100), receipt: String(pay._id), notes: { jobId: String(jobId) } });
  pay.razorpayOrderId = order.id; await pay.save();
  res.status(201).send({ success: true, payment: pay, checkout: { keyId: env.razorpay.keyId, orderId: order.id, amount: order.amount, currency: order.currency } });
}));

router.post("/verify", restrictTo("user"), validate(z.object({ razorpay_order_id: z.string(), razorpay_payment_id: z.string(), razorpay_signature: z.string() })), asyncHandler(async (req, res) => {
  const { razorpay_order_id: o, razorpay_payment_id: id, razorpay_signature: sig } = req.body;
  if (!rzp.verifyCheckout(o, id, sig)) throw new AppError("Payment signature mismatch", 400);
  const pay = await markPaid({ razorpayOrderId: o, userId: req.user._id }, { razorpayPaymentId: id });
  if (!pay) { // already settled by the webhook?
    const done = await Payment.findOne({ razorpayOrderId: o, userId: req.user._id, status: "paid" });
    if (!done) throw new AppError("Payment not found", 404);
    return res.send({ success: true, payment: done });
  }
  res.send({ success: true, message: "Payment successful", payment: pay });
}));

router.post("/:id/confirm-cash", restrictTo("worker"), asyncHandler(async (req, res) => {
  const pay = await markPaid({ _id: req.params.id, workerId: req.user._id, method: "cash" });
  if (!pay) throw new AppError("Pending cash payment not found", 404);
  res.send({ success: true, message: "Cash payment confirmed", payment: pay });
}));

const canSee = (pay, u) => u.type === "admin" || same(pay.userId, u._id) || same(pay.workerId, u._id);
router.get("/job/:jobId", asyncHandler(async (req, res) => {
  const pay = await Payment.findOne({ jobId: req.params.jobId }).sort({ createdAt: -1 }).select("-razorpayOrderId").lean();
  if (!pay || !canSee(pay, req.user)) throw new AppError("Payment not found", 404);
  res.send({ success: true, payment: pay });
}));

router.get("/:id/invoice", asyncHandler(async (req, res) => {
  const pay = await Payment.findById(req.params.id).lean();
  if (!pay || pay.status !== "paid" || !canSee(pay, req.user)) throw new AppError("Invoice not found", 404);
  const [job, customer, worker] = await Promise.all([Job.findById(pay.jobId).lean(), User.findById(pay.userId).select("name email").lean(), User.findById(pay.workerId).select("name").lean()]);
  const inv = { invoiceNumber: pay.invoiceNumber, date: pay.paidAt, customer: { name: customer?.name, email: customer?.email }, worker: worker?.name,
    service: { job: job?.name, category: job?.category, description: job?.comment, address: `${job?.address}, ${job?.city}, ${job?.state} ${job?.pincode}` },
    lines: { subtotal: pay.baseAmount, discount: pay.discount, promoCode: pay.promoCode, total: pay.amount, platformFee: pay.platformFee, workerEarning: pay.workerEarning },
    method: pay.method, currency: "INR" };
  if (req.query.format !== "html") return res.send({ success: true, invoice: inv });
  const e = escHtml;
  res.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'").type("html").send(`<!doctype html><meta charset="utf-8"><title>${e(inv.invoiceNumber)}</title>
<body style="font-family:sans-serif;max-width:640px;margin:2rem auto"><h1>Invoice ${e(inv.invoiceNumber)}</h1><p>${e(new Date(inv.date).toDateString())}</p>
<p><b>Customer:</b> ${e(inv.customer.name)}<br><b>Worker:</b> ${e(inv.worker)}<br><b>Service:</b> ${e(inv.service.job)} (${e(inv.service.category || "General")})<br>${e(inv.service.address)}</p>
<table width="100%" border="1" cellpadding="6" style="border-collapse:collapse"><tr><td>Subtotal</td><td align="right">₹${e(inv.lines.subtotal)}</td></tr>
<tr><td>Discount ${e(inv.lines.promoCode || "")}</td><td align="right">−₹${e(inv.lines.discount)}</td></tr><tr><th align="left">Total paid (${e(inv.method)})</th><th align="right">₹${e(inv.lines.total)}</th></tr></table></body>`);
}));

module.exports = router;
module.exports.refundPayment = async (pay) => {
  if (pay.status !== "paid") throw new AppError("Only paid payments can be refunded", 409);
  if (pay.method === "online" && rzp.enabled() && pay.razorpayPaymentId) await rzp.refund(pay.razorpayPaymentId, Math.round(pay.amount * 100));
  pay.status = "refunded"; await pay.save();
  await Job.updateOne({ _id: pay.jobId }, { paymentStatus: "refunded" });
  return pay;
};

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BadgeCheck, Calendar, Camera, CheckCircle2, Clock, FileText, IndianRupee, MapPin, MessageSquare, Phone, Send, Tag, Zap } from "lucide-react";
import api, { errMsg, fileUrl } from "../lib/api";
import { useFetch, useInterval } from "../lib/hooks";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Avatar, Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, Select, Spinner, StarInput, Stars, StatusBadge, Switch, Textarea } from "../components/ui";
import { cx, fmtDate, money, statusLabel, timeAgo, toLocalInput } from "../lib/utils";

const loadRazorpay = () => new Promise((res, rej) => {
  if (window.Razorpay) return res();
  const s = document.createElement("script"); s.src = "https://checkout.razorpay.com/v1/checkout.js";
  s.onload = res; s.onerror = () => rej(new Error("Could not load the payment gateway")); document.body.appendChild(s);
});

/* ---------- small building blocks ---------- */
const Info = ({ icon: I, label, children }) => children ? (
  <div className="flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-indigo-500/10 text-indigo-500"><I size={15} /></span>
    <div className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><p className="break-words text-sm font-semibold">{children}</p></div></div>) : null;

function Photos({ title, photos }) {
  if (!photos?.length) return null;
  return (<div><p className="label">{title}</p><div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
    {photos.map((p) => <a key={p.filename} href={fileUrl(p.url)} target="_blank" rel="noreferrer"><img src={fileUrl(p.url)} alt={p.originalName || "photo"} loading="lazy" className="aspect-square w-full rounded-xl object-cover transition hover:scale-[1.03]" /></a>)}</div></div>);
}

function Timeline({ items }) {
  if (!items?.length) return null;
  return (
    <Card><h3 className="mb-4 font-bold">Progress</h3>
      <ol className="relative space-y-5 border-l-2 border-indigo-400/30 pl-6">
        {[...items].reverse().map((t, i) => (
          <li key={i} className="relative"><span className={cx("absolute -left-[33px] top-0.5 grid h-4 w-4 place-items-center rounded-full ring-4 ring-white/50 dark:ring-slate-900/50", i === 0 ? "bg-indigo-500" : "bg-slate-400")} />
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={t.status} /><span className="text-xs text-slate-500">{fmtDate(t.at, true)}</span></div>
            {t.note && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.note}</p>}</li>))}
      </ol></Card>
  );
}

function Chat({ jobId, me, readOnly }) {
  const toast = useToast(); const [msgs, setMsgs] = useState([]); const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const end = useRef();
  const last = useRef(null);
  const poll = async () => {
    try {
      const { data } = await api.get(`/messages/${jobId}`, { params: last.current ? { since: last.current } : {} });
      if (data.messages.length) { last.current = data.messages[data.messages.length - 1].createdAt; setMsgs((m) => [...m, ...data.messages.filter((n) => !m.some((x) => x._id === n._id))]); }
    } catch { /* ignore transient errors while polling */ }
  };
  useEffect(() => { poll(); /* eslint-disable-next-line */ }, [jobId]);
  useInterval(poll, 5000);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs.length]);
  const send = async (e) => {
    e.preventDefault(); if (!text.trim()) return; setBusy(true);
    try { const { data } = await api.post(`/messages/${jobId}`, { text }); setText(""); last.current = data.message.createdAt; setMsgs((m) => [...m, data.message]); }
    catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  };
  return (
    <Card className="flex flex-col !p-0">
      <h3 className="flex items-center gap-2 border-b border-slate-500/10 p-4 font-bold"><MessageSquare size={17} className="text-indigo-500" /> Chat</h3>
      <div className="max-h-80 min-h-[10rem] space-y-2 overflow-y-auto p-4">
        {!msgs.length && <p className="py-6 text-center text-sm text-slate-500">No messages yet. Say hello 👋</p>}
        {msgs.map((m) => { const mine = m.senderId === me; return (
          <div key={m._id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm", mine ? "rounded-br-md bg-gradient-to-r from-indigo-500 to-violet-500 text-white" : "glass rounded-bl-md")}>
              <p className="whitespace-pre-wrap break-words">{m.text}</p><p className={cx("mt-0.5 text-[10px]", mine ? "text-white/70" : "text-slate-500")}>{timeAgo(m.createdAt)}</p></div></div>); })}
        <div ref={end} />
      </div>
      {readOnly ? <p className="border-t border-slate-500/10 p-3 text-center text-xs text-slate-500">Admin view is read-only</p> : (
        <form onSubmit={send} className="flex gap-2 border-t border-slate-500/10 p-3"><Input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Type a message…" />
          <Button loading={busy} aria-label="Send"><Send size={16} /></Button></form>)}
    </Card>
  );
}

function Quotes({ job, reload }) {
  const toast = useToast(); const { data, loading, reload: rq } = useFetch(() => api.get(`/quotes/job/${job._id}`), [job._id]);
  const act = async (fn, ok) => { try { await fn(); toast(ok); reload(true); rq(true); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <Card><h3 className="mb-3 font-bold">Quotes {data?.quotes?.length ? `(${data.quotes.length})` : ""}</h3>
      {loading ? <Spinner className="!py-6" /> : !data.quotes.length ? <p className="text-sm text-slate-500">No quotes yet. Workers nearby have been notified. You will get an alert for each quote.</p> : (
        <div className="space-y-3">{data.quotes.map((q, i) => (
          <div key={q._id} className="glass rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to={`/workers/${q.worker?._id}`} className="flex items-center gap-3"><Avatar user={q.worker} size={42} />
                <div><p className="flex items-center gap-1 font-semibold">{q.worker?.name}{q.worker?.verified && <BadgeCheck size={15} className="text-sky-500" />}</p><Stars value={q.worker?.rating} count={q.worker?.ratingCount} size={13} /></div></Link>
              <div className="text-right"><p className="text-xl font-extrabold">{money(q.amount)}</p>{i === 0 && data.quotes.length > 1 && <Badge tone="emerald">Lowest</Badge>}{q.etaHours && <p className="text-xs text-slate-500">~{q.etaHours} h</p>}</div>
            </div>
            {q.message && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{q.message}</p>}
            {q.negotiationHistory?.length > 0 && (
              <details className="mt-3 rounded-xl border border-slate-500/15 p-3">
                <summary className="cursor-pointer text-sm font-semibold">Negotiation history ({q.negotiationHistory.length} previous offer{q.negotiationHistory.length === 1 ? "" : "s"})</summary>
                <ol className="mt-3 space-y-2">
                  {[...q.negotiationHistory].reverse().map((entry, index) => (
                    <li key={`${entry.changedAt}-${index}`} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                      <span className="text-slate-500">{entry.changedAt ? fmtDate(entry.changedAt, true) : "Previous offer"}{entry.message ? ` · ${entry.message}` : ""}</span>
                      <b>{money(entry.amount)}</b>
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <div className="mt-3 flex gap-2"><Button size="sm" variant="success" onClick={() => act(() => api.post(`/quotes/${q._id}/accept`), "Quote accepted. Worker assigned.")}>Accept</Button>
              <Button size="sm" variant="ghost" onClick={() => act(() => api.post(`/quotes/${q._id}/reject`), "Quote declined")}>Decline</Button></div>
          </div>))}</div>)}
    </Card>
  );
}

function QuoteForm({ job, reload }) {
  const toast = useToast(); const [f, setF] = useState({ amount: job.budget || "", message: "", etaHours: "" }); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { const body = { jobId: job._id, amount: Number(f.amount) }; if (f.message) body.message = f.message; if (f.etaHours) body.etaHours = Number(f.etaHours);
      await api.post("/quotes", body); toast("Quote sent. You can send a new one to revise it."); reload(true); }
    catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3"><h4 className="font-bold">Send a quote</h4>
      <div className="grid grid-cols-2 gap-3"><Field label="Price (₹)"><Input required type="number" min="1" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Hours needed"><Input type="number" min="1" value={f.etaHours} onChange={(e) => setF({ ...f, etaHours: e.target.value })} /></Field></div>
      <Textarea rows={2} maxLength={500} placeholder="What is included, materials, availability…" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <Button variant="soft" className="w-full" loading={busy}>Send quote</Button></form>
  );
}

function PayPanel({ job, reload }) {
  const toast = useToast(); const [method, setMethod] = useState("online"); const [code, setCode] = useState(""); const [pricing, setPricing] = useState(null); const [busy, setBusy] = useState(false);
  const base = job.agreedPrice;
  const apply = async () => {
    try { const { data } = await api.post("/payments/promo/validate", { jobId: job._id, code }); setPricing(data.pricing); toast("Promo applied"); }
    catch (e) { setPricing(null); toast(errMsg(e), "error"); }
  };
  const pay = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/payments/order", { jobId: job._id, method, promoCode: pricing ? code : undefined });
      if (method === "cash") { toast(data.message); return reload(true); }
      await loadRazorpay();
      new window.Razorpay({ key: data.checkout.keyId, order_id: data.checkout.orderId, amount: data.checkout.amount, currency: data.checkout.currency, name: "Skilled Workers", description: job.category || "Service",
        theme: { color: "#6366f1" }, handler: async (r) => { try { await api.post("/payments/verify", r); toast("Payment successful 🎉"); reload(true); } catch (e) { toast(errMsg(e), "error"); } } }).open();
    } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  return (
    <Card className="space-y-4 ring-2 ring-emerald-400/30"><h3 className="flex items-center gap-2 font-bold"><IndianRupee size={18} className="text-emerald-500" /> Pay for this job</h3>
      <div className="space-y-1.5 text-sm"><div className="flex justify-between"><span>Agreed price</span><b>{money(base)}</b></div>
        {pricing && <div className="flex justify-between text-emerald-600"><span>Promo discount</span><b>−{money(pricing.discount)}</b></div>}
        <div className="flex justify-between border-t border-slate-500/20 pt-1.5 text-base"><span>Total</span><b>{money(pricing ? pricing.amount : base)}</b></div></div>
      <div className="flex gap-2"><Input placeholder="Promo code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /><Button variant="ghost" onClick={apply} disabled={code.length < 3}>Apply</Button></div>
      <div className="grid grid-cols-2 gap-2">{[["online", "Pay online"], ["cash", "Cash to worker"]].map(([v, l]) => (
        <button key={v} type="button" onClick={() => setMethod(v)} className={cx("rounded-xl border px-3 py-2.5 text-sm font-semibold transition", method === v ? "border-emerald-400 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "border-slate-300/60 dark:border-white/10")}>{l}</button>))}</div>
      <Button variant="success" className="w-full" loading={busy} onClick={pay}>{method === "online" ? "Pay now" : "I will pay in cash"}</Button>
    </Card>
  );
}

function ReviewPanel({ job, reload }) {
  const toast = useToast(); const [rating, setRating] = useState(0); const [comment, setComment] = useState(""); const [busy, setBusy] = useState(false);
  if (job.review) return <Card><h3 className="mb-2 font-bold">Your review</h3><Stars value={job.review.rating} size={20} />{job.review.comment && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{job.review.comment}</p>}</Card>;
  const submit = async () => {
    if (!rating) return toast("Pick a star rating", "error"); setBusy(true);
    try { await api.post("/reviews", { jobId: job._id, rating, comment: comment || undefined }); toast("Thanks for your review!"); reload(true); } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  return (<Card className="space-y-3"><h3 className="font-bold">How was {job.worker?.name || "the worker"}?</h3><StarInput value={rating} onChange={setRating} />
    <Textarea rows={3} maxLength={1000} placeholder="Share details to help others (optional)" value={comment} onChange={(e) => setComment(e.target.value)} /><Button loading={busy} onClick={submit}>Submit review</Button></Card>);
}

/* ---------- page ---------- */
export default function JobDetail() {
  const { id } = useParams(); const nav = useNavigate(); const { user } = useAuth(); const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => api.get(`/jobs/${id}`), [id]);
  const [modal, setModal] = useState(null); const [busy, setBusy] = useState(false); const [form, setForm] = useState({}); const [workers, setWorkers] = useState([]);
  const photoRef = useRef();
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} />;
  const job = data.job, me = user._id;
  const isAdmin = user.type === "admin", isOwner = String(job.userId) === me, isWorker = String(job.workerId) === me;
  const openView = user.type === "worker" && !job.workerId && job.status === "pending" && !isWorker;
  const pay = job.payment;
  const closeModal = () => { setModal(null); setForm({}); };

  const act = async (fn, ok, after) => { setBusy(true); try { await fn(); toast(ok); after?.(); reload(true); } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); } };
  const setStatus = (status, ok) => act(() => api.post(`/jobs/${id}/status`, { status }), ok);
  const upload = (kind) => (e) => {
    const files = [...e.target.files]; e.target.value = ""; if (!files.length) return;
    const fd = new FormData(); files.slice(0, 5).forEach((f) => fd.append("photos", f));
    act(() => api.post(`/jobs/${id}/${kind}`, fd), "Photos added");
  };
  const openModal = async (m) => {
    if (m === "edit") setForm({ comment: job.comment, budget: job.budget || "", urgent: !!job.urgent, scheduledAt: job.scheduledAt ? toLocalInput(job.scheduledAt) : "" });
    if (m === "assign") { try { const { data: d } = await api.get("/admin/users", { params: { type: "worker", limit: 200 } }); setWorkers(d.users.filter((u) => !u.isBlocked)); } catch (e) { toast(errMsg(e), "error"); } setForm({ workerID: "" }); }
    if (m === "dispute") setForm({ reason: "poor_quality", details: "" });
    if (m === "cancel") setForm({ reason: "" });
    if (m === "price") setForm({ amount: "" });
    setModal(m);
  };
  const canDispute = (isOwner || isWorker) && ["assigned", "in-progress", "completed"].includes(job.status);
  const chatOn = job.workerId && (isOwner || isWorker || isAdmin);
  const who = isOwner ? job.worker : null;

  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500"><ArrowLeft size={16} /> Back</button>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h1 className="text-2xl font-extrabold">{job.category || "General job"}</h1><p className="text-sm text-slate-500">Posted {timeAgo(job.createdAt)} by {openView ? job.name : isOwner ? "you" : job.name}</p></div>
              <div className="flex items-center gap-2">{job.urgent && <Badge tone="amber"><Zap size={12} /> Urgent</Badge>}<StatusBadge status={job.status} />{job.paymentStatus !== "unpaid" && <Badge tone="emerald">{job.paymentStatus}</Badge>}</div>
            </div>
            <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{job.comment}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Info icon={MapPin} label="Location">{[job.address, job.city, job.state, job.pincode].filter(Boolean).join(", ") || `${job.city}, ${job.state} ${job.pincode}`}{job.distanceKm !== undefined && ` (${job.distanceKm} km)`}</Info>
              <Info icon={Phone} label="Contact">{job.phone}</Info>
              <Info icon={Calendar} label="Scheduled for">{job.scheduledAt && fmtDate(job.scheduledAt, true)}</Info>
              <Info icon={Tag} label="Customer budget">{job.budget && money(job.budget)}</Info>
              <Info icon={IndianRupee} label="Agreed price">{job.agreedPrice && money(job.agreedPrice)}</Info>
              <Info icon={Clock} label="Completed">{job.completedAt && fmtDate(job.completedAt, true)}</Info>
            </div>
            {openView && <p className="rounded-xl bg-sky-500/10 p-3 text-xs text-sky-700 dark:text-sky-300">The exact address and phone number are shared once you are assigned.</p>}
            <Photos title="Problem photos" photos={job.photos} />
            <Photos title="After photos" photos={job.afterPhotos} />
            <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload(isWorker ? "after-photos" : "photos")} />
            {((isOwner && ["pending", "assigned", "in-progress"].includes(job.status)) || (isWorker && ["assigned", "in-progress", "completed"].includes(job.status))) && (
              <Button variant="ghost" size="sm" onClick={() => photoRef.current.click()}><Camera size={15} /> {isWorker ? "Add after photos" : "Add photos"}</Button>)}
          </Card>
          <Timeline items={job.timeline} />
          {chatOn && <Chat jobId={job._id} me={me} readOnly={isAdmin && !isOwner && !isWorker} />}
        </div>

        <div className="space-y-5">
          {who && (<Card><h3 className="mb-3 font-bold">Your worker</h3>
            <Link to={`/workers/${who._id}`} className="flex items-center gap-3"><Avatar user={who} size={52} /><div><p className="flex items-center gap-1 font-semibold">{who.name}{who.verified && <BadgeCheck size={16} className="text-sky-500" />}</p><p className="text-xs text-slate-500">{who.specialized}</p><Stars value={who.ratingAvg} count={who.ratingCount} size={13} /></div></Link>
            {who.phoneNumber && <a href={`tel:${who.phoneNumber}`} className="glass mt-3 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold"><Phone size={15} /> {who.phoneNumber}</a>}</Card>)}
          {isAdmin && job.worker && <Card><h3 className="mb-2 font-bold">Assigned worker</h3><p className="font-semibold">{job.worker.name}</p><p className="text-xs text-slate-500">{job.worker.phoneNumber}</p></Card>}

          {/* ---- customer ---- */}
          {isOwner && job.status === "pending" && <Quotes job={job} reload={reload} />}
          {isOwner && job.status === "completed" && job.paymentStatus === "unpaid" && (job.agreedPrice
            ? (pay?.method === "cash" && pay?.status === "created" ? <Card className="text-sm"><b>Cash payment pending.</b> Hand over {money(pay.amount)} to the worker. They will confirm receipt.</Card> : <PayPanel job={job} reload={reload} />)
            : <Card className="text-sm">The worker has not set the final price yet. You will be notified.</Card>)}
          {isOwner && job.status === "completed" && <ReviewPanel job={job} reload={reload} />}

          {/* ---- worker ---- */}
          {openView && (<Card className="space-y-4"><Button className="w-full" loading={busy} onClick={() => act(() => api.post(`/jobs/${id}/accept`), "Job accepted. Check My jobs.")}>Accept job{job.budget ? ` for ${money(job.budget)}` : ""}</Button>
            <div className="text-center text-xs text-slate-500">or negotiate</div><QuoteForm job={job} reload={reload} /></Card>)}
          {isWorker && (
            <Card className="space-y-3"><h3 className="font-bold">Manage job</h3>
              {job.status === "assigned" && <><Button className="w-full" loading={busy} onClick={() => setStatus("in-progress", "Work started")}>Start work</Button>
                <Button variant="ghost" className="w-full" onClick={() => act(() => api.post(`/jobs/${id}/unassign`), "Job given back")}>Give job back</Button></>}
              {["assigned", "in-progress"].includes(job.status) && <Button variant="success" className="w-full" loading={busy} onClick={() => setStatus("completed", "Marked as completed")}><CheckCircle2 size={16} /> Mark completed</Button>}
              {!job.agreedPrice && ["in-progress", "completed"].includes(job.status) && <Button variant="soft" className="w-full" onClick={() => openModal("price")}><IndianRupee size={16} /> Set final price</Button>}
              {job.status === "completed" && pay?.method === "cash" && pay?.status === "created" && <Button variant="success" className="w-full" loading={busy} onClick={() => act(() => api.post(`/payments/${pay._id}/confirm-cash`), "Cash payment confirmed")}>Confirm cash received ({money(pay.amount)})</Button>}
              {job.status === "completed" && job.paymentStatus === "unpaid" && !(pay?.status === "created") && <p className="text-sm text-slate-500">Waiting for the customer to pay.</p>}
              {job.status === "completed" && job.review && <div><p className="label">Customer review</p><Stars value={job.review.rating} /><p className="mt-1 text-sm">{job.review.comment}</p></div>}
            </Card>)}
          {isWorker && (
            <Card className="text-sm"><h3 className="mb-2 font-bold">Customer</h3><p className="font-semibold">{job.name}</p><a href={`tel:${job.phone}`} className="text-indigo-500">{job.phone}</a></Card>)}

          {/* ---- shared ---- */}
          {pay?.status === "paid" && (<Card className="space-y-2 text-sm"><h3 className="flex items-center gap-2 font-bold"><FileText size={17} className="text-emerald-500" /> Payment</h3>
            <div className="flex justify-between"><span>Paid ({pay.method})</span><b>{money(pay.amount)}</b></div>{pay.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount {pay.promoCode}</span><b>−{money(pay.discount)}</b></div>}
            {(isOwner || isWorker || isAdmin) && <a href={fileUrl(`/api/payments/${pay._id}/invoice?format=html`)} target="_blank" rel="noreferrer" className="block pt-1 font-semibold text-indigo-500">Open invoice {pay.invoiceNumber}</a>}</Card>)}

          {(isOwner && ["pending", "assigned"].includes(job.status)) && (
            <Card className="flex flex-wrap gap-2">{job.status === "pending" && <Button variant="ghost" size="sm" onClick={() => openModal("edit")}>Edit request</Button>}
              <Button variant="ghost" size="sm" className="!text-rose-600" onClick={() => openModal("cancel")}>Cancel request</Button></Card>)}
          {canDispute && job.status !== "disputed" && <Button variant="ghost" className="w-full !text-rose-600" onClick={() => openModal("dispute")}><AlertTriangle size={16} /> Report a problem</Button>}
          {job.status === "disputed" && <Card className="text-sm"><b className="text-rose-600">Dispute open.</b> An admin is reviewing this job and will contact both sides.</Card>}
          {isAdmin && (<Card className="flex flex-wrap gap-2">{["pending", "assigned"].includes(job.status) && <Button size="sm" onClick={() => openModal("assign")}>{job.workerId ? "Reassign worker" : "Assign worker"}</Button>}
            {!["completed", "cancelled"].includes(job.status) && <Button size="sm" variant="ghost" className="!text-rose-600" onClick={() => openModal("cancel")}>Cancel job</Button>}</Card>)}
        </div>
      </div>

      {/* ---- modals ---- */}
      <Modal open={modal === "cancel"} onClose={closeModal} title="Cancel this job?">
        <Textarea placeholder="Reason (optional)" maxLength={300} value={form.reason || ""} onChange={(e) => setForm({ reason: e.target.value })} />
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={closeModal}>Keep it</Button><Button variant="danger" loading={busy} onClick={() => act(() => api.post(`/jobs/${id}/cancel`, { reason: form.reason || undefined }), "Cancelled", closeModal)}>Cancel job</Button></div>
      </Modal>
      <Modal open={modal === "edit"} onClose={closeModal} title="Edit request">
        <div className="space-y-3"><Field label="Description"><Textarea value={form.comment || ""} maxLength={1000} onChange={(e) => setForm({ ...form, comment: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Budget (₹)"><Input type="number" min="1" value={form.budget || ""} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></Field>
            <Field label="Date and time"><Input type="datetime-local" value={form.scheduledAt || ""} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field></div>
          <Switch checked={!!form.urgent} onChange={(v) => setForm({ ...form, urgent: v })} label="Urgent" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={closeModal}>Close</Button>
            <Button loading={busy} onClick={() => { const b = { comment: form.comment, urgent: !!form.urgent }; if (form.budget) b.budget = Number(form.budget); if (form.scheduledAt) b.scheduledAt = new Date(form.scheduledAt).toISOString(); act(() => api.patch(`/jobs/${id}`, b), "Request updated", closeModal); }}>Save</Button></div></div>
      </Modal>
      <Modal open={modal === "price"} onClose={closeModal} title="Set the final price">
        <p className="mb-3 text-sm text-slate-500">The customer is notified and can then pay you through the app.</p>
        <Input type="number" min="1" placeholder="Amount in ₹" value={form.amount || ""} onChange={(e) => setForm({ amount: e.target.value })} />
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={closeModal}>Close</Button><Button loading={busy} disabled={!form.amount} onClick={() => act(() => api.post(`/jobs/${id}/price`, { amount: Number(form.amount) }), "Price set", closeModal)}>Confirm</Button></div>
      </Modal>
      <Modal open={modal === "dispute"} onClose={closeModal} title="Report a problem">
        <div className="space-y-3"><Field label="What went wrong?"><Select value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
          {[["poor_quality", "Poor quality work"], ["no_show", "No show"], ["overcharge", "Overcharged"], ["damage", "Damage caused"], ["payment", "Payment issue"], ["other", "Something else"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Details"><Textarea maxLength={2000} value={form.details || ""} onChange={(e) => setForm({ ...form, details: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={closeModal}>Close</Button><Button variant="danger" loading={busy} onClick={() => act(() => api.post("/disputes", { jobId: id, reason: form.reason, details: form.details || undefined }), "Dispute opened. An admin will review it.", closeModal)}>Open dispute</Button></div></div>
      </Modal>
      <Modal open={modal === "assign"} onClose={closeModal} title="Assign a worker">
        {!workers.length ? <Empty title="No workers available" /> : (<div className="space-y-3"><Select value={form.workerID || ""} onChange={(e) => setForm({ workerID: e.target.value })}><option value="">Select a worker…</option>{workers.map((w) => <option key={w._id} value={w._id}>{w.name}{w.work_description?.specialized ? ` · ${w.work_description.specialized}` : ""}</option>)}</Select>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={closeModal}>Close</Button><Button loading={busy} disabled={!form.workerID} onClick={() => act(() => api.post(`/admin/selectworker/${id}`, { workerID: form.workerID }), "Worker assigned", closeModal)}>Assign</Button></div></div>)}
      </Modal>
    </>
  );
}

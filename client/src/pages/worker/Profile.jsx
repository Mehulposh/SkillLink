import { useEffect, useState } from "react";
import { BadgeCheck, LocateFixed, Plus, ShieldCheck, Trash2, Upload } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Spinner, Switch, Textarea } from "../../components/ui";
import { DAYS, getPosition } from "../../lib/utils";
import { cx } from "../../lib/utils";

const DOCS = [["aadhaar", "Aadhaar card"], ["pan", "PAN card"], ["driving_license", "Driving licence"], ["voter_id", "Voter ID"], ["passport", "Passport"]];
const VS = { none: ["slate", "Not verified"], pending: ["amber", "Under review"], approved: ["emerald", "Verified"], rejected: ["rose", "Rejected"] };

export default function WorkerProfile() {
  const toast = useToast();
  const me = useFetch(() => api.get("/workers/me"), []);
  const cats = useFetch(() => api.get("/categories"), []);
  const [f, setF] = useState(null); const [loc, setLoc] = useState(null); const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState({ docType: "aadhaar", file: null }); const [vbusy, setVbusy] = useState(false);

  useEffect(() => {
    if (!me.data) return;
    const p = me.data.profile || {};
    setF({ specialized: p.specialized || "", experience: p.experience ?? 0, bio: p.bio || "", address: p.address || "", phoneNumber: p.phoneNumber || "", city: p.city || "", state: p.state || "", pincode: p.pincode || "",
      serviceRadiusKm: p.serviceRadiusKm || 25, available: p.available !== false, categories: p.categories || [], availability: p.availability || [] });
    if (p.location?.coordinates) setLoc({ lng: p.location.coordinates[0], lat: p.location.coordinates[1] });
  }, [me.data]);
  if (me.loading || !f) return <Spinner />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const toggleCat = (c) => setF({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c].slice(0, 10) });
  const slot = (i, k, v) => setF({ ...f, availability: f.availability.map((s, j) => (j === i ? { ...s, [k]: k === "day" ? Number(v) : v } : s)) });

  const save = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const body = { ...f, experience: Number(f.experience), serviceRadiusKm: Number(f.serviceRadiusKm) };
      ["specialized", "bio", "address", "phoneNumber", "city", "state", "pincode"].forEach((k) => { if (body[k] === "") delete body[k]; });
      if (loc) { body.lat = loc.lat; body.lng = loc.lng; }
      await api.put("/workers/me", body); toast("Profile saved"); me.reload(true);
    } catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  };
  const submitDoc = async () => {
    if (!doc.file) return toast("Choose a photo or PDF of your ID", "error");
    setVbusy(true);
    try { const fd = new FormData(); fd.append("docType", doc.docType); fd.append("document", doc.file); await api.post("/workers/me/verification", fd); toast("Submitted for review"); setDoc({ ...doc, file: null }); me.reload(true); }
    catch (err) { toast(errMsg(err), "error"); } finally { setVbusy(false); }
  };
  const v = me.data.profile?.verification || { status: "none" };

  return (
    <>
      <PageHeader title="My profile" subtitle="This is what customers see when they find you" />
      <div className="grid gap-5 lg:grid-cols-3">
        <form onSubmit={save} className="space-y-5 lg:col-span-2">
          <Card className="space-y-4">
            <h3 className="font-bold">About you</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Main skill"><Input value={f.specialized} onChange={set("specialized")} placeholder="e.g. Electrician" maxLength={80} /></Field>
              <Field label="Years of experience"><Input type="number" min="0" max="60" value={f.experience} onChange={set("experience")} /></Field>
            </div>
            <Field label="Short bio"><Textarea maxLength={500} value={f.bio} onChange={set("bio")} placeholder="Tell customers about your work and what you are best at." /></Field>
            <div><p className="label">Services you offer</p><div className="flex flex-wrap gap-2">
              {cats.data?.categories?.map((c) => (
                <button type="button" key={c.name} onClick={() => toggleCat(c.name)}
                  className={cx("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition", f.categories.includes(c.name) ? "border-indigo-400 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300" : "border-slate-300/60 dark:border-white/10")}>{c.name}</button>))}</div></div>
          </Card>
          <Card className="space-y-4">
            <h3 className="font-bold">Location and contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone"><Input inputMode="tel" pattern="\+?\d{10,13}" value={f.phoneNumber} onChange={set("phoneNumber")} placeholder="9876543210" /></Field>
              <Field label="Address"><Input value={f.address} onChange={set("address")} /></Field>
              <Field label="City"><Input value={f.city} onChange={set("city")} /></Field>
              <Field label="State"><Input value={f.state} onChange={set("state")} /></Field>
              <Field label="Pincode"><Input pattern="\d{6}" title="6 digits" value={f.pincode} onChange={set("pincode")} /></Field>
              <Field label="Service radius (km)"><Input type="number" min="1" max="200" value={f.serviceRadiusKm} onChange={set("serviceRadiusKm")} /></Field>
            </div>
            <Button type="button" variant={loc ? "success" : "ghost"} onClick={async () => { try { setLoc(await getPosition()); toast("Location captured. Save to apply."); } catch (e) { toast(e.message, "error"); } }}><LocateFixed size={16} /> {loc ? "Location set (update)" : "Use my current location"}</Button>
          </Card>
          <Card className="space-y-4">
            <div className="flex items-center justify-between"><h3 className="font-bold">Weekly availability</h3><Button type="button" variant="soft" size="sm" onClick={() => setF({ ...f, availability: [...f.availability, { day: 1, start: "09:00", end: "18:00" }] })}><Plus size={14} /> Add slot</Button></div>
            <p className="text-xs text-slate-500">Leave empty to accept jobs at any time. Customers can only schedule you inside these slots.</p>
            {f.availability.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select className="!w-28" value={s.day} onChange={(e) => slot(i, "day", e.target.value)}>{DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}</Select>
                <Input type="time" className="!w-32" value={s.start} onChange={(e) => slot(i, "start", e.target.value)} /> <span>to</span>
                <Input type="time" className="!w-32" value={s.end} onChange={(e) => slot(i, "end", e.target.value)} />
                <button type="button" aria-label="Remove slot" onClick={() => setF({ ...f, availability: f.availability.filter((_, j) => j !== i) })} className="text-rose-500"><Trash2 size={17} /></button>
              </div>))}
            <Switch checked={f.available} onChange={(x) => setF({ ...f, available: x })} label="Currently accepting jobs" />
          </Card>
          <Button size="lg" loading={busy}>Save profile</Button>
        </form>

        <Card className="h-fit space-y-4">
          <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-sky-500" /> Verification</h3><Badge tone={VS[v.status][0]}>{VS[v.status][1]}</Badge></div>
          {v.status === "approved" ? <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-300"><BadgeCheck size={18} /> Your verified badge shows on your profile.</p> : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">Upload a clear photo or PDF of a government ID. Only our admins can see it, and it is deleted after review.</p>
              {v.status === "rejected" && v.note && <p className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-300">Reason: {v.note}</p>}
              {!me.data.profile ? <p className="text-sm text-amber-600">Save your profile first.</p> : v.status === "pending" ? <p className="text-sm text-slate-500">We will notify you once an admin has reviewed it.</p> : (
                <>
                  <Select value={doc.docType} onChange={(e) => setDoc({ ...doc, docType: e.target.value })}>{DOCS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
                  <label className="glass flex cursor-pointer items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold"><Upload size={16} /><span className="truncate">{doc.file ? doc.file.name : "Choose file (JPG, PNG, PDF · max 5 MB)"}</span>
                    <input type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setDoc({ ...doc, file: e.target.files[0] || null })} /></label>
                  <Button className="w-full" loading={vbusy} onClick={submitDoc}>Submit for review</Button>
                </>)}
            </>)}
        </Card>
      </div>
    </>
  );
}

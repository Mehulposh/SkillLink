import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ImagePlus, LocateFixed, X, Zap } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Switch, Textarea } from "../../components/ui";
import { getPosition } from "../../lib/utils";

export default function NewRequest() {
  const nav = useNavigate(); const toast = useToast(); const [sp] = useSearchParams();
  const workerId = sp.get("worker");
  const cats = useFetch(() => api.get("/categories"), []);
  const worker = useFetch(() => (workerId ? api.get(`/workers/${workerId}`) : Promise.resolve({ data: null })), [workerId]);
  const [f, setF] = useState({ name: "", phone: "", address: "", city: "", state: "", pincode: "", category: "", comment: "", budget: "", scheduledAt: "", urgent: false });
  const [loc, setLoc] = useState(null);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { api.get("/auth/me").then(({ data }) => setF((x) => ({ ...x, name: x.name || data.user.name, phone: x.phone || data.user.phoneNumber || "" }))).catch(() => {}); }, []);

  const pick = (e) => {
    const chosen = [...e.target.files].filter((x) => x.size <= 5 * 1024 * 1024);
    if (chosen.length < e.target.files.length) toast("Photos must be under 5 MB", "error");
    setFiles((a) => [...a, ...chosen].slice(0, 5)); e.target.value = "";
  };
  const locate = async () => { try { setLoc(await getPosition()); toast("Location added"); } catch (e) { toast(e.message, "error"); } };

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(f).forEach(([k, v]) => { if (v !== "" && v !== false) fd.append(k, k === "scheduledAt" ? new Date(v).toISOString() : v); });
      if (f.urgent) fd.set("urgent", "true");
      if (loc) { fd.append("lat", loc.lat); fd.append("lng", loc.lng); }
      if (workerId) fd.append("workerId", workerId);
      files.forEach((x) => fd.append("photos", x));
      const { data } = await api.post("/jobs", fd);
      toast(workerId ? "Request sent to the worker" : "Request posted. Workers can now respond.");
      nav(`/jobs/${data.job._id}`);
    } catch (err) { toast(errMsg(err), "error"); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Post a problem" subtitle="The more detail you add, the better quotes you get" />
      {worker.data?.worker && <div className="glass mb-5 flex items-center gap-3 rounded-2xl p-4 text-sm"><Badge tone="indigo">Direct request</Badge> You are requesting <b>{worker.data.worker.name}</b> directly.</div>}
      <form onSubmit={submit} className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category"><Select value={f.category} onChange={set("category")}><option value="">Select…</option>{cats.data?.categories?.map((c) => <option key={c.name}>{c.name}</option>)}</Select></Field>
            <Field label="Budget (₹, optional)"><Input type="number" min="1" value={f.budget} onChange={set("budget")} placeholder="e.g. 800" /></Field>
          </div>
          <Field label="What is the problem?"><Textarea required minLength={3} maxLength={1000} rows={4} value={f.comment} onChange={set("comment")} placeholder="Describe what happened, what you tried, and what you need…" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name"><Input required value={f.name} onChange={set("name")} /></Field>
            <Field label="Phone"><Input required inputMode="tel" pattern="\+?\d{10,13}" title="10 to 13 digits" value={f.phone} onChange={set("phone")} placeholder="9876543210" /></Field>
          </div>
          <Field label="Address"><Input required value={f.address} onChange={set("address")} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="City"><Input required value={f.city} onChange={set("city")} /></Field>
            <Field label="State"><Input required value={f.state} onChange={set("state")} /></Field>
            <Field label="Pincode"><Input required pattern="\d{6}" title="6 digits" value={f.pincode} onChange={set("pincode")} /></Field>
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="space-y-4">
            <Field label="Preferred date and time"><Input type="datetime-local" min={new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16)} value={f.scheduledAt} onChange={set("scheduledAt")} /></Field>
            <div className="flex items-center justify-between rounded-xl bg-amber-500/10 p-3"><div><p className="flex items-center gap-1.5 text-sm font-semibold"><Zap size={15} className="text-amber-500" /> Urgent</p><p className="text-xs text-slate-500">Nearby workers get alerted</p></div>
              <Switch checked={f.urgent} onChange={(v) => setF({ ...f, urgent: v })} /></div>
            <Button type="button" variant={loc ? "success" : "ghost"} className="w-full" onClick={locate}><LocateFixed size={16} /> {loc ? "Location added" : "Use my current location"}</Button>
          </Card>
          <Card>
            <p className="label">Photos (up to 5)</p>
            <div className="grid grid-cols-3 gap-2">
              {files.map((x, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                  <img src={URL.createObjectURL(x)} alt="" className="h-full w-full object-cover" />
                  <button type="button" aria-label="Remove photo" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-slate-900/70 text-white"><X size={13} /></button>
                </div>))}
              {files.length < 5 && (
                <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-indigo-400/50 text-indigo-500 transition hover:bg-indigo-500/10">
                  <ImagePlus size={24} /><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} /></label>)}
            </div>
          </Card>
          <Button size="lg" className="w-full" loading={busy}>{workerId ? "Send request" : "Post problem"}</Button>
        </div>
      </form>
    </>
  );
}

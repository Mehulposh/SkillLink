import { useState } from "react";
import { Briefcase, LocateFixed, Search, SlidersHorizontal } from "lucide-react";
import api from "../../lib/api";
import { useDebounced, useFetch } from "../../lib/hooks";
import { Button, Card, Empty, ErrorBox, Input, PageHeader, Pagination, Select, Spinner, Switch } from "../../components/ui";
import { JobCard } from "../../components/Cards";
import { useToast } from "../../context/ToastContext";
import { getPosition } from "../../lib/utils";

export default function OpenJobs() {
  const toast = useToast(); const cats = useFetch(() => api.get("/categories"), []);
  const [f, setF] = useState({ q: "", category: "", city: "", minBudget: "", maxBudget: "", sort: "urgent", urgent: false });
  const [pos, setPos] = useState(null); const [near, setNear] = useState(false); const [page, setPage] = useState(1);
  const dq = useDebounced(f.q), dc = useDebounced(f.city), dmin = useDebounced(f.minBudget), dmax = useDebounced(f.maxBudget);
  const { data, loading, error, reload } = useFetch(() => api.get("/jobs/available", { params: {
    q: dq || undefined, category: f.category || undefined, city: dc || undefined, minBudget: dmin || undefined, maxBudget: dmax || undefined,
    urgent: f.urgent || undefined, sort: f.sort === "distance" && !pos && !near ? "urgent" : f.sort, lat: pos?.lat, lng: pos?.lng, near: near && !pos ? "me" : undefined, radiusKm: pos ? 30 : undefined, page, limit: 12 } }),
  [dq, dc, dmin, dmax, f.category, f.urgent, f.sort, pos, near, page]);
  const upd = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const locate = async () => { try { setPos(await getPosition()); upd("sort", "distance"); toast("Showing jobs within 30 km"); } catch { setNear(true); toast("Using your saved profile location", "info"); upd("sort", "distance"); } };

  return (
    <>
      <PageHeader title="Open jobs" subtitle="Accept a job or send a quote. Customer contact details unlock once you are assigned." />
      <Card className="mb-6 space-y-4">
        <div className="relative"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-10" placeholder="Search problems…" value={f.q} onChange={(e) => upd("q", e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Select value={f.category} onChange={(e) => upd("category", e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.data?.categories?.map((c) => <option key={c.name}>{c.name}</option>)}</Select>
          <Input placeholder="City" value={f.city} onChange={(e) => upd("city", e.target.value)} />
          <Input type="number" min="0" placeholder="Min ₹" value={f.minBudget} onChange={(e) => upd("minBudget", e.target.value)} />
          <Input type="number" min="0" placeholder="Max ₹" value={f.maxBudget} onChange={(e) => upd("maxBudget", e.target.value)} />
          <Select value={f.sort} onChange={(e) => upd("sort", e.target.value)} aria-label="Sort"><option value="urgent">Urgent first</option><option value="newest">Newest</option><option value="budget">Highest budget</option><option value="schedule">Soonest schedule</option><option value="distance">Nearest</option></Select>
          <Button variant={pos || near ? "success" : "ghost"} onClick={locate}><LocateFixed size={16} /> Near me</Button>
        </div>
        <div className="flex flex-wrap items-center gap-6"><SlidersHorizontal size={16} className="text-slate-400" /><Switch checked={f.urgent} onChange={(v) => upd("urgent", v)} label="Urgent only" />
          {(pos || near) && <button className="text-xs font-semibold text-rose-500" onClick={() => { setPos(null); setNear(false); }}>Clear location</button>}</div>
      </Card>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.jobs.length ? <Card><Empty icon={Briefcase} title="No open jobs match" text="Check back soon or loosen your filters." /></Card> : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.jobs.map((j) => <JobCard key={j._id} job={j} />)}</div>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </>)}
    </>
  );
}

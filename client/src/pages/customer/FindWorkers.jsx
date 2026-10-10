import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LocateFixed, Search, SlidersHorizontal, Users } from "lucide-react";
import api from "../../lib/api";
import { useDebounced, useFetch } from "../../lib/hooks";
import { Button, Card, Empty, ErrorBox, Input, PageHeader, Pagination, Select, Spinner, Switch } from "../../components/ui";
import { WorkerCard } from "../../components/Cards";
import { useToast } from "../../context/ToastContext";
import { getPosition } from "../../lib/utils";

export default function FindWorkers() {
  const nav = useNavigate(); const toast = useToast();
  const cats = useFetch(() => api.get("/categories"), []);
  const [f, setF] = useState({ q: "", category: "", city: "", minRating: "", sort: "rating", verified: false, available: false });
  const [pos, setPos] = useState(null); const [page, setPage] = useState(1);
  const dq = useDebounced(f.q), dcity = useDebounced(f.city);
  const { data, loading, error, reload } = useFetch(() => api.get("/workers", { params: {
    q: dq || undefined, category: f.category || undefined, city: dcity || undefined, minRating: f.minRating || undefined, sort: pos && f.sort === "distance" ? "distance" : f.sort === "distance" ? "rating" : f.sort,
    verified: f.verified || undefined, available: f.available || undefined, lat: pos?.lat, lng: pos?.lng, radiusKm: pos ? 30 : undefined, page, limit: 12 } }),
  [dq, dcity, f.category, f.minRating, f.sort, f.verified, f.available, pos, page]);
  const upd = (k, v) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const locate = async () => { try { setPos(await getPosition()); setF((x) => ({ ...x, sort: "distance" })); toast("Showing workers within 30 km"); } catch (e) { toast(e.message, "error"); } };

  return (
    <>
      <PageHeader title="Find workers" subtitle="Browse verified professionals and request one directly" />
      <Card className="mb-6 space-y-4">
        <div className="relative"><Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-10" placeholder="Search by name, skill or city…" value={f.q} onChange={(e) => upd("q", e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select value={f.category} onChange={(e) => upd("category", e.target.value)} aria-label="Category"><option value="">All categories</option>{cats.data?.categories?.map((c) => <option key={c.name}>{c.name}</option>)}</Select>
          <Input placeholder="City" value={f.city} onChange={(e) => upd("city", e.target.value)} />
          <Select value={f.minRating} onChange={(e) => upd("minRating", e.target.value)} aria-label="Minimum rating"><option value="">Any rating</option><option value="4.5">4.5+ stars</option><option value="4">4+ stars</option><option value="3">3+ stars</option></Select>
          <Select value={f.sort} onChange={(e) => upd("sort", e.target.value)} aria-label="Sort"><option value="rating">Top rated</option><option value="experience">Most experienced</option><option value="jobs">Most jobs done</option><option value="newest">Newest</option><option value="distance">Nearest</option></Select>
          <Button variant={pos ? "success" : "ghost"} onClick={locate}><LocateFixed size={16} /> {pos ? "Near me on" : "Near me"}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-6"><SlidersHorizontal size={16} className="text-slate-400" />
          <Switch checked={f.verified} onChange={(v) => upd("verified", v)} label="Verified only" />
          <Switch checked={f.available} onChange={(v) => upd("available", v)} label="Available now" />
          {pos && <button className="text-xs font-semibold text-rose-500" onClick={() => setPos(null)}>Clear location</button>}</div>
      </Card>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.workers.length ? <Card><Empty icon={Users} title="No workers match your filters" text="Try widening the search or post a request so workers can come to you." /></Card> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.workers.map((w) => <WorkerCard key={w._id} worker={w} onRequest={(x) => nav(`/new?worker=${x._id}`)} />)}</div>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </>)}
    </>
  );
}

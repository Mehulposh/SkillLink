import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeCheck, Briefcase, Clock, MapPin } from "lucide-react";
import api from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { Avatar, Badge, Button, Card, Empty, ErrorBox, Pagination, Spinner, Stars } from "../../components/ui";
import { DAYS, fmtDate } from "../../lib/utils";

export default function WorkerPublic() {
  const { id } = useParams(); const nav = useNavigate(); const [page, setPage] = useState(1);
  const w = useFetch(() => api.get(`/workers/${id}`), [id]);
  const r = useFetch(() => api.get(`/reviews/worker/${id}`, { params: { page, limit: 5 } }), [id, page]);
  if (w.loading) return <Spinner />;
  if (w.error) return <ErrorBox message={w.error} />;
  const x = w.data.worker, dist = r.data?.distribution || {}, total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  return (
    <>
      <Link to="/workers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-500"><ArrowLeft size={16} /> All workers</Link>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-5 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar user={x} size={84} />
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-2xl font-extrabold">{x.name}{x.verified && <BadgeCheck className="text-sky-500" />}</h1>
              <p className="text-slate-500">{x.specialized || "Skilled worker"}</p>
              <Stars value={x.rating} count={x.ratingCount} size={18} />
            </div>
            <Button size="lg" onClick={() => nav(`/new?worker=${x._id}`)} disabled={!x.available}>{x.available ? "Request this worker" : "Currently unavailable"}</Button>
          </div>
          {x.bio && <p className="text-slate-600 dark:text-slate-300">{x.bio}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {[[Briefcase, `${x.completedJobs} jobs done`], [Clock, `${x.experience} yrs experience`], [MapPin, [x.city, x.state].filter(Boolean).join(", ") || "Location not set"]].map(([I, t], i) => (
              <div key={i} className="glass flex items-center gap-2.5 rounded-2xl p-3 text-sm font-medium"><I size={17} className="text-indigo-500" />{t}</div>))}
          </div>
          {x.categories?.length > 0 && <div className="flex flex-wrap gap-2">{x.categories.map((c) => <Badge key={c} tone="indigo">{c}</Badge>)}</div>}
          {x.availability?.length > 0 && (
            <div><p className="label">Weekly availability</p><div className="flex flex-wrap gap-2">{x.availability.map((s, i) => <span key={i} className="glass rounded-xl px-3 py-1.5 text-xs font-semibold">{DAYS[s.day]} {s.start}–{s.end}</span>)}</div></div>)}
        </Card>
        <Card>
          <h3 className="mb-4 font-bold">Rating breakdown</h3>
          <div className="space-y-2">{[5, 4, 3, 2, 1].map((s) => (
            <div key={s} className="flex items-center gap-2 text-xs"><span className="w-3">{s}</span>
              <div className="h-2 flex-1 rounded-full bg-slate-500/10"><div className="h-2 rounded-full bg-amber-400" style={{ width: `${((dist[s] || 0) / total) * 100}%` }} /></div><span className="w-6 text-right text-slate-500">{dist[s] || 0}</span></div>))}</div>
        </Card>
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Reviews</h2>
      {r.loading ? <Spinner /> : !r.data?.reviews?.length ? <Card><Empty title="No reviews yet" text="Reviews appear after customers complete a job with this worker." /></Card> : (
        <div className="space-y-3">{r.data.reviews.map((v) => (
          <Card key={v._id} className="!p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><Avatar user={v.reviewer} size={34} /><div><p className="text-sm font-semibold">{v.reviewer?.name || "Customer"}</p><Stars value={v.rating} size={13} /></div></div><span className="text-xs text-slate-500">{fmtDate(v.createdAt)}</span></div>
            {v.comment && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{v.comment}</p>}</Card>))}
          <Pagination pagination={r.data.pagination} onPage={setPage} /></div>)}
    </>
  );
}

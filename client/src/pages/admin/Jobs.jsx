import { useState } from "react";
import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import api from "../../lib/api";
import { useDebounced, useFetch } from "../../lib/hooks";
import { Badge, Card, Empty, ErrorBox, Input, PageHeader, Pagination, Select, Spinner, StatusBadge } from "../../components/ui";
import { STATUSES, fmtDate, money, statusLabel } from "../../lib/utils";

export default function AdminJobs() {
  const [f, setF] = useState({ q: "", status: "", city: "" }); const [page, setPage] = useState(1);
  const dq = useDebounced(f.q), dc = useDebounced(f.city);
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/jobs", { params: { q: dq || undefined, status: f.status || undefined, city: dc || undefined, page, limit: 20 } }), [dq, dc, f.status, page]);
  const upd = (k, v) => { setF({ ...f, [k]: v }); setPage(1); };
  return (
    <>
      <PageHeader title="All jobs" subtitle="Open a job to assign a worker, cancel it or follow the chat" />
      <Card className="mb-5 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search…" value={f.q} onChange={(e) => upd("q", e.target.value)} />
        <Select value={f.status} onChange={(e) => upd("status", e.target.value)}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</Select>
        <Input placeholder="City" value={f.city} onChange={(e) => upd("city", e.target.value)} />
      </Card>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.jobs.length ? <Card><Empty title="No jobs found" /></Card> : (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Problem</th><th>Customer</th><th>Worker</th><th>City</th><th>Price</th><th>Status</th><th className="pr-4">Posted</th></tr></thead>
            <tbody className="divide-y divide-slate-500/10">
              {data.jobs.map((j) => (
                <tr key={j._id} className="transition hover:bg-indigo-500/5">
                  <td className="max-w-[240px] p-4"><Link to={`/jobs/${j._id}`} className="font-semibold text-indigo-600 hover:underline dark:text-indigo-300">{j.category || "General"}</Link>{j.urgent && <Zap size={13} className="ml-1 inline text-amber-500" />}<p className="truncate text-xs text-slate-500">{j.comment}</p></td>
                  <td>{j.name}</td><td>{j.assigned || <span className="text-slate-400">—</span>}</td><td>{j.city}</td>
                  <td>{money(j.agreedPrice || j.budget)}{j.paymentStatus === "paid" && <Badge tone="emerald" className="ml-1">paid</Badge>}</td>
                  <td><StatusBadge status={j.status} /></td><td className="pr-4 text-slate-500">{fmtDate(j.createdAt)}</td>
                </tr>))}
            </tbody>
          </table>
        </Card>)}
      <Pagination pagination={data?.pagination} onPage={setPage} />
    </>
  );
}

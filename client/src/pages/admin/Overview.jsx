import { useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, ClipboardList, IndianRupee, Percent, Star, Users } from "lucide-react";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { BarChart, Card, ErrorBox, HBars, PageHeader, Select, Spinner, Stat, StatusBadge } from "../../components/ui";
import { money, statusLabel } from "../../lib/utils";

const mlabel = (m) => new Date(m + "-01").toLocaleString("en", { month: "short" });

export default function AdminOverview() {
  const [months, setMonths] = useState(6);
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/reports/overview", { params: { months } }), [months]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const t = data.totals;
  return (
    <>
      <PageHeader title="Overview" subtitle="Marketplace health at a glance"
        action={<Select className="!w-40" value={months} onChange={(e) => setMonths(Number(e.target.value))}><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option></Select>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={ClipboardList} label="Total jobs" value={t.jobs} />
        <Stat icon={Percent} label="Completion rate" value={`${t.completionRate}%`} tone="emerald" />
        <Stat icon={IndianRupee} label="Platform revenue" value={money(t.platformRevenue)} tone="violet" sub={`${money(t.grossRevenue)} gross`} />
        <Stat icon={Star} label="Avg rating" value={t.avgRating || "—"} tone="amber" sub={`${t.reviews} reviews`} />
      </div>
      {(t.openDisputes > 0 || t.pendingVerifications > 0) && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {t.pendingVerifications > 0 && <Link to="/admin/verifications" className="glass flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold"><BadgeCheck className="text-sky-500" /> {t.pendingVerifications} worker ID(s) waiting for review</Link>}
          {t.openDisputes > 0 && <Link to="/admin/disputes" className="glass flex items-center gap-3 rounded-2xl p-4 text-sm font-semibold"><AlertTriangle className="text-rose-500" /> {t.openDisputes} open dispute(s)</Link>}
        </div>)}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card><h3 className="mb-4 font-bold">Jobs per month</h3><BarChart data={data.jobsByMonth.map((m) => ({ label: mlabel(m.month), value: m.total }))} /></Card>
        <Card><h3 className="mb-4 font-bold">Platform revenue</h3><BarChart color="from-fuchsia-500 to-amber-300" format={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} data={data.revenueByMonth.map((m) => ({ label: mlabel(m.month), value: m.platformFees }))} /></Card>
        <Card><h3 className="mb-4 font-bold">Jobs by status</h3>
          <div className="space-y-3">{Object.entries(data.jobsByStatus).map(([s, n]) => (
            <div key={s} className="flex items-center justify-between"><StatusBadge status={s} /><span className="font-bold">{n}</span></div>))}</div></Card>
        <Card><h3 className="mb-4 font-bold">Top categories</h3><HBars data={data.jobsByCategory.slice(0, 6).map((c) => ({ label: c.category, value: c.count }))} /></Card>
        <Card><h3 className="mb-4 font-bold">Workers by skill</h3><HBars data={Object.entries(data.workersBySpecialization).slice(0, 6).map(([label, value]) => ({ label, value }))} /></Card>
        <Card><h3 className="mb-4 font-bold">Top workers</h3>
          {!data.topWorkers.length ? <p className="text-sm text-slate-500">No completed jobs yet.</p> : (
            <ol className="space-y-3">{data.topWorkers.slice(0, 6).map((w, i) => (
              <li key={w.workerId} className="flex items-center gap-3"><span className="grid h-7 w-7 place-items-center rounded-full bg-indigo-500/15 text-xs font-bold text-indigo-600 dark:text-indigo-300">{i + 1}</span>
                <span className="flex-1 truncate font-semibold">{w.name}</span><span className="text-xs text-slate-500">{w.completedJobs} jobs · ★ {w.rating || "—"}</span></li>))}</ol>)}</Card>
      </div>
      <p className="mt-4 text-xs text-slate-500"><Users className="mr-1 inline" size={13} />{Object.entries(data.usersByRole).map(([r, n]) => `${n} ${r}${n === 1 ? "" : "s"}`).join(" · ")}</p>
    </>
  );
}

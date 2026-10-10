import { Link } from "react-router-dom";
import { AlertTriangle, BadgeCheck, Briefcase, CheckCircle2, Clock, Search, Star } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, Stars, Stat, Switch } from "../../components/ui";
import { JobCard } from "../../components/Cards";

export default function WorkerDashboard() {
  const toast = useToast();
  const d = useFetch(() => api.get("/jobs/worker/dashboard"), []);
  const p = useFetch(() => api.get("/workers/me"), []);
  const profile = p.data?.profile, vs = profile?.verification?.status || "none";
  const toggle = async (available) => {
    try { await api.put("/workers/me", { available }); toast(available ? "You are visible and accepting jobs" : "You are now hidden from new jobs"); p.reload(true); }
    catch (e) { toast(errMsg(e), "error"); }
  };
  if (d.loading || p.loading) return <Spinner />;
  if (d.error) return <ErrorBox message={d.error} onRetry={d.reload} />;
  const s = d.data.stats;
  return (
    <>
      <PageHeader title="Worker dashboard" subtitle="Your jobs, ratings and availability"
        action={<Link to="/worker/open"><Button><Search size={18} /> Find jobs</Button></Link>} />
      {!profile && <Link to="/worker/profile" className="glass mb-5 flex items-center gap-3 rounded-2xl border-amber-400/50 p-4 text-sm"><AlertTriangle className="text-amber-500" size={20} /><span><b>Complete your profile</b> so customers can find and trust you.</span></Link>}
      {profile && vs !== "approved" && (
        <Link to="/worker/profile" className="glass mb-5 flex items-center gap-3 rounded-2xl p-4 text-sm"><BadgeCheck className="text-sky-500" size={20} />
          <span>{vs === "pending" ? "Your ID is under review." : vs === "rejected" ? "Your last ID was rejected. Submit a new one." : <><b>Get verified</b> to earn the badge and win more jobs.</>}</span></Link>)}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Briefcase} label="Total jobs" value={s.totalJobs} />
        <Stat icon={Clock} label="Assigned" value={s.acceptedJobs + s.inProgressJobs} tone="violet" />
        <Stat icon={CheckCircle2} label="Completed" value={s.completedJobs} tone="emerald" />
        <Stat icon={Star} label="Rating" value={profile?.ratingAvg ? profile.ratingAvg.toFixed(1) : "New"} tone="amber" sub={profile ? `${profile.ratingCount} reviews` : ""} />
      </div>
      {profile && (
        <Card className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div><p className="font-bold">Accepting new jobs</p><p className="text-sm text-slate-500">Switch off when you are busy. You will not appear in searches.</p></div>
          <Switch checked={profile.available} onChange={toggle} label={profile.available ? "Available" : "Unavailable"} />
        </Card>)}
      <div className="mb-4 mt-8 flex items-center justify-between"><h2 className="text-lg font-bold">Recent jobs</h2><Link to="/worker/jobs" className="text-sm font-semibold text-indigo-500">View all</Link></div>
      {!d.data.recentJobs.length ? <Card><Empty icon={Briefcase} title="No jobs yet" text="Browse open jobs and send a quote or accept one." action={<Link to="/worker/open"><Button className="mt-3">Browse open jobs</Button></Link>} /></Card>
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{d.data.recentJobs.map((j) => <JobCard key={j._id} job={j} />)}</div>}
    </>
  );
}

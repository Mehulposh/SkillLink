import { Link } from "react-router-dom";
import { CheckCircle2, ClipboardList, Clock, PlusCircle, Search, Wallet } from "lucide-react";
import api from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, Stat } from "../../components/ui";
import { JobCard } from "../../components/Cards";
import { useAuth } from "../../context/AuthContext";

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => api.get("/jobs/mine?limit=100"), []);
  const jobs = data?.jobs || [];
  const active = jobs.filter((j) => ["pending", "assigned", "in-progress"].includes(j.status)).length;
  const done = jobs.filter((j) => j.status === "completed").length;
  const unpaid = jobs.filter((j) => j.status === "completed" && j.paymentStatus === "unpaid" && j.agreedPrice).length;
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Everything about your home jobs in one place"
        action={<Link to="/new"><Button><PlusCircle size={18} /> New request</Button></Link>} />
      {!user.emailVerified && <div className="glass mb-5 rounded-2xl border-amber-400/40 p-4 text-sm">Please verify your email. We sent you a link when you registered (resend it in <Link to="/settings" className="font-semibold text-indigo-500">Settings</Link>).</div>}
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat icon={ClipboardList} label="Total requests" value={jobs.length} />
            <Stat icon={Clock} label="In progress" value={active} tone="violet" />
            <Stat icon={CheckCircle2} label="Completed" value={done} tone="emerald" />
            <Stat icon={Wallet} label="Awaiting payment" value={unpaid} tone="amber" />
          </div>
          <div className="mb-4 mt-8 flex items-center justify-between"><h2 className="text-lg font-bold">Recent requests</h2><Link to="/requests" className="text-sm font-semibold text-indigo-500">View all</Link></div>
          {jobs.length === 0 ? (
            <Card><Empty icon={ClipboardList} title="No requests yet" text="Describe your problem and get matched with a skilled worker."
              action={<div className="mt-3 flex gap-2"><Link to="/new"><Button>Post a problem</Button></Link><Link to="/workers"><Button variant="ghost"><Search size={16} /> Browse workers</Button></Link></div>} /></Card>
          ) : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{jobs.slice(0, 6).map((j) => <JobCard key={j._id} job={j} />)}</div>}
        </>)}
    </>
  );
}

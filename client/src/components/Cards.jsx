import { Link } from "react-router-dom";
import { BadgeCheck, Calendar, MapPin, Navigation, Zap, IndianRupee } from "lucide-react";
import { Avatar, Badge, Card, Stars, StatusBadge } from "./ui";
import { fmtDate, money, timeAgo } from "../lib/utils";

export function JobCard({ job, to }) {
  return (
    <Link to={to || `/jobs/${job._id}`} className="block">
      <Card className="h-full !p-5 transition hover:-translate-y-1 hover:shadow-2xl">
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-bold">{job.category || "General job"}</h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {job.urgent && <Badge tone="amber"><Zap size={12} /> Urgent</Badge>}
            <StatusBadge status={job.status} />
          </div>
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-sm text-slate-600 dark:text-slate-300">{job.comment}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><MapPin size={13} />{job.city}</span>
          {job.scheduledAt && <span className="flex items-center gap-1"><Calendar size={13} />{fmtDate(job.scheduledAt, true)}</span>}
          {(job.agreedPrice || job.budget) && <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200"><IndianRupee size={13} />{money(job.agreedPrice || job.budget).slice(1)}</span>}
          {job.distanceKm !== undefined && <span className="flex items-center gap-1"><Navigation size={13} />{job.distanceKm} km</span>}
          <span className="ml-auto">{timeAgo(job.createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}

export function WorkerCard({ worker, onRequest }) {
  return (
    <Card className="flex h-full flex-col !p-5 transition hover:-translate-y-1 hover:shadow-2xl">
      <Link to={`/workers/${worker._id}`} className="flex items-center gap-3">
        <Avatar user={worker} size={52} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate font-bold">{worker.name}{worker.verified && <BadgeCheck size={17} className="shrink-0 text-sky-500" title="ID verified" />}</p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{worker.specialized || "Skilled worker"}</p>
          <Stars value={worker.rating} count={worker.ratingCount} size={14} />
        </div>
      </Link>
      {worker.bio && <p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{worker.bio}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(worker.categories || []).slice(0, 3).map((c) => <Badge key={c} tone="indigo">{c}</Badge>)}
        {!worker.available && <Badge tone="slate">Unavailable</Badge>}
      </div>
      <div className="mt-auto flex items-center justify-between pt-4 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1"><MapPin size={13} />{worker.city || "—"}{worker.distanceKm !== undefined && ` · ${worker.distanceKm} km`}</span>
        <span>{worker.experience || 0} yrs · {worker.completedJobs || 0} jobs</span>
      </div>
      {onRequest && <button onClick={() => onRequest(worker)} className="mt-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:brightness-110">Request this worker</button>}
    </Card>
  );
}

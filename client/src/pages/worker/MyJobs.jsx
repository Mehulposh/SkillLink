import { useState } from "react";
import { Briefcase } from "lucide-react";
import api from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { Card, Empty, ErrorBox, PageHeader, Pagination, Spinner, Tabs } from "../../components/ui";
import { JobCard } from "../../components/Cards";

const TABS = [["", "All"], ["assigned", "Assigned"], ["in-progress", "In progress"], ["completed", "Completed"], ["disputed", "Disputed"], ["cancelled", "Cancelled"]].map(([value, label]) => ({ value, label }));

export default function MyJobs() {
  const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => api.get("/jobs/worker", { params: { status: status || undefined, page, limit: 12 } }), [status, page]);
  return (
    <>
      <PageHeader title="My jobs" subtitle="Jobs assigned to you" />
      <Tabs tabs={TABS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <div className="mt-5">
        {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.jobs.length ? <Card><Empty icon={Briefcase} title="No jobs in this view" /></Card> : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.jobs.map((j) => <JobCard key={j._id} job={j} />)}</div>
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>)}
      </div>
    </>
  );
}

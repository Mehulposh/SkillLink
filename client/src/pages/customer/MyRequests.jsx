import { useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import api from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { Button, Card, Empty, ErrorBox, PageHeader, Pagination, Spinner, Tabs } from "../../components/ui";
import { JobCard } from "../../components/Cards";

const TABS = [["", "All"], ["pending", "Open"], ["assigned", "Assigned"], ["in-progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"], ["disputed", "Disputed"]].map(([value, label]) => ({ value, label }));

export default function MyRequests() {
  const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => api.get("/jobs/mine", { params: { status: status || undefined, page, limit: 12 } }), [status, page]);
  return (
    <>
      <PageHeader title="My requests" subtitle="Track quotes, progress, payments and reviews" action={<Link to="/new"><Button>New request</Button></Link>} />
      <Tabs tabs={TABS} value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      <div className="mt-5">
        {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.jobs.length ? <Card><Empty icon={ClipboardList} title="No requests in this view" /></Card> : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.jobs.map((j) => <JobCard key={j._id} job={j} />)}</div>
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>)}
      </div>
    </>
  );
}

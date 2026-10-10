import { useState } from "react";
import { Scale } from "lucide-react";
import { Link } from "react-router-dom";
import api, { errMsg } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, Card, Empty, ErrorBox, Field, Modal, PageHeader, Select, Spinner, Tabs, Textarea } from "../../components/ui";
import { fmtDate } from "../../lib/utils";

export default function AdminDisputes() {
  const toast = useToast(); const [status, setStatus] = useState("open"); const [t, setT] = useState(null);
  const [f, setF] = useState({ decision: "resolved", outcome: "completed", note: "" });
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/disputes", { params: { status } }), [status]);
  const resolve = async () => {
    try { await api.post(`/admin/disputes/${t._id}/resolve`, { ...f, note: f.note || undefined }); toast("Dispute closed"); setT(null); reload(true); }
    catch (e) { toast(errMsg(e), "error"); }
  };
  return (
    <>
      <PageHeader title="Disputes" subtitle="Decide the outcome and refund when needed" />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }, { value: "rejected", label: "Rejected" }]} />
      <div className="mt-5">
        {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.disputes.length ? <Card><Empty icon={Scale} title="No disputes here" /></Card> : (
          <div className="space-y-3">{data.disputes.map((d) => (
            <Card key={d._id} className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2"><Badge tone="rose">{d.reason.replace("_", " ")}</Badge><span className="text-xs text-slate-500">{fmtDate(d.createdAt, true)}</span></div>
                <p className="text-sm"><b>{d.raisedBy?.name}</b> vs <b>{d.against?.name}</b></p>
                {d.details && <p className="text-sm text-slate-600 dark:text-slate-300">{d.details}</p>}
                {d.adminNote && <p className="text-xs text-slate-500">Admin note: {d.adminNote} ({d.outcome})</p>}
                <Link to={`/jobs/${d.jobId}`} className="text-sm font-semibold text-indigo-500">Open job and chat history</Link>
              </div>
              {d.status === "open" && <Button onClick={() => { setT(d); setF({ decision: "resolved", outcome: "completed", note: "" }); }}>Resolve</Button>}
            </Card>))}</div>)}
      </div>
      <Modal open={!!t} onClose={() => setT(null)} title="Resolve dispute">
        <div className="space-y-4">
          <Field label="Decision"><Select value={f.decision} onChange={(e) => setF({ ...f, decision: e.target.value })}><option value="resolved">Accept the dispute</option><option value="rejected">Reject the dispute (restore job)</option></Select></Field>
          <Field label="Outcome for the job"><Select value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}><option value="completed">Mark job completed</option><option value="cancelled">Cancel the job</option><option value="refund">Refund customer and cancel</option></Select></Field>
          <Field label="Note to both parties"><Textarea maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setT(null)}>Cancel</Button><Button onClick={resolve}>Confirm</Button></div>
        </div>
      </Modal>
    </>
  );
}

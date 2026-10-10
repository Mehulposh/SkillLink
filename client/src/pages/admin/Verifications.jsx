import { useState } from "react";
import { BadgeCheck, ExternalLink } from "lucide-react";
import api, { errMsg, fileUrl } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, Card, Empty, ErrorBox, Modal, PageHeader, Spinner, Tabs, Textarea } from "../../components/ui";
import { fmtDate } from "../../lib/utils";

export default function AdminVerifications() {
  const toast = useToast(); const [status, setStatus] = useState("pending"); const [target, setTarget] = useState(null); const [note, setNote] = useState("");
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/verifications", { params: { status } }), [status]);
  const decide = async (decision) => {
    try { await api.post(`/admin/verifications/${target.userId}`, { decision, note: note || undefined }); toast(`Marked as ${decision}`); setTarget(null); setNote(""); reload(true); }
    catch (e) { toast(errMsg(e), "error"); }
  };
  const isPdf = (u) => u?.endsWith(".pdf");
  return (
    <>
      <PageHeader title="Worker verification" subtitle="IDs are private. The file is deleted as soon as you decide." />
      <Tabs value={status} onChange={setStatus} tabs={[{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }]} />
      <div className="mt-5">
        {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.verifications.length ? <Card><Empty icon={BadgeCheck} title="Nothing to review" /></Card> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.verifications.map((v) => (
              <Card key={v.userId} className="space-y-3">
                <div className="flex items-start justify-between"><div><p className="font-bold">{v.name}</p><p className="text-xs text-slate-500">{v.email}</p></div><Badge tone="sky">{v.docType?.replace("_", " ")}</Badge></div>
                <p className="text-sm text-slate-500">{v.specialized || "No skill listed"} · submitted {fmtDate(v.submittedAt)}</p>
                {v.documentUrl && (isPdf(v.documentUrl)
                  ? <a href={fileUrl(v.documentUrl)} target="_blank" rel="noreferrer" className="glass flex items-center gap-2 rounded-xl p-3 text-sm font-semibold"><ExternalLink size={16} /> Open PDF</a>
                  : <a href={fileUrl(v.documentUrl)} target="_blank" rel="noreferrer"><img src={fileUrl(v.documentUrl)} alt="ID document" className="h-44 w-full rounded-xl object-cover" /></a>)}
                {status === "pending" && <Button className="w-full" onClick={() => setTarget(v)}>Review</Button>}
              </Card>))}
          </div>)}
      </div>
      <Modal open={!!target} onClose={() => setTarget(null)} title={`Review ${target?.name}`}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">Check that the name and photo are clear and match the worker.</p>
        <Textarea placeholder="Note to the worker (required if rejecting)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2"><Button variant="danger" disabled={!note.trim()} onClick={() => decide("rejected")}>Reject</Button><Button variant="success" onClick={() => decide("approved")}>Approve</Button></div>
      </Modal>
    </>
  );
}

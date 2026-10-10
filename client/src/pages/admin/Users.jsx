import { useState } from "react";
import { Ban, Check, X } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useDebounced, useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Avatar, Badge, Button, Card, Empty, ErrorBox, Input, Modal, PageHeader, Pagination, Select, Spinner, Textarea } from "../../components/ui";
import { fmtDate } from "../../lib/utils";

export default function AdminUsers() {
  const toast = useToast();
  const [f, setF] = useState({ q: "", type: "", request: false }); const [page, setPage] = useState(1);
  const dq = useDebounced(f.q); const [target, setTarget] = useState(null); const [reason, setReason] = useState("");
  const { data, loading, error, reload } = useFetch(() => api.get("/admin/users", { params: { q: dq || undefined, type: f.type || undefined, request: f.request ? "yes" : undefined, page, limit: 20 } }), [dq, f.type, f.request, page]);
  const act = async (fn, ok) => { try { await fn(); toast(ok); setTarget(null); setReason(""); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <>
      <PageHeader title="Users" subtitle="Approve workers, block abusers" />
      <Card className="mb-5 grid gap-3 sm:grid-cols-3">
        <Input placeholder="Search name or email…" value={f.q} onChange={(e) => { setF({ ...f, q: e.target.value }); setPage(1); }} />
        <Select value={f.type} onChange={(e) => { setF({ ...f, type: e.target.value }); setPage(1); }}><option value="">All roles</option><option value="user">Customers</option><option value="worker">Workers</option><option value="admin">Admins</option></Select>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-indigo-500" checked={f.request} onChange={(e) => { setF({ ...f, request: e.target.checked }); setPage(1); }} /> Worker requests only</label>
      </Card>
      {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data.users.length ? <Card><Empty title="No users found" /></Card> : (
        <Card className="overflow-x-auto !p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">User</th><th>Role</th><th>Joined</th><th>Status</th><th className="pr-4 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-500/10">
              {data.users.map((u) => (
                <tr key={u._id}>
                  <td className="p-4"><div className="flex items-center gap-3"><Avatar user={u} size={36} /><div><p className="font-semibold">{u.name}</p><p className="text-xs text-slate-500">{u.email}</p></div></div></td>
                  <td><Badge tone={u.type === "admin" ? "violet" : u.type === "worker" ? "sky" : "slate"}>{u.type}</Badge>{u.request === "yes" && <Badge tone="amber" className="ml-1">wants worker</Badge>}</td>
                  <td className="text-slate-500">{fmtDate(u.createdAt)}</td>
                  <td>{u.isBlocked ? <Badge tone="rose">Blocked</Badge> : <Badge tone="emerald">Active</Badge>}</td>
                  <td className="pr-4"><div className="flex justify-end gap-2">
                    {u.request === "yes" && (<>
                      <Button size="sm" variant="success" onClick={() => act(() => api.post(`/admin/changetype/${u._id}`), "Approved as worker")}><Check size={14} /></Button>
                      <Button size="sm" variant="ghost" onClick={() => act(() => api.post(`/admin/users/${u._id}/reject-request`), "Request rejected")}><X size={14} /></Button></>)}
                    {u.type !== "admin" && (u.isBlocked
                      ? <Button size="sm" variant="soft" onClick={() => act(() => api.post(`/admin/users/${u._id}/block`, { blocked: false }), "User unblocked")}>Unblock</Button>
                      : <Button size="sm" variant="ghost" onClick={() => setTarget(u)}><Ban size={14} /> Block</Button>)}
                  </div></td>
                </tr>))}
            </tbody>
          </table>
        </Card>)}
      <Pagination pagination={data?.pagination} onPage={setPage} />
      <Modal open={!!target} onClose={() => setTarget(null)} title={`Block ${target?.name}?`}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">They will be logged out and unable to use the platform.</p>
        <Textarea placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        <div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => act(() => api.post(`/admin/users/${target._id}/block`, { blocked: true, reason: reason || undefined }), "User blocked")}>Block user</Button></div>
      </Modal>
    </>
  );
}

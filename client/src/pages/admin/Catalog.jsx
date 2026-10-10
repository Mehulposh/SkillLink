import { useState } from "react";
import { Plus } from "lucide-react";
import api, { errMsg } from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { useToast } from "../../context/ToastContext";
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Spinner, Tabs } from "../../components/ui";
import { fmtDate, money } from "../../lib/utils";

function Promos() {
  const toast = useToast(); const { data, loading, reload } = useFetch(() => api.get("/admin/promos"), []);
  const [f, setF] = useState({ code: "", type: "percent", value: "", maxDiscount: "", minAmount: "", maxUses: "", expiresAt: "" });
  const create = async (e) => {
    e.preventDefault();
    try {
      const body = { code: f.code, type: f.type, value: Number(f.value) };
      if (f.maxDiscount) body.maxDiscount = Number(f.maxDiscount); if (f.minAmount) body.minAmount = Number(f.minAmount);
      if (f.maxUses) body.maxUses = Number(f.maxUses); if (f.expiresAt) body.expiresAt = new Date(f.expiresAt).toISOString();
      await api.post("/admin/promos", body); toast("Promo created"); setF({ code: "", type: "percent", value: "", maxDiscount: "", minAmount: "", maxUses: "", expiresAt: "" }); reload(true);
    } catch (err) { toast(errMsg(err), "error"); }
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="h-fit space-y-3"><form onSubmit={create} className="space-y-3">
        <h3 className="font-bold">New promo code</h3>
        <Field label="Code"><Input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} pattern="[A-Za-z0-9_-]{3,30}" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Type"><Select value={f.type} onChange={set("type")}><option value="percent">Percent %</option><option value="flat">Flat ₹</option></Select></Field>
          <Field label="Value"><Input required type="number" min="1" max={f.type === "percent" ? 100 : undefined} value={f.value} onChange={set("value")} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Max discount ₹"><Input type="number" min="1" value={f.maxDiscount} onChange={set("maxDiscount")} /></Field><Field label="Min order ₹"><Input type="number" min="1" value={f.minAmount} onChange={set("minAmount")} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Max uses"><Input type="number" min="0" value={f.maxUses} onChange={set("maxUses")} placeholder="0 = unlimited" /></Field><Field label="Expires"><Input type="date" value={f.expiresAt} onChange={set("expiresAt")} /></Field></div>
        <Button className="w-full"><Plus size={16} /> Create</Button></form></Card>
      <div className="space-y-3 lg:col-span-2">
        {loading ? <Spinner /> : !data.promos.length ? <Card><Empty title="No promo codes yet" /></Card> : data.promos.map((p) => (
          <Card key={p._id} className="flex flex-wrap items-center justify-between gap-3 !p-4">
            <div><p className="font-mono text-lg font-extrabold tracking-wider">{p.code}</p>
              <p className="text-sm text-slate-500">{p.type === "percent" ? `${p.value}% off${p.maxDiscount ? ` (max ${money(p.maxDiscount)})` : ""}` : `${money(p.value)} off`} · used {p.usedCount}{p.maxUses ? `/${p.maxUses}` : ""}{p.expiresAt ? ` · expires ${fmtDate(p.expiresAt)}` : ""}{p.restrictedTo ? " · referral reward" : ""}</p></div>
            <div className="flex items-center gap-2"><Badge tone={p.active ? "emerald" : "slate"}>{p.active ? "Active" : "Disabled"}</Badge>
              <Button size="sm" variant="ghost" onClick={async () => { await api.patch(`/admin/promos/${p._id}`, { active: !p.active }); reload(true); }}>{p.active ? "Disable" : "Enable"}</Button></div>
          </Card>))}
      </div>
    </div>
  );
}

function Categories() {
  const toast = useToast(); const { data, loading, reload } = useFetch(() => api.get("/categories"), []); const [name, setName] = useState("");
  const add = async (e) => { e.preventDefault(); try { await api.post("/admin/categories", { name }); setName(""); toast("Category added"); reload(true); } catch (err) { toast(errMsg(err), "error"); } };
  const remove = async (c) => { try { await api.patch(`/admin/categories/${c._id}`, { active: false }); toast("Category hidden"); reload(true); } catch (err) { toast(errMsg(err), "error"); } };
  return (
    <Card className="max-w-2xl space-y-4">
      <form onSubmit={add} className="flex gap-2"><Input required minLength={2} maxLength={50} placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} /><Button>Add</Button></form>
      {loading ? <Spinner /> : <div className="flex flex-wrap gap-2">{data.categories.map((c) => (
        <span key={c.name} className="glass inline-flex items-center gap-2 rounded-full py-1.5 pl-4 pr-2 text-sm font-semibold">{c.name}
          {c._id && <button aria-label={`Hide ${c.name}`} onClick={() => remove(c)} className="grid h-5 w-5 place-items-center rounded-full bg-rose-500/15 text-xs text-rose-600">×</button>}</span>))}</div>}
      <p className="text-xs text-slate-500">Hiding a category removes it from new requests; existing jobs keep it.</p>
    </Card>
  );
}

function Payments() {
  const toast = useToast(); const [status, setStatus] = useState("paid");
  const { data, loading, reload } = useFetch(() => api.get("/admin/payments", { params: { status, limit: 30 } }), [status]);
  const refund = async (p) => { if (!window.confirm(`Refund ${money(p.amount)}?`)) return; try { await api.post(`/admin/payments/${p._id}/refund`); toast("Refunded"); reload(true); } catch (e) { toast(errMsg(e), "error"); } };
  return (
    <div className="space-y-4">
      <Tabs value={status} onChange={setStatus} tabs={["paid", "created", "refunded"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
      {loading ? <Spinner /> : !data.payments.length ? <Card><Empty title="No payments" /></Card> : (
        <Card className="overflow-x-auto !p-0"><table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="p-4">Invoice</th><th>Amount</th><th>Fee</th><th>Method</th><th>Date</th><th /></tr></thead>
          <tbody className="divide-y divide-slate-500/10">{data.payments.map((p) => (
            <tr key={p._id}><td className="p-4 font-mono text-xs">{p.invoiceNumber || "—"}</td><td className="font-semibold">{money(p.amount)}</td><td>{money(p.platformFee)}</td><td className="capitalize">{p.method}</td><td className="text-slate-500">{fmtDate(p.paidAt || p.createdAt)}</td>
              <td className="pr-4 text-right">{p.status === "paid" && <Button size="sm" variant="ghost" onClick={() => refund(p)}>Refund</Button>}</td></tr>))}</tbody></table></Card>)}
    </div>
  );
}

export default function AdminCatalog() {
  const [tab, setTab] = useState("promos");
  return (
    <>
      <PageHeader title="Promos, categories and payments" />
      <div className="mb-5"><Tabs value={tab} onChange={setTab} tabs={[{ value: "promos", label: "Promo codes" }, { value: "categories", label: "Categories" }, { value: "payments", label: "Payments" }]} /></div>
      {tab === "promos" ? <Promos /> : tab === "categories" ? <Categories /> : <Payments />}
    </>
  );
}

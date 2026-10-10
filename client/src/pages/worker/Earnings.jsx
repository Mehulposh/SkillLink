import { Clock, IndianRupee, Receipt, TrendingUp } from "lucide-react";
import api from "../../lib/api";
import { useFetch } from "../../lib/hooks";
import { BarChart, Card, ErrorBox, PageHeader, Spinner, Stat } from "../../components/ui";
import { money } from "../../lib/utils";

export default function Earnings() {
  const { data, loading, error, reload } = useFetch(() => api.get("/workers/me/earnings"), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const t = data.totals;
  const short = (m) => new Date(m + "-01").toLocaleString("en", { month: "short" });
  return (
    <>
      <PageHeader title="Earnings" subtitle="What you have made after the platform fee" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={IndianRupee} label="Net earnings" value={money(t.net)} tone="emerald" />
        <Stat icon={TrendingUp} label="Gross billed" value={money(t.gross)} />
        <Stat icon={Receipt} label="Platform fees" value={money(t.platformFees)} tone="amber" />
        <Stat icon={Clock} label="Awaiting payment" value={money(data.awaitingPayment.amount)} tone="violet" sub={`${data.awaitingPayment.jobs} completed job(s)`} />
      </div>
      <Card className="mt-6"><h3 className="mb-4 font-bold">Monthly earnings (last 12 months)</h3>
        <BarChart data={data.monthly.map((m) => ({ label: short(m.month), value: m.net }))} format={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)} color="from-emerald-500 to-teal-300" /></Card>
    </>
  );
}

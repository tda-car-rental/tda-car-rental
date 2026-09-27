import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { listDocs, type DocRow } from "@/lib/db";
import { AppLayout } from "@/components/AppLayout";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — TDA Billing & Quotation" },
      { name: "description", content: "Overview of recent billings and quotations for TDA Car Rental Services." },
      { property: "og:title", content: "TDA Dashboard" },
      { property: "og:description", content: "Overview of recent billings and quotations." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  useEffect(() => { listDocs().then(setDocs).catch(console.error); }, []);

  const billings = docs.filter((d) => d.doc_type === "billing");
  const quotations = docs.filter((d) => d.doc_type === "quotation");
  const acknowledgements = docs.filter((d) => d.doc_type === "acknowledgement");

  const chartData = useMemo(() => {
    // Aggregate last 6 months by created_at
    const now = new Date();
    const months: { key: string; label: string; billing: number; quotation: number; acknowledgement: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      months.push({ key, label: d.toLocaleString("en-US", { month: "short" }), billing: 0, quotation: 0, acknowledgement: 0 });
    }
    docs.forEach((doc) => {
      const dt = new Date(doc.created_at);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      const bucket = months.find((m) => m.key === key);
      if (bucket) bucket[doc.doc_type] += Number(doc.total) || 0;
    });
    return months;
  }, [docs]);

  const totalBilling = billings.reduce((s, d) => s + Number(d.total || 0), 0);
  const totalQuote = quotations.reduce((s, d) => s + Number(d.total || 0), 0);
  const totalAck = acknowledgements.reduce((s, d) => s + Number(d.ack_amount || d.total || 0), 0);

  return (
    <AppLayout title="Dashboard">
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Stat label="Total Billings" value={billings.length.toString()} sub={`PHP ${totalBilling.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} />
        <Stat label="Total Quotations" value={quotations.length.toString()} sub={`PHP ${totalQuote.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} />
        <Stat label="Acknowledgement Receipts" value={acknowledgements.length.toString()} sub={`PHP ${totalAck.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-semibold mb-4">Revenue by Month</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => `PHP ${v.toLocaleString("en-PH")}`} />
                <Bar dataKey="billing" fill="var(--color-chart-1)" name="Billing" />
                <Bar dataKey="quotation" fill="var(--color-chart-2)" name="Quotation" />
                <Bar dataKey="acknowledgement" fill="var(--color-chart-3)" name="Acknowledgement" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="space-y-6">
          <RecentList title="Recent Billings" docs={billings.slice(0, 5)} to="/billing" emptyLabel="No billings yet." nameKey="billed_to" />
          <RecentList title="Recent Quotations" docs={quotations.slice(0, 5)} to="/quotation" emptyLabel="No quotations yet." nameKey="requestor" />
          <RecentList title="Recent Acknowledgements" docs={acknowledgements.slice(0, 5)} to="/acknowledgement-receipts" emptyLabel="No acknowledgement receipts yet." nameKey="ack_received_by" />
        </div>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}

function RecentList({
  title, docs, to, emptyLabel, nameKey,
}: {
  title: string; docs: DocRow[]; to: "/billing" | "/quotation" | "/acknowledgement-receipts"; emptyLabel: string; nameKey: "billed_to" | "requestor" | "ack_received_by";
}) {
  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        <Link to={to} className="text-xs text-muted-foreground hover:text-foreground">View all →</Link>
      </div>
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
              <div className="min-w-0">
                <div className="truncate font-medium">{d[nameKey] || "—"}</div>
                <div className="text-xs text-muted-foreground">{d.doc_date}</div>
              </div>
              <div className="text-xs font-medium">PHP {Number(d.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

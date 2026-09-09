import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, shortDate, titleCase } from "@/lib/format";
import { daysOverdue, invoiceLineAmount, invoiceTotals, sumPayments } from "@/lib/finance";

export const Route = createFileRoute("/_portal/portal/billing")({
  head: () => ({
    meta: [
      { title: "Invoices & receipts — Samak Landscape portal" },
      {
        name: "description",
        content:
          "View your Samak Landscape invoices line by line, with GST, retention, advance adjustment and every receipt recorded against them.",
      },
      { property: "og:title", content: "Invoices & receipts — Samak Landscape portal" },
      {
        property: "og:description",
        content: "Every invoice and receipt on your landscape projects, in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalBilling,
});

function PortalBilling() {
  const query = useQuery({
    queryKey: ["portal-billing"],
    queryFn: async () => {
      const [invoices, payments] = await Promise.all([
        supabase
          .from("invoices")
          .select(
            "id, invoice_code, title, invoice_type, invoice_date, due_date, tax_percent, retention_percent, advance_adjusted, approval_state, notes, projects(project_code, name), invoice_items(id, description, uom, quantity, unit_rate, sort_order)",
          )
          .eq("is_archived", false)
          .order("invoice_date", { ascending: false }),
        supabase
          .from("payments")
          .select(
            "id, payment_code, amount, paid_on, mode, reference, invoice_id, remarks, direction, invoices(invoice_code)",
          )
          .eq("direction", "inbound")
          .order("paid_on", { ascending: false }),
      ]);
      if (invoices.error) throw invoices.error;
      if (payments.error) throw payments.error;
      return { invoices: invoices.data ?? [], payments: payments.data ?? [] };
    },
  });

  if (query.isLoading) return <LoadingState label="Loading your billing…" />;
  if (query.error) return <ErrorState message="We could not load your billing right now." />;
  const { invoices, payments } = query.data!;

  const totalOf = (inv: (typeof invoices)[number]) =>
    invoiceTotals(inv.invoice_items ?? [], {
      tax_percent: inv.tax_percent,
      retention_percent: inv.retention_percent,
      advance_adjusted: inv.advance_adjusted,
    });
  const receivedFor = (invoiceId: string) =>
    sumPayments(payments.filter((p) => p.invoice_id === invoiceId));

  const billed = invoices.reduce((s, inv) => s + totalOf(inv).net, 0);
  const received = sumPayments(payments);
  const overdue = invoices.reduce((s, inv) => {
    const due = totalOf(inv).net - receivedFor(inv.id);
    return daysOverdue(inv.due_date, due) > 0 ? s + due : s;
  }, 0);

  return (
    <>
      <PageHeader
        title="Invoices & receipts"
        description="Everything we have billed you, what you have paid and what is still open."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Invoices" value={String(invoices.length)} />
        <StatCard label="Billed" value={inr(billed, true)} />
        <StatCard label="Received" value={inr(received, true)} tone="success" />
        <StatCard
          label="Overdue"
          value={inr(overdue, true)}
          tone={overdue > 0 ? "danger" : "success"}
        />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4 pt-4">
          {invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            invoices.map((inv) => {
              const totals = totalOf(inv);
              const paid = receivedFor(inv.id);
              const due = totals.net - paid;
              const late = daysOverdue(inv.due_date, due);
              return (
                <article key={inv.id} className="rounded-xl border border-border bg-card">
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                    <div>
                      <p className="font-display font-semibold">{inv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoice_code} · {titleCase(inv.invoice_type)} ·{" "}
                        {inv.projects?.name ?? "—"} · raised {shortDate(inv.invoice_date)} · due{" "}
                        {shortDate(inv.due_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-numeric font-display text-lg font-semibold">
                        {inr(totals.net)}
                      </p>
                      <StatusBadge value={late > 0 ? "critical" : inv.approval_state} />
                      {late > 0 ? (
                        <p className="mt-1 text-xs text-destructive">{late} days overdue</p>
                      ) : null}
                    </div>
                  </header>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Description</th>
                          <th className="px-4 py-2 text-right font-medium">Qty</th>
                          <th className="px-4 py-2 text-left font-medium">Unit</th>
                          <th className="px-4 py-2 text-right font-medium">Rate</th>
                          <th className="px-4 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(inv.invoice_items ?? []).map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2">{item.description}</td>
                            <td className="text-numeric px-4 py-2 text-right">{item.quantity}</td>
                            <td className="px-4 py-2">{item.uom ?? "—"}</td>
                            <td className="text-numeric px-4 py-2 text-right">
                              {inr(item.unit_rate)}
                            </td>
                            <td className="text-numeric px-4 py-2 text-right">
                              {inr(invoiceLineAmount(item))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <dl className="grid gap-2 border-t border-border p-4 text-sm sm:grid-cols-3 lg:grid-cols-5">
                    <Line label="Subtotal" value={inr(totals.basic)} />
                    <Line label={`GST ${inv.tax_percent ?? 0}%`} value={inr(totals.tax)} />
                    <Line
                      label={`Retention ${inv.retention_percent ?? 0}%`}
                      value={`− ${inr(totals.retention)}`}
                    />
                    <Line label="Advance adjusted" value={`− ${inr(inv.advance_adjusted)}`} />
                    <Line label="Balance due" value={inr(due)} strong />
                  </dl>
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="receipts" className="pt-4">
          {payments.length === 0 ? (
            <EmptyState title="No receipts recorded yet" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Receipt</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Against invoice</th>
                    <th className="px-4 py-2 text-left font-medium">Mode</th>
                    <th className="px-4 py-2 text-left font-medium">Reference</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 font-medium">{p.payment_code}</td>
                      <td className="px-4 py-2">{shortDate(p.paid_on)}</td>
                      <td className="px-4 py-2">{p.invoices?.invoice_code ?? "—"}</td>
                      <td className="px-4 py-2">{titleCase(p.mode)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.reference ?? "—"}</td>
                      <td className="text-numeric px-4 py-2 text-right font-medium">
                        {inr(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-numeric font-display font-semibold" : "text-numeric"}>
        {value}
      </dd>
    </div>
  );
}

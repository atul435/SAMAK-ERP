import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, shortDate, titleCase } from "@/lib/format";
import { poLineAmount, poTotals } from "@/lib/procurement";

export const Route = createFileRoute("/_portal/portal/orders")({
  head: () => ({
    meta: [
      { title: "Purchase orders — Samak Landscape partner portal" },
      {
        name: "description",
        content:
          "Supply partners can review Samak Landscape purchase orders line by line, see delivered quantities and track payments released.",
      },
      { property: "og:title", content: "Purchase orders — Samak Landscape partner portal" },
      {
        property: "og:description",
        content: "Your orders, delivered quantities and payments with Samak Landscape.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalOrders,
});

function PortalOrders() {
  const query = useQuery({
    queryKey: ["portal-orders"],
    queryFn: async () => {
      const [orders, payments] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select(
            "id, po_code, title, expected_date, delivery_address, notes, tax_percent, freight_amount, approval_state, status, projects(project_code, name), purchase_order_items(id, description, uom, quantity, unit_rate, received_quantity, sort_order)",
          )
          .eq("is_archived", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select(
            "id, payment_code, amount, paid_on, mode, reference, tds_amount, remarks, direction, purchase_order_id, purchase_orders(po_code)",
          )
          .eq("direction", "outbound")
          .order("paid_on", { ascending: false }),
      ]);
      if (orders.error) throw orders.error;
      if (payments.error) throw payments.error;
      return { orders: orders.data ?? [], payments: payments.data ?? [] };
    },
  });

  if (query.isLoading) return <LoadingState label="Loading your orders…" />;
  if (query.error) return <ErrorState message="We could not load your orders right now." />;
  const { orders, payments } = query.data!;

  const totalOf = (po: (typeof orders)[number]) =>
    poTotals(po.purchase_order_items ?? [], {
      tax_percent: po.tax_percent,
      freight_amount: po.freight_amount,
    });

  const ordered = orders
    .filter((o) => o.approval_state === "approved")
    .reduce((s, o) => s + totalOf(o).grand, 0);
  const paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Purchase orders"
        description="Orders raised to you, what we have received on site and every payment released."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Orders" value={String(orders.length)} />
        <StatCard label="Approved value" value={inr(ordered, true)} />
        <StatCard label="Paid" value={inr(paid, true)} tone="success" />
        <StatCard
          label="Outstanding"
          value={inr(Math.max(0, ordered - paid), true)}
          tone={ordered - paid > 0 ? "warning" : "success"}
        />
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4 pt-4">
          {orders.length === 0 ? (
            <EmptyState
              title="No purchase orders yet"
              description="Orders raised to you by Samak Landscape will appear here."
            />
          ) : (
            orders.map((po) => {
              const totals = totalOf(po);
              return (
                <article key={po.id} className="rounded-xl border border-border bg-card">
                  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                    <div>
                      <p className="font-display font-semibold">{po.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {po.po_code} · {po.projects?.name ?? "General"} · delivery by{" "}
                        {shortDate(po.expected_date)}
                      </p>
                      {po.delivery_address ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Deliver to: {po.delivery_address}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-numeric font-display text-lg font-semibold">
                        {inr(totals.grand)}
                      </p>
                      <StatusBadge value={po.approval_state} />
                    </div>
                  </header>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Item</th>
                          <th className="px-4 py-2 text-left font-medium">Unit</th>
                          <th className="px-4 py-2 text-right font-medium">Ordered</th>
                          <th className="px-4 py-2 text-right font-medium">Received</th>
                          <th className="px-4 py-2 text-right font-medium">Rate</th>
                          <th className="px-4 py-2 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(po.purchase_order_items ?? []).map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-2">{item.description}</td>
                            <td className="px-4 py-2">{item.uom ?? "—"}</td>
                            <td className="text-numeric px-4 py-2 text-right">{item.quantity}</td>
                            <td className="text-numeric px-4 py-2 text-right">
                              {item.received_quantity ?? 0}
                            </td>
                            <td className="text-numeric px-4 py-2 text-right">
                              {inr(item.unit_rate)}
                            </td>
                            <td className="text-numeric px-4 py-2 text-right">
                              {inr(poLineAmount(item))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <dl className="grid gap-2 border-t border-border p-4 text-sm sm:grid-cols-4">
                    <Line label="Subtotal" value={inr(totals.basic)} />
                    <Line label={`GST ${po.tax_percent ?? 0}%`} value={inr(totals.tax)} />
                    <Line label="Freight" value={inr(po.freight_amount)} />
                    <Line label="Order total" value={inr(totals.grand)} strong />
                  </dl>

                  {po.notes ? (
                    <p className="border-t border-border p-4 text-sm text-muted-foreground">
                      {po.notes}
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="payments" className="pt-4">
          {payments.length === 0 ? (
            <EmptyState title="No payments released yet" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Payment</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Against order</th>
                    <th className="px-4 py-2 text-left font-medium">Mode</th>
                    <th className="px-4 py-2 text-left font-medium">Reference</th>
                    <th className="px-4 py-2 text-right font-medium">TDS</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="px-4 py-2 font-medium">{p.payment_code}</td>
                      <td className="px-4 py-2">{shortDate(p.paid_on)}</td>
                      <td className="px-4 py-2">{p.purchase_orders?.po_code ?? "—"}</td>
                      <td className="px-4 py-2">{titleCase(p.mode)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{p.reference ?? "—"}</td>
                      <td className="text-numeric px-4 py-2 text-right">{inr(p.tds_amount)}</td>
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

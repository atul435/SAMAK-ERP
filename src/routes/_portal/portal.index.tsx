import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/lib/portal-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { inr, pct, shortDate } from "@/lib/format";
import { invoiceTotals, sumPayments } from "@/lib/finance";
import { poTotals } from "@/lib/procurement";

export const Route = createFileRoute("/_portal/portal/")({
  head: () => ({
    meta: [
      { title: "Your portal — Samak Landscape" },
      {
        name: "description",
        content:
          "Secure portal for Samak Landscape clients and supply partners: project progress, invoices, receipts, purchase orders and payments.",
      },
      { property: "og:title", content: "Your portal — Samak Landscape" },
      {
        property: "og:description",
        content: "Track your projects, billing and orders with Samak Landscape.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalHome,
});

function PortalHome() {
  const portal = usePortalUser();
  return portal.portal_type === "client" ? <ClientHome /> : <VendorHome />;
}

function ClientHome() {
  const portal = usePortalUser();

  const query = useQuery({
    queryKey: ["portal-client-home"],
    queryFn: async () => {
      const [projects, invoices, payments, reports] = await Promise.all([
        supabase
          .from("projects")
          .select(
            "id, project_code, name, city, contract_value, progress_percent, health, status, end_date",
          )
          .eq("is_archived", false)
          .order("project_code"),
        supabase
          .from("invoices")
          .select(
            "id, invoice_code, title, invoice_date, due_date, tax_percent, retention_percent, advance_adjusted, approval_state, invoice_items(quantity, unit_rate)",
          )
          .eq("is_archived", false)
          .order("invoice_date", { ascending: false }),
        supabase
          .from("payments")
          .select("id, payment_code, amount, paid_on, mode, reference, invoice_id, direction")
          .eq("direction", "inbound")
          .order("paid_on", { ascending: false }),
        supabase
          .from("site_reports")
          .select(
            "id, project_id, report_date, weather, work_done, planned_next, blockers, progress_percent, approval_state",
          )
          .order("report_date", { ascending: false })
          .limit(8),
      ]);
      if (projects.error) throw projects.error;
      if (invoices.error) throw invoices.error;
      if (payments.error) throw payments.error;
      if (reports.error) throw reports.error;
      return {
        projects: projects.data ?? [],
        invoices: invoices.data ?? [],
        payments: payments.data ?? [],
        reports: reports.data ?? [],
      };
    },
  });

  if (query.isLoading) return <LoadingState label="Loading your account…" />;
  if (query.error) return <ErrorState message="We could not load your account right now." />;
  const { projects, invoices, payments, reports } = query.data!;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? "Project";

  const billed = invoices.reduce(
    (sum, inv) =>
      sum +
      invoiceTotals(inv.invoice_items ?? [], {
        tax_percent: inv.tax_percent,
        retention_percent: inv.retention_percent,
        advance_adjusted: inv.advance_adjusted,
      }).net,
    0,
  );
  const received = sumPayments(payments);
  const contract = projects.reduce((s, p) => s + Number(p.contract_value ?? 0), 0);

  return (
    <>
      <PageHeader
        title={`Welcome, ${portal.full_name.split(" ")[0]}`}
        description="Your live projects with Samak Landscape, what has been billed and what we have received."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live projects" value={String(projects.length)} />
        <StatCard label="Contract value" value={inr(contract, true)} />
        <StatCard label="Billed to date" value={inr(billed, true)} />
        <StatCard
          label="Balance due"
          value={inr(billed - received, true)}
          tone={billed - received > 0 ? "warning" : "success"}
          hint={`${inr(received, true)} received`}
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Project progress</h2>
        {projects.length === 0 ? (
          <EmptyState title="No projects yet" description="Your projects will appear here once work is awarded." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.project_code} · {p.city ?? "—"}
                    </p>
                  </div>
                  <StatusBadge value={p.health ?? p.status} />
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Number(p.progress_percent ?? 0))}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>{pct(p.progress_percent)} complete</span>
                  <span>Target {shortDate(p.end_date)}</span>
                </div>
                <Link
                  to="/portal/projects"
                  className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                >
                  View site updates
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Latest site updates</h2>
          <Link to="/portal/projects" className="text-sm font-medium text-primary hover:underline">
            Full site diary
          </Link>
        </div>
        {reports.length === 0 ? (
          <EmptyState title="No site updates yet" description="Daily reports from your sites will appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {reports.slice(0, 6).map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {projectName(r.project_id)} · {shortDate(r.report_date)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {r.work_done ?? "Work update logged"}
                    {r.blockers ? ` — blocker: ${r.blockers}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-numeric text-xs text-muted-foreground">
                    {pct(r.progress_percent)}
                  </span>
                  <StatusBadge value={r.approval_state} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Recent invoices</h2>
          <Link to="/portal/billing" className="text-sm font-medium text-primary hover:underline">
            All invoices & receipts
          </Link>
        </div>
        {invoices.length === 0 ? (
          <EmptyState title="No invoices yet" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {invoices.slice(0, 5).map((inv) => {
              const total = invoiceTotals(inv.invoice_items ?? [], {
                tax_percent: inv.tax_percent,
                retention_percent: inv.retention_percent,
                advance_adjusted: inv.advance_adjusted,
              }).net;
              return (
                <li key={inv.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">{inv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.invoice_code} · raised {shortDate(inv.invoice_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-numeric font-medium">{inr(total)}</p>
                    <StatusBadge value={inv.approval_state} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function VendorHome() {
  const portal = usePortalUser();

  const query = useQuery({
    queryKey: ["portal-vendor-home"],
    queryFn: async () => {
      const [orders, payments, coverage] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select(
            "id, po_code, title, expected_date, tax_percent, freight_amount, approval_state, status, projects(project_code, name), purchase_order_items(id, description, uom, quantity, unit_rate, received_quantity)",
          )
          .eq("is_archived", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("id, payment_code, amount, paid_on, mode, reference, tds_amount, direction")
          .eq("direction", "outbound")
          .order("paid_on", { ascending: false }),
        supabase.rpc("vendor_estimate_coverage"),
      ]);
      if (orders.error) throw orders.error;
      if (payments.error) throw payments.error;
      if (coverage.error) throw coverage.error;
      return {
        orders: orders.data ?? [],
        payments: payments.data ?? [],
        coverage: (coverage.data ?? []) as Array<{
          po_item_id: string;
          po_code: string;
          project_id: string | null;
          project_code: string | null;
          project_name: string | null;
          description: string | null;
          uom: string | null;
          required_quantity: number | null;
          wastage_percent: number | null;
          ordered_quantity: number | null;
          received_quantity: number | null;
        }>,
      };
    },
  });

  if (query.isLoading) return <LoadingState label="Loading your orders…" />;
  if (query.error) return <ErrorState message="We could not load your orders right now." />;
  const { orders, payments, coverage } = query.data!;

  const approved = orders.filter((o) => o.approval_state === "approved");
  const ordered = approved.reduce(
    (sum, o) =>
      sum +
      poTotals(o.purchase_order_items ?? [], {
        tax_percent: o.tax_percent,
        freight_amount: o.freight_amount,
      }).grand,
    0,
  );
  const paid = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  const openOrders = orders.filter(
    (o) => !["executed", "rejected", "cancelled"].includes(o.approval_state),
  );
  const pendingItems = orders
    .flatMap((po) =>
      (po.purchase_order_items ?? [])
        .filter((i) => Number(i.quantity) > Number(i.received_quantity ?? 0))
        .map((i) => ({ po, item: i, remaining: Number(i.quantity) - Number(i.received_quantity ?? 0) })),
    )
    .filter((x) => ["approved", "executed"].includes(x.po.approval_state));

  // Stock this vendor has delivered and is currently held on site / in store
  const delivered = orders.flatMap((po) =>
    (po.purchase_order_items ?? [])
      .filter((i) => Number(i.received_quantity ?? 0) > 0)
      .map((i) => ({
        key: i.id,
        description: i.description,
        uom: i.uom,
        received: Number(i.received_quantity ?? 0),
        project: po.projects?.name ?? "Central store",
        poCode: po.po_code,
      })),
  );

  const coverageByProject = new Map<
    string,
    { name: string; lines: Array<(typeof coverage)[number] & { coverPct: number }> }
  >();
  for (const row of coverage) {
    const key = row.project_id ?? "general";
    const required =
      Number(row.required_quantity ?? 0) * (1 + Number(row.wastage_percent ?? 0) / 100);
    const coverPct = required > 0 ? Math.min(100, (Number(row.ordered_quantity ?? 0) / required) * 100) : 0;
    const entry = coverageByProject.get(key) ?? {
      name: row.project_name ?? "General",
      lines: [],
    };
    entry.lines.push({ ...row, coverPct });
    coverageByProject.set(key, entry);
  }

  return (
    <>
      <PageHeader
        title={`Welcome, ${portal.full_name.split(" ")[0]}`}
        description="Your purchase orders from Samak Landscape and the payments released against them."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open orders" value={String(openOrders.length)} />
        <StatCard label="Order value" value={inr(ordered, true)} />
        <StatCard label="Paid to you" value={inr(paid, true)} />
        <StatCard
          label="Outstanding"
          value={inr(Math.max(0, ordered - paid), true)}
          tone={ordered - paid > 0 ? "warning" : "success"}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Open purchase orders</h2>
          <Link to="/portal/orders" className="text-sm font-medium text-primary hover:underline">
            All orders
          </Link>
        </div>
        {openOrders.length === 0 ? (
          <EmptyState title="No open orders" description="New orders raised to you will appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {openOrders.map((po) => {
              const totals = poTotals(po.purchase_order_items ?? [], {
                tax_percent: po.tax_percent,
                freight_amount: po.freight_amount,
              });
              const remaining = (po.purchase_order_items ?? []).reduce(
                (s, i) => s + Math.max(0, Number(i.quantity) - Number(i.received_quantity ?? 0)),
                0,
              );
              return (
                <li key={po.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div>
                    <p className="font-medium">{po.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {po.po_code} · {po.projects?.name ?? "General"} · delivery by{" "}
                      {shortDate(po.expected_date)}
                      {remaining > 0 ? ` · ${remaining} units still to supply` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-numeric font-medium">{inr(totals.grand)}</p>
                    <StatusBadge value={po.approval_state} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {pendingItems.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {pendingItems.length} order lines still have quantities pending delivery — see each
            order for line-wise detail.
          </p>
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Stock supplied, held on site</h2>
        {delivered.length === 0 ? (
          <EmptyState
            title="Nothing received yet"
            description="Material we receive from you at our stores and sites will appear here."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Item</th>
                  <th className="px-4 py-2 text-left font-medium">Held at</th>
                  <th className="px-4 py-2 text-left font-medium">Against order</th>
                  <th className="px-4 py-2 text-right font-medium">Quantity on hand</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {delivered.map((d) => (
                  <tr key={d.key}>
                    <td className="px-4 py-2">{d.description}</td>
                    <td className="px-4 py-2 text-muted-foreground">{d.project}</td>
                    <td className="px-4 py-2 text-muted-foreground">{d.poCode}</td>
                    <td className="text-numeric px-4 py-2 text-right font-medium">
                      {d.received} {d.uom ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Estimate coverage by project</h2>
        <p className="text-xs text-muted-foreground">
          How much of each project's estimated requirement your orders cover.
        </p>
        {coverageByProject.size === 0 ? (
          <EmptyState
            title="No estimate linkage yet"
            description="When your orders are linked to project estimate lines, coverage will show here."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {[...coverageByProject.values()].map((group) => (
              <div key={group.name} className="space-y-3 rounded-xl border border-border bg-card p-4">
                <p className="font-medium">{group.name}</p>
                {group.lines.map((line) => (
                  <div key={line.po_item_id}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{line.description}</span>
                      <span className="text-numeric shrink-0 text-xs text-muted-foreground">
                        {line.ordered_quantity ?? 0} of{" "}
                        {Math.round(
                          Number(line.required_quantity ?? 0) *
                            (1 + Number(line.wastage_percent ?? 0) / 100),
                        )}{" "}
                        {line.uom ?? ""}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${line.coverPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Latest purchase orders</h2>
          <Link to="/portal/orders" className="text-sm font-medium text-primary hover:underline">
            All orders
          </Link>
        </div>
        {orders.length === 0 ? (
          <EmptyState title="No purchase orders yet" description="Orders raised to you will appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {orders.slice(0, 5).map((po) => (
              <li key={po.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{po.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {po.po_code} · delivery by {shortDate(po.expected_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-numeric font-medium">
                    {inr(
                      poTotals(po.purchase_order_items ?? [], {
                        tax_percent: po.tax_percent,
                        freight_amount: po.freight_amount,
                      }).grand,
                    )}
                  </p>
                  <StatusBadge value={po.approval_state} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Recent payments</h2>
        {payments.length === 0 ? (
          <EmptyState title="No payments released yet" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {payments.slice(0, 6).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{p.payment_code}</p>
                  <p className="text-xs text-muted-foreground">
                    {shortDate(p.paid_on)} · {p.mode ?? "—"} · {p.reference ?? "no reference"}
                  </p>
                </div>
                <p className="text-numeric font-medium">{inr(p.amount)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, shortDate, titleCase } from "@/lib/format";
import {
  poTotals,
  stockBalances,
  VENDOR_CATEGORIES,
  MATCH_STATUS_LABEL,
  MATCH_STATUS_TONE,
  type MatchStatus,
} from "@/lib/procurement";

export const Route = createFileRoute("/_authenticated/procurement/")({
  head: () => ({
    meta: [
      { title: "Procurement — EnvironIQ" },
      {
        name: "description",
        content:
          "Purchase orders raised against approved estimates, with vendor register, order values, approval state and delivery progress.",
      },
      { property: "og:title", content: "Procurement — EnvironIQ" },
      {
        property: "og:description",
        content: "Purchase orders linked to BOQ lines, vendors and project deliveries.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProcurementRegister,
});

type NewPoForm = {
  title: string;
  vendorId: string;
  boqId: string;
  expectedDate: string;
  notes: string;
  seedFromBoq: boolean;
  seedKind: string;
};

type NewVendorForm = {
  name: string;
  category: string;
  city: string;
  contactName: string;
  phone: string;
  email: string;
  gstin: string;
  paymentTerms: string;
};

function ProcurementRegister() {
  const { can, employee } = useAuth();
  const canEdit = can("procurement", "edit");
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [state, setState] = useState("all");
  const [poOpen, setPoOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          "id, po_code, title, expected_date, tax_percent, freight_amount, approval_state, status, updated_at, vendors(name, vendor_code), projects(name, project_code), boqs(boq_code), purchase_order_items(quantity, unit_rate, received_quantity)",
        )
        .eq("is_archived", false)
        .order("po_code");
      if (error) throw error;
      return data;
    },
  });

  const vendorsQuery = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select(
          "id, vendor_code, name, category, city, contact_name, phone, email, gstin, payment_terms, rating, is_approved",
        )
        .eq("is_archived", false)
        .order("vendor_code");
      if (error) throw error;
      return data;
    },
  });

  const registrationsQuery = useQuery({
    queryKey: ["vendor-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_registrations")
        .select(
          "id, business_name, category, gstin, pan, contact_name, email, phone, city, state, address, bank_name, account_number, ifsc, payment_terms, supplies, notes, review_state, review_notes, vendor_id, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const matchQuery = useQuery({
    queryKey: ["po-three-way-match"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("po_three_way_match")
        .select("purchase_order_id, match_status, ordered_amount, received_amount, billed_amount");
      if (error) throw error;
      return data ?? [];
    },
  });
  const matchByPo = useMemo(
    () => new Map((matchQuery.data ?? []).map((m) => [m.purchase_order_id, m])),
    [matchQuery.data],
  );

  const billsQuery = useQuery({
    queryKey: ["vendor-bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_bills")
        .select(
          "id, purchase_order_id, bill_number, bill_date, due_date, taxable_amount, tax_percent, total_amount, review_state, review_notes, notes, attachment_url, vendors(name, vendor_code), purchase_orders(po_code, title), projects(project_code, name)",
        )
        .order("bill_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const boqsQuery = useQuery({
    queryKey: ["boqs-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boqs")
        .select("id, boq_code, title, project_id, approval_state, projects(project_code)")
        .eq("is_archived", false)
        .order("boq_code");
      if (error) throw error;
      return data;
    },
  });

  const stockQuery = useQuery({
    queryKey: ["procurement-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select(
          "movement_type, quantity, unit_rate, uom, description, material_id, species_id, store_id, stores(name)",
        );
      if (error) throw error;
      return data;
    },
  });

  const coverageQuery = useQuery({
    queryKey: ["procurement-coverage"],
    queryFn: async () => {
      const [boqItemsRes, poItemsRes] = await Promise.all([
        supabase
          .from("boq_items")
          .select(
            "id, boq_id, description, uom, quantity, wastage_percent, unit_rate, boqs!inner(id, is_archived, approval_state, project_id, projects(name, project_code))",
          )
          .eq("boqs.is_archived", false)
          .eq("boqs.approval_state", "approved"),
        supabase
          .from("purchase_order_items")
          .select(
            "boq_item_id, quantity, unit_rate, purchase_orders!inner(is_archived, approval_state)",
          )
          .not("boq_item_id", "is", null)
          .eq("purchase_orders.is_archived", false)
          .in("purchase_orders.approval_state", ["approved", "executed", "pending_approval"]),
      ]);
      if (boqItemsRes.error) throw boqItemsRes.error;
      if (poItemsRes.error) throw poItemsRes.error;
      return { boqItems: boqItemsRes.data, poItems: poItemsRes.data };
    },
  });

  const createPo = useMutation({
    mutationFn: async (form: NewPoForm) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const boq = (boqsQuery.data ?? []).find((b) => b.id === form.boqId);
      const next = (ordersQuery.data ?? []).length + 1;
      const { data: po, error } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: employee.company_id,
          po_code: `PO-${String(next).padStart(4, "0")}`,
          title: form.title,
          vendor_id: form.vendorId || null,
          boq_id: boq?.id ?? null,
          project_id: boq?.project_id ?? null,
          expected_date: form.expectedDate || null,
          notes: form.notes || null,
          requested_by: employee.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (form.seedFromBoq && boq) {
        let itemsQuery = supabase
          .from("boq_items")
          .select(
            "id, description, uom, quantity, wastage_percent, unit_rate, item_kind, material_id, species_id",
          )
          .eq("boq_id", boq.id);
        if (form.seedKind !== "all") itemsQuery = itemsQuery.eq("item_kind", form.seedKind);
        const { data: items, error: itemsError } = await itemsQuery;
        if (itemsError) throw itemsError;
        if (items && items.length > 0) {
          const { error: insertError } = await supabase.from("purchase_order_items").insert(
            items.map((i, index) => ({
              purchase_order_id: po.id,
              boq_item_id: i.id,
              material_id: i.material_id,
              species_id: i.species_id,
              description: i.description,
              uom: i.uom,
              quantity: Number(i.quantity ?? 0) * (1 + Number(i.wastage_percent ?? 0) / 100),
              unit_rate: Number(i.unit_rate ?? 0),
              sort_order: index + 1,
            })),
          );
          if (insertError) throw insertError;
        }
      }
      return po;
    },
    onSuccess: () => {
      toast.success("Purchase order created");
      setPoOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createVendor = useMutation({
    mutationFn: async (form: NewVendorForm) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const next = (vendorsQuery.data ?? []).length + 1;
      const { error } = await supabase.from("vendors").insert({
        company_id: employee.company_id,
        vendor_code: `VEN-${String(next).padStart(4, "0")}`,
        name: form.name,
        category: form.category,
        city: form.city || null,
        contact_name: form.contactName || null,
        phone: form.phone || null,
        email: form.email || null,
        gstin: form.gstin || null,
        payment_terms: form.paymentTerms || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor added");
      setVendorOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewRegistration = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      const reg = (registrationsQuery.data ?? []).find((r) => r.id === id);
      if (!reg) throw new Error("Registration not found");
      if (!employee) throw new Error("Your employee record is missing.");
      if (!approve) {
        const { error } = await supabase
          .from("vendor_registrations")
          .update({ review_state: "rejected", reviewed_by: employee.id })
          .eq("id", id);
        if (error) throw error;
        return;
      }
      const next = (vendorsQuery.data ?? []).length + 1;
      const { data: vendor, error: vendorError } = await supabase
        .from("vendors")
        .insert({
          company_id: employee.company_id,
          vendor_code: `VEN-${String(next).padStart(4, "0")}`,
          name: reg.business_name,
          category: reg.category,
          gstin: reg.gstin,
          pan: reg.pan,
          address: reg.address,
          city: reg.city,
          state: reg.state,
          contact_name: reg.contact_name,
          email: reg.email,
          phone: reg.phone,
          payment_terms: reg.payment_terms,
          is_approved: true,
        })
        .select("id")
        .single();
      if (vendorError) throw vendorError;
      if (reg.bank_name || reg.account_number || reg.ifsc) {
        const { error: bankError } = await supabase.from("vendor_bank_details").insert({
          vendor_id: vendor.id,
          company_id: employee.company_id,
          bank_name: reg.bank_name,
          account_number: reg.account_number,
          ifsc: reg.ifsc,
        });
        if (bankError) throw bankError;
      }
      const { error } = await supabase
        .from("vendor_registrations")
        .update({ review_state: "approved", reviewed_by: employee.id, vendor_id: vendor.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registration reviewed");
      void queryClient.invalidateQueries({ queryKey: ["vendor-registrations"] });
      void queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewBill = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase
        .from("vendor_bills")
        .update({
          review_state: approve ? "approved" : "rejected",
          reviewed_by: employee.id,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supplier bill reviewed");
      void queryClient.invalidateQueries({ queryKey: ["vendor-bills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (ordersQuery.data ?? [])
      .map((p) => ({ ...p, totals: poTotals(p.purchase_order_items ?? [], p) }))
      .filter((p) => {
        const matchesState = state === "all" || p.approval_state === state;
        const haystack =
          `${p.po_code} ${p.title} ${p.vendors?.name ?? ""} ${p.projects?.name ?? ""}`.toLowerCase();
        return matchesState && haystack.includes(t);
      });
  }, [ordersQuery.data, term, state]);

  const stockSummary = useMemo(() => {
    const balances = stockBalances(stockQuery.data ?? [], (m) => m.description ?? "Item");
    const onHand = balances.filter((b) => b.onHand > 0);
    return {
      balances,
      items: onHand.length,
      value: onHand.reduce((sum, b) => sum + b.value, 0),
    };
  }, [stockQuery.data]);

  const coverageByProject = useMemo(() => {
    const cov = coverageQuery.data;
    if (!cov) return [];
    const orderedByLine = new Map<string, number>();
    for (const pi of cov.poItems) {
      if (!pi.boq_item_id) continue;
      orderedByLine.set(
        pi.boq_item_id,
        (orderedByLine.get(pi.boq_item_id) ?? 0) +
          Number(pi.quantity ?? 0) * Number(pi.unit_rate ?? 0),
      );
    }
    const byProject = new Map<
      string,
      { name: string; code: string; planned: number; ordered: number }
    >();
    for (const bi of cov.boqItems) {
      const boq = bi.boqs;
      const project = boq?.projects ?? null;
      const key = boq?.project_id ?? "unlinked";
      const entry = byProject.get(key) ?? {
        name: project?.name ?? "Unlinked",
        code: project?.project_code ?? "—",
        planned: 0,
        ordered: 0,
      };
      const planned =
        Number(bi.quantity ?? 0) *
        (1 + Number(bi.wastage_percent ?? 0) / 100) *
        Number(bi.unit_rate ?? 0);
      entry.planned += planned;
      entry.ordered += Math.min(orderedByLine.get(bi.id) ?? 0, planned);
      byProject.set(key, entry);
    }
    return [...byProject.values()]
      .map((p) => ({
        ...p,
        percent: p.planned > 0 ? Math.min(100, (p.ordered / p.planned) * 100) : 0,
      }))
      .sort((a, b) => b.planned - a.planned);
  }, [coverageQuery.data]);

  if (ordersQuery.isLoading) return <LoadingState />;
  if (ordersQuery.isError) return <ErrorState message={(ordersQuery.error as Error).message} />;

  const all = ordersQuery.data ?? [];
  const committed = all
    .filter((p) => p.approval_state === "approved" || p.approval_state === "executed")
    .reduce((sum, p) => sum + poTotals(p.purchase_order_items ?? [], p).grand, 0);
  const awaiting = all.filter((p) => p.approval_state === "pending_approval").length;
  const openDeliveries = all.filter((p) => {
    const t = poTotals(p.purchase_order_items ?? [], p);
    return t.orderedQty > 0 && t.receivedQty < t.orderedQty;
  }).length;

  const openOrders = all.filter(
    (p) => !["executed", "rejected", "cancelled"].includes(p.approval_state ?? ""),
  );
  const pendingDeliveries = all
    .map((p) => {
      const items = p.purchase_order_items ?? [];
      const remainingValue = items.reduce(
        (sum, i) =>
          sum +
          Math.max(0, Number(i.quantity ?? 0) - Number(i.received_quantity ?? 0)) *
            Number(i.unit_rate ?? 0),
        0,
      );
      return { ...p, totals: poTotals(items, p), remainingValue };
    })
    .filter(
      (p) =>
        ["approved", "executed"].includes(p.approval_state ?? "") &&
        p.totals.orderedQty > 0 &&
        p.totals.receivedQty < p.totals.orderedQty,
    )
    .sort((a, b) => (a.expected_date ?? "").localeCompare(b.expected_date ?? ""));

  return (
    <>
      <PageHeader
        title="Procurement"
        description="Purchase orders are raised from approved estimate lines, so every rupee committed traces back to a BOQ item and a project."
        actions={
          canEdit ? (
            <div className="flex gap-2">
              <Dialog open={vendorOpen} onOpenChange={setVendorOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">New vendor</Button>
                </DialogTrigger>
                <NewVendorDialog
                  pending={createVendor.isPending}
                  onSubmit={(f) => createVendor.mutate(f)}
                />
              </Dialog>
              <Dialog open={poOpen} onOpenChange={setPoOpen}>
                <DialogTrigger asChild>
                  <Button>New purchase order</Button>
                </DialogTrigger>
                <NewPoDialog
                  vendors={vendorsQuery.data ?? []}
                  boqs={boqsQuery.data ?? []}
                  pending={createPo.isPending}
                  onSubmit={(f) => createPo.mutate(f)}
                />
              </Dialog>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Purchase orders" value={String(all.length)} />
        <StatCard label="Committed value" value={inr(committed, true)} tone="success" />
        <StatCard label="Awaiting approval" value={String(awaiting)} tone="warning" />
        <StatCard label="Open deliveries" value={String(openDeliveries)} />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="orders">Purchase orders</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
          <TabsTrigger value="bills">Supplier bills</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Open purchase orders" value={String(openOrders.length)} />
            <StatCard label="Stock on hand" value={inr(stockSummary.value, true)} tone="success" />
            <StatCard
              label="Pending deliveries"
              value={String(pendingDeliveries.length)}
              tone={pendingDeliveries.length > 0 ? "warning" : "default"}
            />
            <StatCard label="Distinct items in stock" value={String(stockSummary.items)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Pending deliveries</h2>
              <p className="text-xs text-muted-foreground">
                Approved orders where goods are still to arrive, soonest expected first.
              </p>
              {pendingDeliveries.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing awaiting delivery — all approved orders are fully received.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {pendingDeliveries.map((p) => (
                    <li key={p.id}>
                      <Link
                        to="/procurement/$poId"
                        params={{ poId: p.id }}
                        className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{p.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {p.po_code} · {p.vendors?.name ?? "Vendor not set"}
                              {p.projects ? ` · ${p.projects.project_code}` : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-sm font-medium text-numeric">
                            {inr(p.remainingValue)}
                          </p>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, p.totals.receivedPercent)}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {p.totals.receivedPercent.toFixed(0)}% received
                          {p.expected_date ? ` · expected ${shortDate(p.expected_date)}` : ""}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Estimate coverage by project</h2>
              <p className="text-xs text-muted-foreground">
                How much of each approved estimate is already covered by purchase orders.
              </p>
              {coverageByProject.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No approved estimates yet — coverage appears once an estimate is approved.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {coverageByProject.map((p) => (
                    <li key={`${p.code}-${p.name}`}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <p className="min-w-0 truncate font-medium">
                          {p.name}
                          <span className="ml-2 text-xs text-muted-foreground">{p.code}</span>
                        </p>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          <span className="text-numeric">{inr(p.ordered, true)}</span>
                          {" of "}
                          <span className="text-numeric">{inr(p.planned, true)}</span>
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${p.percent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground text-numeric">
                        {p.percent.toFixed(0)}% covered
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-semibold">Stock on hand</h2>
            <p className="text-xs text-muted-foreground">
              Current balances across stores, valued at the rate goods were received.
            </p>
            {stockSummary.balances.filter((b) => b.onHand > 0).length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No stock recorded yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium">Item</th>
                      <th className="py-2 pr-4 font-medium">Store</th>
                      <th className="py-2 pr-4 text-right font-medium">On hand</th>
                      <th className="py-2 text-right font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockSummary.balances
                      .filter((b) => b.onHand > 0)
                      .slice(0, 12)
                      .map((b) => {
                        const storeName =
                          (stockQuery.data ?? []).find((m) => m.store_id === b.storeId)?.stores
                            ?.name ?? "—";
                        return (
                          <tr
                            key={b.key}
                            className="border-b border-border last:border-0 hover:bg-secondary/50"
                          >
                            <td className="py-2.5 pr-4 font-medium">{b.label}</td>
                            <td className="py-2.5 pr-4 text-muted-foreground">{storeName}</td>
                            <td className="py-2.5 pr-4 text-right text-numeric">
                              {b.onHand.toLocaleString("en-IN")} {b.uom}
                            </td>
                            <td className="py-2.5 text-right text-numeric">{inr(b.value)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search order, vendor or project…"
              className="max-w-sm"
            />
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Approval state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_approval">Pending approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="executed">Executed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              title="No purchase orders yet"
              description="Raise an order against an approved estimate to commit cost to a project."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {rows.map((p) => (
                <Link
                  key={p.id}
                  to="/procurement/$poId"
                  params={{ poId: p.id }}
                  className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold">{p.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.po_code} · {p.vendors?.name ?? "Vendor not set"} ·{" "}
                        {(p.purchase_order_items ?? []).length} lines
                      </p>
                    </div>
                    <StatusBadge value={p.approval_state} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Project</dt>
                      <dd className="font-medium">{p.projects?.name ?? "Unlinked"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Against estimate</dt>
                      <dd className="font-medium">{p.boqs?.boq_code ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Order value</dt>
                      <dd className="font-medium text-numeric">{inr(p.totals.grand)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Delivered</dt>
                      <dd className="font-medium text-numeric">
                        {p.totals.receivedPercent.toFixed(0)}%
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, p.totals.receivedPercent)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {p.expected_date
                      ? `Expected ${shortDate(p.expected_date)}`
                      : `Updated ${shortDate(p.updated_at)}`}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="vendors" className="pt-4">
          {(vendorsQuery.data ?? []).length === 0 ? (
            <EmptyState title="No vendors yet" description="Add the suppliers you buy from." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Vendor</th>
                    <th className="px-4 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 font-medium">Contact</th>
                    <th className="hidden px-4 py-2 font-medium lg:table-cell">GSTIN</th>
                    <th className="px-4 py-2 text-right font-medium">Rating</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(vendorsQuery.data ?? []).map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/50"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.vendor_code}
                          {v.city ? ` · ${v.city}` : ""}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {titleCase((v.category ?? "").replace("_", " "))}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <p>{v.contact_name ?? "—"}</p>
                        <p className="text-xs">{v.phone ?? v.email ?? ""}</p>
                      </td>
                      <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                        {v.gstin ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-numeric">
                        {Number(v.rating ?? 0).toFixed(1)}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge value={v.is_approved ? "approved" : "draft"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="registrations" className="space-y-4 pt-4">
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-medium">Public registration link</p>
            <p className="mt-1 text-muted-foreground">
              Share <span className="font-mono">/vendor-register</span> with new suppliers. Their
              details land here for review; approving one adds them to the vendor register.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/vendor-register">Open the form</Link>
            </Button>
          </div>

          {(registrationsQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No registrations yet"
              description="Supplier applications submitted through the public form appear here."
            />
          ) : (
            <div className="space-y-3">
              {(registrationsQuery.data ?? []).map((r) => (
                <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{r.business_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {titleCase((r.category ?? "").replace("_", " "))}
                        {r.city ? ` · ${r.city}` : ""} · {shortDate(r.created_at)}
                      </p>
                    </div>
                    <StatusBadge value={r.review_state ?? "submitted"} />
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <Detail label="Contact" value={`${r.contact_name} · ${r.phone}`} />
                    <Detail label="Email" value={r.email} />
                    <Detail label="GST / PAN" value={`${r.gstin ?? "—"} · ${r.pan ?? "—"}`} />
                    <Detail
                      label="Bank"
                      value={
                        r.bank_name
                          ? `${r.bank_name} · ${r.account_number ?? "—"} · ${r.ifsc ?? "—"}`
                          : "Not shared"
                      }
                    />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{r.supplies}</p>
                  {canEdit && r.review_state === "submitted" ? (
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        disabled={reviewRegistration.isPending}
                        onClick={() => reviewRegistration.mutate({ id: r.id, approve: true })}
                      >
                        Approve and add vendor
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewRegistration.isPending}
                        onClick={() => reviewRegistration.mutate({ id: r.id, approve: false })}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="bills" className="space-y-3 pt-4">
          {(billsQuery.data ?? []).length === 0 ? (
            <EmptyState
              title="No supplier bills yet"
              description="Approved suppliers raise their invoices from the partner portal; they land here for review before payment."
            />
          ) : (
            (billsQuery.data ?? []).map((b) => {
              const match = b.purchase_order_id ? matchByPo.get(b.purchase_order_id) : undefined;
              const matchStatus = match?.match_status as MatchStatus | undefined;
              return (
                <div key={b.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-semibold">
                        {b.vendors?.name ?? "Supplier"} · bill {b.bill_number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shortDate(b.bill_date)} · {b.purchase_orders?.po_code ?? "No order"} ·{" "}
                        {b.projects?.name ?? "General"}
                        {b.due_date ? ` · due ${shortDate(b.due_date)}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-numeric font-display text-lg font-semibold">
                        {inr(b.total_amount)}
                      </p>
                      <div className="flex items-center justify-end gap-1.5">
                        <StatusBadge value={b.review_state} />
                        {matchStatus && matchStatus !== "no_bill" ? (
                          <StatusBadge
                            value={MATCH_STATUS_LABEL[matchStatus]}
                            className={
                              {
                                success: "bg-success/15 text-success border-success/30",
                                warning: "bg-warning/15 text-warning-foreground border-warning/40",
                                danger: "bg-destructive/10 text-destructive border-destructive/30",
                                default: "bg-muted text-muted-foreground border-border",
                              }[MATCH_STATUS_TONE[matchStatus]]
                            }
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <Detail label="Taxable value" value={inr(b.taxable_amount)} />
                    <Detail label="GST" value={`${b.tax_percent ?? 0}%`} />
                    <Detail
                      label="Bill copy"
                      value={b.attachment_url ? b.attachment_url : "Not shared"}
                    />
                    <Detail label="Supplier note" value={b.notes ?? "—"} />
                  </div>
                  {canEdit && b.review_state === "submitted" ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        disabled={reviewBill.isPending}
                        onClick={() => {
                          if (
                            matchStatus === "over_billed" &&
                            !window.confirm(
                              `This bill (${inr(b.total_amount)}) exceeds what has been received against ${
                                b.purchase_orders?.po_code ?? "this order"
                              } (${inr(match?.received_amount ?? 0)} received so far). Approve anyway?`,
                            )
                          ) {
                            return;
                          }
                          reviewBill.mutate({ id: b.id, approve: true });
                        }}
                      >
                        Approve for payment
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewBill.isPending}
                        onClick={() => reviewBill.mutate({ id: b.id, approve: false })}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function NewPoDialog({
  vendors,
  boqs,
  pending,
  onSubmit,
}: {
  vendors: { id: string; vendor_code: string; name: string }[];
  boqs: {
    id: string;
    boq_code: string;
    title: string;
    projects: { project_code: string } | null;
  }[];
  pending: boolean;
  onSubmit: (form: NewPoForm) => void;
}) {
  const [title, setTitle] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [boqId, setBoqId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [seedFromBoq, setSeedFromBoq] = useState(true);
  const [seedKind, setSeedKind] = useState("material");

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>New purchase order</DialogTitle>
        <DialogDescription>
          Orders are raised against an estimate so committed cost stays comparable with the budget.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="po-title">Title</Label>
          <Input
            id="po-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Irrigation package — podium deck"
          />
        </div>
        <div className="grid gap-2">
          <Label>Vendor</Label>
          <Select value={vendorId} onValueChange={setVendorId}>
            <SelectTrigger>
              <SelectValue placeholder="Select vendor" />
            </SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.vendor_code} · {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Against estimate</Label>
          <Select value={boqId} onValueChange={setBoqId}>
            <SelectTrigger>
              <SelectValue placeholder="Select BOQ" />
            </SelectTrigger>
            <SelectContent>
              {boqs.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.boq_code} · {b.title}
                  {b.projects ? ` · ${b.projects.project_code}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-primary"
            checked={seedFromBoq}
            onChange={(e) => setSeedFromBoq(e.target.checked)}
          />
          <span>
            Pull lines from the estimate
            <span className="block text-xs text-muted-foreground">
              Each BOQ line becomes an order line with wastage included, still linked back to it.
            </span>
          </span>
        </label>
        {seedFromBoq ? (
          <div className="grid gap-2">
            <Label>Which lines</Label>
            <Select value={seedKind} onValueChange={setSeedKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lines</SelectItem>
                <SelectItem value="plant">Plants only</SelectItem>
                <SelectItem value="material">Materials only</SelectItem>
                <SelectItem value="equipment">Equipment only</SelectItem>
                <SelectItem value="labour">Labour only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="po-date">Expected delivery</Label>
          <Input
            id="po-date"
            type="date"
            value={expectedDate}
            onChange={(e) => setExpectedDate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="po-notes">Terms and instructions</Label>
          <Textarea
            id="po-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Quality standards, delivery window, rejection conditions."
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !title.trim()}
          onClick={() =>
            onSubmit({
              title: title.trim(),
              vendorId,
              boqId,
              expectedDate,
              notes,
              seedFromBoq,
              seedKind,
            })
          }
        >
          {pending ? "Creating…" : "Create order"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function NewVendorDialog({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (form: NewVendorForm) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("plants");
  const [city, setCity] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>New vendor</DialogTitle>
        <DialogDescription>
          Vendors are shared across purchase orders, rate comparisons and goods receipts.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="ven-name">Name</Label>
          <Input id="ven-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VENDOR_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {titleCase(c.replace("_", " "))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ven-city">City</Label>
          <Input id="ven-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ven-contact">Contact person</Label>
          <Input
            id="ven-contact"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ven-phone">Phone</Label>
          <Input id="ven-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ven-email">Email</Label>
          <Input id="ven-email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ven-gstin">GSTIN</Label>
          <Input id="ven-gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="ven-terms">Payment terms</Label>
          <Input
            id="ven-terms"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            placeholder="30 days from delivery"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name.trim()}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              category,
              city,
              contactName,
              phone,
              email,
              gstin,
              paymentTerms,
            })
          }
        >
          {pending ? "Saving…" : "Add vendor"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 break-words">{value}</p>
    </div>
  );
}

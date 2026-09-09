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
  poLineAmount,
  poTotals,
  MATCH_STATUS_LABEL,
  MATCH_STATUS_TONE,
  type MatchStatus,
} from "@/lib/procurement";

export const Route = createFileRoute("/_authenticated/procurement/$poId")({
  head: () => ({
    meta: [
      { title: "Purchase order — EnvironIQ" },
      {
        name: "description",
        content:
          "Purchase order detail with estimate-linked lines, ordered versus received quantities, goods receipts and order value.",
      },
      { property: "og:title", content: "Purchase order — EnvironIQ" },
      {
        property: "og:description",
        content: "Order lines traced to BOQ items, with receipts posted straight into stock.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PurchaseOrderDetail,
});

type ReceiveTarget = {
  id: string;
  description: string;
  uom: string;
  quantity: number;
  received: number;
  unitRate: number;
  materialId: string | null;
  speciesId: string | null;
};

function PurchaseOrderDetail() {
  const { poId } = Route.useParams();
  const { can, employee } = useAuth();
  const canEdit = can("procurement", "edit");
  const canReceive = can("inventory", "edit") || canEdit;
  const queryClient = useQueryClient();
  const [receiveTarget, setReceiveTarget] = useState<ReceiveTarget | null>(null);

  const query = useQuery({
    queryKey: ["purchase-order", poId],
    queryFn: async () => {
      const [order, items, stores, grns, match] = await Promise.all([
        supabase
          .from("purchase_orders")
          .select(
            "id, po_code, title, expected_date, delivery_address, notes, tax_percent, freight_amount, approval_state, status, created_at, updated_at, project_id, vendors(id, name, vendor_code, contact_name, phone, email, payment_terms), projects(id, name, project_code), boqs(id, boq_code, title)",
          )
          .eq("id", poId)
          .maybeSingle(),
        supabase
          .from("purchase_order_items")
          .select(
            "id, description, uom, quantity, unit_rate, received_quantity, remarks, sort_order, material_id, species_id, boq_item_id, boq_items(id, description, quantity, wastage_percent, unit_rate, item_kind)",
          )
          .eq("purchase_order_id", poId)
          .order("sort_order"),
        supabase
          .from("stores")
          .select("id, code, name, store_type")
          .eq("is_active", true)
          .order("code"),
        supabase
          .from("goods_receipts")
          .select(
            "id, grn_code, received_date, challan_reference, remarks, stores(name), goods_receipt_items(id, quantity_received, quality_status, remarks, purchase_order_items(description, uom))",
          )
          .eq("purchase_order_id", poId)
          .order("received_date", { ascending: false }),
        supabase.from("po_three_way_match").select("*").eq("purchase_order_id", poId).maybeSingle(),
      ]);
      if (order.error) throw order.error;
      if (items.error) throw items.error;
      if (stores.error) throw stores.error;
      if (grns.error) throw grns.error;
      if (match.error) throw match.error;
      return {
        order: order.data,
        items: items.data ?? [],
        stores: stores.data ?? [],
        grns: grns.data ?? [],
        match: match.data,
      };
    },
  });

  const receive = useMutation({
    mutationFn: async (input: {
      target: ReceiveTarget;
      storeId: string;
      quantity: number;
      qualityStatus: "accepted" | "partial" | "rejected";
      reference: string;
      remarks: string;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const order = query.data?.order;
      if (!order) throw new Error("Order not found.");

      const grnCount = query.data?.grns.length ?? 0;
      const { data: grn, error: grnError } = await supabase
        .from("goods_receipts")
        .insert({
          company_id: employee.company_id,
          purchase_order_id: poId,
          grn_code: `GRN-${order.po_code}-${String(grnCount + 1).padStart(3, "0")}`,
          store_id: input.storeId,
          challan_reference: input.reference || null,
          remarks: input.remarks || null,
          received_by: employee.id,
        })
        .select("id, grn_code")
        .single();
      if (grnError) throw grnError;

      let stockMovementId: string | null = null;
      if (input.qualityStatus !== "rejected") {
        const { data: move, error: moveError } = await supabase
          .from("stock_movements")
          .insert({
            company_id: employee.company_id,
            store_id: input.storeId,
            movement_type: "receipt",
            material_id: input.target.materialId,
            species_id: input.target.speciesId,
            description: input.target.description,
            uom: input.target.uom,
            quantity: input.quantity,
            unit_rate: input.target.unitRate,
            project_id: order.project_id,
            purchase_order_item_id: input.target.id,
            reference: grn.grn_code,
            remarks: input.remarks || null,
          })
          .select("id")
          .single();
        if (moveError) throw moveError;
        stockMovementId = move.id;
      }

      const { error: itemError } = await supabase.from("goods_receipt_items").insert({
        goods_receipt_id: grn.id,
        purchase_order_item_id: input.target.id,
        quantity_received: input.quantity,
        quality_status: input.qualityStatus,
        stock_movement_id: stockMovementId,
        remarks: input.remarks || null,
      });
      if (itemError) throw itemError;
      // purchase_order_items.received_quantity is recalculated by the
      // recalc_po_item_received trigger from goods_receipt_items — the
      // client never writes it directly.
    },
    onSuccess: () => {
      toast.success("Goods receipt posted to stock");
      setReceiveTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setState = useMutation({
    mutationFn: async (next: "pending_approval" | "approved" | "executed") => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ approval_state: next, status: next === "executed" ? "completed" : next })
        .eq("id", poId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Order updated");
      void queryClient.invalidateQueries({ queryKey: ["purchase-order", poId] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(
    () =>
      poTotals(query.data?.items ?? [], {
        tax_percent: query.data?.order?.tax_percent ?? 0,
        freight_amount: query.data?.order?.freight_amount ?? 0,
      }),
    [query.data],
  );

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  const order = query.data?.order;
  if (!order) return <EmptyState title="Purchase order not found" />;

  const items = query.data?.items ?? [];
  const grns = query.data?.grns ?? [];
  const match = query.data?.match;
  const matchStatus = (match?.match_status ?? "no_bill") as MatchStatus;

  return (
    <>
      <PageHeader
        title={order.title}
        description={`${order.po_code} · ${order.vendors?.name ?? "Vendor not set"}${
          order.projects ? ` · ${order.projects.name}` : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={order.approval_state} />
            {canEdit && order.approval_state === "draft" ? (
              <Button onClick={() => setState.mutate("pending_approval")}>Send for approval</Button>
            ) : null}
            {can("procurement", "approve") && order.approval_state === "pending_approval" ? (
              <Button onClick={() => setState.mutate("approved")}>Approve order</Button>
            ) : null}
            {canEdit && order.approval_state === "approved" && totals.receivedPercent >= 100 ? (
              <Button variant="outline" onClick={() => setState.mutate("executed")}>
                Mark closed
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Order value" value={inr(totals.grand)} />
        <StatCard label="Basic value" value={inr(totals.basic)} />
        <StatCard
          label="Delivered"
          value={`${totals.receivedPercent.toFixed(0)}%`}
          tone={totals.receivedPercent >= 100 ? "success" : "warning"}
        />
        <StatCard
          label="Expected"
          value={order.expected_date ? shortDate(order.expected_date) : "Not set"}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold">3-way match</h2>
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
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Ordered value vs. what has actually been received vs. what vendors have billed against
          this order — flagged before a supplier bill is approved for payment.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <Row label="Ordered" value={inr(match?.ordered_amount ?? 0)} />
          <Row label="Received" value={inr(match?.received_amount ?? 0)} />
          <Row label="Billed" value={inr(match?.billed_amount ?? 0)} />
        </dl>
      </div>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Order lines</TabsTrigger>
          <TabsTrigger value="receipts">Goods receipts</TabsTrigger>
          <TabsTrigger value="terms">Terms & vendor</TabsTrigger>
        </TabsList>

        <TabsContent value="lines" className="space-y-4 pt-4">
          {items.length === 0 ? (
            <EmptyState
              title="No lines on this order"
              description="Create the order from an estimate to pull its priced lines across."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 text-right font-medium">Ordered</th>
                    <th className="px-4 py-2 text-right font-medium">Received</th>
                    <th className="px-4 py-2 text-right font-medium">Pending</th>
                    <th className="px-4 py-2 text-right font-medium">Rate</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                    {canReceive ? <th className="px-4 py-2" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const ordered = Number(i.quantity ?? 0);
                    const received = Number(i.received_quantity ?? 0);
                    const pending = Math.max(0, ordered - received);
                    const boqQty =
                      Number(i.boq_items?.quantity ?? 0) *
                      (1 + Number(i.boq_items?.wastage_percent ?? 0) / 100);
                    return (
                      <tr
                        key={i.id}
                        className="border-b border-border last:border-0 hover:bg-secondary/50"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{i.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {i.uom}
                            {i.boq_items
                              ? ` · from estimate line (${boqQty.toFixed(2)} ${i.uom} @ ${inr(
                                  Number(i.boq_items.unit_rate ?? 0),
                                )})`
                              : " · off-estimate purchase"}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {ordered.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {received.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {pending > 0 ? pending.toFixed(2) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {inr(Number(i.unit_rate ?? 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {inr(poLineAmount(i))}
                        </td>
                        {canReceive ? (
                          <td className="px-4 py-2.5 text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending <= 0}
                              onClick={() =>
                                setReceiveTarget({
                                  id: i.id,
                                  description: i.description,
                                  uom: i.uom,
                                  quantity: ordered,
                                  received,
                                  unitRate: Number(i.unit_rate ?? 0),
                                  materialId: i.material_id,
                                  speciesId: i.species_id,
                                })
                              }
                            >
                              Receive
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-sm font-semibold">Order value build-up</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Basic value" value={inr(totals.basic)} />
              <Row label="Freight" value={inr(totals.freight)} />
              <Row label={`GST @ ${Number(order.tax_percent ?? 0)}%`} value={inr(totals.tax)} />
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                <dt>Order total</dt>
                <dd className="text-numeric">{inr(totals.grand)}</dd>
              </div>
            </dl>
            {order.boqs ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Raised against{" "}
                <Link
                  to="/boq/$boqId"
                  params={{ boqId: order.boqs.id }}
                  className="font-medium text-primary hover:underline"
                >
                  {order.boqs.boq_code} — {order.boqs.title}
                </Link>
              </p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="receipts" className="pt-4">
          {grns.length === 0 ? (
            <EmptyState
              title="Nothing received yet"
              description="Post a receipt from an order line to raise a GRN against this order."
            />
          ) : (
            <ul className="space-y-3">
              {grns.map((g) => (
                <li key={g.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{g.grn_code}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.stores?.name ?? "Store"} · {shortDate(g.received_date)}
                      {g.challan_reference ? ` · ${g.challan_reference}` : ""}
                    </p>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {(g.goods_receipt_items ?? []).map((gi) => (
                      <li key={gi.id} className="flex items-baseline justify-between gap-2 text-sm">
                        <span>{gi.purchase_order_items?.description ?? "Line item"}</span>
                        <span className="text-numeric">
                          {Number(gi.quantity_received ?? 0).toFixed(2)}{" "}
                          {gi.purchase_order_items?.uom ?? ""} ·{" "}
                          <StatusBadge
                            value={titleCase(gi.quality_status)}
                            className="align-middle"
                          />
                        </span>
                      </li>
                    ))}
                  </ul>
                  {g.remarks ? (
                    <p className="mt-2 text-sm text-muted-foreground">{g.remarks}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="terms" className="grid gap-4 pt-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-sm font-semibold">Vendor</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Name" value={order.vendors?.name ?? "—"} />
              <Row label="Contact" value={order.vendors?.contact_name ?? "—"} />
              <Row label="Phone" value={order.vendors?.phone ?? "—"} />
              <Row label="Email" value={order.vendors?.email ?? "—"} />
              <Row label="Payment terms" value={order.vendors?.payment_terms ?? "—"} />
            </dl>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-sm font-semibold">Delivery & instructions</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Deliver to" value={order.delivery_address ?? "—"} />
              <Row
                label="Expected"
                value={order.expected_date ? shortDate(order.expected_date) : "—"}
              />
              <Row label="Raised" value={shortDate(order.created_at)} />
            </dl>
            {order.notes ? <p className="mt-4 text-sm whitespace-pre-wrap">{order.notes}</p> : null}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!receiveTarget} onOpenChange={(o) => (o ? null : setReceiveTarget(null))}>
        {receiveTarget ? (
          <ReceiveDialog
            target={receiveTarget}
            stores={query.data?.stores ?? []}
            pending={receive.isPending}
            onSubmit={(v) => receive.mutate({ target: receiveTarget, ...v })}
          />
        ) : null}
      </Dialog>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function ReceiveDialog({
  target,
  stores,
  pending,
  onSubmit,
}: {
  target: ReceiveTarget;
  stores: { id: string; code: string; name: string; store_type: string }[];
  pending: boolean;
  onSubmit: (v: {
    storeId: string;
    quantity: number;
    qualityStatus: "accepted" | "partial" | "rejected";
    reference: string;
    remarks: string;
  }) => void;
}) {
  const outstanding = Math.max(0, target.quantity - target.received);
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [quantity, setQuantity] = useState(String(outstanding));
  const [qualityStatus, setQualityStatus] = useState<"accepted" | "partial" | "rejected">(
    "accepted",
  );
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Receive goods</DialogTitle>
        <DialogDescription>
          {target.description} — {outstanding.toFixed(2)} {target.uom} still due. Accepted and
          partially-accepted quantities post into stock at the order rate; rejected goods raise a
          GRN record but never touch stock.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Into store</Label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Select store" />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="grn-qty">Quantity received ({target.uom})</Label>
          <Input
            id="grn-qty"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Quality acceptance</Label>
          <Select
            value={qualityStatus}
            onValueChange={(v) => setQualityStatus(v as "accepted" | "partial" | "rejected")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accepted">Accepted in full</SelectItem>
              <SelectItem value="partial">Partially accepted</SelectItem>
              <SelectItem value="rejected">Rejected on inspection</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="grn-ref">Challan reference</Label>
          <Input
            id="grn-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="GRN-0006"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="grn-remarks">Condition notes</Label>
          <Textarea
            id="grn-remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Quality, shortages or damage observed on delivery."
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !storeId || !(Number(quantity) > 0)}
          onClick={() =>
            onSubmit({ storeId, quantity: Number(quantity), qualityStatus, reference, remarks })
          }
        >
          {pending ? "Posting…" : "Post receipt"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

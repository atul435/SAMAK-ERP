import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { invoiceLineAmount, invoiceTotals, sumPayments } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/finance/$invoiceId")({
  head: () => ({
    meta: [
      { title: "Invoice detail — Finance" },
      {
        name: "description",
        content:
          "Billed lines, GST, retention, advance adjustment and receipts recorded against a single client invoice.",
      },
      { property: "og:title", content: "Invoice detail — Finance" },
      {
        property: "og:description",
        content: "Every measured line on the bill and what has been collected against it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  const { invoiceId } = Route.useParams();
  const { can } = useAuth();
  const canEdit = can("finance", "edit");
  const queryClient = useQueryClient();
  const [openLine, setOpenLine] = useState(false);

  const query = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const invoice = await supabase
        .from("invoices")
        .select(
          "id, invoice_code, title, invoice_type, invoice_date, due_date, tax_percent, retention_percent, advance_adjusted, notes, status, approval_state, project_id, boq_id, projects(project_code, name), clients(name), employees(full_name)",
        )
        .eq("id", invoiceId)
        .maybeSingle();
      if (invoice.error) throw invoice.error;
      if (!invoice.data) throw new Error("Invoice not found");

      const [items, payments, boqItems] = await Promise.all([
        supabase
          .from("invoice_items")
          .select("id, description, uom, quantity, unit_rate, boq_item_id, sort_order")
          .eq("invoice_id", invoiceId)
          .order("sort_order"),
        supabase
          .from("payments")
          .select("id, payment_code, amount, paid_on, mode, reference, tds_amount, direction")
          .eq("invoice_id", invoiceId)
          .order("paid_on", { ascending: false }),
        supabase
          .from("boq_items")
          .select("id, description, uom, quantity, unit_rate, boqs!inner(project_id)")
          .eq("boqs.project_id", invoice.data.project_id ?? "00000000-0000-0000-0000-000000000000"),
      ]);
      for (const r of [items, payments, boqItems]) if (r.error) throw r.error;
      return {
        invoice: invoice.data,
        items: items.data ?? [],
        payments: payments.data ?? [],
        boqItems: boqItems.data ?? [],
      };
    },
  });

  const addLine = useMutation({
    mutationFn: async (v: {
      description: string;
      uom: string;
      quantity: string;
      unitRate: string;
      boqItemId: string;
    }) => {
      const { error } = await supabase.from("invoice_items").insert({
        invoice_id: invoiceId,
        description: v.description,
        uom: v.uom || "nos",
        quantity: Number(v.quantity || 0),
        unit_rate: Number(v.unitRate || 0),
        boq_item_id: v.boqItemId || null,
        sort_order: (query.data?.items.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line added to the invoice");
      setOpenLine(false);
      void queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setState = useMutation({
    mutationFn: async (state: "submitted" | "approved" | "executed") => {
      const { error } = await supabase
        .from("invoices")
        .update({
          approval_state: state,
          status: state === "executed" ? "completed" : state === "approved" ? "approved" : "submitted",
        })
        .eq("id", invoiceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice updated");
      void queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  const data = query.data!;
  const totals = invoiceTotals(data.items, data.invoice);
  const received = sumPayments(data.payments, "inbound");
  const outstanding = Math.max(totals.net - received, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${data.invoice.invoice_code} — ${data.invoice.title}`}
        description={`${titleCase(data.invoice.invoice_type)} bill · ${data.invoice.projects?.project_code ?? "No project"} · ${data.invoice.clients?.name ?? "No client"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/finance">
              <Button variant="ghost">Back to finance</Button>
            </Link>
            {canEdit ? (
              <>
                <AddLineDialog
                  open={openLine}
                  setOpen={setOpenLine}
                  boqItems={data.boqItems}
                  onSubmit={(v) => addLine.mutate(v)}
                  pending={addLine.isPending}
                />
                {data.invoice.approval_state === "draft" ? (
                  <Button variant="outline" onClick={() => setState.mutate("submitted")}>
                    Submit for approval
                  </Button>
                ) : null}
                {can("finance", "approve") &&
                (data.invoice.approval_state === "submitted" ||
                  data.invoice.approval_state === "pending_approval") ? (
                  <Button onClick={() => setState.mutate("approved")}>Approve</Button>
                ) : null}
                {data.invoice.approval_state === "approved" ? (
                  <Button onClick={() => setState.mutate("executed")}>Mark issued to client</Button>
                ) : null}
              </>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <StatusBadge value={data.invoice.approval_state} />
        <span>Raised {shortDate(data.invoice.invoice_date)}</span>
        <span>Due {data.invoice.due_date ? shortDate(data.invoice.due_date) : "—"}</span>
        <span>By {data.invoice.employees?.full_name ?? "—"}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Work billed" value={inr(totals.basic)} />
        <StatCard label="Net payable" value={inr(totals.net)} hint={`Incl. GST ${inr(totals.tax)}`} />
        <StatCard label="Received" value={inr(received)} tone="success" />
        <StatCard
          label="Outstanding"
          value={inr(outstanding)}
          tone={outstanding > 0 ? "warning" : "success"}
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Billed lines</h2>
        {data.items.length === 0 ? (
          <EmptyState
            title="No lines yet"
            description="Add the measured quantities this bill covers."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">UOM</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">From estimate</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="px-3 py-2">{i.description}</td>
                    <td className="px-3 py-2 text-xs">{i.uom}</td>
                    <td className="px-3 py-2 text-right text-numeric">{Number(i.quantity ?? 0)}</td>
                    <td className="px-3 py-2 text-right text-numeric">{inr(i.unit_rate)}</td>
                    <td className="px-3 py-2 text-right text-numeric font-medium">
                      {inr(invoiceLineAmount(i))}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {i.boq_item_id ? "Linked" : "Manual"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-border bg-muted/30 text-sm">
                <tr>
                  <td colSpan={4} className="px-3 py-1.5 text-right text-muted-foreground">
                    Basic
                  </td>
                  <td className="px-3 py-1.5 text-right text-numeric">{inr(totals.basic)}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-1.5 text-right text-muted-foreground">
                    GST @ {Number(data.invoice.tax_percent ?? 0)}%
                  </td>
                  <td className="px-3 py-1.5 text-right text-numeric">{inr(totals.tax)}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-1.5 text-right text-muted-foreground">
                    Less retention @ {Number(data.invoice.retention_percent ?? 0)}%
                  </td>
                  <td className="px-3 py-1.5 text-right text-numeric">-{inr(totals.retention)}</td>
                  <td />
                </tr>
                <tr>
                  <td colSpan={4} className="px-3 py-1.5 text-right text-muted-foreground">
                    Less advance adjusted
                  </td>
                  <td className="px-3 py-1.5 text-right text-numeric">-{inr(totals.advance)}</td>
                  <td />
                </tr>
                <tr className="font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">
                    Net payable
                  </td>
                  <td className="px-3 py-2 text-right text-numeric">{inr(totals.net)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Receipts against this bill</h2>
        {data.payments.length === 0 ? (
          <EmptyState title="Nothing collected yet" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Receipt</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Bank reference</th>
                  <th className="px-3 py-2 text-right">TDS</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{p.payment_code}</td>
                    <td className="px-3 py-2 text-xs">{shortDate(p.paid_on)}</td>
                    <td className="px-3 py-2 text-xs">{titleCase(p.mode)}</td>
                    <td className="px-3 py-2 text-xs">{p.reference ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-numeric text-xs">
                      {inr(p.tds_amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-numeric font-medium">
                      {inr(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data.invoice.notes ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {data.invoice.notes}
        </p>
      ) : null}
    </div>
  );
}

function AddLineDialog({
  open,
  setOpen,
  boqItems,
  onSubmit,
  pending,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  boqItems: {
    id: string;
    description: string;
    uom: string | null;
    quantity: number | null;
    unit_rate: number | null;
  }[];
  onSubmit: (v: {
    description: string;
    uom: string;
    quantity: string;
    unitRate: string;
    boqItemId: string;
  }) => void;
  pending: boolean;
}) {
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState("nos");
  const [quantity, setQuantity] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [boqItemId, setBoqItemId] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add line</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a billed line</DialogTitle>
          <DialogDescription>
            Pick a line from the project estimate to copy its description and rate, or type your own.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {boqItems.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Pull from estimate</Label>
              <Select
                value={boqItemId}
                onValueChange={(v) => {
                  setBoqItemId(v);
                  const item = boqItems.find((b) => b.id === v);
                  if (item) {
                    setDescription(item.description);
                    setUom(item.uom ?? "nos");
                    setUnitRate(String(item.unit_rate ?? 0));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional — select an estimate line" />
                </SelectTrigger>
                <SelectContent>
                  {boqItems.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.description.slice(0, 60)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>UOM</Label>
              <Input value={uom} onChange={(e) => setUom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity billed</Label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Rate (₹)</Label>
              <Input type="number" value={unitRate} onChange={(e) => setUnitRate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !description || !quantity}
            onClick={() => onSubmit({ description, uom, quantity, unitRate, boqItemId })}
          >
            {pending ? "Saving…" : "Add line"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

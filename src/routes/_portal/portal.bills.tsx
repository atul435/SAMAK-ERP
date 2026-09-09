import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/lib/portal-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_portal/portal/bills")({
  head: () => ({
    meta: [
      { title: "Submit bills & receipts — Samak Landscape partner portal" },
      {
        name: "description",
        content:
          "Approved Samak Landscape suppliers can raise invoices against purchase orders, acknowledge payments received and track what is still due.",
      },
      { property: "og:title", content: "Submit bills & receipts — Samak Landscape partner portal" },
      {
        property: "og:description",
        content: "Raise your invoices against purchase orders and acknowledge payments received.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalBills,
});

const MODES = ["neft", "rtgs", "imps", "upi", "cheque", "cash"] as const;

const billSchema = z.object({
  bill_number: z.string().trim().min(1, "Bill number is required").max(40),
  bill_date: z.string().min(1, "Bill date is required"),
  due_date: z.string().optional(),
  purchase_order_id: z.string().min(1, "Choose the order this bill is against"),
  taxable_amount: z.number().positive("Enter the taxable value").max(100000000),
  tax_percent: z.number().min(0).max(28),
  attachment_url: z.string().trim().url("Enter a valid link").max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional(),
});

const receiptSchema = z.object({
  payment_id: z.string().min(1, "Choose the payment you received"),
  receipt_number: z.string().trim().max(40).optional(),
  receipt_date: z.string().min(1, "Receipt date is required"),
  amount: z.number().positive("Enter the amount received"),
  mode: z.string().min(1),
  reference: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

const today = () => new Date().toISOString().slice(0, 10);

function PortalBills() {
  const portal = usePortalUser();
  const queryClient = useQueryClient();
  const [billOpen, setBillOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const query = useQuery({
    queryKey: ["portal-bills"],
    queryFn: async () => {
      const [bills, receipts, orders, payments] = await Promise.all([
        supabase
          .from("vendor_bills")
          .select(
            "id, bill_number, bill_date, due_date, taxable_amount, tax_percent, total_amount, review_state, review_notes, notes, attachment_url, purchase_order_id, purchase_orders(po_code, title), projects(project_code, name)",
          )
          .order("bill_date", { ascending: false }),
        supabase
          .from("vendor_receipts")
          .select(
            "id, receipt_number, receipt_date, amount, mode, reference, notes, payment_id, payments(payment_code)",
          )
          .order("receipt_date", { ascending: false }),
        supabase
          .from("purchase_orders")
          .select("id, po_code, title, project_id, approval_state")
          .eq("is_archived", false)
          .in("approval_state", ["approved", "executed"])
          .order("created_at", { ascending: false }),
        supabase
          .from("payments")
          .select("id, payment_code, amount, paid_on, tds_amount, purchase_order_id")
          .eq("direction", "outbound")
          .order("paid_on", { ascending: false }),
      ]);
      for (const r of [bills, receipts, orders, payments]) if (r.error) throw r.error;
      return {
        bills: bills.data ?? [],
        receipts: receipts.data ?? [],
        orders: orders.data ?? [],
        payments: payments.data ?? [],
      };
    },
  });

  const createBill = useMutation({
    mutationFn: async (values: z.infer<typeof billSchema>) => {
      const order = (query.data?.orders ?? []).find((o) => o.id === values.purchase_order_id);
      const total =
        values.taxable_amount + (values.taxable_amount * values.tax_percent) / 100;
      const { error } = await supabase.from("vendor_bills").insert({
        company_id: portal.company_id,
        vendor_id: portal.vendor_id!,
        purchase_order_id: values.purchase_order_id,
        project_id: order?.project_id ?? null,
        bill_number: values.bill_number,
        bill_date: values.bill_date,
        due_date: values.due_date || null,
        taxable_amount: values.taxable_amount,
        tax_percent: values.tax_percent,
        total_amount: Math.round(total * 100) / 100,
        attachment_url: values.attachment_url || null,
        notes: values.notes || null,
        review_state: "submitted",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill submitted for review");
      setBillOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["portal-bills"] });
      void queryClient.invalidateQueries({ queryKey: ["portal-home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createReceipt = useMutation({
    mutationFn: async (values: z.infer<typeof receiptSchema>) => {
      const { error } = await supabase.from("vendor_receipts").insert({
        company_id: portal.company_id,
        vendor_id: portal.vendor_id!,
        payment_id: values.payment_id,
        receipt_number: values.receipt_number || null,
        receipt_date: values.receipt_date,
        amount: values.amount,
        mode: values.mode,
        reference: values.reference || null,
        notes: values.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Receipt recorded");
      setReceiptOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["portal-bills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdrawBill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendor_bills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bill withdrawn");
      void queryClient.invalidateQueries({ queryKey: ["portal-bills"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const bills = query.data?.bills ?? [];
    const receipts = query.data?.receipts ?? [];
    const submitted = bills
      .filter((b) => b.review_state === "submitted")
      .reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
    const approved = bills
      .filter((b) => b.review_state === "approved" || b.review_state === "executed")
      .reduce((s, b) => s + Number(b.total_amount ?? 0), 0);
    const acknowledged = receipts.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return { submitted, approved, acknowledged, due: Math.max(0, approved - acknowledged) };
  }, [query.data]);

  if (query.isLoading) return <LoadingState label="Loading your bills…" />;
  if (query.error) return <ErrorState message="We could not load your bills right now." />;
  const { bills, receipts, orders, payments } = query.data!;

  return (
    <>
      <PageHeader
        title="Bills & receipts"
        description="Raise your invoice against a purchase order and acknowledge every payment we release. Our finance team reviews each bill before it is scheduled for payment."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setReceiptOpen(true)}>
              Record receipt
            </Button>
            <Button onClick={() => setBillOpen(true)}>Submit a bill</Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting review" value={inr(totals.submitted, true)} tone="warning" />
        <StatCard label="Approved bills" value={inr(totals.approved, true)} />
        <StatCard label="Payments acknowledged" value={inr(totals.acknowledged, true)} tone="success" />
        <StatCard
          label="Balance due to you"
          value={inr(totals.due, true)}
          tone={totals.due > 0 ? "warning" : "success"}
        />
      </div>

      <Tabs defaultValue="bills">
        <TabsList>
          <TabsTrigger value="bills">My bills</TabsTrigger>
          <TabsTrigger value="receipts">My receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="space-y-3 pt-4">
          {bills.length === 0 ? (
            <EmptyState
              title="No bills submitted yet"
              description="Raise your invoice against an approved purchase order and it will reach our finance team straight away."
            />
          ) : (
            bills.map((b) => (
              <article key={b.id} className="rounded-xl border border-border bg-card p-4">
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display font-semibold">Bill {b.bill_number}</p>
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
                    <StatusBadge value={b.review_state} />
                  </div>
                </header>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-4">
                  <Detail label="Taxable value" value={inr(b.taxable_amount)} />
                  <Detail label="GST" value={`${b.tax_percent ?? 0}%`} />
                  <Detail
                    label="Attachment"
                    value={b.attachment_url ? "Shared" : "Not shared"}
                  />
                  <Detail label="Your note" value={b.notes ?? "—"} />
                </dl>
                {b.review_notes ? (
                  <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
                    <span className="text-muted-foreground">Reviewer note: </span>
                    {b.review_notes}
                  </p>
                ) : null}
                {b.review_state === "submitted" ? (
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="outline"
                    disabled={withdrawBill.isPending}
                    onClick={() => withdrawBill.mutate(b.id)}
                  >
                    Withdraw
                  </Button>
                ) : null}
              </article>
            ))
          )}
        </TabsContent>

        <TabsContent value="receipts" className="pt-4">
          {receipts.length === 0 ? (
            <EmptyState
              title="No receipts recorded"
              description="Acknowledge a payment we released and it appears here with its reference."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Receipt</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Against payment</th>
                    <th className="px-4 py-2 text-left font-medium">Mode</th>
                    <th className="px-4 py-2 text-left font-medium">Reference</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2 font-medium">{r.receipt_number ?? "—"}</td>
                      <td className="px-4 py-2">{shortDate(r.receipt_date)}</td>
                      <td className="px-4 py-2">{r.payments?.payment_code ?? "—"}</td>
                      <td className="px-4 py-2">{titleCase(r.mode)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.reference ?? "—"}</td>
                      <td className="text-numeric px-4 py-2 text-right font-medium">
                        {inr(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BillDialog
        open={billOpen}
        onOpenChange={setBillOpen}
        orders={orders}
        pending={createBill.isPending}
        onSubmit={(v) => createBill.mutate(v)}
      />
      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        payments={payments}
        pending={createReceipt.isPending}
        onSubmit={(v) => createReceipt.mutate(v)}
      />
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Field({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function BillDialog({
  open,
  onOpenChange,
  orders,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  orders: { id: string; po_code: string; title: string }[];
  pending: boolean;
  onSubmit: (values: z.infer<typeof billSchema>) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [poId, setPoId] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = billSchema.safeParse({
      bill_number: String(fd.get("bill_number") ?? ""),
      bill_date: String(fd.get("bill_date") ?? ""),
      due_date: String(fd.get("due_date") ?? ""),
      purchase_order_id: poId,
      taxable_amount: Number(fd.get("taxable_amount") ?? 0),
      tax_percent: Number(fd.get("tax_percent") ?? 0),
      attachment_url: String(fd.get("attachment_url") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Submit a bill</DialogTitle>
          <DialogDescription>
            Raise your invoice against an approved purchase order. Our finance team checks it
            against delivered quantities before scheduling payment.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <Field label="Purchase order" id="purchase_order_id" error={errors["purchase_order_id"]}>
            <Select value={poId} onValueChange={setPoId}>
              <SelectTrigger id="purchase_order_id">
                <SelectValue placeholder="Choose an order" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.po_code} · {o.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bill number" id="bill_number" error={errors["bill_number"]}>
            <Input id="bill_number" name="bill_number" placeholder="INV-2026-118" />
          </Field>
          <Field label="Bill date" id="bill_date" error={errors["bill_date"]}>
            <Input id="bill_date" name="bill_date" type="date" defaultValue={today()} />
          </Field>
          <Field label="Payment due by" id="due_date" error={errors["due_date"]}>
            <Input id="due_date" name="due_date" type="date" />
          </Field>
          <Field label="Taxable value (₹)" id="taxable_amount" error={errors["taxable_amount"]}>
            <Input id="taxable_amount" name="taxable_amount" type="number" step="0.01" min="0" />
          </Field>
          <Field label="GST %" id="tax_percent" error={errors["tax_percent"]}>
            <Input
              id="tax_percent"
              name="tax_percent"
              type="number"
              step="0.01"
              min="0"
              defaultValue={18}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Link to the bill copy" id="attachment_url" error={errors["attachment_url"]}>
              <Input
                id="attachment_url"
                name="attachment_url"
                placeholder="https://drive.google.com/…"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Note for our team" id="notes" error={errors["notes"]}>
              <Textarea id="notes" name="notes" rows={3} />
            </Field>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit bill"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({
  open,
  onOpenChange,
  payments,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payments: { id: string; payment_code: string; amount: number; paid_on: string }[];
  pending: boolean;
  onSubmit: (values: z.infer<typeof receiptSchema>) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paymentId, setPaymentId] = useState("");
  const [mode, setMode] = useState<string>("neft");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = receiptSchema.safeParse({
      payment_id: paymentId,
      receipt_number: String(fd.get("receipt_number") ?? ""),
      receipt_date: String(fd.get("receipt_date") ?? ""),
      amount: Number(fd.get("amount") ?? 0),
      mode,
      reference: String(fd.get("reference") ?? ""),
      notes: String(fd.get("notes") ?? ""),
    });
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[String(issue.path[0])] = issue.message;
      setErrors(map);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Record a receipt</DialogTitle>
          <DialogDescription>
            Acknowledge a payment we released so both sides agree on the balance outstanding.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <Field label="Payment received" id="payment_id" error={errors["payment_id"]}>
            <Select value={paymentId} onValueChange={setPaymentId}>
              <SelectTrigger id="payment_id">
                <SelectValue placeholder="Choose a payment" />
              </SelectTrigger>
              <SelectContent>
                {payments.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.payment_code} · {inr(p.amount)} · {shortDate(p.paid_on)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Your receipt number" id="receipt_number" error={errors["receipt_number"]}>
            <Input id="receipt_number" name="receipt_number" placeholder="RCT-118" />
          </Field>
          <Field label="Receipt date" id="receipt_date" error={errors["receipt_date"]}>
            <Input id="receipt_date" name="receipt_date" type="date" defaultValue={today()} />
          </Field>
          <Field label="Amount received (₹)" id="amount" error={errors["amount"]}>
            <Input id="amount" name="amount" type="number" step="0.01" min="0" />
          </Field>
          <Field label="Mode" id="mode">
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Bank reference" id="reference" error={errors["reference"]}>
            <Input id="reference" name="reference" placeholder="UTR / cheque number" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Note" id="notes" error={errors["notes"]}>
              <Textarea id="notes" name="notes" rows={3} />
            </Field>
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

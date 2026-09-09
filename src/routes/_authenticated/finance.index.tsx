import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IndianRupee } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
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
  EXPENSE_CATEGORIES,
  INVOICE_TYPES,
  PAYMENT_MODES,
  daysOverdue,
  invoiceTotals,
  sumPayments,
} from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({
    meta: [
      { title: "Finance — invoices, receipts and expenses" },
      {
        name: "description",
        content:
          "Client invoices, receipts, vendor payments and project expenses for every live landscape project, with outstanding and overdue tracking.",
      },
      { property: "og:title", content: "Finance — invoices, receipts and expenses" },
      {
        property: "og:description",
        content: "Track billing, collections and project spend against contract value.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinancePage,
});

type InvoiceForm = {
  invoiceCode: string;
  title: string;
  invoiceType: string;
  projectId: string;
  clientId: string;
  invoiceDate: string;
  dueDate: string;
  taxPercent: string;
  retentionPercent: string;
  advanceAdjusted: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function FinancePage() {
  const { can, employee } = useAuth();
  const canEdit = can("finance", "edit");
  const queryClient = useQueryClient();
  const [projectFilter, setProjectFilter] = useState("all");
  const [openInvoice, setOpenInvoice] = useState(false);
  const [openPayment, setOpenPayment] = useState(false);
  const [openExpense, setOpenExpense] = useState(false);

  const query = useQuery({
    queryKey: ["finance"],
    queryFn: async () => {
      const [invoices, payments, expenses, projects, clients, vendors, employees] =
        await Promise.all([
          supabase
            .from("invoices")
            .select(
              "id, invoice_code, title, invoice_type, project_id, client_id, invoice_date, due_date, tax_percent, retention_percent, advance_adjusted, status, approval_state, projects(project_code, name), clients(name), invoice_items(quantity, unit_rate)",
            )
            .eq("is_archived", false)
            .order("invoice_date", { ascending: false }),
          supabase
            .from("payments")
            .select(
              "id, payment_code, direction, amount, paid_on, mode, reference, invoice_id, project_id, vendor_id, tds_amount, remarks, projects(project_code), vendors(name), clients(name), invoices(invoice_code)",
            )
            .order("paid_on", { ascending: false }),
          supabase
            .from("expenses")
            .select(
              "id, expense_code, title, category, project_id, employee_id, expense_date, amount, tax_amount, is_reimbursable, is_reimbursed, payment_mode, bill_reference, approval_state, projects(project_code), employees(full_name)",
            )
            .order("expense_date", { ascending: false }),
          supabase
            .from("projects")
            .select("id, name, project_code, client_id, contract_value")
            .eq("is_archived", false)
            .order("project_code"),
          supabase.from("clients").select("id, name").eq("is_archived", false).order("name"),
          supabase.from("vendors").select("id, name").eq("is_archived", false).order("name"),
          supabase.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
        ]);
      for (const r of [invoices, payments, expenses, projects, clients, vendors, employees]) {
        if (r.error) throw r.error;
      }
      return {
        invoices: invoices.data ?? [],
        payments: payments.data ?? [],
        expenses: expenses.data ?? [],
        projects: projects.data ?? [],
        clients: clients.data ?? [],
        vendors: vendors.data ?? [],
        employees: employees.data ?? [],
      };
    },
  });

  const createInvoice = useMutation({
    mutationFn: async (v: InvoiceForm) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase.from("invoices").insert({
        company_id: employee.company_id,
        invoice_code: v.invoiceCode,
        title: v.title,
        invoice_type: v.invoiceType,
        project_id: v.projectId || null,
        client_id: v.clientId || null,
        invoice_date: v.invoiceDate,
        due_date: v.dueDate || null,
        tax_percent: Number(v.taxPercent || 0),
        retention_percent: Number(v.retentionPercent || 0),
        advance_adjusted: Number(v.advanceAdjusted || 0),
        notes: v.notes || null,
        raised_by: employee.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice created — add the billed lines next");
      setOpenInvoice(false);
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createPayment = useMutation({
    mutationFn: async (v: {
      paymentCode: string;
      direction: string;
      amount: string;
      paidOn: string;
      mode: string;
      reference: string;
      invoiceId: string;
      projectId: string;
      vendorId: string;
      tds: string;
      remarks: string;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const invoice = query.data?.invoices.find((i) => i.id === v.invoiceId);
      const { error } = await supabase.from("payments").insert({
        company_id: employee.company_id,
        payment_code: v.paymentCode,
        direction: v.direction,
        amount: Number(v.amount || 0),
        paid_on: v.paidOn,
        mode: v.mode,
        reference: v.reference || null,
        invoice_id: v.direction === "inbound" ? v.invoiceId || null : null,
        project_id: v.projectId || invoice?.project_id || null,
        client_id: v.direction === "inbound" ? (invoice?.client_id ?? null) : null,
        vendor_id: v.direction === "outbound" ? v.vendorId || null : null,
        tds_amount: Number(v.tds || 0),
        remarks: v.remarks || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setOpenPayment(false);
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createExpense = useMutation({
    mutationFn: async (v: {
      expenseCode: string;
      title: string;
      category: string;
      projectId: string;
      employeeId: string;
      expenseDate: string;
      amount: string;
      taxAmount: string;
      reimbursable: string;
      mode: string;
      billRef: string;
      remarks: string;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase.from("expenses").insert({
        company_id: employee.company_id,
        expense_code: v.expenseCode,
        title: v.title,
        category: v.category,
        project_id: v.projectId || null,
        employee_id: v.employeeId || employee.id,
        expense_date: v.expenseDate,
        amount: Number(v.amount || 0),
        tax_amount: Number(v.taxAmount || 0),
        is_reimbursable: v.reimbursable === "yes",
        payment_mode: v.mode,
        bill_reference: v.billRef || null,
        remarks: v.remarks || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense booked");
      setOpenExpense(false);
      void queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const invoices = query.data?.invoices ?? [];
    const payments = query.data?.payments ?? [];
    return invoices
      .filter((i) => projectFilter === "all" || i.project_id === projectFilter)
      .map((invoice) => {
        const totals = invoiceTotals(invoice.invoice_items ?? [], invoice);
        const received = sumPayments(
          payments.filter((p) => p.invoice_id === invoice.id),
          "inbound",
        );
        const outstanding = Math.max(totals.net - received, 0);
        return {
          invoice,
          totals,
          received,
          outstanding,
          overdue: daysOverdue(invoice.due_date, outstanding),
        };
      });
  }, [query.data, projectFilter]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const payments = (query.data?.payments ?? []).filter(
    (p) => projectFilter === "all" || p.project_id === projectFilter,
  );
  const expenses = (query.data?.expenses ?? []).filter(
    (e) => projectFilter === "all" || e.project_id === projectFilter,
  );

  const billed = rows.reduce((s, r) => s + r.totals.net, 0);
  const collected = rows.reduce((s, r) => s + r.received, 0);
  const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const overdue = rows.filter((r) => r.overdue > 0).reduce((s, r) => s + r.outstanding, 0);
  const spend =
    expenses.reduce((s, e) => s + Number(e.amount ?? 0) + Number(e.tax_amount ?? 0), 0) +
    sumPayments(payments, "outbound");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Client billing, collections, vendor payouts and project spend — every rupee traced to a project."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[210px]">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {(query.data?.projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit ? (
              <>
                <PaymentDialog
                  open={openPayment}
                  setOpen={setOpenPayment}
                  data={query.data}
                  onSubmit={(v) => createPayment.mutate(v)}
                  pending={createPayment.isPending}
                />
                <ExpenseDialog
                  open={openExpense}
                  setOpen={setOpenExpense}
                  data={query.data}
                  onSubmit={(v) => createExpense.mutate(v)}
                  pending={createExpense.isPending}
                />
                <InvoiceDialog
                  open={openInvoice}
                  setOpen={setOpenInvoice}
                  data={query.data}
                  onSubmit={(v) => createInvoice.mutate(v)}
                  pending={createInvoice.isPending}
                />
              </>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Billed" value={inr(billed, true)} icon={<IndianRupee className="h-4 w-4" />} />
        <StatCard label="Collected" value={inr(collected, true)} tone="success" />
        <StatCard label="Outstanding" value={inr(outstanding, true)} tone="warning" />
        <StatCard
          label="Overdue"
          value={inr(overdue, true)}
          tone={overdue > 0 ? "danger" : "default"}
          hint={`${rows.filter((r) => r.overdue > 0).length} invoice(s) past due`}
        />
        <StatCard label="Spend booked" value={inr(spend, true)} hint="Vendor payouts + expenses" />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payments">Receipts & payouts</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          {rows.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Raise a bill against a project to start tracking collections."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Invoice</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Date / Due</th>
                    <th className="px-3 py-2 text-right">Net payable</th>
                    <th className="px-3 py-2 text-right">Received</th>
                    <th className="px-3 py-2 text-right">Outstanding</th>
                    <th className="px-3 py-2">State</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ invoice, totals, received, outstanding: due, overdue: late }) => (
                    <tr key={invoice.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <Link
                          to="/finance/$invoiceId"
                          params={{ invoiceId: invoice.id }}
                          className="font-medium text-primary hover:underline"
                        >
                          {invoice.invoice_code}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {titleCase(invoice.invoice_type)} · {invoice.title}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {invoice.projects?.project_code ?? "—"}
                        <p className="text-muted-foreground">{invoice.clients?.name ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {shortDate(invoice.invoice_date)}
                        <p className={late > 0 ? "text-destructive" : "text-muted-foreground"}>
                          {invoice.due_date ? shortDate(invoice.due_date) : "—"}
                          {late > 0 ? ` · ${late}d late` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-right text-numeric">{inr(totals.net)}</td>
                      <td className="px-3 py-2 text-right text-numeric">{inr(received)}</td>
                      <td className="px-3 py-2 text-right text-numeric font-medium">{inr(due)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge value={invoice.approval_state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          {payments.length === 0 ? (
            <EmptyState title="No payments recorded" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Direction</th>
                    <th className="px-3 py-2">Against</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Mode</th>
                    <th className="px-3 py-2 text-right">TDS</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="font-medium">{p.payment_code}</span>
                        <p className="text-xs text-muted-foreground">{p.reference ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            p.direction === "inbound"
                              ? "text-success text-xs font-medium"
                              : "text-destructive text-xs font-medium"
                          }
                        >
                          {p.direction === "inbound" ? "Received" : "Paid out"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {p.invoices?.invoice_code ?? p.vendors?.name ?? "—"}
                        <p className="text-muted-foreground">{p.projects?.project_code ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2 text-xs">{shortDate(p.paid_on)}</td>
                      <td className="px-3 py-2 text-xs">{titleCase(p.mode)}</td>
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
        </TabsContent>

        <TabsContent value="expenses" className="mt-4">
          {expenses.length === 0 ? (
            <EmptyState title="No expenses booked" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Expense</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Project</th>
                    <th className="px-3 py-2">Spent by</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">State</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="font-medium">{e.title}</span>
                        <p className="text-xs text-muted-foreground">
                          {e.expense_code} · {e.bill_reference ?? "no bill"}
                          {e.is_reimbursable
                            ? e.is_reimbursed
                              ? " · reimbursed"
                              : " · reimbursement due"
                            : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">{titleCase(e.category)}</td>
                      <td className="px-3 py-2 text-xs">{e.projects?.project_code ?? "Overhead"}</td>
                      <td className="px-3 py-2 text-xs">{e.employees?.full_name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs">{shortDate(e.expense_date)}</td>
                      <td className="px-3 py-2 text-right text-numeric">
                        {inr(Number(e.amount ?? 0) + Number(e.tax_amount ?? 0))}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge value={e.approval_state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type FinanceData = {
  projects: { id: string; name: string; project_code: string; client_id: string | null }[];
  clients: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  employees: { id: string; full_name: string }[];
  invoices: { id: string; invoice_code: string; project_id: string | null }[];
};

function InvoiceDialog({
  open,
  setOpen,
  data,
  onSubmit,
  pending,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  data: FinanceData | undefined;
  onSubmit: (v: InvoiceForm) => void;
  pending: boolean;
}) {
  const [form, setForm] = useState<InvoiceForm>({
    invoiceCode: "",
    title: "",
    invoiceType: "interim",
    projectId: "",
    clientId: "",
    invoiceDate: today(),
    dueDate: "",
    taxPercent: "18",
    retentionPercent: "5",
    advanceAdjusted: "0",
    notes: "",
  });
  const set = (k: keyof InvoiceForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New invoice</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Raise an invoice</DialogTitle>
          <DialogDescription>
            Create the bill header, then add measured lines on the invoice page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Invoice number</Label>
            <Input
              value={form.invoiceCode}
              onChange={(e) => set("invoiceCode", e.target.value)}
              placeholder="INV-2026-008"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.invoiceType} onValueChange={(v) => set("invoiceType", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {titleCase(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="RA Bill 3 — Godrej Emerald"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select
              value={form.projectId}
              onValueChange={(v) => {
                set("projectId", v);
                const p = data?.projects.find((x) => x.id === v);
                if (p?.client_id) set("clientId", p.client_id);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(data?.projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={form.clientId} onValueChange={(v) => set("clientId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {(data?.clients ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Invoice date</Label>
            <Input
              type="date"
              value={form.invoiceDate}
              onChange={(e) => set("invoiceDate", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>GST %</Label>
            <Input
              type="number"
              value={form.taxPercent}
              onChange={(e) => set("taxPercent", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Retention %</Label>
            <Input
              type="number"
              value={form.retentionPercent}
              onChange={(e) => set("retentionPercent", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Advance adjusted (₹)</Label>
            <Input
              type="number"
              value={form.advanceAdjusted}
              onChange={(e) => set("advanceAdjusted", e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="What this bill covers"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !form.invoiceCode || !form.title}
            onClick={() => onSubmit(form)}
          >
            {pending ? "Saving…" : "Create invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  open,
  setOpen,
  data,
  onSubmit,
  pending,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  data: FinanceData | undefined;
  onSubmit: (v: {
    paymentCode: string;
    direction: string;
    amount: string;
    paidOn: string;
    mode: string;
    reference: string;
    invoiceId: string;
    projectId: string;
    vendorId: string;
    tds: string;
    remarks: string;
  }) => void;
  pending: boolean;
}) {
  const [direction, setDirection] = useState("inbound");
  const [paymentCode, setPaymentCode] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [mode, setMode] = useState("neft");
  const [reference, setReference] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [tds, setTds] = useState("0");
  const [remarks, setRemarks] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Record payment</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Money received from a client against an invoice, or paid out to a vendor.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inbound">Received from client</SelectItem>
                <SelectItem value="outbound">Paid to vendor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference number</Label>
            <Input
              value={paymentCode}
              onChange={(e) => setPaymentCode(e.target.value)}
              placeholder="RCT-2026-005"
            />
          </div>
          {direction === "inbound" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Against invoice</Label>
              <Select value={invoiceId} onValueChange={setInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.invoices ?? []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.invoice_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={setVendorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.vendors ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {(data?.projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_code} — {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>TDS (₹)</Label>
            <Input type="number" value={tds} onChange={(e) => setTds(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Bank reference</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !paymentCode || !amount}
            onClick={() =>
              onSubmit({
                paymentCode,
                direction,
                amount,
                paidOn,
                mode,
                reference,
                invoiceId,
                projectId,
                vendorId,
                tds,
                remarks,
              })
            }
          >
            {pending ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({
  open,
  setOpen,
  data,
  onSubmit,
  pending,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  data: FinanceData | undefined;
  onSubmit: (v: {
    expenseCode: string;
    title: string;
    category: string;
    projectId: string;
    employeeId: string;
    expenseDate: string;
    amount: string;
    taxAmount: string;
    reimbursable: string;
    mode: string;
    billRef: string;
    remarks: string;
  }) => void;
  pending: boolean;
}) {
  const [expenseCode, setExpenseCode] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("site");
  const [projectId, setProjectId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [expenseDate, setExpenseDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [reimbursable, setReimbursable] = useState("no");
  const [mode, setMode] = useState("cash");
  const [billRef, setBillRef] = useState("");
  const [remarks, setRemarks] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Book expense</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book an expense</DialogTitle>
          <DialogDescription>Site or office spend charged to a project.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Voucher number</Label>
            <Input
              value={expenseCode}
              onChange={(e) => setExpenseCode(e.target.value)}
              placeholder="EXP-2026-009"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {titleCase(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>What was it for</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Overhead" />
              </SelectTrigger>
              <SelectContent>
                {(data?.projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Spent by</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Me" />
              </SelectTrigger>
              <SelectContent>
                {(data?.employees ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>GST (₹)</Label>
            <Input type="number" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Paid by</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reimbursable</Label>
            <Select value={reimbursable} onValueChange={setReimbursable}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no">No — company paid</SelectItem>
                <SelectItem value="yes">Yes — repay employee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bill reference</Label>
            <Input value={billRef} onChange={(e) => setBillRef(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !expenseCode || !title || !amount}
            onClick={() =>
              onSubmit({
                expenseCode,
                title,
                category,
                projectId,
                employeeId,
                expenseDate,
                amount,
                taxAmount,
                reimbursable,
                mode,
                billRef,
                remarks,
              })
            }
          >
            {pending ? "Saving…" : "Book expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

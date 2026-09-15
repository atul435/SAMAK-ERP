import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildDecisions } from "@/lib/jarvis-decisions";

export type JarvisClient = SupabaseClient<Database>;

/**
 * Builds the ERP snapshot JARVIS is allowed to reason over.
 * Every read uses the caller's own RLS-scoped client, so the assistant can
 * never see a record the signed-in user could not open themselves.
 */
export async function buildSnapshot(supabase: JarvisClient, page: string | null, userId: string) {
  const [
    employee,
    projects,
    leads,
    opportunities,
    approvals,
    notifications,
    invoices,
    payments,
    expenses,
    purchaseOrders,
    stock,
    siteReports,
    boqProgress,
    nursery,
    leave,
    clients,
    vendors,
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("full_name, designation, primary_role, company_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("projects")
      .select(
        "id, project_code, name, city, health, progress_percent, contract_value, budget_cost, actual_cost, committed_cost, billed_amount, collected_amount, start_date, end_date, status",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("leads")
      .select("lead_code, title, stage, estimated_value, score, next_action, next_action_date")
      .order("score", { ascending: false })
      .limit(40),
    supabase
      .from("opportunities")
      .select("opportunity_code, title, value, probability, stage, expected_close_date")
      .limit(40),
    supabase
      .from("approval_requests")
      .select("request_code, entity_type, entity_label, amount, state, summary, created_at")
      .in("state", ["submitted", "pending_approval"])
      .limit(40),
    supabase
      .from("notifications")
      .select("title, body, category, severity")
      .eq("is_read", false)
      .limit(25),
    supabase
      .from("invoices")
      .select(
        "id, invoice_code, title, invoice_type, status, approval_state, invoice_date, due_date, tax_percent, retention_percent, advance_adjusted, project_id, client_id, invoice_items(quantity, unit_rate)",
      )
      .eq("is_archived", false)
      .order("invoice_date", { ascending: false })
      .limit(40),
    supabase
      .from("payments")
      .select(
        "payment_code, direction, paid_on, amount, mode, reference, tds_amount, invoice_id, purchase_order_id, project_id, remarks",
      )
      .order("paid_on", { ascending: false })
      .limit(60),
    supabase
      .from("expenses")
      .select(
        "expense_code, title, category, expense_date, amount, tax_amount, status, approval_state, project_id",
      )
      .order("expense_date", { ascending: false })
      .limit(40),
    supabase
      .from("purchase_orders")
      .select(
        "id, po_code, title, status, approval_state, expected_date, tax_percent, freight_amount, notes, project_id, vendor_id, purchase_order_items(description, uom, quantity, unit_rate, received_quantity)",
      )
      .eq("is_archived", false)
      .order("expected_date", { ascending: true })
      .limit(40),
    supabase
      .from("stock_movements")
      .select(
        "movement_type, description, quantity, uom, unit_rate, moved_at, project_id, store_id",
      )
      .order("moved_at", { ascending: false })
      .limit(60),
    supabase
      .from("site_reports")
      .select(
        "report_date, weather, progress_percent, work_done, blockers, approval_state, project_id",
      )
      .order("report_date", { ascending: false })
      .limit(25),
    supabase
      .from("project_boq_progress")
      .select("project_id, planned_amount, executed_amount, progress_percent")
      .limit(40),
    supabase
      .from("nursery_batches")
      .select(
        "batch_code, plant_size, quantity_received, quantity_mortality, unit_cost, health_grade, received_date, project_id",
      )
      .eq("is_archived", false)
      .limit(40),
    supabase
      .from("leave_requests")
      .select("leave_type, from_date, to_date, days, approval_state")
      .in("approval_state", ["submitted", "pending_approval"])
      .limit(25),
    supabase.from("clients").select("id, name").limit(100),
    supabase.from("vendors").select("id, name").limit(100),
  ]);

  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const vendorName = new Map((vendors.data ?? []).map((v) => [v.id, v.name]));

  const today = new Date();
  const daysBetween = (iso: string | null) =>
    iso ? Math.floor((today.getTime() - new Date(iso).getTime()) / 86400000) : 0;

  const paymentRows = payments.data ?? [];
  const projectRows = projects.data ?? [];
  const projectName = new Map(projectRows.map((p) => [p.project_code, p.name]));
  const projectCode = new Map(projectRows.map((p) => [p.id, p.project_code]));

  // --- Receivables: bill value net of retention and advance, less receipts ---
  const invoiceRows = (invoices.data ?? []).map((inv) => {
    const items = (inv.invoice_items ?? []) as Array<{
      quantity: number | null;
      unit_rate: number | null;
    }>;
    const basic = items.reduce((s, i) => s + Number(i.quantity ?? 0) * Number(i.unit_rate ?? 0), 0);
    const tax = (basic * Number(inv.tax_percent ?? 0)) / 100;
    const retention = (basic * Number(inv.retention_percent ?? 0)) / 100;
    const advance = Number(inv.advance_adjusted ?? 0);
    const netPayable = basic + tax - retention - advance;
    const received = paymentRows
      .filter((p) => p.direction === "inbound" && p.invoice_id === inv.id)
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const balanceDue = Math.max(netPayable - received, 0);
    const overdueDays = balanceDue > 0 ? Math.max(daysBetween(inv.due_date), 0) : 0;
    return {
      id: inv.id,
      invoice_code: inv.invoice_code,
      client_name: inv.client_id ? (clientName.get(inv.client_id) ?? null) : null,
      project_code: inv.project_id ? (projectCode.get(inv.project_id) ?? null) : null,
      title: inv.title,
      invoice_type: inv.invoice_type,
      status: inv.status,
      approval_state: inv.approval_state,
      invoice_date: inv.invoice_date,
      due_date: inv.due_date,
      project_id: inv.project_id,
      basic_amount: Math.round(basic),
      tax_amount: Math.round(tax),
      retention_held: Math.round(retention),
      advance_adjusted: Math.round(advance),
      net_payable: Math.round(netPayable),
      amount_received: Math.round(received),
      balance_due: Math.round(balanceDue),
      days_overdue: overdueDays,
    };
  });

  const overdueCollections = invoiceRows
    .filter((i) => i.days_overdue > 0)
    .sort((a, b) => b.days_overdue - a.days_overdue);

  // --- Purchase orders: ordered vs actually received, and lateness ---
  const poRows = (purchaseOrders.data ?? []).map((po) => {
    const items = (po.purchase_order_items ?? []) as Array<{
      description: string | null;
      uom: string | null;
      quantity: number | null;
      unit_rate: number | null;
      received_quantity: number | null;
    }>;
    const orderedValue = items.reduce(
      (s, i) => s + Number(i.quantity ?? 0) * Number(i.unit_rate ?? 0),
      0,
    );
    const receivedValue = items.reduce(
      (s, i) => s + Number(i.received_quantity ?? 0) * Number(i.unit_rate ?? 0),
      0,
    );
    const paid = paymentRows
      .filter((p) => p.direction === "outbound" && p.purchase_order_id === po.id)
      .reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const daysLate = daysBetween(po.expected_date);
    return {
      id: po.id,
      po_code: po.po_code,
      vendor_name: po.vendor_id ? (vendorName.get(po.vendor_id) ?? null) : null,
      project_code: po.project_id ? (projectCode.get(po.project_id) ?? null) : null,
      title: po.title,
      status: po.status,
      approval_state: po.approval_state,
      expected_date: po.expected_date,
      project_id: po.project_id,
      ordered_value: Math.round(orderedValue),
      received_value: Math.round(receivedValue),
      pending_value: Math.round(Math.max(orderedValue - receivedValue, 0)),
      percent_received: orderedValue > 0 ? Math.round((receivedValue / orderedValue) * 100) : 0,
      amount_paid: Math.round(paid),
      days_late: daysLate > 0 && orderedValue > receivedValue ? daysLate : 0,
      pending_lines: items
        .filter((i) => Number(i.received_quantity ?? 0) < Number(i.quantity ?? 0))
        .map((i) => ({
          description: i.description,
          uom: i.uom,
          ordered: Number(i.quantity ?? 0),
          received: Number(i.received_quantity ?? 0),
        })),
      notes: po.notes,
    };
  });

  const lateDeliveries = poRows
    .filter(
      (po) =>
        po.days_late > 0 && (po.approval_state === "approved" || po.approval_state === "executed"),
    )
    .sort((a, b) => b.days_late - a.days_late);

  // --- Cash position from actual receipts and payouts ---
  const cashIn = paymentRows
    .filter((p) => p.direction === "inbound")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const cashOut = paymentRows
    .filter((p) => p.direction === "outbound")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const expenseRows = expenses.data ?? [];
  const expenseOut = expenseRows.reduce(
    (s, e) => s + Number(e.amount ?? 0) + Number(e.tax_amount ?? 0),
    0,
  );
  const billedNet = invoiceRows.reduce((s, i) => s + i.net_payable, 0);
  const outstanding = invoiceRows.reduce((s, i) => s + i.balance_due, 0);

  const cashPosition = {
    receipts_from_clients: Math.round(cashIn),
    payouts_to_vendors: Math.round(cashOut),
    expenses_booked: Math.round(expenseOut),
    net_cash_movement: Math.round(cashIn - cashOut - expenseOut),
    total_billed_net: Math.round(billedNet),
    total_outstanding: Math.round(outstanding),
    overdue_amount: Math.round(overdueCollections.reduce((s, i) => s + i.balance_due, 0)),
    committed_unreceived_on_orders: Math.round(poRows.reduce((s, p) => s + p.pending_value, 0)),
  };

  const decisions = buildDecisions(overdueCollections, lateDeliveries);

  return {
    generatedAt: new Date().toISOString(),
    user: employee.data,
    currentPage: page ?? "unknown",
    projects: projectRows,
    projectNames: Object.fromEntries(projectName),
    projectExecution: boqProgress.data ?? [],
    leads: leads.data ?? [],
    opportunities: opportunities.data ?? [],
    pendingApprovals: approvals.data ?? [],
    alerts: notifications.data ?? [],
    cashPosition,
    invoices: invoiceRows,
    overdueCollections,
    payments: paymentRows,
    expenses: expenseRows,
    purchaseOrders: poRows,
    lateDeliveries,
    decisions,
    stockMovements: stock.data ?? [],
    siteReports: siteReports.data ?? [],
    nurseryBatches: nursery.data ?? [],
    pendingLeave: leave.data ?? [],
    companyId: employee.data?.company_id ?? null,
  };
}

export const JARVIS_RULES = `You are GrowIQ, the intelligence layer of EnvironIQ — the ERP operating system of Samak Landscape (India, ₹ amounts, Indian business context).

STRICT RULES:
- Use ONLY the JSON ERP snapshot supplied in the user message. Never invent projects, clients, amounts, dates or names.
- If the snapshot lacks the data, say so plainly and name the module where it will live.
- You may analyse and recommend, but you must NEVER claim to have executed a sensitive action (payments, tender submission, contracts, salary, pricing, purchase orders, deletions). Those require an authorised human approval.
- Amounts must be quoted exactly as in the data, formatted in Indian rupees (lakh/crore where helpful).
- Be specific: cite record codes (PRJ-, BOQ-, PO-, INV-, APR-, LEA-) rather than generalities.
- The "decisions" block holds pre-computed, pre-linked decision suggestions (overdue collections and late deliveries). When a question touches money owed or late supply, reference those exactly, by their titles, amounts and record codes.
- For money questions use the pre-computed blocks: cashPosition (receipts, payouts, expenses, outstanding, overdue), overdueCollections (bills past due with days_overdue and balance_due) and lateDeliveries (approved orders past expected_date with pending_value and days_late). Quote those figures exactly; never re-derive or estimate them.`;

/**
 * GrowIQ calls Anthropic's Claude API directly — Samak's own AI assistant,
 * not routed through any third-party platform's gateway. claude-sonnet-5
 * rejects assistant-turn prefill ("must end with a user message"), so JSON
 * is enforced purely through the system prompt's format instructions and
 * recovered defensively (stripping any ```json fences the model adds).
 */
export async function callGateway(system: string, user: string, maxTokens = 1536) {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new Error("GrowIQ is not configured yet — missing ANTHROPIC_API_KEY.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`GrowIQ (Anthropic) error [${response.status}]: ${body}`);
    if (response.status === 429)
      throw new Error("GrowIQ is rate limited right now. Please try again shortly.");
    if (response.status === 401) throw new Error("GrowIQ's API key is invalid or missing.");
    throw new Error(`GrowIQ could not complete the analysis (${response.status}).`);
  }

  const payload = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = payload.content?.find((block) => block.type === "text")?.text ?? "";
  const raw = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { answer: raw || text } as Record<string, unknown>;
  }
}

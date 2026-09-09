import { inr } from "@/lib/format";

/**
 * Deterministic decision suggestions. These are computed from real ERP rows —
 * never from the model — so every figure and link is exact. JARVIS may only
 * rewrite the wording of the suggested next step, never the numbers.
 */

export interface JarvisDecisionLink {
  label: string;
  to: string;
  params?: Record<string, string>;
}

export interface JarvisDecision {
  id: string;
  kind: "collection" | "delivery";
  title: string;
  detail: string;
  amount: number;
  severity: "low" | "medium" | "high";
  sources: string[];
  suggestion: string;
  requiresApproval: boolean;
  links: JarvisDecisionLink[];
}

export interface OverdueInput {
  id: string;
  invoice_code: string;
  title: string | null;
  due_date: string | null;
  days_overdue: number;
  balance_due: number;
  amount_received: number;
  net_payable: number;
  project_id: string | null;
  client_name: string | null;
  project_code: string | null;
}

export interface LateDeliveryInput {
  id: string;
  po_code: string;
  title: string | null;
  expected_date: string | null;
  days_late: number;
  pending_value: number;
  percent_received: number;
  amount_paid: number;
  project_id: string | null;
  vendor_name: string | null;
  project_code: string | null;
  pending_lines: Array<{ description: string | null; uom: string | null; ordered: number; received: number }>;
}

function collectionSeverity(days: number, amount: number): JarvisDecision["severity"] {
  if (days >= 30 || amount >= 2000000) return "high";
  if (days >= 10) return "medium";
  return "low";
}

export function buildDecisions(
  overdue: OverdueInput[],
  late: LateDeliveryInput[],
): JarvisDecision[] {
  const collections = overdue
    .filter((inv) => inv.balance_due > 0)
    .sort((a, b) => b.balance_due - a.balance_due)
    .map<JarvisDecision>((inv) => {
      const who = inv.client_name ?? "the client";
      const partly = inv.amount_received > 0;
      return {
        id: `collection:${inv.id}`,
        kind: "collection",
        title: `Collect ${inr(inv.balance_due)} from ${who}`,
        detail: `${inv.invoice_code}${inv.project_code ? ` on ${inv.project_code}` : ""} — ${inr(
          inv.balance_due,
        )} outstanding of ${inr(inv.net_payable)} payable, ${inv.days_overdue} days past due${
          partly ? `, after a part receipt of ${inr(inv.amount_received)}` : ""
        }.`,
        amount: inv.balance_due,
        severity: collectionSeverity(inv.days_overdue, inv.balance_due),
        sources: [inv.invoice_code, ...(inv.project_code ? [inv.project_code] : [])],
        suggestion: `Send ${who} a reminder against ${inv.invoice_code} for ${inr(
          inv.balance_due,
        )} and confirm a payment date; record the receipt on the bill the day it lands.`,
        requiresApproval: false,
        links: [
          { label: "Open bill", to: "/finance/$invoiceId", params: { invoiceId: inv.id } },
          { label: "Record receipt", to: "/finance/$invoiceId", params: { invoiceId: inv.id } },
          ...(inv.project_id
            ? [
                {
                  label: "Project",
                  to: "/projects/$projectId",
                  params: { projectId: inv.project_id },
                },
              ]
            : []),
        ],
      };
    });

  const deliveries = late
    .filter((po) => po.pending_value > 0)
    .sort((a, b) => b.days_late - a.days_late)
    .map<JarvisDecision>((po) => {
      const who = po.vendor_name ?? "the supplier";
      const pending = po.pending_lines
        .slice(0, 3)
        .map((l) => `${Math.round(l.ordered - l.received)} ${l.uom ?? ""} ${l.description ?? ""}`.trim())
        .join("; ");
      return {
        id: `delivery:${po.id}`,
        kind: "delivery",
        title: `Chase ${who} on ${po.po_code}`,
        detail: `${po.days_late} days past the promised date${
          po.project_code ? ` for ${po.project_code}` : ""
        } — ${inr(po.pending_value)} still to be delivered (${po.percent_received}% received)${
          po.amount_paid > 0 ? `, with ${inr(po.amount_paid)} already paid` : ""
        }.${pending ? ` Pending: ${pending}.` : ""}`,
        amount: po.pending_value,
        severity: po.days_late >= 14 || po.percent_received === 0 ? "high" : "medium",
        sources: [po.po_code, ...(po.project_code ? [po.project_code] : [])],
        suggestion: `Ask ${who} for a firm delivery date on the balance of ${po.po_code} (${inr(
          po.pending_value,
        )}) and book the receipt against the order as material arrives.`,
        requiresApproval: false,
        links: [
          { label: "Open order", to: "/procurement/$poId", params: { poId: po.id } },
          ...(po.project_id
            ? [
                {
                  label: "Project",
                  to: "/projects/$projectId",
                  params: { projectId: po.project_id },
                },
              ]
            : []),
        ],
      };
    });

  return [...collections, ...deliveries];
}

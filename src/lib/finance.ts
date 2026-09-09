export const INVOICE_TYPES = ["advance", "interim", "final", "retention", "amc"] as const;
export const PAYMENT_MODES = ["neft", "rtgs", "upi", "cheque", "cash", "card"] as const;
export const EXPENSE_CATEGORIES = [
  "site",
  "travel",
  "office",
  "statutory",
  "marketing",
  "other",
] as const;
export const LEAVE_TYPES = ["casual", "sick", "earned", "unpaid", "comp_off"] as const;

export type InvoiceItemLike = {
  quantity: number | null;
  unit_rate: number | null;
};

export type InvoiceMarkups = {
  tax_percent: number | null;
  retention_percent: number | null;
  advance_adjusted: number | null;
};

export type InvoiceTotals = {
  basic: number;
  tax: number;
  retention: number;
  advance: number;
  gross: number;
  net: number;
};

export function invoiceLineAmount(item: InvoiceItemLike): number {
  return Number(item.quantity ?? 0) * Number(item.unit_rate ?? 0);
}

export function invoiceTotals(items: InvoiceItemLike[], m: InvoiceMarkups): InvoiceTotals {
  const basic = items.reduce((sum, i) => sum + invoiceLineAmount(i), 0);
  const tax = (basic * Number(m.tax_percent ?? 0)) / 100;
  const retention = (basic * Number(m.retention_percent ?? 0)) / 100;
  const advance = Number(m.advance_adjusted ?? 0);
  const gross = basic + tax;
  return { basic, tax, retention, advance, gross, net: gross - retention - advance };
}

export type PaymentLike = {
  direction: string | null;
  amount: number | null;
  invoice_id?: string | null;
  project_id?: string | null;
};

export function sumPayments(payments: PaymentLike[], direction?: string): number {
  return payments
    .filter((p) => (direction ? p.direction === direction : true))
    .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
}

export type PayslipLike = {
  basic: number | null;
  hra: number | null;
  allowances: number | null;
  overtime: number | null;
  pf_deduction: number | null;
  esi_deduction: number | null;
  tds_deduction: number | null;
  other_deduction: number | null;
  days_present?: number | null;
};

export type PayslipTotals = { earnings: number; deductions: number; net: number };

export function payslipTotals(item: PayslipLike): PayslipTotals {
  const earnings =
    Number(item.basic ?? 0) +
    Number(item.hra ?? 0) +
    Number(item.allowances ?? 0) +
    Number(item.overtime ?? 0);
  const deductions =
    Number(item.pf_deduction ?? 0) +
    Number(item.esi_deduction ?? 0) +
    Number(item.tds_deduction ?? 0) +
    Number(item.other_deduction ?? 0);
  return { earnings, deductions, net: earnings - deductions };
}

export function payrollTotals(items: PayslipLike[]): PayslipTotals {
  return items.reduce<PayslipTotals>(
    (acc, i) => {
      const t = payslipTotals(i);
      return {
        earnings: acc.earnings + t.earnings,
        deductions: acc.deductions + t.deductions,
        net: acc.net + t.net,
      };
    },
    { earnings: 0, deductions: 0, net: 0 },
  );
}

/** Days between two dates, inclusive — used for leave duration. */
export function inclusiveDays(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export function daysOverdue(dueDate: string | null | undefined, outstanding: number): number {
  if (!dueDate || outstanding <= 0) return 0;
  const diff = Date.now() - new Date(dueDate).getTime();
  return diff > 0 ? Math.floor(diff / 86400000) : 0;
}

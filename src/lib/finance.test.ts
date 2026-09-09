import { describe, expect, it } from "vitest";
import {
  daysOverdue,
  inclusiveDays,
  invoiceTotals,
  payrollTotals,
  payslipTotals,
  sumPayments,
} from "./finance";

describe("invoiceTotals", () => {
  it("charges tax on the basic value but deducts retention and advance after tax", () => {
    const items = [{ quantity: 10, unit_rate: 1000 }]; // basic 10,000
    const totals = invoiceTotals(items, {
      tax_percent: 18,
      retention_percent: 5,
      advance_adjusted: 2000,
    });
    expect(totals.basic).toBe(10000);
    expect(totals.tax).toBe(1800);
    expect(totals.retention).toBe(500); // 5% of basic, not of gross
    expect(totals.gross).toBe(11800); // basic + tax
    expect(totals.net).toBe(11800 - 500 - 2000);
  });
});

describe("sumPayments", () => {
  const payments = [
    { direction: "in", amount: 50000 },
    { direction: "out", amount: 12000 },
    { direction: "in", amount: 8000 },
  ];

  it("sums every payment when no direction filter is given", () => {
    expect(sumPayments(payments)).toBe(70000);
  });

  it("filters by direction when one is given", () => {
    expect(sumPayments(payments, "in")).toBe(58000);
    expect(sumPayments(payments, "out")).toBe(12000);
  });
});

describe("payslipTotals / payrollTotals", () => {
  it("nets deductions from earnings for one payslip", () => {
    const slip = {
      basic: 20000,
      hra: 8000,
      allowances: 2000,
      overtime: 1000,
      pf_deduction: 2400,
      esi_deduction: 200,
      tds_deduction: 500,
      other_deduction: 0,
    };
    const totals = payslipTotals(slip);
    expect(totals.earnings).toBe(31000);
    expect(totals.deductions).toBe(3100);
    expect(totals.net).toBe(27900);
  });

  it("sums earnings, deductions and net across an entire payroll run", () => {
    const run = [
      {
        basic: 20000,
        hra: 8000,
        allowances: 0,
        overtime: 0,
        pf_deduction: 2400,
        esi_deduction: 0,
        tds_deduction: 0,
        other_deduction: 0,
      },
      {
        basic: 15000,
        hra: 6000,
        allowances: 0,
        overtime: 500,
        pf_deduction: 1800,
        esi_deduction: 0,
        tds_deduction: 0,
        other_deduction: 0,
      },
    ];
    const totals = payrollTotals(run);
    expect(totals.earnings).toBe(28000 + 21500);
    expect(totals.deductions).toBe(2400 + 1800);
    expect(totals.net).toBe(28000 + 21500 - 2400 - 1800);
  });
});

describe("inclusiveDays", () => {
  it("counts both the start and end date", () => {
    expect(inclusiveDays("2026-03-01", "2026-03-03")).toBe(3);
  });

  it("treats a single-day span as 1 day", () => {
    expect(inclusiveDays("2026-03-01", "2026-03-01")).toBe(1);
  });

  it("returns 0 for an inverted or invalid range", () => {
    expect(inclusiveDays("2026-03-05", "2026-03-01")).toBe(0);
    expect(inclusiveDays("not-a-date", "2026-03-01")).toBe(0);
  });
});

describe("daysOverdue", () => {
  it("is 0 once the invoice is fully paid, regardless of due date", () => {
    expect(daysOverdue("2020-01-01", 0)).toBe(0);
  });

  it("is 0 with no due date on record", () => {
    expect(daysOverdue(null, 5000)).toBe(0);
  });

  it("counts full days elapsed since a past due date while a balance remains", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    expect(daysOverdue(tenDaysAgo, 5000)).toBe(10);
  });

  it("is 0 for a due date that has not arrived yet", () => {
    const inTenDays = new Date(Date.now() + 10 * 86400000).toISOString();
    expect(daysOverdue(inTenDays, 5000)).toBe(0);
  });
});

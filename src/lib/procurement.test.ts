import { describe, expect, it } from "vitest";
import { movementSign, poLineAmount, poTotals, stockBalances } from "./procurement";

describe("poTotals", () => {
  const items = [
    { quantity: 100, unit_rate: 50, received_quantity: 100 }, // fully received
    { quantity: 40, unit_rate: 200, received_quantity: 10 }, // partially received
  ];

  it("builds basic, freight, tax and grand value in order", () => {
    const totals = poTotals(items, { tax_percent: 18, freight_amount: 500 });
    // basic = 100*50 + 40*200 = 5000 + 8000 = 13000
    expect(totals.basic).toBe(13000);
    expect(totals.freight).toBe(500);
    expect(totals.tax).toBeCloseTo((13000 + 500) * 0.18);
    expect(totals.grand).toBeCloseTo(13000 + 500 + (13000 + 500) * 0.18);
  });

  it("computes received percent across all lines, not per line", () => {
    const totals = poTotals(items, { tax_percent: 0, freight_amount: 0 });
    // ordered 140, received 110 -> ~78.57%
    expect(totals.orderedQty).toBe(140);
    expect(totals.receivedQty).toBe(110);
    expect(totals.receivedPercent).toBeCloseTo((110 / 140) * 100);
  });

  it("does not divide by zero on an order with no lines", () => {
    const totals = poTotals([], { tax_percent: 18, freight_amount: 0 });
    expect(totals.receivedPercent).toBe(0);
    expect(totals.grand).toBe(0);
  });
});

describe("poLineAmount", () => {
  it("ignores received_quantity — it prices the order, not the delivery", () => {
    expect(poLineAmount({ quantity: 3, unit_rate: 150, received_quantity: 1 })).toBe(450);
  });
});

describe("movementSign", () => {
  it("treats issue and transfer as outbound", () => {
    expect(movementSign("issue")).toBe(-1);
    expect(movementSign("transfer")).toBe(-1);
  });

  it("treats receipt, return and adjustment as inbound (adjustment carries its own sign)", () => {
    expect(movementSign("receipt")).toBe(1);
    expect(movementSign("return")).toBe(1);
    expect(movementSign("adjustment")).toBe(1);
  });
});

describe("stockBalances", () => {
  it("nets receipts against issues per store+item and values on-hand stock", () => {
    const movements = [
      {
        movement_type: "receipt",
        quantity: 100,
        unit_rate: 20,
        uom: "nos",
        description: "Cement bag",
        material_id: "mat-1",
        species_id: null,
        store_id: "store-1",
      },
      {
        movement_type: "issue",
        quantity: 30,
        unit_rate: 20,
        uom: "nos",
        description: "Cement bag",
        material_id: "mat-1",
        species_id: null,
        store_id: "store-1",
      },
    ];
    const balances = stockBalances(movements, () => "Cement bag");
    expect(balances).toHaveLength(1);
    const balance = balances[0]!;
    expect(balance.received).toBe(100);
    expect(balance.issued).toBe(30);
    expect(balance.onHand).toBe(70);
    expect(balance.value).toBe(70 * 20);
  });

  it("keeps the same item separate across different stores", () => {
    const movements = [
      {
        movement_type: "receipt",
        quantity: 10,
        unit_rate: 5,
        uom: "nos",
        description: "Trowel",
        material_id: "mat-2",
        species_id: null,
        store_id: "store-a",
      },
      {
        movement_type: "receipt",
        quantity: 4,
        unit_rate: 5,
        uom: "nos",
        description: "Trowel",
        material_id: "mat-2",
        species_id: null,
        store_id: "store-b",
      },
    ];
    const balances = stockBalances(movements, () => "Trowel");
    expect(balances).toHaveLength(2);
    expect(balances.map((b) => b.onHand).sort((a, b) => a - b)).toEqual([4, 10]);
  });
});

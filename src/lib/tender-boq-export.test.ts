import { describe, expect, it } from "vitest";
import { buildTenderBoqWorkbook } from "./tender-boq-export";

describe("buildTenderBoqWorkbook", () => {
  it("computes amounts only for fillable items and sums them into the Total row", async () => {
    const workbook = buildTenderBoqWorkbook({
      projectName: "SAMPLE TOWERS",
      workDescription: "SOFTSCAPE WORKS",
      items: [
        { itemCode: "A", description: "PREAMBLE", quantity: null, uom: null, rate: null },
        { itemCode: "B.1", description: "Clearing site", quantity: 100, uom: "sq.m.", rate: 50 },
        { itemCode: "B.2", description: "Earthwork", quantity: 20, uom: "cu.m.", rate: 200 },
        { itemCode: "B.3", description: "Unpriced item", quantity: 10, uom: "nos.", rate: null },
      ],
    });
    const sheet = workbook.worksheets[0]!;

    // Row 1: title, row 2: work description, row 3: header, rows 4-7: items, row 8: total
    expect(sheet.getRow(1).getCell(1).value).toBe("SAMPLE TOWERS");
    expect(sheet.getRow(4).getCell(6).value).toBeNull(); // header row has no amount
    expect(sheet.getRow(5).getCell(6).value).toBe(5000); // 100 * 50
    expect(sheet.getRow(6).getCell(6).value).toBe(4000); // 20 * 200
    expect(sheet.getRow(7).getCell(6).value).toBe(0); // unpriced item -> 0, not skipped
    expect(sheet.getRow(8).getCell(2).value).toBe("Total");
    expect(sheet.getRow(8).getCell(6).value).toBe(9000); // 5000 + 4000 + 0
  });

  it("omits the work-description row entirely when there is none", () => {
    const workbook = buildTenderBoqWorkbook({
      projectName: "SAMPLE TOWERS",
      workDescription: null,
      items: [{ itemCode: "A.1", description: "Item", quantity: 1, uom: "nos.", rate: 10 }],
    });
    const sheet = workbook.worksheets[0]!;
    // Row 2 should be the header row, not a blank work-description row.
    expect(sheet.getRow(2).getCell(1).value).toBe("Section");
  });
});

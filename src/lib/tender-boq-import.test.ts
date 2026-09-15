import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { parseTenderBoqWorkbook } from "./tender-boq-import";

/**
 * Builds a small workbook shaped like a typical client tender rate
 * schedule -- title rows, a header row, section headers with no
 * quantity, a sub-grouper, leaf items, and a trailing Total row --
 * without using any real client's tender data.
 */
async function buildSampleWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tab 1");
  sheet.addRow(["PROJECT :SAMPLE TOWERS, SECTOR 1, CITY"]);
  sheet.addRow(["WORK: SOFTSCAPE PLANTATION WORKS"]);
  sheet.addRow(["Section", "Item Description", "Quantity", "Unit", "Rate", "Amount"]);
  sheet.addRow(["A", "PREAMBLE", null, null, null, null]);
  sheet.addRow(["A.1", "General conditions apply to all items below.", null, null, null, null]);
  sheet.addRow(["B", "BED PREPARATION", null, null, null, 0]);
  sheet.addRow(["B.1", "Clearing and grubbing of site.", 3377, "sq. m.", null, 0]);
  sheet.addRow(["B.2", "Excavation and stacking of good earth.", 3895, "cu.m.", null, 0]);
  sheet.addRow(["B.6", "Supplying soil nutrients, as follows.", null, null, null, 0]);
  sheet.addRow(["B.6.1", "Neem Cake", 8079, "kg", null, 0]);
  sheet.addRow(["B.6.2", "Vermicompost", 5678, "kg", null, 0]);
  // Some real client files put a literal 0 (not a blank cell) in the
  // quantity column for section headers -- this must still be treated
  // as a header, not a fillable item with quantity 0.
  sheet.addRow(["C", "A SECTION WITH A LITERAL ZERO QUANTITY", 0, null, null, 0]);
  sheet.addRow([null, "Total", null, null, null, 0]);

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe("parseTenderBoqWorkbook", () => {
  it("extracts the project name and work description from the title rows", async () => {
    const parsed = await parseTenderBoqWorkbook(await buildSampleWorkbook());
    expect(parsed.projectName).toBe("PROJECT :SAMPLE TOWERS, SECTOR 1, CITY");
    expect(parsed.workDescription).toBe("WORK: SOFTSCAPE PLANTATION WORKS");
  });

  it("imports both header rows (no quantity) and leaf line items (with quantity)", async () => {
    const parsed = await parseTenderBoqWorkbook(await buildSampleWorkbook());
    const byCode = new Map(parsed.items.map((i) => [i.itemCode, i]));

    const sectionA = byCode.get("A");
    expect(sectionA?.description).toBe("PREAMBLE");
    expect(sectionA?.quantity).toBeNull();
    expect(sectionA?.uom).toBeNull();

    const itemB1 = byCode.get("B.1");
    expect(itemB1?.description).toBe("Clearing and grubbing of site.");
    expect(itemB1?.quantity).toBe(3377);
    expect(itemB1?.uom).toBe("sq. m.");
    expect(itemB1?.rate).toBeNull();

    const subGrouper = byCode.get("B.6");
    expect(subGrouper?.quantity).toBeNull();

    const nestedItem = byCode.get("B.6.1");
    expect(nestedItem?.quantity).toBe(8079);
    expect(nestedItem?.uom).toBe("kg");
  });

  it("treats a literal 0 quantity (not just a blank cell) as a header, not an item", async () => {
    const parsed = await parseTenderBoqWorkbook(await buildSampleWorkbook());
    const sectionC = parsed.items.find((i) => i.itemCode === "C");
    expect(sectionC?.quantity).toBeNull();
    expect(sectionC?.uom).toBeNull();
  });

  it("drops the trailing Total row and preserves source order via sortOrder", async () => {
    const parsed = await parseTenderBoqWorkbook(await buildSampleWorkbook());
    expect(parsed.items.some((i) => i.description.toLowerCase() === "total")).toBe(false);
    expect(parsed.items.map((i) => i.itemCode)).toEqual([
      "A",
      "A.1",
      "B",
      "B.1",
      "B.2",
      "B.6",
      "B.6.1",
      "B.6.2",
      "C",
    ]);
    parsed.items.forEach((item, index) => expect(item.sortOrder).toBe(index + 1));
  });

  it("throws a clear error when no Quantity/Rate header row is found", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(["Just", "some", "random", "data"]);
    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(parseTenderBoqWorkbook(buffer)).rejects.toThrow(/header row/i);
  });
});

import ExcelJS from "exceljs";

export interface ParsedTenderBoqItem {
  itemCode: string | null;
  description: string;
  quantity: number | null;
  uom: string | null;
  rate: number | null;
  sortOrder: number;
}

export interface ParsedTenderBoq {
  projectName: string;
  workDescription: string | null;
  items: ParsedTenderBoqItem[];
}

function cellText(cell: ExcelJS.Cell | undefined): string {
  if (!cell) return "";
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "object") {
    if ("richText" in v && Array.isArray(v.richText)) {
      return v.richText.map((r) => r.text).join("");
    }
    if ("result" in v) return String((v as { result?: unknown }).result ?? "");
    if ("text" in v) return String((v as { text?: unknown }).text ?? "");
  }
  return String(v).trim();
}

function cellNumber(cell: ExcelJS.Cell | undefined): number | null {
  if (!cell) return null;
  if (typeof cell.value === "number") return Number.isFinite(cell.value) ? cell.value : null;
  const t = cellText(cell);
  if (!t) return null;
  const n = Number(t.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses a client-issued tender rate schedule -- the format many
 * developers/main contractors use: a project title, then a flat list of
 * rows under a header row containing "Quantity" and "Rate" columns.
 * Section headers and sub-groupers (e.g. "A", "B.6") have a description
 * but no quantity; fillable line items (e.g. "B.1", "E.1") have both.
 * Column order/wording varies a little between clients, so the header
 * row and its columns are detected rather than assumed fixed -- except
 * the item-code column, which by convention sits first with no header
 * text of its own worth matching on ("Section" is a label, not a hint).
 */
export async function parseTenderBoqWorkbook(buffer: ArrayBuffer): Promise<ParsedTenderBoq> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook has no sheets.");

  let headerRow = -1;
  let cols: {
    code: number;
    description: number;
    quantity: number;
    uom: number;
    rate: number;
  } | null = null;

  const scanRows = Math.min(15, sheet.rowCount);
  for (let r = 1; r <= scanRows; r++) {
    const row = sheet.getRow(r);
    const texts: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      texts[colNumber] = cellText(cell).toLowerCase();
    });
    const qtyCol = texts.findIndex((t) => /quantity|qty/.test(t ?? ""));
    const rateCol = texts.findIndex((t) => /\brate\b/.test(t ?? ""));
    if (qtyCol > 0 && rateCol > 0) {
      const descCol = texts.findIndex((t) => /description|item/.test(t ?? ""));
      const uomCol = texts.findIndex((t) => /\bunit\b|uom/.test(t ?? ""));
      headerRow = r;
      cols = {
        code: 1,
        description: descCol > 0 ? descCol : 2,
        quantity: qtyCol,
        uom: uomCol > 0 ? uomCol : qtyCol + 1,
        rate: rateCol,
      };
      break;
    }
  }

  if (headerRow === -1 || !cols) {
    throw new Error(
      "Couldn't find a header row with Quantity and Rate columns. Expected a layout like Section / Item Description / Quantity / Unit / Rate / Amount.",
    );
  }

  const preambleLines: string[] = [];
  for (let r = 1; r < headerRow; r++) {
    const text = cellText(sheet.getRow(r).getCell(1));
    if (text) preambleLines.push(text);
  }
  const projectName = preambleLines[0] ?? "Untitled tender BOQ";
  const workDescription = preambleLines.slice(1).join("\n") || null;

  const items: ParsedTenderBoqItem[] = [];
  let sortOrder = 0;
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const description = cellText(row.getCell(cols.description));
    if (!description) continue;
    if (/^total$/i.test(description.trim())) continue;

    const itemCode = cellText(row.getCell(cols.code)) || null;
    const rawQuantity = cellNumber(row.getCell(cols.quantity));
    const rawUom = cellText(row.getCell(cols.uom));
    // A real fillable line always has both a positive quantity and a unit;
    // section/sub-group header rows sometimes carry a literal 0 (rather
    // than a blank cell) in the quantity column in real client files, so
    // 0 or a missing unit both mean "this is a header, not an item".
    const isLeaf = rawQuantity != null && rawQuantity > 0 && rawUom.length > 0;
    const quantity = isLeaf ? rawQuantity : null;
    const uom = isLeaf ? rawUom : null;
    const rateRaw = cellNumber(row.getCell(cols.rate));

    sortOrder += 1;
    items.push({
      itemCode,
      description,
      quantity,
      uom,
      rate: rateRaw && rateRaw > 0 ? rateRaw : null,
      sortOrder,
    });
  }

  if (items.length === 0) {
    throw new Error("No line items found below the header row.");
  }

  return { projectName, workDescription, items };
}

import ExcelJS from "exceljs";

export interface TenderBoqExportItem {
  itemCode: string | null;
  description: string;
  quantity: number | null;
  uom: string | null;
  rate: number | null;
}

export interface TenderBoqExportInput {
  projectName: string;
  workDescription: string | null;
  items: TenderBoqExportItem[];
}

/** Rebuilds the client's tender rate-schedule layout with rates and amounts filled in. */
export function buildTenderBoqWorkbook({
  projectName,
  workDescription,
  items,
}: TenderBoqExportInput): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Tab 1");

  sheet.addRow([projectName]);
  if (workDescription) sheet.addRow([workDescription]);
  const headerRow = sheet.addRow([
    "Section",
    "Item Description",
    "Quantity",
    "Unit",
    "Rate",
    "Amount",
  ]);
  headerRow.font = { bold: true };

  let grandTotal = 0;
  for (const item of items) {
    const amount = item.quantity != null && item.rate != null ? item.quantity * item.rate : 0;
    if (item.quantity != null) grandTotal += amount;
    const row = sheet.addRow([
      item.itemCode,
      item.description,
      item.quantity,
      item.uom,
      item.rate,
      item.quantity != null ? amount : null,
    ]);
    if (item.quantity == null) row.font = { bold: true };
  }

  const totalRow = sheet.addRow([null, "Total", null, null, null, grandTotal]);
  totalRow.font = { bold: true };

  sheet.getColumn(2).width = 70;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 14;
  sheet.getColumn(6).width = 16;
  sheet.getColumn(5).numFmt = "#,##0.00";
  sheet.getColumn(6).numFmt = "#,##0.00";

  return workbook;
}

export async function downloadTenderBoqWorkbook(input: TenderBoqExportInput, filename: string) {
  const workbook = buildTenderBoqWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

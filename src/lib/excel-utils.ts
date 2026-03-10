import ExcelJS from 'exceljs';

/**
 * Read an Excel/CSV file and return rows as a 2D array (like XLSX.utils.sheet_to_json with header:1)
 */
export async function readExcelFile(data: ArrayBuffer): Promise<any[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: any[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as any[];
    // ExcelJS row.values is 1-indexed, first element is undefined
    rows.push(values.slice(1).map(v => v ?? ''));
  });
  return rows;
}

/**
 * Write a 2D array to an Excel file and trigger download
 */
export async function writeExcelFile(
  data: any[][],
  sheetName: string,
  fileName: string,
  columnWidths?: number[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  for (const row of data) {
    worksheet.addRow(row);
  }

  if (columnWidths) {
    columnWidths.forEach((w, i) => {
      const col = worksheet.getColumn(i + 1);
      col.width = w;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

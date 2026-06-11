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
 * Decode CSV bytes with encoding auto-detection.
 * Tries UTF-8 first (with BOM stripped); if replacement characters are present
 * or the result contains too many non-ASCII bytes likely to be GB18030,
 * falls back to GB18030 (covers GBK / GB2312 — the default CSV encoding Excel
 * uses on Chinese Windows when "Save As CSV" is selected without UTF-8).
 */
export function decodeCsvBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  // UTF-16 LE/BE BOM
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }

  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const replacementCount = (utf8.match(/\ufffd/g) || []).length;
  // If UTF-8 produced replacement characters, the file is likely GB18030 (Excel default on zh-CN)
  if (replacementCount > 0) {
    try {
      return new TextDecoder('gb18030').decode(bytes);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

/**
 * Parse CSV text into a 2D array. Supports quoted fields, escaped quotes, and CRLF.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') { /* skip, handle on \n */ }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Read a spreadsheet File (xlsx, xls, csv) into a 2D array. Handles CSV
 * encoding detection automatically so Chinese characters survive Excel's
 * default GB18030 "Save As CSV" output.
 */
export async function readSpreadsheetFile(file: File): Promise<any[][]> {
  const name = (file.name || '').toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const text = decodeCsvBytes(buffer);
    return parseCsv(text).filter(r => r.length > 0 && r.some(c => String(c).trim() !== ''));
  }
  return readExcelFile(buffer);
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

/**
 * Write a CSV file with UTF-8 BOM so Excel on Chinese Windows opens it
 * without garbling characters.
 */
export function writeCsvFile(data: any[][], fileName: string): void {
  const escape = (v: any) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = data.map(r => r.map(escape).join(',')).join('\r\n');
  const bom = '\ufeff';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

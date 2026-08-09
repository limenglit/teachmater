import ExcelJS from 'exceljs';
import { decodeTextBytes } from './text-file';

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
  return decodeTextBytes(buffer);
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
export function parseDelimitedText(text: string): string[][] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r\n|[\n\r\u2028\u2029]/);
  const sample = lines.slice(0, 20).join('\n');
  // Pick the delimiter that actually structures the file (Tab > ；/、 > ，/,).
  const tabs = (sample.match(/\t/g) || []).length;
  const commas = (sample.match(/[,，]/g) || []).length;
  const semis = (sample.match(/[;；]/g) || []).length;
  if (tabs === 0 && commas > 0 && semis === 0) {
    return parseCsv(text.replace(/，/g, ','));
  }
  const delimiter = tabs >= Math.max(commas, semis) && tabs > 0
    ? /\t/
    : semis > commas
      ? /[;；]/
      : /[,，]/;
  return lines
    .map(line => line.split(delimiter).map(cell => cell.trim()))
    .filter(cells => cells.some(c => c !== ''));
}

export async function readSpreadsheetFile(file: File): Promise<any[][]> {
  const name = (file.name || '').toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith('.csv') || file.type === 'text/csv') {
    const text = decodeCsvBytes(buffer);
    return parseCsv(text).filter(r => r.length > 0 && r.some(c => String(c).trim() !== ''));
  }
  // Plain-text rosters (Tab / comma / semicolon separated) exported from
  // school systems, often UTF-16LE with CRLF.
  if (name.endsWith('.txt') || name.endsWith('.tsv') || file.type === 'text/plain') {
    const text = decodeTextBytes(buffer);
    return parseDelimitedText(text).filter(r => r.length > 0 && r.some(c => String(c).trim() !== ''));
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

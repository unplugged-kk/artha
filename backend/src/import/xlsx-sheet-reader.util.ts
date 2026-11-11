/**
 * Reads an .xlsx workbook into the row/column shape the CSV importer already
 * consumes. This is deliberately the ONLY thing this file does -- it never
 * touches the database and never creates a transaction; the output is a plain
 * CSV string that flows through the existing `parseCsvHeaders`/`parseCsv`
 * pipeline unmodified (see import.controller.ts's `xlsx/*` routes).
 *
 * A personal finance workbook commonly has a title banner above its real
 * header row and a summary/report block below its data -- both are handled
 * here so the caller never sees them:
 *  - the header row is guessed as whichever of the first MAX_HEADER_SCAN_ROWS
 *    rows has the most non-blank cells (a banner row is mostly merged/blank
 *    outside its own title text);
 *  - data ends at the first fully-blank row after the header, which is what
 *    separates a ledger from a summary table living further down the sheet.
 */

import ExcelJS from "exceljs";

/** Hard ceiling on rows/columns read from an uploaded workbook (trust boundary). */
const MAX_XLSX_ROWS = 50_000;
const MAX_XLSX_COLUMNS = 500;
const MAX_HEADER_SCAN_ROWS = 15;
const PREVIEW_ROW_COUNT = 5;

export interface XlsxSheetSummary {
  name: string;
  rowCount: number;
  /** 1-indexed, matching ExcelJS row numbering and the headerRow readXlsxSheetAsCsv expects. */
  guessedHeaderRow: number;
  /** guessedHeaderRow plus up to PREVIEW_ROW_COUNT rows after it, for a picker preview. */
  previewRows: string[][];
}

export class XlsxUnreadableFileError extends Error {
  constructor() {
    super("Workbook could not be read");
    this.name = "XlsxUnreadableFileError";
  }
}

export class XlsxSheetNotFoundError extends Error {
  constructor(public readonly sheetName: string) {
    super(`Sheet not found: ${sheetName}`);
    this.name = "XlsxSheetNotFoundError";
  }
}

export class XlsxInvalidHeaderRowError extends Error {
  constructor(
    public readonly headerRow: number,
    public readonly rowCount: number,
  ) {
    super(`Invalid header row ${headerRow} for sheet with ${rowCount} rows`);
    this.name = "XlsxInvalidHeaderRowError";
  }
}

export class XlsxEmptyHeaderError extends Error {
  constructor(
    public readonly sheetName: string,
    public readonly headerRow: number,
  ) {
    super(`Row ${headerRow} of sheet "${sheetName}" has no header values`);
    this.name = "XlsxEmptyHeaderError";
  }
}

export class XlsxNoDataRowsError extends Error {
  constructor(
    public readonly sheetName: string,
    public readonly headerRow: number,
  ) {
    super(`Sheet "${sheetName}" has no data rows after row ${headerRow}`);
    this.name = "XlsxNoDataRowsError";
  }
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new XlsxUnreadableFileError();
  }
  return workbook;
}

function cellToPlainString(cell: ExcelJS.Cell): string {
  return cellValueToPlainString(cell.value);
}

function cellValueToPlainString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("result" in value) {
      return cellValueToPlainString(
        (value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue,
      );
    }
    if ("richText" in value) {
      return (value as ExcelJS.CellRichTextValue).richText
        .map((run) => run.text)
        .join("");
    }
    if ("text" in value) {
      return String((value as { text: unknown }).text ?? "");
    }
    if ("hyperlink" in value) {
      return String((value as { text?: unknown }).text ?? "");
    }
    return "";
  }
  return String(value);
}

function isBlankRow(values: string[]): boolean {
  return values.every((value) => value.trim().length === 0);
}

function columnCountOf(worksheet: ExcelJS.Worksheet): number {
  return Math.min(Math.max(worksheet.columnCount, 1), MAX_XLSX_COLUMNS);
}

function rowCountOf(worksheet: ExcelJS.Worksheet): number {
  return Math.min(Math.max(worksheet.rowCount, 0), MAX_XLSX_ROWS);
}

function rowToStrings(row: ExcelJS.Row, columnCount: number): string[] {
  const out: string[] = [];
  for (let c = 1; c <= columnCount; c++) {
    out.push(cellToPlainString(row.getCell(c)));
  }
  return out;
}

function guessHeaderRow(worksheet: ExcelJS.Worksheet): number {
  const scanLimit = Math.min(rowCountOf(worksheet), MAX_HEADER_SCAN_ROWS);
  const columnCount = columnCountOf(worksheet);
  let bestRow = 1;
  let bestScore = -1;
  for (let r = 1; r <= scanLimit; r++) {
    const values = rowToStrings(worksheet.getRow(r), columnCount);
    // Distinct non-blank values, not a raw non-blank count: a merged title
    // banner (a personal-budget template's "JULY 2026 -- EXPENSE
    // TRANSACTIONS" spanning the header's own column count) reads back from
    // exceljs as the SAME value repeated in every column of the merge, so a
    // raw count ties or beats the real header row, which is column *names*
    // -- distinct by construction. A banner scores 1 here; a real header
    // scores one per column.
    const score = new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ).size;
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }
  return bestRow;
}

function isSheetSelectable(state: ExcelJS.Worksheet["state"]): boolean {
  // `veryHidden` sheets are excluded from the picker -- that state means the
  // workbook's own author marked them not meant to be opened from the UI.
  // An ordinary `hidden` sheet may still hold real data the user wants
  // (columns hidden for layout reasons, not secrecy), so it stays listed.
  return state !== "veryHidden";
}

/** Lists every selectable sheet with a guessed header row and a short preview, for the sheet-picker UI. */
export async function listXlsxSheets(
  buffer: Buffer,
): Promise<XlsxSheetSummary[]> {
  const workbook = await loadWorkbook(buffer);
  const summaries: XlsxSheetSummary[] = [];

  workbook.eachSheet((worksheet) => {
    if (!isSheetSelectable(worksheet.state)) return;

    const rowCount = rowCountOf(worksheet);
    if (rowCount === 0) {
      summaries.push({
        name: worksheet.name,
        rowCount: 0,
        guessedHeaderRow: 1,
        previewRows: [],
      });
      return;
    }

    const headerRow = guessHeaderRow(worksheet);
    const columnCount = columnCountOf(worksheet);
    const previewRows: string[][] = [];
    const previewEnd = Math.min(rowCount, headerRow + PREVIEW_ROW_COUNT);
    for (let r = headerRow; r <= previewEnd; r++) {
      previewRows.push(rowToStrings(worksheet.getRow(r), columnCount));
    }

    summaries.push({
      name: worksheet.name,
      rowCount,
      guessedHeaderRow: headerRow,
      previewRows,
    });
  });

  return summaries;
}

function csvEscapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Reads one sheet starting at `headerRow` (1-indexed) through the row before
 * the first fully-blank row that follows it, and returns it as a CSV string
 * -- the exact input `parseCsvHeaders`/`parseCsv` already accept.
 */
export async function readXlsxSheetAsCsv(
  buffer: Buffer,
  sheetName: string,
  headerRow: number,
): Promise<string> {
  const workbook = await loadWorkbook(buffer);
  const worksheet = workbook.getWorksheet(sheetName);
  if (!worksheet || !isSheetSelectable(worksheet.state)) {
    throw new XlsxSheetNotFoundError(sheetName);
  }

  const rowCount = rowCountOf(worksheet);
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > rowCount) {
    throw new XlsxInvalidHeaderRowError(headerRow, rowCount);
  }

  const columnCount = columnCountOf(worksheet);
  const header = rowToStrings(worksheet.getRow(headerRow), columnCount);
  if (isBlankRow(header)) {
    throw new XlsxEmptyHeaderError(sheetName, headerRow);
  }

  const rows: string[][] = [header];
  for (let r = headerRow + 1; r <= rowCount; r++) {
    const values = rowToStrings(worksheet.getRow(r), columnCount);
    if (isBlankRow(values)) break;
    rows.push(values);
  }

  if (rows.length < 2) {
    throw new XlsxNoDataRowsError(sheetName, headerRow);
  }

  return rows.map((row) => row.map(csvEscapeCell).join(",")).join("\r\n");
}

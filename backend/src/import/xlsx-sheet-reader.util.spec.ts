import ExcelJS from "exceljs";
import {
  listXlsxSheets,
  readXlsxSheetAsCsv,
  XlsxEmptyHeaderError,
  XlsxInvalidHeaderRowError,
  XlsxNoDataRowsError,
  XlsxSheetNotFoundError,
  XlsxUnreadableFileError,
} from "./xlsx-sheet-reader.util";

/**
 * Builds a workbook shaped like the real personal-budget templates this
 * feature targets: a multi-row title banner, the real header, some data
 * rows, a blank row, then an unrelated summary block further down the same
 * sheet -- exactly the shape that must be truncated away.
 */
async function buildBudgetLikeWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Transactions");

  sheet.addRow(["JULY 2026 -- EXPENSE TRANSACTIONS"]);
  sheet.addRow(["Instructions: fill in every row below"]);
  sheet.addRow([]);
  sheet.addRow(["#", "Date", "Amount", "Description", "Category"]);
  sheet.addRow([1, new Date("2026-08-25"), 500, "Groceries", "Groceries"]);
  sheet.addRow([2, new Date("2026-08-26"), 1200, "Petrol", "Travel"]);
  sheet.addRow([]);
  sheet.addRow(["TOTAL", "", 1700, "", ""]);
  sheet.addRow(["Category Summary"]);
  sheet.addRow(["Groceries", 500]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * A merged title banner, as real workbook templates actually build one
 * (`Sept -2026.xlsx`'s own "JULY 2026 -- EXPENSE TRANSACTIONS" row): exceljs
 * echoes the merged cell's value into every column of the merge, so a
 * header-guess heuristic counting bare non-blank cells sees the SAME score
 * for the banner as for the real header row -- and the banner, being first,
 * wins on a `>` comparison. This is what distinct-value counting exists to
 * survive.
 */
async function buildMergedBannerWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Transactions");

  sheet.addRow(["JULY 2026 -- EXPENSE TRANSACTIONS", "", "", "", ""]);
  sheet.mergeCells("A1:E1");
  sheet.addRow(["Instructions", "", "", "", ""]);
  sheet.mergeCells("A2:E2");
  sheet.addRow(["#", "Date", "Amount", "Description", "Category"]);
  sheet.addRow([1, new Date("2026-08-25"), 500, "Groceries", "Groceries"]);
  sheet.addRow([2, new Date("2026-08-26"), 1200, "Petrol", "Travel"]);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe("xlsx-sheet-reader.util", () => {
  describe("listXlsxSheets", () => {
    it("picks the real header row over a merged banner that echoes across every column", async () => {
      const buffer = await buildMergedBannerWorkbook();
      const sheets = await listXlsxSheets(buffer);

      expect(sheets[0].guessedHeaderRow).toBe(3);
      expect(sheets[0].previewRows[0]).toEqual([
        "#",
        "Date",
        "Amount",
        "Description",
        "Category",
      ]);
    });

    it("guesses the header row past a title banner and previews from it", async () => {
      const buffer = await buildBudgetLikeWorkbook();
      const sheets = await listXlsxSheets(buffer);

      expect(sheets).toHaveLength(1);
      expect(sheets[0].name).toBe("Transactions");
      expect(sheets[0].guessedHeaderRow).toBe(4);
      expect(sheets[0].previewRows[0]).toEqual([
        "#",
        "Date",
        "Amount",
        "Description",
        "Category",
      ]);
    });

    it("returns an empty summary for a sheet with no rows", async () => {
      const workbook = new ExcelJS.Workbook();
      workbook.addWorksheet("Empty");
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const sheets = await listXlsxSheets(buffer);

      expect(sheets).toEqual([
        { name: "Empty", rowCount: 0, guessedHeaderRow: 1, previewRows: [] },
      ]);
    });

    it("excludes veryHidden sheets but keeps ordinary hidden ones", async () => {
      const workbook = new ExcelJS.Workbook();
      const visible = workbook.addWorksheet("Visible");
      visible.addRow(["Date", "Amount"]);
      visible.addRow(["2026-01-01", "10"]);

      const hidden = workbook.addWorksheet("Hidden", { state: "hidden" });
      hidden.addRow(["Date", "Amount"]);

      const veryHidden = workbook.addWorksheet("Secret", {
        state: "veryHidden",
      });
      veryHidden.addRow(["Date", "Amount"]);

      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
      const sheets = await listXlsxSheets(buffer);
      const names = sheets.map((s) => s.name);

      expect(names).toContain("Visible");
      expect(names).toContain("Hidden");
      expect(names).not.toContain("Secret");
    });

    it("throws XlsxUnreadableFileError for bytes that are not a workbook", async () => {
      await expect(
        listXlsxSheets(Buffer.from("not an xlsx file")),
      ).rejects.toThrow(XlsxUnreadableFileError);
    });
  });

  describe("readXlsxSheetAsCsv", () => {
    it("converts the header + data rows into CSV, truncating at the blank row before the summary block", async () => {
      const buffer = await buildBudgetLikeWorkbook();

      const csv = await readXlsxSheetAsCsv(buffer, "Transactions", 4);

      expect(csv).toBe(
        [
          "#,Date,Amount,Description,Category",
          "1,2026-08-25,500,Groceries,Groceries",
          "2,2026-08-26,1200,Petrol,Travel",
        ].join("\r\n"),
      );
      expect(csv).not.toContain("TOTAL");
      expect(csv).not.toContain("Category Summary");
    });

    it("quotes a cell containing a comma or double quote", async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Sheet1");
      sheet.addRow(["Date", "Description"]);
      sheet.addRow(["2026-01-01", 'Coffee, "large"']);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      const csv = await readXlsxSheetAsCsv(buffer, "Sheet1", 1);

      expect(csv).toBe(
        ["Date,Description", '2026-01-01,"Coffee, ""large"""'].join("\r\n"),
      );
    });

    it("throws XlsxSheetNotFoundError for an unknown sheet name", async () => {
      const buffer = await buildBudgetLikeWorkbook();
      await expect(
        readXlsxSheetAsCsv(buffer, "NoSuchSheet", 4),
      ).rejects.toThrow(XlsxSheetNotFoundError);
    });

    it("throws XlsxInvalidHeaderRowError for a header row outside the sheet", async () => {
      const buffer = await buildBudgetLikeWorkbook();
      await expect(
        readXlsxSheetAsCsv(buffer, "Transactions", 999),
      ).rejects.toThrow(XlsxInvalidHeaderRowError);
      await expect(
        readXlsxSheetAsCsv(buffer, "Transactions", 0),
      ).rejects.toThrow(XlsxInvalidHeaderRowError);
    });

    it("throws XlsxEmptyHeaderError when the chosen row is blank", async () => {
      const buffer = await buildBudgetLikeWorkbook();
      await expect(
        readXlsxSheetAsCsv(buffer, "Transactions", 3),
      ).rejects.toThrow(XlsxEmptyHeaderError);
    });

    it("throws XlsxNoDataRowsError when the header is immediately followed by a blank row", async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Sheet1");
      sheet.addRow(["Date", "Amount"]);
      const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

      await expect(readXlsxSheetAsCsv(buffer, "Sheet1", 1)).rejects.toThrow(
        XlsxNoDataRowsError,
      );
    });
  });
});

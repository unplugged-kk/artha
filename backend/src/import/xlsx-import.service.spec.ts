import { BadRequestException } from "@nestjs/common";
import ExcelJS from "exceljs";
import { XlsxImportService } from "./xlsx-import.service";

async function buildWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Transactions");
  sheet.addRow(["Date", "Amount"]);
  sheet.addRow(["2026-01-01", "10"]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("XlsxImportService", () => {
  let service: XlsxImportService;

  beforeEach(() => {
    service = new XlsxImportService();
  });

  it("lists sheets from a valid workbook", async () => {
    const buffer = await buildWorkbook();
    const sheets = await service.listSheets(buffer);
    expect(sheets).toEqual([
      expect.objectContaining({ name: "Transactions", guessedHeaderRow: 1 }),
    ]);
  });

  it("converts a sheet to CSV", async () => {
    const buffer = await buildWorkbook();
    const csv = await service.toCsv(buffer, "Transactions", 1);
    expect(csv).toBe("Date,Amount\r\n2026-01-01,10");
  });

  it("translates an unreadable file into a BadRequestException with errorCode xlsxUnreadableFile", async () => {
    await expect(
      service.listSheets(Buffer.from("not xlsx")),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      response: { errorCode: "xlsxUnreadableFile" },
    });
  });

  it("translates an unknown sheet into a BadRequestException with errorCode xlsxSheetNotFound", async () => {
    const buffer = await buildWorkbook();
    await expect(service.toCsv(buffer, "NoSuchSheet", 1)).rejects.toMatchObject(
      {
        constructor: BadRequestException,
        response: { errorCode: "xlsxSheetNotFound" },
      },
    );
  });

  it("translates an invalid header row into a BadRequestException with errorCode xlsxInvalidHeaderRow", async () => {
    const buffer = await buildWorkbook();
    await expect(
      service.toCsv(buffer, "Transactions", 999),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      response: { errorCode: "xlsxInvalidHeaderRow" },
    });
  });
});

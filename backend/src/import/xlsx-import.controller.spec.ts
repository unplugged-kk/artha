import { BadRequestException, PayloadTooLargeException } from "@nestjs/common";
import {
  XLSX_IMPORT_LIMIT_BYTES,
  XlsxImportController,
} from "./xlsx-import.controller";
import { XlsxImportService } from "./xlsx-import.service";

function uploadedFile(name: string, buffer: Buffer): Express.Multer.File {
  return {
    originalname: name,
    buffer,
    size: buffer.length,
  } as Express.Multer.File;
}

describe("XlsxImportController", () => {
  let service: Record<string, jest.Mock>;
  let controller: XlsxImportController;

  beforeEach(() => {
    service = {
      listSheets: jest.fn().mockResolvedValue([
        {
          name: "Transactions",
          rowCount: 2,
          guessedHeaderRow: 1,
          previewRows: [],
        },
      ]),
      toCsv: jest.fn().mockResolvedValue("Date,Amount\n2026-01-01,10"),
    };
    controller = new XlsxImportController(
      service as unknown as XlsxImportService,
    );
  });

  describe("sheets", () => {
    it("returns the service's sheet list wrapped in { sheets }", async () => {
      const file = uploadedFile("Budget.xlsx", Buffer.from("stub"));
      const result = await controller.sheets(file);
      expect(result).toEqual({
        sheets: [
          {
            name: "Transactions",
            rowCount: 2,
            guessedHeaderRow: 1,
            previewRows: [],
          },
        ],
      });
    });

    it("rejects a missing file", async () => {
      await expect(
        controller.sheets(undefined as unknown as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects a non-.xlsx filename", async () => {
      const file = uploadedFile("Budget.csv", Buffer.from("stub"));
      await expect(controller.sheets(file)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejects a buffer larger than the configured limit even if multer let it through", async () => {
      const oversized = Buffer.alloc(XLSX_IMPORT_LIMIT_BYTES + 1);
      const file = uploadedFile("Budget.xlsx", oversized);
      await expect(controller.sheets(file)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });
  });

  describe("toCsv", () => {
    it("returns the service's CSV wrapped in { content }", async () => {
      const file = uploadedFile("Budget.xlsx", Buffer.from("stub"));
      const result = await controller.toCsv(file, {
        sheetName: "Transactions",
        headerRow: 1,
      });
      expect(service.toCsv).toHaveBeenCalledWith(
        file.buffer,
        "Transactions",
        1,
      );
      expect(result).toEqual({ content: "Date,Amount\n2026-01-01,10" });
    });
  });
});

import { BadRequestException, Injectable } from "@nestjs/common";
import { tr } from "../i18n/translate";
import {
  listXlsxSheets,
  readXlsxSheetAsCsv,
  XlsxEmptyHeaderError,
  XlsxInvalidHeaderRowError,
  XlsxNoDataRowsError,
  XlsxSheetNotFoundError,
  XlsxSheetSummary,
  XlsxUnreadableFileError,
} from "./xlsx-sheet-reader.util";

/**
 * Thin service wrapping the pure `xlsx-sheet-reader.util` functions with the
 * one thing a controller should not do itself: translating a typed parse
 * error into a localized `BadRequestException`.
 */
@Injectable()
export class XlsxImportService {
  async listSheets(buffer: Buffer): Promise<XlsxSheetSummary[]> {
    try {
      return await listXlsxSheets(buffer);
    } catch (error) {
      throw this.translate(error);
    }
  }

  async toCsv(
    buffer: Buffer,
    sheetName: string,
    headerRow: number,
  ): Promise<string> {
    try {
      return await readXlsxSheetAsCsv(buffer, sheetName, headerRow);
    } catch (error) {
      throw this.translate(error);
    }
  }

  private translate(error: unknown): Error {
    if (error instanceof XlsxUnreadableFileError) {
      return new BadRequestException({
        message: tr(
          "errors.import.xlsxUnreadableFile",
          "That file could not be read as an Excel workbook.",
        ),
        errorCode: "xlsxUnreadableFile",
      });
    }
    if (error instanceof XlsxSheetNotFoundError) {
      return new BadRequestException({
        message: tr(
          "errors.import.xlsxSheetNotFound",
          `Sheet "${error.sheetName}" was not found in this workbook.`,
          { sheetName: error.sheetName },
        ),
        errorCode: "xlsxSheetNotFound",
      });
    }
    if (error instanceof XlsxInvalidHeaderRowError) {
      return new BadRequestException({
        message: tr(
          "errors.import.xlsxInvalidHeaderRow",
          `Row ${error.headerRow} is not a valid header row for this sheet.`,
          { headerRow: error.headerRow },
        ),
        errorCode: "xlsxInvalidHeaderRow",
      });
    }
    if (error instanceof XlsxEmptyHeaderError) {
      return new BadRequestException({
        message: tr(
          "errors.import.xlsxEmptyHeader",
          `Row ${error.headerRow} of "${error.sheetName}" has no column headers. Pick a different row.`,
          { sheetName: error.sheetName, headerRow: error.headerRow },
        ),
        errorCode: "xlsxEmptyHeader",
      });
    }
    if (error instanceof XlsxNoDataRowsError) {
      return new BadRequestException({
        message: tr(
          "errors.import.xlsxNoDataRows",
          `"${error.sheetName}" has no data rows after row ${error.headerRow}.`,
          { sheetName: error.sheetName, headerRow: error.headerRow },
        ),
        errorCode: "xlsxNoDataRows",
      });
    }
    return error as Error;
  }
}

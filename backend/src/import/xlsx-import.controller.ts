import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { tr } from "../i18n/translate";
import { XlsxImportService } from "./xlsx-import.service";
import {
  XlsxSheetsResponseDto,
  XlsxToCsvDto,
  XlsxToCsvResponseDto,
} from "./dto/xlsx-import.dto";
import {
  XlsxUploadErrorInterceptor,
  xlsxFileTooLargeException,
} from "./xlsx-upload-error.interceptor";

/**
 * Two calls the import wizard makes to turn an uploaded .xlsx workbook into
 * plain CSV content, which then flows through the EXISTING csv/headers,
 * csv/parse and csv commit endpoints unmodified -- see
 * `xlsx-sheet-reader.util.ts` for why this is the whole feature.
 *
 * Transport is multipart, like the MS Money importer: a workbook is binary
 * and can be a few MB, well past what belongs as a JSON string body.
 * Nothing is staged server-side -- the file is small enough that the
 * frontend simply resends the same File object between the two calls.
 */

export const XLSX_IMPORT_LIMIT_MB =
  Number(process.env.XLSX_IMPORT_LIMIT_MB) || 25;
export const XLSX_IMPORT_LIMIT_BYTES = XLSX_IMPORT_LIMIT_MB * 1024 * 1024;

const XLSX_EXTENSION = /\.xlsx$/i;

@ApiTags("Import")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller("import/xlsx")
export class XlsxImportController {
  constructor(private readonly xlsxImportService: XlsxImportService) {}

  @Post("sheets")
  @ApiOperation({
    summary: "List an uploaded .xlsx workbook's sheets for the sheet picker",
  })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 201,
    description: "Sheets found in the workbook",
    type: XlsxSheetsResponseDto,
  })
  @ApiResponse({ status: 400, description: "Not a readable Excel file" })
  @ApiResponse({
    status: 413,
    description: "File exceeds XLSX_IMPORT_LIMIT_MB",
  })
  @UseInterceptors(
    new XlsxUploadErrorInterceptor(XLSX_IMPORT_LIMIT_MB),
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: XLSX_IMPORT_LIMIT_BYTES, files: 1 },
    }),
  )
  async sheets(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<XlsxSheetsResponseDto> {
    const buffer = this.requireXlsxFile(file);
    const sheets = await this.xlsxImportService.listSheets(buffer);
    return { sheets };
  }

  @Post("to-csv")
  @ApiOperation({
    summary:
      "Read one sheet of an uploaded .xlsx workbook as CSV, for the existing CSV import flow",
  })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 201,
    description: "CSV content, ready for /import/csv/headers and /import/csv",
    type: XlsxToCsvResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Sheet, header row, or file invalid",
  })
  @ApiResponse({
    status: 413,
    description: "File exceeds XLSX_IMPORT_LIMIT_MB",
  })
  @UseInterceptors(
    new XlsxUploadErrorInterceptor(XLSX_IMPORT_LIMIT_MB),
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: XLSX_IMPORT_LIMIT_BYTES, files: 1 },
    }),
  )
  async toCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: XlsxToCsvDto,
  ): Promise<XlsxToCsvResponseDto> {
    const buffer = this.requireXlsxFile(file);
    const content = await this.xlsxImportService.toCsv(
      buffer,
      dto.sheetName,
      dto.headerRow,
    );
    return { content };
  }

  private requireXlsxFile(file: Express.Multer.File): Buffer {
    if (!file?.buffer?.length) {
      throw new BadRequestException(
        tr("errors.import.xlsxNoFile", "No Excel file was uploaded"),
      );
    }
    if (!XLSX_EXTENSION.test(file.originalname)) {
      throw new BadRequestException(
        tr(
          "errors.import.xlsxNotAnExcelFile",
          "That file is not an Excel (.xlsx) file",
        ),
      );
    }
    // multer already refuses an over-limit upload via its own `limits`
    // option; the bound is re-asserted on the buffer that actually arrived,
    // matching the MS Money importer's same defensive re-check.
    if (file.buffer.length > XLSX_IMPORT_LIMIT_BYTES) {
      throw xlsxFileTooLargeException(XLSX_IMPORT_LIMIT_MB);
    }
    return file.buffer;
  }
}

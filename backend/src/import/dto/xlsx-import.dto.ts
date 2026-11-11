import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsString, IsNotEmpty, MaxLength, Min } from "class-validator";

export class XlsxSheetSummaryDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  rowCount: number;

  @ApiProperty({ description: "1-indexed guessed header row" })
  guessedHeaderRow: number;

  @ApiProperty({ description: "guessedHeaderRow plus a few following rows" })
  previewRows: string[][];
}

export class XlsxSheetsResponseDto {
  @ApiProperty({ type: [XlsxSheetSummaryDto] })
  sheets: XlsxSheetSummaryDto[];
}

/** Sent as multipart form fields alongside the file on POST /import/xlsx/to-csv. */
export class XlsxToCsvDto {
  @ApiProperty({ description: "Sheet to read, from the /xlsx/sheets response" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sheetName: string;

  @ApiProperty({ description: "1-indexed header row, from the sheet picker" })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headerRow: number;
}

export class XlsxToCsvResponseDto {
  @ApiProperty({
    description: "CSV content, ready for the existing csv/* import endpoints",
  })
  content: string;
}

import {
  IsOptional,
  IsArray,
  IsUUID,
  IsBoolean,
  IsDateString,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ApplyRulesDto {
  @ApiPropertyOptional({
    description:
      "Specific rule IDs to apply. If omitted, all active rules are applied in priority order.",
    example: ["c5f5d5f0-1234-4567-890a-123456789abc"],
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  ruleIds?: string[];

  @ApiPropertyOptional({
    description:
      "When true, only updates transactions that currently have no category assigned. Defaults to true to protect manual categorizations.",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  onlyUncategorized?: boolean;

  @ApiPropertyOptional({
    description: "Optional account ID filter",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: "Optional ISO start date boundary",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Optional ISO end date boundary",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description:
      "When true, returns the count and list of matches without persisting changes",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

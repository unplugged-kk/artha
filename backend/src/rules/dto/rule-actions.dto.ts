import {
  IsOptional,
  IsUUID,
  IsString,
  IsArray,
  ArrayMaxSize,
  IsBoolean,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class RuleActionsDto {
  @ApiPropertyOptional({
    description: "Category ID to assign to matching transactions",
    example: "c5f5d5f0-1234-4567-890a-123456789abc",
  })
  @IsOptional()
  @IsUUID()
  setCategoryId?: string | null;

  @ApiPropertyOptional({
    description: "Payee ID to link to matching transactions",
    example: "c5f5d5f0-1234-4567-890a-123456789abc",
  })
  @IsOptional()
  @IsUUID()
  setPayeeId?: string | null;

  @ApiPropertyOptional({
    description: "Canonical payee name to set on matching transactions",
    example: "Swiggy",
  })
  @IsOptional()
  @IsString()
  setPayeeName?: string | null;

  @ApiPropertyOptional({
    description: "Array of Tag IDs to append to matching transactions",
    example: ["c5f5d5f0-1234-4567-890a-123456789abc"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID(undefined, { each: true })
  addTagIds?: string[];

  @ApiPropertyOptional({
    description:
      "Whether to stop evaluating remaining rules after this rule matches",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  stopProcessing?: boolean;
}

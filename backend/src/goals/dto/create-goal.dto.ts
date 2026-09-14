import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  IsNotEmpty,
  MaxLength,
  Min,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SanitizeHtml } from "../../common/decorators/sanitize-html.decorator";
import { GoalType, GoalTargetMode } from "../constants/goal.enums";

export class CreateGoalDto {
  @ApiProperty({ description: "Goal name" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @SanitizeHtml()
  name: string;

  @ApiPropertyOptional({ description: "Goal description" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @SanitizeHtml()
  description?: string;

  @ApiPropertyOptional({
    description: "Goal type",
    enum: GoalType,
    default: GoalType.REGULAR,
  })
  @IsOptional()
  @IsEnum(GoalType)
  type?: GoalType;

  @ApiPropertyOptional({
    description: "Target calculation mode",
    enum: GoalTargetMode,
    default: GoalTargetMode.FIXED_AMOUNT,
  })
  @IsOptional()
  @IsEnum(GoalTargetMode)
  targetMode?: GoalTargetMode;

  @ApiPropertyOptional({ description: "Fixed target amount" })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  targetAmount?: number;

  @ApiPropertyOptional({
    description: "Target months of essential expenses (for emergency funds)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  targetMonths?: number;

  @ApiProperty({ description: "Currency code (ISO 4217, 3 characters)" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({ description: "Target completion date (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({
    description: "Dedicated account ID tracking this goal",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;
}

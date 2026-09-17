import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
  IsUUID,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { SanitizeHtml } from "../../common/decorators/sanitize-html.decorator";
import { GoalType, GoalStatus, GoalTargetMode } from "../constants/goal.enums";

export class UpdateGoalDto {
  @ApiPropertyOptional({ description: "Goal name" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @SanitizeHtml()
  name?: string;

  @ApiPropertyOptional({ description: "Goal description" })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @SanitizeHtml()
  description?: string | null;

  @ApiPropertyOptional({
    description: "Goal type",
    enum: GoalType,
  })
  @IsOptional()
  @IsEnum(GoalType)
  type?: GoalType;

  @ApiPropertyOptional({
    description: "Goal status",
    enum: GoalStatus,
  })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiPropertyOptional({
    description: "Target calculation mode",
    enum: GoalTargetMode,
  })
  @IsOptional()
  @IsEnum(GoalTargetMode)
  targetMode?: GoalTargetMode;

  @ApiPropertyOptional({ description: "Fixed target amount" })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  targetAmount?: number | null;

  @ApiPropertyOptional({
    description: "Target months of essential expenses (for emergency funds)",
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  targetMonths?: number | null;

  @ApiPropertyOptional({
    description: "Currency code (ISO 4217, 3 characters)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ description: "Target completion date (YYYY-MM-DD)" })
  @IsOptional()
  @IsDateString()
  targetDate?: string | null;

  @ApiPropertyOptional({
    description: "Dedicated account ID tracking this goal",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string | null;
}

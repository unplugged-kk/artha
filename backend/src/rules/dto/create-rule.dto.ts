import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
  IsEnum,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RuleMatchMode } from "../constants/rule.enums";
import { RuleConditionDto } from "./rule-condition.dto";
import { RuleActionsDto } from "./rule-actions.dto";

export class CreateRuleDto {
  @ApiProperty({
    description: "Descriptive name for the rule",
    example: "Swiggy & Zomato -> Food & Dining",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: "Priority order (0 runs before 10)",
    default: 0,
  })
  @IsOptional()
  @IsInt()
  priority?: number;

  @ApiPropertyOptional({
    description: "Whether this rule is active",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: RuleMatchMode,
    description: "Whether ALL or ANY conditions must match",
    default: RuleMatchMode.ALL,
  })
  @IsOptional()
  @IsEnum(RuleMatchMode)
  matchMode?: RuleMatchMode;

  @ApiProperty({
    description: "Array of conditions",
    type: [RuleConditionDto],
  })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => RuleConditionDto)
  conditions: RuleConditionDto[];

  @ApiProperty({
    description: "Actions to execute when matched",
    type: RuleActionsDto,
  })
  @ValidateNested()
  @Type(() => RuleActionsDto)
  actions: RuleActionsDto;
}

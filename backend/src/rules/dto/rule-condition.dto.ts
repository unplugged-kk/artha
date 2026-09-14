import { IsEnum, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { RuleField, RuleOperator } from "../constants/rule.enums";

export class RuleConditionDto {
  @ApiProperty({
    enum: RuleField,
    description: "Transaction field to match against",
    example: RuleField.PAYEE,
  })
  @IsEnum(RuleField)
  field: RuleField;

  @ApiProperty({
    enum: RuleOperator,
    description: "Comparison operator",
    example: RuleOperator.CONTAINS,
  })
  @IsEnum(RuleOperator)
  operator: RuleOperator;

  @ApiProperty({
    description: "Value or range to compare against",
    example: "Swiggy",
  })
  @IsNotEmpty()
  value: string | number | [number, number];
}

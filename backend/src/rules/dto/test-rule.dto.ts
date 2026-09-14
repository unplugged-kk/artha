import {
  IsOptional,
  IsUUID,
  ValidateNested,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CreateRuleDto } from "./create-rule.dto";

export class TestRuleCandidateDto {
  payee?: string | null;
  memo?: string | null;
  amount?: number | string | null;
  accountId?: string | null;
  paymentMethod?: string | null;
  type?: "DEBIT" | "CREDIT" | null;
}

export class TestRuleDto {
  @ApiPropertyOptional({
    description: "Existing rule ID to test",
  })
  @IsOptional()
  @IsUUID()
  ruleId?: string;

  @ApiPropertyOptional({
    description: "Transient rule definition to test before saving",
    type: CreateRuleDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRuleDto)
  rule?: CreateRuleDto;

  @ApiPropertyOptional({
    description: "Specific transaction candidate to test against",
  })
  @IsOptional()
  candidate?: TestRuleCandidateDto;

  @ApiPropertyOptional({
    description:
      "When true, also evaluates against the user's recent transactions",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  testAgainstRecent?: boolean;

  @ApiPropertyOptional({
    description: "Maximum number of recent transactions to test against",
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  sampleLimit?: number;
}

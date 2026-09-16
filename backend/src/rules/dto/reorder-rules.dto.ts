import { ArrayMaxSize, IsArray, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ReorderRulesDto {
  @ApiProperty({
    description: "Array of Rule IDs in the desired execution order",
    example: [
      "c5f5d5f0-1234-4567-890a-123456789abc",
      "d6f6e6f1-2345-5678-901b-234567890def",
    ],
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  ruleIds: string[];
}

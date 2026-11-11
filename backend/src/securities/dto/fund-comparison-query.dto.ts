import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";
import { csv } from "./performance-comparison-query.dto";

/**
 * The funds to compare (`docs/specs/fund-categories-and-comparison.md` §4.2).
 *
 * Between two and twenty distinct ids: one fund is not a comparison, and an
 * unbounded array turns the per-instrument price load into a denial-of-service
 * lever (`common/array-bound-dto.spec.ts` fails on a new unbounded one).
 * Duplicate ids are accepted and collapsed by the service, which says so in the
 * response rather than rejecting a caller for sending one twice.
 */
export class FundComparisonQueryDto {
  @ApiProperty({
    description: "Security ids to compare (comma-separated), 2..20",
    type: [String],
  })
  @Transform(csv)
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  securityIds: string[];
}

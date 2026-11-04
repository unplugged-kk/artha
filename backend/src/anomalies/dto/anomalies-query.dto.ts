import { IsOptional, Matches } from "class-validator";

export class AnomaliesQueryDto {
  /** Evaluate as of this date (YYYY-MM-DD); defaults to today. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  asOf?: string;
}

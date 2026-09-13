import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength, IsInt, Min } from "class-validator";

export class UpdateWatchlistDto {
  @ApiPropertyOptional({
    example: "Blue Chips",
    description: "Name of the watchlist",
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: "Large-cap market leaders",
    description: "Optional description of the watchlist",
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 0, description: "Display sort order" })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

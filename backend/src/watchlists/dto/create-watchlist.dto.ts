import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsInt,
  Min,
} from "class-validator";

export class CreateWatchlistDto {
  @ApiProperty({ example: "Blue Chips", description: "Name of the watchlist" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

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

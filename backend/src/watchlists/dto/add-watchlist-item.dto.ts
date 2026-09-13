import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsUUID, IsOptional, IsInt, Min } from "class-validator";

export class AddWatchlistItemDto {
  @ApiProperty({
    example: "11111111-1111-1111-1111-111111111111",
    description: "Security ID to add to the watchlist",
  })
  @IsUUID()
  @IsNotEmpty()
  securityId: string;

  @ApiPropertyOptional({ example: 0, description: "Display sort order" })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}

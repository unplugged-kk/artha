import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsUUID } from "class-validator";

export class ReorderWatchlistsDto {
  @ApiProperty({
    description: "Ordered array of watchlist IDs",
    type: [String],
    example: [
      "c5f5d5f0-1234-4567-890a-123456789abc",
      "d5f5d5f0-1234-4567-890a-123456789def",
    ],
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  watchlistIds: string[];
}

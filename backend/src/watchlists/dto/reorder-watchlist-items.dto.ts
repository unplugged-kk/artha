import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsUUID } from "class-validator";

export class ReorderWatchlistItemsDto {
  @ApiProperty({
    description: "Ordered array of watchlist item IDs",
    type: [String],
    example: [
      "c5f5d5f0-1234-4567-890a-123456789abc",
      "d5f5d5f0-1234-4567-890a-123456789def",
    ],
  })
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID(undefined, { each: true })
  itemIds: string[];
}

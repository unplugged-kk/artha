import { IsNotEmpty, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LinkTransactionDto {
  @ApiProperty({ description: "ID of the transaction to link to this goal" })
  @IsUUID()
  @IsNotEmpty()
  transactionId: string;
}

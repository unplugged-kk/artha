import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ImportSmsDto {
  @ApiProperty({ description: "Raw SMS message body to parse and import" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({
    description:
      "Sender ID as received from telecom operator (e.g. 'VM-HDFCBK', 'HDFCBK')",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sender?: string;

  @ApiPropertyOptional({
    description:
      "Target account UUID. If omitted, resolved via sms_sender_registry or account mask.",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: "Optional category UUID to assign to the imported transaction",
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

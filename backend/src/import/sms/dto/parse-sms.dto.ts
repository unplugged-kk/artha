import { IsString, IsNotEmpty, IsOptional, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ParseSmsDto {
  @ApiProperty({ description: "Raw SMS message body to parse" })
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
}

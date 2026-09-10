import {
  IsString,
  Matches,
  IsBoolean,
  IsOptional,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class VerifyTotpDto {
  @ApiProperty({ description: "Temporary token from login response" })
  @IsString()
  @MaxLength(2048)
  tempToken: string;

  @ApiProperty({
    description:
      "6-digit TOTP code from authenticator app or XXXX-XXXX backup code",
  })
  @IsString()
  @MaxLength(9)
  @Matches(/^(\d{6}|[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4})$/, {
    message: "Code must be a 6-digit TOTP code or a backup code (XXXX-XXXX)",
  })
  code: string;

  @ApiProperty({
    description: "Remember this device and skip 2FA for 14 days",
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  rememberDevice?: boolean;
}

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsBoolean,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateSmsSenderDto {
  @ApiProperty({
    description: "Sender ID pattern (e.g. 'VM-HDFCBK', 'HDFCBK', 'AD-ICICIB')",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  senderPattern: string;

  @ApiPropertyOptional({
    description: "Target account UUID mapped to this sender",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @ApiPropertyOptional({
    description: "Human-readable display name (e.g. 'HDFC Salary Account')",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional({
    description: "Whether this sender mapping is currently active",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSmsSenderDto {
  @ApiPropertyOptional({
    description: "Target account UUID mapped to this sender (or null to unmap)",
  })
  @IsOptional()
  @IsUUID()
  accountId?: string | null;

  @ApiPropertyOptional({
    description: "Human-readable display name",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string | null;

  @ApiPropertyOptional({
    description: "Whether this sender mapping is currently active",
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SmsSenderResponseDto {
  @ApiProperty({ description: "Sender registry entry UUID" })
  id: string;

  @ApiProperty({ description: "Sender pattern" })
  senderPattern: string;

  @ApiPropertyOptional({ description: "Mapped account UUID" })
  accountId?: string | null;

  @ApiPropertyOptional({ description: "Account name if mapped" })
  accountName?: string | null;

  @ApiPropertyOptional({ description: "Display name" })
  displayName?: string | null;

  @ApiProperty({ description: "Active status" })
  isActive: boolean;

  @ApiProperty({ description: "Creation timestamp" })
  createdAt: Date;

  @ApiProperty({ description: "Last updated timestamp" })
  updatedAt: Date;
}

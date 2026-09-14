import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from "typeorm";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

@Entity("merchant_references")
export class MerchantReference {
  @ApiProperty({ example: "c5f5d5f0-1234-4567-890a-123456789abc" })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({ example: "Swiggy", description: "Canonical merchant name" })
  @Column({
    name: "canonical_name",
    type: "varchar",
    length: 255,
    unique: true,
  })
  canonicalName: string;

  @ApiProperty({
    example: "SWIGGY",
    description: "Normalized uppercase comparison identity",
  })
  @Column({
    name: "normalized_name",
    type: "varchar",
    length: 255,
    unique: true,
  })
  normalizedName: string;

  @ApiProperty({
    example: ["BUNDL TECHNOLOGIES*", "SWIGGY *"],
    description: "Known statement alias patterns (glob syntax)",
  })
  @Column({ type: "text", array: true, default: "{}" })
  aliases: string[];

  @ApiPropertyOptional({
    example: "Food & Dining",
    description:
      "Suggested category metadata (unresolved policy; descriptive only)",
  })
  @Column({
    name: "category_suggestion",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  categorySuggestion: string | null;

  @ApiPropertyOptional({ example: "https://www.swiggy.com" })
  @Column({ type: "varchar", length: 2048, nullable: true })
  website: string | null;

  @ApiProperty({
    example: "IN",
    description: "ISO 3166-1 alpha-2 country code",
  })
  @Column({ name: "country_code", type: "varchar", length: 2, default: "IN" })
  countryCode: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

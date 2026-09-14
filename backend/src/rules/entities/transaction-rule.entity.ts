import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../../users/entities/user.entity";
import { RuleMatchMode } from "../constants/rule.enums";
import { RuleCondition, RuleActions } from "../interfaces/rule.interface";

@Entity("transaction_rules")
export class TransactionRule {
  @ApiProperty({ example: "c5f5d5f0-1234-4567-890a-123456789abc" })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({ example: "user-uuid" })
  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @ApiProperty({
    example: "Swiggy & Zomato -> Food & Dining",
    description: "Descriptive name for this rule",
  })
  @Column({ type: "varchar", length: 255 })
  name: string;

  @ApiProperty({
    example: 0,
    description: "Evaluation priority order (lower runs first)",
  })
  @Column({ type: "integer", default: 0 })
  priority: number;

  @ApiProperty({ example: true, description: "Whether this rule is active" })
  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;

  @ApiProperty({
    enum: RuleMatchMode,
    example: RuleMatchMode.ALL,
    description: "Whether ALL or ANY conditions must match",
  })
  @Column({
    type: "varchar",
    length: 16,
    name: "match_mode",
    default: RuleMatchMode.ALL,
  })
  matchMode: RuleMatchMode;

  @ApiProperty({
    description: "List of conditions to match against a transaction",
  })
  @Column({ type: "jsonb", default: () => "'[]'::jsonb" })
  conditions: RuleCondition[];

  @ApiProperty({
    description: "Actions to execute when the conditions are satisfied",
  })
  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  actions: RuleActions;

  @ApiProperty()
  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

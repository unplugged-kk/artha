import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Account } from "../../accounts/entities/account.entity";
import { GoalTransaction } from "./goal-transaction.entity";
import { GoalType, GoalStatus, GoalTargetMode } from "../constants/goal.enums";

const numericTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null | undefined) =>
    value === null || value === undefined ? null : parseFloat(value),
};

@Entity("goals")
@Index(["userId", "status"])
@Index(["userId", "createdAt"])
export class Goal {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ length: 255 })
  name: string;

  @Column({ type: "text", nullable: true })
  description: string | null;

  @Column({
    type: "varchar",
    length: 32,
    default: GoalType.REGULAR,
  })
  type: GoalType;

  @Column({
    type: "varchar",
    length: 32,
    default: GoalStatus.ACTIVE,
  })
  status: GoalStatus;

  @Column({
    name: "target_mode",
    type: "varchar",
    length: 32,
    default: GoalTargetMode.FIXED_AMOUNT,
  })
  targetMode: GoalTargetMode;

  @Column({
    name: "target_amount",
    type: "decimal",
    precision: 20,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  targetAmount: number | null;

  @Column({
    name: "target_months",
    type: "numeric",
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  targetMonths: number | null;

  @Column({ length: 3 })
  currency: string;

  @Column({ name: "target_date", type: "date", nullable: true })
  targetDate: string | null;

  @Column({ name: "account_id", type: "uuid", nullable: true })
  accountId: string | null;

  @ManyToOne(() => Account, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "account_id" })
  account: Account | null;

  @OneToMany(() => GoalTransaction, (gt) => gt.goal)
  goalTransactions: GoalTransaction[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}

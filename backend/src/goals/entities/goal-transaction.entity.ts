import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Goal } from "./goal.entity";
import { Transaction } from "../../transactions/entities/transaction.entity";

@Entity("goal_transactions")
@Unique(["goalId", "transactionId"])
@Index(["userId", "goalId"])
@Index(["transactionId"])
export class GoalTransaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id", type: "uuid" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ name: "goal_id", type: "uuid" })
  goalId: string;

  @ManyToOne(() => Goal, (g) => g.goalTransactions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "goal_id" })
  goal: Goal;

  @Column({ name: "transaction_id", type: "uuid" })
  transactionId: string;

  @ManyToOne(() => Transaction, { onDelete: "CASCADE" })
  @JoinColumn({ name: "transaction_id" })
  transaction: Transaction;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}

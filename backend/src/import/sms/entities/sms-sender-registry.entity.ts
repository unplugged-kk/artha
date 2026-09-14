import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm";
import { User } from "../../../users/entities/user.entity";
import { Account } from "../../../accounts/entities/account.entity";

@Entity("sms_sender_registry")
@Unique("idx_sms_sender_registry_user_sender", ["userId", "senderPattern"])
export class SmsSenderRegistry {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", name: "user_id" })
  @Index("idx_sms_sender_registry_user")
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column({ type: "uuid", name: "account_id", nullable: true })
  @Index("idx_sms_sender_registry_account")
  accountId: string | null;

  @ManyToOne(() => Account, { nullable: true, onDelete: "CASCADE" })
  @JoinColumn({ name: "account_id" })
  account: Account | null;

  @Column({ type: "varchar", length: 255, name: "sender_pattern" })
  senderPattern: string;

  @Column({
    type: "varchar",
    length: 255,
    name: "display_name",
    nullable: true,
  })
  displayName: string | null;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive: boolean;

  @CreateDateColumn({ type: "timestamp", name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp", name: "updated_at" })
  updatedAt: Date;
}

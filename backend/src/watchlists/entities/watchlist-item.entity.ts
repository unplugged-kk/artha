import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../../users/entities/user.entity";
import { Watchlist } from "./watchlist.entity";
import { Security } from "../../securities/entities/security.entity";

@Entity("watchlist_items")
@Unique(["watchlistId", "securityId"])
@Index("idx_watchlist_items_watchlist_sort", ["watchlistId", "sortOrder"])
@Index("idx_watchlist_items_user_id", ["userId"])
@Index("idx_watchlist_items_security_id", ["securityId"])
export class WatchlistItem {
  @ApiProperty({ example: "c5f5d5f0-1234-4567-890a-123456789abc" })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({ description: "Owner user ID" })
  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ApiProperty({ description: "Watchlist ID" })
  @Column({ type: "uuid", name: "watchlist_id" })
  watchlistId: string;

  @ManyToOne(() => Watchlist, (w) => w.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "watchlist_id" })
  watchlist: Watchlist;

  @ApiProperty({ description: "Security ID" })
  @Column({ type: "uuid", name: "security_id" })
  securityId: string;

  @ManyToOne(() => Security, { onDelete: "CASCADE" })
  @JoinColumn({ name: "security_id" })
  security: Security;

  @ApiProperty({ example: 0, description: "Display sort order" })
  @Column({ type: "integer", name: "sort_order", default: 0 })
  sortOrder: number;

  @ApiProperty()
  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}

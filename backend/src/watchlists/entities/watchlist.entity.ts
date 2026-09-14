import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
  Index,
} from "typeorm";
import { ApiProperty } from "@nestjs/swagger";
import { User } from "../../users/entities/user.entity";
import { WatchlistItem } from "./watchlist-item.entity";

@Entity("watchlists")
@Unique(["userId", "name"])
@Index("idx_watchlists_user_sort", ["userId", "sortOrder"])
export class Watchlist {
  @ApiProperty({ example: "c5f5d5f0-1234-4567-890a-123456789abc" })
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ApiProperty({ description: "Owner user ID" })
  @Column({ type: "uuid", name: "user_id" })
  userId: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @ApiProperty({ example: "Tech Giants", description: "Name of the watchlist" })
  @Column({ type: "varchar", length: 100 })
  name: string;

  @ApiProperty({
    example: "Key technology stocks to monitor",
    required: false,
    nullable: true,
  })
  @Column({ type: "text", nullable: true })
  description: string | null;

  @ApiProperty({ example: 0, description: "Display sort order" })
  @Column({ type: "integer", name: "sort_order", default: 0 })
  sortOrder: number;

  @OneToMany(() => WatchlistItem, (item) => item.watchlist, { cascade: true })
  items: WatchlistItem[];

  @ApiProperty()
  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}

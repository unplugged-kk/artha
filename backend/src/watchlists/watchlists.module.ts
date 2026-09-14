import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Watchlist } from "./entities/watchlist.entity";
import { WatchlistItem } from "./entities/watchlist-item.entity";
import { Security } from "../securities/entities/security.entity";
import { SecuritiesModule } from "../securities/securities.module";
import { WatchlistsService } from "./watchlists.service";
import { WatchlistsController } from "./watchlists.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([Watchlist, WatchlistItem, Security]),
    forwardRef(() => SecuritiesModule),
  ],
  controllers: [WatchlistsController],
  providers: [WatchlistsService],
  exports: [WatchlistsService],
})
export class WatchlistsModule {}

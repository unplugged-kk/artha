import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { withScopedDb } from "../common/db/scoped-db";
import { Watchlist } from "./entities/watchlist.entity";
import { WatchlistItem } from "./entities/watchlist-item.entity";
import { Security } from "../securities/entities/security.entity";
import { SecurityPriceService } from "../securities/security-price.service";
import { CreateWatchlistDto } from "./dto/create-watchlist.dto";
import { UpdateWatchlistDto } from "./dto/update-watchlist.dto";
import { AddWatchlistItemDto } from "./dto/add-watchlist-item.dto";
import { ReorderWatchlistItemsDto } from "./dto/reorder-watchlist-items.dto";
import { ReorderWatchlistsDto } from "./dto/reorder-watchlists.dto";
import { tr } from "../i18n/translate";

export interface WatchlistItemQuote {
  status: "available" | "unavailable";
  currentPrice: number | null;
  previousPrice: number | null;
  dailyChange: number | null;
  dailyChangePercent: number | null;
  priceDate: string | null;
}

export interface WatchlistItemResponse {
  id: string;
  watchlistId: string;
  securityId: string;
  sortOrder: number;
  createdAt: Date;
  security: {
    id: string;
    symbol: string;
    name: string;
    currencyCode: string;
    securityType: string | null;
    exchange: string | null;
    isin: string | null;
    amfiSchemeCode: string | null;
  };
  quote: WatchlistItemQuote;
}

export interface WatchlistDetailResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  items: WatchlistItemResponse[];
}

export interface WatchlistSummaryResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class WatchlistsService {
  private readonly logger = new Logger(WatchlistsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly securityPriceService: SecurityPriceService,
  ) {}

  /**
   * List all watchlists for a user with their item counts,
   * ordered deterministically by sort_order ASC, created_at ASC.
   */
  async findAll(userId: string): Promise<WatchlistSummaryResponse[]> {
    return withScopedDb(this.dataSource, async (m) => {
      const watchlists = await m.getRepository(Watchlist).find({
        where: { userId },
        order: { sortOrder: "ASC", createdAt: "ASC" },
      });

      if (watchlists.length === 0) {
        return [];
      }

      const watchlistIds = watchlists.map((w) => w.id);
      const countsRaw: Array<{ watchlist_id: string; count: string }> =
        await m.query(
          `SELECT watchlist_id, COUNT(*)::text as count
           FROM watchlist_items
           WHERE watchlist_id = ANY($1::uuid[])
           GROUP BY watchlist_id`,
          [watchlistIds],
        );

      const countMap = new Map<string, number>();
      for (const row of countsRaw) {
        countMap.set(row.watchlist_id, parseInt(row.count, 10));
      }

      return watchlists.map((w) => ({
        id: w.id,
        userId: w.userId,
        name: w.name,
        description: w.description,
        sortOrder: w.sortOrder,
        itemCount: countMap.get(w.id) ?? 0,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));
    });
  }

  /**
   * Find a single watchlist by ID with all items and enriched quotes.
   */
  async findOne(userId: string, id: string): Promise<WatchlistDetailResponse> {
    return withScopedDb(this.dataSource, async (m) => {
      const watchlist = await m.getRepository(Watchlist).findOne({
        where: { id, userId },
      });

      if (!watchlist) {
        throw new NotFoundException(
          tr("errors.watchlists.notFound", `Watchlist not found`),
        );
      }

      const items = await m.getRepository(WatchlistItem).find({
        where: { watchlistId: id, userId },
        relations: ["security"],
        order: { sortOrder: "ASC", createdAt: "ASC" },
      });

      if (items.length === 0) {
        return {
          id: watchlist.id,
          userId: watchlist.userId,
          name: watchlist.name,
          description: watchlist.description,
          sortOrder: watchlist.sortOrder,
          createdAt: watchlist.createdAt,
          updatedAt: watchlist.updatedAt,
          items: [],
        };
      }

      const securityIds = items.map((item) => item.securityId);

      // Query the two most recent close prices per security in a single window query.
      const priceRows: Array<{
        security_id: string;
        close_price: string;
        price_date: string | Date;
        rn: string;
      }> = await m.query(
        `SELECT security_id, close_price, price_date, rn FROM (
           SELECT security_id, close_price, price_date,
                  ROW_NUMBER() OVER (PARTITION BY security_id ORDER BY price_date DESC) as rn
           FROM security_prices
           WHERE security_id = ANY($1::uuid[])
         ) sub
         WHERE rn <= 2
         ORDER BY security_id, rn`,
        [securityIds],
      );

      const priceMap = new Map<
        string,
        Array<{ price: number; date: string | Date }>
      >();
      for (const row of priceRows) {
        const list = priceMap.get(row.security_id) || [];
        list.push({
          price: Number(row.close_price),
          date: row.price_date,
        });
        priceMap.set(row.security_id, list);
      }

      const enrichedItems: WatchlistItemResponse[] = items.map((item) => {
        const prices = priceMap.get(item.securityId) || [];
        const latest = prices[0] ?? null;
        const previous = prices[1] ?? null;

        let quote: WatchlistItemQuote;
        if (latest && Number.isFinite(latest.price)) {
          const currentPrice = latest.price;
          const previousPrice =
            previous && Number.isFinite(previous.price) ? previous.price : null;

          let dailyChange: number | null = null;
          let dailyChangePercent: number | null = null;
          if (previousPrice != null && previousPrice !== 0) {
            dailyChange = currentPrice - previousPrice;
            dailyChangePercent = (dailyChange / previousPrice) * 100;
          }

          let formattedDate: string | null = null;
          if (latest.date instanceof Date) {
            formattedDate = latest.date.toISOString().split("T")[0];
          } else if (typeof latest.date === "string") {
            formattedDate = latest.date.split("T")[0];
          }

          quote = {
            status: "available",
            currentPrice,
            previousPrice,
            dailyChange,
            dailyChangePercent,
            priceDate: formattedDate,
          };
        } else {
          // Explicit unavailable state - no quote/price available.
          // Never fabricate zero-price fallbacks.
          quote = {
            status: "unavailable",
            currentPrice: null,
            previousPrice: null,
            dailyChange: null,
            dailyChangePercent: null,
            priceDate: null,
          };
        }

        return {
          id: item.id,
          watchlistId: item.watchlistId,
          securityId: item.securityId,
          sortOrder: item.sortOrder,
          createdAt: item.createdAt,
          security: {
            id: item.security?.id ?? item.securityId,
            symbol: item.security?.symbol ?? "",
            name: item.security?.name ?? "",
            currencyCode: item.security?.currencyCode ?? "",
            securityType: item.security?.securityType ?? null,
            exchange: item.security?.exchange ?? null,
            isin: item.security?.isin ?? null,
            amfiSchemeCode: item.security?.amfiSchemeCode ?? null,
          },
          quote,
        };
      });

      return {
        id: watchlist.id,
        userId: watchlist.userId,
        name: watchlist.name,
        description: watchlist.description,
        sortOrder: watchlist.sortOrder,
        createdAt: watchlist.createdAt,
        updatedAt: watchlist.updatedAt,
        items: enrichedItems,
      };
    });
  }

  /**
   * Create a new watchlist for a user.
   */
  async create(
    userId: string,
    dto: CreateWatchlistDto,
  ): Promise<WatchlistSummaryResponse> {
    const trimmedName = dto.name.trim();
    if (!trimmedName) {
      throw new BadRequestException(
        tr("errors.watchlists.nameRequired", "Watchlist name is required"),
      );
    }

    return withScopedDb(this.dataSource, async (m) => {
      const repo = m.getRepository(Watchlist);

      // Check unique name per user
      const existing = await repo.findOne({
        where: { userId, name: trimmedName },
      });
      if (existing) {
        throw new ConflictException(
          tr(
            "errors.watchlists.alreadyExists",
            `A watchlist named "${trimmedName}" already exists`,
          ),
        );
      }

      let sortOrder = dto.sortOrder;
      if (sortOrder === undefined || sortOrder === null) {
        const maxResult: Array<{ max_sort: number | null }> = await m.query(
          `SELECT MAX(sort_order) as max_sort FROM watchlists WHERE user_id = $1`,
          [userId],
        );
        const maxSort = maxResult[0]?.max_sort;
        sortOrder = maxSort !== null && maxSort !== undefined ? maxSort + 1 : 0;
      }

      const watchlist = repo.create({
        userId,
        name: trimmedName,
        description: dto.description?.trim() || null,
        sortOrder,
      });

      const saved = await repo.save(watchlist);
      return {
        id: saved.id,
        userId: saved.userId,
        name: saved.name,
        description: saved.description,
        sortOrder: saved.sortOrder,
        itemCount: 0,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      };
    });
  }

  /**
   * Update a watchlist (name, description, sortOrder).
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateWatchlistDto,
  ): Promise<WatchlistSummaryResponse> {
    return withScopedDb(this.dataSource, async (m) => {
      const repo = m.getRepository(Watchlist);
      const watchlist = await repo.findOne({ where: { id, userId } });
      if (!watchlist) {
        throw new NotFoundException(
          tr("errors.watchlists.notFound", "Watchlist not found"),
        );
      }

      if (dto.name !== undefined) {
        const trimmed = dto.name.trim();
        if (!trimmed) {
          throw new BadRequestException(
            tr("errors.watchlists.nameRequired", "Watchlist name is required"),
          );
        }
        if (trimmed !== watchlist.name) {
          const conflict = await repo.findOne({
            where: { userId, name: trimmed },
          });
          if (conflict) {
            throw new ConflictException(
              tr(
                "errors.watchlists.alreadyExists",
                `A watchlist named "${trimmed}" already exists`,
              ),
            );
          }
          watchlist.name = trimmed;
        }
      }

      if (dto.description !== undefined) {
        watchlist.description = dto.description?.trim() || null;
      }

      if (dto.sortOrder !== undefined) {
        watchlist.sortOrder = dto.sortOrder;
      }

      const saved = await repo.save(watchlist);

      const countResult: Array<{ count: string }> = await m.query(
        `SELECT COUNT(*)::text as count FROM watchlist_items WHERE watchlist_id = $1`,
        [id],
      );
      const itemCount = parseInt(countResult[0]?.count ?? "0", 10);

      return {
        id: saved.id,
        userId: saved.userId,
        name: saved.name,
        description: saved.description,
        sortOrder: saved.sortOrder,
        itemCount,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      };
    });
  }

  /**
   * Delete a watchlist.
   */
  async remove(userId: string, id: string): Promise<void> {
    await withScopedDb(this.dataSource, async (m) => {
      const repo = m.getRepository(Watchlist);
      const watchlist = await repo.findOne({ where: { id, userId } });
      if (!watchlist) {
        throw new NotFoundException(
          tr("errors.watchlists.notFound", "Watchlist not found"),
        );
      }
      await repo.remove(watchlist);
    });
  }

  /**
   * Add a security to a watchlist.
   */
  async addItem(
    userId: string,
    watchlistId: string,
    dto: AddWatchlistItemDto,
  ): Promise<WatchlistItemResponse> {
    return withScopedDb(this.dataSource, async (m) => {
      // 1. Verify watchlist ownership
      const watchlist = await m.getRepository(Watchlist).findOne({
        where: { id: watchlistId, userId },
      });
      if (!watchlist) {
        throw new NotFoundException(
          tr("errors.watchlists.notFound", "Watchlist not found"),
        );
      }

      // 2. Verify security ownership/existence
      const security = await m.getRepository(Security).findOne({
        where: { id: dto.securityId, userId },
      });
      if (!security) {
        throw new NotFoundException(
          tr("errors.securities.notFound", "Security not found"),
        );
      }

      // 3. Prevent duplicate item in the same watchlist
      const itemRepo = m.getRepository(WatchlistItem);
      const existing = await itemRepo.findOne({
        where: { watchlistId, securityId: dto.securityId },
      });
      if (existing) {
        throw new ConflictException(
          tr(
            "errors.watchlists.itemAlreadyExists",
            "Security is already in this watchlist",
          ),
        );
      }

      // 4. Determine sort_order
      let sortOrder = dto.sortOrder;
      if (sortOrder === undefined || sortOrder === null) {
        const maxResult: Array<{ max_sort: number | null }> = await m.query(
          `SELECT MAX(sort_order) as max_sort FROM watchlist_items WHERE watchlist_id = $1`,
          [watchlistId],
        );
        const maxSort = maxResult[0]?.max_sort;
        sortOrder = maxSort !== null && maxSort !== undefined ? maxSort + 1 : 0;
      }

      const item = itemRepo.create({
        userId,
        watchlistId,
        securityId: dto.securityId,
        sortOrder,
      });

      const saved = await itemRepo.save(item);

      // 5. Query quote for this security
      const priceRows: Array<{
        close_price: string;
        price_date: string | Date;
        rn: string;
      }> = await m.query(
        `SELECT close_price, price_date, rn FROM (
           SELECT close_price, price_date,
                  ROW_NUMBER() OVER (ORDER BY price_date DESC) as rn
           FROM security_prices
           WHERE security_id = $1::uuid
         ) sub
         WHERE rn <= 2
         ORDER BY rn`,
        [dto.securityId],
      );

      const latest = priceRows.find((r) => r.rn === "1");
      const previous = priceRows.find((r) => r.rn === "2");

      let quote: WatchlistItemQuote;
      if (latest && Number.isFinite(Number(latest.close_price))) {
        const currentPrice = Number(latest.close_price);
        const previousPrice =
          previous && Number.isFinite(Number(previous.close_price))
            ? Number(previous.close_price)
            : null;

        let dailyChange: number | null = null;
        let dailyChangePercent: number | null = null;
        if (previousPrice != null && previousPrice !== 0) {
          dailyChange = currentPrice - previousPrice;
          dailyChangePercent = (dailyChange / previousPrice) * 100;
        }

        let formattedDate: string | null = null;
        if (latest.price_date instanceof Date) {
          formattedDate = latest.price_date.toISOString().split("T")[0];
        } else if (typeof latest.price_date === "string") {
          formattedDate = latest.price_date.split("T")[0];
        }

        quote = {
          status: "available",
          currentPrice,
          previousPrice,
          dailyChange,
          dailyChangePercent,
          priceDate: formattedDate,
        };
      } else {
        quote = {
          status: "unavailable",
          currentPrice: null,
          previousPrice: null,
          dailyChange: null,
          dailyChangePercent: null,
          priceDate: null,
        };
      }

      return {
        id: saved.id,
        watchlistId: saved.watchlistId,
        securityId: saved.securityId,
        sortOrder: saved.sortOrder,
        createdAt: saved.createdAt,
        security: {
          id: security.id,
          symbol: security.symbol,
          name: security.name,
          currencyCode: security.currencyCode,
          securityType: security.securityType ?? null,
          exchange: security.exchange ?? null,
          isin: security.isin ?? null,
          amfiSchemeCode: security.amfiSchemeCode ?? null,
        },
        quote,
      };
    });
  }

  /**
   * Remove a security from a watchlist.
   */
  async removeItem(
    userId: string,
    watchlistId: string,
    itemId: string,
  ): Promise<void> {
    await withScopedDb(this.dataSource, async (m) => {
      // Verify watchlist ownership
      const watchlist = await m.getRepository(Watchlist).findOne({
        where: { id: watchlistId, userId },
      });
      if (!watchlist) {
        throw new NotFoundException(
          tr("errors.watchlists.notFound", "Watchlist not found"),
        );
      }

      const itemRepo = m.getRepository(WatchlistItem);
      const item = await itemRepo.findOne({
        where: { id: itemId, watchlistId, userId },
      });
      if (!item) {
        throw new NotFoundException(
          tr("errors.watchlists.itemNotFound", "Watchlist item not found"),
        );
      }

      await itemRepo.remove(item);
    });
  }

  /**
   * Reorder items within a watchlist with transactional sort_order update.
   */
  async reorderItems(
    userId: string,
    watchlistId: string,
    dto: ReorderWatchlistItemsDto,
  ): Promise<void> {
    await withScopedDb(this.dataSource, async (m) => {
      const watchlist = await m.getRepository(Watchlist).findOne({
        where: { id: watchlistId, userId },
      });
      if (!watchlist) {
        throw new NotFoundException(
          tr("errors.watchlists.notFound", "Watchlist not found"),
        );
      }

      const items = await m.getRepository(WatchlistItem).find({
        where: { watchlistId, userId },
      });
      const itemMap = new Map(items.map((i) => [i.id, i]));

      // Verify all provided itemIds belong to this watchlist
      for (const id of dto.itemIds) {
        if (!itemMap.has(id)) {
          throw new BadRequestException(
            tr(
              "errors.watchlists.invalidReorderItem",
              `Item ${id} does not belong to this watchlist`,
            ),
          );
        }
      }

      // Update sort orders transactionally
      for (let i = 0; i < dto.itemIds.length; i++) {
        await m.query(
          `UPDATE watchlist_items
           SET sort_order = $1
           WHERE id = $2 AND watchlist_id = $3 AND user_id = $4`,
          [i, dto.itemIds[i], watchlistId, userId],
        );
      }
    });
  }

  /**
   * Reorder watchlists for a user with transactional sort_order update.
   */
  async reorderWatchlists(
    userId: string,
    dto: ReorderWatchlistsDto,
  ): Promise<void> {
    await withScopedDb(this.dataSource, async (m) => {
      const watchlists = await m.getRepository(Watchlist).find({
        where: { userId },
      });
      const watchlistMap = new Map(watchlists.map((w) => [w.id, w]));

      for (const id of dto.watchlistIds) {
        if (!watchlistMap.has(id)) {
          throw new BadRequestException(
            tr(
              "errors.watchlists.invalidReorderWatchlist",
              `Watchlist ${id} does not belong to user`,
            ),
          );
        }
      }

      for (let i = 0; i < dto.watchlistIds.length; i++) {
        await m.query(
          `UPDATE watchlists
           SET sort_order = $1
           WHERE id = $2 AND user_id = $3`,
          [i, dto.watchlistIds[i], userId],
        );
      }
    });
  }

  /**
   * Refresh quotes for securities in this watchlist via SecurityPriceService
   * and return the refreshed watchlist details.
   */
  async refreshQuotes(
    userId: string,
    watchlistId: string,
  ): Promise<WatchlistDetailResponse> {
    // 1. Verify existence and load security IDs
    const detail = await this.findOne(userId, watchlistId);
    const securityIds = detail.items.map((i) => i.securityId);

    if (securityIds.length > 0) {
      try {
        await this.securityPriceService.refreshPricesForSecurities(securityIds);
      } catch (err) {
        this.logger.warn(
          `Price refresh partially failed for watchlist ${watchlistId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 2. Return fresh data after provider refresh
    return this.findOne(userId, watchlistId);
  }
}

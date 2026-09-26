import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { tr } from "../i18n/translate";
import {
  AllowDelegate,
  DelegateRequiresSection,
} from "../delegation/decorators/delegate-access.decorator";
import { MarketIndexService, MarketIndexView } from "./market-index.service";
import { PerformanceComparisonService } from "./performance-comparison.service";
import { PerformanceComparisonQueryDto } from "./dto/performance-comparison-query.dto";
import {
  FundRollingReturnsView,
  PerformanceComparisonView,
} from "./performance-comparison.types";

/**
 * The Security Performance report's comparison chart and the benchmark catalog
 * behind it.
 *
 * Its own prefix rather than a route under `/securities`, so nothing has to be
 * declared before `GET /securities/:id` to keep a non-UUID path segment from
 * being parsed as an id.
 */
@ApiTags("Investment Performance")
@Controller("investments/performance")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
// Read-only investment data, so a delegate holding the investments section may
// see it, exactly as they may see the portfolio summary.
@DelegateRequiresSection("investments")
export class PerformanceComparisonController {
  constructor(
    private readonly marketIndexService: MarketIndexService,
    private readonly performanceComparisonService: PerformanceComparisonService,
  ) {}

  @Get("indexes")
  @AllowDelegate()
  @ApiOperation({
    summary: "List the market indexes available as a benchmark overlay",
    description:
      "The curated catalog with the history actually stored for each entry, so " +
      "a picker can grey out an index that cannot yet be drawn.",
  })
  @ApiResponse({ status: 200, description: "Market index catalog" })
  listIndexes(): Promise<MarketIndexView[]> {
    return this.marketIndexService.listCatalog();
  }

  @Get("comparison")
  @AllowDelegate()
  @ApiOperation({
    summary: "Cumulative percent return for securities and market indexes",
    description:
      "Every series is rebased at the window's start. A series with no usable " +
      "price at that boundary is returned in `excluded` with a reason rather " +
      "than drawn from its own later start.",
  })
  @ApiResponse({ status: 200, description: "Comparison series" })
  getComparison(
    @Request() req,
    @Query() query: PerformanceComparisonQueryDto,
  ): Promise<PerformanceComparisonView> {
    if (!query.hasSelection()) {
      throw new BadRequestException(
        tr(
          "errors.securities.comparisonSelectionEmpty",
          "Select at least one security or market index to compare",
        ),
      );
    }
    return this.performanceComparisonService.getComparison(req.user.id, {
      securityIds: query.securityIds ?? [],
      indexCodes: query.indexCodes ?? [],
      startDate: query.startDate || undefined,
      endDate: query.endDate || undefined,
    });
  }

  /**
   * Owner-only: no `@AllowDelegate()`, so a delegate is refused. Throttled
   * because the read may reach the NAV provider for a fund with no history yet.
   */
  @Get("securities/:id/rolling-returns")
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @ApiOperation({
    summary: "Rolling 1Y/3Y/5Y return distribution of an AMFI mutual fund",
    description:
      "Every NAV date is a window end; its start is the last NAV at or before " +
      "the same date one, three or five years earlier, at most 14 days older. " +
      "1Y is absolute, 3Y and 5Y are annualized. Windows whose start cannot " +
      "be priced are counted and located in `gaps`, never reported as 0.",
  })
  @ApiResponse({ status: 200, description: "Rolling return distribution" })
  @ApiResponse({ status: 404, description: "Security not found" })
  getRollingReturns(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<FundRollingReturnsView> {
    return this.performanceComparisonService.getRollingReturns(req.user.id, id);
  }
}

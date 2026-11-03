import {
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import {
  CoachService,
  WeeklyCoachMetrics,
  WeeklyCoachReport,
} from "./coach.service";
import { CoachQueryDto } from "./dto/coach-query.dto";

const today = (): string => new Date().toISOString().slice(0, 10);

@ApiTags("Coach")
@Controller("coach")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
export class CoachController {
  constructor(private readonly service: CoachService) {}

  @Get("weekly")
  @ApiOperation({ summary: "Deterministic weekly money metrics (no AI call)" })
  metrics(
    @Request() req: { user: { id: string } },
    @Query() query: CoachQueryDto,
  ): Promise<WeeklyCoachMetrics> {
    return this.service.weeklyMetrics(req.user.id, query.asOf ?? today());
  }

  @Post("weekly")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      "Weekly metrics plus an AI narrative that is rejected if it quotes any number not computed here",
  })
  report(
    @Request() req: { user: { id: string } },
    @Query() query: CoachQueryDto,
  ): Promise<WeeklyCoachReport> {
    return this.service.weeklyReport(req.user.id, query.asOf ?? today());
  }
}

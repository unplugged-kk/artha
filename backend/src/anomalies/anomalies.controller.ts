import { Controller, Get, Query, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import {
  AnomalyDetectionService,
  AnomalyReport,
} from "./anomaly-detection.service";
import { AnomaliesQueryDto } from "./dto/anomalies-query.dto";

@ApiTags("Anomalies")
@Controller("anomalies")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
export class AnomaliesController {
  constructor(private readonly service: AnomalyDetectionService) {}

  @Get()
  @ApiOperation({
    summary:
      "Deterministic anomalies: category spending spikes and subscription price increases",
  })
  detect(
    @Request() req: { user: { id: string } },
    @Query() query: AnomaliesQueryDto,
  ): Promise<AnomalyReport> {
    const asOf = query.asOf ?? new Date().toISOString().slice(0, 10);
    return this.service.detect(req.user.id, asOf);
  }
}

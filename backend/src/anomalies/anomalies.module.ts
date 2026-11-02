import { Module } from "@nestjs/common";
import { TransactionsModule } from "../transactions/transactions.module";
import { AnomaliesController } from "./anomalies.controller";
import { AnomalyDetectionService } from "./anomaly-detection.service";

@Module({
  imports: [TransactionsModule],
  providers: [AnomalyDetectionService],
  controllers: [AnomaliesController],
  exports: [AnomalyDetectionService],
})
export class AnomaliesModule {}

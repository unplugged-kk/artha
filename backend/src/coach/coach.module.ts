import { Module } from "@nestjs/common";
import { TransactionsModule } from "../transactions/transactions.module";
import { BudgetsModule } from "../budgets/budgets.module";
import { NetWorthModule } from "../net-worth/net-worth.module";
import { AiModule } from "../ai/ai.module";
import { CoachController } from "./coach.controller";
import { CoachService } from "./coach.service";

@Module({
  imports: [TransactionsModule, BudgetsModule, NetWorthModule, AiModule],
  providers: [CoachService],
  controllers: [CoachController],
  exports: [CoachService],
})
export class CoachModule {}

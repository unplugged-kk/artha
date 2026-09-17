import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Goal } from "./entities/goal.entity";
import { GoalTransaction } from "./entities/goal-transaction.entity";
import { Account } from "../accounts/entities/account.entity";
import { Transaction } from "../transactions/entities/transaction.entity";
import { GoalsService } from "./goals.service";
import { GoalsController } from "./goals.controller";
import { BudgetsModule } from "../budgets/budgets.module";
import { CurrenciesModule } from "../currencies/currencies.module";
import { ActionHistoryModule } from "../action-history/action-history.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Goal, GoalTransaction, Account, Transaction]),
    BudgetsModule,
    CurrenciesModule,
    ActionHistoryModule,
  ],
  providers: [GoalsService],
  controllers: [GoalsController],
  exports: [GoalsService],
})
export class GoalsModule {}

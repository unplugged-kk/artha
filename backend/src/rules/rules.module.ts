import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TransactionRule } from "./entities/transaction-rule.entity";
import { RulesService } from "./rules.service";
import { RulesController } from "./rules.controller";

@Module({
  imports: [TypeOrmModule.forFeature([TransactionRule])],
  controllers: [RulesController],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}

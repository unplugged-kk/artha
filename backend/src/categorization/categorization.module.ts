import { Module } from "@nestjs/common";
import { RulesModule } from "../rules/rules.module";
import { CategorizationController } from "./categorization.controller";
import { CategorizationSuggestionService } from "./categorization-suggestion.service";

@Module({
  imports: [RulesModule],
  providers: [CategorizationSuggestionService],
  controllers: [CategorizationController],
  exports: [CategorizationSuggestionService],
})
export class CategorizationModule {}

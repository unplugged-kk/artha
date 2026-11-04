import { Body, Controller, Post, Request, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import {
  CategorizationSuggestion,
  CategorizationSuggestionService,
} from "./categorization-suggestion.service";
import { SuggestCategoryDto } from "./dto/suggest-category.dto";

@ApiTags("Categorization")
@Controller("categorization")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
export class CategorizationController {
  constructor(private readonly service: CategorizationSuggestionService) {}

  @Post("suggest")
  @ApiOperation({
    summary:
      "Suggest a category from your rules, known merchants and history; reports the tier that decided",
  })
  suggest(
    @Request() req: { user: { id: string } },
    @Body() dto: SuggestCategoryDto,
  ): Promise<CategorizationSuggestion> {
    return this.service.suggest(req.user.id, dto);
  }
}

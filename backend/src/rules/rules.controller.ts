import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RulesService } from "./rules.service";
import { CreateRuleDto } from "./dto/create-rule.dto";
import { UpdateRuleDto } from "./dto/update-rule.dto";
import { ReorderRulesDto } from "./dto/reorder-rules.dto";
import { TestRuleDto } from "./dto/test-rule.dto";
import { ApplyRulesDto } from "./dto/apply-rules.dto";

@ApiTags("Transaction Rules")
@Controller("rules")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Get()
  @ApiOperation({ summary: "Get all transaction rules for the user" })
  @ApiResponse({
    status: 200,
    description: "List of rules ordered by priority",
  })
  findAll(@Request() req) {
    return this.rulesService.findAll(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new transaction categorization rule" })
  @ApiResponse({ status: 201, description: "Rule created successfully" })
  create(@Request() req, @Body() dto: CreateRuleDto) {
    return this.rulesService.create(req.user.id, dto);
  }

  @Put("reorder")
  @ApiOperation({ summary: "Reorder rules by priority" })
  @ApiResponse({ status: 200, description: "Rules reordered successfully" })
  reorder(@Request() req, @Body() dto: ReorderRulesDto) {
    return this.rulesService.reorder(req.user.id, dto);
  }

  @Post("test")
  @ApiOperation({
    summary: "Test a rule against candidate or sample transactions",
  })
  @ApiResponse({ status: 200, description: "Test evaluation result" })
  test(@Request() req, @Body() dto: TestRuleDto) {
    return this.rulesService.testRule(req.user.id, dto);
  }

  @Post("apply")
  @ApiOperation({ summary: "Apply active rules to existing transactions" })
  @ApiResponse({ status: 200, description: "Rule application summary" })
  apply(@Request() req, @Body() dto: ApplyRulesDto) {
    return this.rulesService.applyRules(req.user.id, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a single rule by ID" })
  @ApiResponse({ status: 200, description: "Rule details" })
  findOne(@Request() req, @Param("id", ParseUUIDPipe) id: string) {
    return this.rulesService.findOne(req.user.id, id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Update an existing transaction rule" })
  @ApiResponse({ status: 200, description: "Rule updated successfully" })
  update(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRuleDto,
  ) {
    return this.rulesService.update(req.user.id, id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a transaction rule" })
  @ApiResponse({ status: 200, description: "Rule deleted successfully" })
  remove(@Request() req, @Param("id", ParseUUIDPipe) id: string) {
    return this.rulesService.remove(req.user.id, id);
  }
}

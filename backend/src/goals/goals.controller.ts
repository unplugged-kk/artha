import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { GoalsService } from "./goals.service";
import { CreateGoalDto } from "./dto/create-goal.dto";
import { UpdateGoalDto } from "./dto/update-goal.dto";
import { LinkTransactionDto } from "./dto/link-transaction.dto";
import { GoalStatus, GoalType } from "./constants/goal.enums";
import {
  AllowDelegate,
  DelegateRequiresSection,
} from "../delegation/decorators/delegate-access.decorator";

@ApiTags("Goals")
@Controller("goals")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
@DelegateRequiresSection("budgets")
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new financial goal or emergency fund" })
  @ApiResponse({ status: 201, description: "Goal created successfully" })
  async create(@Request() req: any, @Body() createGoalDto: CreateGoalDto) {
    return this.goalsService.create(req.user.id, createGoalDto);
  }

  @Get()
  @AllowDelegate()
  @ApiOperation({ summary: "Get all goals for current user" })
  @ApiQuery({ name: "status", enum: GoalStatus, required: false })
  @ApiQuery({ name: "type", enum: GoalType, required: false })
  async findAll(
    @Request() req: any,
    @Query("status") status?: GoalStatus,
    @Query("type") type?: GoalType,
  ) {
    return this.goalsService.findAll(req.user.id, { status, type });
  }

  @Get("summary")
  @AllowDelegate()
  @ApiOperation({ summary: "Get goals summary metrics" })
  async getSummary(@Request() req: any) {
    return this.goalsService.getSummary(req.user.id);
  }

  @Get(":id")
  @AllowDelegate()
  @ApiOperation({ summary: "Get a specific goal by ID with progress metrics" })
  @ApiParam({ name: "id", description: "Goal ID (UUID)" })
  async findOne(@Request() req: any, @Param("id", ParseUUIDPipe) id: string) {
    return this.goalsService.findOne(req.user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update an existing goal" })
  @ApiParam({ name: "id", description: "Goal ID (UUID)" })
  async update(
    @Request() req: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateGoalDto: UpdateGoalDto,
  ) {
    return this.goalsService.update(req.user.id, id, updateGoalDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a goal" })
  @ApiParam({ name: "id", description: "Goal ID (UUID)" })
  async remove(@Request() req: any, @Param("id", ParseUUIDPipe) id: string) {
    await this.goalsService.remove(req.user.id, id);
    return { success: true };
  }

  @Post(":id/transactions")
  @ApiOperation({ summary: "Link a transaction to a goal" })
  @ApiParam({ name: "id", description: "Goal ID (UUID)" })
  async linkTransaction(
    @Request() req: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LinkTransactionDto,
  ) {
    return this.goalsService.linkTransaction(
      req.user.id,
      id,
      dto.transactionId,
    );
  }

  @Delete(":id/transactions/:transactionId")
  @ApiOperation({ summary: "Unlink a transaction from a goal" })
  @ApiParam({ name: "id", description: "Goal ID (UUID)" })
  @ApiParam({ name: "transactionId", description: "Transaction ID (UUID)" })
  async unlinkTransaction(
    @Request() req: any,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("transactionId", ParseUUIDPipe) transactionId: string,
  ) {
    return this.goalsService.unlinkTransaction(req.user.id, id, transactionId);
  }

  @Get(":id/transactions")
  @AllowDelegate()
  @ApiOperation({ summary: "Get all transactions linked to a goal" })
  @ApiParam({ name: "id", description: "Goal ID (UUID)" })
  async getGoalTransactions(
    @Request() req: any,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.goalsService.getGoalTransactions(req.user.id, id);
  }
}

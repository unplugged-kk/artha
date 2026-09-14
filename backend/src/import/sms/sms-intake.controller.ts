import {
  Controller,
  Post,
  Get,
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
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { SmsIntakeService } from "./sms-intake.service";
import { SmsSenderRegistryService } from "./sms-sender-registry.service";
import { ParseSmsDto } from "./dto/parse-sms.dto";
import { ImportSmsDto } from "./dto/import-sms.dto";
import {
  ParsedSmsResponseDto,
  SmsImportResultDto,
} from "./dto/parsed-sms-response.dto";
import {
  CreateSmsSenderDto,
  UpdateSmsSenderDto,
  SmsSenderResponseDto,
} from "./dto/sms-sender-registry.dto";
import { BankMetadata } from "./parsers/bank-sender-registry.data";

@ApiTags("Import - SMS")
@ApiBearerAuth()
@UseGuards(AuthGuard("jwt"))
@Controller("import/sms")
export class SmsIntakeController {
  constructor(
    private readonly smsIntakeService: SmsIntakeService,
    private readonly senderRegistryService: SmsSenderRegistryService,
  ) {}

  @Post("parse")
  @ApiOperation({
    summary:
      "Parse raw bank SMS message into a candidate transaction without saving",
  })
  @ApiResponse({
    status: 200,
    description: "SMS parsed successfully or returned explicit status",
    type: ParsedSmsResponseDto,
  })
  async parseSms(
    @Request() req,
    @Body() dto: ParseSmsDto,
  ): Promise<ParsedSmsResponseDto> {
    return this.smsIntakeService.parseSms(req.user.id, dto);
  }

  @Post("import")
  @ApiOperation({
    summary:
      "Parse and import an SMS message into the canonical transaction ledger",
  })
  @ApiResponse({
    status: 201,
    description:
      "Transaction imported, skipped as duplicate, or flagged for review",
    type: SmsImportResultDto,
  })
  async importSms(
    @Request() req,
    @Body() dto: ImportSmsDto,
  ): Promise<SmsImportResultDto> {
    return this.smsIntakeService.importSms(req.user.id, dto);
  }

  // --- Sender Registry Endpoints ---

  @Get("senders")
  @ApiOperation({ summary: "Get user's configured SMS sender mappings" })
  @ApiResponse({
    status: 200,
    description: "List of configured SMS sender mappings",
    type: [SmsSenderResponseDto],
  })
  async listSenders(@Request() req): Promise<SmsSenderResponseDto[]> {
    return this.senderRegistryService.listSenders(req.user.id);
  }

  @Get("senders/known")
  @ApiOperation({
    summary: "List recognized Indian bank institutions and patterns",
  })
  @ApiResponse({
    status: 200,
    description: "List of known Indian bank metadata and sender patterns",
  })
  getKnownBanks(): BankMetadata[] {
    return this.senderRegistryService.getKnownBanks();
  }

  @Post("senders")
  @ApiOperation({ summary: "Register an SMS sender pattern to an account" })
  @ApiResponse({
    status: 201,
    description: "Sender mapping created",
    type: SmsSenderResponseDto,
  })
  async createSender(
    @Request() req,
    @Body() dto: CreateSmsSenderDto,
  ): Promise<SmsSenderResponseDto> {
    return this.senderRegistryService.createSender(req.user.id, dto);
  }

  @Put("senders/:id")
  @ApiOperation({ summary: "Update an existing SMS sender mapping" })
  @ApiResponse({
    status: 200,
    description: "Sender mapping updated",
    type: SmsSenderResponseDto,
  })
  async updateSender(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateSmsSenderDto,
  ): Promise<SmsSenderResponseDto> {
    return this.senderRegistryService.updateSender(req.user.id, id, dto);
  }

  @Delete("senders/:id")
  @ApiOperation({ summary: "Delete an SMS sender mapping" })
  @ApiResponse({ status: 200, description: "Sender mapping deleted" })
  async deleteSender(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.senderRegistryService.deleteSender(req.user.id, id);
  }
}

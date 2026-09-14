import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Put,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiParam,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { WatchlistsService } from "./watchlists.service";
import { CreateWatchlistDto } from "./dto/create-watchlist.dto";
import { UpdateWatchlistDto } from "./dto/update-watchlist.dto";
import { AddWatchlistItemDto } from "./dto/add-watchlist-item.dto";
import { ReorderWatchlistItemsDto } from "./dto/reorder-watchlist-items.dto";
import { ReorderWatchlistsDto } from "./dto/reorder-watchlists.dto";

@ApiTags("Watchlists")
@Controller("watchlists")
@UseGuards(AuthGuard("jwt"))
@ApiBearerAuth()
export class WatchlistsController {
  constructor(private readonly watchlistsService: WatchlistsService) {}

  @Get()
  @ApiOperation({ summary: "List all watchlists for current user" })
  @ApiResponse({ status: 200, description: "List of watchlists" })
  findAll(@Request() req) {
    return this.watchlistsService.findAll(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: "Create a new watchlist" })
  @ApiResponse({ status: 201, description: "Watchlist created successfully" })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 409, description: "Watchlist name conflict" })
  create(@Request() req, @Body() createWatchlistDto: CreateWatchlistDto) {
    return this.watchlistsService.create(req.user.id, createWatchlistDto);
  }

  @Put("reorder")
  @ApiOperation({ summary: "Reorder user watchlists" })
  @ApiResponse({
    status: 200,
    description: "Watchlists reordered successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid watchlist list" })
  reorderWatchlists(@Request() req, @Body() dto: ReorderWatchlistsDto) {
    return this.watchlistsService.reorderWatchlists(req.user.id, dto);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a watchlist with its items and real quotes" })
  @ApiParam({ name: "id", description: "Watchlist UUID" })
  @ApiResponse({ status: 200, description: "Watchlist details" })
  @ApiResponse({ status: 404, description: "Watchlist not found" })
  findOne(@Request() req, @Param("id", ParseUUIDPipe) id: string) {
    return this.watchlistsService.findOne(req.user.id, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a watchlist" })
  @ApiParam({ name: "id", description: "Watchlist UUID" })
  @ApiResponse({ status: 200, description: "Watchlist updated successfully" })
  @ApiResponse({ status: 404, description: "Watchlist not found" })
  @ApiResponse({ status: 409, description: "Watchlist name conflict" })
  update(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateWatchlistDto: UpdateWatchlistDto,
  ) {
    return this.watchlistsService.update(req.user.id, id, updateWatchlistDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a watchlist" })
  @ApiParam({ name: "id", description: "Watchlist UUID" })
  @ApiResponse({ status: 200, description: "Watchlist deleted successfully" })
  @ApiResponse({ status: 404, description: "Watchlist not found" })
  remove(@Request() req, @Param("id", ParseUUIDPipe) id: string) {
    return this.watchlistsService.remove(req.user.id, id);
  }

  @Post(":id/items")
  @ApiOperation({ summary: "Add a security to a watchlist" })
  @ApiParam({ name: "id", description: "Watchlist UUID" })
  @ApiResponse({ status: 201, description: "Item added to watchlist" })
  @ApiResponse({ status: 404, description: "Watchlist or security not found" })
  @ApiResponse({ status: 409, description: "Security already in watchlist" })
  addItem(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() addWatchlistItemDto: AddWatchlistItemDto,
  ) {
    return this.watchlistsService.addItem(req.user.id, id, addWatchlistItemDto);
  }

  @Delete(":id/items/:itemId")
  @ApiOperation({ summary: "Remove a security item from a watchlist" })
  @ApiParam({ name: "id", description: "Watchlist UUID" })
  @ApiParam({ name: "itemId", description: "Watchlist Item UUID" })
  @ApiResponse({ status: 200, description: "Item removed from watchlist" })
  @ApiResponse({ status: 404, description: "Item not found" })
  removeItem(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("itemId", ParseUUIDPipe) itemId: string,
  ) {
    return this.watchlistsService.removeItem(req.user.id, id, itemId);
  }

  @Put(":id/items/reorder")
  @ApiOperation({ summary: "Reorder items in a watchlist" })
  @ApiParam({ name: "id", description: "Watchlist UUID" })
  @ApiResponse({ status: 200, description: "Items reordered successfully" })
  @ApiResponse({ status: 400, description: "Invalid item list" })
  reorderItems(
    @Request() req,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReorderWatchlistItemsDto,
  ) {
    return this.watchlistsService.reorderItems(req.user.id, id, dto);
  }

  @Post(":id/refresh-quotes")
  @ApiOperation({ summary: "Refresh quotes for securities in this watchlist" })
  @ApiParam({ name: "id", description: "Watchlist UUID" })
  @ApiResponse({
    status: 200,
    description: "Quotes refreshed and watchlist returned",
  })
  @ApiResponse({ status: 404, description: "Watchlist not found" })
  refreshQuotes(@Request() req, @Param("id", ParseUUIDPipe) id: string) {
    return this.watchlistsService.refreshQuotes(req.user.id, id);
  }
}

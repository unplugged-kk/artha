import {
  BadRequestException,
  ParseUUIDPipe,
  RequestMethod,
  ValidationPipe,
} from "@nestjs/common";
import {
  METHOD_METADATA,
  PATH_METADATA,
  ROUTE_ARGS_METADATA,
} from "@nestjs/common/constants";
import { Test } from "@nestjs/testing";
import { PerformanceComparisonController } from "./performance-comparison.controller";
import { PerformanceComparisonService } from "./performance-comparison.service";
import { MarketIndexService } from "./market-index.service";
import { PerformanceComparisonQueryDto } from "./dto/performance-comparison-query.dto";
import { ALLOW_DELEGATE_KEY } from "../delegation/decorators/delegate-access.decorator";

const USER = "11111111-1111-4111-8111-111111111111";
const SEC_A = "22222222-2222-4222-8222-222222222222";

/**
 * The query is validated by the global pipe, so the rejections are tested
 * *through* it rather than against hand-built objects. A DTO spec that
 * constructs the payload itself never sends what the client sends -- an
 * untouched date control submits `""`, not `undefined`, and that is exactly the
 * case `@IsOptional` alone gets wrong (`backend/CLAUDE.md`, DTO conventions).
 */
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const META = {
  type: "query" as const,
  metatype: PerformanceComparisonQueryDto,
  data: "",
};

async function validate(query: Record<string, unknown>) {
  return pipe.transform(query, META) as Promise<PerformanceComparisonQueryDto>;
}

describe("PerformanceComparisonController", () => {
  let controller: PerformanceComparisonController;
  let comparison: jest.Mocked<
    Pick<PerformanceComparisonService, "getComparison" | "getRollingReturns">
  >;
  let indexes: jest.Mocked<Pick<MarketIndexService, "listCatalog">>;

  beforeEach(async () => {
    comparison = {
      getComparison: jest.fn().mockResolvedValue({}),
      getRollingReturns: jest.fn().mockResolvedValue({}),
    };
    indexes = { listCatalog: jest.fn().mockResolvedValue([]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [PerformanceComparisonController],
      providers: [
        { provide: PerformanceComparisonService, useValue: comparison },
        { provide: MarketIndexService, useValue: indexes },
      ],
    }).compile();
    controller = moduleRef.get(PerformanceComparisonController);
  });

  describe("query validation", () => {
    it("accepts a comma-separated selection with a window", async () => {
      const dto = await validate({
        securityIds: SEC_A,
        indexCodes: "SP500,FTSE_100",
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      });
      expect(dto.securityIds).toEqual([SEC_A]);
      expect(dto.indexCodes).toEqual(["SP500", "FTSE_100"]);
    });

    it("accepts an empty date, which is what an untouched control sends", async () => {
      const dto = await validate({
        indexCodes: "SP500",
        startDate: "",
        endDate: "",
      });
      expect(dto.startDate).toBe("");
      expect(dto.hasSelection()).toBe(true);
    });

    it("rejects a malformed security id", async () => {
      await expect(
        validate({ securityIds: "not-a-uuid" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects an index code that is not in the catalog", async () => {
      await expect(
        validate({ indexCodes: "NOT_AN_INDEX" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects more securities than the chart bounds", async () => {
      const many = Array.from({ length: 21 }, () => SEC_A).join(",");
      await expect(validate({ securityIds: many })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it("rejects more indexes than the chart bounds", async () => {
      await expect(
        validate({
          indexCodes: "SP500,FTSE_100,DAX,CAC_40,AEX,NIKKEI_225",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a date that has the right shape and is not a date", async () => {
      // The shape regex passes both of these. Only real calendar validation
      // rejects them, and without it `new Date(...)` downstream turns the
      // window into NaN rather than raising.
      await expect(
        validate({ indexCodes: "SP500", startDate: "2025-13-45" }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        validate({ indexCodes: "SP500", endDate: "2100-02-29" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("accepts a real leap day", async () => {
      const dto = await validate({
        indexCodes: "SP500",
        startDate: "2024-02-29",
      });
      expect(dto.startDate).toBe("2024-02-29");
    });

    it("rejects an unknown query parameter", async () => {
      await expect(
        validate({ indexCodes: "SP500", sneaky: "1" }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("getComparison", () => {
    it("refuses a request that selected nothing, before touching the service", async () => {
      const dto = await validate({});
      expect(() =>
        controller.getComparison({ user: { id: USER } }, dto),
      ).toThrow(BadRequestException);
      expect(comparison.getComparison).not.toHaveBeenCalled();
    });

    it("passes the selection and window through, with blanks as absent", async () => {
      const dto = await validate({
        securityIds: SEC_A,
        indexCodes: "SP500",
        startDate: "",
        endDate: "2025-12-31",
      });
      await controller.getComparison({ user: { id: USER } }, dto);
      expect(comparison.getComparison).toHaveBeenCalledWith(USER, {
        securityIds: [SEC_A],
        indexCodes: ["SP500"],
        // An empty start is "all history", which the service resolves from the
        // data rather than from a constant.
        startDate: undefined,
        endDate: "2025-12-31",
      });
    });

    it("derives the user from the token, never from the query", async () => {
      const dto = await validate({ indexCodes: "SP500" });
      await controller.getComparison({ user: { id: USER } }, dto);
      expect(comparison.getComparison.mock.calls[0][0]).toBe(USER);
    });
  });

  describe("listIndexes", () => {
    it("returns the catalog", async () => {
      await controller.listIndexes();
      expect(indexes.listCatalog).toHaveBeenCalled();
    });
  });
  describe("getRollingReturns", () => {
    const handler = PerformanceComparisonController.prototype.getRollingReturns;

    it("is GET securities/:id/rolling-returns under the controller prefix", () => {
      expect(
        Reflect.getMetadata(PATH_METADATA, PerformanceComparisonController),
      ).toBe("investments/performance");
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
        "securities/:id/rolling-returns",
      );
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(
        RequestMethod.GET,
      );
    });

    it("is owner-only: no @AllowDelegate()", () => {
      expect(Reflect.getMetadata(ALLOW_DELEGATE_KEY, handler)).toBeUndefined();
    });

    it("is throttled to 60 requests a minute", () => {
      expect(Reflect.getMetadata("THROTTLER:LIMITdefault", handler)).toBe(60);
      expect(Reflect.getMetadata("THROTTLER:TTLdefault", handler)).toBe(60000);
    });

    it("parses the id with ParseUUIDPipe, which rejects a non-UUID with 400", async () => {
      const args = Reflect.getMetadata(
        ROUTE_ARGS_METADATA,
        PerformanceComparisonController,
        "getRollingReturns",
      ) as Record<string, { data?: string; pipes: unknown[] }>;
      const idArg = Object.values(args).find((arg) => arg.data === "id");
      expect(idArg?.pipes).toContain(ParseUUIDPipe);
      await expect(
        new ParseUUIDPipe().transform("not-a-uuid", {
          type: "param",
          data: "id",
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("derives the user from the token and passes the id through", async () => {
      await controller.getRollingReturns({ user: { id: USER } }, SEC_A);
      expect(comparison.getRollingReturns).toHaveBeenCalledWith(USER, SEC_A);
    });
  });
});

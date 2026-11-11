import { DataSource } from "typeorm";
import {
  createScopedDbMocks,
  DataSourceMock,
} from "../test-helpers/scoped-db-testing";

jest.mock("../common/db/scoped-db", () =>
  jest.requireActual("../test-helpers/scoped-db-testing").scopedDbMockModule(),
);

import { FundClassificationService } from "./fund-classification.service";
import { AmfiNavService } from "./amfi-nav.service";
import { Security } from "./entities/security.entity";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function security(overrides: Partial<Security> = {}): Security {
  return {
    id: "sec-1",
    userId: "user-1",
    symbol: "120503",
    name: "Example Large Cap Fund",
    securityType: "MUTUAL_FUND",
    currencyCode: "INR",
    amfiSchemeCode: "120503",
    fundHouse: null,
    fundSchemeType: null,
    fundCategory: null,
    fundClassificationUpdatedAt: null,
    ...overrides,
  } as Security;
}

describe("FundClassificationService", () => {
  let service: FundClassificationService;
  let dataSource: DataSourceMock;
  let securityRepo: Record<string, jest.Mock>;
  let amfi: jest.Mocked<Pick<AmfiNavService, "fetchSchemeClassification">>;

  beforeEach(() => {
    jest.clearAllMocks();
    securityRepo = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const mocks = createScopedDbMocks([[Security, securityRepo]]);
    dataSource = mocks.dataSource;
    amfi = { fetchSchemeClassification: jest.fn() };
    service = new FundClassificationService(
      dataSource as never as DataSource,
      amfi as never as AmfiNavService,
    );
  });

  const ANSWER = {
    fundHouse: "Example Mutual Fund",
    schemeType: "Open Ended Schemes",
    schemeCategory: "Equity Scheme - Large Cap Fund",
  };

  it("writes the published strings verbatim and stamps freshness", async () => {
    amfi.fetchSchemeClassification.mockResolvedValue(ANSWER);
    const fund = security();

    await service.ensureFundClassification([fund]);

    expect(amfi.fetchSchemeClassification).toHaveBeenCalledWith("120503");
    expect(securityRepo.update).toHaveBeenCalledTimes(1);
    const [criteria, patch] = securityRepo.update.mock.calls[0];
    expect(criteria).toEqual({ id: "sec-1", userId: "user-1" });
    expect(patch.fundHouse).toBe("Example Mutual Fund");
    expect(patch.fundSchemeType).toBe("Open Ended Schemes");
    expect(patch.fundCategory).toBe("Equity Scheme - Large Cap Fund");
    expect(patch.fundClassificationUpdatedAt).toBeInstanceOf(Date);
    // The caller's own object carries the capture, so its response is current.
    expect(fund.fundCategory).toBe("Equity Scheme - Large Cap Fund");
  });

  it("writes nothing and stamps nothing when the provider did not answer", async () => {
    // Negative control for INV-FUNDCAT-002: a failed fetch must neither erase a
    // known category nor mark the row fresh.
    amfi.fetchSchemeClassification.mockResolvedValue(null);
    const fund = security({
      fundCategory: "Debt Scheme - Liquid Fund",
      fundHouse: "Known AMC",
      fundClassificationUpdatedAt: null,
    });

    await service.ensureFundClassification([fund]);

    expect(securityRepo.update).not.toHaveBeenCalled();
    expect(fund.fundCategory).toBe("Debt Scheme - Liquid Fund");
    expect(fund.fundHouse).toBe("Known AMC");
    expect(fund.fundClassificationUpdatedAt).toBeNull();
  });

  it("writes nothing when the answer carries no category", async () => {
    amfi.fetchSchemeClassification.mockResolvedValue({
      fundHouse: "Example Mutual Fund",
      schemeType: "Open Ended Schemes",
      schemeCategory: null,
    });
    const fund = security();

    await service.ensureFundClassification([fund]);

    expect(securityRepo.update).not.toHaveBeenCalled();
    expect(fund.fundClassificationUpdatedAt).toBeNull();
  });

  it("skips a security whose classification is inside the staleness window", async () => {
    const fund = security({
      fundCategory: "Equity Scheme - Large Cap Fund",
      fundClassificationUpdatedAt: new Date(Date.now() - STALE_MS / 2),
    });

    await service.ensureFundClassification([fund]);

    expect(amfi.fetchSchemeClassification).not.toHaveBeenCalled();
    expect(securityRepo.update).not.toHaveBeenCalled();
  });

  it("refreshes a classification older than the staleness window", async () => {
    amfi.fetchSchemeClassification.mockResolvedValue(ANSWER);
    const fund = security({
      fundCategory: "Equity Scheme - Multi Cap Fund",
      fundClassificationUpdatedAt: new Date(Date.now() - STALE_MS - 1000),
    });

    await service.ensureFundClassification([fund]);

    expect(amfi.fetchSchemeClassification).toHaveBeenCalledTimes(1);
    expect(fund.fundCategory).toBe("Equity Scheme - Large Cap Fund");
  });

  it("never asks the provider about a security with no scheme code", async () => {
    const stock = security({ amfiSchemeCode: null, symbol: "AAPL" });

    await service.ensureFundClassification([stock]);

    expect(amfi.fetchSchemeClassification).not.toHaveBeenCalled();
    expect(securityRepo.update).not.toHaveBeenCalled();
  });

  it("swallows a provider failure so a read never fails", async () => {
    amfi.fetchSchemeClassification.mockRejectedValue(new Error("outage"));
    const fund = security();

    await expect(
      service.ensureFundClassification([fund]),
    ).resolves.toBeUndefined();
    expect(securityRepo.update).not.toHaveBeenCalled();
  });
});

import { getFinancialYearRules } from "./financial-year.config";
import {
  classifyEquitySale,
  summarizeEquityGains,
  wholeMonthsBetween,
} from "./capital-gains";

const rules = getFinancialYearRules("FY2025-26")!.capitalGains;
const sale = (
  acquiredOn: string,
  soldOn: string,
  cost = 100,
  proceeds = 150,
) => ({
  acquiredOn,
  soldOn,
  cost,
  proceeds,
});

describe("holding period", () => {
  it("counts whole months and respects day of month", () => {
    expect(wholeMonthsBetween("2024-01-31", "2025-01-30")).toBe(11);
    expect(wholeMonthsBetween("2024-01-15", "2025-01-15")).toBe(12);
  });

  it("exactly 12 months is short, one day more is long", () => {
    expect(classifyEquitySale(sale("2024-06-10", "2025-06-10"), rules)).toEqual(
      {
        status: "ok",
        term: "short",
        gain: 50,
      },
    );
    expect(classifyEquitySale(sale("2024-06-10", "2025-06-11"), rules)).toEqual(
      {
        status: "ok",
        term: "long",
        gain: 50,
      },
    );
  });
});

describe("unknowns are not zero", () => {
  it("missing cost or proceeds is unknown", () => {
    expect(
      classifyEquitySale(
        { ...sale("2024-01-01", "2024-03-01"), cost: null },
        rules,
      ),
    ).toEqual({ status: "unknown", reason: "missing_cost" });
    expect(
      classifyEquitySale(
        { ...sale("2024-01-01", "2024-03-01"), proceeds: null },
        rules,
      ),
    ).toEqual({ status: "unknown", reason: "missing_proceeds" });
  });

  it("long-term pre-2018 lots need grandfathering and are unknown", () => {
    expect(classifyEquitySale(sale("2017-05-01", "2025-05-01"), rules)).toEqual(
      { status: "unknown", reason: "grandfathering" },
    );
  });

  it("one unknown sale withholds every total but keeps subtotals", () => {
    const s = summarizeEquityGains(
      [
        sale("2025-01-01", "2025-03-01"),
        { ...sale("2025-01-01", "2025-03-01"), cost: null },
      ],
      rules,
    );
    expect(s.stcg).toBeNull();
    expect(s.estimatedTax).toBeNull();
    expect(s.knownStcgSubtotal).toBe(50);
    expect(s.unknownCount).toBe(1);
  });
});

describe("summary", () => {
  it("applies the 1.25L LTCG exemption and the rates", () => {
    const s = summarizeEquityGains(
      [
        sale("2025-01-01", "2025-03-01", 100_000, 200_000), // STCG 100000
        sale("2022-01-01", "2025-03-01", 100_000, 325_000), // LTCG 225000
      ],
      rules,
    );
    expect(s.stcg).toBe(100_000);
    expect(s.ltcg).toBe(225_000);
    expect(s.taxableLtcg).toBe(100_000);
    // 20% * 100000 + 12.5% * 100000
    expect(s.estimatedTax).toBe(32_500);
  });

  it("short-term loss sets off against long-term gain", () => {
    const s = summarizeEquityGains(
      [
        sale("2025-01-01", "2025-03-01", 200_000, 150_000), // STCL -50000
        sale("2022-01-01", "2025-03-01", 100_000, 300_000), // LTCG 200000
      ],
      rules,
    );
    expect(s.taxableLtcg).toBe(25_000); // 200000-50000-125000
    expect(s.estimatedTax).toBe(3_125);
  });

  it("empty input is a known zero", () => {
    expect(summarizeEquityGains([], rules).estimatedTax).toBe(0);
  });
});

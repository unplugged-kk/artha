import { runIndiaTax } from "./tax-llm";

describe("runIndiaTax", () => {
  it("compares regimes and echoes evidence", () => {
    const r = runIndiaTax({
      operation: "compare_regimes",
      grossIncome: 1_275_000,
    });
    expect(r).toMatchObject({
      operation: "compare_regimes",
      supported: true,
      evidence: {
        financialYear: "FY2025-26",
        inputs: { grossIncome: 1_275_000 },
      },
    });
  });

  it("requires income for a comparison instead of assuming zero", () => {
    expect(runIndiaTax({ operation: "compare_regimes" })).toEqual({
      error: "grossIncome is required for compare_regimes.",
    });
  });

  it("reports headroom without income", () => {
    const r = runIndiaTax({
      operation: "deduction_headroom",
      section80C: 100_000,
    });
    expect(r).toMatchObject({ section80C: { headroom: 50_000 } });
  });

  it("refuses an unknown financial year", () => {
    const r = runIndiaTax({
      operation: "deduction_headroom",
      financialYear: "FY1990-91",
    });
    expect("error" in r).toBe(true);
  });
});

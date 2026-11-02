import {
  financialYearLabelFor,
  getFinancialYearRules,
} from "./financial-year.config";
import { compareRegimes, deductionHeadroom } from "./tax-calculator";

const rules = getFinancialYearRules("FY2025-26")!;

describe("financial year config", () => {
  it("maps dates to India FY labels across the 1 April boundary", () => {
    expect(financialYearLabelFor("2026-03-31")).toBe("FY2025-26");
    expect(financialYearLabelFor("2026-04-01")).toBe("FY2026-27");
    expect(financialYearLabelFor("2099-12-31")).toBe("FY2099-00");
  });

  it("returns null for an unknown year instead of guessing", () => {
    expect(getFinancialYearRules("FY1999-00")).toBeNull();
  });
});

describe("compareRegimes FY2025-26", () => {
  it("new regime pays nothing at 12.75L gross (rebate up to 12L taxable)", () => {
    const r = compareRegimes({ grossIncome: 1_275_000 }, rules);
    if (!r.supported) throw new Error("expected supported");
    expect(r.new.taxableIncome).toBe(1_200_000);
    expect(r.new.totalTax).toBe(0);
  });

  it("new regime 15L gross (hand-computed slabs)", () => {
    // taxable 14,25,000: 0 + 20,000 + 40,000 + 15%*(14.25L-12L)=33,750 => 93,750
    // cess 3,750 => 97,500
    const r = compareRegimes({ grossIncome: 1_500_000 }, rules);
    if (!r.supported) throw new Error("expected supported");
    expect(r.new.slabTax).toBe(93_750);
    expect(r.new.totalTax).toBe(97_500);
  });

  it("applies marginal relief just above the 12L threshold", () => {
    // taxable 12,10,000: slab tax 60,000+1,500=61,500; relief caps at 10,000
    const r = compareRegimes({ grossIncome: 1_285_000 }, rules);
    if (!r.supported) throw new Error("expected supported");
    expect(r.new.taxableIncome).toBe(1_210_000);
    expect(r.new.slabTax - r.new.rebate).toBe(10_000);
    expect(r.new.totalTax).toBe(10_400);
  });

  it("old regime with full 80C+80CCD1B+80D beats new at 20L gross", () => {
    const r = compareRegimes(
      {
        grossIncome: 2_000_000,
        section80C: 150_000,
        section80CCD1B: 50_000,
        section80D: 25_000,
      },
      rules,
    );
    if (!r.supported) throw new Error("expected supported");
    // old taxable = 20L - 50k - 1.5L - 50k - 25k = 17,25,000
    expect(r.old.taxableIncome).toBe(1_725_000);
    // slab: 12,500 + 1,00,000 + 30%*7,25,000 = 3,30,000 ; cess 13,200
    expect(r.old.slabTax).toBe(330_000);
    expect(r.old.totalTax).toBe(343_200);
    // new taxable 19,25,000: 20k+40k+60k+20%*(19.25L-16L)=65k => 1,85,000; cess 7,400
    expect(r.new.totalTax).toBe(192_400);
    expect(r.better).toBe("new");
    expect(r.saving).toBe(150_800);
  });

  it("caps over-claimed deductions at the statutory limit", () => {
    const capped = compareRegimes(
      { grossIncome: 1_000_000, section80C: 900_000 },
      rules,
    );
    const exact = compareRegimes(
      { grossIncome: 1_000_000, section80C: 150_000 },
      rules,
    );
    expect(capped).toEqual(exact);
  });

  it("old regime rebate zeroes tax at 5L taxable", () => {
    const r = compareRegimes({ grossIncome: 550_000 }, rules);
    if (!r.supported) throw new Error("expected supported");
    expect(r.old.taxableIncome).toBe(500_000);
    expect(r.old.totalTax).toBe(0);
  });

  it("refuses rather than guesses when surcharge would apply", () => {
    const r = compareRegimes({ grossIncome: 9_000_000 }, rules);
    expect(r).toEqual({
      supported: false,
      financialYear: "FY2025-26",
      reason: "surcharge_not_modelled",
    });
  });

  it("zero and negative income owe nothing", () => {
    for (const g of [0, -5]) {
      const r = compareRegimes({ grossIncome: g }, rules);
      if (!r.supported) throw new Error("expected supported");
      expect(r.old.totalTax).toBe(0);
      expect(r.new.totalTax).toBe(0);
      expect(r.better).toBe("equal");
    }
  });
});

describe("deductionHeadroom", () => {
  it("reports remaining 80C room and never goes negative", () => {
    const h = deductionHeadroom(
      { section80C: 200_000, section80CCD1B: 20_000 },
      rules,
    );
    expect(h.section80C).toEqual({ limit: 150_000, used: 200_000, headroom: 0 });
    expect(h.section80CCD1B.headroom).toBe(30_000);
    expect(h.section80D.limit).toBe(25_000);
  });

  it("uses the senior-citizen 80D limit", () => {
    expect(deductionHeadroom({}, rules, true).section80D.limit).toBe(50_000);
  });
});

import {
  epfProjection,
  fixedDepositMaturity,
  npsCorpus,
  ppfMaturity,
  recurringDepositMaturity,
  sgbInterest,
} from "./instrument-calculators";

describe("fixedDepositMaturity", () => {
  it("compounds quarterly: 1L at 7% for 1 year", () => {
    expect(fixedDepositMaturity(100_000, 7, 1)).toEqual({
      maturityAmount: 107_185.9,
      interestEarned: 7_185.9,
      totalInvested: 100_000,
    });
  });

  it("zero rate returns the principal", () => {
    expect(fixedDepositMaturity(50_000, 0, 5).interestEarned).toBe(0);
  });

  it("rejects negative or non-finite input instead of returning nonsense", () => {
    expect(() => fixedDepositMaturity(-1, 7, 1)).toThrow(RangeError);
    expect(() => fixedDepositMaturity(1, NaN, 1)).toThrow(RangeError);
  });
});

describe("recurringDepositMaturity", () => {
  it("1000/month at 6% for 12 months (equals the sum of each deposit compounded quarterly)", () => {
    const r = recurringDepositMaturity(1000, 6, 12);
    expect(r.totalInvested).toBe(12_000);
    expect(r.maturityAmount).toBeGreaterThan(12_000);
    expect(r.maturityAmount).toBeCloseTo(12_395.23, 1);
  });

  it("zero rate or zero months gives no interest", () => {
    expect(recurringDepositMaturity(1000, 0, 12).interestEarned).toBe(0);
    expect(recurringDepositMaturity(1000, 6, 0).maturityAmount).toBe(0);
  });
});

describe("ppfMaturity", () => {
  it("1.5L a year for 15 years at 7.1% is about 40.68 lakh", () => {
    const r = ppfMaturity(150_000, 7.1);
    expect(r.totalInvested).toBe(2_250_000);
    expect(r.maturityAmount).toBeCloseTo(4_068_209.22, 1);
  });
});

describe("epfProjection", () => {
  it("accrues interest and keeps invested separate from interest", () => {
    const r = epfProjection(3000, 3000, 8.25, 1);
    expect(r.totalInvested).toBe(72_000);
    expect(r.interestEarned).toBeGreaterThan(0);
    expect(r.maturityAmount).toBeCloseTo(r.totalInvested + r.interestEarned, 1);
  });

  it("an opening balance counts as invested", () => {
    const r = epfProjection(0, 0, 8, 1, 100_000);
    expect(r.totalInvested).toBe(100_000);
    expect(r.interestEarned).toBeGreaterThan(7_900);
  });
});

describe("npsCorpus", () => {
  it("zero return is plain accumulation", () => {
    expect(npsCorpus(5000, 0, 10).maturityAmount).toBe(600_000);
  });

  it("a positive return beats plain accumulation", () => {
    expect(npsCorpus(5000, 10, 10).maturityAmount).toBeGreaterThan(600_000);
  });
});

describe("sgbInterest", () => {
  it("2.5% on issue price, paid half-yearly", () => {
    expect(sgbInterest(10, 6000, 8)).toEqual({
      perHalfYear: 750,
      total: 12_000,
    });
  });
});

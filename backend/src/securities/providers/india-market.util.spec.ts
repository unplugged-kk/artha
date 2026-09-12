import {
  INDIA_MARKET_TIMEZONE,
  INDIAN_CALENDAR_SOURCE,
  IST_OFFSET_MINUTES,
  NSE_SESSION,
  effectiveIndianValuationDate,
  indianCalendarComplete,
  indianHolidayName,
  indianMarketDay,
  isIndianWeekday,
  istCalendarDate,
  istSessionEpochs,
  nextIndianTradingDay,
  previousIndianTradingDay,
} from "./india-market.util";

describe("istCalendarDate", () => {
  it("reads the Indian calendar day, not the UTC one", () => {
    // 23:00 UTC on the 11th is already the 12th in India.
    expect(istCalendarDate(new Date("2026-08-11T23:00:00Z"))).toBe(
      "2026-08-12",
    );
    // 18:00 UTC on the 11th is 23:30 IST -- still the 11th.
    expect(istCalendarDate(new Date("2026-08-11T18:00:00Z"))).toBe(
      "2026-08-11",
    );
  });

  it("is unaffected by the runner's own timezone", () => {
    // The assertion must hold on a UTC machine and on an IST one alike.
    expect(istCalendarDate(new Date("2026-01-01T00:00:00Z"))).toBe(
      "2026-01-01",
    );
  });
});

describe("istSessionEpochs", () => {
  it("returns 09:15 and 15:30 IST as instants", () => {
    const session = istSessionEpochs("2026-08-11")!;
    // 09:15 IST = 03:45 UTC; 15:30 IST = 10:00 UTC.
    expect(new Date(session.start * 1000).toISOString()).toBe(
      "2026-08-11T03:45:00.000Z",
    );
    expect(new Date(session.end * 1000).toISOString()).toBe(
      "2026-08-11T10:00:00.000Z",
    );
  });

  it("keeps the whole window on the market's own date", () => {
    const session = istSessionEpochs("2026-08-11")!;
    expect(istCalendarDate(new Date(session.start * 1000))).toBe("2026-08-11");
    expect(istCalendarDate(new Date(session.end * 1000))).toBe("2026-08-11");
  });

  it("refuses a date the calendar does not have", () => {
    expect(istSessionEpochs("2026-02-30")).toBeNull();
    expect(istSessionEpochs("2026-13-01")).toBeNull();
    expect(istSessionEpochs("2026-00-10")).toBeNull();
    expect(istSessionEpochs("2026-04-31")).toBeNull();
  });

  it("refuses a malformed date", () => {
    expect(istSessionEpochs("11-08-2026")).toBeNull();
    expect(istSessionEpochs("")).toBeNull();
  });

  it("declares the offset it uses and states the session it applies", () => {
    expect(INDIA_MARKET_TIMEZONE).toBe("Asia/Kolkata");
    expect(IST_OFFSET_MINUTES).toBe(330);
    expect(NSE_SESSION).toEqual({
      openTime: "09:15:00",
      closeTime: "15:30:00",
    });
  });
});

describe("isIndianWeekday", () => {
  it("is open Monday to Friday", () => {
    // 2026-08-10 is a Monday, 2026-08-14 a Friday.
    expect(isIndianWeekday("2026-08-10")).toBe(true);
    expect(isIndianWeekday("2026-08-14")).toBe(true);
  });

  it("is closed at the weekend", () => {
    // 2026-08-15 is a Saturday, 2026-08-16 a Sunday.
    expect(isIndianWeekday("2026-08-15")).toBe(false);
    expect(isIndianWeekday("2026-08-16")).toBe(false);
  });

  it("does not claim to know about holidays yet", () => {
    // 2026-01-26 (Republic Day) is a holiday but a Monday: this function
    // answers the weekday question only, and the holiday table is Phase G.
    expect(isIndianWeekday("2026-01-26")).toBe(true);
  });

  it("refuses a malformed date", () => {
    expect(isIndianWeekday("nope")).toBe(false);
  });
});

describe("indianMarketDay", () => {
  it("closes at the weekend", () => {
    // 2026-08-15 is a Saturday, 2026-08-16 a Sunday.
    expect(indianMarketDay("2026-08-15")).toEqual({
      kind: "weekend",
      tradingDay: false,
    });
    expect(indianMarketDay("2026-08-16")).toEqual({
      kind: "weekend",
      tradingDay: false,
    });
  });

  it("closes on a statutory national holiday", () => {
    // 2026-01-26 is a Monday.
    expect(indianMarketDay("2026-01-26")).toEqual({
      kind: "holiday",
      tradingDay: false,
      name: "Republic Day",
    });
    expect(indianMarketDay("2026-08-15")).toEqual({
      kind: "weekend",
      tradingDay: false,
    });
    expect(indianHolidayName("2026-10-02")).toBe("Gandhi Jayanti");
  });

  it("treats an ordinary weekday as trading, and says the calendar is incomplete", () => {
    // "No known closure" is not "the exchange traded": the variable-date list
    // is not curated, and the verdict carries that rather than hiding it.
    const day = indianMarketDay("2026-08-11");
    expect(day).toEqual({
      kind: "trading",
      tradingDay: true,
      calendarComplete: false,
    });
    expect(indianCalendarComplete(2026)).toBe(false);
    expect(INDIAN_CALENDAR_SOURCE).toContain("NSE/BSE");
  });

  it("refuses a date that is not a calendar day", () => {
    expect(indianMarketDay("2026-02-30")).toBeNull();
    expect(indianMarketDay("11-08-2026")).toBeNull();
    expect(indianMarketDay("")).toBeNull();
  });

  it("does not claim a holiday it was not given", () => {
    // A lunar-date festival is not encoded, so it must not be asserted either
    // way -- the mechanism reports it as an ordinary weekday.
    expect(indianHolidayName("2026-11-08")).toBeNull();
  });
});

describe("nextIndianTradingDay / previousIndianTradingDay", () => {
  it("skips the weekend", () => {
    // Friday -> Monday.
    expect(nextIndianTradingDay("2026-08-14")).toBe("2026-08-17");
    expect(previousIndianTradingDay("2026-08-17")).toBe("2026-08-14");
  });

  it("skips a statutory holiday", () => {
    // Monday Republic Day -> Tuesday.
    expect(nextIndianTradingDay("2026-01-26")).toBe("2026-01-27");
    expect(previousIndianTradingDay("2026-01-26", { inclusive: true })).toBe(
      "2026-01-23",
    );
  });

  it("honours the inclusive option", () => {
    expect(nextIndianTradingDay("2026-08-14", { inclusive: true })).toBe(
      "2026-08-14",
    );
    expect(previousIndianTradingDay("2026-08-17", { inclusive: true })).toBe(
      "2026-08-17",
    );
  });

  it("crosses a year boundary", () => {
    const next = nextIndianTradingDay("2026-12-31");
    expect(next).not.toBeNull();
    expect(next!.startsWith("2027-")).toBe(true);
    expect(indianMarketDay(next!)?.tradingDay).toBe(true);
  });

  it("refuses a malformed date rather than guessing", () => {
    expect(nextIndianTradingDay("nope")).toBeNull();
    expect(previousIndianTradingDay("2026-02-30")).toBeNull();
  });
});

describe("effectiveIndianValuationDate", () => {
  it("strikes a weekend valuation on the last day the market traded", () => {
    // Saturday -> the Friday before it.
    expect(effectiveIndianValuationDate(new Date("2026-08-15T06:00:00Z"))).toBe(
      "2026-08-14",
    );
  });

  it("strikes a holiday valuation on the previous trading day", () => {
    expect(effectiveIndianValuationDate(new Date("2026-01-26T06:00:00Z"))).toBe(
      "2026-01-23",
    );
  });

  it("keeps an ordinary trading day", () => {
    expect(effectiveIndianValuationDate(new Date("2026-08-11T06:00:00Z"))).toBe(
      "2026-08-11",
    );
  });

  it("uses the Indian calendar day, not the UTC one", () => {
    // 23:00 UTC on the 11th is already the 12th in India.
    expect(effectiveIndianValuationDate(new Date("2026-08-11T23:00:00Z"))).toBe(
      "2026-08-12",
    );
  });

  it("returns null for an unusable instant instead of inventing a date", () => {
    expect(effectiveIndianValuationDate(new Date("garbage"))).toBeNull();
  });
});

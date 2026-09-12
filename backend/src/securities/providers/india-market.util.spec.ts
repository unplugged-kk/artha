import {
  INDIA_MARKET_TIMEZONE,
  IST_OFFSET_MINUTES,
  NSE_SESSION,
  isIndianWeekday,
  istCalendarDate,
  istSessionEpochs,
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

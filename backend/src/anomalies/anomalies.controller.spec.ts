import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { AnomaliesController } from "./anomalies.controller";
import { AnomaliesQueryDto } from "./dto/anomalies-query.dto";
import { monthStart } from "./anomaly-detection.service";

describe("AnomaliesController", () => {
  it("uses the authenticated user id, never a request value", async () => {
    const detect = jest.fn().mockResolvedValue({ spendingSpikes: [] });
    const controller = new AnomaliesController({ detect } as any);
    await controller.detect({ user: { id: "u1" } }, { asOf: "2026-06-20" });
    expect(detect).toHaveBeenCalledWith("u1", "2026-06-20");
  });

  it("defaults asOf to today's date", async () => {
    const detect = jest.fn().mockResolvedValue({});
    await new AnomaliesController({ detect } as any).detect(
      { user: { id: "u1" } },
      {},
    );
    expect(detect.mock.calls[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("AnomaliesQueryDto", () => {
  const check = async (asOf: unknown) =>
    (await validate(plainToInstance(AnomaliesQueryDto, { asOf }))).length;

  it("accepts a real date and omission, rejects junk", async () => {
    expect(await check("2026-06-20")).toBe(0);
    expect(await check(undefined)).toBe(0);
    expect(await check("2026-13-01")).toBeGreaterThan(0);
    expect(await check("June 20")).toBeGreaterThan(0);
    expect(await check("2026-06-20'; DROP")).toBeGreaterThan(0);
  });
});

describe("monthStart", () => {
  it.each([
    ["2026-06-20", 0, "2026-06-01"],
    ["2026-06-20", -3, "2026-03-01"],
    ["2026-01-15", -1, "2025-12-01"],
    ["2026-01-15", -13, "2024-12-01"],
    ["2026-12-31", 1, "2027-01-01"],
  ])("%s %i -> %s", (iso, off, want) =>
    expect(monthStart(iso, off)).toBe(want),
  );
});

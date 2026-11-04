import { CoachController } from "./coach.controller";

describe("CoachController", () => {
  const user = { user: { id: "u1" } };

  it("uses the authenticated user for both endpoints", async () => {
    const weeklyMetrics = jest.fn().mockResolvedValue({});
    const weeklyReport = jest.fn().mockResolvedValue({});
    const c = new CoachController({ weeklyMetrics, weeklyReport } as any);
    await c.metrics(user, { asOf: "2026-06-20" });
    await c.report(user, { asOf: "2026-06-20" });
    expect(weeklyMetrics).toHaveBeenCalledWith("u1", "2026-06-20");
    expect(weeklyReport).toHaveBeenCalledWith("u1", "2026-06-20");
  });

  it("defaults the window end to today", async () => {
    const weeklyMetrics = jest.fn().mockResolvedValue({});
    await new CoachController({ weeklyMetrics } as any).metrics(user, {});
    expect(weeklyMetrics.mock.calls[0][1]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

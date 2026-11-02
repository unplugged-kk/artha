import { McpPlanSimulateTools } from "./plan-simulate.tool";

describe("McpPlanSimulateTools", () => {
  function handler() {
    let h: (args: any) => Promise<any>;
    new McpPlanSimulateTools().register({
      registerTool: (_n: string, _c: unknown, fn: any) => {
        h = fn;
      },
    } as any);
    return h!;
  }

  it("returns the simulation as structured content", async () => {
    const res = await handler()({
      operation: "debt_payoff",
      debts: [{ name: "x", balance: 1000, aprPct: 0, minPayment: 300 }],
    });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.snowball).toMatchObject({
      status: "paid_off",
      months: 4,
    });
  });

  it("surfaces missing input as a tool error", async () => {
    expect((await handler()({ operation: "fire" })).isError).toBe(true);
  });
});

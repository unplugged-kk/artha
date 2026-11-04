import { McpIndiaTaxTools } from "./india-tax.tool";

describe("McpIndiaTaxTools", () => {
  function handler() {
    let h: (args: any) => Promise<any>;
    new McpIndiaTaxTools().register({
      registerTool: (_n: string, _c: unknown, fn: any) => {
        h = fn;
      },
    } as any);
    return h!;
  }

  it("returns the deterministic comparison as structured content", async () => {
    const res = await handler()({
      operation: "compare_regimes",
      grossIncome: 1_275_000,
    });
    expect(res.isError).toBeFalsy();
    expect(res.structuredContent.new.totalTax).toBe(0);
    expect(res.structuredContent.evidence.financialYear).toBe("FY2025-26");
  });

  it("surfaces a missing input as a tool error", async () => {
    const res = await handler()({ operation: "compare_regimes" });
    expect(res.isError).toBe(true);
  });
});

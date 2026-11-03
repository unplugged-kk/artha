import { resolveTrustProxyHops } from "./trust-proxy.util";

describe("resolveTrustProxyHops", () => {
  it("defaults to one hop, the behaviour before this was configurable", () => {
    expect(resolveTrustProxyHops(undefined)).toBe(1);
    expect(resolveTrustProxyHops("")).toBe(1);
    expect(resolveTrustProxyHops("  ")).toBe(1);
  });

  it("accepts 0 (no proxy) through 10", () => {
    expect(resolveTrustProxyHops("0")).toBe(0);
    expect(resolveTrustProxyHops("2")).toBe(2);
    expect(resolveTrustProxyHops(" 10 ")).toBe(10);
  });

  it.each(["true", "false", "-1", "1.5", "11", "two", "1e1", "0x2"])(
    "refuses %s rather than guessing",
    (bad) => {
      expect(() => resolveTrustProxyHops(bad)).toThrow(/TRUST_PROXY_HOPS/);
    },
  );
});

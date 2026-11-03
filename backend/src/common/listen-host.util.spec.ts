import { resolveListenHost } from "./listen-host.util";

describe("resolveListenHost", () => {
  it("is undefined when unset or blank, so the default binding is unchanged", () => {
    expect(resolveListenHost(undefined)).toBeUndefined();
    expect(resolveListenHost("")).toBeUndefined();
    expect(resolveListenHost("   ")).toBeUndefined();
  });

  it.each([
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "localhost",
    "my-host_1.internal",
  ])("accepts %s", (ok) => expect(resolveListenHost(ok)).toBe(ok));

  it("trims surrounding space", () => {
    expect(resolveListenHost(" 127.0.0.1 ")).toBe("127.0.0.1");
  });

  it.each([
    "127.0.0.1; rm -rf /",
    "a b",
    "http://x",
    "x/y",
    "a".repeat(254),
    "$(id)",
  ])("refuses %s", (bad) =>
    expect(() => resolveListenHost(bad)).toThrow(/LISTEN_HOST/),
  );
});

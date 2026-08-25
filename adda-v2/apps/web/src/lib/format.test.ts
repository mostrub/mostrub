import { describe, expect, it } from "vitest";
import { formatCount, formatPercent, formatRate, verdictLabel } from "./format.ts";

describe("de-CH formatters", () => {
  it("uses apostrophe thousands and comma decimals", () => {
    expect(formatCount(1247)).toBe("1’247");
    expect(formatPercent(0.027)).toBe("2,7 %");
    expect(formatRate(4.5)).toBe("4,5");
  });

  it("maps verdicts without inventing a pass", () => {
    expect(verdictLabel("nio")).toBe("NIO");
    expect(verdictLabel("unknown")).toBe("OFFEN");
  });
});

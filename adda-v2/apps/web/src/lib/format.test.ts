import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatPercent,
  formatRate,
  nearestTimelineMark,
  timelineOffset,
  verdictLabel,
} from "./format.ts";

describe("de-CH formatters", () => {
  it("uses apostrophe thousands and comma decimals", () => {
    expect(formatCount(1247)).toBe("1’247");
    expect(formatPercent(0.027)).toBe("2,7 %");
    expect(formatRate(4.5)).toBe("4,5");
  });

  it("places events on a continuous axis, not clock buckets", () => {
    const from = "2026-08-25T13:07:00.000Z";
    const to = "2026-08-25T13:17:00.000Z";
    expect(timelineOffset("2026-08-25T13:07:00.000Z", from, to)).toBe(0);
    expect(timelineOffset("2026-08-25T13:17:00.000Z", from, to)).toBe(1);
    expect(timelineOffset("2026-08-25T13:10:00.000Z", from, to)).toBeCloseTo(0.3, 5);
  });

  it("picks the nearest real event, not a clock bucket", () => {
    const marks = [
      { dmc: "A", x: 0.1 },
      { dmc: "B", x: 0.12 },
      { dmc: "C", x: 0.8 },
    ];
    expect(nearestTimelineMark(marks, 0.101)?.dmc).toBe("A");
    expect(nearestTimelineMark(marks, 0.119)?.dmc).toBe("B");
    expect(nearestTimelineMark(marks, 0.9)?.dmc).toBe("C");
    expect(nearestTimelineMark([], 0.5)).toBeNull();
  });

  it("maps verdicts without inventing a pass", () => {
    expect(verdictLabel("nio")).toBe("NIO");
    expect(verdictLabel("unknown")).toBe("OFFEN");
  });
});

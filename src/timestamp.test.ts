import { describe, it, expect } from "vitest";
import {
  defaultTimestamp,
  timestampText,
  timestampRange,
  timestampVisible,
  timestampMetrics,
  timestampFontURL,
  timestampFilter,
} from "./timestamp";
describe("edited timeline timestamp", () => {
  it("formats edited elapsed hours, minutes, seconds", () => {
    expect(timestampText(0)).toBe("00:00:00");
    expect(timestampText(65.9)).toBe("00:01:05");
    expect(timestampText(3661)).toBe("01:01:01");
  });
  it("tracks the full timeline by default as its duration changes", () => {
    expect(timestampRange(defaultTimestamp, 20)).toEqual({ start: 0, end: 20 });
    expect(timestampRange(defaultTimestamp, 5)).toEqual({ start: 0, end: 5 });
  });
  it("uses edited-time custom ranges with an exclusive end", () => {
    const stamp = {
      ...defaultTimestamp,
      enabled: true,
      entire: false,
      start: 2,
      end: 5,
    };
    expect(timestampVisible(stamp, 1, 10)).toBe(false);
    expect(timestampVisible(stamp, 2, 10)).toBe(true);
    expect(timestampVisible(stamp, 5, 10)).toBe(false);
    expect(timestampRange(stamp, 3)).toEqual({ start: 2, end: 3 });
  });
  it("selects real font faces and bounds numeric size", () => {
    expect(
      timestampFontURL({ ...defaultTimestamp, fontFamily: "sans", bold: true }),
    ).toBe("fonts/Roboto-Bold.ttf");
    expect(timestampFontURL({ ...defaultTimestamp, fontFamily: "serif" })).toBe(
      "fonts/NotoSerif-Regular.ttf",
    );
    expect(
      timestampMetrics({ ...defaultTimestamp, fontSize: 999 }, 720).fontSize,
    ).toBe(144);
  });
  it("uses custom range and styling in drawtext", () => {
    const filter = timestampFilter(
      {
        ...defaultTimestamp,
        entire: false,
        start: 2,
        end: 5,
        fontSize: 48,
        background: false,
      },
      10,
      720,
    );
    expect(filter).toContain("fontsize=48");
    expect(filter).toContain("box=0");
    expect(filter).toContain("gte(t,2)*lt(t,5)");
  });
});

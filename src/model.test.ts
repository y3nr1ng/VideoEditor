import { describe, it, expect } from "vitest";
import {
  type Clip,
  segments,
  duration,
  sourceAt,
  outputAt,
  zoomAt,
  validateRange,
} from "./model";
const clip: Clip = {
  id: "clip",
  resourceId: "resource",
  in: 2,
  out: 12,
  crop: { x: 0, y: 0, w: 100, h: 100 },
  speeds: [
    { id: "fast", start: 4, end: 8, rate: 2 },
    { id: "slow", start: 10, end: 12, rate: 0.5 },
  ],
  zooms: [{ id: "zoom", start: 4, end: 8, from: 1, to: 2, x: 70, y: 30 }],
};
describe("edited timeline mapping", () => {
  it("splits into source segments and calculates edited duration", () => {
    expect(segments(clip)).toEqual([
      { start: 2, end: 4, rate: 1 },
      { start: 4, end: 8, rate: 2 },
      { start: 8, end: 10, rate: 1 },
      { start: 10, end: 12, rate: 0.5 },
    ]);
    expect(duration(clip)).toBe(10);
  });
  it("maps source and output timestamps through faster and slower ranges", () => {
    expect(sourceAt(clip, 3)).toEqual({ time: 6, rate: 2 });
    expect(sourceAt(clip, 8)).toEqual({ time: 11, rate: 0.5 });
    expect(outputAt(clip, 6)).toBe(3);
    expect(outputAt(clip, 11)).toBe(8);
    expect(sourceAt(clip, 100).time).toBe(12);
  });
  it("keeps mapping reversible across range boundaries", () => {
    for (let t = 2; t < 12; t += 0.17)
      expect(sourceAt(clip, outputAt(clip, t)).time).toBeCloseTo(t, 8);
  });
  it("interpolates zoom in source time and resets outside its range", () => {
    expect(zoomAt(clip, 6)).toEqual({ scale: 1.5, x: 70, y: 30 });
    expect(zoomAt(clip, 9).scale).toBe(1);
  });
  it("rejects invalid and out-of-trim ranges", () => {
    expect(validateRange(1, 5, clip)).toBe(false);
    expect(validateRange(3, 13, clip)).toBe(false);
    expect(validateRange(4, 4, clip)).toBe(false);
    expect(validateRange(NaN, 8, clip)).toBe(false);
    expect(validateRange(4, 8, clip)).toBe(true);
  });
});

import {
  keptRanges,
  withRanges,
  trimKeptRange,
  excludeSourceRange,
} from "./model";
describe("multiple retained source ranges", () => {
  const base: Clip = {
    id: "multi",
    resourceId: "r",
    in: 0,
    out: 10,
    crop: { x: 0, y: 0, w: 100, h: 100 },
    speeds: [],
    zooms: [],
  };
  it("excludes a middle interval and skips it in playback mapping", () => {
    const c = excludeSourceRange(base, 3, 7);
    expect(keptRanges(c).map((r) => [r.start, r.end])).toEqual([
      [0, 3],
      [7, 10],
    ]);
    expect(duration(c)).toBe(6);
    expect(sourceAt(c, 3).time).toBe(7);
    expect(sourceAt(c, 4).time).toBe(8);
    expect(outputAt(c, 8)).toBe(4);
  });
  it("retimes each retained interval without reintroducing removed time", () => {
    const c = withRanges(
      { ...base, speeds: [{ id: "s", start: 7, end: 9, rate: 2 }] },
      [
        { id: "a", start: 1, end: 3 },
        { id: "b", start: 7, end: 9 },
      ],
    );
    expect(duration(c)).toBe(3);
    expect(sourceAt(c, 2.5).time).toBe(8);
    expect(validateRange(2, 8, c)).toBe(false);
    expect(validateRange(7, 8, c)).toBe(true);
  });
  it("allows restoring trimmed source while preventing range overlap", () => {
    const c = withRanges(base, [
      { id: "a", start: 2, end: 3 },
      { id: "b", start: 7, end: 9 },
    ]);
    const expanded = trimKeptRange(c, "a", "start", 0, 10);
    expect(keptRanges(expanded)[0].start).toBe(0);
    expect(keptRanges(trimKeptRange(c, "a", "end", 8, 10))[0].end).toBe(7);
  });
  it("keeps at least one retained range and removes effects cut out of source", () => {
    expect(excludeSourceRange(base, 0, 10)).toEqual(base);
    const c = excludeSourceRange(
      { ...base, speeds: [{ id: "s", start: 4, end: 6, rate: 2 }] },
      3,
      7,
    );
    expect(c.speeds).toHaveLength(0);
  });
});

import { segmentJump } from "./model";
describe("segment navigation", () => {
  const c: Clip = {
    id: "a",
    resourceId: "r",
    in: 0,
    out: 5,
    crop: { x: 0, y: 0, w: 100, h: 100 },
    speeds: [],
    zooms: [],
  };
  const clips = [
    c,
    { ...c, id: "b", speeds: [{ id: "s", start: 0, end: 5, rate: 2 }] },
    { ...c, id: "c" },
  ];
  it("jumps to previous and next clip starts in edited time", () => {
    expect(segmentJump(clips, 6, "previous")).toBe(0);
    expect(segmentJump(clips, 6, "next")).toBe(7.5);
    expect(segmentJump(clips, 8, "previous")).toBe(5);
  });
  it("handles exact boundaries and timeline endpoints", () => {
    expect(segmentJump(clips, 5, "previous")).toBe(0);
    expect(segmentJump(clips, 0, "previous")).toBe(0);
    expect(segmentJump(clips, 8, "next")).toBe(12.5);
    expect(segmentJump(clips, 12.5, "previous")).toBe(7.5);
    expect(segmentJump([], 0, "next")).toBe(0);
  });
});

export type Crop = { x: number; y: number; w: number; h: number };
export type Resource = {
  id: string;
  file: File;
  url: string;
  name: string;
  duration: number;
  width: number;
  height: number;
  kind: "video" | "audio";
  thumb?: string;
  wave: number[];
  crop: Crop;
};
export type Speed = { id: string; start: number; end: number; rate: number };
export type Zoom = {
  id: string;
  start: number;
  end: number;
  from: number;
  to: number;
  x: number;
  y: number;
};
export type KeepRange = { id: string; start: number; end: number };
export type Clip = {
  id: string;
  resourceId: string;
  in: number;
  out: number;
  crop: Crop;
  ranges?: KeepRange[];
  speeds: Speed[];
  zooms: Zoom[];
};
export const uid = () => crypto.randomUUID();
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
export const time = (v: number) =>
  `${Math.floor(v / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(v % 60)
    .toString()
    .padStart(2, "0")}.${Math.floor((v % 1) * 10)}`;
export const keptRanges = (c: Clip): KeepRange[] =>
  c.ranges ?? [{ id: c.id, start: c.in, end: c.out }];
export function withRanges(c: Clip, ranges: KeepRange[]): Clip {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  if (!sorted.length) return c;
  return {
    ...c,
    ranges: sorted,
    in: sorted[0].start,
    out: sorted[sorted.length - 1].end,
    speeds: c.speeds.filter((s) =>
      sorted.some((r) => s.start >= r.start && s.end <= r.end),
    ),
    zooms: c.zooms.filter((s) =>
      sorted.some((r) => s.start >= r.start && s.end <= r.end),
    ),
  };
}
export function trimKeptRange(
  c: Clip,
  id: string,
  edge: "start" | "end",
  value: number,
  sourceDuration: number,
): Clip {
  const ranges = keptRanges(c),
    index = ranges.findIndex((r) => r.id === id);
  if (index < 0 || !Number.isFinite(value)) return c;
  const r = ranges[index];
  const next = {
    ...r,
    [edge]: clamp(
      value,
      edge === "start" ? (ranges[index - 1]?.end ?? 0) : r.start + 0.1,
      edge === "end"
        ? (ranges[index + 1]?.start ?? sourceDuration)
        : r.end - 0.1,
    ),
  };
  return withRanges(
    c,
    ranges.map((item) => (item.id === id ? next : item)),
  );
}
export function excludeSourceRange(c: Clip, start: number, end: number): Clip {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 0.1)
    return c;
  const ranges = keptRanges(c).flatMap((r) => {
    if (end <= r.start || start >= r.end) return [r];
    const pieces: KeepRange[] = [];
    if (start - r.start >= 0.1) pieces.push({ ...r, end: start });
    if (r.end - end >= 0.1)
      pieces.push({ id: pieces.length ? uid() : r.id, start: end, end: r.end });
    return pieces;
  });
  return withRanges(c, ranges);
}
export function segments(c: Clip) {
  return keptRanges(c).flatMap((r) => {
    const cuts = [
      r.start,
      r.end,
      ...c.speeds.flatMap((s) => [
        clamp(s.start, r.start, r.end),
        clamp(s.end, r.start, r.end),
      ]),
    ]
      .sort((a, b) => a - b)
      .filter((v, i, a) => !i || v !== a[i - 1]);
    return cuts.slice(0, -1).map((start, i) => ({
      start,
      end: cuts[i + 1],
      rate: c.speeds.find((s) => start >= s.start && start < s.end)?.rate ?? 1,
    }));
  });
}
export const duration = (c: Clip) =>
  segments(c).reduce((n, s) => n + (s.end - s.start) / s.rate, 0);
export function sourceAt(c: Clip, t: number) {
  for (const s of segments(c)) {
    const d = (s.end - s.start) / s.rate;
    if (t < d) return { time: s.start + t * s.rate, rate: s.rate };
    t -= d;
  }
  return { time: c.out, rate: 1 };
}
export function outputAt(c: Clip, t: number) {
  return segments(c).reduce(
    (n, s) => n + clamp(t - s.start, 0, s.end - s.start) / s.rate,
    0,
  );
}
export function zoomAt(c: Clip, t: number) {
  const z = c.zooms.find((z) => t >= z.start && t <= z.end);
  return z
    ? {
        scale: z.from + ((z.to - z.from) * (t - z.start)) / (z.end - z.start),
        x: z.x,
        y: z.y,
      }
    : { scale: 1, x: 50, y: 50 };
}
export function validateRange(start: number, end: number, c: Clip) {
  return (
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    keptRanges(c).some((r) => start >= r.start && end <= r.end) &&
    end - start >= 0.05
  );
}
export function segmentJump(
  clips: Clip[],
  position: number,
  direction: "previous" | "next",
) {
  let total = 0;
  const starts = clips.map((c) => {
    const start = total;
    total += duration(c);
    return start;
  });
  if (!starts.length) return 0;
  const current =
    position >= total
      ? starts.length
      : Math.max(
          0,
          starts.reduce(
            (index, start, i) => (start <= position ? i : index),
            0,
          ),
        );
  return direction === "previous"
    ? (starts[Math.max(0, current - 1)] ?? 0)
    : (starts[current + 1] ?? total);
}

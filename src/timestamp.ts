export type TimestampOverlay = {
  enabled: boolean;
  entire: boolean;
  start: number;
  end: number;
  placement:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "bottom-center";
  fontSize: number;
  fontFamily: "sans" | "mono" | "serif";
  bold: boolean;
  background: boolean;
};
export const defaultTimestamp: TimestampOverlay = {
  enabled: false,
  entire: true,
  start: 0,
  end: 0,
  placement: "bottom-right",
  fontSize: 36,
  fontFamily: "mono",
  bold: false,
  background: true,
};
export const timestampFonts = {
  sans: {
    label: "Roboto (sans serif)",
    family: "Timestamp Sans",
    file: "Roboto",
  },
  mono: {
    label: "Roboto Mono (monospace)",
    family: "Timestamp Mono",
    file: "RobotoMono",
  },
  serif: {
    label: "Noto Serif (serif)",
    family: "Timestamp Serif",
    file: "NotoSerif",
  },
};
export function timestampFontURL(config: TimestampOverlay) {
  return `fonts/${timestampFonts[config.fontFamily].file}-${config.bold ? "Bold" : "Regular"}.ttf`;
}
export function timestampText(seconds: number) {
  const t = Math.max(0, Math.floor(seconds));
  return [Math.floor(t / 3600), Math.floor(t / 60) % 60, t % 60]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");
}
export function timestampRange(config: TimestampOverlay, total: number) {
  return config.entire
    ? { start: 0, end: total }
    : {
        start: Math.max(0, Math.min(config.start, total)),
        end: Math.max(0, Math.min(config.end, total)),
      };
}
export function timestampVisible(
  config: TimestampOverlay,
  t: number,
  total: number,
) {
  const r = timestampRange(config, total);
  return config.enabled && r.end > r.start && t >= r.start && t < r.end;
}
export function timestampMetrics(config: TimestampOverlay, height: number) {
  const fontSize = Math.max(8, Math.min(144, Math.round(config.fontSize)));
  return {
    fontSize,
    margin: Math.max(4, Math.round(height * 0.025)),
    boxPad: Math.round(fontSize * 0.3),
  };
}
export function timestampFilter(
  config: TimestampOverlay,
  total: number,
  height: number,
) {
  const range = timestampRange(config, total),
    { fontSize, margin, boxPad } = timestampMetrics(config, height),
    gap = margin + boxPad;
  const x = config.placement.endsWith("right")
    ? `w-tw-${gap}`
    : config.placement.endsWith("center")
      ? "(w-tw)/2"
      : `${gap}`;
  const y = config.placement.startsWith("top") ? `${gap}` : `h-th-${gap}`;
  return `drawtext=fontfile=timestamp-font.ttf:textfile=timestamp-text.txt:fontsize=${fontSize}:fontcolor=white:x=${x}:y=${y}:box=${config.background ? 1 : 0}:boxcolor=black@0.6:boxborderw=${boxPad}:enable='gte(t,${range.start})*lt(t,${range.end})'`;
}
export const timestampExpression =
  "%{eif:floor(t/3600):d:2}:%{eif:mod(floor(t/60),60):d:2}:%{eif:mod(floor(t),60):d:2}";
export function drawTimestamp(
  ctx: CanvasRenderingContext2D,
  config: TimestampOverlay,
  t: number,
  total: number,
) {
  if (!timestampVisible(config, t, total)) return;
  const { width, height } = ctx.canvas,
    { fontSize, margin, boxPad } = timestampMetrics(config, height);
  ctx.save();
  ctx.font = `${config.bold ? 700 : 400} ${fontSize}px "${timestampFonts[config.fontFamily].family}", ${config.fontFamily === "mono" ? "monospace" : config.fontFamily === "serif" ? "serif" : "sans-serif"}`;
  ctx.textBaseline = "top";
  const text = timestampText(t),
    metrics = ctx.measureText(text),
    w = metrics.width,
    h = fontSize;
  const x = config.placement.endsWith("right")
    ? width - margin - boxPad - w
    : config.placement.endsWith("center")
      ? (width - w) / 2
      : margin + boxPad;
  const y = config.placement.startsWith("top")
    ? margin + boxPad
    : height - margin - boxPad - h;
  if (config.background) {
    ctx.fillStyle = "rgba(0,0,0,.6)";
    ctx.fillRect(x - boxPad, y - boxPad, w + boxPad * 2, h + boxPad * 2);
  }
  ctx.fillStyle = "#fff";
  ctx.fillText(text, x, y);
  ctx.restore();
}

import { marked, type Token } from "marked";
import { timestampFonts } from "./timestamp";
import { uid } from "./model";
export type Annotation = {
  id: string;
  kind: "ellipse" | "rectangle" | "text";
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fill: boolean;
  stroke: number;
  text: string;
  fontSize: number;
  fontFamily: "sans" | "mono" | "serif";
  bold: boolean;
  italic: boolean;
  background: boolean;
};
export type RasterOverlay = { blob: Blob; start: number; end: number };
export const newAnnotation = (
  total: number,
  kind: Annotation["kind"] = "ellipse",
): Annotation => ({
  id: uid(),
  kind,
  start: 0,
  end: total,
  x: 25,
  y: 25,
  w: 30,
  h: 30,
  color: "#ffcc66",
  fill: false,
  stroke: 3,
  text: "**Annotation**",
  fontSize: 36,
  fontFamily: "sans",
  bold: false,
  italic: false,
  background: false,
});
export function annotationBox(
  x: number,
  y: number,
  endX: number,
  endY: number,
  square: boolean,
  aspect = 16 / 9,
) {
  let dx = endX - x,
    dy = endY - y;
  if (square) {
    const side = Math.min(Math.abs(dx), Math.abs(dy) / aspect);
    dx = Math.sign(dx || 1) * side;
    dy = Math.sign(dy || 1) * side * aspect;
  }
  return {
    x: Math.min(x, x + dx),
    y: Math.min(y, y + dy),
    w: Math.abs(dx),
    h: Math.abs(dy),
  };
}
export type TextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  code: boolean;
  scale: number;
};
export function markdownRuns(text: string): TextRun[][] {
  const lines: TextRun[][] = [];
  function inline(
    tokens: Token[] | undefined,
    base: Omit<TextRun, "text">,
  ): TextRun[] {
    return (tokens ?? []).flatMap((t) => {
      if (t.type === "strong")
        return inline(t.tokens ?? [], { ...base, bold: true });
      if (t.type === "em")
        return inline(t.tokens ?? [], { ...base, italic: true });
      if (t.type === "codespan") return [{ ...base, text: t.text, code: true }];
      if (t.type === "br") return [{ ...base, text: "\n" }];
      if (t.type === "link") return inline(t.tokens ?? [], base);
      if (t.type === "image" || t.type === "html") return [];
      if ("tokens" in t && Array.isArray(t.tokens))
        return inline(t.tokens ?? [], base);
      return [{ ...base, text: "text" in t ? String(t.text) : t.raw }];
    });
  }
  const base = { bold: false, italic: false, code: false, scale: 1 };
  for (const t of marked.lexer(text, { breaks: true })) {
    if (t.type === "heading")
      lines.push(
        inline(t.tokens ?? [], {
          ...base,
          bold: true,
          scale: 1 + (6 - t.depth) * 0.1,
        }),
      );
    else if (t.type === "paragraph") lines.push(inline(t.tokens ?? [], base));
    else if (t.type === "list")
      t.items.forEach((item: { text: string }, i: number) =>
        lines.push([
          { ...base, text: t.ordered ? `${i + Number(t.start)}. ` : "• " },
          ...inline(marked.Lexer.lexInline(item.text), base),
        ]),
      );
    else if (t.type === "code")
      t.text
        .split("\n")
        .forEach((line: string) =>
          lines.push([{ ...base, text: line, code: true }]),
        );
    else if (t.type === "blockquote")
      lines.push(
        inline(marked.Lexer.lexInline(t.text), { ...base, italic: true }),
      );
    else if (t.type === "space") lines.push([]);
  }
  return lines;
}
export function drawAnnotation(ctx: CanvasRenderingContext2D, a: Annotation) {
  const W = ctx.canvas.width,
    H = ctx.canvas.height,
    x = (a.x / 100) * W,
    y = (a.y / 100) * H,
    w = (a.w / 100) * W,
    h = (a.h / 100) * H;
  ctx.save();
  ctx.strokeStyle = a.color;
  ctx.fillStyle = a.color;
  ctx.lineWidth = a.stroke;
  if (a.kind !== "text") {
    ctx.beginPath();
    if (a.kind === "ellipse")
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    else ctx.rect(x, y, w, h);
    if (a.fill) {
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (a.background) {
    ctx.fillStyle = "#0009";
    ctx.fillRect(x, y, w, h);
  }
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = a.color;
  ctx.textBaseline = "top";
  let px = x,
    py = y,
    lineHeight = a.fontSize * 1.4;
  for (const line of markdownRuns(a.text)) {
    for (const run of line) {
      const size = a.fontSize * run.scale;
      lineHeight = Math.max(lineHeight, size * 1.4);
      ctx.font = `${a.italic || run.italic ? "italic " : ""}${a.bold || run.bold ? 700 : 400} ${size}px "${timestampFonts[run.code ? "mono" : a.fontFamily].family}"`;
      for (const word of run.text.split(/(\s+)/)) {
        if (word.includes("\n")) {
          px = x;
          py += lineHeight;
          continue;
        }
        const advance = ctx.measureText(word).width;
        if (px > x && px + advance > x + w) {
          px = x;
          py += lineHeight;
        }
        if (px === x && !word.trim()) continue;
        ctx.fillText(word, px, py);
        px += advance;
      }
    }
    px = x;
    py += lineHeight;
    lineHeight = a.fontSize * 1.4;
  }
  ctx.restore();
}
export async function rasterAnnotations(
  items: Annotation[],
  width: number,
  height: number,
): Promise<RasterOverlay[]> {
  await Promise.all(
    Object.values(timestampFonts).flatMap((f) =>
      [400, 700].flatMap((weight) =>
        ["normal", "italic"].map((style) =>
          document.fonts.load(`${style} ${weight} 36px "${f.family}"`),
        ),
      ),
    ),
  );
  return Promise.all(
    items
      .filter((a) => a.end > a.start)
      .map(async (a) => {
        const c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        drawAnnotation(c.getContext("2d")!, a);
        const blob = await new Promise<Blob>((resolve, reject) =>
          c.toBlob(
            (b) =>
              b ? resolve(b) : reject(new Error("Cannot render annotation")),
            "image/png",
          ),
        );
        return { blob, start: a.start, end: a.end };
      }),
  );
}

import { type Clip, type ZoomKeyframe } from "./model";
export function keyframeView(keys: ZoomKeyframe[], time: number) {
  const sorted = [...keys].sort((a, b) => a.time - b.time);
  if (!sorted.length) return { scale: 1, x: 50, y: 50 };
  const right = sorted.findIndex((k) => k.time > time);
  if (right === 0) return sorted[0];
  if (right < 0) return sorted.at(-1)!;
  const a = sorted[right - 1],
    b = sorted[right],
    f = (time - a.time) / (b.time - a.time);
  return {
    scale: a.scale + (b.scale - a.scale) * f,
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
  };
}
export function viewExpression(c: Clip, t: string, axis: "scale" | "x" | "y") {
  const keys = [...(c.zoomKeys ?? [])].sort((a, b) => a.time - b.time);
  if (!keys.length) return axis === "scale" ? "1" : "50";
  let result = String(keys.at(-1)![axis]);
  for (let i = keys.length - 2; i >= 0; i--) {
    const a = keys[i],
      b = keys[i + 1];
    result = `if(lt(${t},${b.time}),${a[axis]}+(${b[axis] - a[axis]})*max(0,${t}-${a.time})/${b.time - a.time},${result})`;
  }
  return result;
}

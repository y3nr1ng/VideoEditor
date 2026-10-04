import { it, expect } from "vitest";
import { keyframeView, viewExpression } from "./keyframes";
import { type Clip, zoomAt } from "./model";
const keys = [
  { id: "a", time: 1, scale: 1, x: 20, y: 30 },
  { id: "b", time: 3, scale: 3, x: 80, y: 70 },
];
it("linearly interpolates scale and both centers and holds endpoints", () => {
  expect(keyframeView(keys, 2)).toEqual({ scale: 2, x: 50, y: 50 });
  expect(keyframeView(keys, 0).scale).toBe(1);
  expect(keyframeView(keys, 4).scale).toBe(3);
  expect(keyframeView([...keys].reverse(), 2)).toEqual({
    scale: 2,
    x: 50,
    y: 50,
  });
});
it("uses keyframes in preview and produces a matching frame-time export expression", () => {
  const c = { zoomKeys: keys, zooms: [] } as unknown as Clip;
  expect(zoomAt(c, 2).x).toBe(50);
  expect(viewExpression(c, "t", "x")).toBe(
    "if(lt(t,3),20+(60)*max(0,t-1)/2,80)",
  );
});

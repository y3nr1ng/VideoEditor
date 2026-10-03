import { describe, it, expect } from "vitest";
import { cropHandles, resizeCrop } from "./crop";
const crop = { x: 20, y: 20, w: 60, h: 60 };
describe("eight crop handles", () => {
  it.each(cropHandles)("resizes %s while fixing the opposite edges", (handle) => {
    const result = resizeCrop(crop, handle, 10, 10);
    expect(result.x).toBe(handle.includes("w") ? 30 : 20);
    expect(result.y).toBe(handle.includes("n") ? 30 : 20);
    expect(result.x + result.w).toBe(handle.includes("e") ? 90 : 80);
    expect(result.y + result.h).toBe(handle.includes("s") ? 90 : 80);
  });
  it.each(cropHandles)("clamps %s to bounds and minimum size", (handle) => {
    for (const delta of [-1000, 1000]) {
      const result = resizeCrop(crop, handle, delta, delta);
      expect(result.x).toBeGreaterThanOrEqual(0);
      expect(result.y).toBeGreaterThanOrEqual(0);
      expect(result.x + result.w).toBeLessThanOrEqual(100);
      expect(result.y + result.h).toBeLessThanOrEqual(100);
      expect(result.w).toBeGreaterThanOrEqual(5);
      expect(result.h).toBeGreaterThanOrEqual(5);
    }
  });
});

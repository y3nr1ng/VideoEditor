import { clamp, type Crop } from "./model";
export const cropHandles = [
  ["nw", "top left"], ["n", "top"], ["ne", "top right"],
  ["e", "right"], ["se", "bottom right"], ["s", "bottom"],
  ["sw", "bottom left"], ["w", "left"],
] as const;
export type CropHandle = typeof cropHandles[number][0];
export function resizeCrop(crop: Crop, handle: CropHandle, dx: number, dy: number): Crop {
  let left = crop.x, top = crop.y, right = crop.x + crop.w, bottom = crop.y + crop.h;
  if (handle.includes("w")) left = clamp(left + dx, 0, right - 5);
  if (handle.includes("e")) right = clamp(right + dx, left + 5, 100);
  if (handle.includes("n")) top = clamp(top + dy, 0, bottom - 5);
  if (handle.includes("s")) bottom = clamp(bottom + dy, top + 5, 100);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

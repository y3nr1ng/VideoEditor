import { it, expect } from "vitest";
import { audioPeaks } from "./waveform";
it("uses actual peaks from all audio channels in source order", () => {
  expect(
    audioPeaks(
      [
        new Float32Array([0.1, 0.2, 0.1, 0]),
        new Float32Array([0, 0, 0.8, -0.9]),
      ],
      2,
    )[0],
  ).toBeCloseTo(0.2);
  expect(
    audioPeaks(
      [
        new Float32Array([0.1, 0.2, 0.1, 0]),
        new Float32Array([0, 0, 0.8, -0.9]),
      ],
      2,
    )[1],
  ).toBeCloseTo(0.9);
});
it("handles short and empty audio without fabricating values", () => {
  expect(audioPeaks([])).toEqual([]);
  expect(audioPeaks([new Float32Array([0, 0])])).toEqual([0, 0]);
  expect(audioPeaks([new Float32Array([2])])).toEqual([1]);
});

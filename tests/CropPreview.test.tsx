// @vitest-environment jsdom
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { CropPreview } from "../src/CropPreview";
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("seeks and controls the source video with exactly three transport buttons", () => {
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  render(<CropPreview url="blob:local-video" duration={12} width={1280} height={720}><div>Crop frame</div></CropPreview>);
  const video = screen.getByLabelText("Crop preview") as HTMLVideoElement;
  expect(video.getAttribute("src")).toBe("blob:local-video");
  expect(screen.getAllByRole("button")).toHaveLength(3);
  fireEvent.change(screen.getByRole("slider"), { target: { value: "7.5" } });
  expect(video.currentTime).toBe(7.5);
  fireEvent.click(screen.getByLabelText("Crop preview start"));
  expect(video.currentTime).toBe(0);
  fireEvent.click(screen.getByLabelText("Crop preview end"));
  expect(video.currentTime).toBe(12);
  fireEvent.click(screen.getByLabelText("Play crop preview"));
  expect(play).toHaveBeenCalledOnce();
  Object.defineProperty(video, "paused", { value: false, configurable: true });
  fireEvent.play(video);
  fireEvent.click(screen.getByLabelText("Pause crop preview"));
  expect(pause).toHaveBeenCalledTimes(3);
});
it("bounds wheel zoom between the full source and a crop that fits the viewport", () => {
  const { container, rerender } = render(<CropPreview url="blob:source" duration={10} width={1280} height={720} crop={{ x: 25, y: 25, w: 50, h: 50 }}>Frame</CropPreview>);
  const stage = container.querySelector(".crop-stage")!;
  const source = container.querySelector(".crop-source") as HTMLElement;
  fireEvent.wheel(stage, { deltaY: -10000 });
  expect(source.style.transform).toContain("scale(2)");
  fireEvent.wheel(stage, { deltaY: 10000 });
  expect(source.style.transform).toContain("scale(1)");
  fireEvent.wheel(stage, { deltaY: -10000 });
  rerender(<CropPreview url="blob:source" duration={10} width={1280} height={720} crop={{ x: 0, y: 0, w: 100, h: 100 }}>Frame</CropPreview>);
  expect(source.style.transform).toContain("scale(1)");
});

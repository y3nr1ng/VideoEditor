import { describe, it, expect, vi } from "vitest";
import {
  droppedFiles,
  acceptsDrop,
  waitForMedia,
  RESOURCE_DRAG_TYPE,
} from "./drop";
describe("Finder and resource drops", () => {
  it("snapshots Finder files before asynchronous importing", () => {
    const files = [{ name: "clip.mp4" }] as File[];
    const result = droppedFiles({
      files: files as unknown as FileList,
      items: [] as unknown as DataTransferItemList,
    });
    files.length = 0;
    expect(result.map((f) => f.name)).toEqual(["clip.mp4"]);
  });
  it("falls back to file items when a transfer has no file list", () => {
    const file = { name: "clip.mov" } as File;
    const items = [
      { kind: "string", getAsFile: () => null },
      { kind: "file", getAsFile: () => file },
      { kind: "file", getAsFile: () => null },
    ];
    expect(
      droppedFiles({
        files: [] as unknown as FileList,
        items: items as unknown as DataTransferItemList,
      }),
    ).toEqual([file]);
  });
  it("accepts Finder files and internal resources but not URL/image drags", () => {
    expect(acceptsDrop(["Files"])).toBe(true);
    expect(acceptsDrop([RESOURCE_DRAG_TYPE])).toBe(true);
    expect(acceptsDrop(["text/uri-list"])).toBe(false);
  });
  it("installs metadata listeners before starting media load", async () => {
    const media = new EventTarget() as HTMLMediaElement;
    await expect(
      waitForMedia(media, "loadedmetadata", () =>
        media.dispatchEvent(new Event("loadedmetadata")),
      ),
    ).resolves.toBeUndefined();
  });
  it("waits for a decoded frame before thumbnail extraction", async () => {
    const media = new EventTarget() as HTMLMediaElement;
    let settled = false;
    const ready = waitForMedia(media, "loadeddata", () => {
      media.dispatchEvent(new Event("loadedmetadata"));
    }).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    media.dispatchEvent(new Event("loadeddata"));
    await ready;
    expect(settled).toBe(true);
  });
  it("rejects errors and releases its timeout", async () => {
    vi.useFakeTimers();
    const media = new EventTarget() as HTMLMediaElement;
    await expect(
      waitForMedia(media, "loadedmetadata", () =>
        media.dispatchEvent(new Event("error")),
      ),
    ).rejects.toThrow("Unsupported browser codec");
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

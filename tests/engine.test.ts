import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { File } from "node:buffer";
vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    loaded = false;
    core: any;
    listeners = new Map();
    on(event: string, fn: Function) {
      this.listeners.set(event, fn);
    }
    off(event: string) {
      this.listeners.delete(event);
    }
    async load() {
      (globalThis as any).self = {
        location: { href: "file:///ffmpeg-core.js" },
      };
      const require = createRequire(import.meta.url);
      const create = require(
        resolve("node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js"),
      );
      this.core = await create({
        wasmBinary: readFileSync(
          "node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm",
        ),
      });
      this.core.setLogger((data: any) => this.listeners.get("log")?.(data));
      this.loaded = true;
    }
    async writeFile(name: string, data: any) {
      this.core.FS.writeFile(name, data);
    }
    async readFile(name: string, encoding?: string) {
      return this.core.FS.readFile(
        name,
        encoding === "utf8" ? { encoding: "utf8" } : undefined,
      );
    }
    async deleteFile(name: string) {
      this.core.FS.unlink(name);
    }
    async exec(args: string[]) {
      const code = this.core.exec(...args);
      this.core.reset();
      return code;
    }
    async ffprobe(args: string[]) {
      const code = this.core.ffprobe(...args);
      this.core.reset();
      return code;
    }
    terminate() {
      this.loaded = false;
    }
  },
}));
vi.mock("@ffmpeg/util", () => ({
  toBlobURL: async (url: string) => url,
  fetchFile: async (file: File | string) =>
    typeof file === "string"
      ? new Uint8Array(readFileSync(`public${new URL(file).pathname}`))
      : new Uint8Array(await file.arrayBuffer()),
}));
import {
  exportProject,
  cancelExport,
  tempoFilter,
  embeddedAudioWaveform,
} from "../src/engine";
import { defaultTimestamp } from "../src/timestamp";
import { type Clip, type Resource, duration } from "../src/model";
const crop = { x: 10, y: 10, w: 80, h: 80 };
function fixture(name: string, kind: "video" | "audio"): Resource {
  return {
    id: name,
    file: new File(
      [readFileSync(`.local/${name}`)],
      name,
    ) as unknown as globalThis.File,
    name,
    url: "",
    kind,
    duration: 4,
    width: 320,
    height: 180,
    wave: [],
    crop,
  };
}
const clip = (resourceId: string): Clip => ({
  id: resourceId,
  resourceId,
  in: 0.3,
  out: 3.5,
  crop,
  speeds: [{ id: "s", start: 1, end: 2, rate: 2 }],
  zooms: [{ id: "z", start: 0.5, end: 3, from: 1, to: 1.5, x: 70, y: 40 }],
});
const integration =
  process.env.RUN_MEDIA_TESTS === "1" ? describe : describe.skip;
integration("real single-thread FFmpeg WASM export", () => {
  it("renders crop, speed, zoom, concatenation, and audio mix", async () => {
    const resources = [
      fixture("test-video.mp4", "video"),
      fixture("test-audio.wav", "audio"),
    ];
    const c = clip(resources[0].id),
      a = {
        ...clip(resources[1].id),
        speeds: [{ id: "slow", start: 1, end: 2, rate: 0.25 }],
        zooms: [],
      };
    const blob = await exportProject(
      [c, c],
      [a],
      resources,
      "mp4",
      false,
      320,
      () => {},
    );
    mkdirSync(".local", { recursive: true });
    writeFileSync(
      ".local/verified.mp4",
      new Uint8Array(await blob.arrayBuffer()),
    );
    const metadata = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          ".local/verified.mp4",
        ],
        { encoding: "utf8" },
      ),
    );
    expect(metadata.streams.map((s: any) => s.codec_name)).toEqual([
      "h264",
      "aac",
    ]);
    expect(+metadata.format.duration).toBeCloseTo(duration(c) * 2, 0);
    expect(metadata.streams[0].width).toBe(320);
  }, 120000);
  it("renders multiple retained intervals for both video and audio", async () => {
    const resources = [
      fixture("test-video.mp4", "video"),
      fixture("test-audio.wav", "audio"),
    ];
    const c = {
      ...clip(resources[0].id),
      in: 0,
      out: 4,
      speeds: [],
      zooms: [],
      ranges: [
        { id: "a", start: 0, end: 1 },
        { id: "b", start: 3, end: 4 },
      ],
    };
    const a = { ...c, id: "audio-multi", resourceId: resources[1].id };
    const blob = await exportProject(
      [c],
      [a],
      resources,
      "mp4",
      false,
      320,
      () => {},
    );
    writeFileSync(
      ".local/verified-multirange.mp4",
      new Uint8Array(await blob.arrayBuffer()),
    );
    const meta = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          ".local/verified-multirange.mp4",
        ],
        { encoding: "utf8" },
      ),
    );
    expect(+meta.format.duration).toBeCloseTo(2, 0);
    expect(meta.streams.map((s: any) => s.codec_name)).toEqual(["h264", "aac"]);
  }, 120000);
  it.each([
    ["sans", false],
    ["mono", true],
    ["serif", false],
  ] as const)(
    "burns in elapsed timestamps with %s face (bold %s)",
    async (fontFamily, bold) => {
      (globalThis as any).document = { baseURI: "http://localhost/" };
      const r = fixture("test-video.mp4", "video");
      const c = { ...clip(r.id), in: 0, out: 2, speeds: [], zooms: [] };
      const blob = await exportProject(
        [c],
        [],
        [r],
        "mp4",
        true,
        320,
        () => {},
        { ...defaultTimestamp, enabled: true, fontFamily, bold, fontSize: 20 },
      );
      const file = `.local/verified-stamp-${fontFamily}.mp4`;
      writeFileSync(file, new Uint8Array(await blob.arrayBuffer()));
      const metadata = JSON.parse(
        execFileSync(
          "ffprobe",
          ["-v", "error", "-show_streams", "-show_format", "-of", "json", file],
          { encoding: "utf8" },
        ),
      );
      expect(metadata.streams[0].codec_name).toBe("h264");
      expect(+metadata.format.duration).toBeCloseTo(2, 0);
      const raw = execFileSync("ffmpeg", [
        "-v",
        "error",
        "-i",
        file,
        "-ss",
        "1",
        "-frames:v",
        "1",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
      ]);
      let whites = 0;
      for (let y = 150; y < 175; y++)
        for (let x = 190; x < 305; x++) {
          const index = (y * 320 + x) * 3;
          if (raw[index] > 235 && raw[index + 1] > 235 && raw[index + 2] > 235)
            whites++;
        }
      expect(whites).toBeGreaterThan(30);
    },
    120000,
  );
  it("extracts real waveform peaks from video audio", async () => {
    const r = fixture("test-video.mp4", "video");
    const peaks = await embeddedAudioWaveform(r.file);
    expect(peaks).toHaveLength(180);
    expect(Math.max(...peaks)).toBeGreaterThan(0.05);
    expect(peaks.every((p) => p >= 0 && p <= 1)).toBe(true);
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      ".local/test-video.mp4",
      "-an",
      "-c:v",
      "copy",
      ".local/silent-wave-test.mp4",
      "-y",
    ]);
    expect(
      await embeddedAudioWaveform(
        fixture("silent-wave-test.mp4", "video").file,
      ),
    ).toEqual([]);
  }, 120000);
  it.each(["webm", "mov"] as const)(
    "exports silent %s with no audio stream",
    async (format) => {
      const r = fixture("test-video.mp4", "video");
      const c = { ...clip(r.id), out: 0.8, speeds: [], zooms: [] };
      const blob = await exportProject(
        [c],
        [],
        [r],
        format,
        true,
        320,
        () => {},
      );
      const path = `.local/verified.${format}`;
      writeFileSync(path, new Uint8Array(await blob.arrayBuffer()));
      const meta = JSON.parse(
        execFileSync(
          "ffprobe",
          ["-v", "error", "-show_streams", "-of", "json", path],
          { encoding: "utf8" },
        ),
      );
      expect(meta.streams).toHaveLength(1);
      expect(meta.streams[0].codec_name).toBe(
        format === "webm" ? "vp8" : "h264",
      );
    },
    120000,
  );
  it("exports keyframes, timed annotation overlays, italic timestamps and mixed audio together", async () => {
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=red:s=320x180",
      "-frames:v",
      "1",
      "-threads",
      "1",
      "-y",
      ".local/annotation.png",
    ]);
    (globalThis as any).document = { baseURI: "http://localhost/" };
    const r = fixture("test-video.mp4", "video"),
      a = fixture("test-audio.wav", "audio");
    const c = {
      ...clip(r.id),
      in: 0,
      out: 3,
      speeds: [],
      zooms: [],
      zoomKeys: [
        { id: "k1", time: 0, scale: 1, x: 30, y: 40 },
        { id: "k2", time: 3, scale: 2, x: 70, y: 60 },
      ],
    };
    const blob = await exportProject(
      [c],
      [{ ...clip(a.id), in: 0, out: 3, speeds: [], zooms: [] }],
      [r, a],
      "mp4",
      false,
      320,
      () => {},
      { ...defaultTimestamp, enabled: true, italic: true, fontSize: 16 },
      [
        {
          blob: new Blob([readFileSync(".local/annotation.png")]),
          start: 1,
          end: 2,
        },
      ],
    );
    writeFileSync(
      ".local/verified-annotation.mp4",
      new Uint8Array(await blob.arrayBuffer()),
    );
    const sample = (t: number) =>
      execFileSync("ffmpeg", [
        "-v",
        "error",
        "-ss",
        String(t),
        "-i",
        ".local/verified-annotation.mp4",
        "-frames:v",
        "1",
        "-vf",
        "crop=2:2:160:90",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-",
      ]);
    expect(sample(1.5)[0]).toBeGreaterThan(240);
    expect(sample(1.5)[1]).toBeLessThan(15);
    expect(Buffer.compare(sample(0.5), sample(1.5))).not.toBe(0);
    expect(Buffer.compare(sample(2.5), sample(1.5))).not.toBe(0);
    const meta = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_streams",
          "-of",
          "json",
          ".local/verified-annotation.mp4",
        ],
        { encoding: "utf8" },
      ),
    );
    expect(
      meta.streams.some((stream: any) => stream.codec_type === "audio"),
    ).toBe(true);
    cancelExport();
  }, 120000);
  it("pads silent source clips with audio before concatenating", async () => {
    execFileSync("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      ".local/test-video.mp4",
      "-an",
      "-c:v",
      "copy",
      ".local/silent.mp4",
      "-y",
    ]);
    const r = fixture("silent.mp4", "video"),
      other = fixture("test-video.mp4", "video");
    const c = { ...clip(r.id), out: 0.8, speeds: [], zooms: [] },
      d = { ...c, resourceId: other.id };
    const blob = await exportProject(
      [c, d],
      [],
      [r, other],
      "mp4",
      false,
      320,
      () => {},
    );
    expect(blob.size).toBeGreaterThan(1000);
    cancelExport();
  }, 120000);
});

describe("audio tempo chains", () => {
  it("supports slow motion and high rates without unsupported atempo factors", () => {
    expect(tempoFilter(0.25)).toBe("atempo=0.5,atempo=0.5");
    expect(tempoFilter(4)).toBe("atempo=2,atempo=2");
  });
});

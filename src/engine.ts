import { audioPeaks } from "./waveform";
import {
  type TimestampOverlay,
  timestampRange,
  timestampFilter,
  timestampExpression,
  timestampFontURL,
} from "./timestamp";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { type Clip, type Resource, segments, duration } from "./model";
export type Format = "mp4" | "webm" | "mov";
export function tempoFilter(rate: number) {
  const filters: string[] = [];
  while (rate < 0.5) {
    filters.push("atempo=0.5");
    rate /= 0.5;
  }
  while (rate > 2) {
    filters.push("atempo=2");
    rate /= 2;
  }
  filters.push(`atempo=${rate}`);
  return filters.join(",");
}
let engine: FFmpeg | null = null;
export function cancelExport() {
  engine?.terminate();
  engine = null;
}
export async function exportProject(
  clips: Clip[],
  audio: Clip[],
  resources: Resource[],
  format: Format,
  muted: boolean,
  size: number,
  onStatus: (s: string, p: number) => void,
  timestamp?: TimestampOverlay,
) {
  const ff = engine ?? new FFmpeg();
  engine = ff;
  let logs = "";
  const log = ({ message }: { message: string }) => {
    logs = (logs + "\n" + message).slice(-5000);
  };
  ff.on("log", log);
  const files: string[] = [];
  const run = async (args: string[]) => {
    const code = await ff.exec(["-y", ...args]);
    if (code !== 0)
      throw new Error(
        logs.split("\n").filter(Boolean).slice(-5).join("\n") ||
          "FFmpeg could not process this media.",
      );
  };
  try {
    if (!ff.loaded) {
      onStatus("Downloading the local processing engine…", 0);
      const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
      await ff.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(
          `${base}/ffmpeg-core.wasm`,
          "application/wasm",
        ),
      });
    }
    const total = clips.reduce((n, c) => n + duration(c), 0);
    const height = Math.round((size * 9) / 16 / 2) * 2;
    const inputs = new Map<string, string>();
    const hasAudio = new Map<string, boolean>();
    for (const r of resources.filter((r) =>
      [...clips, ...audio].some((c) => c.resourceId === r.id),
    )) {
      onStatus(`Reading ${r.name} locally…`, 0.03);
      const name = `input-${inputs.size}.${
        r.name
          .split(".")
          .pop()
          ?.replace(/[^a-zA-Z0-9]/g, "") || "bin"
      }`;
      files.push(name);
      await ff.writeFile(name, await fetchFile(r.file));
      inputs.set(r.id, name);
      const probe = `probe-${inputs.size}.json`;
      files.push(probe);
      const code = await ff.ffprobe([
        "-v",
        "error",
        "-show_streams",
        "-of",
        "json",
        name,
        "-o",
        probe,
      ]);
      if (code !== 0 && code !== -1) throw new Error(`Cannot read ${r.name}`); // core 0.12.10 ffprobe leaves ret=-1 on successful probes.
      const data = JSON.parse((await ff.readFile(probe, "utf8")) as string);
      hasAudio.set(
        r.id,
        data.streams.some(
          (s: { codec_type: string }) => s.codec_type === "audio",
        ),
      );
    }
    const parts: string[] = [];
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i],
        r = resources.find((r) => r.id === c.resourceId)!;
      const input = inputs.get(r.id)!;
      const cropW = Math.max(2, Math.floor((r.width * c.crop.w) / 100 / 2) * 2),
        cropH = Math.max(2, Math.floor((r.height * c.crop.h) / 100 / 2) * 2);
      const cropX = Math.min(
          r.width - cropW,
          Math.floor((r.width * c.crop.x) / 100 / 2) * 2,
        ),
        cropY = Math.min(
          r.height - cropH,
          Math.floor((r.height * c.crop.y) / 100 / 2) * 2,
        );
      for (const [j, s] of segments(c).entries()) {
        onStatus(
          `Rendering clip ${i + 1} of ${clips.length}…`,
          0.08 + (0.72 * i) / clips.length,
        );
        const out = `part-${i}-${j}.mp4`;
        files.push(out);
        parts.push(out);
        const zoomExpr = c.zooms.reduceRight(
          (rest, z) =>
            `if(between(${s.start}+on/30*${s.rate},${z.start},${z.end}),${z.from}+(${z.to - z.from})*(${s.start}+on/30*${s.rate}-${z.start})/${z.end - z.start},${rest})`,
          "1",
        );
        const center = (axis: "x" | "y") =>
          c.zooms.reduceRight(
            (rest, z) =>
              `if(between(${s.start}+on/30*${s.rate},${z.start},${z.end}),${z[axis] / 100},${rest})`,
            "0.5",
          );
        const vf =
          `trim=start=${s.start}:end=${s.end},setpts=(PTS-STARTPTS)/${s.rate},crop=${cropW}:${cropH}:${cropX}:${cropY},scale=${size}:${height}:force_original_aspect_ratio=decrease,pad=${size}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30` +
          (c.zooms.length
            ? `,zoompan=z='${zoomExpr}':x='max(0,min(iw-iw/zoom,iw*${center("x")}-iw/zoom/2))':y='max(0,min(ih-ih/zoom,ih*${center("y")}-ih/zoom/2))':d=1:s=${size}x${height}:fps=30`
            : "");
        const args = ["-i", input];
        if (!muted && !hasAudio.get(r.id))
          args.push("-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo");
        args.push(
          "-vf",
          vf,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-crf",
          "22",
          "-pix_fmt",
          "yuv420p",
        );
        if (muted) args.push("-an");
        else if (hasAudio.get(r.id))
          args.push(
            "-af",
            `atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS,${tempoFilter(s.rate)},aresample=48000,apad`,
            "-c:a",
            "aac",
            "-ac",
            "2",
          );
        else args.push("-map", "0:v:0", "-map", "1:a:0", "-c:a", "aac");
        args.push("-t", String((s.end - s.start) / s.rate), out);
        await run(args);
      }
    }
    files.push("concat.txt", "joined.mp4");
    await ff.writeFile(
      "concat.txt",
      parts.map((p) => `file '${p}'`).join("\n"),
    );
    await run([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      "concat.txt",
      "-c",
      "copy",
      "joined.mp4",
    ]);
    const args = ["-i", "joined.mp4"];
    const filters: string[] = [];
    if (!muted && audio.length) {
      audio.forEach((c, i) => {
        args.push("-i", inputs.get(c.resourceId)!);
        const pieces = segments(c);
        pieces.forEach((s, j) =>
          filters.push(
            `[${i + 1}:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS,${tempoFilter(s.rate)}[a${i}_${j}]`,
          ),
        );
        filters.push(
          `${pieces.map((_, j) => `[a${i}_${j}]`).join("")}concat=n=${pieces.length}:v=0:a=1[a${i}]`,
        );
      });
      filters.push(
        `[0:a]${audio.map((_, i) => `[a${i}]`).join("")}amix=inputs=${audio.length + 1}:duration=first:normalize=0[mix]`,
      );
      args.push(
        "-filter_complex",
        filters.join(";"),
        "-map",
        "0:v:0",
        "-map",
        "[mix]",
      );
    }
    const stampRange = timestamp ? timestampRange(timestamp, total) : null;
    const stamped = Boolean(
      timestamp?.enabled && stampRange && stampRange.end > stampRange.start,
    );
    if (stamped && timestamp) {
      files.push("timestamp-font.ttf", "timestamp-text.txt");
      await ff.writeFile(
        "timestamp-font.ttf",
        await fetchFile(
          new URL(timestampFontURL(timestamp), document.baseURI).href,
        ),
      );
      await ff.writeFile("timestamp-text.txt", timestampExpression);
      args.push("-vf", timestampFilter(timestamp, total, height));
    }
    if (muted) args.push("-an");
    if (format === "webm")
      args.push(
        "-c:v",
        "libvpx",
        "-b:v",
        "2M",
        ...(!muted ? ["-c:a", "libopus"] : []),
      );
    else
      args.push(
        "-c:v",
        stamped ? "libx264" : "copy",
        ...(stamped
          ? ["-preset", "ultrafast", "-crf", "22", "-pix_fmt", "yuv420p"]
          : []),
        ...(!muted ? ["-c:a", "aac", "-b:a", "192k"] : []),
        "-movflags",
        "+faststart",
      );
    const out = `localcut.${format}`;
    files.push(out);
    args.push("-t", String(total), out);
    onStatus("Finishing your export…", 0.88);
    await run(args);
    const bytes = (await ff.readFile(out)) as Uint8Array;
    onStatus("Export complete", 1);
    return new Blob([new Uint8Array(bytes)], {
      type:
        format === "webm"
          ? "video/webm"
          : format === "mov"
            ? "video/quicktime"
            : "video/mp4",
    });
  } finally {
    ff.off("log", log);
    if (ff.loaded)
      for (const f of files)
        try {
          await ff.deleteFile(f);
        } catch {
          /* cancelled */
        }
  }
}

// A separate transient worker keeps waveform decoding independent of exports.
export async function embeddedAudioWaveform(file: File) {
  const ff = new FFmpeg();
  const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
  const urls: string[] = [];
  try {
    const coreURL = await toBlobURL(
        `${base}/ffmpeg-core.js`,
        "text/javascript",
      ),
      wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm");
    urls.push(coreURL, wasmURL);
    await ff.load({ coreURL, wasmURL });
    const input = `source.${
      file.name
        .split(".")
        .pop()
        ?.replace(/[^a-zA-Z0-9]/g, "") || "mp4"
    }`;
    await ff.writeFile(input, await fetchFile(file));
    const code = await ff.exec([
      "-y",
      "-i",
      input,
      "-map",
      "0:a:0",
      "-vn",
      "-ac",
      "1",
      "-ar",
      "8000",
      "-c:a",
      "pcm_f32le",
      "-f",
      "f32le",
      "audio.raw",
    ]);
    if (code !== 0) return [];
    const bytes = (await ff.readFile("audio.raw")) as Uint8Array;
    const copy = new Uint8Array(bytes);
    return audioPeaks([new Float32Array(copy.buffer)]);
  } catch {
    return [];
  } finally {
    ff.terminate();
    urls.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
  }
}

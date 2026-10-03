import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
mkdirSync(".local", { recursive: true });
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=320x180:rate=30",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:sample_rate=48000",
  "-t",
  "4",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  ".local/test-video.mp4",
  "-y",
]);
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=220:sample_rate=48000",
  "-t",
  "4",
  ".local/test-audio.wav",
  "-y",
]);
console.log("Generated disposable local media fixtures.");

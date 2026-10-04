import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  IconCut,
  IconPlus,
  IconUpload,
  IconPlayerPlay,
  IconPlayerPause,
  IconPlayerTrackPrev,
  IconPlayerTrackNext,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconMovie,
  IconMusic,
  IconVolume,
  IconVolumeOff,
  IconCrop,
  IconZoomIn,
  IconGauge,
  IconTrash,
  IconDownload,
  IconX,
  IconCheck,
  IconGripVertical,
  IconInfoCircle,
  IconLoader2,
  IconListDetails,
  IconGridDots,
  IconLayoutGrid,
  IconClock,
} from "@tabler/icons-react";
import {
  type Resource,
  type Clip,
  type Crop,
  uid,
  time,
  clamp,
  duration,
  sourceAt,
  outputAt,
  zoomAt,
  validateRange,
  keptRanges,
  segmentJump,
} from "./model";
import {
  exportProject,
  cancelExport,
  embeddedAudioWaveform,
  type Format,
} from "./engine";
import {
  RESOURCE_DRAG_TYPE,
  droppedFiles,
  acceptsDrop,
  waitForMedia,
} from "./drop";
import { cropHandles, resizeCrop } from "./crop";
import { CropPreview } from "./CropPreview";
import { HoverDelete } from "./HoverDelete";
import { LibraryDropRegion } from "./LibraryDropRegion";
import { SourceEditor } from "./SourceEditor";
import {
  defaultTimestamp,
  drawTimestamp,
  timestampRange,
  type TimestampOverlay,
  timestampFonts,
} from "./timestamp";
import { nativeAudioWaveform } from "./waveform";
import "./style.css";
const fullCrop: Crop = { x: 0, y: 0, w: 100, h: 100 };
function App() {
  const [resources, setResources] = useState<Resource[]>([]),
    [clips, setClips] = useState<Clip[]>([]),
    [audio, setAudio] = useState<Clip[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [activeResource, setActiveResource] = useState<string | null>(null),
    [position, setPosition] = useState(0),
    [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false),
    [featureId, setFeatureId] = useState<string | null>(null),
    [tool, setTool] = useState<"trim" | "speed" | "zoom">("trim"),
    [range, setRange] = useState({ start: 0, end: 0 }),
    [rate, setRate] = useState(2),
    [zoomFrom, setZoomFrom] = useState(1),
    [zoomTo, setZoomTo] = useState(1.5),
    [zoomX, setZoomX] = useState(50),
    [zoomY, setZoomY] = useState(50),
    [cropTarget, setCropTarget] = useState<string | null>(null),
    [draftCrop, setDraftCrop] = useState<Crop>(fullCrop),
    [cropUnit, setCropUnit] = useState<"percent" | "pixel">("percent"),
    [exportOpen, setExportOpen] = useState(false),
    [format, setFormat] = useState<Format>("mp4"),
    [size, setSize] = useState(1280),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [progress, setProgress] = useState(0),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(false),
    [timelineScale, setTimelineScale] = useState(1),
    [help, setHelp] = useState(false),
    [timestamp, setTimestamp] = useState<TimestampOverlay>({
      ...defaultTimestamp,
    }),
    [timestampOpen, setTimestampOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null),
    offscreen = useRef<HTMLCanvasElement | null>(null);
  const fileInput = useRef<HTMLInputElement>(null),
    video = useRef<HTMLVideoElement>(null),
    audioElements = useRef<Map<string, HTMLAudioElement>>(new Map()),
    timeline = useRef<HTMLDivElement>(null),
    playClock = useRef<{ wall: number; position: number } | null>(null),
    downloadURL = useRef<string | null>(null),
    downloadName = useRef("localcut.mp4"),
    allURLs = useRef<string[]>([]);
  const total = clips.reduce((n, c) => n + duration(c), 0),
    timelineDuration = Math.max(total, ...audio.map(duration), 10),
    rulerDuration = Math.ceil(timelineDuration / 5) * 5;
  const selectedClip = [...clips, ...audio].find((c) => c.id === selected),
    selectedRes = resources.find((r) => r.id === selectedClip?.resourceId),
    res = resources.find((r) => r.id === activeResource);
  let offset = 0;
  const positioned = clips.map((c) => {
    const item = { c, start: offset, end: offset + duration(c) };
    offset = item.end;
    return item;
  });
  const current =
      positioned.find((p) => position >= p.start && position < p.end) ??
      (position === total ? positioned.at(-1) : undefined),
    currentRes = resources.find((r) => r.id === current?.c.resourceId),
    source = current
      ? sourceAt(current.c, position - current.start)
      : undefined;
  const previewRes = currentRes ?? res,
    previewCrop = current?.c.crop ?? previewRes?.crop ?? fullCrop,
    zoom =
      current && source
        ? zoomAt(current.c, source.time)
        : { scale: 1, x: 50, y: 50 };
  const notify = (s: string) => setNotice(s);
  const requestedWaves = useRef(new Set<string>());
  const waveformQueue = useRef(Promise.resolve());
  useEffect(() => {
    if (
      !selectedRes ||
      selectedRes.kind !== "video" ||
      selectedRes.wave.length ||
      requestedWaves.current.has(selectedRes.id)
    )
      return;
    const r = selectedRes;
    requestedWaves.current.add(r.id);
    waveformQueue.current = waveformQueue.current.then(async () => {
      let wave = await nativeAudioWaveform(r.file);
      if (!wave.length) wave = await embeddedAudioWaveform(r.file);
      setResources((items) =>
        items.map((item) => (item.id === r.id ? { ...item, wave } : item)),
      );
    });
  }, [selectedRes?.id]);

  useEffect(() => {
    if (timestamp.enabled) {
      const font = timestampFonts[timestamp.fontFamily];
      void document.fonts?.load(
        `${timestamp.bold ? 700 : 400} ${timestamp.fontSize}px "${font.family}"`,
      );
    }
  }, [
    timestamp.enabled,
    timestamp.fontFamily,
    timestamp.fontSize,
    timestamp.bold,
  ]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 6500);
      return () => clearTimeout(t);
    }
  }, [notice]);
  useEffect(
    () => () => {
      allURLs.current.forEach(URL.revokeObjectURL);
      if (downloadURL.current) URL.revokeObjectURL(downloadURL.current);
      cancelExport();
    },
    [],
  );
  useEffect(() => {
    if (!playing) {
      playClock.current = null;
      video.current?.pause();
      audioElements.current.forEach((a) => a.pause());
      return;
    }
    playClock.current = { wall: performance.now(), position };
    let frame: number;
    const tick = () => {
      const clock = playClock.current!;
      const next = clock.position + (performance.now() - clock.wall) / 1000;
      if (next >= total) {
        setPosition(total);
        setPlaying(false);
        return;
      }
      setPosition(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, total]);
  useEffect(() => {
    const el = video.current;
    if (!el || !previewRes) return;
    const target = source?.time ?? 0;
    el.muted = muted;
    el.playbackRate = source?.rate ?? 1;
    if (Math.abs(el.currentTime - target) > (playing ? 0.22 : 0.025))
      el.currentTime = target;
    if (playing)
      el.play().catch(() => {
        setPlaying(false);
        notify(
          "This browser cannot play this source. Try an MP4 with H.264 video.",
        );
      });
    else el.pause();
  }, [position, playing, previewRes?.id, muted, source?.rate]);
  useEffect(() => {
    const target = canvasRef.current,
      el = video.current;
    if (!target || !el || previewRes?.kind !== "video") return;
    const buffer = offscreen.current ?? document.createElement("canvas");
    offscreen.current = buffer;
    target.width = size;
    target.height = Math.round((size * 9) / 16 / 2) * 2;
    buffer.width = target.width;
    buffer.height = target.height;
    let frame: number;
    const draw = () => {
      const ctx = target.getContext("2d"),
        bctx = buffer.getContext("2d");
      if (ctx && bctx && el.readyState >= 2) {
        const cw = Math.max(
            2,
            Math.floor((previewRes.width * previewCrop.w) / 100 / 2) * 2,
          ),
          ch = Math.max(
            2,
            Math.floor((previewRes.height * previewCrop.h) / 100 / 2) * 2,
          ),
          cx = Math.min(
            previewRes.width - cw,
            Math.floor((previewRes.width * previewCrop.x) / 100 / 2) * 2,
          ),
          cy = Math.min(
            previewRes.height - ch,
            Math.floor((previewRes.height * previewCrop.y) / 100 / 2) * 2,
          );
        const fit = Math.min(buffer.width / cw, buffer.height / ch),
          dw = cw * fit,
          dh = ch * fit;
        bctx.fillStyle = "#000";
        bctx.fillRect(0, 0, buffer.width, buffer.height);
        bctx.drawImage(
          el,
          cx,
          cy,
          cw,
          ch,
          (buffer.width - dw) / 2,
          (buffer.height - dh) / 2,
          dw,
          dh,
        );
        const sw = buffer.width / zoom.scale,
          sh = buffer.height / zoom.scale,
          sx = clamp(
            (buffer.width * zoom.x) / 100 - sw / 2,
            0,
            buffer.width - sw,
          ),
          sy = clamp(
            (buffer.height * zoom.y) / 100 - sh / 2,
            0,
            buffer.height - sh,
          );
        ctx.drawImage(
          buffer,
          sx,
          sy,
          sw,
          sh,
          0,
          0,
          target.width,
          target.height,
        );
      }
      if (ctx) drawTimestamp(ctx, timestamp, position, total);
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [
    previewRes?.id,
    previewCrop.x,
    previewCrop.y,
    previewCrop.w,
    previewCrop.h,
    size,
    zoom.scale,
    zoom.x,
    zoom.y,
    timestamp,
    position,
    total,
  ]);
  useEffect(() => {
    if (position > total) {
      setPosition(total);
      setPlaying(false);
    }
  }, [total, position]);
  useEffect(() => {
    if (!cropTarget && !exportOpen && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href]",
        ) ?? [],
      );
    focusable()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setCropTarget(null);
        setExportOpen(false);
        setHelp(false);
      }
      if (e.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [cropTarget, exportOpen, help, busy]);
  useEffect(() => {
    audio.forEach((c) => {
      const el = audioElements.current.get(c.id);
      if (!el) return;
      const active = playing && position < duration(c);
      const mapped = sourceAt(c, Math.min(position, duration(c)));
      el.muted = muted;
      el.playbackRate = mapped.rate;
      if (Math.abs(el.currentTime - mapped.time) > 0.2)
        el.currentTime = mapped.time;
      if (active)
        el.play().catch(() =>
          notify("The browser cannot preview this audio codec."),
        );
      else el.pause();
    });
  }, [audio, position, playing, muted]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(
          (e.target as HTMLElement).tagName,
        ) ||
        cropTarget ||
        exportOpen
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key === "ArrowRight") seek(position + 0.1);
      if (e.key === "ArrowLeft") seek(position - 0.1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [position, playing, total, cropTarget, exportOpen]);
  function seek(t: number) {
    setPosition(clamp(t, 0, total));
    if (playClock.current)
      playClock.current = {
        wall: performance.now(),
        position: clamp(t, 0, total),
      };
  }
  function togglePlay() {
    if (!total) return;
    if (position >= total) setPosition(0);
    setPlaying((p) => !p);
  }
  function select(c: Clip) {
    setFeatureId(null);
    setSelected(c.id);
    setActiveResource(c.resourceId);
    const first = keptRanges(c)[0];
    setRange({ start: first.start, end: first.end });
  }
  async function importFiles(
    list: FileList | File[],
    targetTrack?: "video" | "audio",
  ) {
    if (busy || loading) {
      notify(
        busy
          ? "Wait for the export to finish before importing."
          : "Media is still importing. Please wait.",
      );
      return;
    }
    setLoading(true);
    const added: Resource[] = [];
    for (const file of Array.from(list)) {
      if (
        !file.type.startsWith("video/") &&
        !file.type.startsWith("audio/") &&
        !/\.(mp4|mov|mkv|webm|m4v|mp3|wav|ogg|aac|m4a|flac)$/i.test(file.name)
      ) {
        notify(`${file.name}: please choose a video or audio file.`);
        continue;
      }
      const url = URL.createObjectURL(file);
      allURLs.current.push(url);
      const kind =
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|ogg|aac|m4a|flac)$/i.test(file.name)
          ? "audio"
          : "video";
      try {
        const media = document.createElement(
          kind === "video" ? "video" : "audio",
        );
        media.preload = "auto";
        await waitForMedia(media, "loadedmetadata", () => {
          media.src = url;
          media.load();
        });
        if (!Number.isFinite(media.duration) || media.duration <= 0)
          throw new Error("Invalid duration");
        let thumb: string | undefined;
        let wave: number[] = [];
        if (kind === "video") {
          const v = media as HTMLVideoElement;
          try {
            if (v.readyState < 2)
              await waitForMedia(v, "loadeddata", () => {}, 10000);
            await waitForMedia(
              v,
              "seeked",
              () => {
                v.currentTime = Math.min(0.1, v.duration / 2);
              },
              3000,
            );
            const canvas = document.createElement("canvas");
            canvas.width = 240;
            canvas.height = 135;
            if (v.readyState >= 2) {
              canvas.getContext("2d")?.drawImage(v, 0, 0, 240, 135);
              thumb = canvas.toDataURL("image/jpeg", 0.7);
            }
          } catch {
            /* A missing thumbnail must not reject valid media. */
          }
        } else if (file.size < 50 * 1024 * 1024) {
          try {
            const context = new AudioContext();
            try {
              const decoded = await context.decodeAudioData(
                await file.arrayBuffer(),
              );
              const samples = decoded.getChannelData(0);
              wave = Array.from({ length: 120 }, (_, i) => {
                const start = Math.floor((i * samples.length) / 120),
                  end = Math.floor(((i + 1) * samples.length) / 120);
                let max = 0;
                for (
                  let j = start;
                  j < end;
                  j += Math.max(1, Math.floor((end - start) / 200))
                )
                  max = Math.max(max, Math.abs(samples[j]));
                return max;
              });
            } finally {
              await context.close();
            }
          } catch {
            /* audio still playable */
          }
        }
        added.push({
          id: uid(),
          file,
          url,
          name: file.name,
          kind,
          duration: media.duration,
          width: kind === "video" ? (media as HTMLVideoElement).videoWidth : 0,
          height:
            kind === "video" ? (media as HTMLVideoElement).videoHeight : 0,
          thumb,
          wave,
          crop: { ...fullCrop },
        });
      } catch {
        URL.revokeObjectURL(url);
        notify(
          `${file.name} cannot be previewed by this browser. Convert it to H.264 MP4 or a supported audio format first.`,
        );
      }
    }
    setResources((prev) => [...prev, ...added]);
    if (added.length) setActiveResource(added[0].id);
    setLoading(false);
    if (targetTrack) {
      for (const r of added) {
        if (r.kind === targetTrack) add(r);
        else notify(`${r.name} imported. Add it to the ${r.kind} track.`);
      }
    } else if (added.length)
      notify(
        `Imported ${added.length} ${added.length === 1 ? "file" : "files"}. Drag a resource onto the timeline.`,
      );
  }
  function allowDrop(e: React.DragEvent) {
    if (!acceptsDrop(Array.from(e.dataTransfer.types))) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = busy || loading ? "none" : "copy";
  }
  function handleDrop(e: React.DragEvent, targetTrack?: "video" | "audio") {
    e.preventDefault();
    e.stopPropagation();
    const files = droppedFiles(e.dataTransfer);
    if (files.length) {
      void importFiles(files, targetTrack);
      return;
    }
    const id = e.dataTransfer.getData(RESOURCE_DRAG_TYPE),
      r = resources.find((r) => r.id === id);
    if (r && targetTrack) {
      if (r.kind !== targetTrack)
        notify(`Drop this resource on the ${r.kind} track.`);
      else add(r);
    } else if (!r)
      notify(
        "Drop a video or audio file from Finder, or use Import to choose it.",
      );
  }
  function add(r: Resource) {
    if (busy) return;
    const c: Clip = {
      id: uid(),
      resourceId: r.id,
      in: 0,
      out: r.duration,
      crop: { ...r.crop },
      speeds: [],
      zooms: [],
    };
    if (r.kind === "video") setClips((p) => [...p, c]);
    else setAudio((p) => [...p, c]);
    select(c);
    notify(
      `${r.name} added to ${r.kind === "video" ? "video" : "audio"} track.`,
    );
  }
  function updateClip(id: string, fn: (c: Clip) => Clip) {
    setClips((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
    setAudio((cs) => cs.map((c) => (c.id === id ? fn(c) : c)));
  }
  function pointerDrag(
    e: React.PointerEvent,
    move: (dx: number, ev: PointerEvent) => void,
  ) {
    e.preventDefault();
    e.stopPropagation();
    const x = e.clientX;
    const onMove = (ev: PointerEvent) => move(ev.clientX - x, ev);
    const end = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  function selectFeature(c: Clip, mode: "speed" | "zoom", id: string) {
    select(c);
    setTool(mode);
    setTimestampOpen(false);
    setFeatureId(id);
    const effect = mode === "speed" ? c.speeds.find((s) => s.id === id) : c.zooms.find((s) => s.id === id);
    if (!effect) return;
    setRange({ start: effect.start, end: effect.end });
    if ("rate" in effect) setRate(effect.rate);
    else { setZoomFrom(effect.from); setZoomTo(effect.to); setZoomX(effect.x); setZoomY(effect.y); }
  }
  function applyEffect() {
    if (tool === "trim" || busy) return;
    if (!selectedClip || !validateRange(range.start, range.end, selectedClip)) {
      notify("Choose a range contained within one kept source interval.");
      return;
    }
    if (tool === "speed") {
      if (
        selectedClip.speeds.some(
          (s) => s.id !== featureId && range.start < s.end && range.end > s.start,
        )
      ) {
        notify("Speed ranges cannot overlap. Remove the existing range first.");
        return;
      }
      updateClip(selectedClip.id, (c) => ({
        ...c,
        speeds: [...c.speeds.filter((s) => s.id !== featureId), { id: featureId ?? uid(), ...range, rate }],
      }));
    } else {
      if (selectedRes?.kind !== "video") return;
      if (
        selectedClip.zooms.some(
          (s) => s.id !== featureId && range.start < s.end && range.end > s.start,
        )
      ) {
        notify("Zoom ranges cannot overlap. Remove the existing range first.");
        return;
      }
      updateClip(selectedClip.id, (c) => ({
        ...c,
        zooms: [
          ...c.zooms.filter((z) => z.id !== featureId),
          {
            id: featureId ?? uid(),
            ...range,
            from: zoomFrom,
            to: zoomTo,
            x: zoomX,
            y: zoomY,
          },
        ],
      }));
    }
    notify(tool === "speed" ? "Speed range applied." : "Gradual zoom applied.");
  }
  async function render() {
    if (!clips.length) {
      notify("Add at least one video clip to export.");
      return;
    }
    setBusy(true);
    setPlaying(false);
    setProgress(0);
    try {
      const blob = await exportProject(
        clips,
        audio,
        resources,
        format,
        muted,
        size,
        (s, p) => {
          setStatus(s);
          setProgress(p);
        },
        timestamp,
      );
      if (downloadURL.current) URL.revokeObjectURL(downloadURL.current);
      const url = URL.createObjectURL(blob);
      downloadURL.current = url;
      downloadName.current = `localcut.${format}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `localcut.${format}`;
      a.click();
      notify("Export complete.");
    } catch (e) {
      setStatus("Export stopped");
      notify(
        e instanceof Error
          ? e.message
          : "Export failed. Try a smaller resolution.",
      );
    } finally {
      setBusy(false);
    }
  }
  function removeClip(id: string | null = selected) {
    setClips((cs) => cs.filter((c) => c.id !== id));
    setAudio((cs) => cs.filter((c) => c.id !== id));
    if (selected === id) setSelected(null);
    setPlaying(false);
    setPosition(0);
  }
  const cropRes = resources.find((r) => r.id === cropTarget);
  function openCrop(r: Resource) {
    setDraftCrop({ ...r.crop });
    setCropTarget(r.id);
    setPlaying(false);
  }
  const [libraryView, setLibraryView] = useState<"details" | "small" | "large">(
    "large",
  );
  const tickCount = 10;
  return (
    <div className="app-shell">
      <main
        className="workspace"
        onDragOver={allowDrop}
        onDrop={(e) => handleDrop(e)}
      >
        <LibraryDropRegion
          disabled={loading || busy}
          onDragOver={allowDrop}
          onDrop={(e) => handleDrop(e)}
        >
          <div className="panel-heading">
            <div>
              <h2>
                Media library{" "}
                <span className="count">
                  {resources.length.toString().padStart(2, "0")}
                </span>
              </h2>
            </div>
            <div className="library-actions">
              <div
                className="library-view-toolbar"
                role="group"
                aria-label="Media library view"
              >
                {(
                  [
                    {
                      id: "details",
                      label: "Details view",
                      icon: IconListDetails,
                    },
                    {
                      id: "small",
                      label: "Small thumbnails",
                      icon: IconGridDots,
                    },
                    {
                      id: "large",
                      label: "Large thumbnails",
                      icon: IconLayoutGrid,
                    },
                  ] as const
                ).map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    title={view.label}
                    aria-label={view.label}
                    aria-pressed={libraryView === view.id}
                    className={libraryView === view.id ? "active" : ""}
                    onClick={() => setLibraryView(view.id)}
                  >
                    <view.icon size={17} />
                  </button>
                ))}
              </div>
              <button
                className="small-button"
                onClick={() => fileInput.current?.click()}
                disabled={loading || busy}
              >
                <IconPlus size={16} /> Import
              </button>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept="video/*,audio/*,.mkv,.mov,.m4v,.flac"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) void importFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <div
            className={`library-scroll ${!resources.length ? "library-is-empty" : ""}`}
          >
            {!resources.length && (
              <button
                className={
                  "upload-zone " + (!resources.length ? "empty-upload" : "")
                }
                onClick={() => fileInput.current?.click()}
                disabled={loading || busy}
              >
                <span className="upload-icon">
                  {loading ? (
                    <IconLoader2 className="spin" size={24} />
                  ) : (
                    <IconUpload size={24} />
                  )}
                </span>
                <strong>
                  {loading ? "Reading your media…" : "Drop media here"}
                </strong>
                <span>or click to browse your files</span>
                <small>VIDEO & AUDIO</small>
              </button>
            )}
            {resources.length > 0 && (
              <div className="library-label">
                ALL MEDIA{" "}
                <span>
                  {resources.length} {resources.length === 1 ? "file" : "files"}
                </span>
              </div>
            )}
            <div className={`resource-grid library-view-${libraryView}`}>
              {resources.map((r) => (
                <article
                  key={r.id}
                  className={
                    "resource-card " + (activeResource === r.id ? "active" : "")
                  }
                  draggable={!busy}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.setData(RESOURCE_DRAG_TYPE, r.id);
                  }}
                  onClick={() => {
                    setActiveResource(r.id);
                    if (!clips.length) setPosition(0);
                  }}
                >
                  <div className="resource-thumb">
                    {r.thumb ? (
                      <img src={r.thumb} alt="" draggable={false} />
                    ) : (
                      <div className="audio-art">
                        <IconMusic size={34} />
                      </div>
                    )}
                    <span className="duration-tag">{time(r.duration)}</span>
                    <span className="kind-tag" aria-label="Media format">
                      {r.name.match(/\.([a-z0-9]+)$/i)?.[1].toUpperCase() ?? r.kind.toUpperCase()}
                    </span>
                  </div>
                  <div className="resource-name" title={r.name}>
                    {r.name}
                  </div>
                  <div className="resource-meta">
                    <span>
                      {r.kind === "video"
                        ? `${r.width} × ${r.height}`
                        : "Audio"}{" "}
                      · {(r.file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    {r.kind === "video" && (
                      <button
                        className="resource-crop-button"
                        title="Crop before adding"
                        aria-label={`Crop ${r.name}`}
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation();
                          openCrop(r);
                        }}
                      >
                        <IconCrop size={libraryView === "details" ? 24 : 18} />
                      </button>
                    )}
                  </div>
                  {r.crop.w < 100 || r.crop.h < 100 ? (
                    <span className="crop-label">
                      Crop applied to new clips
                    </span>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </LibraryDropRegion>
        <section className="preview-panel panel">
          <div className="panel-heading">
            <div>
              <h2>
                Preview{" "}
                <span className="subtle-label">
                  {clips.length ? "TIMELINE" : "SOURCE"}
                </span>
              </h2>
              {(currentRes?.name ?? res?.name) && (
                <p>{currentRes?.name ?? res?.name}</p>
              )}
            </div>
            <div className="preview-actions">
              <span className="preview-ratio">16:9</span>
              <button
                className="icon-button"
                aria-label="Editor information"
                onClick={() => setHelp(true)}
              >
                <IconInfoCircle size={18} />
              </button>
              <button
                className="primary"
                disabled={!clips.length || busy}
                onClick={() => setExportOpen(true)}
              >
                <IconDownload size={17} /> Export video
              </button>
            </div>
          </div>
          <div className="preview-space">
            <div className="preview-frame">
              {previewRes?.kind === "video" ? (
                <>
                  <video
                    className="preview-source"
                    key={previewRes.id}
                    ref={video}
                    src={previewRes.url}
                    playsInline
                    onLoadedData={() => {
                      if (video.current)
                        video.current.currentTime = source?.time ?? 0;
                    }}
                    onError={() =>
                      notify(
                        "This video codec is not supported for browser preview.",
                      )
                    }
                  />
                  <canvas
                    ref={canvasRef}
                    className="preview-canvas"
                    aria-label="Edited video preview"
                  />
                </>
              ) : (
                <div className="preview-empty">
                  <div className="preview-empty-icon">
                    {previewRes?.kind === "audio" ? (
                      <IconMusic size={30} />
                    ) : (
                      <IconPlayerPlay size={30} />
                    )}
                  </div>
                  {previewRes?.kind === "audio" && (
                    <strong>Audio resource selected</strong>
                  )}
                  <span>
                    {previewRes?.kind === "audio"
                      ? "Add a video to the timeline."
                      : "Import media and add it to the timeline."}
                  </span>
                </div>
              )}
              <span className="preview-resolution">
                {size} × {Math.round((size * 9) / 16 / 2) * 2}
              </span>
            </div>
          </div>
          <div className="playback-bar">
            <span className="timecode">
              {time(position)} <span>/ {time(total)}</span>
            </span>
            <div className="playback-controls">
              <button
                aria-label="Go to timeline start"
                title="Go to timeline start"
                disabled={!total}
                onClick={() => {
                  setPlaying(false);
                  seek(0);
                }}
              >
                <IconPlayerSkipBack size={17} />
              </button>
              <button
                aria-label="Previous segment start"
                title="Previous segment start"
                disabled={!total}
                onClick={() => {
                  setPlaying(false);
                  seek(segmentJump(clips, position, "previous"));
                }}
              >
                <IconPlayerTrackPrev size={17} />
              </button>
              <button
                className="play-button"
                aria-label={playing ? "Pause" : "Play"}
                onClick={togglePlay}
                disabled={!total}
              >
                {playing ? (
                  <IconPlayerPause size={21} />
                ) : (
                  <IconPlayerPlay size={21} />
                )}
              </button>
              <button
                aria-label="Next segment start"
                title="Next segment start"
                disabled={!total}
                onClick={() => {
                  setPlaying(false);
                  seek(segmentJump(clips, position, "next"));
                }}
              >
                <IconPlayerTrackNext size={17} />
              </button>
              <button
                aria-label="Go to timeline end"
                title="Go to timeline end"
                disabled={!total}
                onClick={() => {
                  setPlaying(false);
                  seek(total);
                }}
              >
                <IconPlayerSkipForward size={17} />
              </button>
            </div>
            <button
              className="icon-button"
              aria-label={muted ? "Restore audio" : "Remove audio"}
              title="Audio setting applies to preview and export"
              onClick={() => setMuted(!muted)}
            >
              {muted ? <IconVolumeOff size={19} /> : <IconVolume size={19} />}
            </button>
          </div>
        </section>
        <section className="timeline-panel panel">
          <aside className="feature-sidebar" aria-label="Features">
            <div className="feature-buttons"><h2>Features</h2>
            <div className="tools">
              {(
                [
                  { id: "trim", label: "Trim", icon: IconCut },
                  { id: "speed", label: "Speed", icon: IconGauge },
                  { id: "zoom", label: "Zoom", icon: IconZoomIn },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  className={tool === t.id ? "chosen" : ""}
                  disabled={busy}
                  onClick={() => {
                    setTool(t.id);
                    setFeatureId(null);
                    setTimestampOpen(false);
                    if (selectedClip)
                      setRange({
                        start: keptRanges(selectedClip)[0].start,
                        end: keptRanges(selectedClip)[0].end,
                      });
                  }}
                >
                  <t.icon size={16} />
                  {t.label}
                </button>
              ))}
              <button
                className={timestamp.enabled ? "chosen" : ""}
                disabled={busy}
                aria-label="Timestamp overlay settings"
                aria-expanded={timestampOpen}
                onClick={() => {
                  if (!timestamp.enabled)
                    setTimestamp((p) => ({ ...p, enabled: true }));
                  setTimestampOpen(!timestampOpen);
                }}
              >
                <IconClock size={16} />
                Timestamp
              </button>
            </div>
            </div>
            <div className="feature-settings">
          {timestampOpen && (
            <div className="timestamp-controls" aria-label="Timestamp settings">
              <label>
                <input
                  type="checkbox"
                  checked={timestamp.enabled}
                  disabled={busy}
                  onChange={(e) =>
                    setTimestamp({ ...timestamp, enabled: e.target.checked })
                  }
                />
                Timestamp
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={timestamp.entire}
                  disabled={busy}
                  onChange={(e) =>
                    setTimestamp({
                      ...timestamp,
                      entire: e.target.checked,
                      start: 0,
                      end: total,
                    })
                  }
                />
                Entire timeline
              </label>
              {!timestamp.entire && (
                <>
                  <label>
                    From
                    <input
                      type="number"
                      aria-label="Timestamp start seconds"
                      min="0"
                      max={total}
                      step=".1"
                      disabled={busy}
                      value={timestamp.start}
                      onChange={(e) =>
                        setTimestamp({
                          ...timestamp,
                          start: clamp(+e.target.value, 0, total),
                        })
                      }
                    />
                    s
                  </label>
                  <label>
                    To
                    <input
                      type="number"
                      aria-label="Timestamp end seconds"
                      min="0"
                      max={total}
                      step=".1"
                      disabled={busy}
                      value={timestamp.end}
                      onChange={(e) =>
                        setTimestamp({
                          ...timestamp,
                          end: clamp(+e.target.value, 0, total),
                        })
                      }
                    />
                    s
                  </label>
                </>
              )}
              <select
                aria-label="Timestamp position"
                disabled={busy}
                value={timestamp.placement}
                onChange={(e) =>
                  setTimestamp({
                    ...timestamp,
                    placement: e.target.value as TimestampOverlay["placement"],
                  })
                }
              >
                {(
                  [
                    "top-left",
                    "top-right",
                    "bottom-left",
                    "bottom-right",
                    "bottom-center",
                  ] as const
                ).map((p) => (
                  <option key={p} value={p}>
                    {p.replace("-", " ")}
                  </option>
                ))}
              </select>
              <label>
                Font size
                <input
                  aria-label="Timestamp font size (output pixels)"
                  type="number"
                  min="8"
                  max="144"
                  step="1"
                  value={timestamp.fontSize}
                  disabled={busy}
                  onChange={(e) =>
                    setTimestamp({
                      ...timestamp,
                      fontSize: clamp(+e.target.value, 8, 144),
                    })
                  }
                />
                px
              </label>
              <select
                aria-label="Timestamp font family"
                disabled={busy}
                value={timestamp.fontFamily}
                onChange={(e) =>
                  setTimestamp({
                    ...timestamp,
                    fontFamily: e.target
                      .value as TimestampOverlay["fontFamily"],
                  })
                }
              >
                {Object.entries(timestampFonts).map(([id, font]) => (
                  <option key={id} value={id}>
                    {font.label}
                  </option>
                ))}
              </select>
              <label>
                <input
                  type="checkbox"
                  checked={timestamp.bold}
                  disabled={busy}
                  onChange={(e) =>
                    setTimestamp({ ...timestamp, bold: e.target.checked })
                  }
                />
                Bold
              </label>
              <label>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={timestamp.background}
                  onChange={(e) =>
                    setTimestamp({ ...timestamp, background: e.target.checked })
                  }
                />
                Background
              </label>
              <span>00:00:00 · edited time</span>
              <button
                className="icon-button"
                aria-label="Close timestamp settings"
                onClick={() => setTimestampOpen(false)}
              >
                <IconX size={16} />
              </button>
            </div>
          )}
          <div className="inspector" hidden={timestampOpen || !selectedClip || !selectedRes}>
            {selectedClip && selectedRes ? (
              <>
                <div className="inspector-title">
                  <span className="selection-dot" />
                  <strong title={selectedRes.name}>{selectedRes.name}</strong>
                  <span>{time(duration(selectedClip))}</span>
                </div>
                {tool === "trim" ? (
                  <div className="effect-fields">
                    <span>Trim</span>
                    <span>{time(range.start)}–{time(range.end)}</span>
                  </div>
                ) : (
                  <div className="effect-fields">
                    <label>
                      From
                      <input
                        aria-label="Effect start seconds"
                        type="number"
                        step=".1"
                        value={+range.start.toFixed(2)}
                        onChange={(e) =>
                          setRange({ ...range, start: +e.target.value })
                        }
                      />
                      s
                    </label>
                    <label>
                      To
                      <input
                        aria-label="Effect end seconds"
                        type="number"
                        step=".1"
                        value={+range.end.toFixed(2)}
                        onChange={(e) =>
                          setRange({ ...range, end: +e.target.value })
                        }
                      />
                      s
                    </label>
                    {tool === "speed" ? (
                      <select
                        aria-label="Range playback speed"
                        value={rate}
                        onChange={(e) => setRate(+e.target.value)}
                      >
                        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((r) => (
                          <option key={r} value={r}>
                            {r}×{" "}
                            {r < 1 ? "slower" : r > 1 ? "faster" : "normal"}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <>
                        <select
                          aria-label="Starting zoom"
                          value={zoomFrom}
                          onChange={(e) => setZoomFrom(+e.target.value)}
                        >
                          {[1, 1.25, 1.5, 2, 3].map((z) => (
                            <option key={z} value={z}>
                              {z}× start
                            </option>
                          ))}
                        </select>
                        <select
                          aria-label="Ending zoom"
                          value={zoomTo}
                          onChange={(e) => setZoomTo(+e.target.value)}
                        >
                          {[1, 1.25, 1.5, 2, 3].map((z) => (
                            <option key={z} value={z}>
                              {z}× end
                            </option>
                          ))}
                        </select>
                        <label>
                          X
                          <input
                            aria-label="Zoom center X percent"
                            type="number"
                            min="0"
                            max="100"
                            value={zoomX}
                            onChange={(e) =>
                              setZoomX(clamp(+e.target.value, 0, 100))
                            }
                          />
                          %
                        </label>
                        <label>
                          Y
                          <input
                            aria-label="Zoom center Y percent"
                            type="number"
                            min="0"
                            max="100"
                            value={zoomY}
                            onChange={(e) =>
                              setZoomY(clamp(+e.target.value, 0, 100))
                            }
                          />
                          %
                        </label>
                      </>
                    )}
                    <button
                      className="small-button accent"
                      disabled={
                        busy ||
                        (tool === "zoom" && selectedRes.kind !== "video")
                      }
                      onClick={applyEffect}
                    >
                      {featureId ? "Update feature" : "Apply feature"}
                    </button>
                  </div>
                )}
                <button
                  className="icon-button delete"
                  aria-label="Remove selected clip"
                  disabled={busy}
                  onClick={() => removeClip()}
                >
                  <IconTrash size={17} />
                </button>
                <div className="effect-list">
                  {tool === "speed" &&
                    selectedClip.speeds.map((s) => (
                      <button
                        key={s.id}
                        disabled={busy}
                        onClick={() => selectFeature(selectedClip, "speed", s.id)}
                      >
                        {time(s.start)}–{time(s.end)} · {s.rate}×{" "}
                      </button>
                    ))}
                  {tool === "zoom" &&
                    selectedClip.zooms.map((s) => (
                      <button
                        key={s.id}
                        disabled={busy}
                        onClick={() => selectFeature(selectedClip, "zoom", s.id)}
                      >
                        {time(s.start)}–{time(s.end)} · {s.from}→{s.to}×{" "}
                      </button>
                    ))}
                </div>
              </>
            ) : null}
          </div>
            </div>
          </aside>
          <div className="timeline-heading">
            <div className="flex items-center gap-3">
              <h2>Timeline</h2>
              <span className="count">{clips.length + audio.length} clips</span>
            </div>
            <div className="timeline-zoom">
              <span>−</span>
              <input
                aria-label="Timeline zoom"
                type="range"
                min="1"
                max="5"
                step=".25"
                value={timelineScale}
                onChange={(e) => setTimelineScale(+e.target.value)}
              />
              <IconPlus size={13} />
            </div>
          </div>
          <div className="timeline-scroll">
            <div className="track-labels">
              <div className="ruler-spacer" />
              {(["video", "audio"] as const).map((kind) => (
                <React.Fragment key={kind}>
                  <div>
                    {kind === "video" ? (
                      <IconMovie size={17} />
                    ) : (
                      <IconMusic size={17} />
                    )}
                    <span>
                      {kind === "video" ? "Video" : "Audio"}
                      <small>{kind === "video" ? "SEQUENCE" : "OVERLAY"}</small>
                    </span>
                  </div>
                  {selectedClip && selectedRes?.kind === kind && (
                    <div className="source-track-label">
                      <span>
                        Selected segment
                        <small title={selectedRes.name}>
                          {selectedRes.name}
                        </small>
                      </span>
                    </div>
                  )}
                </React.Fragment>
              ))}
              {timestamp.enabled && (
                <div className="timestamp-track-label">
                  <IconClock size={16} />
                  <span>Timestamp</span>
                </div>
              )}
            </div>
            <div
              className="timeline-content"
              ref={timeline}
              style={{
                minWidth: 0,
                flex: `0 0 calc((100% - 127px) * ${timelineScale})`,
              }}
            >
              <div
                className="ruler"
                onPointerDown={(e) => {
                  if (!timeline.current) return;
                  const rect = timeline.current.getBoundingClientRect();
                  seek(((e.clientX - rect.left) / rect.width) * rulerDuration);
                  pointerDrag(e, (_, ev) =>
                    seek(
                      ((ev.clientX - rect.left) / rect.width) * rulerDuration,
                    ),
                  );
                }}
              >
                {Array.from({ length: tickCount + 1 }, (_, i) => (
                  <span key={i} style={{ left: `${(i / tickCount) * 100}%` }}>
                    {time((i * rulerDuration) / tickCount).split(".")[0]}
                  </span>
                ))}
              </div>
              {(["video", "audio"] as const).map((kind) => (
                <React.Fragment key={kind}>
                  <div
                    className={"track " + kind}
                    onDragOver={allowDrop}
                    onDrop={(e) => handleDrop(e, kind)}
                  >
                    {(kind === "video"
                      ? positioned
                      : audio.map((c) => ({ c, start: 0, end: duration(c) }))
                    ).map(({ c, start, end }) => {
                      const r = resources.find((r) => r.id === c.resourceId)!;
                      return (
                        <div
                          key={c.id}
                          tabIndex={0}
                          role="button"
                          aria-label={`Select ${r.name}`}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") select(c);
                          }}
                          className={
                            "timeline-clip " +
                            (selected === c.id ? "selected" : "")
                          }
                          style={{
                            left: `${(start / rulerDuration) * 100}%`,
                            width: `${((end - start) / rulerDuration) * 100}%`,
                          }}
                          onPointerDown={(e) => {
                            select(c);
                            if (tool === "trim" || busy) return;
                            const rect =
                              e.currentTarget.getBoundingClientRect();
                            const startSource = sourceAt(
                              c,
                              clamp(
                                ((e.clientX - rect.left) / rect.width) *
                                  duration(c),
                                0,
                                duration(c),
                              ),
                            ).time;
                            setRange({ start: startSource, end: startSource });
                            pointerDrag(e, (_, ev) => {
                              const endSource = sourceAt(
                                c,
                                clamp(
                                  ((ev.clientX - rect.left) / rect.width) *
                                    duration(c),
                                  0,
                                  duration(c),
                                ),
                              ).time;
                              setRange({
                                start: Math.min(startSource, endSource),
                                end: Math.max(startSource, endSource),
                              });
                            });
                          }}
                        >
                          <div className="clip-fill">
                            {kind === "video" && r.thumb ? (
                              <div
                                className="filmstrip"
                                style={{ backgroundImage: `url(${r.thumb})` }}
                              />
                            ) : (
                              <div className="waveform">
                                {r.wave.length ? (
                                  r.wave.map((v, i) => (
                                    <i
                                      key={i}
                                      style={{
                                        height: `${Math.max(3, v * 85)}%`,
                                      }}
                                    />
                                  ))
                                ) : (
                                  <span>Audio · {time(duration(c))}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <HoverDelete
                            label={`Delete ${kind} segment ${r.name}`}
                            disabled={busy}
                            onDelete={() => removeClip(c.id)}
                          />
                          <span className="clip-title">
                            {kind === "video" ? (
                              <IconMovie size={12} />
                            ) : (
                              <IconMusic size={12} />
                            )}{" "}
                            {r.name}
                          </span>
                          {c.speeds.map((s) => (
                            <div
                              key={s.id}
                              className="effect-range speed"
                              style={{
                                left: `${(outputAt(c, s.start) / duration(c)) * 100}%`,
                                width: `${((outputAt(c, s.end) - outputAt(c, s.start)) / duration(c)) * 100}%`,
                              }}
                            >
                              {s.rate}×
                            </div>
                          ))}
                          {c.zooms.map((z) => (
                            <div
                              key={z.id}
                              className="effect-range zoom"
                              style={{
                                left: `${(outputAt(c, z.start) / duration(c)) * 100}%`,
                                width: `${((outputAt(c, z.end) - outputAt(c, z.start)) / duration(c)) * 100}%`,
                              }}
                            >
                              <IconZoomIn size={11} />
                            </div>
                          ))}
                          {selected === c.id &&
                            tool !== "trim" &&
                            range.end > range.start && (
                              <div
                                className="selection-range"
                                style={{
                                  left: `${(outputAt(c, range.start) / duration(c)) * 100}%`,
                                  width: `${((outputAt(c, range.end) - outputAt(c, range.start)) / duration(c)) * 100}%`,
                                }}
                              />
                            )}
                        </div>
                      );
                    })}
                    {!(kind === "video" ? clips : audio).length && (
                      <div className="track-empty">
                        <IconPlus size={16} />
                        {kind === "video"
                          ? "Drag video here to build your sequence"
                          : "Drag audio here to add a soundtrack"}
                      </div>
                    )}
                  </div>
                  {selectedClip && selectedRes?.kind === kind && (
                    <SourceEditor
                      key={selectedClip.id}
                      clip={selectedClip}
                      resource={selectedRes}
                      mode={tool}
                      disabled={busy}
                      range={range}
                      onRange={setRange}
                      onSelectFeature={(mode, id) => selectFeature(selectedClip, mode, id)}
                      onChange={(next) => {
                        updateClip(next.id, () => next);
                        if (tool === "trim") {
                          const retained = keptRanges(next);
                          const active = retained.find((r) => r.start <= range.start && r.end >= range.end) ?? retained[0];
                          setRange({ start: active.start, end: active.end });
                        }
                        if (featureId && ![...next.speeds, ...next.zooms].some((f) => f.id === featureId)) setFeatureId(null);
                      }}
                      onSeek={(sourceTime) => {
                        setPlaying(false);
                        seek(
                          (positioned.find((p) => p.c.id === selectedClip.id)
                            ?.start ?? 0) + outputAt(selectedClip, sourceTime),
                        );
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
              {timestamp.enabled && (
                <div className="timestamp-track">
                  {(() => {
                    const r = timestampRange(timestamp, total);
                    return r.end > r.start ? (
                      <div
                        className="timestamp-segment"
                        style={{
                          left: `${(r.start / rulerDuration) * 100}%`,
                          width: `${((r.end - r.start) / rulerDuration) * 100}%`,
                        }}
                        onClick={() => setTimestampOpen(true)}
                      >
                        <IconClock size={13} />
                        <span>00:00:00</span>
                        <HoverDelete
                          label="Remove timestamp overlay"
                          disabled={busy}
                          onDelete={() => {
                            setTimestamp({ ...timestamp, enabled: false });
                            setTimestampOpen(false);
                          }}
                        />
                      </div>
                    ) : null;
                  })()}
                </div>
              )}
              <div
                className="playhead"
                style={{ left: `${(position / rulerDuration) * 100}%` }}
              >
                <div
                  onPointerDown={(e) => {
                    const rect = timeline.current!.getBoundingClientRect();
                    pointerDrag(e, (_, ev) =>
                      seek(
                        ((ev.clientX - rect.left) / rect.width) * rulerDuration,
                      ),
                    );
                  }}
                />
              </div>
            </div>
          </div>
          <footer className="timeline-foot">
            <span>
              <kbd>SPACE</kbd> Play / pause
            </span>
            <span>{time(total)} total</span>
          </footer>
        </section>
      </main>
      {audio.map((c) => (
        <audio
          key={c.id}
          ref={(el) => {
            if (el) audioElements.current.set(c.id, el);
            else audioElements.current.delete(c.id);
          }}
          src={resources.find((r) => r.id === c.resourceId)?.url}
          preload="metadata"
        />
      ))}
      {notice && (
        <div className="toast" role="status">
          <IconInfoCircle size={18} />
          <span>{notice}</span>
          <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
            <IconX size={16} />
          </button>
        </div>
      )}
      {cropRes && (
        <div className="modal-backdrop" onClick={() => setCropTarget(null)}>
          <section
            className="modal crop-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="crop-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2 id="crop-title">Crop the resource</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close crop"
                onClick={() => setCropTarget(null)}
              >
                <IconX size={20} />
              </button>
            </div>
            <CropPreview key={cropRes.id} url={cropRes.url} poster={cropRes.thumb}
              duration={cropRes.duration} width={cropRes.width} height={cropRes.height} crop={draftCrop}>
              <div
                className="crop-box"
                style={{
                  left: `${draftCrop.x}%`,
                  top: `${draftCrop.y}%`,
                  width: `${draftCrop.w}%`,
                  height: `${draftCrop.h}%`,
                }}
                onPointerDown={(e) => {
                  const rect =
                      e.currentTarget.parentElement!.getBoundingClientRect(),
                    original = { ...draftCrop },
                    y = e.clientY;
                  pointerDrag(e, (dx, ev) =>
                    setDraftCrop({
                      ...original,
                      x: clamp(
                        original.x + (dx / rect.width) * 100,
                        0,
                        100 - original.w,
                      ),
                      y: clamp(
                        original.y + ((ev.clientY - y) / rect.height) * 100,
                        0,
                        100 - original.h,
                      ),
                    }),
                  );
                }}
              >
                <span />
                <span />
                {cropHandles.map(([handle, label]) => (
                  <button key={handle}
                    aria-label={`Resize crop ${label}`}
                    className={`crop-resize crop-resize-${handle}`}
                    onPointerDown={(e) => {
                      const rect = e.currentTarget.parentElement!.parentElement!.getBoundingClientRect();
                      const original = { ...draftCrop }, y = e.clientY;
                      pointerDrag(e, (dx, ev) => setDraftCrop(resizeCrop(
                        original, handle, (dx / rect.width) * 100,
                        ((ev.clientY - y) / rect.height) * 100,
                      )));
                    }}
                  />
                ))}
              </div>
            </CropPreview>
            <div className="crop-fields">
              {([ ["x", "y"], ["w", "h"] ] as const).map((keys, i) => (
                <div className="crop-field-group" key={i}>
                  {keys.map((key) => {
                    const factor = cropUnit === "pixel" ? (key === "x" || key === "w" ? cropRes.width : cropRes.height) / 100 : 1;
                    return <label key={key}>
                      {{ x: "Left", y: "Top", w: "Width", h: "Height" }[key]}
                      <input type="number" step={cropUnit === "pixel" ? 1 : 0.1}
                        min={(key === "w" || key === "h" ? 5 : 0) * factor}
                        max={100 * factor}
                        value={cropUnit === "pixel" ? Math.round(draftCrop[key] * factor) : +draftCrop[key].toFixed(1)}
                        onChange={(e) => setDraftCrop((p) => {
                          const value = +e.target.value / factor;
                          if (key === "x") return { ...p, x: clamp(value, 0, 100 - p.w) };
                          if (key === "y") return { ...p, y: clamp(value, 0, 100 - p.h) };
                          if (key === "w") return { ...p, w: clamp(value, 5, 100 - p.x) };
                          return { ...p, h: clamp(value, 5, 100 - p.y) };
                        })} />
                    </label>;
                  })}
                </div>
              ))}
              <div className="crop-unit-toggle" role="group" aria-label="Crop units">
                <button aria-pressed={cropUnit === "percent"} onClick={() => setCropUnit("percent")}>%</button>
                <button aria-pressed={cropUnit === "pixel"} onClick={() => setCropUnit("pixel")}>px</button>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="primary"
                onClick={() => {
                  setResources((rs) =>
                    rs.map((r) =>
                      r.id === cropTarget ? { ...r, crop: draftCrop } : r,
                    ),
                  );
                  setCropTarget(null);
                  notify(
                    "Crop applied to new clips.",
                  );
                }}
              >
                <IconCheck size={16} /> Apply crop
              </button>
            </div>
          </section>
        </div>
      )}
      {exportOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setExportOpen(false);
          }}
        >
          <section
            className="modal export-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2 id="export-title">Export video</h2>
                <p>Choose the format and resolution for your sequence.</p>
              </div>
              <button
                className="icon-button"
                aria-label="Close export"
                disabled={busy}
                onClick={() => setExportOpen(false)}
              >
                <IconX size={20} />
              </button>
            </div>
            <label className="field-label">OUTPUT FORMAT</label>
            <div className="format-options">
              {(
                [
                  {
                    id: "mp4",
                    name: "MP4",
                    codec: "H.264 + AAC",
                    description: "Best for presentations and sharing",
                    ppt: true,
                  },
                  {
                    id: "webm",
                    name: "WebM",
                    codec: "VP8 + Opus",
                    description: "Made for modern web browsers",
                  },
                  {
                    id: "mov",
                    name: "MOV",
                    codec: "H.264 + AAC",
                    description: "QuickTime-compatible container",
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  className={
                    "format-option " + (format === f.id ? "selected" : "")
                  }
                  disabled={busy}
                  onClick={() => setFormat(f.id)}
                >
                  <span className="radio-dot" />
                  <div>
                    <strong>
                      {f.name} <span>{f.codec}</span>
                      {"ppt" in f && <em className="ppt-badge">PPTX</em>}
                    </strong>
                    <p>{f.description}</p>
                  </div>
                  {format === f.id && <IconCheck size={18} />}
                </button>
              ))}
            </div>
            <div className="export-settings">
              <label>
                Resolution
                <select
                  value={size}
                  disabled={busy}
                  onChange={(e) => setSize(+e.target.value)}
                >
                  <option value="1920">1080p · 1920 × 1080</option>
                  <option value="1280">720p · 1280 × 720</option>
                  <option value="854">480p · 854 × 480</option>
                </select>
              </label>
              <label className="audio-toggle">
                <span>
                  Remove audio<small>Export a silent video</small>
                </span>
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={muted}
                  onChange={(e) => setMuted(e.target.checked)}
                />
              </label>
            </div>
            <div className="export-summary">
              <span>
                {clips.length} video clips · {time(total)}
              </span>
              <span>30 fps · 16:9</span>
            </div>
            <p className="modal-note">
              The engine downloads when first needed (~32 MB). Keep this tab open;
              longer videos may take several minutes.
            </p>
            {busy && (
              <div className="export-progress">
                <progress value={progress} max="1" />
                <span>
                  <IconLoader2 size={14} className="spin" />
                  {status}
                </span>
              </div>
            )}
            {!busy && status === "Export complete" && (
              <p className="success">
                <IconCheck size={16} /> Export complete.{" "}
                <button
                  onClick={() => {
                    if (downloadURL.current) {
                      const a = document.createElement("a");
                      a.href = downloadURL.current;
                      a.download = downloadName.current;
                      a.click();
                    }
                  }}
                >
                  Download again
                </button>
              </p>
            )}
            <div className="modal-footer">
              <button
                className="small-button"
                onClick={() => {
                  if (busy) {
                    cancelExport();
                    setStatus("Export cancelled");
                  } else setExportOpen(false);
                }}
              >
                {busy ? "Cancel export" : "Back to editing"}
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void render()}
              >
                {busy ? (
                  <IconLoader2 size={17} className="spin" />
                ) : (
                  <IconDownload size={17} />
                )}{" "}
                {busy ? "Exporting…" : "Export video"}
              </button>
            </div>
          </section>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <h2 id="help-title">Editor guide</h2>
              <button
                aria-label="Close information"
                className="icon-button"
                onClick={() => setHelp(false)}
              >
                <IconX size={20} />
              </button>
            </div>
            <div className="help-copy">
              <p>
                <strong>Import media.</strong> Import local videos or audio,
                crop resources if needed, then drag them onto the
                matching track. Videos append in order; audio clips overlay from
                the start.
              </p>
              <p>
                <strong>Edit segments.</strong> Select a segment to open its
                full-source row. In Trim mode, adjust source handles or select
                an area and choose Keep range or Exclude range. For speed or
                zoom, select the tool and drag inside a kept source interval,
                then apply your settings. Ranges use original source seconds.
                Overlapping ranges of the same type are not supported. Trimming
                away an effect removes it.
              </p>
              <p>
                <strong>Zoom settings.</strong> Set start and end scale, and X/Y
                focal point percentages. Zoom interpolates linearly inside the
                range and resets outside it.
              </p>
              <p>
                <strong>Technical limits.</strong> Preview uses browser playback
                and canvas crop/zoom rendering; FFmpeg produces the final frames
                at 30 fps. Frame timing may differ slightly. The single-thread
                engine is memory intensive and slower than desktop tools. Start
                with short 720p clips. Browser-unsupported codecs cannot be
                imported in this version.
              </p>
              <p>Refreshing closes the current project.</p>
              <p>
                MP4 with H.264 video and AAC audio is{" "}
                <a
                  href="https://support.microsoft.com/en-us/powerpoint/video-and-audio-file-formats-supported-in-powerpoint"
                  target="_blank"
                  rel="noreferrer"
                >
                  Microsoft’s recommendation for PowerPoint
                </a>
                . The PPTX badge indicates compatibility; the editor exports a
                video file.
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

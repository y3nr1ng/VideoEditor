import { useRef, useState, useEffect, type ReactNode } from "react";
import { IconPlayerSkipBack, IconPlayerSkipForward, IconPlayerPlay, IconPlayerPause } from "@tabler/icons-react";
import { type Crop, clamp, time } from "./model";

export function CropPreview({ url, poster, duration, width, height, crop = { x: 0, y: 0, w: 100, h: 100 }, children }: {
  url: string; poster?: string; duration: number; width: number; height: number; crop?: Crop; children: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const maxZoom = Math.min(100 / crop.w, 100 / crop.h);
  const scale = clamp(zoom, 1, maxZoom);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? element.clientHeight : 1);
      setZoom((value) => clamp(clamp(value, 1, maxZoom) * Math.exp(-delta * 0.002), 1, maxZoom));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [maxZoom]);
  const centerX = clamp((crop.x + crop.w / 2) / 100, 0.5 / scale, 1 - 0.5 / scale);
  const centerY = clamp((crop.y + crop.h / 2) / 100, 0.5 / scale, 1 - 0.5 / scale);
  function seek(value: number) {
    if (!video.current) return;
    video.current.currentTime = value;
    setPosition(value);
  }
  function jump(value: number) {
    video.current?.pause();
    seek(value);
  }
  return <>
    <div ref={stage} className="crop-stage" style={{ aspectRatio: `${width}/${height}`, width: `min(100%, ${(350 * width) / height}px)` }}>
      <div className="crop-source" style={{ transformOrigin: "0 0", transform: `translate(${(0.5 - centerX * scale) * 100}%, ${(0.5 - centerY * scale) * 100}%) scale(${scale})` }}>
      <video ref={video} src={url} poster={poster} aria-label="Crop preview" preload="auto" muted playsInline
        onLoadedData={() => seek(Math.min(0.1, duration / 2))}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      {children}
      </div>
    </div>
    <div className="crop-transport">
      <input aria-label="Crop preview time" type="range" min={0} max={duration} step={0.01} value={position}
        onChange={(e) => seek(+e.target.value)} />
      <div className="crop-playback">
        <button className="icon-button" aria-label="Crop preview start" onClick={() => jump(0)}><IconPlayerSkipBack size={18} /></button>
        <button className="icon-button" aria-label={playing ? "Pause crop preview" : "Play crop preview"} onClick={() => {
          const v = video.current;
          if (!v) return;
          if (v.paused) { if (v.ended) seek(0); void v.play().catch(() => setPlaying(false)); }
          else v.pause();
        }}>{playing ? <IconPlayerPause size={20} /> : <IconPlayerPlay size={20} />}</button>
        <button className="icon-button" aria-label="Crop preview end" onClick={() => jump(duration)}><IconPlayerSkipForward size={18} /></button>
        <span>{time(position)} / {time(duration)}</span>
      </div>
    </div>
  </>;
}

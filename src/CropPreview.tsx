import { useRef, useState, type ReactNode } from "react";
import { IconPlayerSkipBack, IconPlayerSkipForward, IconPlayerPlay, IconPlayerPause } from "@tabler/icons-react";
import { time } from "./model";

export function CropPreview({ url, poster, duration, width, height, children }: {
  url: string; poster?: string; duration: number; width: number; height: number; children: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
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
    <div className="crop-stage" style={{ aspectRatio: `${width}/${height}`, width: `min(100%, ${(350 * width) / height}px)` }}>
      <video ref={video} src={url} poster={poster} aria-label="Crop preview" preload="auto" muted playsInline
        onLoadedData={() => seek(Math.min(0.1, duration / 2))}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      {children}
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

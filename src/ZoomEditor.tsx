import {
  type Clip,
  type Resource,
  type ZoomKeyframe,
  clamp,
  uid,
  sourceAt,
  duration,
  keptRanges,
} from "./model";
import { keyframeView } from "./keyframes";
export function ZoomEditor({
  clip,
  resource,
  onChange,
  onSeek,
  disabled,
  position,
  selected,
  setSelected,
}: {
  clip: Clip;
  resource: Resource;
  onChange: (c: Clip) => void;
  onSeek: (t: number) => void;
  disabled: boolean;
  position: number;
  selected: string | null;
  setSelected: (id: string | null) => void;
}) {
  const keys = clip.zoomKeys ?? [],
    key = keys.find((k) => k.id === selected);
  function update(change: Partial<ZoomKeyframe>) {
    if (!key) return;
    const next = { ...key, ...change };
    if (
      !keptRanges(clip).some(
        (r) => next.time >= r.start && next.time <= r.end,
      ) ||
      keys.some((k) => k.id !== key.id && Math.abs(k.time - next.time) < 0.001)
    )
      return;
    onChange({
      ...clip,
      zoomKeys: keys.map((k) => (k.id === key.id ? next : k)),
    });
    onSeek(next.time);
  }
  return (
    <div className="zoom-key-editor">
      <button
        className="small-button"
        disabled={disabled || resource.kind !== "video"}
        onClick={() => {
          const t = sourceAt(clip, clamp(position, 0, duration(clip))).time;
          if (keys.some((k) => Math.abs(k.time - t) < 0.001)) return;
          const k = { id: uid(), time: t, ...keyframeView(keys, t) };
          onChange({ ...clip, zoomKeys: [...keys, k] });
          setSelected(k.id);
        }}
      >
        Add keyframe at playhead
      </button>
      {key &&
        (["time", "scale", "x", "y"] as const).map((field) => (
          <label key={field}>
            {
              {
                time: "Time (source seconds)",
                scale: "Zoom",
                x: "Center X (%)",
                y: "Center Y (%)",
              }[field]
            }
            <input
              aria-label={`Keyframe ${field}`}
              type="number"
              step={field === "scale" ? 0.05 : 0.1}
              disabled={disabled}
              value={+key[field].toFixed(3)}
              min={field === "scale" ? 1 : 0}
              max={
                field === "time"
                  ? resource.duration
                  : field === "scale"
                    ? 8
                    : 100
              }
              onChange={(e) =>
                update({
                  [field]: clamp(
                    +e.target.value,
                    field === "scale" ? 1 : 0,
                    field === "time"
                      ? resource.duration
                      : field === "scale"
                        ? 8
                        : 100,
                  ),
                })
              }
            />
          </label>
        ))}
      {key && (
        <button
          className="small-button"
          disabled={disabled}
          onClick={() => {
            onChange({
              ...clip,
              zoomKeys: keys.filter((k) => k.id !== key.id),
            });
            setSelected(null);
          }}
        >
          Delete keyframe
        </button>
      )}
    </div>
  );
}

import {
  useState,
  useRef,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  IconGripVertical,
  IconPlus,
  IconCut,
  IconTrash,
} from "@tabler/icons-react";
import {
  type Clip,
  type Resource,
  keptRanges,
  trimKeptRange,
  withRanges,
  excludeSourceRange,
  clamp,
  time,
  uid,
} from "./model";
import { HoverDelete } from "./HoverDelete";
type Props = {
  clip: Clip;
  resource: Resource;
  mode: "trim" | "speed" | "zoom";
  disabled: boolean;
  range: { start: number; end: number };
  onRange: (range: { start: number; end: number }) => void;
  onChange: (clip: Clip) => void;
  onSeek: (time: number) => void;
};
export function SourceEditor({
  clip,
  resource,
  mode,
  disabled,
  range,
  onRange,
  onChange,
  onSeek,
}: Props) {
  const ranges = keptRanges(clip);
  const [activeId, setActiveId] = useState(ranges[0].id),
    [anchor, setAnchor] = useState((ranges[0].start + ranges[0].end) / 2),
    [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null),
    cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  const active = ranges.find((r) => r.id === activeId) ?? ranges[0];
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    if (!cleanup.current) setAnchor((active.start + active.end) / 2);
  }, [active.id, active.start, active.end]);

  const span = Math.max(
    resource.duration,
    2 * Math.max(anchor, resource.duration - anchor),
  );
  const left = ((span / 2 - anchor) / span) * 100,
    width = (resource.duration / span) * 100;
  const selection = mode === "trim" ? draft : range;
  function drag(e: ReactPointerEvent, move: (time: number) => void) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = strip.current!.getBoundingClientRect();
    cleanup.current?.();
    const pointer = (ev: PointerEvent) =>
      move(
        clamp(
          ((ev.clientX - rect.left) / rect.width) * resource.duration,
          0,
          resource.duration,
        ),
      );
    const end = () => {
      window.removeEventListener("pointermove", pointer);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      cleanup.current = null;
      const selected = activeRef.current;
      setAnchor((selected.start + selected.end) / 2);
    };
    cleanup.current = end;
    window.addEventListener("pointermove", pointer);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }
  function adjustEffect(edge: "start" | "end", value: number) {
    const retained = ranges.find((r) => range.start >= r.start && range.end <= r.end);
    const lower = retained?.start ?? 0;
    const upper = retained?.end ?? resource.duration;
    onRange(edge === "start"
      ? { ...range, start: clamp(value, lower, range.end - 0.1) }
      : { ...range, end: clamp(value, range.start + 0.1, upper) });
  }
  function selectRange(id: string) {
    const r = ranges.find((r) => r.id === id)!;
    setActiveId(id);
    setAnchor((r.start + r.end) / 2);
    setDraft(null);
    onRange({ start: r.start, end: r.end });
    onSeek(r.start);
  }
  const validDraft = draft && draft.end - draft.start >= 0.1;
  const canKeep =
    validDraft &&
    !ranges.some((r) => draft.start < r.end && draft.end > r.start);
  const canExclude =
    validDraft &&
    ranges.some((r) => draft.start < r.end && draft.end > r.start) &&
    ranges.some((r) => r.start < draft.start - 0.1 || r.end > draft.end + 0.1);
  return (
    <div
      className={"source-editor mode-" + mode}
      aria-label={`Edit source ${resource.name}`}
    >
      <div className="source-editor-heading">
        <strong>{resource.name}</strong>
        <span>
          Full source · {time(resource.duration)} · {ranges.length} kept{" "}
          {ranges.length === 1 ? "range" : "ranges"}
        </span>
        <span className="source-mode">
          {mode === "trim"
            ? "Trim source"
            : mode === "speed"
              ? "Select speed range"
              : resource.kind === "audio"
                ? "Zoom unavailable for audio"
                : "Select zoom range"}
        </span>
      </div>
      <div className="source-viewport">
        <div
          ref={strip}
          className="source-strip"
          style={{ left: `${left}%`, width: `${width}%` }}
          onPointerDown={(e) => {
            if (disabled || (mode === "zoom" && resource.kind === "audio"))
              return;
            const rect = e.currentTarget.getBoundingClientRect();
            const start = clamp(
              ((e.clientX - rect.left) / rect.width) * resource.duration,
              0,
              resource.duration,
            );
            if (mode === "trim") setDraft({ start, end: start });
            else onRange({ start, end: start });
            drag(e, (end) => {
              const next = {
                start: Math.min(start, end),
                end: Math.max(start, end),
              };
              if (mode === "trim") setDraft(next);
              else onRange(next);
            });
          }}
        >
          {resource.kind === "video" ? (
            <div
              className="filmstrip"
              style={{
                backgroundImage: resource.thumb
                  ? `url(${resource.thumb})`
                  : "none",
              }}
            />
          ) : (
            <div className="waveform">
              {resource.wave.length ? (
                resource.wave.map((v, i) => (
                  <i key={i} style={{ height: `${Math.max(3, v * 85)}%` }} />
                ))
              ) : (
                <span>Audio source</span>
              )}
            </div>
          )}
          {resource.kind === "video" && resource.wave.length > 0 && (
            <div
              className="video-audio-waveform"
              aria-label="Video audio waveform"
            >
              <svg
                viewBox={`0 0 ${resource.wave.length} 100`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {resource.wave.map((peak, i) => (
                  <line
                    key={i}
                    x1={i + 0.5}
                    x2={i + 0.5}
                    y1={50 - peak * 44}
                    y2={50 + peak * 44}
                  />
                ))}
              </svg>
            </div>
          )}
          {ranges.map((r, i) => {
            const start = i ? ranges[i - 1].end : 0;
            return r.start > start ? (
              <div
                key={`excluded-${i}`}
                className="excluded-source"
                style={{
                  left: `${(start / resource.duration) * 100}%`,
                  width: `${((r.start - start) / resource.duration) * 100}%`,
                }}
              />
            ) : null;
          })}
          {ranges.at(-1)!.end < resource.duration && (
            <div
              className="excluded-source"
              style={{
                left: `${(ranges.at(-1)!.end / resource.duration) * 100}%`,
                width: `${((resource.duration - ranges.at(-1)!.end) / resource.duration) * 100}%`,
              }}
            />
          )}
          {ranges.map((r, i) => (
            <div
              key={r.id}
              className={
                "kept-source-range " + (r.id === active.id ? "active" : "")
              }
              style={{
                left: `${(r.start / resource.duration) * 100}%`,
                width: `${((r.end - r.start) / resource.duration) * 100}%`,
              }}
            >
              <button
                className="source-range-label"
                disabled={disabled}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => selectRange(r.id)}
              >
                Range {i + 1}
              </button>
              {mode === "trim" && (
                <HoverDelete
                  label={
                    ranges.length > 1
                      ? `Remove kept source range ${i + 1}`
                      : "Clear trim"
                  }
                  disabled={disabled}
                  onDelete={() => {
                    onChange(
                      withRanges(
                        clip,
                        ranges.length > 1
                          ? ranges.filter((item) => item.id !== r.id)
                          : [{ id: r.id, start: 0, end: resource.duration }],
                      ),
                    );
                    setDraft(null);
                  }}
                />
              )}
              {mode === "trim" && (
                <>
                  <button
                    aria-label={`Trim start of source range ${i + 1}`}
                    className="source-handle left"
                    disabled={disabled}
                    onPointerDown={(e) => {
                      setActiveId(r.id);
                      setDraft(null);
                      drag(e, (value) =>
                        onChange(
                          trimKeptRange(
                            clip,
                            r.id,
                            "start",
                            value,
                            resource.duration,
                          ),
                        ),
                      );
                    }}
                  >
                    <IconGripVertical size={14} />
                  </button>
                  <button
                    aria-label={`Trim end of source range ${i + 1}`}
                    className="source-handle right"
                    disabled={disabled}
                    onPointerDown={(e) => {
                      setActiveId(r.id);
                      setDraft(null);
                      drag(e, (value) =>
                        onChange(
                          trimKeptRange(
                            clip,
                            r.id,
                            "end",
                            value,
                            resource.duration,
                          ),
                        ),
                      );
                    }}
                  >
                    <IconGripVertical size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
          {mode === "speed" &&
            clip.speeds.map((effect) => (
              <div
                key={effect.id}
                className="source-feature speed-feature"
                style={{
                  left: `${(effect.start / resource.duration) * 100}%`,
                  width: `${((effect.end - effect.start) / resource.duration) * 100}%`,
                }}
              >
                <span className="source-feature-label">{effect.rate}×</span>
                <HoverDelete
                  label={`Remove speed effect ${time(effect.start)}–${time(effect.end)}`}
                  disabled={disabled}
                  onDelete={() =>
                    onChange({
                      ...clip,
                      speeds: clip.speeds.filter((s) => s.id !== effect.id),
                    })
                  }
                />
              </div>
            ))}
          {mode === "zoom" &&
            clip.zooms.map((effect) => (
              <div
                key={effect.id}
                className="source-feature zoom-feature"
                style={{
                  left: `${(effect.start / resource.duration) * 100}%`,
                  width: `${((effect.end - effect.start) / resource.duration) * 100}%`,
                }}
              >
                <span className="source-feature-label">
                  {effect.from}→{effect.to}×
                </span>
                <HoverDelete
                  label={`Remove zoom effect ${time(effect.start)}–${time(effect.end)}`}
                  disabled={disabled}
                  onDelete={() =>
                    onChange({
                      ...clip,
                      zooms: clip.zooms.filter((z) => z.id !== effect.id),
                    })
                  }
                />
              </div>
            ))}
          {selection && selection.end > selection.start && !(mode === "zoom" && resource.kind === "audio") && (
            <div
              className="source-draft"
              style={{
                left: `${(selection.start / resource.duration) * 100}%`,
                width: `${((selection.end - selection.start) / resource.duration) * 100}%`,
              }}
            >
              {mode !== "trim" && (["start", "end"] as const).map((edge) => (
                <button key={edge}
                  aria-label={`${mode === "speed" ? "Speed" : "Zoom"} range ${edge}`}
                  className={`source-handle ${edge === "start" ? "left" : "right"}`}
                  disabled={disabled}
                  onPointerDown={(e) => drag(e, (value) => adjustEffect(edge, value))}>
                  <IconGripVertical size={14} />
                </button>
              ))}
            </div>
          )}
          <div className="source-ticks">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} style={{ left: `${(i / 5) * 100}%` }}>
                {time((i / 5) * resource.duration)}
              </span>
            ))}
          </div>
        </div>
      </div>
      {mode === "trim" ? (
        <div className="source-editor-controls">
          <label>
            Range
            <select
              value={active.id}
              disabled={disabled}
              onChange={(e) => selectRange(e.target.value)}
            >
              {ranges.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          <label>
            In
            <input
              type="number"
              aria-label="Source trim in seconds"
              step=".1"
              value={+active.start.toFixed(2)}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  trimKeptRange(
                    clip,
                    active.id,
                    "start",
                    +e.target.value,
                    resource.duration,
                  ),
                )
              }
            />
            s
          </label>
          <label>
            Out
            <input
              type="number"
              aria-label="Source trim out seconds"
              step=".1"
              value={+active.end.toFixed(2)}
              disabled={disabled}
              onChange={(e) =>
                onChange(
                  trimKeptRange(
                    clip,
                    active.id,
                    "end",
                    +e.target.value,
                    resource.duration,
                  ),
                )
              }
            />
            s
          </label>
          <button
            className="small-button"
            disabled={disabled || !canKeep}
            onClick={() => {
              if (!draft) return;
              const id = uid();
              onChange(withRanges(clip, [...ranges, { id, ...draft }]));
              setActiveId(id);
              setAnchor((draft.start + draft.end) / 2);
              setDraft(null);
            }}
          >
            <IconPlus size={14} />
            Keep range
          </button>
          <button
            className="small-button"
            disabled={disabled || !canExclude}
            onClick={() => {
              if (draft)
                onChange(excludeSourceRange(clip, draft.start, draft.end));
              setDraft(null);
            }}
          >
            <IconCut size={14} />
            Exclude range
          </button>
          <button
            className="icon-button"
            aria-label="Remove selected kept range"
            disabled={disabled || ranges.length < 2}
            onClick={() => {
              onChange(
                withRanges(
                  clip,
                  ranges.filter((r) => r.id !== active.id),
                ),
              );
              setDraft(null);
            }}
          >
            <IconTrash size={15} />
          </button>
          <span>
            {draft
              ? `${time(draft.start)}–${time(draft.end)}`
              : "Drag source handles, or select an area to keep/exclude."}
          </span>
        </div>
      ) : (
        <div className="source-editor-controls">
          <span>
            {mode === "zoom" && resource.kind === "audio"
              ? "Select a video segment for zoom."
              : "Drag the range edges, then apply the settings below."}
          </span>
        </div>
      )}
    </div>
  );
}

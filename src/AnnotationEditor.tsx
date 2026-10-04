import { type Annotation, newAnnotation } from "./annotations";
import { timestampFonts } from "./timestamp";
export function AnnotationEditor({
  items,
  selected,
  onSelect,
  onChange,
  total,
  disabled,
}: {
  items: Annotation[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onChange: (items: Annotation[]) => void;
  total: number;
  disabled: boolean;
}) {
  const a = items.find((a) => a.id === selected);
  function update(change: Partial<Annotation>) {
    if (a)
      onChange(items.map((x) => (x.id === a.id ? { ...a, ...change } : x)));
  }
  return (
    <fieldset className="annotation-settings" disabled={disabled}>
      <button
        className="small-button"
        disabled={disabled || !total}
        onClick={() => {
          const next = newAnnotation(total);
          onChange([...items, next]);
          onSelect(next.id);
        }}
      >
        Add annotation
      </button>
      {items.map((x, i) => (
        <button
          key={x.id}
          className={x.id === selected ? "chosen" : ""}
          onClick={() => onSelect(x.id)}
        >
          {i + 1} · {x.kind}
        </button>
      ))}
      {a && (
        <>
          <select
            aria-label="Annotation type"
            value={a.kind}
            disabled={disabled}
            onChange={(e) =>
              update({ kind: e.target.value as Annotation["kind"] })
            }
          >
            <option value="ellipse">Ellipse</option>
            <option value="rectangle">Rectangle</option>
            <option value="text">Text (Markdown)</option>
          </select>
          {(["start", "end", "x", "y", "w", "h"] as const).map((key) => (
            <label key={key}>
              {
                {
                  start: "From (s)",
                  end: "To (s)",
                  x: "Left (%)",
                  y: "Top (%)",
                  w: "Width (%)",
                  h: "Height (%)",
                }[key]
              }
              <input
                aria-label={`Annotation ${key}`}
                type="number"
                step=".1"
                min="0"
                max={key === "start" || key === "end" ? total : 100}
                value={+a[key].toFixed(2)}
                disabled={disabled}
                onChange={(e) => {
                  const value = Math.max(
                    0,
                    Math.min(
                      +e.target.value,
                      key === "start" || key === "end" ? total : 100,
                    ),
                  );
                  update(
                    key === "x"
                      ? { x: Math.min(value, 100 - a.w) }
                      : key === "y"
                        ? { y: Math.min(value, 100 - a.h) }
                        : key === "w"
                          ? { w: Math.max(0.1, Math.min(value, 100 - a.x)) }
                          : key === "h"
                            ? { h: Math.max(0.1, Math.min(value, 100 - a.y)) }
                            : { [key]: value },
                  );
                }}
              />
            </label>
          ))}
          <label>
            Color
            <input
              type="color"
              value={a.color}
              onChange={(e) => update({ color: e.target.value })}
            />
          </label>
          {a.kind === "text" ? (
            <>
              <textarea
                aria-label="Annotation Markdown"
                value={a.text}
                onChange={(e) => update({ text: e.target.value })}
              />
              <label>
                Font size
                <input
                  aria-label="Annotation font size"
                  type="number"
                  min="8"
                  max="144"
                  value={a.fontSize}
                  onChange={(e) =>
                    update({
                      fontSize: Math.max(8, Math.min(144, +e.target.value)),
                    })
                  }
                />
              </label>
              <select
                aria-label="Annotation font family"
                value={a.fontFamily}
                onChange={(e) =>
                  update({
                    fontFamily: e.target.value as Annotation["fontFamily"],
                  })
                }
              >
                {Object.entries(timestampFonts).map(([id, f]) => (
                  <option key={id} value={id}>
                    {f.label}
                  </option>
                ))}
              </select>
              {(["bold", "italic", "background"] as const).map((key) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={a[key]}
                    onChange={(e) => update({ [key]: e.target.checked })}
                  />
                  {key}
                </label>
              ))}
            </>
          ) : (
            <>
              <label>
                Stroke
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={a.stroke}
                  onChange={(e) =>
                    update({
                      stroke: Math.max(1, Math.min(20, +e.target.value)),
                    })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={a.fill}
                  onChange={(e) => update({ fill: e.target.checked })}
                />
                Fill
              </label>
            </>
          )}
          <button
            className="small-button"
            onClick={() => {
              onChange(items.filter((x) => x.id !== a.id));
              onSelect(null);
            }}
          >
            Delete annotation
          </button>
        </>
      )}
    </fieldset>
  );
}

import { useRef, useState, useEffect } from "react";
import { type Annotation, annotationBox } from "./annotations";
import { clamp } from "./model";
export function AnnotationSurface({
  items,
  selected,
  onSelect,
  onChange,
  position,
  disabled,
}: {
  items: Annotation[];
  selected: string | null;
  onSelect: (id: string) => void;
  onChange: (items: Annotation[]) => void;
  position: number;
  disabled: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    [fit, setFit] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = host.current!;
    const observer = new ResizeObserver(() => {
      const r = el.getBoundingClientRect(),
        w = Math.min(r.width, (r.height * 16) / 9);
      setFit({ width: w, height: (w * 9) / 16 });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const active = items.find((a) => a.id === selected);
  const drag = useRef<{
    a: Annotation;
    x: number;
    y: number;
    resize: boolean;
  } | null>(null);
  return (
    <div ref={host} className="annotation-host">
      <div
        className="annotation-surface"
        style={fit}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const rect = e.currentTarget.getBoundingClientRect(),
            p = drag.current;
          const dx = ((e.clientX - p.x) / rect.width) * 100,
            dy = ((e.clientY - p.y) / rect.height) * 100;
          const box = p.resize
            ? annotationBox(
                p.a.x,
                p.a.y,
                clamp(p.a.x + p.a.w + dx, 0, 100),
                clamp(p.a.y + p.a.h + dy, 0, 100),
                e.shiftKey,
              )
            : {
                ...p.a,
                x: clamp(p.a.x + dx, 0, 100 - p.a.w),
                y: clamp(p.a.y + dy, 0, 100 - p.a.h),
              };
          onChange(
            items.map((a) =>
              a.id === p.a.id
                ? {
                    ...a,
                    ...box,
                    w: Math.max(0.1, box.w),
                    h: Math.max(0.1, box.h),
                  }
                : a,
            ),
          );
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        {items
          .filter((a) => position >= a.start && position < a.end)
          .map((a) => (
            <div
              key={a.id}
              className={
                "annotation-hit " + (active?.id === a.id ? "selected" : "")
              }
              style={{
                left: `${a.x}%`,
                top: `${a.y}%`,
                width: `${a.w}%`,
                height: `${a.h}%`,
              }}
              onPointerDown={(e) => {
                if (disabled) return;
                e.preventDefault();
                onSelect(a.id);
                drag.current = { a, x: e.clientX, y: e.clientY, resize: false };
                e.currentTarget.parentElement!.setPointerCapture(e.pointerId);
              }}
            >
              {active?.id === a.id && (
                <button
                  aria-label="Resize annotation"
                  className="annotation-resize"
                  onPointerDown={(e) => {
                    if (disabled) return;
                    e.preventDefault();
                    e.stopPropagation();
                    drag.current = {
                      a,
                      x: e.clientX,
                      y: e.clientY,
                      resize: true,
                    };
                    e.currentTarget.parentElement!.parentElement!.setPointerCapture(
                      e.pointerId,
                    );
                  }}
                />
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

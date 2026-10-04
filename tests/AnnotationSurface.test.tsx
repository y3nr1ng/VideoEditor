// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { AnnotationSurface } from "../src/AnnotationSurface";
import { newAnnotation } from "../src/annotations";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("resizes a shape to physical 1:1 with Shift while retaining timing", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.PointerEvent = MouseEvent as typeof PointerEvent;
  const a = { ...newAnnotation(5), x: 10, y: 10, w: 20, h: 30 };
  const change = vi.fn();
  const { container } = render(
    <AnnotationSurface
      items={[a]}
      selected={a.id}
      onSelect={() => {}}
      onChange={change}
      position={1}
      disabled={false}
    />,
  );
  const surface = container.querySelector(".annotation-surface") as HTMLElement;
  surface.setPointerCapture = vi.fn();
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 1600,
    height: 900,
  } as DOMRect);
  fireEvent.pointerDown(screen.getByLabelText("Resize annotation"), {
    clientX: 480,
    clientY: 360,
    pointerId: 1,
  });
  fireEvent.pointerMove(surface, {
    clientX: 640,
    clientY: 500,
    shiftKey: true,
    pointerId: 1,
  });
  const next = change.mock.calls.at(-1)[0][0];
  expect((next.w * 16) / 9).toBeCloseTo(next.h);
  expect(next.start).toBe(0);
  expect(next.end).toBe(5);
});

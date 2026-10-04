// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { SourceEditor } from "../src/SourceEditor";
import { type Clip, type Resource } from "../src/model";
const clip: Clip = {
  id: "c",
  resourceId: "r",
  in: 0,
  out: 10,
  crop: { x: 0, y: 0, w: 100, h: 100 },
  speeds: [],
  zooms: [],
};
const resource: Resource = {
  id: "r",
  name: "source.mp4",
  file: new File([], "source.mp4"),
  url: "",
  kind: "video",
  duration: 10,
  width: 320,
  height: 180,
  crop: clip.crop,
  wave: [],
};
const props = {
  clip,
  resource,
  mode: "trim" as const,
  disabled: false,
  range: { start: 0, end: 10 },
  onRange: vi.fn(),
  onChange: vi.fn(),
  onSeek: vi.fn(),
};
afterEach(cleanup);
beforeAll(() => {
  window.PointerEvent = MouseEvent as typeof PointerEvent;
});
describe("source-context editor", () => {
  it("shows trim controls exclusively in trim mode", () => {
    const { rerender } = render(<SourceEditor {...props} />);
    expect(
      screen.getByRole("button", { name: "Trim start of source range 1" }),
    ).toBeTruthy();
    rerender(<SourceEditor {...props} mode="speed" />);
    expect(screen.queryByRole("button", { name: /Trim start/ })).toBeNull();
    expect(screen.queryByLabelText("Source trim in seconds")).toBeNull();
    rerender(<SourceEditor {...props} mode="zoom" />);
    expect(screen.queryByRole("button", { name: /Trim start/ })).toBeNull();
  });
  it.each(["video", "audio"] as const)(
    "supports excluding a middle range from %s and retains the entire source row",
    (kind) => {
      function Harness() {
        const [c, setC] = useState(clip);
        return (
          <SourceEditor
            {...props}
            resource={{ ...resource, kind }}
            clip={c}
            onChange={setC}
          />
        );
      }
      const { container } = render(<Harness />);
      const strip = container.querySelector(".source-strip")!;
      vi.spyOn(strip, "getBoundingClientRect").mockReturnValue({
        left: 0,
        width: 1000,
      } as DOMRect);
      fireEvent.pointerDown(strip, { clientX: 300 });
      fireEvent.pointerMove(window, { clientX: 700 });
      fireEvent.pointerUp(window, { clientX: 700 });
      fireEvent.click(screen.getByRole("button", { name: "Exclude range" }));
      expect(
        screen.getByText("Full source · 00:10.0 · 2 kept ranges"),
      ).toBeTruthy();
      expect(container.querySelectorAll(".excluded-source")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Range 2" })).toBeTruthy();
      expect(screen.getByLabelText("Source trim in seconds")).toHaveProperty(
        "value",
        "0",
      );
    },
  );
  it("restores an additional kept interval without changing the original range", () => {
    function Harness() {
      const [c, setC] = useState({ ...clip, in: 0, out: 2 });
      return <SourceEditor {...props} clip={c} onChange={setC} />;
    }
    const { container } = render(<Harness />);
    const strip = container.querySelector(".source-strip")!;
    vi.spyOn(strip, "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 1000,
    } as DOMRect);
    fireEvent.pointerDown(strip, { clientX: 600 });
    fireEvent.pointerMove(window, { clientX: 800 });
    fireEvent.pointerUp(window);
    fireEvent.click(screen.getByRole("button", { name: "Keep range" }));
    expect(
      screen.getByText("Full source · 00:10.0 · 2 kept ranges"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Source trim in seconds")).toHaveProperty(
      "value",
      "6",
    );
    expect(screen.getByLabelText("Source trim out seconds")).toHaveProperty(
      "value",
      "8",
    );
  });
  it.each(["speed", "zoom"] as const)(
    "hover deletion removes only the %s feature",
    (mode) => {
      const speed = { id: "s", start: 1, end: 2, rate: 2 },
        zoom = { id: "z", start: 4, end: 5, from: 1, to: 2, x: 50, y: 50 };
      const onChange = vi.fn();
      render(
        <SourceEditor
          {...props}
          mode={mode}
          clip={{ ...clip, speeds: [speed], zooms: [zoom] }}
          onChange={onChange}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", {
          name: mode === "speed" ? /Remove speed effect/ : /Remove zoom effect/,
        }),
      );
      const result = onChange.mock.calls[0][0] as Clip;
      expect(result.resourceId).toBe(clip.resourceId);
      expect(result.in).toBe(0);
      expect(result.out).toBe(10);
      expect(result.speeds).toEqual(mode === "speed" ? [] : [speed]);
      expect(result.zooms).toEqual(mode === "zoom" ? [] : [zoom]);
    },
  );
  it("clears the last trim without deleting the source or clip", () => {
    const onChange = vi.fn();
    render(
      <SourceEditor
        {...props}
        clip={{ ...clip, in: 2, out: 8 }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear trim" }));
    const result = onChange.mock.calls[0][0] as Clip;
    expect(result.id).toBe(clip.id);
    expect(result.in).toBe(0);
    expect(result.out).toBe(10);
  });
  it("shows embedded audio over video but omits it for silent sources", () => {
    const { rerender } = render(
      <SourceEditor
        {...props}
        resource={{ ...resource, wave: [0.1, 0.5, 0.9] }}
      />,
    );
    expect(screen.getByLabelText("Video audio waveform")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Trim start of source range 1" }),
    ).toBeTruthy();
    rerender(<SourceEditor {...props} />);
    expect(screen.queryByLabelText("Video audio waveform")).toBeNull();
  });
  it("centers the selected kept range while keeping both ends of the source visible", () => {
    const c = {
      ...clip,
      in: 2,
      out: 9,
      ranges: [
        { id: "a", start: 2, end: 3 },
        { id: "b", start: 7, end: 9 },
      ],
    };
    const { container } = render(<SourceEditor {...props} clip={c} />);
    fireEvent.click(screen.getByRole("button", { name: "Range 2" }));
    const strip = container.querySelector(".source-strip") as HTMLElement;
    const left = parseFloat(strip.style.left),
      width = parseFloat(strip.style.width);
    expect(left + width * 0.8).toBeCloseTo(50);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(left + width).toBeLessThanOrEqual(100);
  });
});

it.each(["speed", "zoom"] as const)("adjusts %s selection with trim-style handles without trimming the clip", (mode) => {
  const change = vi.fn();
  function Harness() {
    const [range, setRange] = useState({ start: 2, end: 8 });
    return <SourceEditor {...props} mode={mode} clip={{ ...clip, in: 1, out: 9 }} range={range} onRange={setRange} onChange={change} />;
  }
  const { container } = render(<Harness />);
  vi.spyOn(container.querySelector(".source-strip")!, "getBoundingClientRect").mockReturnValue({ left: 0, width: 1000 } as DOMRect);
  const label = mode === "speed" ? "Speed" : "Zoom";
  fireEvent.pointerDown(screen.getByLabelText(`${label} range start`), { clientX: 200 });
  fireEvent.pointerMove(window, { clientX: 0 });
  fireEvent.pointerUp(window);
  const selection = container.querySelector(".source-draft") as HTMLElement;
  expect(selection.style.left).toBe("10%");
  fireEvent.pointerDown(screen.getByLabelText(`${label} range end`), { clientX: 800 });
  fireEvent.pointerMove(window, { clientX: 1000 });
  fireEvent.pointerUp(window);
  expect(selection.style.width).toBe("80%");
  expect(change).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: /Trim start/ })).toBeNull();
});
it.each(["speed", "zoom"] as const)("selects an applied %s feature without changing or deleting it", (mode) => {
  const select = vi.fn(), change = vi.fn();
  const c = { ...clip, speeds: [{ id: "speed", start: 2, end: 6, rate: 2 }], zooms: [{ id: "zoom", start: 2, end: 6, from: 1, to: 2, x: 50, y: 50 }] };
  const { container } = render(<SourceEditor {...props} mode={mode} clip={c} range={{ start: 2, end: 6 }} onSelectFeature={select} onChange={change} />);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`Select ${mode} feature`) }));
  expect(select).toHaveBeenCalledWith(mode, mode);
  expect(change).not.toHaveBeenCalled();
  expect(container.querySelectorAll(".feature-outside")).toHaveLength(2);
  expect(container.querySelector(".feature-selection")).toBeTruthy();
});

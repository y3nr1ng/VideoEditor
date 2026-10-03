// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { LibraryDropRegion } from "../src/LibraryDropRegion";
afterEach(cleanup);
const fileDrag = { dataTransfer: { types: ["Files"] } };
it("shows hint over existing media and keeps it visible between nested drag targets", () => {
  const drop = vi.fn();
  const { container } = render(
    <LibraryDropRegion disabled={false} onDragOver={vi.fn()} onDrop={drop}>
      <button>Existing media</button>
    </LibraryDropRegion>,
  );
  const region = container.querySelector("section")!,
    child = screen.getByRole("button");
  fireEvent.dragEnter(region, fileDrag);
  expect(screen.getByRole("status").textContent).toBe("Drop media here");
  fireEvent.dragEnter(child, fileDrag);
  fireEvent.dragLeave(child, fileDrag);
  expect(screen.getByRole("status")).toBeTruthy();
  fireEvent.drop(region, fileDrag);
  expect(drop).toHaveBeenCalledOnce();
  expect(screen.queryByRole("status")).toBeNull();
});
it("clears hint when files leave the region or dragging ends", () => {
  const { container } = render(
    <LibraryDropRegion
      disabled={false}
      onDragOver={vi.fn()}
      onDrop={vi.fn()}
    />,
  );
  const region = container.querySelector("section")!;
  fireEvent.dragEnter(region, fileDrag);
  fireEvent.dragLeave(region, fileDrag);
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.dragEnter(region, fileDrag);
  fireEvent.dragEnd(window);
  expect(screen.queryByRole("status")).toBeNull();
});
it("ignores internal drags and disabled imports", () => {
  const { container, rerender } = render(
    <LibraryDropRegion
      disabled={false}
      onDragOver={vi.fn()}
      onDrop={vi.fn()}
    />,
  );
  const region = container.querySelector("section")!;
  fireEvent.dragEnter(region, {
    dataTransfer: { types: ["application/localcut-resource"] },
  });
  expect(screen.queryByRole("status")).toBeNull();
  rerender(
    <LibraryDropRegion disabled onDragOver={vi.fn()} onDrop={vi.fn()} />,
  );
  fireEvent.dragEnter(region, fileDrag);
  expect(screen.queryByRole("status")).toBeNull();
});

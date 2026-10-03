// @vitest-environment jsdom
import { render, fireEvent, screen, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { HoverDelete } from "../src/HoverDelete";
afterEach(cleanup);
it("deletes without starting a parent drag, click, or keyboard selection", () => {
  const remove = vi.fn(),
    pointer = vi.fn(),
    click = vi.fn(),
    key = vi.fn();
  render(
    <div onPointerDown={pointer} onClick={click} onKeyDown={key}>
      <HoverDelete
        label="Delete video segment"
        disabled={false}
        onDelete={remove}
      />
    </div>,
  );
  const button = screen.getByRole("button", { name: "Delete video segment" });
  fireEvent.pointerDown(button);
  fireEvent.keyDown(button, { key: "Enter" });
  fireEvent.click(button);
  expect(remove).toHaveBeenCalledOnce();
  expect(pointer).not.toHaveBeenCalled();
  expect(click).not.toHaveBeenCalled();
  expect(key).not.toHaveBeenCalled();
  expect(button.textContent).toBe("");
});
it("blocks deletion while exporting", () => {
  const remove = vi.fn();
  render(<HoverDelete label="Delete segment" disabled onDelete={remove} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete segment" }));
  expect(remove).not.toHaveBeenCalled();
});

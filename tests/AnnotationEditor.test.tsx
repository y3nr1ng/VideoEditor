// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { it, expect, vi, afterEach } from "vitest";
import { AnnotationEditor } from "../src/AnnotationEditor";
import { newAnnotation } from "../src/annotations";
afterEach(cleanup);
it("defaults to an ellipse and exposes Markdown typography controls for text", () => {
  const a = newAnnotation(5);
  expect(a.kind).toBe("ellipse");
  const change = vi.fn(),
    select = vi.fn();
  const { rerender } = render(
    <AnnotationEditor
      items={[a]}
      selected={a.id}
      onSelect={select}
      onChange={change}
      total={5}
      disabled={false}
    />,
  );
  fireEvent.change(screen.getByLabelText("Annotation type"), {
    target: { value: "text" },
  });
  expect(change.mock.calls[0][0][0].kind).toBe("text");
  rerender(
    <AnnotationEditor
      items={[{ ...a, kind: "text" }]}
      selected={a.id}
      onSelect={select}
      onChange={change}
      total={5}
      disabled={false}
    />,
  );
  fireEvent.change(screen.getByLabelText("Annotation Markdown"), {
    target: { value: "**Scan** *tissue*" },
  });
  expect(change.mock.calls.at(-1)[0][0].text).toBe("**Scan** *tissue*");
  fireEvent.click(screen.getByLabelText("italic"));
  expect(change.mock.calls.at(-1)[0][0].italic).toBe(true);
  expect(screen.getByLabelText("Annotation font size")).toBeTruthy();
  expect(screen.getByLabelText("Annotation font family")).toBeTruthy();
});

import { it, expect } from "vitest";
import { annotationBox, markdownRuns } from "./annotations";
it("constrains Shift resize to a physical 1:1 shape in a 16:9 frame", () => {
  const box = annotationBox(10, 10, 40, 70, true);
  expect((box.w * 16) / 9).toBeCloseTo(box.h);
  expect(box.x + box.w).toBeLessThanOrEqual(40);
  expect(box.y + box.h).toBeLessThanOrEqual(70);
  const reverse = annotationBox(40, 70, 10, 10, true);
  expect((reverse.w * 16) / 9).toBeCloseTo(reverse.h);
});
it("keeps nested Markdown emphasis, headings and code in rich text runs", () => {
  const runs = markdownRuns(
    "# Title\n\n**bold and *italic*** plus `code`\n\n- item",
  ).flat();
  expect(runs.some((r) => r.text === "Title" && r.scale > 1)).toBe(true);
  expect(runs.some((r) => r.text === "italic" && r.bold && r.italic)).toBe(
    true,
  );
  expect(runs.some((r) => r.text === "code" && r.code)).toBe(true);
  expect(runs.some((r) => r.text === "• ")).toBe(true);
});
it("omits HTML and remote images without fetching any content", () => {
  expect(markdownRuns("![image](https://example.com/a.png)").flat()).toEqual(
    [],
  );
  expect(markdownRuns("<script>alert(1)</script>").flat()).toEqual([]);
});

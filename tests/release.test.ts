import { it, expect } from "vitest";
// @ts-expect-error Release automation runs directly as a Node module.
import { nextVersion } from "../scripts/release.mjs";
it("bumps the requested level and resets lower components", () => {
  expect(nextVersion("v1.2.3", ["Fix playback +semver: patch"])).toBe("v1.2.4");
  expect(nextVersion("v1.2.3", ["Add track\n\n+semver: minor"])).toBe("v1.3.0");
  expect(nextVersion("v1.2.3", ["Change format +semver: major"])).toBe("v2.0.0");
});
it("takes the highest directive across commits, regardless of order", () => {
  expect(nextVersion("v0.1.0", ["+semver: minor", "+semver: patch", "+semver: none"])).toBe("v0.2.0");
});
it("does not release unmarked changes and supports reruns with no new commits", () => {
  expect(nextVersion("v0.1.0", ["Update docs"])).toBeNull();
  expect(nextVersion("v0.1.0", [])).toBeNull();
  expect(nextVersion("v0.1.0", ["+semver: none"])).toBeNull();
});

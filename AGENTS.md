# Project instructions

## GitHub tracking

- Always use GitHub issues to track features, bugs, implementation progress, and especially design choices.
- Always label issues when creating them, and update labels when scope changes. Use `bug` for defects, `enhancement` for features, `design` for UI/interaction decisions, `testing` for verification or fixtures, `documentation` for documentation work, and `maintenance` for tooling/repository workflow. Apply multiple relevant labels when appropriate.
- This is a solo-developer project. Do not add contributor-recruitment labels such as `good first issue` or `help wanted`. Keep the label set small and useful; use GitHub open/closed status rather than redundant status labels.
- Before substantial work, create or identify the relevant issue. Keep it updated with scope, decisions, progress, validation, and remaining limitations.
- Link related issues in pull requests and final handoffs. Close an issue only when its acceptance criteria are met; keep unresolved work explicit.
- If GitHub access is unavailable, report the blocker and keep a local record until it can be posted. Do not silently skip tracking.

## Product requirements

- This is a single-page local browser video editor, using Tailwind CSS and Tabler icons.
- Keep imported media and all media processing on the user's device. Network access may download application assets and the FFmpeg WebAssembly engine; never upload media.
- Preserve the layout: resources at top left, preview at top right, timeline across the bottom.
- Keep the interface compact: no global title bar; Export belongs in the Preview heading. Use small corner radii (up to 3px for rectangular surfaces), and omit repeated privacy/local-processing slogans and badges.
- When empty, the library body is a full-size clickable media drop target. External file drags show a floating overlay only over the resources area below the header, even with existing media; keep the title, Import, and view buttons unobscured; internal resource drags should not show the import overlay.
- Use concise functional interface copy only. Do not add encouraging, motivational, promotional, or decorative slogans in empty states, panel headings, dialogs, statuses, or help text.
- Use cool charcoal/blue-gray surfaces with restrained pale-blue accents, 6px panel gaps, and compact outer padding.
- Selected video source rows overlay real embedded-audio waveforms translucently over thumbnails, below trim masks and editing controls. Extract peaks locally; omit the overlay for silent video.
- Selecting a video/audio timeline segment expands a full-source row beneath its track. Keep the entire source visible and center the selected retained range, with excluded parts dimmed. Support multiple kept intervals per clip; playback/export concatenate them in source order. Trim handles/fields belong only to Trim mode; Speed/Zoom expose their own effect actions.
- Fit the editor to the viewport without page scrollbars; bound overflow to content panels and hide scrollbar chrome without disabling wheel/touch access.
- Timestamp overlays count elapsed edited-video time in HH:MM:SS, default to the whole timeline, and offer edited-time ranges, placement, numeric output-pixel font size, font family, bold, and background controls. Use the same bundled open-license font faces in preview/export.
- Support draggable trim edges, selected speed ranges, resource cropping before insertion, gradual zoom ranges, common export formats, and optional audio removal.
- Mark PowerPoint-recommended H.264/AAC MP4 with a PPTX badge. The badge indicates video compatibility, not presentation-file output.
- Document technical limitations and consequential design decisions in GitHub issues and the README.

## Development

- Use `npm run dev` for the local editor, `npm run build` for production verification, and `npm test` for meaningful timeline/export logic checks.
- Keep dependencies and generated output ignored; commit source and lockfiles.
- Use local fixture media for verification; do not add private media to the repository.
- Keep `test-media` folders exclusively for media resources. Store README files, source metadata, scripts, and other non-media files outside them.
- Commit completed work in focused chunks with brief imperative commit messages. Record consequential commit references in the relevant GitHub issues.
- Use trim-style draggable start/end handles and a shaded selection for speed and zoom ranges. Effect handles adjust effect selection only, never source trim.
- Crop frames use eight resize handles: four corners and four edge midpoints; dragging inside moves the frame. Crop changes store metadata only.
- Add `+semver: major`, `+semver: minor`, or `+semver: patch` to commits that warrant a release. The highest directive since the last release wins; omit it for changes that do not need a release. Releases are tagged after successful CI and deployment.
- Library Crop buttons share the same transparent icon-only styling in all views; detail view only enlarges the icon/hit target and places it on the right.
- Resource thumbnails show uppercase file-format badges (MP4, MP3, AVI, etc.) rather than media-kind icon badges. Omit library plus buttons; insert resources by dragging onto tracks.
- Crop dialog uses the title “Crop the resource”, no subtitle/hint/reset, normal text sizing, compact Left/Top and Width/Height groups, and an always-selected %/px toggle. Wheel zoom ranges from full source to crop-fit view; units use original source dimensions and neither creates processed files.
- Use the shared `--radius-ui` (3px) for all buttons and rectangular interface surfaces; do not introduce separate radius rules for individual controls. Circular decorative markers can remain circular.
- Media Library, Preview, and Timeline headers share `--panel-header-height` (56px desktop, 80px narrow viewport), with consistent vertical alignment.
- Refer to trim, speed, zoom, and timestamp as features. Feature buttons sit in a left sidebar spanning timeline height, with settings below. Selecting applied speed/zoom intervals loads their settings for updating; X deletes. Selected feature ranges display normally with areas outside dimmed.
- Use exactly three interface font-size tokens: `--text-small` (12px) for secondary metadata, `--text-normal` (16px) for body/settings/controls, and `--text-large` (20px) for main headings. Keep those levels at every viewport size. Align padding/gaps and control heights with their line boxes. Timestamp output font size remains independently configurable.
- Feature button selection indicates the active settings panel, independently of whether an effect or timestamp is enabled; highlight only one feature at a time.
- Do not repeat the selected resource filename in the left feature settings panel; the source row already identifies it.

# Localcut / VideoEditor

I routinely record screens and small experiments, then need a quick edit for a slide. Online editors make it awkward, and FFmpeg gets the job done—but I used to live in its manual, and now I keep asking an LLM, “How do I do this in FFmpeg?” Installing Premiere on an office desktop just to crop, resize, speed up, and timestamp a tissue scan feels like bringing a film crew to a lab bench.

So here we are: a single-page editor that turns a growing list of edits into FFmpeg commands and runs them locally in your browser through WebAssembly. The engine can be cached by the browser; your recordings stay on your device. Crop now, export later—no pile of temporary cropped videos.

Built with React, Tailwind CSS, and Tabler icons. Resources sit at top left, the preview at top right, and the timeline spans the bottom.

[Open the editor](https://y3nr1ng.github.io/VideoEditor/)

## Run locally

Use Node 22.12+ (or Node 20.19+).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173/. The dev server binds to localhost. `npm run build` creates a static application in `dist/`; serve it over HTTP or HTTPS rather than opening the HTML with `file://`.

## Editing

1. Import supported local video/audio files, or drop them anywhere on the library panel. Dropping an external file directly on its matching timeline track imports and inserts it in one step.
2. Use the crop icon on a video resource before adding it. Move the crop frame or resize it with any of its eight corner/edge handles. Scrub the seek bar or use start, play/pause, and end to inspect frames; Apply crop stores coordinates only; numerical percentages are also available. Existing timeline clips retain their own crop.
3. Click a resource's + button or drag it onto the matching track. Video clips append in sequence. Audio clips overlay from time zero.
4. Select a timeline segment to expand its full-source editing row beneath the video or audio track. The entire source stays visible, centered on the selected kept range, with excluded areas dimmed. Videos with audio show translucent waveform lines over the source thumbnails; peaks are decoded locally when the video is first selected. In **Trim** mode, drag source-range edges or edit in/out seconds. Drag across the source and choose **Keep range** to restore another interval, or **Exclude range** to cut out an interval (including a middle section). Multiple kept ranges play/export in source order within the same timeline clip.
5. Select **Speed range** or **Zoom range**, use the trim-style start/end handles in the source row, or drag within a kept interval to choose an effect range, adjust the settings, and click **Apply**. The range fields always use original source seconds. Trim handles and trim fields appear only in Trim mode; Speed and Zoom modes expose only their own range actions. Zoom is video-only. Click an applied effect's chip to remove it.
6. Hover a timeline clip to reveal its top-right × button, which removes that clip. In the selected source row, hover a speed or zoom interval to remove only that effect. In Trim mode, × removes a kept interval; on the last interval it clears the trim and restores the full source. These controls also appear on keyboard focus and touch devices.
7. Use the ruler/playhead to seek, and Space to play/pause. Arrow keys step by 0.1 seconds.
8. Export MP4, MOV, or WebM at 480p, 720p, or 1080p. Audio removal applies to preview and export.

MP4 uses H.264 video, yuv420p, and AAC audio, with fast-start metadata. Its **PPTX** badge reflects [Microsoft's recommended PowerPoint video format](https://support.microsoft.com/en-us/powerpoint/video-and-audio-file-formats-supported-in-powerpoint); output is a video file, not a presentation. MOV uses H.264/AAC; WebM uses VP8/Opus. All output is 16:9, letterboxed as needed, at 30 fps.

## Timestamp overlay

Click **Timestamp** in the timeline toolbar to add an elapsed-time overlay in `HH:MM:SS` format. It covers the entire edited timeline by default and automatically follows duration changes. Uncheck **Entire timeline** to specify an edited-time range. Choose a corner/bottom-center position, numeric font size in output pixels (8–144), regular/bold, background on/off, and Roboto, Roboto Mono, or Noto Serif. The selected open-license font face is bundled locally and used for both canvas preview and burned-in FFmpeg exports. Remove the overlay with its timeline range’s hover ×.

The timestamp counts final edited playback time, including speed changes and concatenated kept intervals; it does not reset per source clip. Timestamp exports re-encode the final video to draw the text.

## Workspace sizing

The editor fills the viewport without page-level horizontal or vertical scrolling. Resource lists, timeline details, and dialogs can scroll internally when their content exceeds the available space; scrollbar chrome is hidden, and wheel/touch scrolling remains available. At default timeline zoom the timeline fits the available panel width.

## Privacy and processing

Files are read through browser File APIs and object URLs. FFmpeg runs in a local worker using an in-memory filesystem. Inputs, intermediate segments, metadata, and output are removed from that filesystem after each export. The application has no upload endpoint, telemetry, account, or media-processing server.

The application assets are served by the static website; timestamp font files are served from the application itself. FFmpeg downloads when first needed for export or the video-audio waveform fallback, using the pinned single-thread `@ffmpeg/core@0.12.10` JavaScript and WASM from jsDelivr (approximately 32 MB). The npm-installed FFmpeg wrapper/worker is bundled with the application. Media bytes never form part of a network request. `@ffmpeg/core` is also installed as a development dependency for integration tests; its WASM is not bundled into the production application.

## Technical choices and limits

- **Performance and memory:** single-thread FFmpeg WASM trades speed for simple hosting without cross-origin isolation headers. It is substantially slower than native FFmpeg, and multiple copies of media/frames can consume significant memory. Start with short 720p footage. Large or 4K files can exhaust browser memory; cancellation terminates the worker and releases its engine memory. Multithreading would require SharedArrayBuffer and COOP/COEP headers, plus a deployment/browser compatibility decision.
- **Browser input codecs:** native browser decoding supplies metadata and preview. A codec may be supported by FFmpeg but unavailable in the browser; this version rejects those inputs with a conversion message. A future FFmpeg proxy-preview workflow could support them, at an added processing/memory cost.
- **Preview versus export:** preview uses native media playback plus canvas crop, letterboxing, and zoom. Export independently renders with FFmpeg at 30 fps. Browser seeking, playback rate, and segment/frame rounding can differ slightly; the exported video is authoritative.
- **Range behavior:** each clip may retain multiple non-overlapping source intervals; gaps are skipped in playback and export, including audio. Speed and zoom ranges use source seconds and must fit within a single retained interval. Ranges of the same effect cannot overlap. Trimming across an effect boundary removes that effect rather than silently rewriting it. Rates range from 0.25× to 4×, with chained `atempo` filters preserving audio pitch.
- **Zoom:** linear scale interpolation uses a fixed configurable X/Y focal point within a range, clamped at frame edges. Zoom resets to 1× outside the range. Persistent keyframes/eased motion and moving focal points would be a separate design choice.
- **Tracks:** video forms one sequential track; separate audio clips all start at zero and are mixed without normalization. There is no free placement, audio gain control, transitions, clip reordering, or audio-only export in this first version.
- **Project lifetime:** edits and imported media stay in memory. Reloading clears the project. No automatic project saving or backend storage is used.
- **FFmpeg quirk:** core 0.12.10's successful ffprobe call can return -1; the engine accepts that sentinel and requires parseable stream metadata. Encoding commands must still return zero.

## Verification

```sh
npm test
npm run build
npm run test:media
```

`npm test` also verifies source-row trim-mode exclusivity, exclusion/restoration interactions for video and audio, and centering while keeping the full source visible. It covers timeline splitting, retimed duration, reversible source/output mapping, zoom interpolation, range validation, and audio tempo chains. Media integration tests are opt-in via `npm run test:media`; they require native `ffmpeg` and `ffprobe` to generate local fixtures and inspect output, while the rendering itself runs through the actual single-thread WASM core. Fixtures and output live in ignored `.local/`.

Integration coverage includes multiple retained intervals for video and audio, crop, speed, gradual zoom, video concatenation, audio mixing including 0.25× slow motion, silent-source audio padding, H.264/AAC MP4, and silent WebM/MOV exports, and actual timestamp burn-in with regular/bold font faces. The browser worker transport and full mouse interactions still require a browser smoke test; the initial layout was visually checked in Chrome.

## CI and deployment

GitHub Actions runs the unit/UI tests, real FFmpeg WebAssembly media tests, and production build for pushes and pull requests. Successful `main` builds deploy `dist/` to GitHub Pages automatically. Generated files are deployment artifacts, not committed build output. GitHub hosts the editor assets; media processing still runs entirely on your device.

## Tracking

[Issue #1: feature scope, progress, and design decisions](https://github.com/y3nr1ng/VideoEditor/issues/1). [Issue #2: FFmpeg probe return-value handling](https://github.com/y3nr1ng/VideoEditor/issues/2).

Follow [AGENTS.md](AGENTS.md): use GitHub issues for features, bugs, progress, and design decisions. Keep unresolved validation or limitations explicit.

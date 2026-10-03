# Localcut / VideoEditor

[![CI](https://github.com/y3nr1ng/VideoEditor/actions/workflows/pages.yml/badge.svg)](https://github.com/y3nr1ng/VideoEditor/actions/workflows/pages.yml)
[![Release](https://img.shields.io/github/v/release/y3nr1ng/VideoEditor)](https://github.com/y3nr1ng/VideoEditor/releases/latest)

I routinely record screens and small experiments, then need a quick edit for a slide. Online editors make it awkward, and FFmpeg gets the job done—but I used to live in its manual, and now I keep asking an LLM, “How do I do this in FFmpeg?” Installing Premiere on an office desktop just to crop, resize, speed up, and timestamp a tissue scan feels like bringing a film crew to a lab bench.

So here we are: a single-page editor that turns a growing list of edits into FFmpeg commands and runs them locally in your browser through WebAssembly. The engine can be cached by the browser; your recordings stay on your device. Crop now, export later—no pile of temporary cropped videos.

[Open the editor](https://y3nr1ng.github.io/VideoEditor/)

## Limitations

- Best for short recordings. Large or 4K videos can be slow or exceed browser memory.
- Your browser must support the input video format. Preview timing may differ slightly from the final export.
- Reloading clears your work; projects are not saved yet.
- Basic editing only: no transitions, clip reordering, or freely positioned audio. Exports are 16:9 at 30 fps.

## Development

Built with React, TypeScript, Vite, Tailwind CSS, Tabler icons, and FFmpeg WebAssembly. Use Node 22.12+; full media tests also require native `ffmpeg` and `ffprobe` for fixture generation and output inspection.

```sh
npm ci
npm run dev         # http://127.0.0.1:5173/
npm test            # logic and UI tests
npm run test:media  # real WASM export tests
npm run build       # static site in dist/
```

Preview uses browser playback and canvas; export compiles edit metadata into FFmpeg jobs in a worker. The engine downloads on demand. Media and export intermediates stay local; export intermediates are cleaned up. Keep fixture media and generated output in ignored `.local/`, with only media resources inside `test-media` folders.

Follow [AGENTS.md](AGENTS.md) for project conventions. Commit focused chunks with brief imperative messages. GitHub Actions tests pushes and pull requests, and deploys successful `main` builds to Pages.

Releases use commit-message directives: `+semver: major`, `+semver: minor`, or `+semver: patch` (for example, `Add clip reordering +semver: minor`). The highest requested bump since the previous release wins; without a directive, no release is created. Releases are versioned Git tags with generated notes, published only after testing and deployment succeed. The existing published editor is the `v0.1.0` baseline; no history rewrite is needed.

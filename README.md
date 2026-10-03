# Localcut / VideoEditor

[![CI](https://github.com/y3nr1ng/VideoEditor/actions/workflows/pages.yml/badge.svg)](https://github.com/y3nr1ng/VideoEditor/actions/workflows/pages.yml)
[![Release](https://img.shields.io/github/v/release/y3nr1ng/VideoEditor)](https://github.com/y3nr1ng/VideoEditor/releases/latest)

I occasionally record my screen or small experiments, then need a quick edit for a presentation. The online editors I've tried hit me with a paywall after a few seconds or leave me wondering where my recordings go. FFmpeg gets the job done, but I end up swimming through Stack Overflow or prompting an LLM for the right command. Installing Premiere for a quick crop feels like bringing an entire film crew to the lab bench.

So here we are: a single-page editor that turns a growing list of edits into FFmpeg commands and runs them locally in your browser.

[Open the editor](https://y3nr1ng.github.io/VideoEditor/)

## Limitations

- Large or 4K videos can be slow or exceed browser memory.
- Projects cannot be saved yet; reloading clears your work.
- Plenty of features are still waiting to be built.

## Development

Built with React, TypeScript, Vite, Tailwind CSS, Tabler icons, and FFmpeg WebAssembly. Use Node 22.12+. Full media tests also require native `ffmpeg` and `ffprobe` for fixture generation and output inspection.

```sh
npm ci
npm run dev         # http://127.0.0.1:5173/
npm test            # logic and UI tests
npm run test:media  # real WASM export tests
npm run build       # static site in dist/
```

Preview uses browser playback and canvas; export compiles edit metadata into FFmpeg jobs in a worker. The engine downloads on demand. Keep fixture media and generated output in the ignored `.local/` directory, with only media resources inside `test-media` folders.

Follow [AGENTS.md](AGENTS.md) for project conventions. Commit focused chunks with brief imperative messages. GitHub Actions tests pushes and pull requests and deploys successful `main` builds to Pages.

Releases use commit-message directives: `+semver: major`, `+semver: minor`, or `+semver: patch` (for example, `Add clip reordering +semver: minor`). Releases are versioned Git tags with generated notes, published only after testing and deployment succeed.

```
 █████╗ ███████╗ ██████╗██╗██╗███████╗██╗   ██╗
██╔══██╗██╔════╝██╔════╝██║██║██╔════╝╚██╗ ██╔╝
███████║███████╗██║     ██║██║█████╗   ╚████╔╝ 
██╔══██║╚════██║██║     ██║██║██╔══╝    ╚██╔╝  
██║  ██║███████║╚██████╗██║██║██║        ██║   
╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝╚═╝╚═╝        ╚═╝   
```

<div align="center">

### Turn any video into living text.

**A client-side video → colored-ASCII converter. Drop a clip, watch every frame re-render as glyphs — tinted in the source color, in real time, in sync with the original audio. No build, no backend, no upload.**

![License: MIT](https://img.shields.io/badge/License-MIT-ffb23e.svg)
![No dependencies](https://img.shields.io/badge/dependencies-0-ffb23e)
![100% client-side](https://img.shields.io/badge/100%25-client--side-ffb23e)
![Vanilla JS](https://img.shields.io/badge/vanilla-JS-ffb23e)
![No build step](https://img.shields.io/badge/build-none-ffb23e)

[![GitHub stars](https://img.shields.io/github/stars/Debajit753/asciify?style=social)](https://github.com/Debajit753/asciify)

</div>

<!-- ![ASCIIFY](docs/screenshot.png) -->

---

```
> ASCIIFY :: ready
> drop a video. nothing uploads. everything renders here.
```

ASCIIFY is three small static files — `index.html`, `styles.css`, `app.js`. No frameworks, no dependencies, no build step, no backend. Drop a local video (or paste a direct, CORS-enabled `.mp4` / `.webm` URL) and it re-paints every frame as **colored ASCII**, tinted with the exact source pixel color, while the **original audio plays in perfect sync**.

Two pages, hash-routed: **DROP** (the home / drop zone + player) and **ABOUT**.

```
asciify/
├── index.html    # markup
├── styles.css    # all styling + design tokens
├── app.js        # the engine + CONFIG (edit this)
├── README.md
├── LICENSE
└── .gitignore
```

---

## Features

- **Drag & drop** a local file (MP4 / WebM) — or paste a direct video URL (CORS-enabled; **not** YouTube).
- **Colored ASCII** rendering, each glyph tinted with the exact source pixel color.
- **3 color modes** — `COLOR` (true source color), `MONO` (phosphor green on black), `INVERT` (photographic negative).
- **Live parameters**, tweak while it plays (and they **persist** across sessions via `localStorage`):
  - `RESOLUTION` — ASCII density (grid columns = detail)
  - `THRESHOLD` — clip the shadows
  - `FONT SIZE` — glyph size factor
  - `CHARACTER SET` — 5 built-in ramps (Standard, Detailed, Minimal, Blocks, Fine) **+ your own custom ramp**
- **VIEW toggle** — flip between `ASCII` and the `ORIGINAL` video.
- **Full transport** — play / pause, scrub, volume, mute. Keyboard: `Space`/`K`, `←`/`→` (5s), `J`/`L` (10s), `↑`/`↓` (volume).
- **Export a still** as a PNG — **or record the ASCII playback, with audio, to a WebM video**.
- **Terminal status bar** — state · filename · resolution · grid · fps · `LOCAL · NO UPLOAD`.
- **100% client-side & private** — nothing ever leaves your machine.

---

## How it works

The audio is the **master clock**. The hidden video element decodes the file and plays its audio natively; the visuals *chase* `video.currentTime` on every animation frame and **drop frames rather than drift**. Lip-sync stays honest even when rendering gets heavy.

```
  VIDEO ──► downscale frame ──► read luminance ──► match glyph ──► DRAW
            (offscreen canvas)   (Rec.709)         (active ramp)   (tinted)
                                                                     │
  AUDIO ──────────────────────────────────────────────────────────►│
         PLAYS NATIVELY  (MASTER CLOCK)              visuals chase ──┘
                                          via requestVideoFrameCallback
```

Step by step:

1. A hidden `<video>` decodes the file and supplies the audio.
2. Each frame is drawn, downscaled, onto an **offscreen `<canvas>`** sized to the character grid.
3. `getImageData` reads the downsampled pixels; per cell we compute **Rec.709 luminance**.
4. Luminance picks a glyph from the active ramp — **dark = sparse, light = dense**.
5. The visible `<canvas>` draws that glyph with `fillText`, **tinted by the cell's source color** (saturation-boosted so dim pixels stay readable).
6. A `requestVideoFrameCallback` loop (with a `requestAnimationFrame` fallback) keyed to the video's own frame clock keeps it all in sync, and pauses when the tab is hidden.

---

## Color modes

| Mode | What it does |
| --- | --- |
| `COLOR` | Each glyph wears its true source pixel color. |
| `MONO` | Classic phosphor green on black — the CRT special. |
| `INVERT` | Photographic negative; light and dark trade places. |

---

## Character sets

Five built-in luminance ramps (dark → light), plus a custom option. More glyphs = more tonal detail.

| Ramp | Levels | Feel |
| --- | --- | --- |
| **Standard** | classic | The default. Balanced, all-purpose detail. |
| **Detailed** | dense | Punchy, high-contrast linework. |
| **Minimal** | sparse | A handful of glyphs. Bold, abstract. |
| **Blocks** | █▓▒░ | Solid block shading — more mosaic than text. |
| **Fine** | 68-level | Smooth gradients, maximum tonal range. |
| **Custom** | your own | Pick `Custom ramp…` and type any string, dark → light. |

> Pair a dense ramp with a high `RESOLUTION` for photoreal text; drop to **Minimal** + low resolution for chunky, retro vibes.

---

## Run locally

The simplest path: **double-click `index.html`** and it opens over `file://`. Dropping a local file works directly — no server needed.

```bash
open index.html
```

Prefer to serve it? (Recommended if you'll be loading remote URLs.)

```bash
python3 -m http.server
# then visit http://localhost:8000
```

> Loading a **remote** video URL requires that host to send CORS headers. Local files always work.

---

## Browser support

Best on **Chromium** (Chrome / Edge / Brave / Arc). **Firefox** and **Safari** work for common codecs.

| Container / codec | Support |
| --- | --- |
| MP4 — H.264 / AAC | ✅ Broad |
| WebM — VP8 / VP9 / Opus | ✅ Broad |
| HEVC / AV1 | ⚠️ Varies by browser & OS |

**Why no YouTube?** Three hard walls:

- Extracting a playable stream from a YouTube page needs a **server** — ASCIIFY has none.
- It would **violate YouTube's Terms of Service**.
- Cross-origin frames **taint the canvas**, so `getImageData` is blocked and we can't read pixels.

Use a local file or a direct, CORS-enabled video URL instead.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / pause |
| `←` / `→` | Seek ∓ 5s |
| `J` / `L` | Seek ∓ 10s |
| `↑` / `↓` | Volume up / down |

---

## Privacy

Your video **never leaves your device.** It's read locally with `createObjectURL` and processed frame-by-frame inside the page. No server. No upload. No telemetry. The status bar says it plainly: `LOCAL · NO UPLOAD`.

---

## Contributing

It's plain static files — that's the whole point. To hack on it:

1. Fork the repo.
2. Edit `index.html` / `styles.css` / `app.js`, refresh the page. (No build, no `npm install`, nothing to wait on.)
3. Open a PR with a clear description — and a before/after frame export if it's visual.

Bug reports and feature ideas are welcome in **Issues** — new ramps, new color modes, codec fixes, performance. Keep it dependency-free.

---

## License

[MIT](LICENSE) © [Debajit](https://github.com/Debajit753)

---

<div align="center">

```
> if ASCIIFY made your terminal smile, leave a ⭐
```

**Like it? [Give it a star on GitHub](https://github.com/Debajit753/asciify) — it's the only thing this app ever uploads.**

</div>

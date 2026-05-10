# EquiSense

**Accessible math equations and data visualizations for blind and low-vision STEM students.**

TSA Software Development 2026 — Theme: Accessibility for vision or hearing disabilities.

---

## What It Does

**Equation Navigator** — Paste any LaTeX equation. Navigate its mathematical structure with arrow keys while hearing both speech (Web Speech API) and spatial audio cues (Web Audio API). Tree depth maps to pitch; superscripts pan right, subscripts pan left.

**Graph Sonifier** — Upload a CSV or load a sample dataset. The data plays back as audio: x-axis maps to time, y-axis maps to pitch (200–2000 Hz). A visual cursor syncs with the audio in real time. A user with eyes closed can identify whether a dataset is linear, exponential, or sinusoidal.

**Tactile Export** — Download an embosser-optimised SVG of the current graph with bold outlines and Braille tick labels, suitable for Tiger/ViewPlus embossers.

**Advanced Tools** — Inverse Sonification and Voice Commands remain available, but they are optional extras rather than the primary product flow.

## Start Here

The app opens with a sample graph and a starter equation already loaded, so the
main workflows are usable immediately. If you want to swap in your own content,
use this path:

1. Load a sample dataset in **Graph Sonifier** to understand the playback flow.
2. Paste a simple LaTeX equation into **Equation Navigator** and move through it with the arrow keys.
3. Try **Camera Capture** if you want OCR.
4. Open **Advanced Tools** only if you want inverse humming or voice control.

The landing section also includes one-click launch buttons for the sample graph,
starter equation, camera, and advanced tools.

Each core section also has a small workflow bar with the usual next step and a
reset action, so users can recover quickly without hunting through the page.

The optional voice and inverse-sonification tools are tucked into a collapsed
drawer at the bottom of the page instead of sitting in the main navigation.

The top-of-page **Start Here** section mirrors this path inside the app.

---

## How to Run

No build step. Open `index.html` in any modern browser, or serve locally:

```bash
# Python 3
python3 -m http.server 8080
# Then open http://localhost:8080
```

The app loads MathJax, Papa Parse, and D3 from CDN on first load, then caches them. **For offline use** (required at TSA conference), load the page once on WiFi, then disconnect — the browser cache serves all CDN assets.

---

## Keyboard Controls

### Equation Navigator
| Key | Action |
|-----|--------|
| `↑` | Move to parent node |
| `↓` | Move to first child node |
| `→` | Move to next sibling |
| `←` | Move to previous sibling |
| `Space` | Speak the current node |
| `R` | Read the full equation aloud |

### Graph Sonifier
Use the sample datasets if you want a quick demo, or upload your own CSV. Playback duration is adjustable (2–15 seconds).

### Camera Capture
Start the camera, line up one equation in the viewfinder, then capture it. If the camera is unavailable, upload a JPG or PNG instead.

### Voice Commands
Turn voice commands on only if you want the optional advanced controls. Say `help` to hear the available commands.

### Advanced Tools
Inverse sonification is experimental. Use it as a bonus workflow, not the main path.

### Global
| Key | Action |
|-----|--------|
| `Tab` / `Shift+Tab` | Navigate all controls |
| High Contrast button | Toggle WCAG AAA contrast mode |
| A+ / A− buttons | Increase or decrease font size |

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Language | JavaScript ES6 modules (no build step) |
| Audio | Web Audio API (raw, no library) |
| Speech | Web Speech API (built-in browser TTS) |
| Math | MathJax 3 (TeX → MathML) |
| CSV | Papa Parse 5 |
| Charts | D3.js v7 |
| Hosting | GitHub Pages |

---

## File Structure

```
equisense/
├── index.html
├── styles/
│   ├── base.css
│   ├── theme-default.css
│   └── theme-high-contrast.css
├── scripts/
│   ├── main.js
│   ├── audio-engine.js
│   ├── accessibility-shell.js
│   ├── equation-navigator/
│   │   ├── parser.js
│   │   ├── walker.js
│   │   ├── speech.js
│   │   ├── cues.js
│   │   └── render.js
│   ├── graph-sonifier/
│   │   ├── csv.js
│   │   ├── mapping.js
│   │   ├── scheduler.js
│   │   └── chart.js
│   └── tactile-export/
│       └── svg-generator.js
├── assets/sample-data/
│   ├── linear.csv
│   ├── sinusoidal.csv
│   └── exponential.csv
└── docs/
    ├── DESIGN.md
    └── DEV_LOG.md
```

---

## Team

- **Aarav** — Lead, Equation Navigator, architecture
- **Person 2** — Graph Sonifier, data pipeline
- **Person 3** — Accessibility Shell, Tactile Export, UI

---

## License

MIT

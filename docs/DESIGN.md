# EquiSense — Architecture & Design Decisions

## System Overview

EquiSense is a single-page web application with three independent feature modules that share one resource: the Web Audio `AudioContext`. All modules are ES6 native modules loaded via `<script type="module">`. No build step is required.

## Module Boundaries

| Module | Files | Owner |
|--------|-------|-------|
| Accessibility Shell | `accessibility-shell.js` | Person 3 |
| Audio Engine | `audio-engine.js` | Shared |
| Equation Navigator | `equation-navigator/` | Aarav |
| Graph Sonifier | `graph-sonifier/` | Person 2 |
| Tactile Export | `tactile-export/` | Person 3 |
| Bootstrap/Wiring | `main.js` | Aarav |

## Key Design Decisions

### Why one AudioContext?

Browsers cap AudioContext instances per page (Chrome: 6). The shared context in `audio-engine.js` is instantiated lazily on first user gesture (required by browser autoplay policy) and reused by all modules. Passing it by reference avoids hidden coupling — each module calls `getAudioContext()` and gets the same singleton.

### Why MathML over raw TeX for the AST?

TeX is a typesetting language, not a semantic one. `\frac{a}{b}` tells a renderer to draw a fraction but carries no parse tree. MathML (`<mfrac>`) *is* the parse tree — the DOM structure reflects the mathematical hierarchy directly. This makes tree walking trivial: recurse the DOM, map tag names to semantic concepts.

### Why `AudioContext.currentTime` for sync, not `setTimeout`?

`setTimeout` is subject to throttling, especially on battery-powered laptops (the TSA conference environment). `AudioContext.currentTime` is a hardware clock that advances uniformly regardless of JS thread load. The visual cursor in `chart.js` reads progress from elapsed audio time, so even under CPU pressure the cursor stays in sync with what the user hears.

### Why `linearRampToValueAtTime` for frequency?

`setValueAtTime` creates audible clicks/pops at each step. `linearRampToValueAtTime` smoothly glides between adjacent data points, which is musically pleasant and allows the ear to track the trend as a continuous contour rather than discrete steps.

### Why no React/framework?

Two reasons:
1. The TSA rubric awards points for "software coding practices" — an abstraction layer hiding DOM manipulation would make it harder to explain at the interview level the rubric requires.
2. Accessibility is harder to implement correctly through a component framework. Native `<button>`, `<nav>`, `<main>` with direct `aria-*` attributes are clearer, more auditable, and more reliably handled by screen readers.

### Why StereoPannerNode over PannerNode?

`PannerNode` implements 3D audio spatialization (HRTF, distance models). That's overkill and introduces cross-browser inconsistency. `StereoPannerNode` is a simple [-1, +1] stereo balance control — exactly what we need for left/right cues, and identical behaviour across Chrome, Firefox, and Safari.

## Accessibility Compliance Target

WCAG 2.1 AA minimum; AAA for contrast in high-contrast mode. Tested with:
- VoiceOver (macOS/iOS)
- NVDA (Windows)
- axe-core browser extension
- WAVE browser extension
- Keyboard-only navigation (Tab, Shift+Tab, Arrow keys, Space, Enter)

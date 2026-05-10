# EquiSense — Development Log

> Keep one dated entry per work session per person. This is your paper trail for the TSA honor statement.

---

## 2026-05-09 — Aarav

- Confirmed project direction: Equation Navigator + Graph Sonifier + Tactile Export
- Set up GitHub repo and directory scaffolding
- Created full HTML shell with semantic landmarks, skip link, ARIA live regions
- Implemented accessibility-shell.js (theme toggle, font scaling, focus trap, localStorage prefs)
- Implemented audio-engine.js (shared AudioContext, positional cue utility)
- Implemented equation-navigator/parser.js (MathML → AST)
- Implemented equation-navigator/walker.js (pure cursor state machine)
- Implemented equation-navigator/speech.js (nodeToSpeech, Web Speech API wrapper)
- Implemented equation-navigator/cues.js (pitch/pan spatial audio cues)
- Implemented equation-navigator/render.js (DOM highlight)
- Implemented graph-sonifier/csv.js (Papa Parse wrapper)
- Implemented graph-sonifier/mapping.js (normalization, frequency mapping)
- Implemented graph-sonifier/scheduler.js (Web Audio scheduling, progress callbacks)
- Implemented graph-sonifier/chart.js (D3 line chart with synced cursor)
- Implemented tactile-export/svg-generator.js (embosser-optimised SVG + Braille labels)
- Wired all modules together in main.js
- Added three sample datasets: linear, sinusoidal, exponential

**Next**: Local testing, Safari Web Audio quirks check, keyboard-only navigation test

---

## 2026-05-09 — Aarav (EquiSense 2.0 — all three features)

**Feature 1: HRTF Spatial Audio**
- Refactored `audio-engine.js`: added `initSpatialAudio`, `createSpatialCue` (HRTF PannerNode), `playSpatialTone`, `detectHeadphones`
- Created `equation-navigator/spatial-mapping.js`: role-to-3D-offset table, `getNodeRole` (parent-child relationship analysis), `composePosition` (path walker summing deltas)
- Updated `equation-navigator/cues.js`: replaced `StereoPannerNode` with HRTF PannerNode chain via `playSpatialTone`
- Decision: use `StereoPannerNode` for graph sonifier (left-right sweep is intentional) but HRTF for equation navigator (structural 3D cues are the point)
- Added headphones detection prompt using `navigator.mediaDevices.enumerateDevices()`

**Feature 2: Statistical Pre-Analysis + NLG**
- Created `data-analysis/stats.js`: `computeStats`, `linearRegression` with R² computation, `detectOutliers` with z-score and IQR methods
- Created `data-analysis/fft.js`: Cooley-Tukey radix-2 FFT from scratch — bit-reverse permutation, butterfly stages, Hann window, magnitude spectrum, `analyzeSpectrum` pipeline
- Created `data-analysis/pattern-detect.js`: decision tree classifier — linear (R²>0.95) → sinusoidal (dominant FFT bin) → exponential (log-linear R²) → scatter (high CV)
- Created `data-analysis/nlg.js`: slot-filling template engine, one template per pattern class
- Updated `main.js`: NLG description spoken via Web Speech API before audio playback begins (TTS `onend` triggers audio start)

**Feature 3: Camera-Based Math Capture**
- Created `camera-capture/camera.js`: `getUserMedia` with environment-facing fallback, grayscale+contrast-stretch preprocessing
- Created `camera-capture/math-cleanup.js`: OCR misread correction table, `clusterTokensByLine` (tolerance-band baseline grouping), `detectVerticalRole` (y-center deviation from line median), `detectFractionBars` (pixel-level horizontal dark run detection), `assembleLatexFromStructure`
- Created `workers/ocr.worker.js`: Tesseract.js in a Web Worker via `OffscreenCanvas`, pre-warmed on page load
- Created `camera-capture/ocr-worker.js`: client-side worker wrapper with ArrayBuffer transfer for zero-copy
- Created `camera-capture/viewfinder.js`: camera state machine UI (idle→active→capturing→processing→success/error)
- Added camera section to `index.html`, image upload fallback, confidence badge, "Load into Navigator" flow

**Docs & Tests**
- Created `docs/PRESENTATION.md`: full 7-minute script with timing, speaker notes, rehearsal checklist
- Created `docs/CODE_DEFENSE.md`: per-person interview prep with anticipated judge questions
- Created `tests/accessibility-checklist.md`: 9-section manual test protocol
- Created `tests/fft-test-vectors.md`: 5 runnable console tests with expected outputs
- Bug fix: `theme-high-contrast.css` was not linked in `index.html` — high-contrast toggle was silently broken

---

<!-- Template for future entries:

## YYYY-MM-DD — [Name]

- [What you built or changed]
- [Why you made a key decision]
- [Any blockers / open questions]

-->

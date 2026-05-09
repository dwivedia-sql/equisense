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

<!-- Template for future entries:

## YYYY-MM-DD — [Name]

- [What you built or changed]
- [Why you made a key decision]
- [Any blockers / open questions]

-->

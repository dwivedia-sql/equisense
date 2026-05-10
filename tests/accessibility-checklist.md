# EquiSense — Accessibility Test Checklist

Run this before every submission and conference demo. Check every item.

---

## 1. Keyboard-Only Navigation

Test without touching the mouse. Tab through the entire page in order.

- [ ] Skip link appears and works when Tab is pressed on page load
- [ ] Header controls (High Contrast, A+, A−) reachable and operable
- [ ] Navigation links reachable and jump to correct sections
- [ ] Camera section: Start Camera, Stop Camera, Capture all reachable and operable
- [ ] Image upload reachable
- [ ] Equation input field reachable; Enter key triggers Load Equation
- [ ] Load Equation button reachable
- [ ] After equation loads: arrow key navigation works while focus is in the section
- [ ] Read Full Equation button reachable
- [ ] CSV upload reachable
- [ ] All four sample dataset buttons reachable
- [ ] Playback duration slider reachable and adjustable with arrow keys
- [ ] Play, Stop, Replay buttons reachable
- [ ] Download Tactile SVG button reachable
- [ ] No keyboard traps anywhere (Tab always moves forward; Shift+Tab always moves backward)
- [ ] Visible focus ring on every focused element (3px outline minimum, no elements with invisible focus)

---

## 2. Screen Reader Test — VoiceOver (Mac)

Enable with: Cmd+F5. Navigate with VO+Arrow keys.

- [ ] Page title reads "EquiSense — Accessible STEM for Blind and Low-Vision Students"
- [ ] H1 reads "EquiSense"
- [ ] Navigation landmark announced
- [ ] Main landmark announced
- [ ] Section headings (H2) announced in order: Camera Math Capture, Equation Navigator, Graph Sonifier, Tactile Export
- [ ] When equation loads, status region announces "Equation loaded. Use arrow keys to navigate."
- [ ] When cursor moves in equation, live region announces the current node description
- [ ] When dataset loads, status region announces the data summary
- [ ] When Play is clicked, NLG description is spoken (via speechSynthesis — may overlap with VoiceOver)
- [ ] When playback ends, "Playback complete" is announced
- [ ] Camera status messages announced as they change
- [ ] Capture result confidence level announced
- [ ] Error messages announced assertively (not politely)

---

## 3. Screen Reader Test — NVDA (Windows)

Download free from nvaccess.org. Test in Chrome.

- [ ] Same heading structure check as VoiceOver
- [ ] Live region announcements fire correctly (NVDA handles polite/assertive differently)
- [ ] Button labels all read clearly (no "button" with no label)
- [ ] Input fields have associated labels (not just placeholder text)
- [ ] `aria-pressed` state on High Contrast button reads "pressed" / "not pressed"
- [ ] Playback controls have group label "Playback controls"

---

## 4. Color Contrast

Use the axe-core browser extension or WAVE.

- [ ] All body text: minimum 4.5:1 (AA)
- [ ] Large text (≥18pt or 14pt bold): minimum 3:1
- [ ] Navigation links: minimum 4.5:1
- [ ] Button text against button background: minimum 4.5:1
- [ ] Focus ring visible against both light and dark backgrounds
- [ ] High contrast mode: all text minimum 7:1 (AAA target)
- [ ] Camera status error messages: sufficient contrast in both themes

---

## 5. axe-core Automated Scan

Install the axe DevTools browser extension. Run on the live page.

- [ ] Zero critical violations
- [ ] Zero serious violations
- [ ] Review and document any moderate violations with justification

---

## 6. Zoom & Responsive

- [ ] Page readable at 200% browser zoom without horizontal scroll
- [ ] Font size increase (A+ button) scales text without breaking layout
- [ ] Maximum font scale (A+ pressed 3 times) still readable
- [ ] Camera video element scales with container

---

## 7. Reduced Motion

Add `@media (prefers-reduced-motion: reduce)` to system preferences (macOS: Accessibility → Display → Reduce Motion).

- [ ] No CSS transitions fire
- [ ] No CSS animations fire
- [ ] D3 chart renders without animated transitions

---

## 8. Offline Test (Critical — TSA conference has no WiFi)

Load the page once on WiFi, then disconnect entirely.

- [ ] Page loads from browser cache
- [ ] MathJax loads and renders equations
- [ ] Papa Parse loads
- [ ] D3 loads
- [ ] All three sample CSVs load (they are local files — always work)
- [ ] Audio playback works
- [ ] Tesseract.js OCR worker loads (first load caches the WASM binary)

---

## 9. Battery Power Test

Run on battery, no charger. Run the full 7-minute demo end-to-end.

- [ ] Audio stays in sync with visual cursor throughout playback
- [ ] No performance degradation during OCR
- [ ] HRTF spatial audio maintains correct positioning
- [ ] Full demo completes without any freezes or crashes

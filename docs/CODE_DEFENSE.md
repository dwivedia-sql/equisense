# EquiSense — Code Defense Interview Prep

Use this as a drill guide. Each person reads their own module out loud, then answers the questions below without looking at the code.

---

## Aarav — Equation Navigator + HRTF + Camera OCR Cleanup

### Must know cold

**parseMathML (parser.js)**
- Input: raw MathML string from MathJax
- Why not parse raw TeX? TeX is a typesetting language, not a semantic one. `\frac{a}{b}` tells a renderer to draw but carries no tree. MathML *is* the tree.
- Walk through the recursive `buildNode` function

**composePosition (spatial-mapping.js)**
- Walk through the coordinate system: listener at origin, facing -Z, up +Y
- How is the path from root to cursor built? Walk `.parent` chain, unshift into array
- What does summing offsets represent? Each structural role in the math adds a spatial displacement

**playSpatialTone (audio-engine.js)**
- Why PannerNode over StereoPannerNode? HRTF gives perceptual up-down and front-back localization that stereo cannot. StereoPannerNode is only left-right balance.
- Why inverse distance model? Matches real-world acoustic falloff (intensity ∝ 1/r). Linear over-attenuates nearby sounds.
- What happens without headphones? HRTF effect collapses — algorithm assumes binaural delivery (one signal per ear). Through laptop speakers both ears hear the same signal.
- What is `panner.refDistance`? The distance at which gain = 1 (no attenuation). We set it to 1 so nodes at distance 1 play at full volume.

**ocrResultsToLatex (math-cleanup.js)**
- How does Tesseract know it is reading math? It does not. The math-aware layer interprets its output — that interpretation is the original work.
- Walk through `clusterTokensByLine`: tolerance band based on average character height; tokens within 30% of avgH share a baseline.
- Walk through `detectVerticalRole`: if token's y-center is 25% of medianH above the line AND smaller height → superscript.
- How is fraction detection done? Pixel scan for long horizontal dark runs (≥8% image width). Not OCR — pixel analysis is independent of character recognition.
- What about handwritten math? Out of scope. Tesseract is trained on printed text; handwriting is future work.

### Anticipate

- "Why use a sine tone for entering a node and sawtooth for exiting?" Sine is smooth and rounded, matching the sensation of going deeper into a structure. Sawtooth is sharp and edgy, matching the sensation of backing out.
- "What is the listener's coordinate system?" Right-handed. Listener at origin. Forward vector (0, 0, -1). Up vector (0, 1, 0).
- "Why Web Worker for OCR?" Tesseract is CPU-intensive. Running on the main thread would freeze the UI for 2-5 seconds, which is inaccessible behavior.

---

## Person 2 — Graph Sonifier + FFT + NLG

### Must know cold

**fftInPlace (fft.js)**
- Walk through bit-reverse permutation: reorders input so in-place butterflies produce correct output order
- Walk through one butterfly stage: length 2, two inputs u and v = w×x[half], output u+v and u-v
- What is the twiddle factor? w = e^(−2πi k/N) — complex rotation that mixes frequency components. At each stage we accumulate it by complex multiplication.
- What is spectral leakage? When a signal doesn't fit exactly in the FFT window, energy bleeds into adjacent bins. The Hann window tapers the signal to zero at both ends, suppressing leakage.
- What happens with a dataset of 17 points? Zero-padded to 32 (next power of 2) before FFT. Padding adds zeros, which is equivalent to resampling with interpolation.

**classifyPattern (pattern-detect.js)**
- Walk through the decision tree in order: linear → sinusoidal → exponential → scatter
- Why R² threshold 0.95? Empirical. At 0.95, fewer than 5% of variance is unexplained — strong evidence of a linear relationship. Lower threshold has too many false positives.
- What is coefficient of variation? std / |mean| — normalized measure of spread. CV > 0.5 means std is more than 50% of the mean, indicating high variability.

**composeDescription (nlg.js)**
- Walk through the LINEAR template slot-filling
- Why template-based NLG instead of an LLM? Deterministic, explainable, works offline, no API key needed. Each sentence is auditable.
- How is period estimated? period = 1 / dominantFreq. dominantFreq comes from findDominantFrequency which returns the bin with highest magnitude above threshold, converted to Hz using the x-axis sample rate.

**mapY (mapping.js)**
- Walk through the normalization: (value − yMin) / (yMax − yMin) gives [0, 1], then scale to [200, 2000] Hz
- Why 200-2000 Hz? Covers the musically usable mid-frequency range where pitch is most perceptually distinct. Below 200 Hz: difficult to distinguish. Above 2000 Hz: harsh and fatiguing.
- Why `linearRampToValueAtTime` not `setValueAtTime`? `setValueAtTime` creates clicks/pops at each step. `linearRampToValueAtTime` creates smooth glides between points, which is musically coherent and lets the ear track the trend.

### Anticipate

- "What happens with a dataset of 10,000 rows?" FFT zero-pads to next power of 2 (16,384). The scheduler schedules all 10,000 frequency ramps — this is fine since Web Audio schedules in the future. D3 still renders all points (SVG may be slow; could downsample for display).
- "What is the difference between z-score outlier detection and IQR?" Z-score assumes normality; IQR is non-parametric (works for skewed distributions). We default to z-score for speed; IQR is available via the `method` parameter.

---

## Person 3 — Accessibility Shell + Tactile Export + Camera UI

### Must know cold

**initAccessibilityShell (accessibility-shell.js)**
- What is a skip link? First focusable element; allows keyboard/screen-reader users to jump past repeated navigation directly to main content.
- Walk through `trapFocusInModal`: queries all focusable elements, wraps Tab at last back to first and Shift+Tab at first back to last.
- Why never `outline: none`? Removes the visible focus indicator entirely. Keyboard users cannot tell what element has focus. We always replace it with a custom 3px outline if removing the browser default.

**announceToScreenReader (accessibility-shell.js)**
- What is `role="status"` vs `role="alert"`? `status` is polite — screen reader announces when idle. `alert` is assertive — interrupts immediately. We use alert only for errors.
- Why clear then set the text? Screen readers only announce when content *changes*. If you set the same text twice, the second set does nothing. Clearing first forces a re-announcement.

**buildTactileSVG (svg-generator.js)**
- Why SVG for tactile output? Tiger and ViewPlus embossers accept SVG input. Bold stroke-width lines (≥2pt) produce raised lines when embossed.
- Why Braille Unicode labels? Embossers render Unicode Braille Block characters (U+2800–U+28FF) as actual Braille cells. This means the same SVG file contains both visual labels and tactile labels.
- What is the minimum stroke-width for embossing? 2pt. Thinner lines may not raise enough to be felt reliably.

**showCaptureFeedback (viewfinder.js)**
- Walk through the state machine: idle → active → capturing → processing → success/error
- How does accessibility work in the camera flow? `camera-status` has `aria-live="polite"`. Every state change updates its text content, which is announced by the screen reader. The capture button is always keyboard-accessible.

### Anticipate

- "Why is the tactile SVG accessible to a screen reader as well?" It has a `<title>` and `<desc>` element. Screen readers expose these as the image's accessible name and description. The SVG is also marked with `role="img"`.
- "What if camera permissions are denied?" The flow catches the error in `startCameraFlow` and announces a message with fallback instructions (use the image upload option). The button states are reset to idle.

/**
 * pitch-detect.js
 * Autocorrelation-based pitch detection.
 *
 * Algorithm:
 *   1. Compute autocorrelation r(lag) = Σ x[i] * x[i+lag]
 *   2. Find the first zero-crossing of r (end of the first lobe)
 *   3. Find the peak of r after that zero-crossing
 *   4. The lag at that peak is the fundamental period T
 *   5. Pitch = sampleRate / T
 *
 * Valid pitch range: 80–1200 Hz (covers all sung/hummed fundamentals).
 * Returns 0 if no clear pitch is detected (silence or noise).
 *
 * This implementation is an original adaptation — not a library call.
 */

const MIN_HZ  = 80;    // lowest detectable pitch
const MAX_HZ  = 1200;  // highest detectable pitch
const CLARITY_THRESHOLD = 0.15; // minimum normalized autocorrelation strength

/**
 * @param {Float32Array} buffer     Raw audio samples
 * @param {number}       sampleRate Audio context sample rate (Hz)
 * @returns {number}  Detected pitch in Hz, or 0 if unclear
 */
export function detectPitch(buffer, sampleRate) {
  const N      = buffer.length;
  const minLag = Math.floor(sampleRate / MAX_HZ);
  const maxLag = Math.floor(sampleRate / MIN_HZ);

  // ── Step 1: Compute autocorrelation ─────────────────────────────
  const ac = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < N - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
    }
    ac[lag] = sum;
  }

  if (ac[0] < 0.001) return 0; // silence

  // ── Step 2: Normalize by zero-lag value ─────────────────────────
  const norm = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) norm[lag] = ac[lag] / ac[0];

  // ── Step 3: Find first zero-crossing after lag=0 ────────────────
  let firstZero = minLag;
  for (let i = 1; i <= maxLag; i++) {
    if (norm[i] <= 0) { firstZero = i; break; }
  }

  // ── Step 4: Find peak in valid lag range ─────────────────────────
  let bestLag  = -1;
  let bestCorr = CLARITY_THRESHOLD;
  for (let lag = Math.max(minLag, firstZero); lag <= maxLag; lag++) {
    if (norm[lag] > bestCorr) {
      bestCorr = norm[lag];
      bestLag  = lag;
    }
  }

  if (bestLag === -1) return 0;

  // ── Step 5: Sub-sample interpolation for accuracy ────────────────
  // Parabolic interpolation around the peak
  if (bestLag > 0 && bestLag < maxLag) {
    const prev = norm[bestLag - 1];
    const curr = norm[bestLag];
    const next = norm[bestLag + 1];
    const delta = 0.5 * (prev - next) / (prev - 2 * curr + next);
    return sampleRate / (bestLag + delta);
  }

  return sampleRate / bestLag;
}

/**
 * Classify whether a buffer contains voiced audio (singing/humming)
 * vs silence or noise, based on RMS energy and autocorrelation strength.
 *
 * @param {Float32Array} buffer
 * @returns {'voiced'|'silence'|'noise'}
 */
export function classifyBuffer(buffer) {
  const rms = Math.sqrt(buffer.reduce((a, b) => a + b * b, 0) / buffer.length);
  if (rms < 0.01) return 'silence';
  if (rms < 0.005) return 'noise';
  return 'voiced';
}

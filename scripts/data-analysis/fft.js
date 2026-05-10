/**
 * fft.js
 * Cooley-Tukey radix-2 DIT FFT implemented from scratch.
 *
 * Steps:
 *   1. Apply Hann window to reduce spectral leakage
 *   2. Zero-pad input to next power of 2
 *   3. Bit-reverse permutation
 *   4. Butterfly stages across log2(N) passes
 *   5. Compute magnitude spectrum (first N/2 bins — positive frequencies)
 */

/** Next power of 2 >= n */
function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Hann window coefficients to reduce spectral leakage.
 * @param {number} N
 * @returns {Float64Array}
 */
export function hannWindow(N) {
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  }
  return w;
}

/**
 * In-place Cooley-Tukey FFT.
 * Mutates real[] and imag[] arrays directly.
 * N must be a power of 2.
 *
 * @param {Float64Array} real  real parts — also holds output real
 * @param {Float64Array} imag  imaginary parts — also holds output imag
 */
export function fftInPlace(real, imag) {
  const N = real.length;

  // ── Step 1: Bit-reverse permutation ──────────────────────────────
  // Reorder input so butterflies can work in-place
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let tmp = real[i]; real[i] = real[j]; real[j] = tmp;
      tmp = imag[i]; imag[i] = imag[j]; imag[j] = tmp;
    }
  }

  // ── Step 2: Butterfly stages ─────────────────────────────────────
  // len doubles each stage: 2, 4, 8, …, N
  for (let len = 2; len <= N; len <<= 1) {
    const half  = len >> 1;
    const angle = -2 * Math.PI / len;    // DFT convention: e^(-2πi k/N)
    const wBaseRe = Math.cos(angle);
    const wBaseIm = Math.sin(angle);

    for (let i = 0; i < N; i += len) {
      let wRe = 1, wIm = 0;             // twiddle factor, starts at e^0 = 1

      for (let k = 0; k < half; k++) {
        const uRe = real[i + k];
        const uIm = imag[i + k];
        // Multiply twiddle factor by butterfly partner:  v = w * x[i+k+half]
        const vRe = real[i + k + half] * wRe - imag[i + k + half] * wIm;
        const vIm = real[i + k + half] * wIm + imag[i + k + half] * wRe;

        real[i + k]        = uRe + vRe;
        imag[i + k]        = uIm + vIm;
        real[i + k + half] = uRe - vRe;
        imag[i + k + half] = uIm - vIm;

        // Advance twiddle factor: w *= wBase
        const nextWRe = wRe * wBaseRe - wIm * wBaseIm;
        wIm = wRe * wBaseIm + wIm * wBaseRe;
        wRe = nextWRe;
      }
    }
  }
}

/**
 * Compute magnitude spectrum from FFT output.
 * Only first N/2 bins are meaningful (positive frequencies).
 *
 * @param {Float64Array} real
 * @param {Float64Array} imag
 * @returns {Float64Array} magnitudes, length N/2
 */
export function magnitudeSpectrum(real, imag) {
  const half = real.length >> 1;
  const mag  = new Float64Array(half);
  for (let i = 0; i < half; i++) {
    mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return mag;
}

/**
 * Find the bin with the highest magnitude, excluding DC (bin 0).
 * sampleRate is the number of x-samples per unit of x (i.e., 1/Δx).
 *
 * @param {Float64Array} magnitudes
 * @param {number} sampleRate  samples per x-unit
 * @param {number} minMag      ignore bins below this threshold
 * @returns {{ freq: number, mag: number, binIndex: number }}
 */
export function findDominantFrequency(magnitudes, sampleRate, minMag = 0) {
  const N = magnitudes.length * 2; // full FFT size
  let maxMag = minMag, maxIdx = -1;
  for (let i = 1; i < magnitudes.length; i++) {
    if (magnitudes[i] > maxMag) { maxMag = magnitudes[i]; maxIdx = i; }
  }
  if (maxIdx === -1) return { freq: 0, mag: 0, binIndex: -1 };
  return { freq: maxIdx * sampleRate / N, mag: maxMag, binIndex: maxIdx };
}

/**
 * Full pipeline: apply Hann window, zero-pad, run FFT, return magnitude spectrum.
 *
 * @param {{x:number,y:number}[]} data
 * @returns {{ magnitudes: Float64Array, sampleRate: number, N: number }}
 */
export function analyzeSpectrum(data) {
  const n  = data.length;
  const N  = nextPow2(n);
  const ys = data.map(p => p.y);

  // Estimate sample rate from x spacing
  const xRange  = data[n - 1].x - data[0].x;
  const sampleRate = xRange > 0 ? (n - 1) / xRange : n;

  // Apply Hann window and zero-pad
  const window = hannWindow(n);
  const real = new Float64Array(N);
  const imag = new Float64Array(N);
  for (let i = 0; i < n; i++) real[i] = ys[i] * window[i];

  fftInPlace(real, imag);
  const magnitudes = magnitudeSpectrum(real, imag);

  return { magnitudes, sampleRate, N };
}

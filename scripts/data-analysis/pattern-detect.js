/**
 * pattern-detect.js
 * Decision-tree pattern classifier built on stats + FFT signals.
 *
 * Classification decision tree:
 *   1. R² of linear fit > 0.95  →  linear
 *   2. Dominant FFT bin magnitude > 30% of y-range  →  sinusoidal
 *   3. R² of log(y) linear fit > 0.95 (requires all y > 0)  →  exponential
 *   4. coefficient of variation (std/|mean|) > 0.5  →  scatter
 *   5. otherwise  →  irregular
 */

import { linearRegression } from './stats.js';
import { analyzeSpectrum, findDominantFrequency } from './fft.js';

/**
 * @param {{x:number,y:number}[]} data
 * @param {{ mean, std, min, max, range }} stats
 * @param {{ slope, intercept, r2 }} regression
 * @returns {{ pattern: string, dominantFreq: number, period: number, amplitude: number }}
 */
export function classifyPattern(data, stats, regression) {
  const { mean, std, range, min } = stats;

  // ── Linear ──────────────────────────────────────────────────────
  if (regression.r2 > 0.95) {
    return {
      pattern: 'linear',
      dominantFreq: 0,
      period: 0,
      amplitude: range / 2,
    };
  }

  // ── Sinusoidal (via FFT) ─────────────────────────────────────────
  const { magnitudes, sampleRate } = analyzeSpectrum(data);
  const magnitudeThreshold = range * 0.3;
  const dominant = findDominantFrequency(magnitudes, sampleRate, magnitudeThreshold);

  if (dominant.freq > 0) {
    const period = dominant.freq > 0 ? 1 / dominant.freq : 0;
    return {
      pattern: 'sinusoidal',
      dominantFreq: dominant.freq,
      period,
      amplitude: estimateAmplitude(data, mean),
    };
  }

  // ── Exponential (log-linear fit) ─────────────────────────────────
  // Only valid when all y-values are strictly positive
  if (min > 0) {
    const logData = data.map(p => ({ x: p.x, y: Math.log(p.y) }));
    const logReg  = linearRegression(logData);
    if (logReg.r2 > 0.95) {
      // Doubling time: ln(2) / slope  (positive slope = growth)
      const doublingTime = logReg.slope !== 0 ? Math.LN2 / Math.abs(logReg.slope) : Infinity;
      return {
        pattern: 'exponential',
        doublingTime,
        growthRate: logReg.slope,
        dominantFreq: 0,
        period: 0,
        amplitude: range / 2,
      };
    }
  }

  // ── Scatter ──────────────────────────────────────────────────────
  const cv = Math.abs(mean) > 1e-9 ? std / Math.abs(mean) : Infinity;
  if (cv > 0.5) {
    return { pattern: 'scatter', dominantFreq: 0, period: 0, amplitude: range / 2 };
  }

  return { pattern: 'irregular', dominantFreq: 0, period: 0, amplitude: range / 2 };
}

function estimateAmplitude(data, mean) {
  return data.reduce((max, p) => Math.max(max, Math.abs(p.y - mean)), 0);
}

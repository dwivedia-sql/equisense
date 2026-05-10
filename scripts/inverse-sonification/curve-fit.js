/**
 * curve-fit.js
 * Fits parametric equations to a pitch contour.
 *
 * Input:  array of { t, hz } samples collected while user hums/sings
 * Output: { type, latex, params, r2 }
 *
 * Tries: linear, sinusoidal, quadratic, exponential
 * Returns the best fit by R².
 */

import { linearRegression } from '../data-analysis/stats.js';

/**
 * @param {{ t: number, hz: number }[]} contour  time→pitch samples
 * @returns {{ type: string, latex: string, params: object, r2: number }}
 */
export function fitContour(contour) {
  if (contour.length < 4) return { type: 'unknown', latex: '', params: {}, r2: 0 };

  // Normalize hz to 0–1 for fitting (preserve relative shape)
  const hzMin = Math.min(...contour.map(p => p.hz));
  const hzMax = Math.max(...contour.map(p => p.hz));
  const hzRange = hzMax - hzMin || 1;

  const points = contour.map(p => ({
    x: p.t,
    y: (p.hz - hzMin) / hzRange,
  }));

  const results = [
    tryLinear(points),
    trySinusoidal(points),
    tryQuadratic(points),
    tryExponential(contour), // use raw Hz for log transform
  ];

  // Return best fit by R²
  return results.reduce((best, r) => r.r2 > best.r2 ? r : best, results[0]);
}

// ── Linear ────────────────────────────────────────────────────────────────────

function tryLinear(points) {
  const { slope, intercept, r2 } = linearRegression(points);
  const m = round(slope, 3);
  const b = round(intercept, 3);
  const latex = b >= 0
    ? `y = ${m}x + ${b}`
    : `y = ${m}x - ${Math.abs(b)}`;
  return { type: 'linear', latex, params: { slope: m, intercept: b }, r2 };
}

// ── Quadratic ─────────────────────────────────────────────────────────────────

function tryQuadratic(points) {
  // Ordinary least squares with features [1, x, x²]
  const n = points.length;
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, sy = 0, sxy = 0, sx2y = 0;
  for (const { x, y } of points) {
    const x2 = x * x;
    s0 += 1; s1 += x; s2 += x2; s3 += x2 * x; s4 += x2 * x2;
    sy += y; sxy += x * y; sx2y += x2 * y;
  }

  // Normal equations: [s0 s1 s2; s1 s2 s3; s2 s3 s4] * [c b a]ᵀ = [sy sxy sx2y]ᵀ
  const A = [[s0,s1,s2],[s1,s2,s3],[s2,s3,s4]];
  const B = [sy, sxy, sx2y];
  const [c, b, a] = solveLinearSystem3(A, B);

  const yMean = sy / n;
  let ssTot = 0, ssRes = 0;
  for (const { x, y } of points) {
    ssTot += (y - yMean) ** 2;
    ssRes += (y - (a * x * x + b * x + c)) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  const ar = round(a, 3), br = round(b, 3), cr = round(c, 3);
  const latex = `y = ${ar}x^{2} ${br >= 0 ? '+' : '-'} ${Math.abs(br)}x ${cr >= 0 ? '+' : '-'} ${Math.abs(cr)}`;
  return { type: 'quadratic', latex, params: { a: ar, b: br, c: cr }, r2 };
}

/** Solve 3×3 linear system Ax = b using Cramer's rule */
function solveLinearSystem3(A, B) {
  const det = (m) =>
    m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) -
    m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) +
    m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const d = det(A);
  if (Math.abs(d) < 1e-12) return [0, 0, 0];
  return B.map((_, i) => {
    const M = A.map((row, r) => row.map((v, c) => c === i ? B[r] : v));
    return det(M) / d;
  });
}

// ── Sinusoidal ────────────────────────────────────────────────────────────────

function trySinusoidal(points) {
  // Estimate frequency from zero-crossings
  const n = points.length;
  let crossings = 0;
  const meanY = points.reduce((a, p) => a + p.y, 0) / n;
  for (let i = 1; i < n; i++) {
    if ((points[i - 1].y - meanY) * (points[i].y - meanY) < 0) crossings++;
  }
  const duration = points[n - 1].x - points[0].x;
  const estFreq = crossings / (2 * duration) || 0.5;
  const estAmp  = (Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y))) / 2;

  // Fit y ≈ A*sin(2π*f*t + φ) + C using linearized least squares
  // Rewrite as y = c1*sin(2πft) + c2*cos(2πft) + c3
  const feats = points.map(({ x, y }) => ({
    s: Math.sin(2 * Math.PI * estFreq * x),
    c: Math.cos(2 * Math.PI * estFreq * x),
    y,
  }));

  // Least squares: minimize |y - (c1*s + c2*c + c3)|²
  let ss=0, sc=0, s1=0, cc=0, c1=0, sy=0, cy=0, ny=0;
  let n_ = feats.length;
  for (const { s, c, y } of feats) {
    ss += s*s; sc += s*c; s1 += s; cc += c*c; c1 += c;
    sy += s*y; cy += c*y; ny += y;
  }
  const A2 = [[ss,sc,s1],[sc,cc,c1],[s1,c1,n_]];
  const B2 = [sy, cy, ny];
  const [c1_,c2_,c3_] = solveLinearSystem3(A2, B2);

  const amp   = Math.sqrt(c1_**2 + c2_**2);
  const phase = Math.atan2(c2_, c1_);
  const offset = c3_;

  let ssTot = 0, ssRes = 0;
  const yMean = ny / n_;
  for (const { s, c, y } of feats) {
    ssTot += (y - yMean) ** 2;
    ssRes += (y - (c1_*s + c2_*c + c3_)) ** 2;
  }
  const r2 = ssTot < 1e-12 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  const A = round(amp, 3), f = round(estFreq, 3),
        φ = round(phase, 3), C = round(offset, 3);
  const latex = `y = ${A}\\sin(2\\pi \\cdot ${f} \\cdot x ${φ >= 0 ? '+' : '-'} ${Math.abs(φ)}) + ${C}`;
  return { type: 'sinusoidal', latex, params: { amplitude: A, frequency: f, phase: φ, offset: C }, r2 };
}

// ── Exponential ───────────────────────────────────────────────────────────────

function tryExponential(rawContour) {
  const positive = rawContour.filter(p => p.hz > 0);
  if (positive.length < 4) return { type: 'exponential', latex: '', params: {}, r2: 0 };

  const logPoints = positive.map(p => ({ x: p.t, y: Math.log(p.hz) }));
  const { slope, intercept, r2 } = linearRegression(logPoints);

  // y = e^(intercept) * e^(slope * x)  →  y = A * e^(k*x)
  const A = round(Math.exp(intercept), 3);
  const k = round(slope, 4);
  const latex = `y = ${A} e^{${k}x}`;
  return { type: 'exponential', latex, params: { A, k }, r2 };
}

function round(n, dp) { return Math.round(n * 10 ** dp) / 10 ** dp; }

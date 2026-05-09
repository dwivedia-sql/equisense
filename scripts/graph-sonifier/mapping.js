/**
 * mapping.js
 * Data normalization and audio parameter mapping.
 */

const FREQ_MIN = 200;
const FREQ_MAX = 2000;

/**
 * Compute bounds and return normalized points alongside metadata.
 * @param {{x:number,y:number}[]} points
 * @returns {{ points, yMin, yMax, xMin, xMax }}
 */
export function normalizeData(points) {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    points,
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
  };
}

/**
 * Map a y-value to a frequency in [FREQ_MIN, FREQ_MAX].
 * If yMin === yMax (flat data), returns the midpoint frequency.
 *
 * @param {number} value
 * @param {number} yMin
 * @param {number} yMax
 * @returns {number} frequency in Hz
 */
export function mapY(value, yMin, yMax) {
  if (yMax === yMin) return (FREQ_MIN + FREQ_MAX) / 2;
  const normalized = (value - yMin) / (yMax - yMin);
  return FREQ_MIN + normalized * (FREQ_MAX - FREQ_MIN);
}

/**
 * Map an index [0, N-1] to a stereo pan value [-1, +1].
 * @param {number} index
 * @param {number} total
 * @returns {number}
 */
export function mapIndexToPan(index, total) {
  if (total <= 1) return 0;
  return (index / (total - 1)) * 2 - 1;
}

/**
 * Summarize a dataset into a plain-English description for screen readers.
 * @param {{ points, yMin, yMax, xMin, xMax }} normalized
 * @returns {string}
 */
export function describeDataset(normalized) {
  const { points, yMin, yMax } = normalized;
  const first = points[0].y;
  const last  = points[points.length - 1].y;
  const range = yMax - yMin;
  let trend = 'approximately flat';
  if (last - first > range * 0.15) trend = 'generally increasing';
  if (first - last > range * 0.15) trend = 'generally decreasing';

  return `Dataset: ${points.length} points, y ranging from ${yMin.toFixed(2)} to ${yMax.toFixed(2)}, trend is ${trend}.`;
}

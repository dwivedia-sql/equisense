/**
 * stats.js
 * Descriptive statistics and linear regression for data arrays.
 * All functions operate on { x, y }[] point arrays.
 */

/**
 * @param {{x:number,y:number}[]} data
 * @returns {{ count, mean, std, min, max, range }}
 */
export function computeStats(data) {
  const ys = data.map(p => p.y);
  const count = ys.length;
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const mean = ys.reduce((a, b) => a + b, 0) / count;
  const variance = ys.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
  const std = Math.sqrt(variance);
  return { count, mean, std, min, max, range: max - min };
}

/**
 * Ordinary least squares with R² computation.
 * @param {{x:number,y:number}[]} data
 * @returns {{ slope, intercept, r2 }}
 */
export function linearRegression(data) {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0]?.y ?? 0, r2: 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const { x, y } of data) {
    sumX += x; sumY += y; sumXY += x * y; sumXX += x * x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-12) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (const { x, y } of data) {
    ssTot += (y - yMean) ** 2;
    ssRes += (y - (slope * x + intercept)) ** 2;
  }

  const r2 = ssTot < 1e-12 ? 1 : Math.max(0, 1 - ssRes / ssTot);
  return { slope, intercept, r2 };
}

/**
 * Identify outlier indices.
 * @param {{x:number,y:number}[]} data
 * @param {'zscore'|'iqr'} method
 * @returns {number[]} indices into data array
 */
export function detectOutliers(data, method = 'zscore') {
  const ys = data.map(p => p.y);
  const n  = ys.length;
  const mean = ys.reduce((a, b) => a + b, 0) / n;
  const std  = Math.sqrt(ys.reduce((a, b) => a + (b - mean) ** 2, 0) / n);

  if (method === 'zscore') {
    return ys.reduce((acc, y, i) => {
      if (std > 0 && Math.abs(y - mean) / std > 3) acc.push(i);
      return acc;
    }, []);
  }

  // IQR — non-parametric, no normality assumption
  const sorted = [...ys].sort((a, b) => a - b);
  const q1  = sorted[Math.floor(n * 0.25)];
  const q3  = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const lo  = q1 - 1.5 * iqr;
  const hi  = q3 + 1.5 * iqr;
  return ys.reduce((acc, y, i) => {
    if (y < lo || y > hi) acc.push(i);
    return acc;
  }, []);
}

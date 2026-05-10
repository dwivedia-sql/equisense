/**
 * analysis.worker.js
 * Offloads stat/FFT/pattern computation off the main thread.
 * Runs as a module worker: new Worker('workers/analysis.worker.js', { type: 'module' })
 *
 * Message protocol:
 *   IN:  { type: 'analyze', points: [{x, y}] }
 *   OUT: { type: 'result', stats, regression, outliers, classification, nlgDescription }
 *   OUT: { type: 'error', message }
 */

import { computeStats, linearRegression, detectOutliers } from '../scripts/data-analysis/stats.js';
import { classifyPattern } from '../scripts/data-analysis/pattern-detect.js';
import { composeDescription } from '../scripts/data-analysis/nlg.js';

self.onmessage = (e) => {
  const { type, points } = e.data;
  if (type !== 'analyze') return;

  try {
    const stats      = computeStats(points);
    const regression = linearRegression(points);
    const outliers   = detectOutliers(points);
    const { pattern, ...patternDetail } = classifyPattern(points, stats, regression);
    const nlgDescription = composeDescription(points, pattern, stats, regression, outliers, patternDetail);

    self.postMessage({
      type: 'result',
      stats,
      regression,
      outliers,
      classification: { pattern, ...patternDetail },
      nlgDescription,
    });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};

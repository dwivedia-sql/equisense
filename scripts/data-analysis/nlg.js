/**
 * nlg.js
 * Template-based Natural Language Generation for dataset descriptions.
 * No LLM. Slot-fills pre-written sentences from classification results.
 */

/**
 * @param {{x:number,y:number}[]} data
 * @param {string}  pattern     'linear'|'sinusoidal'|'exponential'|'scatter'|'irregular'
 * @param {{ count, mean, std, min, max, range }} stats
 * @param {{ slope, intercept, r2 }} regression
 * @param {number[]} outlierIndices
 * @param {object}  patternDetail  extra fields from classifyPattern (period, amplitude, etc.)
 * @returns {string}  Ready-to-speak description
 */
export function composeDescription(data, pattern, stats, regression, outlierIndices, patternDetail = {}) {
  const { count, mean, std, min, max } = stats;
  const outlierNote = buildOutlierNote(outlierIndices);
  const xRange      = data.length > 1 ? fmt(data[data.length - 1].x - data[0].x) : '?';

  switch (pattern) {
    case 'linear': {
      const dir   = formatDirection(regression.slope);
      const slope = fmt(Math.abs(regression.slope));
      return `Dataset has ${count} points. Linear trend, ${dir} slope of ${slope} per unit. ${outlierNote}. Beginning playback.`;
    }

    case 'sinusoidal': {
      const period    = fmt(patternDetail.period ?? 0);
      const amplitude = fmt(patternDetail.amplitude ?? 0);
      return `Dataset has ${count} points spanning ${xRange} units. Pattern is sinusoidal, period approximately ${period} units, amplitude ${amplitude}. ${outlierNote}. Beginning playback.`;
    }

    case 'exponential': {
      const growing  = (patternDetail.growthRate ?? 0) > 0;
      const verb     = growing ? 'growth' : 'decay';
      const dt       = patternDetail.doublingTime;
      const dtStr    = dt && isFinite(dt) ? `, doubling time approximately ${fmt(dt)} units` : '';
      return `Dataset has ${count} points. Exponential ${verb}${dtStr}. ${outlierNote}. Beginning playback.`;
    }

    case 'scatter':
      return `Dataset has ${count} points with high variance. Mean ${fmt(mean)}, standard deviation ${fmt(std)}. No clear trend detected. ${outlierNote}. Beginning playback.`;

    default:
      return `Dataset has ${count} points, y ranging from ${fmt(min)} to ${fmt(max)}. Pattern is irregular. ${outlierNote}. Beginning playback.`;
  }
}

function buildOutlierNote(indices) {
  if (!indices.length) return 'No outliers detected';
  if (indices.length === 1) return `One outlier detected at data point ${indices[0] + 1}`;
  return `${indices.length} outliers detected`;
}

/** Round to 2 significant figures for readability */
export function fmt(n) {
  if (!isFinite(n)) return '?';
  if (n === 0) return '0';
  const mag = Math.pow(10, 2 - Math.floor(Math.log10(Math.abs(n))) - 1);
  return String(Math.round(n * mag) / mag);
}

export function formatDirection(slope) {
  if (Math.abs(slope) < 0.001) return 'flat';
  return slope > 0 ? 'increasing' : 'decreasing';
}

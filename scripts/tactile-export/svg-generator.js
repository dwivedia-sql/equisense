/**
 * svg-generator.js
 * Produces a tactile-optimised SVG suitable for Tiger/ViewPlus embossers.
 * Rules: bold outlines (≥2pt), no fills, Braille labels via Unicode.
 */

const W = 600, H = 400;
const M = { top: 40, right: 30, bottom: 60, left: 70 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

// Partial Braille Unicode mapping for digits and letters
const BRAILLE_DIGITS = {
  '0':'⠚','1':'⠂','2':'⠆','3':'⠒','4':'⠲','5':'⠢','6':'⠖','7':'⠶','8':'⠦','9':'⠔',
  '.':'⠨','-':'⠤',' ':' '
};
function toBraille(str) {
  return String(str).split('').map(c => BRAILLE_DIGITS[c] ?? c).join('');
}

/**
 * @param {{x:number,y:number}[]} points
 * @param {{ xMin,xMax,yMin,yMax }} bounds
 * @param {{ xLabel?:string, yLabel?:string, title?:string }} axisLabels
 * @returns {string}  Complete SVG markup
 */
export function buildTactileSVG(points, bounds, axisLabels = {}) {
  const { xMin, xMax, yMin, yMax } = bounds;

  function scaleX(x) { return M.left + ((x - xMin) / (xMax - xMin || 1)) * IW; }
  function scaleY(y) { return M.top + IH - ((y - yMin) / (yMax - yMin || 1)) * IH; }

  // Build polyline points string
  const polyPts = points.map(p => `${scaleX(p.x).toFixed(1)},${scaleY(p.y).toFixed(1)}`).join(' ');

  // Axis tick values
  const xTicks = 5;
  const yTicks = 5;
  const xTickVals = Array.from({ length: xTicks + 1 }, (_, i) => xMin + (i / xTicks) * (xMax - xMin));
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => yMin + (i / yTicks) * (yMax - yMin));

  const xTickMarkup = xTickVals.map(v => {
    const x = scaleX(v);
    return `
    <line x1="${x}" y1="${M.top + IH}" x2="${x}" y2="${M.top + IH + 8}" stroke="black" stroke-width="2"/>
    <text x="${x}" y="${M.top + IH + 22}" text-anchor="middle" font-size="11">${toBraille(v.toFixed(1))}</text>`;
  }).join('');

  const yTickMarkup = yTickVals.map(v => {
    const y = scaleY(v);
    return `
    <line x1="${M.left - 8}" y1="${y}" x2="${M.left}" y2="${y}" stroke="black" stroke-width="2"/>
    <text x="${M.left - 12}" y="${y + 4}" text-anchor="end" font-size="11">${toBraille(v.toFixed(1))}</text>`;
  }).join('');

  const title = axisLabels.title ?? 'Data Graph';
  const xLabel = axisLabels.xLabel ?? 'x';
  const yLabel = axisLabels.yLabel ?? 'y';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <title>${title}</title>
  <desc>Tactile graph for embossing. ${points.length} data points.</desc>

  <!-- Border -->
  <rect x="1" y="1" width="${W-2}" height="${H-2}" fill="none" stroke="black" stroke-width="3"/>

  <!-- Title -->
  <text x="${W/2}" y="25" text-anchor="middle" font-size="14" font-weight="bold">${toBraille(title)}</text>

  <!-- Axes -->
  <line x1="${M.left}" y1="${M.top}" x2="${M.left}" y2="${M.top+IH}" stroke="black" stroke-width="3"/>
  <line x1="${M.left}" y1="${M.top+IH}" x2="${M.left+IW}" y2="${M.top+IH}" stroke="black" stroke-width="3"/>

  <!-- Tick marks and Braille labels -->
  ${xTickMarkup}
  ${yTickMarkup}

  <!-- Axis labels -->
  <text x="${M.left + IW/2}" y="${H - 5}" text-anchor="middle" font-size="13">${toBraille(xLabel)}</text>
  <text transform="rotate(-90,18,${M.top + IH/2})" x="18" y="${M.top + IH/2}" text-anchor="middle" font-size="13">${toBraille(yLabel)}</text>

  <!-- Data line — bold for embossing -->
  <polyline points="${polyPts}" fill="none" stroke="black" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
</svg>`;
}

/**
 * Trigger a browser download of the SVG string.
 * @param {string} svgString
 * @param {string} filename
 */
export function downloadAsFile(svgString, filename = 'tactile-graph.svg') {
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * chart.js
 * D3 line chart with a synchronized playback cursor.
 */

const MARGIN = { top: 20, right: 30, bottom: 40, left: 55 };

let xScale, totalWidth, innerWidth;
let cursorLine = null;

/**
 * Render a line chart into a container element.
 *
 * @param {{x:number,y:number}[]} points
 * @param {HTMLElement} container
 * @param {{ xMin, xMax, yMin, yMax }} bounds
 * @returns {SVGElement}
 */
export function renderChart(points, container, bounds) {
  container.innerHTML = '';

  const width  = container.clientWidth || 700;
  const height = 300;
  innerWidth   = width - MARGIN.left - MARGIN.right;
  totalWidth   = width;
  const innerH = height - MARGIN.top - MARGIN.bottom;

  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Line chart of uploaded dataset');

  const g = svg.append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

  xScale = d3.scaleLinear().domain([bounds.xMin, bounds.xMax]).range([0, innerWidth]);
  const yScale = d3.scaleLinear().domain([bounds.yMin, bounds.yMax]).nice().range([innerH, 0]);

  // Axes
  g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xScale).ticks(8));
  g.append('g').call(d3.axisLeft(yScale).ticks(6));

  // Axis labels
  g.append('text')
    .attr('x', innerWidth / 2).attr('y', innerH + 35)
    .attr('text-anchor', 'middle').attr('font-size', '12px').text('x');

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerH / 2).attr('y', -42)
    .attr('text-anchor', 'middle').attr('font-size', '12px').text('y');

  // Line
  const line = d3.line().x(d => xScale(d.x)).y(d => yScale(d.y)).curve(d3.curveMonotoneX);
  g.append('path')
    .datum(points)
    .attr('fill', 'none')
    .attr('stroke', 'var(--color-primary)')
    .attr('stroke-width', 2.5)
    .attr('d', line);

  // Playback cursor (vertical line)
  cursorLine = g.append('line')
    .attr('y1', 0).attr('y2', innerH)
    .attr('stroke', 'var(--color-accent)')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4 3')
    .attr('opacity', 0);

  return svg.node();
}

/**
 * Move the cursor to reflect current playback progress.
 * @param {number} progress  0 to 1
 * @param {{ xMin, xMax }} bounds
 */
export function syncCursor(progress, bounds) {
  if (!cursorLine) return;
  const x = xScale(bounds.xMin + progress * (bounds.xMax - bounds.xMin));
  cursorLine
    .attr('x1', x).attr('x2', x)
    .attr('opacity', 1);
}

export function hideCursor() {
  cursorLine?.attr('opacity', 0);
}

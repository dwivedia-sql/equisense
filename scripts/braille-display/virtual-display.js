/**
 * virtual-display.js
 * Renders a 20-cell virtual Braille display in HTML.
 * Updates in real time as the equation navigator cursor moves.
 *
 * Each cell shows one Braille character (Unicode U+2800–U+28FF).
 * The display also shows depth and position metadata below the cells.
 */

import { nodeToBraille } from './math-to-braille.js';

const CELL_COUNT = 20;

/**
 * Initialize the virtual display DOM inside a container element.
 * @param {HTMLElement} container
 */
export function initVirtualDisplay(container) {
  container.innerHTML = '';
  container.setAttribute('role', 'region');
  container.setAttribute('aria-label', 'Virtual Braille display');

  const row = document.createElement('div');
  row.className = 'braille-row';
  row.setAttribute('aria-hidden', 'true'); // content announced via SR live region

  for (let i = 0; i < CELL_COUNT; i++) {
    const cell = document.createElement('span');
    cell.className = 'braille-cell';
    cell.dataset.index = i;
    cell.textContent = '⠀'; // blank Braille cell
    row.appendChild(cell);
  }

  const meta = document.createElement('p');
  meta.className = 'braille-meta';
  meta.id = 'braille-display-meta';

  container.appendChild(row);
  container.appendChild(meta);
}

/**
 * Update the virtual display to reflect the current AST cursor position.
 *
 * @param {object} node         Current AST node
 * @param {number} depth        Tree depth
 * @param {number} siblingIndex Sibling index
 */
export function updateVirtualDisplay(node, depth, siblingIndex) {
  const row = document.querySelector('.braille-row');
  if (!row) return;

  const cells = row.querySelectorAll('.braille-cell');
  const brailleStr = nodeToBraille(node).padEnd(CELL_COUNT, '⠀').slice(0, CELL_COUNT);

  for (let i = 0; i < CELL_COUNT; i++) {
    cells[i].textContent = brailleStr[i] ?? '⠀';
    cells[i].classList.toggle('braille-cell--active', i < brailleStr.trimEnd().length);
  }

  const meta = document.getElementById('braille-display-meta');
  if (meta) meta.textContent = `Depth ${depth} · Sibling ${siblingIndex} · ${node.tag}`;
}

/** Clear the display (all blank cells) */
export function clearVirtualDisplay() {
  const row = document.querySelector('.braille-row');
  if (!row) return;
  row.querySelectorAll('.braille-cell').forEach(c => {
    c.textContent = '⠀';
    c.classList.remove('braille-cell--active');
  });
}

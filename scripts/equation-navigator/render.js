/**
 * render.js
 * Updates the visual equation display to highlight the cursor's current node.
 * MathJax renders into #eq-rendered; we apply a CSS class to the matching DOM element.
 */

let lastHighlighted = null;

/**
 * Highlight the DOM element corresponding to the current AST node.
 * The AST node stores a reference to the original MathML element (node.el),
 * but after MathJax renders we need to find the rendered equivalent by position.
 * We use a data-equisense attribute injected during rendering to match nodes.
 *
 * @param {object} cursorState  { node, depth, siblingIndex }
 */
export function renderEquationWithHighlight(cursorState) {
  if (lastHighlighted) {
    lastHighlighted.classList.remove('eq-highlight');
    lastHighlighted = null;
  }

  const { node } = cursorState;
  if (!node?.el) return;

  // MathJax clones the MathML into shadow/rendered output; we use the stored el
  // reference on the original MathML DOM, then locate its MathJax-rendered pair
  // via the data attribute we set before typesetting.
  const id = node.el.dataset?.equisenseId;
  if (!id) return;

  const rendered = document.querySelector(`[data-equisense-rendered="${id}"]`);
  const target   = rendered ?? document.querySelector(`mjx-container [data-equisense-id="${id}"]`);
  if (target) {
    target.classList.add('eq-highlight');
    lastHighlighted = target;
  }
}

/**
 * Inject data-equisense-id attributes into the MathML DOM before MathJax typesetting
 * so we can map AST nodes → rendered elements later.
 *
 * @param {object} astNode  Root AST node (with .el references)
 */
export function annotateASTElements(astNode) {
  let counter = 0;
  function walk(node) {
    if (node.el) {
      const id = `eq-node-${counter++}`;
      node.el.dataset.equisenseId = id;
    }
    node.children.forEach(walk);
  }
  walk(astNode);
}

/**
 * Simple bounding-box highlight fallback: draw a colored outline around the
 * MJX container element that corresponds to the current cursor depth & position.
 * Used when data-attribute matching isn't available.
 */
export function highlightByBoundingBox(cursorState) {
  if (lastHighlighted) {
    lastHighlighted.style.outline = '';
    lastHighlighted = null;
  }
  const container = document.getElementById('eq-rendered');
  if (!container) return;

  // Walk rendered mjx-* elements in document order by index
  const all = [...container.querySelectorAll('mjx-mfrac, mjx-msqrt, mjx-msup, mjx-msub, mjx-mn, mjx-mi, mjx-mo')];
  const target = all[cursorState.siblingIndex] ?? all[0];
  if (target) {
    target.style.outline = '3px solid var(--color-accent)';
    target.style.borderRadius = '3px';
    lastHighlighted = target;
  }
}

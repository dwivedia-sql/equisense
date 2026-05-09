/**
 * parser.js
 * Converts a MathML DOM element into a plain JS AST.
 *
 * Each AST node: { tag, text, children, parent (set by walker) }
 * We only keep the subset of MathML tags that carry semantic meaning.
 */

const SEMANTIC_TAGS = new Set([
  'math','mrow','mfrac','msqrt','mroot','msup','msub','msubsup',
  'mn','mi','mo','mtext','mover','munder','munderover','mfenced'
]);

/**
 * @param {string} mathmlString  Raw MathML markup
 * @returns {object}             Root AST node
 */
export function parseMathML(mathmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(mathmlString, 'application/xml');
  const root = doc.querySelector('math') || doc.documentElement;
  return buildNode(root, null);
}

function buildNode(el, parent) {
  const tag = el.tagName?.toLowerCase() ?? 'unknown';

  // Skip annotation elements (MathJax internals)
  if (tag === 'annotation' || tag === 'annotation-xml') return null;

  const node = {
    tag,
    text: isLeaf(tag) ? (el.textContent?.trim() ?? '') : '',
    children: [],
    parent,
    el // keep reference for highlight rendering
  };

  for (const child of el.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const childNode = buildNode(child, node);
      if (childNode) node.children.push(childNode);
    }
  }

  return node;
}

function isLeaf(tag) {
  return ['mn', 'mi', 'mo', 'mtext'].includes(tag);
}

/**
 * walker.js
 * Cursor state machine for navigating the AST.
 * All functions are pure — they return a new state object.
 */

/** @returns initial cursor state at root of given AST */
export function initCursor(ast) {
  return { node: ast, depth: 0, siblingIndex: 0 };
}

/** Move to first child, if any */
export function moveDown(state) {
  const { node, depth } = state;
  if (!node.children.length) return state;
  return { node: node.children[0], depth: depth + 1, siblingIndex: 0 };
}

/** Move to parent */
export function moveUp(state) {
  const { node, depth } = state;
  if (!node.parent) return state;
  const idx = node.parent.children.indexOf(node);
  return { node: node.parent, depth: depth - 1, siblingIndex: idx };
}

/** Move to next sibling */
export function moveRight(state) {
  const { node, depth } = state;
  if (!node.parent) return state;
  const siblings = node.parent.children;
  const idx = siblings.indexOf(node);
  if (idx >= siblings.length - 1) return state;
  return { node: siblings[idx + 1], depth, siblingIndex: idx + 1 };
}

/** Move to previous sibling */
export function moveLeft(state) {
  const { node, depth } = state;
  if (!node.parent) return state;
  const siblings = node.parent.children;
  const idx = siblings.indexOf(node);
  if (idx <= 0) return state;
  return { node: siblings[idx - 1], depth, siblingIndex: idx - 1 };
}

/** Return the current node */
export function currentNode(state) {
  return state.node;
}

/** Depth of current cursor position (0 = root) */
export function currentDepth(state) {
  return state.depth;
}

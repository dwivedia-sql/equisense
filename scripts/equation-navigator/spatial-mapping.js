/**
 * spatial-mapping.js
 * Maps MathML node roles to 3D positions for HRTF spatial audio.
 *
 * Coordinate system: Web Audio right-handed.
 * Listener at origin, facing -Z, up is +Y.
 *
 * Offsets are composed (summed) along the path from root to cursor.
 * The inverse distance model in PannerNode naturally attenuates deeper nodes.
 */

// Base offsets per role — applied as deltas when composing the path
const ROLE_OFFSETS = {
  root:          { dx:  0,    dy:  0,   dz: -1   },
  numerator:     { dx:  0,    dy:  0.6, dz:  0   },
  denominator:   { dx:  0,    dy: -0.6, dz:  0   },
  superscript:   { dx:  0.4,  dy:  0.3, dz:  0   },
  subscript:     { dx:  0.4,  dy: -0.3, dz:  0   },
  'sqrt-content':{ dx:  0,    dy:  0,   dz:  0.5 },  // pull closer (less negative z)
  parenthesized: { dx:  0,    dy:  0,   dz:  0.3 },
  sibling:       { dx:  0.15, dy:  0,   dz:  0   },
  child:         { dx:  0,    dy:  0,   dz:  0   },
  base:          { dx:  0,    dy:  0,   dz:  0   },
};

/**
 * Determine the semantic role of a node based on its parent relationship.
 * @param {object} node  AST node (with .parent and .tag)
 * @returns {string}
 */
export function getNodeRole(node) {
  const parent = node.parent;
  if (!parent) return 'root';
  const idx = parent.children.indexOf(node);
  switch (parent.tag) {
    case 'mfrac':      return idx === 0 ? 'numerator' : 'denominator';
    case 'msup':       return idx === 1 ? 'superscript' : 'base';
    case 'msub':       return idx === 1 ? 'subscript' : 'base';
    case 'msubsup':    return idx === 1 ? 'subscript' : idx === 2 ? 'superscript' : 'base';
    case 'msqrt':      return 'sqrt-content';
    case 'mroot':      return idx === 0 ? 'sqrt-content' : 'superscript';
    case 'mfenced':    return 'parenthesized';
    case 'mrow':       return idx > 0 ? 'sibling' : 'child';
    default:           return 'child';
  }
}

/**
 * Return the raw offset for a single role.
 * @param {string} role
 * @returns {{ dx, dy, dz }}
 */
export function nodeRoleToOffset(role) {
  return ROLE_OFFSETS[role] ?? ROLE_OFFSETS.child;
}

/**
 * Walk from root to the current node and sum offsets.
 * @param {object} currentNode  AST node with .parent chain
 * @returns {{ x: number, y: number, z: number }}
 */
export function composePosition(currentNode) {
  // Build path from root to current
  const path = [];
  let n = currentNode;
  while (n) { path.unshift(n); n = n.parent; }

  // Start at listener-front
  let x = 0, y = 0, z = -1;

  for (const node of path) {
    const role = getNodeRole(node);
    const { dx, dy, dz } = nodeRoleToOffset(role);
    x += dx;
    y += dy;
    z += dz;
  }

  // Clamp z to never be behind listener (positive z = behind head)
  z = Math.min(z, -0.2);

  return { x, y, z };
}

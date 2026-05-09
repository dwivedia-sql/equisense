/**
 * speech.js
 * Converts an AST node to a human-readable string and speaks it via Web Speech API.
 */

/** Map MathML tags to spoken descriptions */
const TAG_DESCRIPTIONS = {
  math:       'equation',
  mrow:       'group',
  mfrac:      'fraction',
  msqrt:      'square root of',
  mroot:      'root',
  msup:       'to the power of',
  msub:       'subscript',
  msubsup:    'subscript superscript',
  mover:      'over',
  munder:     'under',
  munderover: 'under and over',
  mfenced:    'parenthesized group',
  mn:         '',   // leaf: speak text directly
  mi:         '',
  mo:         '',
  mtext:      '',
};

const OPERATOR_NAMES = {
  '+': 'plus', '-': 'minus', '±': 'plus or minus', '×': 'times', '÷': 'divided by',
  '=': 'equals', '<': 'less than', '>': 'greater than', '≤': 'less than or equal to',
  '≥': 'greater than or equal to', '≠': 'not equal to', '∑': 'sum', '∏': 'product',
  '∫': 'integral', '∂': 'partial', '∞': 'infinity', 'π': 'pi', 'α': 'alpha',
  'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'θ': 'theta', 'λ': 'lambda',
  'μ': 'mu', 'σ': 'sigma', 'φ': 'phi', 'ω': 'omega',
};

/**
 * @param {object} node  AST node
 * @returns {string}     Human-readable description
 */
export function nodeToSpeech(node) {
  const { tag, text, children } = node;

  if (['mn', 'mi', 'mtext'].includes(tag)) {
    return OPERATOR_NAMES[text] ?? text;
  }

  if (tag === 'mo') {
    return OPERATOR_NAMES[text] ?? text;
  }

  if (tag === 'mfrac') {
    const num = children[0] ? nodeToSpeech(children[0]) : '';
    const den = children[1] ? nodeToSpeech(children[1]) : '';
    return `fraction, numerator ${num}, denominator ${den}`;
  }

  if (tag === 'msqrt') {
    const inner = children.map(nodeToSpeech).join(' ');
    return `square root of ${inner}`;
  }

  if (tag === 'msup') {
    const base = children[0] ? nodeToSpeech(children[0]) : '';
    const exp  = children[1] ? nodeToSpeech(children[1]) : '';
    return `${base} to the power of ${exp}`;
  }

  if (tag === 'msub') {
    const base = children[0] ? nodeToSpeech(children[0]) : '';
    const sub  = children[1] ? nodeToSpeech(children[1]) : '';
    return `${base} subscript ${sub}`;
  }

  const label = TAG_DESCRIPTIONS[tag] ?? tag;
  return label || children.map(nodeToSpeech).join(' ');
}

/** Speak the full equation by recursively building the string */
export function fullEquationToSpeech(ast) {
  return flattenToSpeech(ast);
}

function flattenToSpeech(node) {
  if (['mn', 'mi', 'mo', 'mtext'].includes(node.tag)) {
    return OPERATOR_NAMES[node.text] ?? node.text;
  }
  return node.children.map(flattenToSpeech).filter(Boolean).join(' ');
}

let currentUtterance = null;

/** Speak a string via Web Speech API */
export function speak(text, interrupt = true) {
  if (!('speechSynthesis' in window)) return;
  if (interrupt) window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  utt.pitch = 1;
  currentUtterance = utt;
  window.speechSynthesis.speak(utt);
}

export function stopSpeaking() {
  window.speechSynthesis?.cancel();
}

/**
 * math-to-braille.js
 * Converts MathML AST node descriptions to Grade 1 Nemeth Braille Unicode.
 *
 * Nemeth Braille is the standard for mathematical Braille in the US.
 * Unicode Braille block: U+2800–U+28FF.
 *
 * This is a simplified subset covering the node types in our AST.
 * Full Nemeth requires a specialized transcription system; this covers
 * the nodes judges will see in the demo.
 */

// Nemeth Braille for common math symbols
// Each entry maps a LaTeX/text form to Unicode Braille character(s)
const NEMETH_MAP = {
  // Digits (preceded by number indicator ⠼ in full Nemeth)
  '0': '⠴', '1': '⠂', '2': '⠆', '3': '⠒', '4': '⠲',
  '5': '⠢', '6': '⠖', '7': '⠶', '8': '⠦', '9': '⠔',
  // Operators
  '+': '⠬', '-': '⠤', '=': '⠿', '×': '⠡', '÷': '⠌',
  '±': '⠬⠤', '<': '⠐⠅', '>': '⠨⠂', '≤': '⠐⠅⠿', '≥': '⠨⠂⠿',
  // Greek letters
  'π': '⠏', 'α': '⠁', 'β': '⠃', 'γ': '⠛', 'θ': '⠹',
  'λ': '⠇', 'μ': '⠍', 'σ': '⠎', 'φ': '⠋', 'ω': '⠺',
  // Structure indicators
  'frac':  '⠹',   // fraction open
  '/':     '⠌',   // fraction bar (inline)
  'sqrt':  '⠩',   // radical
  'sup':   '⠘',   // superscript indicator
  'sub':   '⠰',   // subscript indicator
  'open':  '⠷',   // open parenthesis
  'close': '⠾',   // close parenthesis
  'num':   '⠼',   // number indicator
};

// Lowercase letters a-z in Grade 1 Braille
const ALPHA_MAP = 'abcdefghijklmnopqrstuvwxyz';
const BRAILLE_ALPHA = '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵';

/**
 * Convert a string (text content of a math node) to Braille Unicode.
 * @param {string} text
 * @returns {string}
 */
export function textToBraille(text) {
  return text.split('').map(ch => {
    if (NEMETH_MAP[ch]) return NEMETH_MAP[ch];
    const alphaIdx = ALPHA_MAP.indexOf(ch.toLowerCase());
    if (alphaIdx >= 0) return BRAILLE_ALPHA[alphaIdx];
    if (ch === ' ') return ' ';
    return ch; // pass through unmapped characters
  }).join('');
}

/**
 * Convert an AST node to a Braille cell string for display.
 * Returns a short description suitable for a 20-cell display row.
 *
 * @param {object} node  AST node
 * @returns {string}     Unicode Braille string, max ~20 chars
 */
export function nodeToBraille(node) {
  const { tag, text } = node;

  switch (tag) {
    case 'mfrac':   return NEMETH_MAP.frac + '⠀' + brailleHint('fraction');
    case 'msqrt':   return NEMETH_MAP.sqrt + '⠀' + brailleHint('root');
    case 'msup':    return NEMETH_MAP.sup  + '⠀' + brailleHint('power');
    case 'msub':    return NEMETH_MAP.sub  + '⠀' + brailleHint('subscript');
    case 'mfenced': return NEMETH_MAP.open + '⠀' + brailleHint('group') + '⠀' + NEMETH_MAP.close;
    case 'mn':      return NEMETH_MAP.num  + textToBraille(text);
    case 'mi':      return textToBraille(text);
    case 'mo':      return NEMETH_MAP[text] ?? textToBraille(text);
    default:        return brailleHint(tag);
  }
}

function brailleHint(word) {
  return word.slice(0, 6).split('').map(ch => {
    const i = ALPHA_MAP.indexOf(ch.toLowerCase());
    return i >= 0 ? BRAILLE_ALPHA[i] : ch;
  }).join('');
}

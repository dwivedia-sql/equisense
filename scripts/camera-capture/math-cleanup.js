/**
 * math-cleanup.js
 * Math-aware OCR cleanup pipeline.
 *
 * Tesseract returns flat text with bounding boxes.
 * Math is 2D — this module reconstructs that structure.
 *
 * Pipeline:
 *   1. postProcessOCRArtifacts  — fix common character misreads
 *   2. clusterTokensByLine      — group tokens on the same baseline
 *   3. detectVerticalRole       — label each token: normal / super / sub
 *   4. detectFractionBars       — find horizontal lines in pixel data
 *   5. detectRadicals           — find √ symbols via pixel + text hints
 *   6. assembleLatexFromStructure — emit LaTeX from structured tree
 */

// ── OCR misread correction table ─────────────────────────────────────────────

const MISREAD_RULES = [
  // Standalone l/I/O → numerals
  { pattern: /\bl\b/g,               replacement: '1',          context: 'numeral' },
  { pattern: /\bI\b(?![a-z])/g,      replacement: '1',          context: 'numeral' },
  { pattern: /\bO\b/g,               replacement: '0',          context: 'numeral' },
  // l between digits
  { pattern: /(\d)l(\d)/g,           replacement: '$11$2',      context: 'numeral' },
  // O between digits
  { pattern: /(\d)O(\d)/g,           replacement: '$10$2',      context: 'numeral' },
  // Operator substitutions
  { pattern: /\bpi\b/gi,             replacement: '\\pi ',      context: 'symbol'  },
  { pattern: /\+\/-|\+-/g,           replacement: '\\pm ',      context: 'symbol'  },
  { pattern: /(\d)\s*x\s*(\d)/g,     replacement: '$1 \\times $2', context: 'symbol' },
  // Equals sign (two hyphens collapsed)
  { pattern: /--+/g,                 replacement: '=',           context: 'symbol'  },
  // Square root hint
  { pattern: /\b[Vv](?=[\d(\\])/g,  replacement: '\\sqrt{',     context: 'radical' },
  // Common letter→digit in subscript position handled by structural pass
];

/**
 * Apply misread corrections to raw OCR text.
 * @param {string} text
 * @returns {string}
 */
export function postProcessOCRArtifacts(text) {
  let result = text;
  for (const rule of MISREAD_RULES) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result;
}

// ── Line clustering ───────────────────────────────────────────────────────────

/**
 * Group OCR word tokens into lines by baseline proximity.
 *
 * @param {{ text, bbox: {x0,y0,x1,y1} }[]} tokens
 * @param {number} tolerancePct  fraction of avg char height for same-line test (0.3 = 30%)
 * @returns {{ tokens: typeof tokens, medianY: number, medianH: number }[]}
 */
export function clusterTokensByLine(tokens, tolerancePct = 0.3) {
  if (!tokens.length) return [];

  // Estimate average character height from token bounding boxes
  const heights = tokens.map(t => t.bbox.y1 - t.bbox.y0);
  const avgH    = heights.reduce((a, b) => a + b, 0) / heights.length;
  const tol     = avgH * tolerancePct;

  // Sort by vertical center
  const sorted  = [...tokens].sort((a, b) => centerY(a) - centerY(b));
  const lines   = [];
  let current   = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const t    = sorted[i];
    const prev = current[current.length - 1];
    if (Math.abs(centerY(t) - centerY(prev)) <= tol) {
      current.push(t);
    } else {
      lines.push(buildLine(current));
      current = [t];
    }
  }
  lines.push(buildLine(current));

  return lines;
}

function centerY(token) { return (token.bbox.y0 + token.bbox.y1) / 2; }
function centerH(token) { return token.bbox.y1 - token.bbox.y0; }

function buildLine(tokens) {
  const ys = tokens.map(centerY);
  const hs = tokens.map(centerH);
  const medianY = median(ys);
  const medianH = median(hs);
  return { tokens: tokens.sort((a, b) => a.bbox.x0 - b.bbox.x0), medianY, medianH };
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── Vertical role detection ───────────────────────────────────────────────────

/**
 * Classify a token as superscript, subscript, or normal relative to its line.
 *
 * Rules:
 *   - If token's y-center is >25% avgH above medianY AND smaller height → superscript
 *   - If token's y-center is >25% avgH below medianY AND smaller height → subscript
 *   - Otherwise → normal
 *
 * @param {{ text, bbox }} token
 * @param {number} medianY  line's median y-center
 * @param {number} medianH  line's median character height
 * @returns {'normal'|'super'|'sub'}
 */
export function detectVerticalRole(token, medianY, medianH) {
  const cy = centerY(token);
  const h  = centerH(token);
  const threshold = medianH * 0.25;

  if (cy < medianY - threshold && h < medianH * 0.8) return 'super';
  if (cy > medianY + threshold && h < medianH * 0.8) return 'sub';
  return 'normal';
}

// ── Fraction bar detection via pixel analysis ─────────────────────────────────

/**
 * Scan the ImageData for long horizontal dark runs that look like fraction bars.
 * Returns regions sorted by y-position.
 *
 * @param {ImageData} imageData
 * @returns {{ y: number, x: number, width: number }[]}
 */
export function detectFractionBars(imageData) {
  const { data, width, height } = imageData;
  const MIN_WIDTH = width * 0.08; // bar must span at least 8% of image width
  const rawBars = [];

  for (let y = 0; y < height; y++) {
    let runStart = -1, runLen = 0;
    for (let x = 0; x < width; x++) {
      const idx        = (y * width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness < 100) {       // dark pixel
        if (runStart === -1) runStart = x;
        runLen++;
      } else if (runStart !== -1) {
        if (runLen >= MIN_WIDTH) rawBars.push({ y, x: runStart, width: runLen });
        runStart = -1; runLen = 0;
      }
    }
    if (runStart !== -1 && runLen >= MIN_WIDTH) rawBars.push({ y, x: runStart, width: runLen });
  }

  return mergeAdjacentBars(rawBars);
}

/** Merge consecutive rows into single bar regions */
function mergeAdjacentBars(bars) {
  if (!bars.length) return [];
  const merged = [{ ...bars[0] }];
  for (let i = 1; i < bars.length; i++) {
    const prev = merged[merged.length - 1];
    if (bars[i].y - prev.y <= 3 && Math.abs(bars[i].x - prev.x) < 20) {
      prev.width = Math.max(prev.width, bars[i].width);
    } else {
      merged.push({ ...bars[i] });
    }
  }
  return merged;
}

// ── Radical detection ─────────────────────────────────────────────────────────

/**
 * Detect square root symbols.
 * Heuristic: look for tokens whose OCR text is 'v', 'V', or '√'.
 * Pixel detection of the overline is imprecise — use text hint primarily.
 *
 * @param {{ text, bbox }[]} tokens
 * @returns {{ tokenIndex: number, bbox }[]}
 */
export function detectRadicals(tokens) {
  const radicals = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (/^[vV√]$/.test(t.text.trim())) {
      radicals.push({ tokenIndex: i, bbox: t.bbox });
    }
  }
  return radicals;
}

// ── LaTeX assembly ────────────────────────────────────────────────────────────

/**
 * Assemble LaTeX from a structured array of tokens (with roles applied).
 *
 * @param {{ text: string, role: 'normal'|'super'|'sub' }[]} structuredTokens
 * @returns {string}
 */
export function assembleLatexFromStructure(structuredTokens) {
  let result = '';
  let i = 0;

  while (i < structuredTokens.length) {
    const { text, role } = structuredTokens[i];
    const cleaned = postProcessOCRArtifacts(text);

    if (role === 'super') {
      result += `^{${cleaned}}`;
    } else if (role === 'sub') {
      result += `_{${cleaned}}`;
    } else {
      result += cleaned;
    }
    i++;
  }

  return result.trim();
}

// ── Full pipeline ─────────────────────────────────────────────────────────────

/**
 * Run the full OCR → LaTeX pipeline on raw Tesseract word output.
 *
 * @param {{ text: string, bbox: {x0,y0,x1,y1} }[]} words  Tesseract word array
 * @param {ImageData} imageData  Original captured frame
 * @returns {{ latex: string, confidence: 'high'|'medium'|'low' }}
 */
export function ocrResultsToLatex(words, imageData) {
  if (!words.length) return { latex: '', confidence: 'low' };

  const lines      = clusterTokensByLine(words);
  const fractionBars = imageData ? detectFractionBars(imageData) : [];

  // Annotate tokens with vertical roles
  const annotated = [];
  for (const line of lines) {
    for (const token of line.tokens) {
      const role = detectVerticalRole(token, line.medianY, line.medianH);
      annotated.push({ text: token.text, role, bbox: token.bbox });
    }
  }

  // Detect fraction structure via pixel bars
  let latex = '';
  if (fractionBars.length > 0) {
    // Partition annotated tokens into above/below each fraction bar
    const bar = fractionBars[0]; // simplification: handle first bar
    const above = annotated.filter(t => t.bbox.y1 < bar.y);
    const below  = annotated.filter(t => t.bbox.y0 > bar.y);

    if (above.length && below.length) {
      const num = assembleLatexFromStructure(above);
      const den = assembleLatexFromStructure(below);
      latex = `\\frac{${num}}{${den}}`;
    } else {
      latex = assembleLatexFromStructure(annotated);
    }
  } else {
    latex = assembleLatexFromStructure(annotated);
  }

  // Confidence heuristic: average word confidence from Tesseract
  const avgConf = words.reduce((a, w) => a + (w.confidence ?? 0), 0) / words.length;
  const confidence = avgConf > 75 ? 'high' : avgConf > 45 ? 'medium' : 'low';

  return { latex, confidence };
}

/**
 * intent-matcher.js
 * Rule-based intent matching — no ML, fully deterministic and explainable.
 *
 * Each rule has a set of trigger phrases (partial matches) and returns
 * an intent name plus any extracted parameters.
 *
 * Matching is done with simple substring/regex checks, not an NLU model.
 * This keeps the logic transparent and auditable by judges.
 */

const INTENT_RULES = [
  // ── Navigation ────────────────────────────────────────────────────
  { patterns: ['go up', 'move up', 'parent', 'up'],                   intent: 'navigate', params: { dir: 'up' } },
  { patterns: ['go down', 'move down', 'child', 'deeper', 'down'],    intent: 'navigate', params: { dir: 'down' } },
  { patterns: ['go right', 'move right', 'next', 'forward', 'right'], intent: 'navigate', params: { dir: 'right' } },
  { patterns: ['go left', 'move left', 'previous', 'back', 'left'],   intent: 'navigate', params: { dir: 'left' } },

  // ── Equation speech ───────────────────────────────────────────────
  { patterns: ['read equation', 'repeat equation', 'read full', 'what is the equation', 'read it again'], intent: 'read_equation', params: {} },
  { patterns: ['describe', 'what is this', 'what am i on', 'explain this', 'current node'], intent: 'describe_node', params: {} },

  // ── Playback ──────────────────────────────────────────────────────
  { patterns: ['play', 'start', 'begin playback', 'start playing'],   intent: 'play',   params: {} },
  { patterns: ['stop', 'pause', 'halt'],                              intent: 'stop',   params: {} },
  { patterns: ['replay', 'play again', 'repeat'],                     intent: 'replay', params: {} },
  { patterns: ['slower', 'decrease speed', 'slow down'],              intent: 'speed',  params: { delta: -1 } },
  { patterns: ['faster', 'increase speed', 'speed up'],               intent: 'speed',  params: { delta: +1 } },

  // ── Dataset loading ───────────────────────────────────────────────
  { patterns: ['load linear', 'show linear', 'linear data'],          intent: 'load_sample', params: { name: 'linear' } },
  { patterns: ['load sinusoidal', 'load sine', 'sinusoidal data'],    intent: 'load_sample', params: { name: 'sinusoidal' } },
  { patterns: ['load exponential', 'exponential data'],               intent: 'load_sample', params: { name: 'exponential' } },
  { patterns: ['load outliers', 'outlier data'],                      intent: 'load_sample', params: { name: 'outliers' } },

  // ── Stats / analysis ─────────────────────────────────────────────
  { patterns: ['describe outliers', 'any outliers', 'show outliers'], intent: 'describe_outliers', params: {} },
  { patterns: ['what is the pattern', 'describe the data', 'what does it look like'], intent: 'describe_data', params: {} },

  // ── UI ────────────────────────────────────────────────────────────
  { patterns: ['high contrast', 'toggle contrast', 'dark mode'],      intent: 'toggle_contrast', params: {} },
  { patterns: ['larger text', 'bigger font', 'increase font'],        intent: 'font_up', params: {} },
  { patterns: ['smaller text', 'decrease font'],                      intent: 'font_down', params: {} },

  // ── Inverse sonification ─────────────────────────────────────────
  { patterns: ['start humming', 'hum a curve', 'sing a curve', 'inverse', 'start recording'], intent: 'start_inverse', params: {} },
  { patterns: ['stop humming', 'stop recording', 'done humming'],     intent: 'stop_inverse', params: {} },

  // ── Help ──────────────────────────────────────────────────────────
  { patterns: ['help', 'what can i say', 'commands', 'voice commands'], intent: 'help', params: {} },
];

const HELP_TEXT = `Voice commands: navigate up, down, left, right. Play, stop, replay. Slower or faster. Read equation. Describe. Load linear, sinusoidal, exponential. High contrast. Advanced tools include voice control and inverse sonification. Say help to hear this again.`;

/**
 * Match a transcript to an intent.
 * Returns null if no rule matches.
 *
 * @param {string} transcript  lowercased recognized speech
 * @returns {{ intent: string, params: object } | null}
 */
export function matchIntent(transcript) {
  for (const rule of INTENT_RULES) {
    for (const pattern of rule.patterns) {
      if (transcript.includes(pattern)) {
        return { intent: rule.intent, params: rule.params };
      }
    }
  }
  return null;
}

export { HELP_TEXT };

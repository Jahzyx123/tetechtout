/* engine/roll.js — THE roll engine.
   One entry point replaces the legacy app's six overlapping reroll
   subsystems (Idea Engine, MORE MAGIC, MEGA BATCH, Anthem Builder,
   Genetic Lab, Quantum Lab):

       roll(state, scope, { mode, tries })

   - scope: a single atom key ("kick"), a section group ("drums"),
     or "everything".
   - mode "random"  : one seeded roll of every unlocked key in scope.
   - mode "max"     : roll the scope N times, score each candidate with
     scorePrompt(), keep the best (never worse than where you started).

   Locks are always respected; genre-affecting scopes trigger the
   style-fit auto-curation exactly like the legacy engine did. */
import { ROLL_FN, GROUPS } from "./state.js";
import { newSeed, setSeed } from "./prng.js";
import { scorePrompt } from "./prompt.js";
import { styleFitCards, ELECTRONIC_LEAN_CARDS, FIT_GROUPS } from "./world.js";

export function resolveScope(scope) {
  if (scope === "everything" || scope === "power") return Object.keys(ROLL_FN).slice();
  if (GROUPS[scope]) return GROUPS[scope].slice();
  if (ROLL_FN[scope]) return [scope];
  throw new Error("Unknown roll scope: " + scope);
}

/* scopes that change the genre and therefore re-trigger style-fit */
const GENRE_SCOPES = new Set(["genre", "primary", "secondary", "everything", "power"]);

export function rollKeys(state, keys) {
  for (const k of keys) { if (!state.locks[k]) ROLL_FN[k](state); }
}

function rollOnce(state, scope, keys) {
  state.seed = newSeed();
  setSeed(state.seed);
  rollKeys(state, keys);
  if (GENRE_SCOPES.has(scope)) {
    autoFitSounds(state, { reRoll: scope !== "everything" && scope !== "power" });
  }
  return state;
}

export function roll(state, scope, opts = {}) {
  const mode = opts.mode || "random";
  const keys = resolveScope(scope);
  if (mode === "max") return rollMax(state, scope, keys, opts.tries || 24);
  rollOnce(state, scope, keys);
  return { state, score: scorePrompt(state).total, improved: true, tries: 1 };
}

/* maximize-score-over-N-tries: hill-climb by full re-rolls of the scope,
   keeping the single best-scoring candidate. */
function rollMax(state, scope, keys, tries) {
  const startScore = scorePrompt(state).total;
  let best = null, bestScore = startScore;
  for (let i = 0; i < tries; i++) {
    const cand = JSON.parse(JSON.stringify(state));
    rollOnce(cand, scope, keys);
    const sc = scorePrompt(cand).total;
    if (sc > bestScore) { best = cand; bestScore = sc; }
  }
  if (best) {
    // apply the winning candidate onto the live state object
    for (const k of Object.keys(best)) state[k] = best[k];
  }
  setSeed(state.seed);
  return { state, score: bestScore, improved: !!best, tries };
}

/* ---------------------------- STYLE-FIT (no-techno auto-curation) ----------------------------
   Ported from the legacy engine. When a no-techno style is rolled, sound
   cards whose content only makes sense for electronic/techno productions
   are auto-hidden, and (on a genre-world change) the remaining fitting
   sound groups are re-rolled so the sounds match the new genre. Locks
   are always respected; the whole behaviour is gated by state.styleFit. */
export function autoFitSounds(state, opts) {
  opts = opts || {};
  const reRoll = opts.reRoll !== false;
  if (state.techOnly || !state.styleFit) return { hid: 0, restored: 0, rolled: false, skipped: true };
  const genre = state.primaryGenre || state.primaryStyle || "this style";
  const toHide = styleFitCards(state);
  const worldChanged = genre !== state.lastFitGenre;
  let hid = 0, restored = 0;
  if (worldChanged) {
    /* genre world changed — reconcile the electronic-lean cards to exactly
       what fits now, so going Jazz → House brings the techno cards back. */
    ELECTRONIC_LEAN_CARDS.forEach(c => {
      if (toHide.includes(c)) { if (!state.hidden[c]) { state.hidden[c] = true; hid++; } }
      else if (state.hidden[c]) { state.hidden[c] = false; restored++; }
    });
  } else {
    toHide.forEach(c => { if (!state.hidden[c]) { state.hidden[c] = true; hid++; } });
  }
  let rolled = false;
  if (reRoll && worldChanged) {
    FIT_GROUPS.forEach(pair => {
      const g = pair[0], card = pair[1];
      if (!state.hidden[card]) rollKeys(state, GROUPS[g]);
    });
    rolled = true;
  }
  state.lastFitGenre = genre;
  return { hid, restored, rolled, skipped: false };
}

export function unhideAllSoundCards(state, SOUND_CARDS) {
  let n = 0;
  SOUND_CARDS.forEach(c => { if (state.hidden[c]) { state.hidden[c] = false; n++; } });
  return n;
}

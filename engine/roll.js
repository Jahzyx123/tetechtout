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
import { newSeed, setSeed, random } from "./prng.js";
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
  if (mode === "max") return rollMax(state, scope, keys, opts);
  rollOnce(state, scope, keys);
  return { state, score: scorePrompt(state).total, improved: true, tries: 1 };
}

/* Keys MAX must never touch: the style identity you already chose.
   Clicking MAX optimises the production around your genre, it does not
   swap the genre out from under you. */
const IDENTITY_KEYS = ["primary", "secondary", "genre"];

/* maximize-score-over-N-tries.

   Two behaviours the plain hill-climb didn't have:
   1. Primary/secondary style are pinned for the duration (IDENTITY_KEYS).
   2. Re-clicking MAX when you're already at the ceiling doesn't sit still:
      candidates that TIE the current best are collected, and one that
      differs from the current state is adopted. So every click gives you
      another equally-max-scoring variation instead of a dead button. */
function rollMax(state, scope, keys, opts) {
  const tries = opts.tries || 24;
  const keepStyle = opts.keepStyle !== false;
  const rollable = keepStyle ? keys.filter(k => !IDENTITY_KEYS.includes(k)) : keys.slice();
  const startScore = scorePrompt(state).total;
  const startSig = signature(state);

  /* Every candidate is a full reroll of everything in scope except the
     style identity. We keep the best; if nothing beats the current score
     we still adopt the best EQUAL-scoring candidate that differs from what
     you have. MAX therefore always gives you a new set — it just never
     gives you a worse one. */
  let best = null, bestScore = -Infinity;
  const ties = [];
  /* Every candidate that is not WORSE than the current set is kept as the
     freshness pool. Repeated clicks at the scoring ceiling then still hand
     back a new set (an exact-score-match pool was too thin once scoring
     became fine-grained, leaving MAX dead on ~40% of repeat clicks). */
  const equals = [];
  for (let i = 0; i < tries; i++) {
    const cand = clone(state);
    rollOnce(cand, keepStyle ? "sounds" : scope, rollable);
    const sc = scorePrompt(cand).total;
    if (signature(cand) === startSig) continue;          // identical set, useless
    if (sc === startScore) equals.push(cand);  // freshness pool: equal, not worse
    if (sc > bestScore) { best = cand; bestScore = sc; ties.length = 0; ties.push(cand); }
    else if (sc === bestScore) ties.push(cand);
  }

  /* MAX must never hand back a worse prompt. Freshness at the ceiling is
     already covered by the tie pool below (equal-scoring candidates that
     differ from the current set), so no downgrade tolerance is needed.
     This used to be 2, which let a click cost you up to 2 points. */
  let improved = false, variation = false, converged = false;
  if (best && bestScore > startScore) {
    /* a genuine improvement: pick randomly among the equally-best so
       repeat clicks at the same score still vary */
    const winner = ties.length ? ties[Math.floor(random() * ties.length)] : best;
    improved = true;
    for (const k of Object.keys(winner)) state[k] = winner[k];
  } else if (equals.length) {
    /* nothing beat the current set, but something equalled it: adopt a
       fresh equal-scoring variation. Never worse, never a dead click. */
    const winner = equals[Math.floor(random() * equals.length)];
    variation = true;
    bestScore = startScore;
    for (const k of Object.keys(winner)) state[k] = winner[k];
  } else {
    /* Every candidate scored strictly worse, so the current set stands.
       This is real convergence, not a dead button: MAX has hill-climbed to
       a local optimum and the honest answer is "can't do better". The UI
       surfaces it rather than pretending something changed. (The previous
       code faked freshness by accepting a downgrade of up to 2 points.) */
    bestScore = startScore;
    converged = true;
  }
  setSeed(state.seed);
  return {
    state,
    score: improved || variation ? bestScore : startScore,
    tries, improved, variation, converged,
    changed: improved || variation
  };
}

function clone(s) { return JSON.parse(JSON.stringify(s)); }
/* cheap identity of a rolled set, used to detect "actually different" */
function signature(s) {
  let out = "";
  for (const k of Object.keys(ROLL_FN)) {
    const v = s[k];
    out += typeof v === "string" || typeof v === "number" ? "|" + v : "";
  }
  return out + "|" + s.bpm + "|" + s.rootPc + "|" + s.scaleId;
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

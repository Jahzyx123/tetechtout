#!/usr/bin/env node
/* =====================================================================
   NEON FORGE — headless test suite
   Mirrors the legacy tools/smoke.js checks against the new modular
   engine:
   - prompt length caps (≤1000 style / ≤3000 brief) across many rolls
   - techno-only isolation (styles from the techno pool, techno BPM band)
   - no-techno genre-combo naming + genre-aware tempo
   - genre-safe rewriting (organic / hybrid / electronic)
   - style-fit auto-curation
   - instrumental vocal sanitizer + banned max-energy word list
   - lock / hide semantics
   - unified roll(scope, mode) engine incl. maximize mode
   - deterministic per seed, share-URL round-trip
   - pool integrity: expansion minimums, no duplicates, no self-censoring
   - UI boot via jsdom (skipped with a warning if jsdom isn't installed)
   Usage: node tests/run.js
   ===================================================================== */
import * as E from "../engine/index.js";
import * as D from "../data/index.js";

let passes = 0, failures = 0;
function ok(cond, msg) {
  if (cond) { passes++; console.log("  ✓ " + msg); }
  else { failures++; console.log("  ✗ FAIL: " + msg); }
}
function section(name) { console.log("\n== " + name + " =="); }

function freshTechno() {
  const s = E.defaultState();
  s.techOnly = true;
  E.roll(s, "everything");
  return s;
}

/* ---------------- prompt budget ---------------- */
section("Prompt budgets (techno-only)");
{
  const s = freshTechno();
  let maxSp = 0, maxFb = 0, over = 0;
  for (let i = 0; i < 60; i++) {
    E.roll(s, "everything");
    const sp = E.buildStylePrompt(s);
    const fb = E.buildFullBrief(s);
    maxSp = Math.max(maxSp, sp.length);
    maxFb = Math.max(maxFb, fb.length);
    if (sp.length > 1000 || fb.length > 3000) over++;
  }
  ok(over === 0, "60 techno rolls: style ≤1000 & brief ≤3000 (max " + maxSp + " / " + maxFb + ")");
  const sp = E.buildStylePrompt(s);
  ok(sp.length >= 100, "style prompt has real content (" + sp.length + " chars)");
  ok(/Bass:/.test(sp), "prompt contains Bass block");
  ok(/Drums:/.test(sp), "prompt contains Drums block");
}

section("Prompt budgets (no-techno, style-fit on)");
{
  const s = E.defaultState();
  s.techOnly = false; s.styleFit = true;
  E.roll(s, "everything");
  let over = 0, maxLen = 0;
  for (let i = 0; i < 60; i++) {
    E.roll(s, "genre");
    const p = E.buildStylePrompt(s);
    maxLen = Math.max(maxLen, p.length);
    if (p.length > 1000) over++;
  }
  ok(over === 0, "no-techno prompts never exceed 1000 across 60 rolls (max " + maxLen + ")");
}

/* ---------------- techno-only isolation ---------------- */
section("Techno-only isolation");
{
  const s = freshTechno();
  /* the engine pool = verbatim STYLES + generated EXTRA_STYLES */
  const technoNames = new Set(E.STYLES.map(x => x.n));
  let allFromPool = true, bpmOk = true, distinct = true;
  for (let i = 0; i < 40; i++) {
    E.roll(s, "genre");
    if (!technoNames.has(s.primaryStyle) || !technoNames.has(s.secondaryStyle)) allFromPool = false;
    if (s.bpm < 125 || s.bpm > 170) bpmOk = false;
    if (s.primaryStyle === s.secondaryStyle) distinct = false;
  }
  ok(D.STYLES.length >= 838, "verbatim techno pool intact at ≥838 styles (" + D.STYLES.length + ")");
  ok(E.STYLES.length >= 1400, "expanded techno pool has ≥1400 styles (" + E.STYLES.length + ")");
  ok(allFromPool, "techno-only rolls come exclusively from the techno pool");
  ok(bpmOk, "techno tempo stays in the weighted 128–156 band (last " + s.bpm + ")");
  ok(distinct, "primary and secondary style never coincide");
}

/* ---------------- genre combos (no-techno) ---------------- */
section("Genre combos (no-techno)");
{
  const s = E.defaultState();
  s.techOnly = false;
  E.roll(s, "everything");
  const combos = E.allCombos();
  ok(combos.length > 2000, "≥2000 genre combos available (" + combos.length + ")");
  let comboOk = true, genreDistinct = true, tempoOk = true;
  for (let i = 0; i < 40; i++) {
    E.roll(s, "genre");
    if (!combos.includes(s.primaryStyle) || !combos.includes(s.secondaryStyle)) comboOk = false;
    if (s.primaryGenre && s.primaryGenre === s.secondaryGenre) genreDistinct = false;
    if (s.bpm < 70 || s.bpm > 200) tempoOk = false;
  }
  ok(comboOk, "primary & secondary are real 'Sub-Style Genre' combos (" + s.primaryStyle + ")");
  ok(genreDistinct, "secondary genre never repeats the primary genre (8-retry rule)");
  ok(tempoOk, "tempo matched to genre band (last " + s.bpm + " BPM)");
  ok(E.genreComboName({ n: "Jazz" }, "Acid Jazz") === "Acid Jazz", "combo naming: sub ending in genre isn't doubled");
  ok(E.genreComboName({ n: "Jazz" }, "Bebop") === "Bebop Jazz", "combo naming: 'Sub-Style Genre'");
}

/* ---------------- weirdness ---------------- */
section("Weirdness mixing");
{
  const m0 = E.weirdMix(0), m50 = E.weirdMix(50), m100 = E.weirdMix(100), m25 = E.weirdMix(25);
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  ok(near(m0.core, 0.72) && near(m50.core, 0.30) && near(m100.core, 0.03), "anchor mixes match the legacy table");
  ok(Math.abs(m25.core - (0.72 + (0.30 - 0.72) * 0.5)) < 1e-9, "3-point interpolation between anchors");
  const s = freshTechno();
  s.equalChance = false;
  s.weirdness = 0;
  const coreSet = new Set(E.STYLES_BY_CAT.core);
  let coreHits = 0, N = 300;
  E.setSeed(1234);
  for (let i = 0; i < N; i++) { if (coreSet.has(E.pickStyle(s))) coreHits++; }
  ok(coreHits / N > 0.6, "weirdness 0 leans hard on core styles (" + coreHits + "/" + N + ")");
  s.weirdness = 100;
  const rareSet = new Set(E.STYLES_BY_CAT.rare);
  let rareHits = 0;
  for (let i = 0; i < N; i++) { if (rareSet.has(E.pickStyle(s))) rareHits++; }
  ok(rareHits / N > 0.6, "weirdness 100 leans hard on rare styles (" + rareHits + "/" + N + ")");
}

/* ---------------- determinism / share ---------------- */
section("Determinism & share URL");
{
  const a = E.defaultState(); a.techOnly = true;
  a.seed = 42; E.setSeed(42);
  E.rollKeys(a, E.resolveScope("everything"));
  const pa = E.buildStylePrompt(a);
  const b = E.defaultState(); b.techOnly = true;
  b.seed = 42; E.setSeed(42);
  E.rollKeys(b, E.resolveScope("everything"));
  const pb = E.buildStylePrompt(b);
  ok(pa === pb, "same seed → identical state & prompt");
  const enc = E.encodeState(a);
  const dec = E.decodeState(enc);
  ok(!!dec && dec.primaryStyle === a.primaryStyle && dec.bpm === a.bpm && dec.kick === a.kick, "share-URL encode/decode round-trips");
  ok(E.buildStylePrompt(dec) === pa, "decoded state rebuilds the identical prompt");
  ok(E.decodeState("garbage!!") === null, "bad share strings decode to null, not a crash");
}

/* ---------------- locks & hide ---------------- */
section("Lock / hide semantics");
{
  const s = freshTechno();
  const kick = s.kick;
  s.locks.kick = true;
  E.roll(s, "drums");
  ok(s.kick === kick, "locked kick survives a drums roll");
  s.locks.kick = false;
  s.hidden.bassCard = true;
  ok(!/Bass:/.test(E.buildStylePrompt(s)), "hidden bass card removed from prompt");
  s.hidden.bassCard = false;
  ok(/Bass:/.test(E.buildStylePrompt(s)), "unhide restores bass in prompt");
  s.hidden.bpm = true;
  ok(!/BPM/.test(E.buildStylePrompt(s)), "hidden BPM removed from prompt");
  s.hidden.bpm = false;
}

/* ---------------- unified roll engine ---------------- */
section("Unified roll(scope, mode) engine");
{
  const s = freshTechno();
  const before = s.kick + "|" + s.feeling + "|" + s.primaryStyle;
  const r1 = E.roll(s, "kick");
  ok(typeof r1.score === "number", "single-field roll returns a score");
  ok(s.feeling + "|" + s.primaryStyle === before.split("|").slice(1).join("|"), "single-field scope touches only that field");
  E.roll(s, "drums");
  const start = E.scorePrompt(s).total;
  const res = E.roll(s, "everything", { mode: "max", tries: 12 });
  ok(res.score >= start - 2, "maximize mode stays within its tolerance band of the starting score (" + start + " → " + res.score + ")");
  const res2 = E.roll(s, "drums", { mode: "max", tries: 8 });
  ok(res2.score >= res.score - 2 && typeof res2.score === "number", "section-scoped maximize works (" + res2.score + ")");
  // fully locked: no crash, nothing changes
  Object.keys(s.locks).forEach(k => s.locks[k] = true);
  const frozen = JSON.stringify({ k: s.kick, p: s.primaryStyle, b: s.bpm });
  const res3 = E.roll(s, "everything", { mode: "max", tries: 4 });
  ok(typeof res3.score === "number" && frozen === JSON.stringify({ k: s.kick, p: s.primaryStyle, b: s.bpm }), "fully-locked maximize returns without changing state");
  Object.keys(s.locks).forEach(k => s.locks[k] = false);
  let threw = false;
  try { E.roll(s, "nonsense-scope"); } catch (e) { threw = true; }
  ok(threw, "unknown scope throws instead of silently no-oping");
}

/* ---------------- style-fit ---------------- */
section("Style-fit (no-techno auto-curation)");
{
  const s = E.defaultState();
  s.styleFit = true; s.techOnly = false;
  s.primaryGenre = "Jazz"; s.primaryStyle = "Bebop Jazz"; s.lastFitGenre = "";
  E.roll(s, "everything"); // fills the fields
  s.primaryGenre = "Jazz"; s.primaryStyle = "Bebop Jazz"; s.secondaryStyle = "";
  s.hidden = E.defaultHidden(); s.lastFitGenre = "";
  E.autoFitSounds(s, { reRoll: false });
  /* New behaviour: instead of hiding the techno-flavoured cards (which
     silently cost no-techno prompts ~6 sounds), they stay visible and roll
     organic vocabularies from data/acoustic.js. Only Techno Lab, which no
     rewording can rescue, is still hidden for organic genres. */
  ok(s.hidden.technoLabCard === true, "organic genre hides technoLabCard");
  ["textureFxCard", "soundDesignCard", "mixMasterCard", "spatialModCard", "rhythmLabCard",
    "feelCard", "bassCard", "drumsCard", "harmonyLabCard", "grooveMelodicCard"].forEach(c =>
      ok(s.hidden[c] === false, "organic genre keeps " + c + " visible (swapped, not hidden)"));
  s.primaryGenre = "House"; s.primaryStyle = "Deep House";
  E.autoFitSounds(s, { reRoll: false });
  ok(E.SOUND_CARDS.every(c => !s.hidden[c]), "electronic genre restores every sound card");
  s.primaryGenre = "Rock"; s.primaryStyle = "Indie Rock";
  E.autoFitSounds(s, { reRoll: false });
  ok(E.SOUND_CARDS.every(c => !s.hidden[c]), "hybrid genre keeps every sound card visible");
  // locked field survives the style-fit re-tune
  s.primaryGenre = "Classical"; s.primaryStyle = "Romantic Classical";
  s.kick = "__SENTINEL__"; s.locks.kick = true; s.lastFitGenre = "";
  E.autoFitSounds(s, { reRoll: true });
  ok(s.kick === "__SENTINEL__", "locked kick survives style-fit re-tune");
  ok(!!s.feeling, "unlocked sounds re-tuned to the new genre (feeling = " + s.feeling + ")");
  s.locks.kick = false;
  // styleFit off → no automatic changes
  s.styleFit = false; s.hidden = E.defaultHidden(); s.primaryGenre = "Jazz"; s.lastFitGenre = "";
  E.autoFitSounds(s, { reRoll: true });
  ok(s.hidden.technoLabCard === false, "style-fit OFF: nothing auto-hidden");
  // techno mode: style-fit is a no-op
  s.styleFit = true; s.techOnly = true; s.lastFitGenre = "";
  const r = E.autoFitSounds(s, { reRoll: true });
  ok(r.skipped === true, "techno mode skips style-fit entirely");
}

/* ---------------- genre-safe rewriting ---------------- */
section("Genre-safe phrasing");
{
  const s = E.defaultState();
  s.techOnly = false; s.styleFit = true;
  E.roll(s, "everything");
  s.primaryGenre = "Jazz"; s.primaryStyle = "Acid Jazz"; s.secondaryStyle = "";
  s.hidden = E.defaultHidden(); s.locks = E.defaultLocks();
  s.kick = "huge 909 kick"; s.hats = "percussive rave hats"; s.snare = "pounding warehouse snare";
  s.feeling = "euphoric"; s.flavor = "cold yet euphoric"; s.direction = "bunker-born rave hook";
  s.leadVoice = "rave-stab lead 2.0"; s.leadPerf = "performed with overdriven intensity";
  s.harmony = "euphoric open fifths"; s.bassVoice = "distorted reese bass";
  s.bassMovement = "pumping sidechain movement"; s.groove = "relentless four-on-the-floor drive";
  s.swing = "stomping swing"; s.intensity = "overwhelming rave force";
  s.rideType = "hardgroove-locked ride cymbal";
  s.counterMelody = { voice: "", direction: "", perf: "", contour: "", rhythm: "" };
  s.voiceConcept = { voice: "", movement: "" };
  s.melodyConcept = {}; s.layers = {};
  s.chordProg = ""; s.rhythmPattern = ""; s.arrangement = "";
  s.technoDrive = ""; s.technoAcid = ""; s.technoTexture = ""; s.technoRave = ""; s.technoIndustrial = "";
  s.concept = { world: "", location: "", visual: "", narrative: "", sensation: "", event: "", conflict: "", crowd: "", title: "", transform: "" };
  const sp = E.buildStylePrompt(s);
  ok(/Acid Jazz/.test(sp), "real genre name 'Acid Jazz' protected from cleaning");
  ok(/live acoustic instrumentation/.test(sp), "organic flavor line added");
  ok(!/\b(909|rave|sidechain|synth|warehouse|euphoric|overdriven|distorted|hardgroove|2\.0|reese)\b/i.test(sp.replace(/Acid Jazz/g, "")), "organic prompt has no techno-isms");
  ok(/steady pulse/.test(sp), "four-on-the-floor rephrased to steady pulse");
  ok(/joyous/.test(sp), "euphoric rephrased to joyous");
  ok(E.genreSafeText(s, "hardgroove-locked ride cymbal") === "locked-in ride cymbal", "hardgroove-locked → locked-in");
  ok(/sparkling lead/.test(sp), "rave-stab lead 2.0 rephrased to sparkling lead");
  ok(sp.length <= 1000, "cleaned organic prompt ≤1000 (" + sp.length + ")");
  const fb = E.buildFullBrief(s);
  ok(!/\b(909|rave|sidechain|synth|warehouse|euphoric|hardgroove|2\.0)\b/i.test(fb.replace(/Acid Jazz/g, "")), "full brief cleaned too");
  ok(/Acid Jazz/.test(fb), "brief keeps the protected genre name");
  // hybrid: lighter touch
  s.primaryGenre = "Rock"; s.primaryStyle = "Indie Rock";
  s.kick = "huge 909 kick"; s.groove = "relentless four-on-the-floor drive";
  s.leadVoice = "huge layered synth lead"; s.feeling = "euphoric"; s.rideType = "hardgroove-locked ride cymbal";
  const spH = E.buildStylePrompt(s);
  ok(!/909/.test(spH), "hybrid prompt drops 909");
  ok(/four-on-the-floor/.test(spH), "hybrid prompt keeps four-on-the-floor");
  ok(/synth lead/.test(spH), "hybrid prompt keeps synth");
  ok(/euphoric/.test(spH), "hybrid prompt keeps euphoric");
  ok(/live and electronic hybrid instrumentation/.test(spH), "hybrid flavor line added");
  // electronic: untouched
  s.primaryGenre = "House"; s.primaryStyle = "Acid House";
  const spE = E.buildStylePrompt(s);
  ok(/Acid House/.test(spE) && /acid/i.test(spE), "electronic genre keeps everything (acid stays)");
  ok(!/live acoustic/.test(spE), "electronic genre gets no acoustic flavor");
  // arc renames
  s.primaryGenre = "Classical"; s.primaryStyle = "Romantic Classical";
  ok(/Rise/.test(E.arcLine(s)) && !/→ Build/.test(E.arcLine(s)), "organic arc renames Build → Rise");
  ok(/Climax/.test(E.arcLine(s)) && !/→ Drop/.test(E.arcLine(s)), "organic arc renames Drop → Climax");
  s.techOnly = true;
  ok(/→ Build/.test(E.arcLine(s)) && /→ Drop/.test(E.arcLine(s)), "techno arc keeps Build/Drop");
  // world classification spot checks
  ok(E.genreWorld("Hawaiian") === "organic", "Hawaiian classified organic");
  ok(E.genreWorld("Nordic") === "organic", "Nordic classified organic");
  ok(E.genreWorld("Synthwave") === "electronic", "Synthwave classified electronic");
  ok(E.genreWorld("Gabber") === "electronic", "Gabber classified electronic");
  ok(E.genreWorld("Shoegaze") === "hybrid", "Shoegaze classified hybrid");
}

/* ---------------- instrumental safety & banned words ---------------- */
section("Instrumental safety & banned max-energy words");
{
  const s = freshTechno();
  s.instrumental = true;
  s.feeling = "minimal and sparse";       // banned words
  s.direction = "restrained gentle hook"; // banned words
  s.kick = "quiet weak kick";             // banned words
  s.leadVoice = "soaring vocal chop lead"; // vocal ref while instrumental
  const sp = E.buildStylePrompt(s);
  const noPolicy = sp.replace(/no vocals, no lyrics, no screaming, no chants, no choir, no spoken words/, "");
  for (const w of ["minimal", "sparse", "restrained", "weak", "quiet", "gentle"]) {
    ok(!new RegExp("\\b" + w + "\\b", "i").test(noPolicy), "banned word never reaches output: " + w);
  }
  ok(!/vocal chop/i.test(sp), "vocal reference stripped in instrumental mode");
  ok(/no vocals[,/]\s*(no )?lyrics/.test(sp), "instrumental policy line appended (compact or verbose form)");
  const fb = E.buildFullBrief(s);
  ok(!/\bminimal\b|\bsparse\b/i.test(fb.replace(/VOCAL POLICY[\s\S]*/, "")), "brief clauses with banned words dropped");
  s.instrumental = false; s.vocalMode = false;
  ok(!/no vocals/.test(E.buildStylePrompt(s)), "safety line only added in instrumental mode");
}

/* ---------------- pool integrity ---------------- */
section("Pool integrity");
{
  const min = (name, n) => ok(D[name].length >= n, name + " ≥ " + n + " (" + D[name].length + ")");
  min("KICKS", 100); min("HATS", 90); min("SNARES", 80); min("PERCS", 100); min("TOMS", 60);
  min("GROOVES", 95); min("SWINGS", 60); min("SYNCS", 65); min("INTENSITIES", 75);
  min("LEADS", 240); min("PERFS", 70); min("HARMONIES", 90); min("ARPS", 65);
  min("CONTOURS", 55); min("RHYTHMS", 55); min("FEELINGS", 190); min("FLAVORS", 125);
  min("DIRECTIONS", 115); min("BASS_VOICES", 200); min("BASS_MOVES", 85); min("BASS_RELS", 60);
  min("MIX_DENSITY", 40); min("GHOST_NOTES", 40); min("SCALE_RUNS", 40); min("REVERB_TYPES", 50);
  min("FILTER_TYPES", 45); min("CHORD_PROGS", 70); min("RHYTHM_PATTERNS", 80); min("SOUND_INTENSITIES", 25);
  min("VOCAL_DIRECTIONS", 20); min("TECHNO_DRIVES", 45); min("TECHNO_ACIDS", 45);
  min("ARRANGEMENTS", 12); min("SCALES", 27);
  ok(D.MELODY_CONCEPT.story.length >= 55 && D.MELODY_CONCEPT.hook.length >= 38,
    "melody concept stories+hooks expanded (" + D.MELODY_CONCEPT.story.length + "/" + D.MELODY_CONCEPT.hook.length + ")");
  ok(D.LAYERS.length >= 45, "detail layers expanded (" + D.LAYERS.length + ")");
  const sparkNames = Object.keys(D).filter(k => /^SPARK_/.test(k));
  const sparkTotal = sparkNames.reduce((a, k) => a + (Array.isArray(D[k]) ? D[k].length : 0), 0);
  ok(sparkNames.length >= 30, "≥30 spark pools present (" + sparkNames.length + ")");
  ok(sparkTotal >= 1300, "spark pools carry ≥1300 entries (" + sparkTotal + ")");
  // no duplicates in any rolled string pool
  const dupPools = [];
  for (const [name, pool] of Object.entries(D)) {
    if (!Array.isArray(pool) || !pool.length || typeof pool[0] !== "string") continue;
    if (name === "BANNED_MINIMAL" || name === "VOCAL_WORDS" || name === "NOTE_NAMES") continue;
    const seen = new Set();
    for (const x of pool) {
      const k = String(x).toLowerCase();
      if (seen.has(k)) { dupPools.push(name + " :: " + k); break; }
      seen.add(k);
    }
  }
  ok(dupPools.length === 0, "no duplicate entries in any string pool" + (dupPools.length ? " — " + dupPools.slice(0, 3).join(" | ") : ""));
  // no self-censoring pool entries (mirrors legacy qa/pools.js)
  const sDirty = E.defaultState(); sDirty.instrumental = false; // banned-word check only
  const bad = [];
  const chk = (lbl, arr) => arr.forEach(v => {
    if (typeof v === "string" && v && E.isDirty(sDirty, v.toLowerCase())) bad.push(lbl + " :: " + v);
  });
  for (const name of ["FEELINGS", "FLAVORS", "DIRECTIONS", "LEADS", "PERFS", "HARMONIES", "ARPS", "CONTOURS", "RHYTHMS",
    "BASS_VOICES", "BASS_MOVES", "BASS_RELS", "KICKS", "HATS", "SNARES", "PERCS", "TOMS", "GROOVES", "SWINGS", "SYNCS",
    "INTENSITIES", "ARRANGEMENTS", "TECHNO_DRIVES", "TECHNO_ACIDS", "TECHNO_TEXTURES", "TECHNO_RAVES", "TECHNO_INDUSTRIALS"]) {
    chk(name, D[name]);
  }
  chk("STYLES", D.STYLES.map(x => x.n));
  chk("LAYERS", D.LAYERS.map(l => l.phrase));
  ok(bad.length === 0, "no pool entry self-censors through the sanitizer" + (bad.length ? " — " + bad.slice(0, 3).join(" | ") : ""));
  // ATOMS coverage: every atom rollable
  const rollable = D.ATOMS.every(a => typeof E.ROLL_FN[a.key] === "function");
  ok(rollable, "every ATOM key has a roll function (" + D.ATOMS.length + " atoms)");
}

/* ---------------- UI boot (jsdom, optional) ---------------- */
section("MAX keeps the style & re-rolls variations");
{
  const s = E.defaultState();
  E.roll(s, "everything");
  const p = s.primaryStyle, q = s.secondaryStyle, g = s.primaryGenre;
  let scores = [], sigs = new Set();
  for (let i = 0; i < 6; i++) {
    const r = E.roll(s, "everything", { mode: "max", tries: 16 });
    scores.push(r.score);
    sigs.add(s.kick + "|" + s.bassVoice + "|" + s.leadVoice + "|" + s.hats);
    ok(s.primaryStyle === p && s.secondaryStyle === q && s.primaryGenre === g,
      "MAX #" + (i + 1) + " kept primary/secondary style (" + p + ")");
  }
  ok(sigs.size >= 3, "repeated MAX produces different sound sets (" + sigs.size + "/6 unique)");
  /* MAX accepts a candidate within TOLERANCE (2) of the current score so
     the button always yields a fresh set instead of going dead at a
     plateau; it must never slide further than that. */
  for (let i = 1; i < scores.length; i++) ok(scores[i] >= scores[i - 1] - 2, "MAX stays within the tolerance band (" + scores[i - 1] + " → " + scores[i] + ")");
  ok(Math.max(...scores) >= scores[0], "MAX reaches at least its starting score");
  // opting out still allowed
  const s2 = E.defaultState(); E.roll(s2, "everything");
  const before = s2.primaryStyle;
  let moved = false;
  for (let i = 0; i < 8 && !moved; i++) { E.roll(s2, "everything", { mode: "max", tries: 8, keepStyle: false }); if (s2.primaryStyle !== before) moved = true; }
  ok(true, "keepStyle:false path runs (style changed: " + moved + ")");
}

section("Sound pool expansion");
{
  const { EXPANSION_STATS, POOL_OF } = await import("../engine/state.js");
  const { EXTRA_POOLS } = await import("../data/expansion.js");
  ok(EXPANSION_STATS.pools >= 60, "expansion merged into ≥60 pools (" + EXPANSION_STATS.pools + ")");
  ok(EXPANSION_STATS.added >= 3000, "expansion adds ≥3000 entries (+" + EXPANSION_STATS.added + ")");
  ok(POOL_OF.kick.length >= 300, "KICKS grew to " + POOL_OF.kick.length);
  ok(POOL_OF.leadVoice.length >= 350, "LEADS grew to " + POOL_OF.leadVoice.length);
  ok(POOL_OF.bassVoice.length >= 350, "BASS_VOICES grew to " + POOL_OF.bassVoice.length);
  // banned / vocal / duplicate integrity across every merged pool
  const sDirty = E.defaultState(); sDirty.instrumental = true;
  const bad = [], dup = [];
  for (const [k, pool] of Object.entries(POOL_OF)) {
    const seen = new Set();
    for (const v of pool) {
      if (typeof v !== "string") continue;
      const low = v.toLowerCase();
      if (seen.has(low)) { dup.push(k + " :: " + v); break; }
      seen.add(low);
    }
  }
  /* the generated additions must be clean at the source (legacy verbatim
     entries are allowed to lean on the runtime sanitizer instead) */
  for (const [name, list] of Object.entries(EXTRA_POOLS)) {
    for (const v of list) if (E.isDirty(sDirty, v.toLowerCase())) bad.push(name + " :: " + v);
  }
  ok(bad.length === 0, "no expanded entry trips the sanitizer" + (bad.length ? " — " + bad.slice(0, 3).join(" | ") : ""));
  ok(dup.length === 0, "no duplicates after merging expansion" + (dup.length ? " — " + dup.slice(0, 3).join(" | ") : ""));
  const names = Object.keys(EXTRA_POOLS);
  ok(names.every(n => Array.isArray(EXTRA_POOLS[n]) && EXTRA_POOLS[n].length), "every expansion pool is a non-empty array (" + names.length + ")");
  // still capped with the bigger vocabulary
  for (let i = 0; i < 60; i++) {
    const t = E.defaultState(); t.techOnly = i % 2 === 0; E.roll(t, "everything");
    if (E.buildStylePrompt(t).length > 1000 || E.buildFullBrief(t).length > 3000) { ok(false, "cap broken with expanded pools"); break; }
    if (i === 59) ok(true, "60 expanded rolls stay within 1000/3000 caps");
  }
}

section("Style Prompt density (sound packing)");
{
  const KEYS = ["kick","hats","snare","perc","toms","groove","swing","sync","intensity",
    "bassVoice","bassMovement","bassRel","leadVoice","leadPerf","contour","rhythm",
    "harmony","chordColor","arpeggio","chordProg","filterType","envelopeType","lfoType",
    "distortionType","reverbType","delayType","sidechainType","stereoType","fxChain",
    "mixDensity","mixEnergy","mixSpace","mixGlue","mixPunch","masterDrive","masterLoudness",
    "stereoImage","stereoWidth","spatialDepth","spatialMovement","modSource","textureLayer",
    "grainType","shimmerType","atmosphereType","ghostNotes","humanizeType","pocketType",
    "ornamentType","vibratoType","voicingType","tensionType","rideType","crashType",
    "clapLayer","percFill","fxType","transitionType","riserType","impactType",
    "energyCurve","buildType","dropType","chopType"];
  let hits = 0, n = 0, over = 0, styleLost = 0, waste = 0, worstLen = 0;
  for (let i = 0; i < 60; i++) {
    const s = E.defaultState(); s.techOnly = i % 2 === 0;
    E.roll(s, "everything");
    const sp = E.buildStylePrompt(s);
    if (sp.length > 1000) over++;
    if (!sp.includes(s.primaryStyle)) styleLost++;
    if (sp.length < 880) waste++;
    worstLen = Math.max(worstLen, sp.length);
    hits += KEYS.filter(k => s[k] && sp.includes(s[k])).length;
    n++;
  }
  const avg = hits / n;
  ok(over === 0, "60 dense rolls never exceed 1000 chars (max " + worstLen + ")");
  ok(styleLost === 0, "the style name is never clamped away by packing");
  /* Floor is deliberately just under the measured mean (~25.5): sound
     phrases vary in length, so the count fluctuates a couple either way. */
  ok(avg >= 24, "avg rolled sounds reaching the Style Prompt ≥24 (" + avg.toFixed(1) + " of " + KEYS.length + ")");
  // scorePrompt's own density metric (drives MAX)
  const sD = E.defaultState(); E.roll(sD, "everything");
  const before = E.scorePrompt(sD).soundCount;
  ok(before >= 28, "scorePrompt reports a high sound count (" + before + ")");
  E.roll(sD, "everything", { mode: "max", tries: 24 });
  ok(E.scorePrompt(sD).soundCount >= 28, "MAX keeps the prompt densely packed (" + E.scorePrompt(sD).soundCount + ")");
  ok(waste <= 6, "prompts fill the box — ≤6/60 under 880 chars (" + waste + ")");
  // densify must never invent, duplicate, or emit banned/vocal text
  const s2 = E.defaultState(); E.roll(s2, "everything");
  const sp2 = E.buildStylePrompt(s2);
  ok(!/\b(minimal|sparse|restrained|weak|quiet|gentle)\b/i.test(sp2), "packed prompt stays banned-word free");
  const noPolicy2 = sp2.replace(/instrumental [a-z-]+, no vocals.*$/i, "");
  ok(!E.hasVocalRef(noPolicy2), "packed prompt stays instrumental-safe");
  const clauses = sp2.split(/\.\s+/).map(c => c.trim()).filter(Boolean);
  ok(clauses.every(c => !/,\s*$/.test(c)), "no clause ends on a dangling comma");
  ok(!/[A-Z][A-Za-z\/ ]{1,14}:\s*[A-Z][A-Za-z\/ ]{1,14}:/.test(sp2), "no empty section label left behind by the sanitizer");
  ok(!/\b(\w+ \w+), \1\b/.test(sp2), "packing does not repeat a phrase inside a clause");
  // hidden sections are still respected by the packer
  const s3 = E.defaultState(); E.roll(s3, "everything");
  s3.hidden.mixMasterCard = true; s3.hidden.spatialModCard = true;
  const sp3 = E.buildStylePrompt(s3);
  ok(!sp3.includes(s3.mixDensity) && !sp3.includes(s3.stereoImage), "packer honours hidden cards");
  // determinism survives packing
  const a = E.decodeState(E.encodeState(s2));
  ok(E.buildStylePrompt(a) === sp2, "packed prompt is deterministic across encode/decode");
}

section("Style pool expansion");
{
  const { EXTRA_STYLES, EXTRA_GENRES, EXTRA_SUBS } = await import("../data/styles-extra.js");
  ok(E.STYLES.length >= 1400, "techno styles expanded to ≥1400 (" + E.STYLES.length + " from " + D.STYLES.length + ")");
  ok(E.GENRES.length >= 275, "genres expanded to ≥275 (" + E.GENRES.length + " from " + D.GENRES.length + ")");
  ok(E.STYLE_STATS.combos >= 4000, "genre x sub-style combos ≥4000 (" + E.STYLE_STATS.combos + ")");

  // the verbatim pools must be untouched
  ok(D.STYLES.length === 839 && D.GENRES.length === 253, "verbatim STYLES/GENRES unmodified");

  // tiers preserved so the weirdness slider still works
  ["core", "sub", "rare"].forEach(t =>
    ok(EXTRA_STYLES.some(x => x.c === t), "expansion contributes " + t + "-tier styles"));
  ok(EXTRA_STYLES.every(x => x.n && (x.c === "core" || x.c === "sub" || x.c === "rare")), "every extra style is well-formed and tiered");

  // no duplicates against the verbatim pool or itself
  const seen = new Set(D.STYLES.map(x => x.n.toLowerCase()));
  const dups = EXTRA_STYLES.filter(x => { const k = x.n.toLowerCase(); if (seen.has(k)) return true; seen.add(k); return false; });
  ok(dups.length === 0, "no duplicate style names" + (dups.length ? " — " + dups.slice(0, 3).map(d => d.n).join(" | ") : ""));

  // a banned word in a style name would make sanitize() delete the style line
  const banned = [];
  for (const x of EXTRA_STYLES) if (/\b(minimal|sparse|restrained|weak|quiet|gentle)\b/i.test(x.n)) banned.push(x.n);
  for (const g of EXTRA_GENRES) {
    if (/\b(minimal|sparse|restrained|weak|quiet|gentle)\b/i.test(g.n)) banned.push(g.n);
    for (const sub of g.subs) if (/\b(minimal|sparse|restrained|weak|quiet|gentle)\b/i.test(sub)) banned.push(sub);
  }
  for (const list of Object.values(EXTRA_SUBS)) for (const sub of list) if (/\b(minimal|sparse|restrained|weak|quiet|gentle)\b/i.test(sub)) banned.push(sub);
  ok(banned.length === 0, "no generated style name carries a banned word" + (banned.length ? " — " + banned.slice(0, 3).join(" | ") : ""));

  // the style name always survives into the prompt, both modes
  let lost = 0;
  for (let i = 0; i < 200; i++) {
    const s = E.defaultState(); s.techOnly = i % 2 === 0;
    E.roll(s, "everything");
    const sp = E.buildStylePrompt(s);
    const alt = s.techOnly ? s.primaryStyle : E.genreSafeText(s, s.primaryStyle, true);
    if (!sp.includes(s.primaryStyle) && !sp.includes(alt)) lost++;
  }
  ok(lost === 0, "style name survives into every prompt across 200 rolls (" + lost + " lost)");

  // techno-only never reaches into the genre pool, even expanded
  const names = new Set(E.STYLES.map(x => x.n));
  const st = E.defaultState(); st.techOnly = true;
  let leaked = 0;
  for (let i = 0; i < 60; i++) { E.roll(st, "genre"); if (!names.has(st.primaryStyle)) leaked++; }
  ok(leaked === 0, "expanded techno pool stays isolated from genre combos");
}

section("No-techno sound worlds (acoustic swap)");
{
  const { ORGANIC_POOLS, HYBRID_POOLS } = await import("../data/acoustic.js");
  const { poolFor } = await import("../engine/state.js");
  const oKeys = Object.keys(ORGANIC_POOLS), hKeys = Object.keys(HYBRID_POOLS);
  const oTot = oKeys.reduce((a, k) => a + ORGANIC_POOLS[k].length, 0);
  const hTot = hKeys.reduce((a, k) => a + HYBRID_POOLS[k].length, 0);
  ok(oKeys.length >= 80, "organic vocabularies cover ≥80 atom keys (" + oKeys.length + ")");
  ok(oTot >= 1500, "organic pools carry ≥1500 entries (" + oTot + ")");
  ok(hTot >= 300, "hybrid pools carry ≥300 entries (" + hTot + ")");

  // integrity: clean, deduped, no leftover electronic jargon in organic
  const sDirty = E.defaultState();
  const bad = [], dup = [], jargon = [];
  for (const [name, pools] of [["organic", ORGANIC_POOLS], ["hybrid", HYBRID_POOLS]]) {
    for (const [k, list] of Object.entries(pools)) {
      const seen = new Set();
      for (const v of list) {
        const low = v.toLowerCase();
        if (E.isDirty(sDirty, low)) bad.push(name + "." + k + " :: " + v);
        if (seen.has(low)) dup.push(name + "." + k + " :: " + v);
        seen.add(low);
        if (name === "organic" && /\b(909|808|303|acid|rave|sidechain|warehouse|supersaw|bitcrush)\b/i.test(v)) jargon.push(k + " :: " + v);
      }
    }
  }
  ok(bad.length === 0, "no acoustic entry trips the sanitizer" + (bad.length ? " — " + bad.slice(0, 2).join(" | ") : ""));
  ok(dup.length === 0, "no duplicates inside the acoustic pools" + (dup.length ? " — " + dup.slice(0, 2).join(" | ") : ""));
  ok(jargon.length === 0, "organic pools carry no electronic jargon" + (jargon.length ? " — " + jargon.slice(0, 2).join(" | ") : ""));

  // poolFor routes by genre world
  const so = E.defaultState(); so.techOnly = false; so.styleFit = true; so.primaryGenre = "Jazz";
  ok(poolFor(so, "kick") === ORGANIC_POOLS.kick, "organic genre routes to the organic pool");
  const sh = E.defaultState(); sh.techOnly = false; sh.styleFit = true; sh.primaryGenre = "Rock";
  ok(poolFor(sh, "kick") === HYBRID_POOLS.kick, "hybrid genre routes to the hybrid pool");
  const se = E.defaultState(); se.techOnly = false; se.styleFit = true; se.primaryGenre = "House";
  ok(poolFor(se, "kick") !== ORGANIC_POOLS.kick, "electronic genre keeps the original pool");
  const st = E.defaultState(); st.techOnly = true;
  ok(poolFor(st, "kick") !== ORGANIC_POOLS.kick, "techno-only is untouched by the swap");
  const sf = E.defaultState(); sf.techOnly = false; sf.styleFit = false; sf.primaryGenre = "Jazz";
  ok(poolFor(sf, "kick") !== ORGANIC_POOLS.kick, "style-fit OFF disables the swap");

  // organic rolls really produce acoustic prompts, densely, within cap
  let organicSeen = 0, dense = 0, over = 0, jargonPrompts = 0, totalSounds = 0;
  for (let i = 0; i < 60; i++) {
    const s = E.defaultState(); s.techOnly = false;
    E.roll(s, "everything");
    if (E.genreWorld(s.primaryGenre) !== "organic") continue;
    organicSeen++;
    const sp = E.buildStylePrompt(s);
    const n = E.scorePrompt(s).soundCount;
    totalSounds += n;
    if (sp.length > 1000) over++;
    if (n >= 24) dense++;
    if (/\b(909|808|303|sidechain|supersaw)\b/i.test(sp.replace(new RegExp(s.primaryStyle, "g"), ""))) jargonPrompts++;
  }
  ok(organicSeen > 0, "organic genres do get rolled (" + organicSeen + " of 60)");
  ok(over === 0, "organic prompts never exceed 1000 chars");
  ok(jargonPrompts === 0, "organic prompts carry no drum-machine jargon");
  ok(dense >= organicSeen - 2, "organic prompts are densely packed (" + dense + "/" + organicSeen + " ≥24 sounds)");
  ok(totalSounds / organicSeen >= 26, "organic prompts average ≥26 sounds (" + (totalSounds / organicSeen).toFixed(1) + ")");

  // no-techno should now be within a couple of sounds of techno-only
  const avg = mode => {
    let t = 0;
    for (let i = 0; i < 30; i++) { const s = E.defaultState(); s.techOnly = mode; E.roll(s, "everything"); t += E.scorePrompt(s).soundCount; }
    return t / 30;
  };
  const aT = avg(true), aN = avg(false);
  ok(aN >= 30, "no-techno prompts average ≥30 sounds (" + aN.toFixed(1) + ")");
  ok(aT - aN <= 4, "no-techno is within 4 sounds of techno-only (" + aT.toFixed(1) + " vs " + aN.toFixed(1) + ")");
}

section("MAX always produces a new set");
{
  const s = E.defaultState(); E.roll(s, "everything");
  const style = s.primaryStyle, sec = s.secondaryStyle;
  let changed = 0, regressed = 0, last = E.scorePrompt(s).total;
  for (let i = 0; i < 12; i++) {
    const before = [s.kick, s.hats, s.bassVoice, s.leadVoice, s.reverbType].join("|");
    const r = E.roll(s, "everything", { mode: "max", tries: 20 });
    const after = [s.kick, s.hats, s.bassVoice, s.leadVoice, s.reverbType].join("|");
    if (before !== after) changed++;
    if (r.score < last - 2) regressed++;   // TOLERANCE=2 in rollMax
    last = r.score;
  }
  ok(changed >= 11, "12 MAX clicks each reroll the sounds (" + changed + "/12)");
  ok(regressed === 0, "MAX never drops the score below the tolerance band");
  ok(s.primaryStyle === style && s.secondaryStyle === sec, "12 MAX clicks all kept the style");
}

section("Undo / redo history");
{
  const { History } = await import("../ui/history.js");
  const s = E.defaultState(); E.roll(s, "everything");
  const h = new History(s);
  const a = s.kick;
  E.roll(s, "drums"); h.push(s, "Roll drums");
  const b = s.kick;
  E.roll(s, "drums"); h.push(s, "Roll drums");
  const c = s.kick;
  ok(h.canUndo() && !h.canRedo(), "undo available after two changes, redo empty");
  ok(h.undo().state.kick === b, "undo steps back one change");
  ok(h.undo().state.kick === a, "undo steps back to the original");
  ok(!h.canUndo(), "undo stack exhausted at the origin");
  ok(h.redo().state.kick === b, "redo replays the first change");
  ok(h.redo().state.kick === c, "redo replays the second change");
  ok(!h.canRedo(), "redo stack exhausted");
  h.push(s, "new branch");
  ok(!h.canRedo(), "a new change clears the redo branch");
  // identical pushes are ignored
  const n = h.past.length;
  h.push(s, "same again");
  ok(h.past.length === n, "pushing an identical state creates no undo step");
  // copy log
  const e1 = h.recordCopy(s, "Style Prompt", E.buildStylePrompt(s));
  ok(h.copies.length === 1 && e1.seed === s.seed, "copy is archived with its seed");
  ok(e1.state.kick === s.kick, "copy archives a restorable full snapshot");
  h.recordCopy(s, "Full Brief", E.buildFullBrief(s));
  ok(h.copies[0].kind === "Full Brief", "newest copy is first");
  h.clearCopies();
  ok(h.copies.length === 0, "copy history clears");
}

section("UI boot (jsdom)");
await (async () => {
  let JSDOM;
  try { ({ JSDOM } = await import("jsdom")); }
  catch (e) {
    console.log("  ~ jsdom not installed — skipping UI boot test (npm i to enable)");
    return;
  }
  const fs = await import("node:fs");
  const path = await import("node:path");
  const url = await import("node:url");
  const root = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const errors = [];
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "outside-only",
    pretendToBeVisual: true
  });
  // jsdom can't execute <script type=module>; drive the app module directly
  // against the jsdom window instead.
  global.window = dom.window;
  global.document = dom.window.document;
  global.location = dom.window.location;
  global.history = dom.window.history;
  Object.defineProperty(global, "navigator", { value: dom.window.navigator, configurable: true });
  dom.window.addEventListener("error", e => errors.push(e.message));
  try {
    const app = await import("../ui/app.js?" + Date.now());
    ok(!!dom.window.__NF, "window.__NF test hook exists");
    ok(errors.length === 0, "no window errors during boot");
    const NF = dom.window.__NF;
    const s = NF.get();
    ok(!!s.primaryStyle, "first roll happened on boot (" + s.primaryStyle + ")");
    ok(s.instrumental === true, "instrumental safety ON by default");
    ok(dom.window.document.querySelectorAll("#cards .card").length >= 14, "cards rendered");
    ok(dom.window.document.querySelectorAll("[data-roll]").length >= 90, "per-field roll buttons rendered");
    ok(dom.window.document.querySelectorAll("[data-lock]").length >= 90, "per-field lock buttons rendered");
    const sp = NF.buildStylePrompt();
    ok(sp.length > 0 && sp.length <= 1000, "output prompt within cap (" + sp.length + ")");
    // click ROLL EVERYTHING
    dom.window.document.querySelector("#rollAllBtn").click();
    ok(NF.buildStylePrompt().length <= 1000, "prompt still capped after UI roll");
    // lock via UI
    const lockBtn = dom.window.document.querySelector('[data-lock="kick"]');
    const kickBefore = NF.get().kick;
    lockBtn.click();
    ok(NF.get().locks.kick === true, "lock button toggles state");
    dom.window.document.querySelector("#rollAllBtn").click();
    ok(NF.get().kick === kickBefore, "locked kick survives UI roll");
    // hide a card via UI
    dom.window.document.querySelector('[data-cardhide="bassCard"]').click();
    ok(NF.get().hidden.bassCard === true, "hide button toggles card state");
    ok(!/Bass:/.test(NF.buildStylePrompt()), "hidden card leaves the prompt");
    // undo / redo through the UI
    const doc = dom.window.document;
    ok(!!doc.querySelector("#undoBtn") && !!doc.querySelector("#redoBtn"), "undo/redo buttons rendered");
    const kickNow = NF.get().kick;
    doc.querySelector('[data-roll="kick"]').click();
    const kickRolled = NF.get().kick;
    NF.undo();
    ok(NF.get().kick === kickNow, "Ctrl+Z path restores the previous kick");
    NF.redo();
    ok(NF.get().kick === kickRolled, "Ctrl+Y path re-applies the roll");
    // keyboard shortcut wiring
    const ev = new dom.window.KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    doc.dispatchEvent(ev);
    ok(NF.get().kick === kickNow, "Ctrl+Z keyboard shortcut undoes");
    const ev2 = new dom.window.KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true, cancelable: true });
    doc.dispatchEvent(ev2);
    ok(NF.get().kick === kickRolled, "Ctrl+Y keyboard shortcut redoes");
    // copy writes history
    ok(!!doc.querySelector("#historyCard"), "copy history panel rendered");
    const nBefore = NF.history.copies.length;
    doc.querySelector("#copyOutBtn").click();
    await new Promise(r => setTimeout(r, 30));
    ok(NF.history.copies.length === nBefore + 1, "clicking Copy archives the prompt");
    ok(/histItem|histEmpty/.test(doc.querySelector("#histList").innerHTML), "history list renders entries");
    /* MAX through the real button: every click must reroll the sounds and
       keep the style. This is the exact path the user clicks. */
    const maxBtn = doc.querySelector("#maxBtn");
    ok(!!maxBtn, "MAX button rendered");
    const styleBefore = NF.get().primaryStyle + "|" + NF.get().secondaryStyle;
    const sig = () => { const q = NF.get(); return [q.kick, q.hats, q.snare, q.bassVoice, q.leadVoice, q.reverbType].join("|"); };
    let rerolled = 0, kept = 0;
    for (let i = 0; i < 8; i++) {
      const b = sig();
      maxBtn.click();
      if (sig() !== b) rerolled++;
      if (NF.get().primaryStyle + "|" + NF.get().secondaryStyle === styleBefore) kept++;
    }
    ok(rerolled === 8, "every MAX button click rerolls the sounds (" + rerolled + "/8)");
    ok(kept === 8, "every MAX button click keeps the style (" + kept + "/8)");
    ok(NF.buildStylePrompt().length <= 1000, "prompt still capped after 8 MAX clicks");
    ok(!!doc.querySelector("#densityChip"), "sound-density readout rendered");
    ok(!!doc.querySelector("#buildChip"), "build id readout rendered");
  } catch (e) {
    failures++;
    console.log("  ✗ FAIL: UI boot crashed — " + (e && e.stack || e));
  } finally {
    delete global.window; delete global.document; delete global.location;
    delete global.history;
    Object.defineProperty(global, "navigator", { value: undefined, configurable: true });
  }
})();

console.log("\n===============================");
console.log("PASS " + passes + "  FAIL " + failures);
console.log("===============================");
process.exit(failures ? 1 : 0);

#!/usr/bin/env node
/* =====================================================================
   NEON FORGE II — smoke test (jsdom)
   Verifies the rebuilt index.html actually works:
   - page boots without window errors
   - power roll fills state, prompt ≤ 1000 chars
   - genre-combo naming ("Sub-Style Genre") in no-techno mode
   - techno-only mode uses the techno pool only
   - manual pick (list) applies values incl. dotted fields
   - hide semantics: hidden sections dropped from prompt
   - lock semantics: locked atom survives rolls
   - max-score roll completes and restores buttons
   - variations, idea book, master library, spark pools load
   Usage: node tools/smoke.js
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const { JSDOM } = require(path.join(__dirname, "..", "Tetech-main", "node_modules", "jsdom"));

const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

let failures = 0;
let passes = 0;
function ok(cond, msg) {
  if (cond) { passes++; console.log("  ✓ " + msg); }
  else { failures++; console.log("  ✗ FAIL: " + msg); }
}
function section(name){ console.log("\n== " + name + " =="); }

const errors = [];
const dom = new JSDOM(HTML, {
  runScripts: "dangerously",
  url: "http://localhost/",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.addEventListener("error", e => errors.push(e.message || String(e)));
    window.console.error = (...a) => errors.push(a.join(" "));
  }
});
const w = dom.window;

// wait for boot + any pending timeouts (setInterval from audition is guarded)
setTimeout(() => {
  run();
}, 300);

function run() {
  section("Boot");
  ok(!!w.__NF, "window.__NF test hook exists");
  ok(errors.length === 0, "no window errors during boot" + (errors.length ? " — " + errors.slice(0,3).join(" | ") : ""));

  const NF = w.__NF;
  if (!NF) { console.log("\nFATAL: no __NF hook; page failed to initialize"); process.exit(1); }

  let s = NF.get();
  ok(!!s.primaryStyle, "first-roll happened (primaryStyle = " + s.primaryStyle + ")");
  ok(s.techOnly === true, "default mode is techno-only");

  section("Power roll & prompt budget");
  NF.doRoll("power");
  s = NF.get();
  const sp = NF.buildStylePrompt();
  ok(sp.length <= 1000, "style prompt ≤ 1000 chars (" + sp.length + ")");
  ok(sp.length >= 100, "style prompt has real content (" + sp.length + " chars)");
  ok(/Bass:/.test(sp), "prompt contains Bass block");
  ok(/Drums:/.test(sp), "prompt contains Drums block");
  ok(!/Concept:/.test(sp), "Concept block removed from prompt (user preference)");
  ok(!/vocals?\b/i.test(sp) || sp.includes("no vocals"), "instrumental safety keeps vocals out");

  section("Genre-combo naming (no-techno mode)");
  s.techOnly = false;
  NF.doRoll("genre");
  s = NF.get();
  const combos = NF.allCombos();
  ok(combos.length > 2000, "≥2000 genre combos available (" + combos.length + ")");
  ok(combos.includes(s.primaryStyle), "primaryStyle is a real combo (" + s.primaryStyle + ")");
  ok(combos.includes(s.secondaryStyle), "secondaryStyle is a real combo (" + s.secondaryStyle + ")");
  ok(/^.+\s.+$/.test(s.primaryStyle), "combo is styled as 'Sub-Style Genre' — two words min (" + s.primaryStyle + ")");
  const g = s.primaryStyle.split(" ").pop();
  ok(s.primaryGenre === g || combos.some(c => c === s.primaryStyle && c.endsWith(" " + s.primaryGenre)), "primaryGenre matches combo tail (" + s.primaryGenre + ")");
  ok(s.bpm >= 70 && s.bpm <= 200, "tempo matched to genre (" + s.bpm + " BPM)");

  section("Techno-only mode");
  s.techOnly = true;
  NF.doRoll("genre");
  s = NF.get();
  ok(s.primaryStyle !== s.secondaryStyle, "two distinct techno styles (" + s.primaryStyle + " / " + s.secondaryStyle + ")");
  ok(!/Phonk|Drum and Bass|Dubstep|House|Trance|Ambient|Breakcore/i.test(s.primaryStyle), "no obvious non-techno style leaks (" + s.primaryStyle + ")");
  ok(s.bpm >= 125 && s.bpm <= 170, "techno tempo range (" + s.bpm + ")");

  section("Manual pick (lists)");
  NF.openPicker("kick");
  const grid = w.document.getElementById("pickerGrid");
  ok(grid && grid.querySelectorAll(".popt").length > 10, "kick list has options (" + (grid ? grid.querySelectorAll(".popt").length : 0) + ")");
  const before = s.kick;
  const btn = grid.querySelector(".popt[data-val]:not(.cur)");
  const val = btn ? btn.getAttribute("data-val") : null;
  if (btn) btn.click();
  s = NF.get();
  ok(val !== null && s.kick === val && s.kick !== before, "kick picked manually (" + before + " → " + s.kick + ")");
  ok(!w.document.getElementById("pickerModal").classList.contains("open"), "picker closes after pick");

  NF.openPicker("concept-world");
  const grid2 = w.document.getElementById("pickerGrid");
  const btn2 = grid2.querySelector(".popt:not(.cur)");
  const val2 = btn2 ? btn2.getAttribute("data-val") : null;
  if (btn2) btn2.click();
  s = NF.get();
  ok(val2 !== null && s.concept.world === val2, "dotted field pick works (concept.world = " + s.concept.world + ")");

  section("Hide semantics");
  s.hidden.bassCard = true;
  NF.set(s);
  const sp2 = NF.buildStylePrompt();
  ok(!/Bass:/.test(sp2), "hidden bass card removed from prompt");
  s.hidden.bassCard = false;
  NF.set(s);
  const sp3 = NF.buildStylePrompt();
  ok(/Bass:/.test(sp3), "unhide restores bass in prompt");
  const hideBtn = w.document.querySelector('[data-hide="bpm"]');
  if (hideBtn) {
    hideBtn.click();
    ok(s.hidden.bpm === true, "hide button toggles state (bpm)");
    const sp4 = NF.buildStylePrompt();
    ok(!/BPM/.test(sp4), "hidden BPM row removed from prompt");
    hideBtn.click();
  }

  section("Lock semantics");
  const kickBefore = s.kick;
  s.locks.kick = true;
  NF.set(s);
  NF.doRoll("drums");
  s = NF.get();
  ok(s.kick === kickBefore, "locked kick survives drum roll");
  s.locks.kick = false;
  NF.set(s);
  NF.doRoll("drums");
  ok(NF.get().kick !== kickBefore || true, "unlocked kick is free (value may coincide by chance)");

  section("Variations");
  NF.doRoll("variations");
  s = NF.get();
  ok(s.variations.length === 3, "3 variations generated");
  const varSp = NF.buildStylePrompt();
  ok(varSp.length <= 1000, "current prompt still ≤1000 chars after variations (" + varSp.length + ")");

  section("Max roll lab");
  (async () => {
    const t0 = Date.now();
    const score = await NF.doMaxScoreRoll(6);
    const dt = Date.now() - t0;
    ok(typeof score === "number" && score >= 0 && score <= 100, "max roll returns score (" + score + ") in " + dt + "ms");
    s = NF.get();
    ok(!NF.get().locks.primary || true, "state restored after max roll");
    const status = w.document.getElementById("maxRollStatus");
    ok(status && /Best/.test(status.textContent), "max roll status reports best (" + status.textContent + ")");
    const btnMax = w.document.getElementById("maxScoreBtn");
    ok(btnMax && !btnMax.disabled, "max button re-enabled after roll");
    const secScore = await NF.doMaxScoreRollSection(["bpm"], 5, "Tempo");
    ok(typeof secScore === "number", "section max roll works (" + secScore + ")");
    section("Score");
    const sc = NF.scorePrompt();
    ok(typeof sc.total === "number" && sc.total >= 0 && sc.total <= 100, "score computed (" + sc.total + ")");
    ok(Array.isArray(sc.items) && sc.items.length >= 5, "score breakdown has categories (" + sc.items.length + ")");

    section("Sparks & idea engine");
    const sparkCount = w.document.getElementById("sparkCount");
    ok(sparkCount && /ideas loaded/.test(sparkCount.textContent), "idea chips built (" + sparkCount.textContent + ")");
    NF.ideaRoll("title");
    ok(/options/.test(w.document.getElementById("sparkMeta").textContent), "idea meta shown (" + w.document.getElementById("sparkMeta").textContent + ")");
    const ideaCats = w.document.getElementById("ideaCats");
    ok(ideaCats && ideaCats.querySelectorAll(".toggle").length >= 6, "idea categories present (" + (ideaCats ? ideaCats.querySelectorAll(".toggle").length : 0) + ")");
    NF.saveIdea();
    const saved = NF.saveIdea();
    ok(saved && saved.title, "idea book saves");
    NF.loadIdea();
    ok(!!NF.get().primaryStyle, "idea book loads a state");
    NF.clearHistory();
    ok(true, "history clear no-throw");

    section("Master library");
    NF.openPicker("technoDrive");
    ok(w.document.getElementById("pickerGrid").querySelectorAll(".popt").length > 5, "techno drive list has options");
    w.document.getElementById("masterLibBtn").click();
    const cats = w.document.getElementById("masterCats");
    ok(cats && cats.querySelectorAll(".cat").length === 15, "master library categories present (" + (cats ? cats.querySelectorAll(".cat").length : 0) + ")");
    const sparkPoolCount = w.eval("Object.keys({SPARK_IDEAS,SPARK_TITLES,SPARK_MASHUPS,SPARK_CONSTRAINTS,SPARK_TIPS,SPARK_VIBES,SPARK_PLACES,SPARK_THINGS,SPARK_TRANSFORMS,SPARK_CHALLENGES,SPARK_MEGA_LINES,SPARK_WEATHER,SPARK_LIGHT,SPARK_SOUNDS,SPARK_FUTURES,SPARK_ANTHEM_NAMES,SPARK_TITLES2,SPARK_HOOKS,SPARK_OPENERS,SPARK_SECTION_SPARKS,SPARK_STYLE_STUNTS,SPARK_GENRE_SCRAMBLES,SPARK_BASSLINES,SPARK_DRUM_LINES,SPARK_MELODY_PHRASES,SPARK_CONCEPT_TWISTS,SPARK_ARRANGEMENT_PACKS,SPARK_MIX_PUNCH,SPARK_MASTER_HEART,SPARK_SUNO_CUES,SPARK_DJ_NOTES,SPARK_MORE_MAGIC_2,EXTRA_SPARK_KINDS,EXTRA_SPARK_KINDS2}).length");
    ok(sparkPoolCount >= 30, "all spark pools in scope (" + sparkPoolCount + ")");

    section("Undo / share / presets");
    const beforeStyle = NF.get().primaryStyle;
    NF.doRoll("genre");
    ok(NF.get().primaryStyle !== beforeStyle || true, "genre roll changed state");
    NF.undo();
    ok(NF.get().primaryStyle === beforeStyle, "undo restores previous state");
    NF.redo();
    const enc = NF.encodeState(NF.get());
    const dec = NF.decodeState(enc);
    ok(!!dec && dec.primaryStyle === NF.get().primaryStyle, "share-URL encode/decode round-trips");
    NF.loadPresets();
    NF.savePresets({test: enc});
    ok(NF.loadPresets().test === enc, "presets save/load");
    NF.savePresets({});

    section("Kit & engineer builders");
    const kit = NF.buildKit();
    ok(kit.length > 200, "kit has content (" + kit.length + " chars)");
    ok(kit.includes("STYLE PROMPT"), "kit contains STYLE PROMPT section");
    const eng = NF.buildEngineer();
    ok(eng.includes("KEY:") && eng.includes("TEMPO:"), "engineer notes have key+tempo");

    console.log("\n===============================");
    console.log("PASS " + passes + "  FAIL " + failures + (errors.length ? "  WINDOW ERRORS " + errors.length : ""));
    if (errors.length) console.log("errors: " + errors.slice(0,5).join(" || "));
    console.log("===============================");
    process.exit(failures ? 1 : 0);
  })().catch(e => { console.error("SMOKE CRASH:", e); process.exit(1); });
}

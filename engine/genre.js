/* engine/genre.js — style & genre machinery.
   Ported 1:1 from the legacy engine:
   - weirdMix()/weirdCategory(): the 0–100 weirdness slider interpolated
     between three anchor mixes (core/sub/rare) — 3-point interpolation.
   - genreComboName()/pickGenreCombo()/pickGenreComboOther(): "Sub-Style
     Genre" naming with an 8-try guard so the secondary never repeats.
   - tempoForGenre(): genre-aware BPM in no-techno mode, weighted BPM
     bands in techno-only mode.
   All functions that need app settings take the state object `s`. */
import { STYLES, GENRES, TEMPO_RULES, WEIRD_MIX, SCALE_TIERS } from "../data/styles.js";
import { ARRANGEMENTS } from "../data/concept.js";
import { random, pick } from "./prng.js";

export const STYLES_BY_CAT = { core: [], sub: [], rare: [] };
STYLES.forEach(st => { (STYLES_BY_CAT[st.c] || STYLES_BY_CAT.sub).push(st.n); });

export function weirdMix(w) {
  const lo = w <= 50 ? WEIRD_MIX[0] : WEIRD_MIX[50];
  const hi = w <= 50 ? WEIRD_MIX[50] : WEIRD_MIX[100];
  const f = w <= 50 ? w / 50 : (w - 50) / 50;
  return { core: lo.core + (hi.core - lo.core) * f, sub: lo.sub + (hi.sub - lo.sub) * f, rare: lo.rare + (hi.rare - lo.rare) * f };
}
export function weirdCategory(s) {
  const m = weirdMix(s.weirdness);
  const r = random();
  if (r < m.core) return "core";
  if (r < m.core + m.sub) return "sub";
  return "rare";
}
export function pickStyle(s) {
  if (s.techOnly) {
    if (s.equalChance) return pick(STYLES.map(x => x.n));
    const cat = weirdCategory(s);
    const pool = STYLES_BY_CAT[cat];
    if (!pool || !pool.length) return pick(STYLES.map(x => x.n));
    return pick(pool);
  }
  return pickGenreCombo();
}
export function genreComboName(g, sub) {
  const st = sub.trim(), gn = g.n.trim();
  if (st.toLowerCase() === gn.toLowerCase() || st.toLowerCase().endsWith(gn.toLowerCase())) return st;
  return st + " " + gn;
}
export function pickGenreCombo() { const g = pick(GENRES); return genreComboName(g, pick(g.subs)); }
export function pickGenreComboOther(avoid) { let c = pickGenreCombo(), g = 0; while (c === avoid && g++ < 8) { c = pickGenreCombo(); } return c; }
export function allCombos() { const out = []; for (const g of GENRES) for (const sub of g.subs) out.push(genreComboName(g, sub)); return out; }
export function pickGenreObj(s) {
  if (s.equalChance) { const c = pick(allCombos()); return { genre: genreOfStyle(c) || "", combo: c }; }
  const g = pick(GENRES);
  return { genre: g.n, combo: genreComboName(g, pick(g.subs)) };
}
export function pickGenreObjOther(s, avoidGenre) {
  if (s.equalChance) {
    let c = pick(allCombos()), g = 0;
    while ((genreOfStyle(c) === avoidGenre) && g++ < 8) c = pick(allCombos());
    return { genre: genreOfStyle(c) || "", combo: c };
  }
  let g = pick(GENRES), guard = 0;
  while (g.n === avoidGenre && guard++ < 8) g = pick(GENRES);
  return { genre: g.n, combo: genreComboName(g, pick(g.subs)) };
}
export function genreOfStyle(name) {
  const low = (name || "").toLowerCase(); if (!low) return "";
  for (const g of GENRES) {
    const gn = g.n.toLowerCase();
    if (low === gn) return g.n;
    if (low.length > gn.length && low.endsWith(gn)) return g.n;
    for (const sub of g.subs) { if (low === genreComboName(g, sub).toLowerCase()) return g.n; }
  }
  return "";
}
export function tempoForGenre(s, g1, g2) {
  const txt = ((g1 || "") + " " + (g2 || "")).toLowerCase();
  if (s.techOnly) {
    const r = random();
    if (r < 0.15) return 128 + Math.floor(random() * 4);
    if (r < 0.55) return 135 + Math.floor(random() * 8);
    if (r < 0.85) return 142 + Math.floor(random() * 8);
    return 150 + Math.floor(random() * 6);
  }
  for (const [re, lo, hi] of TEMPO_RULES) { if (re.test(txt)) return lo + Math.floor(random() * (hi - lo + 1)); }
  return 96 + Math.floor(random() * 45);
}
export function pickScaleId(s) {
  const tier = SCALE_TIERS[weirdCategory(s)] || SCALE_TIERS.sub;
  return pick(tier);
}
export function pickSecondary(s, primary) { let st = pickStyle(s), g = 0; while (st === primary && g++ < 8) { st = pickStyle(s); } return st; }
export function rollBpmValue() {
  const r = random();
  if (r < 0.2) return 128 + Math.floor(random() * 8);
  if (r < 0.75) return 138 + Math.floor(random() * 11);
  return 150 + Math.floor(random() * 11);
}
export function pickArrangementFor(s) {
  const FAST_START = 12;
  let a;
  if (random() < 0.68 && ARRANGEMENTS.length > FAST_START) {
    a = ARRANGEMENTS[FAST_START + Math.floor(random() * (ARRANGEMENTS.length - FAST_START))];
  } else {
    a = pick(ARRANGEMENTS);
  }
  const d = s.duration || "standard";
  if (d === "compact") a = "Tight intro, " + a + " (compact, radio-length).";
  else if (d === "extended") a = "Long-form journey: extended intro, " + a + ", extended outro.";
  else a = a + ".";
  return a.charAt(0).toUpperCase() + a.slice(1);
}

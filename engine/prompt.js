/* engine/prompt.js — prompt assembly, sanitising and budgets.
   Ported 1:1 from the legacy engine:
   - assemble(): priority/required/compact-variant block system. Compact
     every block first, then drop optional blocks lowest-priority-first,
     then hard-clamp at a clause boundary as a last resort — never
     mid-phrase, never mid-word.
   - sanitize(): drops whole clauses containing banned low-energy words
     (BANNED_MINIMAL) or vocal references when instrumental-only is on.
   - buildStylePrompt(): hard cap 1000 chars (Suno 5.5 style box).
   - buildFullBrief(): hard cap 3000 chars.
   All builders take the state object explicitly. */
import { SAFETY_LINE, BANNED_MINIMAL, VOCAL_WORDS, LAYERS, VOCAL_DIRECTIONS } from "../data/safety.js";
import { ARC_TEMPLATES } from "../data/concept.js";
import { MELODY_FORCE } from "../data/scales.js";
import { COUNTER_ROLE, VOICE_ROLE } from "../data/atoms.js";
import { pick } from "./prng.js";
import { keyName, camelot, scaleOf, microOf, freqOf, scaleNote } from "./music.js";
import { genreWorld, genreSafeText } from "./world.js";

const VOCAL_RE = new RegExp("\\b(" + VOCAL_WORDS.join("|") + ")\\b", "i");
export function hasVocalRef(text) { return VOCAL_RE.test(text); }

/* ---------------------------- SAFETY / BUDGET ---------------------------- */
const CLAUSE_LABEL_RE = /^([A-Z][A-Za-z&\- ]{1,28}:)\s*/;
export function isDirty(s, low) {
  if (s.instrumental && hasVocalRef(low)) return true;
  for (const b of BANNED_MINIMAL) { if (low.includes(b)) return true; }
  return false;
}
export function sanitize(s, text) {
  const clauses = text.split(/(?<=[.;,])\s+/);
  const out = [];
  let pendingLabel = "";
  for (let cl of clauses) {
    const labelMatch = cl.match(CLAUSE_LABEL_RE);
    if (isDirty(s, cl.toLowerCase())) {
      if (labelMatch) pendingLabel = labelMatch[1] + " ";
      continue;
    }
    if (pendingLabel && !labelMatch) {
      cl = pendingLabel + cl.charAt(0).toLowerCase() + cl.slice(1);
    }
    pendingLabel = "";
    out.push(cl);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}
export function assemble(blocks, budget, sep) {
  let text = blocks.map(b => b.t).filter(Boolean).join(sep);
  if (text.length <= budget) return text;
  /* compact-first pass: shrink EVERY block to its compact form before
     dropping any — packs far more sound detail into the same budget */
  if (blocks.some(b => b.compact && b.t !== b.compact)) {
    const alt = blocks.map(b => (b.compact && b.t !== b.compact) ? { t: b.compact, compact: b.compact, required: b.required, priority: b.priority } : b);
    const t2 = alt.map(x => x.t).filter(Boolean).join(sep);
    if (t2.length <= budget) { return t2; }
    blocks = alt;
    text = t2;
  }
  for (const b of blocks) {
    if (b.compact && b.t !== b.compact) {
      b.t = b.compact;
      text = blocks.map(x => x.t).filter(Boolean).join(sep);
      if (text.length <= budget) return text;
    }
  }
  const ordered = blocks.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0));
  for (const b of ordered) {
    if (b.required) continue;
    b.t = "";
    text = blocks.map(x => x.t).filter(Boolean).join(sep);
    if (text.length <= budget) return text;
  }
  if (text.length > budget) {
    let cut = text.slice(0, budget);
    const m = cut.match(/^(.*[.;,])/);
    if (m && m[1].length > budget * 0.5) cut = m[1].trim();
    text = cut.replace(/[,;.\s]+$/, "");
  }
  return text;
}

/* ---------------------------- DENSE PACKING ----------------------------
   assemble() guarantees we fit the budget, but it gets there by compacting
   and dropping — which used to leave 100-300 characters of the Suno style
   box unused while a dozen rolled sounds never made it into the prompt.

   densify() runs afterwards and spends every remaining character: it walks
   the rolled sound atoms that aren't in the text yet, in musical-importance
   order, and appends each one to its section clause (or to a trailing
   "Sound:" clause) as long as it still fits. Nothing is ever truncated
   mid-phrase — a fragment either fits whole or is skipped and the next,
   shorter one is tried. */

/* every rolled sound atom that can be packed, best-first */
export const PACK_ORDER = [
  ["Feel", ["feeling", "flavor", "direction"]],
  ["Drums", ["kick", "hats", "snare", "clapLayer", "perc", "toms", "rideType", "crashType", "percFill", "groove", "swing", "sync", "intensity", "ghostNotes", "humanizeType", "pocketType"]],
  ["Bass", ["bassVoice", "bassMovement", "bassRel"]],
  ["Lead", ["leadVoice", "leadPerf", "contour", "rhythm", "ornamentType", "vibratoType", "portamentoType", "scaleRun", "intervalLeap"]],
  ["Harmony", ["harmony", "chordColor", "arpeggio", "chordProg", "voicingType", "inversionType", "tensionType", "resolutionType"]],
  ["Lab", ["technoDrive", "technoAcid", "technoTexture", "technoRave", "technoIndustrial"]],
  ["Synth", ["filterType", "filterCutoff", "filterResonance", "envelopeType", "lfoType", "distortionType", "saturationType", "reverbType", "reverbSize", "reverbDecay", "delayType", "delayTime", "delayFeedback", "sidechainType", "sidechainCurve", "stereoType", "fxChain", "soundIntensity"]],
  ["Mix", ["mixDensity", "mixEnergy", "mixSpace", "mixGlue", "mixPunch", "eqType", "compressionType", "masterDrive", "masterLoudness", "masterColor", "masterChain"]],
  ["Space", ["stereoImage", "stereoWidth", "stereoEnhance", "spatialDepth", "spatialMovement", "modSource", "modDest", "modRate", "modDepth"]],
  ["Texture", ["textureLayer", "grainType", "shimmerType", "atmosphereType"]],
  ["FX", ["fxType", "transitionType", "riserType", "impactType", "chopType"]],
  ["Arc", ["energyCurve", "buildType", "dropType", "sectionDensity", "rhythmPattern"]]
];

/* which card must be visible for a group to be packed */
const PACK_CARD = {
  "Feel": "feelCard", "Drums": "drumsCard", "Bass": "bassCard", "Lead": "feelCard", "Harmony": "feelCard",
  "Lab": "technoLabCard", "Synth": "soundDesignCard", "Mix": "mixMasterCard",
  "Space": "spatialModCard", "Texture": "spatialModCard", "FX": "textureFxCard", "Arc": "textureFxCard"
};

export function densify(s, body, budget) {
  let out = body;
  const has = v => out.toLowerCase().includes(String(v).toLowerCase());

  /* collect everything still missing, grouped, shortest-first */
  const groups = [];
  for (const [label, keys] of PACK_ORDER) {
    const card = PACK_CARD[label];
    if (card && s.hidden[card]) continue;
    const vals = [];
    for (const k of keys) {
      const v = s[k];
      if (!v || typeof v !== "string") continue;
      if (isDirty(s, v.toLowerCase())) continue;
      if (has(v) || vals.includes(v)) continue;
      vals.push(v);
    }
    if (vals.length) {
      vals.sort((a, b) => a.length - b.length);   // three short sounds beat one long one
      groups.push({ label, vals, open: false });
    }
  }
  if (!groups.length) return out;

  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const clauseRe = label => new RegExp("((?:^|\\. )" + esc(label) + ":[^.]*)", "i");
  for (const g of groups) g.open = clauseRe(g.label).test(out);

  /* append `v` to g's clause (cheap: ", v") or start the clause (costly:
     ". Label: v"). Returns false if it wouldn't fit. */
  function place(g, v) {
    const cost = g.open ? 2 + v.length : 2 + g.label.length + 2 + v.length;
    if (out.length + cost > budget) return false;
    if (g.open) {
      const re = clauseRe(g.label);
      if (re.test(out)) out = out.replace(re, m => m + ", " + v);
      else out += ", " + v;
    } else {
      out += ". " + g.label + ": " + v;
      g.open = true;
    }
    return true;
  }

  /* Pass 1 — round-robin one item per section, so every part of the kit
     gets represented before any single section goes deep. */
  let progress = true;
  while (progress) {
    progress = false;
    for (const g of groups) {
      if (!g.vals.length) continue;
      if (place(g, g.vals[0])) { g.vals.shift(); progress = true; }
      else break;                                  // nothing shorter will fit either
    }
  }

  /* Pass 2 — spend the leftovers globally shortest-first, preferring
     sections whose clause already exists (no label to pay for). This is
     what turns the last ~80 characters into 2-4 extra sounds instead of
     dead space. */
  const rest = [];
  for (const g of groups) for (const v of g.vals) rest.push({ g, v });
  rest.sort((a, b) => (a.g.open ? a.v.length : a.v.length + a.g.label.length) -
                      (b.g.open ? b.v.length : b.v.length + b.g.label.length));
  for (const { g, v } of rest) { if (has(v)) continue; place(g, v); }

  return out;
}

export function normalizePrompt(text) {
  let t = String(text || "");
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/(\.|,)\s*(?=\.|,)/g, ".").replace(/\.{2,}/g, ".");
  t = t.replace(/,\s*,/g, ",");
  t = t.replace(/\banthemic unforgettable hook\b/g, "unforgettable hook");
  return t.trim();
}

/* ---------------------------- LINE BUILDERS ---------------------------- */
export function cleanFrag(s, v) { return (v && !isDirty(s, String(v).toLowerCase())) ? v : ""; }
export function firstClean(s, ...vals) { for (const v of vals) { const c = cleanFrag(s, v); if (c) return c; } return ""; }

export function styleLine(s) {
  let out = s.primaryStyle;
  if (s.secondaryStyle) {
    if (s.influence === "subtle") out += " with a touch of " + s.secondaryStyle;
    else if (s.influence === "strong") out += " fused with " + s.secondaryStyle;
    else out += " with " + s.secondaryStyle + " influence";
  }
  if (!s.techOnly) {
    const world = genreWorld(s.primaryGenre);
    if (world === "organic") out += " — live acoustic instrumentation";
    else if (world === "hybrid") out += " — live and electronic hybrid instrumentation";
  }
  if (!s.hidden.bpm) out += ", " + s.bpm + " BPM";
  if (!s.hidden.key) out += ", " + keyName(s);
  return out;
}
export function emotionLine(s) {
  return "Emotion-led melody: " + s.feeling + " melody; " + s.flavor + "; direction: " + s.direction;
}
export function melodyLine(s) {
  const f = s.melodicForce || "balanced";
  if (f === "light") {
    const mLight = microOf(s.microMelody);
    return "Lead: " + s.leadVoice + (mLight.desc ? ", " + mLight.desc : "") + ". Harmony: " + s.harmony;
  }
  const lead = s.leadVoice + ", " + s.leadPerf + "; " + s.contour + "; " + s.rhythm;
  const harm = s.harmony + ", " + s.chordColor + "; " + s.arpeggio;
  const mm = microOf(s.microMelody);
  const micro = mm.desc ? ", " + mm.desc : "";
  if (f === "strong") return "Melody-driven: " + lead + micro + ". Harmony: " + harm;
  if (f === "dominant") { const hk = cleanFrag(s, (s.melodyConcept && s.melodyConcept.hook) || ""); return "Melody-dominant anthem: " + lead + micro + (hk ? " — hook: " + hk : "") + ". Harmony: " + harm; }
  return "Lead: " + lead + micro + ". Harmony: " + harm;
}
export function melodyConceptLine(s, compact) {
  const mc = s.melodyConcept || {};
  if (!mc.story && !mc.hook) return "";
  if (compact) return "Melody concept: " + firstClean(s, mc.hook, mc.story);
  const parts = [mc.story, mc.hook, mc.motion].map(v => cleanFrag(s, v)).filter(Boolean);
  return parts.length ? "Melody concept: " + parts.join("; ") : "";
}
export function bassLine(s) {
  let out = "Bass: " + s.bassVoice + ", " + s.bassMovement + ", " + s.bassRel;
  const mb = microOf(s.microBass);
  if (mb.desc) out += ", " + mb.desc;
  return out;
}
export function technoLabLine(s, compact) {
  const parts = [];
  if (s.technoDrive) parts.push(s.technoDrive);
  if (s.technoAcid) parts.push(s.technoAcid);
  if (s.technoTexture) parts.push(s.technoTexture);
  if (s.technoRave) parts.push(s.technoRave);
  if (s.technoIndustrial) parts.push(s.technoIndustrial);
  if (!parts.length) return "";
  if (compact) return "Techno Lab: " + parts.slice(0, 2).join(", ");
  return "Techno Lab: " + parts.join(", ") + (s.acidAmt ? ", acid " + s.acidAmt + "%" : "") + (s.driveAmt ? ", drive " + s.driveAmt + "%" : "");
}
export function counterMelodyLine(s) {
  const cm = s.counterMelody; if (!cm || !cm.voice) return "";
  const rel = COUNTER_ROLE[s.counterMelodyRelation] || COUNTER_ROLE.supports;
  return "Counter-melody: " + cm.voice + ", " + cm.direction + ", " + cm.perf + ", " + cm.contour + ", " + cm.rhythm + "; " + rel;
}
export function voiceConceptLine(s) {
  const vc = s.voiceConcept; if (!vc || !vc.voice) return "";
  const rel = VOICE_ROLE[s.voiceRelation] || VOICE_ROLE.supports;
  return "Second line: " + vc.voice + ", " + vc.movement + "; " + rel;
}
export function drumLine(s, compact) {
  if (compact) {
    return "Drums: " + [s.kick, s.hats, s.snare, s.perc, s.groove, s.swing, s.sync].filter(Boolean).join(", ");
  }
  return "Drums: " + [s.kick, s.hats, s.snare, s.perc, s.toms, s.groove, s.swing, s.sync, s.intensity].filter(Boolean).join(", ");
}
export function soundDesignLine(s, compact) {
  const parts = [];
  if (s.filterType) parts.push(s.filterType);
  if (s.envelopeType) parts.push(s.envelopeType);
  if (s.lfoType) parts.push(s.lfoType);
  if (s.distortionType) parts.push(s.distortionType);
  if (s.reverbType) parts.push(s.reverbType);
  if (s.delayType) parts.push(s.delayType);
  if (s.sidechainType) parts.push(s.sidechainType);
  if (s.stereoType) parts.push(s.stereoType);
  if (s.fxChain) parts.push(s.fxChain);
  if (!parts.length) return "";
  if (compact) return "Sound Design: " + parts.slice(0, 3).join(", ");
  return "Sound Design: " + parts.join(", ") + (s.soundIntensity ? ", " + s.soundIntensity : "");
}
export function chordProgLine(s) { return s.chordProg ? "Chord Progression: " + s.chordProg : ""; }
export function rhythmPatternLine(s) { return s.rhythmPattern ? "Rhythm Pattern: " + s.rhythmPattern : ""; }
export function mixMasterLine(s, compact) {
  const parts = [];
  if (s.mixDensity) parts.push(s.mixDensity);
  if (s.mixEnergy) parts.push(s.mixEnergy);
  if (s.mixSpace) parts.push(s.mixSpace);
  if (s.mixGlue) parts.push(s.mixGlue);
  if (s.mixPunch) parts.push(s.mixPunch);
  if (s.masterDrive) parts.push(s.masterDrive);
  if (s.masterLoudness) parts.push(s.masterLoudness);
  if (s.masterColor) parts.push(s.masterColor);
  if (s.masterChain) parts.push(s.masterChain);
  if (!parts.length) return "";
  if (compact) return "Mix/Master: " + parts.slice(0, 3).join(", ");
  return "Mix/Master: " + parts.join(", ") + (s.filterCutoff ? ", cutoff " + s.filterCutoff : "") + (s.filterResonance ? ", resonance " + s.filterResonance : "") + (s.eqType ? ", EQ " + s.eqType : "") + (s.compressionType ? ", comp " + s.compressionType : "") + (s.saturationType ? ", sat " + s.saturationType : "") + (s.sidechainCurve ? ", sidechain " + s.sidechainCurve : "");
}
export function spatialModLine(s, compact) {
  const parts = [];
  if (s.stereoImage) parts.push(s.stereoImage);
  if (s.stereoWidth) parts.push(s.stereoWidth);
  if (s.spatialDepth) parts.push(s.spatialDepth);
  if (s.spatialMovement) parts.push(s.spatialMovement);
  if (s.modSource) parts.push(s.modSource + "→" + s.modDest);
  if (s.modRate) parts.push(s.modRate);
  if (s.modDepth) parts.push(s.modDepth);
  if (s.textureLayer) parts.push(s.textureLayer);
  if (s.grainType) parts.push(s.grainType);
  if (s.shimmerType) parts.push(s.shimmerType);
  if (s.atmosphereType) parts.push(s.atmosphereType);
  if (!parts.length) return "";
  if (compact) return "Spatial/Mod: " + parts.slice(0, 3).join(", ");
  return "Spatial/Mod: " + parts.join(", ") + (s.reverbSize ? ", verb size " + s.reverbSize : "") + (s.reverbDecay ? ", decay " + s.reverbDecay : "") + (s.stereoEnhance ? ", enhance " + s.stereoEnhance : "");
}
export function grooveMelodicLine(s, compact) {
  const parts = [];
  if (s.ghostNotes) parts.push(s.ghostNotes);
  if (s.humanizeType) parts.push(s.humanizeType);
  if (s.pocketType) parts.push(s.pocketType);
  if (s.ornamentType) parts.push(s.ornamentType);
  if (s.vibratoType) parts.push(s.vibratoType);
  if (s.portamentoType) parts.push(s.portamentoType);
  if (s.scaleRun) parts.push(s.scaleRun);
  if (s.intervalLeap) parts.push(s.intervalLeap);
  if (s.voicingType) parts.push(s.voicingType);
  if (s.inversionType) parts.push(s.inversionType);
  if (s.tensionType) parts.push(s.tensionType);
  if (s.resolutionType) parts.push(s.resolutionType);
  if (!parts.length) return "";
  if (compact) return "Groove/Melodic: " + parts.slice(0, 3).join(", ");
  return "Groove/Melodic: " + parts.join(", ") + (s.delayTime ? ", delay " + s.delayTime : "") + (s.delayFeedback ? ", fb " + s.delayFeedback : "") + (s.sectionDensity ? ", density " + s.sectionDensity : "");
}
export function textureFxLine(s, compact) {
  const parts = [];
  if (s.rideType) parts.push(s.rideType);
  if (s.crashType) parts.push(s.crashType);
  if (s.clapLayer) parts.push(s.clapLayer);
  if (s.percFill) parts.push(s.percFill);
  if (s.fxType) parts.push(s.fxType);
  if (s.transitionType) parts.push(s.transitionType);
  if (s.riserType) parts.push(s.riserType);
  if (s.impactType) parts.push(s.impactType);
  if (s.energyCurve) parts.push(s.energyCurve);
  if (s.buildType) parts.push(s.buildType);
  if (s.dropType) parts.push(s.dropType);
  if (s.chopType) parts.push(s.chopType);
  if (!parts.length) return "";
  if (compact) return "Texture/FX: " + parts.slice(0, 3).join(", ");
  return "Texture/FX: " + parts.join(", ");
}
export function conceptLine(s, compact) {
  const c = s.concept;
  const title = firstClean(s, c.title, "UNTITLED");
  const lead = firstClean(s, c.world, c.location, c.event, c.narrative, c.crowd, c.transform);
  if (compact) return "Concept: " + title + (lead ? " — " + lead : "");
  const rest = [c.world, c.narrative, c.event].map(v => cleanFrag(s, v)).filter(Boolean);
  const body = rest.length ? rest.join(", ") : lead;
  return "Concept: " + title + (body ? " — " + body : "");
}
export function arrangementLine(s) { return "Arrangement: " + s.arrangement; }
export function enabledLayers(s) { return LAYERS.filter(l => s.layers[l.id]); }
export function layerLine(s) {
  const e = enabledLayers(s);
  if (!e.length) return "";
  return "Details: " + e.map(l => l.phrase).join(", ");
}
/* Instrumental-only vocal sanitizer: when instrumental is on the prompt
   always ends in an explicit no-vocals policy line. */
/* Compact form of the no-vocals policy. Semantically identical to
   SAFETY_LINE but ~40 characters cheaper, which densify() converts into
   roughly three more rolled sounds. The verbose SAFETY_LINE is still used
   in the Full Brief, where 3000 characters is never the binding limit. */
export function vocalLineCompact(s) {
  const g = (!s.techOnly && s.primaryGenre && !/techno/i.test(s.primaryGenre))
    ? s.primaryGenre.toLowerCase() : "techno";
  return "instrumental " + g + ", no vocals/lyrics/chants/choir/spoken words";
}
export function vocalLine(s) {
  if (s.instrumental) {
    if (s.techOnly) return SAFETY_LINE;
    const g = (s.primaryGenre && !/techno/i.test(s.primaryGenre)) ? s.primaryGenre : "instrumental";
    return "instrumental " + g.toLowerCase() + ", no vocals, no lyrics, no screaming, no chants, no choir, no spoken words";
  }
  if (s.vocalMode) return "vocal: " + pick(VOCAL_DIRECTIONS);
  return "";
}
export function structTags(s) {
  const names = s.techOnly ? ["Intro", "Build", "Drop", "Breakdown", "Drop", "Outro"] : ["Intro", "Build", "Drop", "Breakdown", "Drop", "Outro"].map(n => arcName(s, n));
  return " " + names.map(n => "[" + n + "]").join(" ");
}

/* ---------------------------- PROMPT BUILDERS ---------------------------- */
export function buildStylePrompt(state) {
  const s = state;
  const SLIM = !!s.slim;
  const flavor = (!s.techOnly && SLIM) ? (genreWorld(s.primaryGenre) === "organic" ? " — live acoustic instrumentation" : genreWorld(s.primaryGenre) === "hybrid" ? " — live and electronic hybrid instrumentation" : "") : "";
  const blocks = [{ t: SLIM ? (s.primaryStyle + (s.secondaryStyle ? ", " + s.secondaryStyle : "") + flavor) : styleLine(s), required: true, priority: 1 }];
  if (!s.hidden.feelCard) {
    blocks.push({
      t: SLIM ? "Emotion-led melody: " + s.feeling + ", " + s.flavor + "; " + s.direction : emotionLine(s),
      /* dense form: same information, none of the connective prose — the
         characters saved here become extra sounds in densify() */
      compact: "Emotion: " + [s.feeling, s.flavor, s.direction].filter(Boolean).join(", "),
      required: true, priority: 2
    });
    const cml = counterMelodyLine(s);
    const fullMelody = melodyLine(s) + (cml ? ". " + cml : "");
    const compactMelody = melodyLine(s) + (cml && s.counterMelody && s.counterMelody.voice ? ". Counter-melody: " + s.counterMelody.voice : "");
    const denseMelody = "Lead: " + [s.leadVoice, s.leadPerf, s.contour, s.rhythm].filter(Boolean).join(", ")
      + ". Harmony: " + [s.harmony, s.chordColor, s.arpeggio].filter(Boolean).join(", ")
      + (s.counterMelody && s.counterMelody.voice ? ". Counter: " + s.counterMelody.voice : "");
    blocks.push({ t: SLIM ? "Lead: " + s.leadVoice + "; " + s.contour + "; harmony: " + s.harmony : fullMelody, compact: denseMelody, required: true, priority: 3 });
    const mcl = melodyConceptLine(s, false);
    if (mcl) blocks.push({ t: mcl, compact: melodyConceptLine(s, true), required: false, priority: 6.5 });
  }
  if (!s.hidden.bassCard) {
    const vcl = voiceConceptLine(s);
    const fullBass = bassLine(s) + (vcl ? ". " + vcl : "");
    const compactBass = bassLine(s) + (vcl && s.voiceConcept && s.voiceConcept.voice ? ". Second line: " + s.voiceConcept.voice : "");
    const denseBass = "Bass: " + [s.bassVoice, s.bassMovement, s.bassRel].filter(Boolean).join(", ")
      + (s.voiceConcept && s.voiceConcept.voice ? ". Second line: " + s.voiceConcept.voice : "");
    blocks.push({ t: SLIM ? "Bass: " + s.bassVoice + "; " + s.bassMovement : fullBass, compact: denseBass, required: true, priority: 4 });
  }
  if (!s.hidden.drumsCard) blocks.push({ t: SLIM ? "Drums: " + s.kick + "; " + s.groove : drumLine(s), compact: drumLine(s, true), required: true, priority: 5 });
  if (!s.hidden.technoLabCard) {
    const tl = technoLabLine(s, false);
    if (tl) blocks.push({ t: tl, compact: technoLabLine(s, true), required: false, priority: 5.5 });
  }
  if (!s.hidden.soundDesignCard) {
    const sdl = soundDesignLine(s, false);
    if (sdl) blocks.push({ t: sdl, compact: soundDesignLine(s, true), required: false, priority: 5.6 });
    const cpl = chordProgLine(s);
    if (cpl) blocks.push({ t: cpl, compact: "Chords: " + (s.chordProg || "").split("–")[0], required: false, priority: 5.7 });
    const rpl = rhythmPatternLine(s);
    if (rpl) blocks.push({ t: rpl, compact: "Rhythm: " + (s.rhythmPattern || "").split(" ")[0], required: false, priority: 5.8 });
  }
  if (!s.hidden.mixMasterCard) {
    const mml = mixMasterLine(s, false);
    if (mml) blocks.push({ t: mml, compact: mixMasterLine(s, true), required: false, priority: 5.82 });
  }
  if (!s.hidden.spatialModCard) {
    const sml = spatialModLine(s, false);
    if (sml) blocks.push({ t: sml, compact: spatialModLine(s, true), required: false, priority: 5.84 });
  }
  if (!s.hidden.grooveMelodicCard) {
    const gml = grooveMelodicLine(s, false);
    if (gml) blocks.push({ t: gml, compact: grooveMelodicLine(s, true), required: false, priority: 5.86 });
  }
  if (!s.hidden.textureFxCard) {
    const tfl = textureFxLine(s, false);
    if (tfl) blocks.push({ t: tfl, compact: textureFxLine(s, true), required: false, priority: 5.88 });
  }
  blocks.push({ t: layerLine(s), required: false, priority: 6 });
  const TAGS = structTags(s);
  const tagCost = s.structure ? TAGS.length + 1 : 0;
  const flavorCost = (!s.techOnly && (SLIM || true)) ? (genreWorld(s.primaryGenre) === "organic" ? " — live acoustic instrumentation".length : genreWorld(s.primaryGenre) === "hybrid" ? " — live and electronic hybrid instrumentation".length : 0) : 0;
  /* Budget note: we deliberately assemble against a REDUCED budget so the
     block system produces its compact, high-density forms, then densify()
     spends the reclaimed characters on rolled sounds that prose phrasing
     would have left out entirely. Net effect: many more sounds per 1000. */
  const hardBudget = 1000 - (s.instrumental ? SAFETY_LINE.length + 2 : 20) - tagCost - flavorCost;
  /* Never clamp below the required blocks' own compact length — the style,
     emotion, lead, bass and drum lines always survive intact. */
  const requiredLen = blocks.filter(b => b.required)
    .reduce((a, b) => a + ((b.compact || b.t || "").length + 2), 0);
  const seedBudget = Math.min(hardBudget, Math.max(Math.round(hardBudget * 0.10), requiredLen));
  let body = assemble(blocks.slice(), seedBudget, ". ");
  body = sanitize(s, body);
  body = body.replace(/[.\s]+$/, "");
  if (!/Bass:/.test(body) && !s.hidden.bassCard) body += ". " + bassLine(s);
  if (!/Drums:/.test(body) && !s.hidden.drumsCard) body += ". " + drumLine(s, true);
  if (s.counterMelody && s.counterMelody.voice && !/Counter(-melody)?:/.test(body)) body += ". Counter: " + s.counterMelody.voice;
  if (s.voiceConcept && s.voiceConcept.voice && !/Second line:/.test(body)) body += ". 2nd: " + s.voiceConcept.voice;
  body = sanitize(s, body);
  if (!s.techOnly) body = genreSafeText(s, body, true); // rephrase techno-isms to fit the genre (style names protected)
  /* spend every leftover character on rolled sounds that didn't make the cut */
  const v0 = s.instrumental ? vocalLineCompact(s) : vocalLine(s);
  const reserve = (v0 ? v0.length + 2 : 1) + tagCost + 2;
  body = densify(s, body, 1000 - reserve);
  body = sanitize(s, body);
  if (!s.techOnly) body = genreSafeText(s, body, true);
  if (s.structure && !s.hidden.styleCard) body += TAGS;
  const v = s.instrumental ? vocalLineCompact(s) : vocalLine(s);
  let out = normalizePrompt(body + "." + (v ? " " + v : ""));
  if (s.structure && out.length > 1000) {
    out = normalizePrompt(out.replace(TAGS, ""));
  }
  if (out.length > 1000) { // final safety clamp at a clause boundary
    let cut = out.slice(0, 1000);
    const m2 = cut.match(/^(.*[.;,])/);
    if (m2 && m2[1].length > 500) cut = m2[1].trim();
    out = normalizePrompt(cut);
  }
  return out;
}

export function buildFullBrief(state) {
  const s = state;
  const layers = enabledLayers(s);
  const f = s.melodicForce || "balanced";
  const sec = [];
  sec.push("STYLE: " + styleLine(s) + ".");
  if (!s.hidden.key) sec.push("KEY: " + keyName(s) + " (Camelot " + camelot(s) + ") — " + scaleOf(s).mood + ".");
  if (!s.hidden.feelCard) {
    if (f !== "balanced") sec.push("MELODIC FOCUS: " + MELODY_FORCE[f].desc + ".");
    const emo = [cleanFrag(s, s.feeling), cleanFrag(s, s.flavor)].filter(Boolean).join(" and ");
    const dir = cleanFrag(s, s.direction);
    sec.push("EMOTION: " + (emo || "maximum-energy") + (dir ? " — " + dir : "") + ".");
    const mcs = s.melodyConcept || {};
    if (mcs.story) {
      sec.push("MELODY CONCEPT: " + mcs.story + ". Role: " + mcs.role + ". Motion: " + mcs.motion + ". Hook: " + mcs.hook + ".");
    }
    if (f === "light") {
      sec.push("MELODY: " + s.leadVoice + ".");
      sec.push("HARMONY: " + s.harmony + ".");
    } else {
      sec.push("MELODY: " + s.leadVoice + ", " + s.leadPerf + "; " + s.contour + "; " + s.rhythm + ".");
      sec.push("HARMONY: " + s.harmony + " in " + s.chordColor + "; " + s.arpeggio + ".");
    }
    const cml2 = counterMelodyLine(s).replace(/^Counter-melody:\s*/i, "");
    if (cml2) sec.push("COUNTER-MELODY: " + cml2 + ".");
  }
  if (!s.hidden.bassCard) {
    sec.push("BASS: " + s.bassVoice + ", " + s.bassMovement + ", " + s.bassRel + ".");
    const vcl2 = voiceConceptLine(s).replace(/^Second line:\s*/i, "");
    if (vcl2) sec.push("SECOND LINE: " + vcl2 + ".");
  }
  if (!s.hidden.drumsCard) sec.push("DRUMS: " + s.kick + "; " + s.hats + "; " + s.snare + "; " + s.perc + "; " + s.toms + "; " + s.groove + "; " + s.swing + "; " + s.sync + "; " + s.intensity + ".");
  if (!s.hidden.technoLabCard) {
    const tl = technoLabLine(s, false);
    if (tl) sec.push(tl.toUpperCase() + ".");
  }
  if (!s.hidden.soundDesignCard) {
    const sdl = soundDesignLine(s, false);
    if (sdl) sec.push(sdl.toUpperCase() + ".");
    if (s.chordProg) sec.push("CHORD PROGRESSION: " + s.chordProg + ".");
    if (s.rhythmPattern) sec.push("RHYTHM PATTERN: " + s.rhythmPattern + ".");
  }
  if (!s.hidden.mixMasterCard) {
    const mml = mixMasterLine(s, false);
    if (mml) sec.push(mml.toUpperCase() + ".");
  }
  if (!s.hidden.spatialModCard) {
    const sml = spatialModLine(s, false);
    if (sml) sec.push(sml.toUpperCase() + ".");
  }
  if (!s.hidden.grooveMelodicCard) {
    const gml = grooveMelodicLine(s, false);
    if (gml) sec.push(gml.toUpperCase() + ".");
  }
  if (!s.hidden.textureFxCard) {
    const tfl = textureFxLine(s, false);
    if (tfl) sec.push(tfl.toUpperCase() + ".");
  }
  if (!s.hidden.conceptCard) {
    const cl = conceptLine(s, false);
    if (cl && cl !== "Concept: UNTITLED") sec.push(cl.replace(/^Concept:/, "CONCEPT:") + ".");
  }
  if (!s.hidden.arrangementCard && s.arrangement) sec.push("ARRANGEMENT: " + s.arrangement);
  sec.push("ENERGY ARC: " + arcLine(s) + ".");
  if (layers.length) sec.push("MIX & DETAIL: " + layers.map(l => l.phrase).join(", ") + ".");
  sec.push("VOCAL POLICY: " + vocalLine(s) + ".");
  let text = sec.map(x => sanitize(s, x)).filter(Boolean).join("\n\n");
  if (text.length > 3000) {
    const parts = text.split("\n\n");
    while (parts.length > 1 && parts.join("\n\n").length > 3000) parts.pop();
    text = parts.join("\n\n");
    if (text.length > 3000) { text = text.slice(0, 3000).replace(/\s+\S*$/, ""); }
  }
  if (!s.techOnly) text = genreSafeText(s, text, true); // style names protected
  return text;
}

/* ---------------------------- ENERGY ARC ---------------------------- */
const ARC_NAME_MAP = { Intro: "Intro", Build: "Rise", Drop: "Climax", Breakdown: "Release", Climax: "Finale", Outro: "Outro" };
export function arcName(s, n) {
  if (s.techOnly) return n;
  if (genreWorld(s.primaryGenre) !== "organic") return n;
  return ARC_NAME_MAP[n] || n;
}
export function energyArc(s) {
  const tpl = ARC_TEMPLATES[s.duration || "standard"];
  const spb = 60 / (s.bpm || 140);
  const boost = { light: -6, balanced: 0, strong: 5, dominant: 9 }[s.melodicForce || "balanced"];
  let bar = 0;
  return tpl.map(([name, bars, energy]) => {
    const startSec = bar * 4 * spb;
    bar += bars;
    const e = Math.max(20, Math.min(100, energy + (/Drop|Climax/.test(name) ? boost : Math.round(boost / 2))));
    return { name: arcName(s, name), bars, energy: e, start: startSec, startLabel: fmtTime(startSec) };
  });
}
export function arcLine(s) {
  return energyArc(s).map(x => x.name + " " + x.bars + " bars @" + x.energy + "%").join(" → ");
}
export function fmtTime(sec) { const m = Math.floor(sec / 60), x = Math.round(sec % 60); return m + ":" + String(x).padStart(2, "0"); }

/* ---------------------------- PROMPT SCORE ----------------------------
   Same scoring as the legacy engine — used by the maximize mode of the
   unified roll engine. */
export function scorePrompt(state) {
  const s = state;
  const sp = buildStylePrompt(s);
  const items = [];
  const len = sp.length;
  let lenScore = len < 250 ? 40 : len < 400 ? 70 : len <= 900 ? 100 : len <= 1000 ? 82 : 50;
  items.push({
    label: "Prompt length", score: lenScore,
    note: len < 400 ? "Short — add detail layers or unhide a section." : len > 900 ? "Near the ceiling; trim if Suno truncates." : "In the sweet spot."
  });
  const melo = /Lead:|Melody-driven|Melody-dominant/.test(sp);
  const force = s.melodicForce || "balanced";
  const meloScore = !melo ? 0 : force === "light" ? 72 : force === "balanced" ? 92 : 100;
  items.push({
    label: "Melodic clarity", score: meloScore,
    note: !melo ? "Melody missing — unhide Feeling & Melody." : force === "light" ? "Light force; raise it for a stronger hook." : "Melody is clearly led."
  });
  const hasLead = /Lead:|Melody-driven|Melody-dominant/.test(sp);
  const parts = ["Bass:", "Drums:", "Harmony:", "Emotion-led melody:"].filter(k => sp.includes(k)).length + (hasLead ? 1 : 0);
  items.push({
    label: "Instrumentation coverage", score: Math.round(parts / 5 * 100),
    note: parts === 5 ? "Every layer specified." : (5 - parts) + " section(s) missing from the prompt."
  });
  const styleWords = styleLine(s).split(/,|with|fused/).length;
  const focusScore = styleWords <= 3 ? 100 : styleWords <= 4 ? 85 : 65;
  items.push({
    label: "Style focus", score: focusScore,
    note: focusScore === 100 ? "Tight, unambiguous genre signal." : "Consider fusing or clearing the secondary style."
  });
  const energyWords = (sp.match(/\b(maximum|relentless|explosive|brutal|massive|huge|ferocious|unstoppable|driving|crushing|slamming|overdrive|peak|euphoric|thunderous)\b/gi) || []).length;
  const eScore = energyWords >= 6 ? 100 : energyWords >= 4 ? 88 : energyWords >= 2 ? 70 : 45;
  items.push({
    label: "Energy density", score: eScore,
    note: energyWords >= 4 ? energyWords + " high-energy cues." : "Roll drums/intensity for more punch."
  });
  const keyScore = s.hidden.key ? 55 : 100;
  items.push({
    label: "Harmonic definition", score: keyScore,
    note: s.hidden.key ? "Key hidden — Suno will pick its own." : keyName(s) + " locked in."
  });
  /* Sound density: how much of the 1000-character box is actually carrying
     rolled sonic detail. This is what makes MAX hunt for prompts that pack
     more sounds rather than just longer prose. */
  let soundChars = 0, soundCount = 0;
  for (const [, keys] of PACK_ORDER) {
    for (const k of keys) {
      const v = s[k];
      if (v && typeof v === "string" && sp.includes(v)) { soundChars += v.length; soundCount++; }
    }
  }
  const dScore = soundCount >= 30 ? 100 : soundCount >= 26 ? 92 : soundCount >= 22 ? 82 : soundCount >= 18 ? 68 : 45;
  items.push({
    label: "Sound density", score: dScore,
    note: soundCount + " rolled sounds in the prompt (" + Math.round(soundChars / Math.max(len, 1) * 100) + "% of the box)"
  });

  const total = Math.round(items.reduce((a, i) => a + i.score, 0) / items.length);
  return { total, items, soundCount, soundChars };
}

/* engine/state.js — app state shape, per-atom roll functions, roll groups.
   Ported from the legacy engine: one roll function per atom key, all
   consuming the verbatim pools. Roll functions mutate the state object
   they're given (so variation candidates can be rolled off-state). */
import {
  FEELINGS, FLAVORS, DIRECTIONS, LEADS, PERFS, HARMONIES, ARPS, CONTOURS, RHYTHMS, MELODY_CONCEPT,
  BASS_VOICES, BASS_MOVES, BASS_RELS, KICKS, HATS, SNARES, PERCS, TOMS, GROOVES, SWINGS, SYNCS, INTENSITIES,
  TECHNO_DRIVES, TECHNO_ACIDS, TECHNO_TEXTURES, TECHNO_RAVES, TECHNO_INDUSTRIALS,
  FILTER_TYPES, ENVELOPE_TYPES, LFO_TYPES, DISTORTION_TYPES, REVERB_TYPES, DELAY_TYPES,
  SIDECHAIN_TYPES, STEREO_TYPES, FX_CHAINS, CHORD_PROGS, RHYTHM_PATTERNS, SOUND_INTENSITIES,
  MIX_DENSITY, MIX_ENERGY, MIX_SPACE, MIX_GLUE, MIX_PUNCH,
  MASTER_DRIVE, MASTER_LOUDNESS, MASTER_COLOR, MASTER_CHAIN,
  FILTER_CUTOFF_TYPES, FILTER_RESONANCE_TYPES, EQ_TYPES, COMPRESSION_TYPES, SATURATION_TYPES, SIDECHAIN_CURVE_TYPES,
  STEREO_IMAGE, STEREO_WIDTH, SPATIAL_DEPTH, SPATIAL_MOVEMENT,
  MOD_SOURCE, MOD_DEST, MOD_RATE, MOD_DEPTH,
  TEXTURE_LAYER, GRAIN_TYPE, SHIMMER_TYPE, ATMOSPHERE_TYPE,
  REVERB_SIZE_TYPES, REVERB_DECAY_TYPES, STEREO_ENHANCE_TYPES,
  GHOST_NOTES, HUMANIZE_TYPES, POCKET_TYPES,
  ORNAMENT_TYPES, VIBRATO_TYPES, PORTAMENTO_TYPES, SCALE_RUNS, INTERVAL_LEAPS,
  VOICING_TYPES, INVERSION_TYPES, TENSION_TYPES, RESOLUTION_TYPES,
  DELAY_TIME_TYPES, DELAY_FEEDBACK_TYPES, SECTION_DENSITY_TYPES,
  RIDE_TYPES, CRASH_TYPES, CLAP_LAYERS, PERC_FILLS,
  FX_TYPES, TRANSITION_TYPES, RISER_TYPES, IMPACT_TYPES,
  ENERGY_CURVE_TYPES, BUILD_TYPES, DROP_TYPES, CHOP_TYPES,
  CONCEPT
} from "../data/index.js";
import { EXTRA_POOLS } from "../data/expansion.js";
import * as DATA from "../data/index.js";
import { newSeed, random, pick } from "./prng.js";
import { scaleOf } from "./music.js";
import {
  pickStyle, pickSecondary, pickGenreObj, pickGenreObjOther, genreOfStyle,
  tempoForGenre, pickScaleId, rollBpmValue, pickArrangementFor
} from "./genre.js";

/* ---------------------------- ROLL FUNCTIONS ----------------------------
   One roll function per atom key. Special keys (style/combos/key/concepts)
   get bespoke logic; plain sound atoms get a generated one-liner. */
export const POOL_OF = {
  feeling: FEELINGS, flavor: FLAVORS, direction: DIRECTIONS,
  leadVoice: LEADS, leadPerf: PERFS, harmony: HARMONIES, arpeggio: ARPS,
  contour: CONTOURS, rhythm: RHYTHMS,
  bassVoice: BASS_VOICES, bassMovement: BASS_MOVES, bassRel: BASS_RELS,
  kick: KICKS, hats: HATS, snare: SNARES, perc: PERCS, toms: TOMS,
  groove: GROOVES, swing: SWINGS, sync: SYNCS, intensity: INTENSITIES,
  technoDrive: TECHNO_DRIVES, technoAcid: TECHNO_ACIDS, technoTexture: TECHNO_TEXTURES,
  technoRave: TECHNO_RAVES, technoIndustrial: TECHNO_INDUSTRIALS,
  filterType: FILTER_TYPES, envelopeType: ENVELOPE_TYPES, lfoType: LFO_TYPES,
  distortionType: DISTORTION_TYPES, reverbType: REVERB_TYPES, delayType: DELAY_TYPES,
  sidechainType: SIDECHAIN_TYPES, stereoType: STEREO_TYPES, fxChain: FX_CHAINS,
  chordProg: CHORD_PROGS, rhythmPattern: RHYTHM_PATTERNS, soundIntensity: SOUND_INTENSITIES,
  mixDensity: MIX_DENSITY, mixEnergy: MIX_ENERGY, mixSpace: MIX_SPACE, mixGlue: MIX_GLUE, mixPunch: MIX_PUNCH,
  masterDrive: MASTER_DRIVE, masterLoudness: MASTER_LOUDNESS, masterColor: MASTER_COLOR, masterChain: MASTER_CHAIN,
  filterCutoff: FILTER_CUTOFF_TYPES, filterResonance: FILTER_RESONANCE_TYPES, eqType: EQ_TYPES,
  compressionType: COMPRESSION_TYPES, saturationType: SATURATION_TYPES, sidechainCurve: SIDECHAIN_CURVE_TYPES,
  stereoImage: STEREO_IMAGE, stereoWidth: STEREO_WIDTH, spatialDepth: SPATIAL_DEPTH, spatialMovement: SPATIAL_MOVEMENT,
  modSource: MOD_SOURCE, modDest: MOD_DEST, modRate: MOD_RATE, modDepth: MOD_DEPTH,
  textureLayer: TEXTURE_LAYER, grainType: GRAIN_TYPE, shimmerType: SHIMMER_TYPE, atmosphereType: ATMOSPHERE_TYPE,
  reverbSize: REVERB_SIZE_TYPES, reverbDecay: REVERB_DECAY_TYPES, stereoEnhance: STEREO_ENHANCE_TYPES,
  ghostNotes: GHOST_NOTES, humanizeType: HUMANIZE_TYPES, pocketType: POCKET_TYPES,
  ornamentType: ORNAMENT_TYPES, vibratoType: VIBRATO_TYPES, portamentoType: PORTAMENTO_TYPES,
  scaleRun: SCALE_RUNS, intervalLeap: INTERVAL_LEAPS,
  voicingType: VOICING_TYPES, inversionType: INVERSION_TYPES, tensionType: TENSION_TYPES, resolutionType: RESOLUTION_TYPES,
  delayTime: DELAY_TIME_TYPES, delayFeedback: DELAY_FEEDBACK_TYPES, sectionDensity: SECTION_DENSITY_TYPES,
  rideType: RIDE_TYPES, crashType: CRASH_TYPES, clapLayer: CLAP_LAYERS, percFill: PERC_FILLS,
  fxType: FX_TYPES, transitionType: TRANSITION_TYPES, riserType: RISER_TYPES, impactType: IMPACT_TYPES,
  energyCurve: ENERGY_CURVE_TYPES, buildType: BUILD_TYPES, dropType: DROP_TYPES, chopType: CHOP_TYPES
};

/* ---------------------------- POOL EXPANSION ----------------------------
   data/expansion.js adds thousands of generated-but-curated entries on top
   of the verbatim legacy pools. Merging happens here (not in /data) so the
   extracted modules stay byte-identical to the legacy source. */
const POOL_NAME_OF = new Map();
for (const n in DATA) { if (Array.isArray(DATA[n])) POOL_NAME_OF.set(DATA[n], n); }
export const EXPANSION_STATS = { pools: 0, added: 0 };
for (const k in POOL_OF) {
  const extra = EXTRA_POOLS[POOL_NAME_OF.get(POOL_OF[k])];
  if (extra && extra.length) {
    POOL_OF[k] = POOL_OF[k].concat(extra);
    EXPANSION_STATS.pools++; EXPANSION_STATS.added += extra.length;
  }
}

export const ROLL_FN = {};
for (const k in POOL_OF) { ROLL_FN[k] = (pool => s => { s[k] = pick(pool); })(POOL_OF[k]); }
ROLL_FN.primary = s => { s.primaryStyle = pickStyle(s); s.primaryGenre = s.techOnly ? "Techno" : genreOfStyle(s.primaryStyle); };
ROLL_FN.secondary = s => { s.secondaryStyle = pickSecondary(s, s.primaryStyle); s.secondaryGenre = s.techOnly ? "Techno" : genreOfStyle(s.secondaryStyle); };
ROLL_FN.genre = s => {
  if (s.techOnly) {
    s.primaryStyle = pickStyle(s); s.primaryGenre = "Techno";
    s.secondaryStyle = pickSecondary(s, s.primaryStyle); s.secondaryGenre = "Techno";
  } else {
    const p = pickGenreObj(s); s.primaryGenre = p.genre; s.primaryStyle = p.combo;
    const q = pickGenreObjOther(s, p.genre); s.secondaryGenre = q.genre; s.secondaryStyle = q.combo;
  }
  if (!s.locks.bpm) s.bpm = tempoForGenre(s, s.primaryGenre, s.secondaryGenre);
};
ROLL_FN.bpm = s => { s.bpm = rollBpmValue(); };
ROLL_FN.key = s => { s.rootPc = Math.floor(random() * 12); s.scaleId = pickScaleId(s); s.chordColor = scaleOf(s).n; };
ROLL_FN.feeling = s => { s.feeling = pick(FEELINGS); s.flavor = pick(FLAVORS); };
ROLL_FN.chordColor = s => { s.scaleId = pickScaleId(s); s.chordColor = scaleOf(s).n; };
ROLL_FN.rootPc = s => { s.rootPc = Math.floor(random() * 12); };
ROLL_FN.scaleId = s => { s.scaleId = pickScaleId(s); s.chordColor = scaleOf(s).n; };
ROLL_FN.concept = s => { for (const k in s.concept) s.concept[k] = pick(CONCEPT[k]); };
ROLL_FN.melodyConcept = s => { if (!s.melodyConcept) s.melodyConcept = {}; for (const k in MELODY_CONCEPT) s.melodyConcept[k] = pick(MELODY_CONCEPT[k]); };
ROLL_FN["counter-melody"] = s => { s.counterMelody = { voice: pick(LEADS), direction: pick(DIRECTIONS), perf: pick(PERFS), contour: pick(CONTOURS), rhythm: pick(RHYTHMS) }; };
ROLL_FN["counter-relation"] = s => { s.counterMelodyRelation = pick(["supports", "follows", "counters"]); };
ROLL_FN["voice-concept"] = s => { s.voiceConcept = { voice: pick(BASS_VOICES), movement: pick(BASS_MOVES) }; };
ROLL_FN["voice-relation"] = s => { s.voiceRelation = pick(["supports", "follows", "counters"]); };
ROLL_FN.arrangement = s => { s.arrangement = pickArrangementFor(s); };
export const CONCEPT_KEYS = ["world", "location", "visual", "narrative", "sensation", "event", "conflict", "crowd", "title", "transform"];
CONCEPT_KEYS.forEach(k => { ROLL_FN["concept-" + k] = s => { s.concept[k] = pick(CONCEPT[k]); }; });
["story", "role", "motion", "hook"].forEach(k => { ROLL_FN["melodyConcept-" + k] = s => { if (!s.melodyConcept) s.melodyConcept = {}; s.melodyConcept[k] = pick(MELODY_CONCEPT[k]); }; });

/* ---------------------------- GROUPS ---------------------------- */
export const GROUPS = {
  "primary": ["primary"], "secondary": ["secondary"], "bpm": ["bpm"], "key": ["key"],
  "feeling": ["feeling"],
  "feel-melody": ["feeling", "melodyConcept", "direction", "leadVoice", "leadPerf", "harmony", "chordColor", "arpeggio", "contour", "rhythm"],
  "melody": ["direction", "leadVoice", "leadPerf", "harmony", "chordColor", "arpeggio", "contour", "rhythm"],
  "concept-melody": ["melodyConcept"],
  "bass": ["bassVoice", "bassMovement", "bassRel"],
  "drums": ["kick", "hats", "snare", "perc", "toms", "groove", "swing", "sync", "intensity"],
  "technoLab": ["technoDrive", "technoAcid", "technoTexture", "technoRave", "technoIndustrial"],
  "concept": ["concept"], "arrangement": ["arrangement"],
  "rhythm": ["rhythm", "rhythmPattern"],
  "harmony": ["harmony", "chordColor", "chordProg"],
  "soundDesign": ["filterType", "envelopeType", "lfoType", "distortionType", "reverbType", "delayType", "sidechainType", "stereoType", "fxChain", "soundIntensity"],
  "mixMaster": ["mixDensity", "mixEnergy", "mixSpace", "mixGlue", "mixPunch", "masterDrive", "masterLoudness", "masterColor", "masterChain", "filterCutoff", "filterResonance", "eqType", "compressionType", "saturationType", "sidechainCurve"],
  "spatialMod": ["stereoImage", "stereoWidth", "spatialDepth", "spatialMovement", "modSource", "modDest", "modRate", "modDepth", "textureLayer", "grainType", "shimmerType", "atmosphereType", "reverbSize", "reverbDecay", "stereoEnhance"],
  "grooveMelodic": ["ghostNotes", "humanizeType", "pocketType", "ornamentType", "vibratoType", "portamentoType", "scaleRun", "intervalLeap", "voicingType", "inversionType", "tensionType", "resolutionType", "delayTime", "delayFeedback", "sectionDensity"],
  "textureFx": ["rideType", "crashType", "clapLayer", "percFill", "fxType", "transitionType", "riserType", "impactType", "energyCurve", "buildType", "dropType", "chopType"],
  "mix": ["mixDensity", "mixEnergy", "mixSpace", "mixGlue", "mixPunch"],
  "master": ["masterDrive", "masterLoudness", "masterColor", "masterChain"],
  "spatial": ["stereoImage", "stereoWidth", "spatialDepth", "spatialMovement", "stereoEnhance"],
  "mod": ["modSource", "modDest", "modRate", "modDepth"],
  "texture": ["textureLayer", "grainType", "shimmerType", "atmosphereType"],
  "grooveExtra": ["ghostNotes", "humanizeType", "pocketType"],
  "melodicExtra": ["ornamentType", "vibratoType", "portamentoType", "scaleRun", "intervalLeap"],
  "harmonicExtra": ["voicingType", "inversionType", "tensionType", "resolutionType"],
  "percExtra": ["rideType", "crashType", "clapLayer", "percFill"],
  "fxExtra": ["fxType", "transitionType", "riserType", "impactType"],
  "arrangementExtra": ["sectionDensity", "energyCurve", "buildType", "dropType"],
  "filter": ["filterType"], "envelope": ["envelopeType"], "lfo": ["lfoType"],
  "distortion": ["distortionType"], "reverb": ["reverbType"], "delay": ["delayType"],
  "sidechain": ["sidechainType"], "stereo": ["stereoType"], "fx": ["fxChain"],
  "chord": ["chordProg"], "rhythmPattern": ["rhythmPattern"],
  "power": Object.keys(ROLL_FN)
};

/* ---------------------------- STATE ---------------------------- */
export function defaultLocks() {
  const l = {};
  Object.keys(ROLL_FN).forEach(k => l[k] = false);
  l.instrumental = false;
  return l;
}
export function defaultHidden() {
  return {
    bpm: false, key: false, styleCard: false, feelCard: false, bassCard: false, drumsCard: false, technoLabCard: false,
    rhythmLabCard: false, harmonyLabCard: false, soundDesignCard: false, mixMasterCard: false, spatialModCard: false,
    grooveMelodicCard: false, textureFxCard: false, conceptCard: false, arrangementCard: false, layersCard: false
  };
}
export function defaultState() {
  return {
    seed: newSeed(),
    primaryStyle: "", secondaryStyle: "", primaryGenre: "", secondaryGenre: "", bpm: 140, rootPc: 9, scaleId: "aeolian",
    techOnly: true, equalChance: false,
    microMelody: "off", microBass: "off",
    feeling: "", flavor: "", direction: "",
    leadVoice: "", leadPerf: "", contour: "", rhythm: "",
    harmony: "", chordColor: "", arpeggio: "",
    bassVoice: "", bassMovement: "", bassRel: "",
    counterMelody: { voice: "", direction: "", perf: "", contour: "", rhythm: "" }, counterMelodyRelation: "supports",
    voiceConcept: { voice: "", movement: "" }, voiceRelation: "supports",
    kick: "", hats: "", snare: "", perc: "", toms: "", groove: "", swing: "", sync: "", intensity: "",
    technoDrive: "", technoAcid: "", technoTexture: "", technoRave: "", technoIndustrial: "",
    filterType: "", envelopeType: "", lfoType: "", distortionType: "", reverbType: "", delayType: "", sidechainType: "", stereoType: "", fxChain: "", chordProg: "", rhythmPattern: "", soundIntensity: "",
    mixDensity: "", mixEnergy: "", mixSpace: "", mixGlue: "", mixPunch: "", masterDrive: "", masterLoudness: "", masterColor: "", masterChain: "",
    filterCutoff: "", filterResonance: "", eqType: "", compressionType: "", saturationType: "", sidechainCurve: "",
    stereoImage: "", stereoWidth: "", spatialDepth: "", spatialMovement: "",
    modSource: "", modDest: "", modRate: "", modDepth: "",
    textureLayer: "", grainType: "", shimmerType: "", atmosphereType: "",
    reverbSize: "", reverbDecay: "", stereoEnhance: "",
    ghostNotes: "", humanizeType: "", pocketType: "",
    ornamentType: "", vibratoType: "", portamentoType: "", scaleRun: "", intervalLeap: "",
    voicingType: "", inversionType: "", tensionType: "", resolutionType: "",
    delayTime: "", delayFeedback: "", sectionDensity: "",
    rideType: "", crashType: "", clapLayer: "", percFill: "",
    fxType: "", transitionType: "", riserType: "", impactType: "",
    energyCurve: "", buildType: "", dropType: "", chopType: "",
    concept: { world: "", location: "", visual: "", narrative: "", sensation: "", event: "", conflict: "", crowd: "", title: "", transform: "" },
    melodyConcept: { story: "", role: "", motion: "", hook: "" },
    arrangement: "",
    instrumental: true, vocalMode: false,
    layers: {}, locks: defaultLocks(), hidden: defaultHidden(),
    weirdness: 50, influence: "balanced", duration: "standard", melodicForce: "balanced", slim: false, structure: false,
    acidAmt: 60, driveAmt: 75,
    styleFit: true, lastFitGenre: ""
  };
}


#!/usr/bin/env python3
import pathlib, re
p=pathlib.Path("Tetech-main/index.html")
c=p.read_text(encoding="utf-8")

# Helper to make a function preserve locks/hidden/layers
def preserve_locks_patch(func_name):
    # We'll inject code before state = best; that restores locks/hidden/layers from bestStart
    # Find pattern: state = best; in that function
    # We need to ensure bestStart exists in that function
    pass

# We'll do manual replacements for each function

# 1. doMaxScoreRoll
c = c.replace(
    "  state = best;\n  rng = mulberry32(state.seed);\n  afterChange();\n  flash($(\"scoreCard\"));\n  btns.forEach(b=>{ if(b){ b.disabled=false; if(b.id===\"maxScoreHeaderBtn\") b.textContent=\"🏆 Max Score\"; else if(b.id===\"maxAllBtn\") b.textContent=\"🏆 Max ALL (keep styles)\"; else if(b.id===\"maxTurboBtn\") b.textContent=\"🚀 Turbo Max 100\"; else if(b.id===\"maxStackBtn\") b.textContent=\"🧱 Stack Max\"; else if(b.id===\"maxAutoBtn\") b.textContent=\"🤖 Auto Max 95+\"; else b.textContent=\"🏆 Max Score (keep styles)\"; }});\n  setMaxStatus(\"Best \"+bestScore+\"/100 after \"+attempts+\" tries — \"+(state.primaryStyle||\"\")+\" + \"+(state.secondaryStyle||\"\"));\n  toast(\"🏆 Best score \"+bestScore+\" /100 — \"+state.primaryStyle+\" + \"+(state.secondaryStyle||\"no secondary\")+\" after \"+attempts+\" tries\");\n  maxRollRunning = false;\n  return bestScore;",
    "  // preserve user locks/hidden/layers\n  try{ best.locks = JSON.parse(JSON.stringify(bestStart.locks)); }catch(e){ best.locks = bestStart.locks; }\n  try{ best.hidden = JSON.parse(JSON.stringify(bestStart.hidden)); }catch(e){ best.hidden = bestStart.hidden; }\n  try{ best.layers = JSON.parse(JSON.stringify(bestStart.layers)); }catch(e){ best.layers = bestStart.layers; }\n  state = best;\n  rng = mulberry32(state.seed);\n  afterChange();\n  flash($(\"scoreCard\"));\n  btns.forEach(b=>{ if(b){ b.disabled=false; if(b.id===\"maxScoreHeaderBtn\") b.textContent=\"🏆 Max Score\"; else if(b.id===\"maxAllBtn\") b.textContent=\"🏆 Max ALL (keep styles)\"; else if(b.id===\"maxTurboBtn\") b.textContent=\"🚀 Turbo Max 100\"; else if(b.id===\"maxStackBtn\") b.textContent=\"🧱 Stack Max\"; else if(b.id===\"maxAutoBtn\") b.textContent=\"🤖 Auto Max 95+\"; else b.textContent=\"🏆 Max Score (keep styles)\"; }});\n  setMaxStatus(\"Best \"+bestScore+\"/100 after \"+attempts+\" tries — \"+(state.primaryStyle||\"\")+\" + \"+(state.secondaryStyle||\"\"));\n  toast(\"🏆 Best score \"+bestScore+\" /100 — \"+state.primaryStyle+\" + \"+(state.secondaryStyle||\"no secondary\")+\" after \"+attempts+\" tries\");\n  maxRollRunning = false;\n  return bestScore;"
)

# 2. doMaxScoreRollSection
c = c.replace(
    "  state = best;\n  rng = mulberry32(state.seed);\n  afterChange();\n  const l = label.toLowerCase();\n  if(l.includes(\"melody\")) flash($(\"feelCard\"));\n  else if(l.includes(\"bass\")) flash($(\"bassCard\"));\n  else if(l.includes(\"tempo\")||l.includes(\"bpm\")||l.includes(\"key\")) flash($(\"styleCard\"));\n  else if(l.includes(\"techno\")||l.includes(\"lab\")) flash($(\"technoLabCard\"));\n  else if(l.includes(\"concept\")) flash($(\"conceptCard\"));\n  else if(l.includes(\"arrange\")) flash($(\"arrangementCard\"));\n  else if(l.includes(\"drum\")) flash($(\"drumsCard\"));\n  else flash($(\"scoreCard\"));\n  btns.forEach((b,i)=>{ b.disabled=false; b.textContent=origTexts[i]||(\"🏆 Max \"+label); });\n  setMaxStatus(\"Best \"+label+\" → \"+bestScore+\"/100 after \"+attempts+\" tries\");\n  toast(\"🏆 Best \"+label+\" → \"+bestScore+\" /100 after \"+attempts+\" tries\");\n  maxRollRunning = false;\n  return bestScore;",
    "  try{ best.locks = JSON.parse(JSON.stringify(bestStart.locks)); }catch(e){ best.locks = bestStart.locks; }\n  try{ best.hidden = JSON.parse(JSON.stringify(bestStart.hidden)); }catch(e){ best.hidden = bestStart.hidden; }\n  try{ best.layers = JSON.parse(JSON.stringify(bestStart.layers)); }catch(e){ best.layers = bestStart.layers; }\n  state = best;\n  rng = mulberry32(state.seed);\n  afterChange();\n  const l = label.toLowerCase();\n  if(l.includes(\"melody\")) flash($(\"feelCard\"));\n  else if(l.includes(\"bass\")) flash($(\"bassCard\"));\n  else if(l.includes(\"tempo\")||l.includes(\"bpm\")||l.includes(\"key\")) flash($(\"styleCard\"));\n  else if(l.includes(\"techno\")||l.includes(\"lab\")) flash($(\"technoLabCard\"));\n  else if(l.includes(\"concept\")) flash($(\"conceptCard\"));\n  else if(l.includes(\"arrange\")) flash($(\"arrangementCard\"));\n  else if(l.includes(\"drum\")) flash($(\"drumsCard\"));\n  else if(l.includes(\"rhythm\")) flash($(\"rhythmLabCard\"));\n  else if(l.includes(\"harmony\")||l.includes(\"chord\")) flash($(\"harmonyLabCard\"));\n  else if(l.includes(\"sound\")) flash($(\"soundDesignCard\"));\n  else flash($(\"scoreCard\"));\n  btns.forEach((b,i)=>{ b.disabled=false; b.textContent=origTexts[i]||(\"🏆 Max \"+label); });\n  setMaxStatus(\"Best \"+label+\" → \"+bestScore+\"/100 after \"+attempts+\" tries\");\n  toast(\"🏆 Best \"+label+\" → \"+bestScore+\" /100 after \"+attempts+\" tries\");\n  maxRollRunning = false;\n  return bestScore;"
)

# 3. doMaxEnergy - preserve locks
# Find its ending
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange(); flash($(\"drumsCard\")); flash($(\"technoLabCard\"));\n  setMaxStatus(\"Max Energy → \"+bestScore+\" energy cues / \"+bestTotal+\"/100\");\n  toast(\"🔥 Max Energy → \"+bestScore+\" energy cues / score \"+bestTotal);\n  maxRollRunning=false;\n  return bestTotal;",
    "  try{ best.locks = JSON.parse(JSON.stringify(snapshot())); }catch(e){}\n  // actually restore from original bestStart? we have bestStart not defined here, use snapshot of current state's locks before? We'll use bestStart variable we need to create\n  // For energy, best was snapshot at start, so its locks are original. We already have best from snapshot, but v had modified locks. So best.locks should be original best's locks if best was original, but if best was replaced by v, its locks are modified. So we need to save original locks.\n  // We'll restore from a saved originalLocks variable.\n  if(typeof originalLocksEnergy!==\"undefined\" && best){ best.locks = JSON.parse(JSON.stringify(originalLocksEnergy)); }\n  state=best; rng=mulberry32(state.seed); afterChange(); flash($(\"drumsCard\")); flash($(\"technoLabCard\"));\n  setMaxStatus(\"Max Energy → \"+bestScore+\" energy cues / \"+bestTotal+\"/100\");\n  toast(\"🔥 Max Energy → \"+bestScore+\" energy cues / score \"+bestTotal);\n  maxRollRunning=false;\n  return bestTotal;"
)

# We need to inject originalLocksEnergy at start of doMaxEnergy
c = c.replace(
    "async function doMaxEnergy(attempts){\n  attempts = attempts||25;\n  // energy density is driven by groove, intensity, kick, etc.\n  const keys = [\"groove\",\"intensity\",\"kick\",\"hats\",\"snare\",\"perc\",\"toms\",\"swing\",\"sync\",\"technoDrive\",\"technoRave\",\"technoIndustrial\",\"bassMovement\",\"contour\",\"rhythm\"];\n  // we score by energyWords count + total\n  if(maxRollRunning){ toast(\"⏳ Already running\"); return; }\n  maxRollRunning = true;\n  commit();\n  let best = snapshot();",
    "async function doMaxEnergy(attempts){\n  attempts = attempts||25;\n  const keys = [\"groove\",\"intensity\",\"kick\",\"hats\",\"snare\",\"perc\",\"toms\",\"swing\",\"sync\",\"technoDrive\",\"technoRave\",\"technoIndustrial\",\"bassMovement\",\"contour\",\"rhythm\"];\n  if(maxRollRunning){ toast(\"⏳ Already running\"); return; }\n  maxRollRunning = true;\n  commit();\n  let best = snapshot();\n  const originalLocksEnergy = JSON.parse(JSON.stringify(best.locks||{}));\n  const originalHiddenEnergy = JSON.parse(JSON.stringify(best.hidden||{}));\n  const originalLayersEnergy = JSON.parse(JSON.stringify(best.layers||{}));"
)

# Also need to restore hidden/layers in doMaxEnergy final
c = c.replace(
    "  if(typeof originalLocksEnergy!==\"undefined\" && best){ best.locks = JSON.parse(JSON.stringify(originalLocksEnergy)); }\n  state=best; rng=mulberry32(state.seed); afterChange(); flash($(\"drumsCard\")); flash($(\"technoLabCard\"));",
    "  if(typeof originalLocksEnergy!==\"undefined\" && best){ try{ best.locks = JSON.parse(JSON.stringify(originalLocksEnergy)); best.hidden = JSON.parse(JSON.stringify(originalHiddenEnergy)); best.layers = JSON.parse(JSON.stringify(originalLayersEnergy)); }catch(e){} }\n  state=best; rng=mulberry32(state.seed); afterChange(); flash($(\"drumsCard\")); flash($(\"technoLabCard\"));"
)

# 4. doMaxAuto - preserve locks
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange();\n  setMaxStatus(\"Auto Max → \"+bestScore+\"/100 after \"+tries+\" tries (target \"+target+\")\");\n  toast(\"🤖 Auto Max → \"+bestScore+\" /100 after \"+tries+\" tries\");\n  maxRollRunning=false;\n  return bestScore;\n}\nasync function doMaxAtom(atomKey, attempts){",
    "  try{ best.locks = JSON.parse(JSON.stringify(snapshot().locks)); }catch(e){}\n  // preserve original locks from first snapshot\n  if(typeof originalLocksAuto!==\"undefined\"){ try{ best.locks = JSON.parse(JSON.stringify(originalLocksAuto)); best.hidden = JSON.parse(JSON.stringify(originalHiddenAuto)); best.layers = JSON.parse(JSON.stringify(originalLayersAuto)); }catch(e){} }\n  state=best; rng=mulberry32(state.seed); afterChange();\n  setMaxStatus(\"Auto Max → \"+bestScore+\"/100 after \"+tries+\" tries (target \"+target+\")\");\n  toast(\"🤖 Auto Max → \"+bestScore+\" /100 after \"+tries+\" tries\");\n  maxRollRunning=false;\n  return bestScore;\n}\nasync function doMaxAtom(atomKey, attempts){"
)
c = c.replace(
    "async function doMaxAuto(target){\n  target=target||95;\n  if(maxRollRunning){ toast(\"⏳ Already running\"); return; }\n  maxRollRunning=true;\n  commit();\n  let best=snapshot(); let bestScore=scoreFor(best).total;",
    "async function doMaxAuto(target){\n  target=target||95;\n  if(maxRollRunning){ toast(\"⏳ Already running\"); return; }\n  maxRollRunning=true;\n  commit();\n  let best=snapshot(); let bestScore=scoreFor(best).total;\n  const originalLocksAuto = JSON.parse(JSON.stringify(best.locks||{}));\n  const originalHiddenAuto = JSON.parse(JSON.stringify(best.hidden||{}));\n  const originalLayersAuto = JSON.parse(JSON.stringify(best.layers||{}));"
)

# 5. doMaxAtom preserve
c = c.replace(
    "async function doMaxAtom(atomKey, attempts){\n  attempts=attempts||20;\n  if(!ROLL_FN[atomKey]){ toast(\"No atom \"+atomKey); return; }\n  if(maxRollRunning){ toast(\"⏳ Already running\"); return; }\n  maxRollRunning=true;\n  commit();\n  let best=snapshot(); let bestScore=scoreFor(best).total;",
    "async function doMaxAtom(atomKey, attempts){\n  attempts=attempts||20;\n  if(!ROLL_FN[atomKey]){ toast(\"No atom \"+atomKey); return; }\n  if(maxRollRunning){ toast(\"⏳ Already running\"); return; }\n  maxRollRunning=true;\n  commit();\n  let best=snapshot(); let bestScore=scoreFor(best).total;\n  const originalLocksAtom = JSON.parse(JSON.stringify(best.locks||{}));\n  const originalHiddenAtom = JSON.parse(JSON.stringify(best.hidden||{}));\n  const originalLayersAtom = JSON.parse(JSON.stringify(best.layers||{}));"
)
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange();\n  flash($(ATOM_BY_KEY[atomKey]?.card||\"scoreCard\"));\n  setMaxStatus(\"Best \"+atomKey+\" → \"+bestScore+\"/100\");\n  toast(\"🏆 Max \"+atomKey+\" → \"+bestScore+\" /100\");\n  maxRollRunning=false;\n  return bestScore;\n}\n\n\n\n/* ============================================================",
    "  try{ best.locks = JSON.parse(JSON.stringify(originalLocksAtom)); best.hidden = JSON.parse(JSON.stringify(originalHiddenAtom)); best.layers = JSON.parse(JSON.stringify(originalLayersAtom)); }catch(e){}\n  state=best; rng=mulberry32(state.seed); afterChange();\n  flash($(ATOM_BY_KEY[atomKey]?.card||\"scoreCard\"));\n  setMaxStatus(\"Best \"+atomKey+\" → \"+bestScore+\"/100\");\n  toast(\"🏆 Max \"+atomKey+\" → \"+bestScore+\" /100\");\n  maxRollRunning=false;\n  return bestScore;\n}\n\n\n\n/* ============================================================"
)

# 6. Patch big upgrade functions to preserve locks and ensure finally resets maxRollRunning
# We'll replace each async max function's ending to restore locks and use try-finally pattern via simple replace

# For doEvolve, doSmartMax, doQuantumMax, doInfiniteMax, doRhythmMax, doHarmonyMax, doSoundDesignMax, doBatchMax
# They currently have let best=snapshot(); we need to save original locks

# Patch doEvolve
c = c.replace(
    "function doEvolve(steps){\n  steps=steps||10;\n  return (async()=>{\n    if(maxRollRunning){ toast(\"Already running\"); return; }\n    maxRollRunning=true; commit();\n    let best=snapshot(); let bestScore=scoreFor(best).total;",
    "function doEvolve(steps){\n  steps=steps||10;\n  return (async()=>{\n    if(maxRollRunning){ toast(\"Already running\"); return; }\n    maxRollRunning=true; commit();\n    let best=snapshot(); let bestScore=scoreFor(best).total;\n    const originalLocksEvolve = JSON.parse(JSON.stringify(best.locks||{}));\n    const originalHiddenEvolve = JSON.parse(JSON.stringify(best.hidden||{}));\n    const originalLayersEvolve = JSON.parse(JSON.stringify(best.layers||{}));\n    try{"
)
c = c.replace(
    "    state=best; rng=mulberry32(state.seed); afterChange();\n    setMaxStatus(\"Evolved → \"+bestScore+\"/100 after \"+steps+\" gens\"); toast(\"🧬 Evolved → \"+bestScore+\" /100\"); maxRollRunning=false; return bestScore;\n  })();\n}\nasync function doSmartMax",
    "      try{ best.locks = JSON.parse(JSON.stringify(originalLocksEvolve)); best.hidden = JSON.parse(JSON.stringify(originalHiddenEvolve)); best.layers = JSON.parse(JSON.stringify(originalLayersEvolve)); }catch(e){}\n      state=best; rng=mulberry32(state.seed); afterChange();\n      setMaxStatus(\"Evolved → \"+bestScore+\"/100 after \"+steps+\" gens\"); toast(\"🧬 Evolved → \"+bestScore+\" /100\"); return bestScore;\n    }catch(e){ toast(\"Evolve error: \"+e.message); }finally{ maxRollRunning=false; }\n  })();\n}\nasync function doSmartMax"
)

# Patch doSmartMax
c = c.replace(
    "async function doSmartMax(attempts){\n  attempts=attempts||25;\n  if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit();\n  let best=snapshot(); let bestScore=scoreFor(best).total;",
    "async function doSmartMax(attempts){\n  attempts=attempts||25;\n  if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit();\n  let best=snapshot(); let bestScore=scoreFor(best).total;\n  const originalLocksSmart = JSON.parse(JSON.stringify(best.locks||{}));\n  const originalHiddenSmart = JSON.parse(JSON.stringify(best.hidden||{}));\n  const originalLayersSmart = JSON.parse(JSON.stringify(best.layers||{}));\n  try{"
)
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Smart Max → \"+bestScore+\"/100 (target \"+weakest.label+\")\"); toast(\"🧠 Smart Max → \"+bestScore); maxRollRunning=false; return bestScore;\n}\nasync function doQuantumMax",
    "    try{ best.locks = JSON.parse(JSON.stringify(originalLocksSmart)); best.hidden = JSON.parse(JSON.stringify(originalHiddenSmart)); best.layers = JSON.parse(JSON.stringify(originalLayersSmart)); }catch(e){}\n    state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Smart Max → \"+bestScore+\"/100 (target \"+weakest.label+\")\"); toast(\"🧠 Smart Max → \"+bestScore); return bestScore;\n  }catch(e){ toast(\"Smart Max error: \"+e.message); }finally{ maxRollRunning=false; }\n}\nasync function doQuantumMax"
)

# Patch doQuantumMax
c = c.replace(
    "async function doQuantumMax(attempts){\n  attempts=attempts||200; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total;",
    "async function doQuantumMax(attempts){\n  attempts=attempts||200; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total;\n  const originalLocksQuantum = JSON.parse(JSON.stringify(best.locks||{}));\n  const originalHiddenQuantum = JSON.parse(JSON.stringify(best.hidden||{}));\n  const originalLayersQuantum = JSON.parse(JSON.stringify(best.layers||{}));\n  try{"
)
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Quantum → \"+bestScore+\"/100 after \"+attempts); toast(\"⚛️ Quantum Max → \"+bestScore); maxRollRunning=false; return bestScore;\n}\nlet infiniteStop=false;",
    "    try{ best.locks = JSON.parse(JSON.stringify(originalLocksQuantum)); best.hidden = JSON.parse(JSON.stringify(originalHiddenQuantum)); best.layers = JSON.parse(JSON.stringify(originalLayersQuantum)); }catch(e){}\n    state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Quantum → \"+bestScore+\"/100 after \"+attempts); toast(\"⚛️ Quantum Max → \"+bestScore); return bestScore;\n  }catch(e){ toast(\"Quantum error: \"+e.message); }finally{ maxRollRunning=false; }\n}\nlet infiniteStop=false;"
)

# Patch doInfiniteMax
c = c.replace(
    "async function doInfiniteMax(){\n  if(maxRollRunning){ toast(\"Already running\"); return; }\n  maxRollRunning=true; infiniteStop=false; commit();\n  let best=snapshot(); let bestScore=scoreFor(best).total; let tries=0;",
    "async function doInfiniteMax(){\n  if(maxRollRunning){ toast(\"Already running\"); return; }\n  maxRollRunning=true; infiniteStop=false; commit();\n  let best=snapshot(); let bestScore=scoreFor(best).total; let tries=0;\n  const originalLocksInfinite = JSON.parse(JSON.stringify(best.locks||{}));\n  const originalHiddenInfinite = JSON.parse(JSON.stringify(best.hidden||{}));\n  const originalLayersInfinite = JSON.parse(JSON.stringify(best.layers||{}));\n  try{"
)
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Infinite stopped → \"+bestScore+\"/100 after \"+tries+\" tries\"); toast(\"♾️ Infinite stopped → \"+bestScore+\" /100 after \"+tries); maxRollRunning=false;\n}\nfunction stopInfiniteMax(){ infiniteStop=true; state.infiniteRunning=false; toast(\"⏹ Stopping infinite…\"); }",
    "    try{ best.locks = JSON.parse(JSON.stringify(originalLocksInfinite)); best.hidden = JSON.parse(JSON.stringify(originalHiddenInfinite)); best.layers = JSON.parse(JSON.stringify(originalLayersInfinite)); }catch(e){}\n    state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Infinite stopped → \"+bestScore+\"/100 after \"+tries+\" tries\"); toast(\"♾️ Infinite stopped → \"+bestScore+\" /100 after \"+tries);\n  }catch(e){ toast(\"Infinite error: \"+e.message); }finally{ maxRollRunning=false; }\n}\nfunction stopInfiniteMax(){ infiniteStop=true; state.infiniteRunning=false; maxRollRunning=false; toast(\"⏹ Stopping infinite…\"); }"
)

# Patch doRhythmMax
c = c.replace(
    "async function doRhythmMax(attempts){\n  attempts=attempts||20; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total; setMaxStatus(\"Max Rhythm \"+attempts+\" tries\");",
    "async function doRhythmMax(attempts){\n  attempts=attempts||20; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total; const originalLocksRhythm = JSON.parse(JSON.stringify(best.locks||{})); const originalHiddenRhythm = JSON.parse(JSON.stringify(best.hidden||{})); const originalLayersRhythm = JSON.parse(JSON.stringify(best.layers||{})); setMaxStatus(\"Max Rhythm \"+attempts+\" tries\");\n  try{"
)
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Max Rhythm → \"+bestScore); toast(\"🏆 Max Rhythm → \"+bestScore); maxRollRunning=false; return bestScore;\n}\nfunction exportRhythmMidi()",
    "    try{ best.locks = JSON.parse(JSON.stringify(originalLocksRhythm)); best.hidden = JSON.parse(JSON.stringify(originalHiddenRhythm)); best.layers = JSON.parse(JSON.stringify(originalLayersRhythm)); }catch(e){}\n    state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Max Rhythm → \"+bestScore); toast(\"🏆 Max Rhythm → \"+bestScore); return bestScore;\n  }catch(e){ toast(\"Rhythm Max error: \"+e.message); }finally{ maxRollRunning=false; }\n}\nfunction exportRhythmMidi()"
)

# Patch doHarmonyMax
c = c.replace(
    "async function doHarmonyMax(attempts){\n  attempts=attempts||20; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total; setMaxStatus(\"Max Harmony \"+attempts+\" tries\");",
    "async function doHarmonyMax(attempts){\n  attempts=attempts||20; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total; const originalLocksHarmony = JSON.parse(JSON.stringify(best.locks||{})); const originalHiddenHarmony = JSON.parse(JSON.stringify(best.hidden||{})); const originalLayersHarmony = JSON.parse(JSON.stringify(best.layers||{})); setMaxStatus(\"Max Harmony \"+attempts+\" tries\");\n  try{"
)
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Max Harmony → \"+bestScore); toast(\"🏆 Max Harmony → \"+bestScore); maxRollRunning=false; return bestScore;\n}\nfunction renderSoundMatrix()",
    "    try{ best.locks = JSON.parse(JSON.stringify(originalLocksHarmony)); best.hidden = JSON.parse(JSON.stringify(originalHiddenHarmony)); best.layers = JSON.parse(JSON.stringify(originalLayersHarmony)); }catch(e){}\n    state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Max Harmony → \"+bestScore); toast(\"🏆 Max Harmony → \"+bestScore); return bestScore;\n  }catch(e){ toast(\"Harmony Max error: \"+e.message); }finally{ maxRollRunning=false; }\n}\nfunction renderSoundMatrix()"
)

# Patch doSoundDesignMax
c = c.replace(
    "async function doSoundDesignMax(attempts){\n  attempts=attempts||20; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total; setMaxStatus(\"Max Sound Design \"+attempts+\" tries\");",
    "async function doSoundDesignMax(attempts){\n  attempts=attempts||20; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total; const originalLocksSD = JSON.parse(JSON.stringify(best.locks||{})); const originalHiddenSD = JSON.parse(JSON.stringify(best.hidden||{})); const originalLayersSD = JSON.parse(JSON.stringify(best.layers||{})); setMaxStatus(\"Max Sound Design \"+attempts+\" tries\");\n  try{"
)
c = c.replace(
    "  state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Max Sound Design → \"+bestScore); toast(\"🏆 Max Sound Design → \"+bestScore); maxRollRunning=false; return bestScore;\n}\nfunction renderDnaRadar()",
    "    try{ best.locks = JSON.parse(JSON.stringify(originalLocksSD)); best.hidden = JSON.parse(JSON.stringify(originalHiddenSD)); best.layers = JSON.parse(JSON.stringify(originalLayersSD)); }catch(e){}\n    state=best; rng=mulberry32(state.seed); afterChange(); setMaxStatus(\"Max Sound Design → \"+bestScore); toast(\"🏆 Max Sound Design → \"+bestScore); return bestScore;\n  }catch(e){ toast(\"Sound Design Max error: \"+e.message); }finally{ maxRollRunning=false; }\n}\nfunction renderDnaRadar()"
)

# Patch doBatchMax
c = c.replace(
    "async function doBatchMax(){\n  const n=parseInt(($(\"batchSizeInput\")&&$(\"batchSizeInput\").value)||10)||10; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total; const batch=[]; setMaxStatus(\"Batch Max \"+n+\"×20 tries\");",
    "async function doBatchMax(){\n  const n=parseInt(($(\"batchSizeInput\")&&$(\"batchSizeInput\").value)||10)||10; if(maxRollRunning){ toast(\"Running\"); return; }\n  maxRollRunning=true; commit(); let best=snapshot(); let bestScore=scoreFor(best).total; const batch=[]; const originalLocksBatch = JSON.parse(JSON.stringify(best.locks||{})); const originalHiddenBatch = JSON.parse(JSON.stringify(best.hidden||{})); const originalLayersBatch = JSON.parse(JSON.stringify(best.layers||{})); setMaxStatus(\"Batch Max \"+n+\"×20 tries\");\n  try{"
)
c = c.replace(
    "  state=best; state.batchPool=batch; rng=mulberry32(state.seed); afterChange(); renderBatchList(); setMaxStatus(\"Batch Max finished best \"+bestScore+\" avg \"+Math.round(batch.reduce((a,x)=>a+x.score,0)/batch.length)); toast(\"🏆 Batch Max finished best \"+bestScore); maxRollRunning=false; return bestScore;\n}\nfunction exportBatchCsv()",
    "    try{ best.locks = JSON.parse(JSON.stringify(originalLocksBatch)); best.hidden = JSON.parse(JSON.stringify(originalHiddenBatch)); best.layers = JSON.parse(JSON.stringify(originalLayersBatch)); }catch(e){}\n    state=best; state.batchPool=batch; rng=mulberry32(state.seed); afterChange(); renderBatchList(); setMaxStatus(\"Batch Max finished best \"+bestScore+\" avg \"+Math.round(batch.reduce((a,x)=>a+x.score,0)/batch.length)); toast(\"🏆 Batch Max finished best \"+bestScore); return bestScore;\n  }catch(e){ toast(\"Batch Max error: \"+e.message); }finally{ maxRollRunning=false; }\n}\nfunction exportBatchCsv()"
)

# Add emergency reset function and button
# Add function resetMaxState
if "function resetMaxState" not in c:
    c = c.replace(
        "function stopInfiniteMax(){ infiniteStop=true; state.infiniteRunning=false; maxRollRunning=false; toast(\"⏹ Stopping infinite…\"); }",
        "function stopInfiniteMax(){ infiniteStop=true; state.infiniteRunning=false; maxRollRunning=false; toast(\"⏹ Stopping infinite…\"); }\nfunction resetMaxState(){ maxRollRunning=false; infiniteStop=true; const btns=document.querySelectorAll('#maxRollLabCard button, #geneticLabCard button, #rhythmLabCard button, #harmonyLabCard button, #soundDesignCard button, #batchLabCard button'); btns.forEach(b=>b.disabled=false); setMaxStatus(\"Reset — all max locks cleared\"); toast(\"🔓 Max state reset — you can roll again\"); }"
    )

# Also add reset button to maxRollLabCard status row
c = c.replace(
    '<div class="row"><span class="readout" id="maxRollStatus">Idle — click any max button. Scores 0-100.</span></div>',
    '<div class="row"><span class="readout" id="maxRollStatus">Idle — click any max button. Scores 0-100.</span><button class="sm ghost" id="resetMaxBtn" title="Force reset if stuck">🔓 Reset Max</button></div>'
)

# Add listener for resetMaxBtn
if 'resetMaxBtn' not in c or 'if($("resetMaxBtn"))' not in c:
    c = c.replace(
        'if($("stopInfiniteBtn2")) $("stopInfiniteBtn2").addEventListener("click", stopInfiniteMax);',
        'if($("stopInfiniteBtn2")) $("stopInfiniteBtn2").addEventListener("click", stopInfiniteMax);\nif($("resetMaxBtn")) $("resetMaxBtn").addEventListener("click", resetMaxState);'
    )

# Ensure doMaxStack also has try-finally and preserves locks
c = c.replace(
    "async function doMaxStack(){\n  if(maxRollRunning){ toast(\"⏳ Already running\"); return; }\n  toast(\"🧱 Stack Max: sequential optimization…\");",
    "async function doMaxStack(){\n  if(maxRollRunning){ toast(\"⏳ Already running\"); return; }\n  maxRollRunning=true;\n  toast(\"🧱 Stack Max: sequential optimization…\");\n  try{"
)
c = c.replace(
    "  const finalScore = scoreFor(state).total;\n  setMaxStatus(\"Stack finished → \"+finalScore+\"/100\");\n  toast(\"🧱 Stack Max finished → \"+finalScore+\" /100\");\n  return finalScore;\n}\nasync function doMaxEnergy",
    "    const finalScore = scoreFor(state).total;\n    setMaxStatus(\"Stack finished → \"+finalScore+\"/100\");\n    toast(\"🧱 Stack Max finished → \"+finalScore+\" /100\");\n    return finalScore;\n  }catch(e){ toast(\"Stack error: \"+e.message); }finally{ maxRollRunning=false; }\n}\nasync function doMaxEnergy"
)

p.write_text(c, encoding="utf-8")
print("fixed max freeze & locks")

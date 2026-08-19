# NEON FORGE — Techno Prompt Lab for Suno

A single-file, offline-first laboratory for generating **maximum-energy, instrumental-safe
techno prompts** for [Suno](https://suno.com). No build system, no backend, no dependencies —
one `index.html` you can double-click.

```bash
# either open index.html directly, or:
python3 -m http.server 8080
```

---

## What's in it

### Generation
- **🎲 Genre Combo roller** — the default way to style. Rolls a random genre **and** a random
  sub-style and drops them straight into both the Primary and Secondary slots (e.g.
  `Bebop Jazz` + `Lo-Fi Chill`, `Steam Engine Steampunk` + `Vespa Ride Lounge`, `Fado` + `Neon House`).
  An **immense pool of 250+ genres and 2800+ sub-style combos** — Jazz, Blues, Pop (incl.
  Bubblegum, J-Pop, K-Pop), Bossa Nova, Soul, Funk, Disco, House, Trance, Hip-Hop, Latin,
  World, Classical, Metal, Punk, Folk, Swing, Bluegrass, Ska, Dub, Dubstep, Drum & Bass,
  Synthwave, Vaporwave, Lo-Fi, City Pop, Bollywood, Afrobeats, Caribbean, Nordic, Slavic,
  Andean, Afro-Cuban, Ambient, Cinematic, Experimental — plus hundreds of obscure world
  micro-genres (Gagaku, Hindustani, Morna, Tuareg, Kulintang, Pansori…), scene/atmosphere
  themes (Harbor, Observatory, Spaceport, Factory, Music Box, Circus, Steampunk, Solarpunk…)
  and mood/season sets. One click on **🎲 New Style** re-rolls a brand-new combo.
- **Genre-aware BPM** — the roller now matches the tempo to the rolled genres (Bossa ~90,
  Dub ~80, DnB ~170, Metal ~160, Techno ~140…), so a combo *sounds* right before you even
  audition it. The two slots also come from **different genres** so you never get "Bebop Jazz"
  + "Cool Jazz". The genre hint shows the resolved genres + "tempo matched to genre".
- **Techno-Only mode** — a toggle in the Style & Tempo card. The 460+ curated techno styles are
  kept in their **own special list** and never appear in the genre combo. Flip **Techno only** to
  switch the roller *and* the 📜 picker to the techno pool exclusively. You can still manually
  change one style to techno anytime by toggling the mode and picking from the techno list.
- **461 curated techno styles** tagged `core` / `sub` / `rare`, searchable in a 📜 picker modal,
  with style fusion 🔀 and clear ✕ (visible in Techno-Only mode).
- **Weirdness slider that actually bites** — it picks a *category* first, so pool sizes can't
  swamp it. Sweeps from 71% core / 2% rare at 0 to 3% core / 75% rare at 100, shows the live
  mix next to the slider, and also biases which scales the key engine chooses. (Applies to the
  techno pool in Techno-Only mode; it always continues to bias the key/scale engine.)
- **Emotion-led melody** with a melodic-force level (Light / Balanced / Strong / Dominant).
  Melody is always present — force only changes how much of the prompt it commands, so it can
  never be crowded out by bass, drums or concept.
- **Key & scale engine** — 27 scales with real semitone intervals, root note selection, and a
  **Camelot wheel** position for matching the track into a DJ set. Harmonic colour is bound to
  the key, so a prompt can never contradict itself.
- **10-dimension concept roller** (world, location, visual, narrative, sensation, event,
  conflict, crowd, title, transformation) — 92 worlds, 93 titles and heavily expanded
  fragments throughout.
- **Melody concept roller** — the melody gets its own 4-part narrative brief
  (story / role in the track / motion / hook shape) so the hook is never an afterthought
  of the visuals. Rolls on its own button or with feeling→melody.
- **35 arrangements**, weighted 68% toward fast, groovy, relentless shapes.
- **Microtonality** — arm it per section on melody and/or bass, with 7 flavours
  (quarter-tone, sixth-tone, eighth-tone, just intonation, maqam 3/4, analog drift,
  wide detune). These are real cent offsets: the audition engine bends the oscillators
  by exactly the amount the prompt describes.
- **Huge expanded pools for bass, melody, feeling and drums** — 150+ feelings, 90+ flavors,
  150+ lead voices, 120+ bass voices, 35+ bass moves, 30+ grooves, 30+ kicks, 30+ intensities
  and more, all new entries validated against the safety sanitizer so nothing gets censored
  out of a prompt.
- **Lead & Bass 📜 pickers** — the Lead (melody) and Bass Voice rows each have a 📜 button that
  opens a searchable list so you can pick a voice manually instead of rolling.
- **Counter-melody 🎼+** — roll a second lead line with its own voice/direction/performance/
  contour/rhythm, and choose whether it **supports**, **follows** or **counters** the main
  melody. Added to the Style Prompt and Full Brief.
- **Voice concept 🎤+** — the same idea for the low end: a second bass/voice line with its own
  voice + movement and a supports/follows/counters role relative to the main bass.
- **Equal-chance style odds ⚖** — a toggle that makes every genre and every sub-style have
  exactly the same odds of appearing. Off = genre-first (genres with more sub-styles show
  more often).
- **BPM/Key hide now restorable** — the show/hide buttons for BPM and Key moved into the
  Style & Tempo card header, so hiding them no longer makes them impossible to bring back.
- **24 optional detail layers** (acid, glitch, saturation, sidechain, polyrhythm, …), all OFF
  by default.

### Hearing it
- **Live audition engine** — a Web Audio sketch of the current recipe. It plays the actual
  rolled parameters: your key and scale, BPM, swing feel, motif contour, and a timbre sniffed
  from the rolled kick / bass / lead text. Deterministic per seed, so a shared link sounds the
  same for everyone. Built lazily; no AudioContext until you press play.
- **High-fidelity beat** — the drum pattern actually changes with what you roll: the *groove*
  decides the kick (four-on-the-floor, half-time, double-time, breakbeat, tribal, reggae
  one-drop…), the *snare/hats/intensity/sync* text change the backbeat, fills, ghost notes and
  shaker layers, and a light **genre-feel** mapping gives jazz/soul, latin, reggae, hip-hop,
  ballad and metal rolls their own swing and rhythmic character — so a Bossa Nova, a Dub
  Reggae and a Hardcore roll each sound genuinely different, all without mapping every style.

### Shaping it
- **Energy arc** — a bar-accurate, section-by-section timeline (Intro → Build → Drop →
  Breakdown → … ) with per-section energy levels, total runtime and copyable `[Section]` tags.
- **Prompt score** — six weighted metrics (length, melodic clarity, instrumentation coverage,
  style focus, energy density, harmonic definition) with actionable notes on each.
- **A/B slots** — stash an idea in slot B, keep working, then flip between them.
- **Engineer & DJ pack** — key-derived kick tuning in Hz, sidechain timings, stereo and master
  notes, cue advice and a compatible BPM/Camelot mixing range.

### Workflow
- **Command palette** (<kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd>) with fuzzy search over every action.
- Per-field **lock 🔒** and **roll 🎲** on every element, ⚡ power roll, ↶ undo / ↷ redo.
- **Hide 👁** on every card plus BPM and Key individually — hiding a section removes its
  content from the generated prompt.
- 3 variations, refreshed on power roll, with "Apply this one".
- Presets (localStorage), shareable deterministic URLs, history (records only on copy/apply),
  and full **session export / import** as JSON.

### Safety rails
- **Instrumental-only is ON by default.** A word-boundary vocal sanitizer strips any vocal,
  chant, choir, lyric or whisper content — and it is *label-aware*, so removing an offending
  clause never leaves a section headless.
- **Maximum-energy filter** — `minimal`, `minimalist`, `sparse`, `restrained`, `low-energy`,
  `weak`, `tiny`, `gentle` and `quiet` can never reach the output.
- Budget system drops whole clauses by priority, never mid-phrase:
  Style Prompt ≤ 1000 chars, Full Brief ≤ 3000 chars.

---

## Outputs

| Tab | Contents |
|---|---|
| **Style Prompt** | ≤1000 chars, ready to paste into Suno's style box |
| **Full Brief** | ≤3000 chars, full production brief with energy arc |
| **Suno Kit** | style + brief + section tags + energy arc + vocal policy + engineer & DJ notes |
| **Engineer** | mix/master and DJ metadata on its own |

---

## Keyboard

| Key | Action |
|---|---|
| <kbd>⌘K</kbd> | Command palette |
| <kbd>P</kbd> | Power roll everything |
| <kbd>Space</kbd> | Play / stop audition |
| <kbd>V</kbd> | Generate 3 variations |
| <kbd>F</kbd> / <kbd>M</kbd> / <kbd>B</kbd> / <kbd>D</kbd> | Roll feeling→melody / melody / bass / drums |
| <kbd>C</kbd> / <kbd>A</kbd> / <kbd>K</kbd> | Roll concept / arrangement / key |
| <kbd>L</kbd> | Style library |
| <kbd>I</kbd> | Toggle instrumental safety |
| <kbd>S</kbd> | Copy share link |
| <kbd>1</kbd>–<kbd>4</kbd> | Switch output tab |
| <kbd>⌘Z</kbd> / <kbd>⌘⇧Z</kbd> | Undo / redo |
| <kbd>?</kbd> | All shortcuts |

---

## Tests

A headless acceptance suite (jsdom) covers all 20 product acceptance criteria plus the new
subsystems — key engine, energy arc, scoring, A/B, command palette, and sanitizer regressions.

```bash
npm i -D jsdom
node qa/test.js     # 59 checks (genre combos, techno mode, expanded pools, audition fidelity, genre-aware BPM, counter-melody, equal-chance)
node qa/pools.js    # runs every pool phrase (incl. all 2800+ genre combos) through the live sanitizer
```

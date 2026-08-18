/* Scans every generation pool through the LIVE sanitizer used by the app.
   Any phrase the app would censor is a pool bug: it silently deletes content
   from prompts. Run: node qa/pools.js */
const fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const file=path.join(__dirname,'..','index.html');
const w=new JSDOM(fs.readFileSync(file,'utf8'),{runScripts:'dangerously',url:'https://x.test/'}).window;
const bad=[];
const chk=(lbl,arr)=>arr.forEach(v=>{ if(typeof v==='string' && v && w.NF.isDirty(v.toLowerCase())) bad.push(lbl+' :: '+v); });
for(const k in w.NF.CONCEPT) chk('CONCEPT.'+k, w.NF.CONCEPT[k]);
for(const k in w.NF.MELODY_CONCEPT) chk('MELODY_CONCEPT.'+k, w.NF.MELODY_CONCEPT[k]);
chk('STYLES', w.NF.STYLES.map(s=>s.n));
{ const g=[...w.NF.GENRES.map(g=>g.n), ...w.NF.GENRES.flatMap(g=>g.subs)]; chk('GENRES', g); }
chk('LAYERS', w.NF.LAYERS.map(l=>l.phrase));
chk('SCALES', w.NF.SCALES.map(s=>s.mood));
chk('MICRO_MODES', w.NF.MICRO_MODES.map(m=>m.desc));
const src=fs.readFileSync(file,'utf8');
const NAMES='ARRANGEMENTS|FEELINGS|FLAVORS|DIRECTIONS|LEADS|PERFS|HARMONIES|ARPS|CONTOURS|RHYTHMS|BASS_VOICES|BASS_MOVES|BASS_RELS|KICKS|HATS|SNARES|PERCS|TOMS|GROOVES|SWINGS|SYNCS|INTENSITIES';
for(const m of src.matchAll(new RegExp('const ('+NAMES+') = \\[([\\s\\S]*?)\\n\\];','g')))
  chk(m[1], [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(x=>x[1]));
if(bad.length){ console.log('SELF-CENSORING POOL ENTRIES:'); bad.forEach(b=>console.log('  '+b)); }
else console.log('All pools pass the live sanitizer.');
console.log('total problems:', bad.length);
process.exit(bad.length?1:0);

// Assembles a style's story file into a storyboard page and a self-contained player page.
// usage: node build.cjs <style-id> <story.js> <out-dir> [--title "Page title"]
//   style-id: creator-motion-graphics | chalk-talk | clean-tech
// writes <out-dir>/<slug>-storyboard.html and <out-dir>/<slug>.html (slug = story file name)
const fs = require('fs'), path = require('path');
const D = __dirname, read = (f) => fs.readFileSync(path.join(D, f), 'utf8');
const CORE = read('core.js');

const STYLES = {
  'creator-motion-graphics': {
    name: 'Creator <em>Motion</em> Graphics', plain: 'Creator Motion Graphics', title: 'Event Leads Reel',
    fonts: 'family=Anton&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700;800',
    loads: ['60px "Anton"', 'italic 60px "Instrument Serif"', '600 30px "Inter"', '700 30px "Inter"', '800 30px "Inter"', '500 20px "Inter"'],
  },
  'chalk-talk': {
    name: 'Chalk <em>Talk</em>', plain: 'Chalk Talk', title: 'Scratched QR Lesson',
    fonts: 'family=Anton&family=Cabin+Sketch:wght@400;700&family=Inter:wght@400;600;700;800&family=Kalam:wght@400;700&family=Instrument+Serif:ital@0;1',
    loads: ['700 60px "Cabin Sketch"', '700 40px "Kalam"', '400 40px "Kalam"', '600 14px "Inter"'],
  },
  'clean-tech': {
    name: 'Clean <em>Tech</em>', plain: 'Clean Tech', title: 'Cited Help-Bot',
    fonts: 'family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&family=Anton&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700;800',
    loads: ['800 60px "Inter Tight"', '500 30px "Inter Tight"', '600 30px "Inter Tight"', '700 30px "Inter Tight"', '700 20px "JetBrains Mono"'],
  },
};

const CSS = `
:root {
  color-scheme: dark;
  --bg: #0b0b0d; --panel: #141417; --ink: #f2f0ea; --dim: #8d8c93; --line: #26262c; --accent: #ffd60a;
  --display: "Anton", "Bebas Neue", Impact, "Arial Narrow", sans-serif;
  --body: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --serif: "Instrument Serif", Georgia, "Times New Roman", serif;
}
html, body { height: 100%; }
body {
  background: var(--bg); color: var(--ink); font-family: var(--body);
  padding-left: max(16px, env(safe-area-inset-left, 0px));
  padding-right: max(16px, env(safe-area-inset-right, 0px));
  padding-block: 20px 28px;
}
.wrap { max-width: 1180px; margin: 0 auto; display: grid; gap: 14px; }
.top { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px 18px; }
.name { font-family: var(--display); font-weight: 400; font-size: clamp(26px, 4vw, 40px); letter-spacing: 0.02em; text-transform: uppercase; margin: 0; line-height: 1; }
.name em { font-family: var(--serif); font-style: italic; text-transform: none; color: var(--accent); letter-spacing: 0; font-size: 1.12em; }
.meta { color: var(--dim); font-size: 14px; margin: 0; }
.stage { position: relative; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; background: #000; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
.stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 12px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.bar button, .bar label.btn {
  font: 600 14px var(--body); color: var(--ink); background: transparent; border: 1px solid var(--line);
  border-radius: 7px; padding: 8px 12px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
}
.bar button:hover, .bar label.btn:hover { border-color: var(--dim); }
.bar button:focus-visible, .bar label.btn:focus-within, #scrub:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.bar button[aria-pressed="true"] { background: var(--accent); color: #0b0b0d; border-color: var(--accent); }
#play { min-width: 82px; justify-content: center; background: var(--ink); color: #0b0b0d; border-color: var(--ink); }
#scrub { flex: 1 1 220px; min-width: 0; accent-color: var(--accent); }
#time { font: 600 14px var(--body); font-variant-numeric: tabular-nums; color: var(--dim); min-width: 92px; text-align: right; }
#vofile { position: absolute; width: 1px; height: 1px; opacity: 0; }
.note { color: var(--dim); font-size: 13px; margin: 0; max-width: 70ch; }`;

const SB_CSS = `
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); gap: 18px; }
.panel { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; display: grid; min-width: 0; }
.panel .stage { border: 0; border-radius: 0; border-bottom: 1px solid var(--line); }
.panel dl { margin: 0; padding: 12px 14px 14px; display: grid; grid-template-columns: max-content 1fr; gap: 6px 12px; font-size: 13px; line-height: 1.45; }
.panel dt { color: var(--dim); font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; font-size: 11px; padding-top: 2px; }
.panel dd { margin: 0; min-width: 0; }
.beat { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 14px 0; font-weight: 700; }
.beat span { color: var(--dim); font-weight: 600; font-variant-numeric: tabular-nums; font-size: 13px; }
.words { font-weight: 600; }
.assume { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px 18px; }
.assume h2 { font-size: 15px; margin: 0 0 8px; }
.assume ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; font-size: 14px; color: var(--ink); max-width: 80ch; }`;

const head = (s, title) => `<meta charset="utf-8">
<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${s.fonts}&display=block">`;

const fontWait = (s) => `try { await Promise.all(${JSON.stringify(s.loads)}.map((f) => document.fonts.load(f, 'AaZz09'))); await document.fonts.ready; } catch (e) {}`;

function storyboard(key, s, story) {
  return `${head(s, s.title + ' Storyboard')}
<style>${CSS}${SB_CSS}</style>

<div class="wrap">
  <div class="top">
    <h1 class="name">${s.name}</h1>
    <p class="meta" id="sbmeta">Storyboard</p>
  </div>
  <p class="note" id="sbtopic"></p>
  <div class="grid" id="grid"></div>
  <section class="assume"><h2>Facts and numbers I assumed</h2><ul id="assume"></ul></section>
  <p class="note">Stills are drawn with the animation's own scene code and finishing pass. No motion or sound yet. Reply OK, or tell me what to change.</p>
</div>

<script>
${CORE}
${story}
(async () => {
  ${fontWait(s)}
  document.getElementById('sbmeta').textContent = 'Storyboard · ' + BOARD.length + ' beats · ' + TL.D.toFixed(1) + ' s';
  document.getElementById('sbtopic').textContent = 'Topic: ' + TOPIC;
  const grid = document.getElementById('grid'), esc = (x) => String(x).replace(/[&<>]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
  BOARD.forEach((b, i) => {
    const el = document.createElement('article'); el.className = 'panel';
    el.innerHTML = '<div class="stage"><canvas width="1280" height="720" aria-label="Beat ' + (i + 1) + ' still"></canvas></div>' +
      '<div class="beat">Beat ' + (i + 1) + ' <span>' + b.a.toFixed(2) + ' – ' + b.b.toFixed(2) + ' s</span></div>' +
      '<dl><dt>Words</dt><dd class="words">' + esc(b.words) + '</dd><dt>Camera</dt><dd>' + esc(b.cam) + '</dd><dt>In from</dt><dd>' + esc(b.trans) + '</dd><dt>Sounds</dt><dd>' + esc(b.sfx) + '</dd></dl>';
    grid.appendChild(el);
    explainer(el.querySelector('canvas').getContext('2d'), b.still);
  });
  document.getElementById('assume').innerHTML = ASSUME.map((a) => '<li>' + esc(a) + '</li>').join('');
  window.__ready = true;
})();
</script>
`;
}

function player(key, s, story) {
  return `${head(s, s.title)}
<style>${CSS}</style>

<div class="wrap">
  <div class="top">
    <h1 class="name">${s.name}</h1>
    <p class="meta" id="pmeta">drawn in code, sound synthesized</p>
  </div>
  <div class="stage"><canvas id="stage" width="1280" height="720" aria-label="${s.plain} animation"></canvas></div>
  <div class="bar">
    <button id="play" type="button">Play</button>
    <input id="scrub" type="range" min="0" max="20" step="0.01" value="0" aria-label="Scrub timeline">
    <span id="time">0.00 / 0.00</span>
    <button id="sound" type="button" aria-pressed="true">Sound on</button>
    <button id="loop" type="button" aria-pressed="true">Loop</button>
    <label class="btn" for="vofile">Load voiceover<input id="vofile" type="file" accept="audio/*"></label>
  </div>
  <p class="note" id="vonote">Load a voiceover to play it in sync. The effects switch to a lighter mix under narration.</p>
</div>

<script>
${CORE}
${story}

// =================================== PLAYER ===================================
const cvs = document.getElementById('stage'), ctx = cvs.getContext('2d');
const DURATION = TL.D;
window.seek = (t) => explainer(ctx, clamp(t, 0, DURATION));
window.DURATION = DURATION;
window.scoreSound = scoreSound;
window.SFX = SFX;

const ui = { play: document.getElementById('play'), scrub: document.getElementById('scrub'), time: document.getElementById('time'), sound: document.getElementById('sound'), loop: document.getElementById('loop'), vo: document.getElementById('vofile'), note: document.getElementById('vonote') };
ui.scrub.max = DURATION; document.getElementById('pmeta').textContent = TOPIC + ' · ' + DURATION.toFixed(1) + ' s · drawn in code, sound synthesized';
let T = 0, playing = false, last = 0, soundOn = true, loopOn = true, stopSound = null, voAudio = null;
const fmt = (t) => t.toFixed(2) + ' / ' + DURATION.toFixed(2);
function draw() { window.seek(T); ui.scrub.value = T; ui.time.textContent = fmt(T); }
function startAudio() {
  stopAudio(); if (!playing) return;
  if (soundOn) stopSound = SFX.live(scoreSound, T, { voiceover: !!voAudio });
  if (voAudio) { try { voAudio.currentTime = T; voAudio.play().catch(() => {}); } catch (e) {} }
}
function stopAudio() { if (stopSound) { stopSound(); stopSound = null; } if (voAudio) voAudio.pause(); }
function setPlaying(p) { playing = p; ui.play.textContent = p ? 'Pause' : 'Play'; last = performance.now(); if (p) startAudio(); else stopAudio(); }
function tick(now) {
  if (playing) {
    T += (now - last) / 1000; last = now;
    if (T >= DURATION) { if (loopOn) { T = 0; startAudio(); } else { T = DURATION; setPlaying(false); } }
    draw();
  }
  requestAnimationFrame(tick);
}
ui.play.addEventListener('click', () => { if (!playing && T >= DURATION) T = 0; setPlaying(!playing); });
ui.scrub.addEventListener('input', () => { T = parseFloat(ui.scrub.value); draw(); if (playing) startAudio(); });
ui.sound.addEventListener('click', () => { soundOn = !soundOn; ui.sound.setAttribute('aria-pressed', soundOn); ui.sound.textContent = soundOn ? 'Sound on' : 'Sound off'; if (playing) startAudio(); });
ui.loop.addEventListener('click', () => { loopOn = !loopOn; ui.loop.setAttribute('aria-pressed', loopOn); });
ui.vo.addEventListener('change', () => {
  const f = ui.vo.files && ui.vo.files[0]; if (!f) return;
  if (voAudio) { voAudio.pause(); URL.revokeObjectURL(voAudio.src); }
  voAudio = new Audio(URL.createObjectURL(f)); ui.note.textContent = 'Voiceover loaded: ' + f.name + '. Effects use the lighter mix.';
  if (playing) startAudio();
});
(async () => {
  ${fontWait(s)}
  T = POSTER; draw(); window.__ready = true;
  requestAnimationFrame((n) => { last = n; tick(n); });
})();
</script>
`;
}

const args = process.argv.slice(2), ti = args.indexOf('--title');
const title = ti >= 0 ? args.splice(ti, 2)[1] : null;
const [styleId, storyPath, outDir] = args;
const base = STYLES[styleId];
if (!base || !storyPath || !outDir) { console.error('usage: node build.cjs <' + Object.keys(STYLES).join('|') + '> <story.js> <out-dir> [--title "Name"]'); process.exit(1); }
const s = Object.assign({}, base, title ? { title } : {});
const story = fs.readFileSync(storyPath, 'utf8'), slug = path.basename(storyPath).replace(/\.(c|m)?js$/, '');
fs.mkdirSync(outDir, { recursive: true });
const sb = path.join(outDir, slug + '-storyboard.html'), pl = path.join(outDir, slug + '.html');
fs.writeFileSync(sb, storyboard(styleId, s, story));
fs.writeFileSync(pl, player(styleId, s, story));
console.log(JSON.stringify({ storyboard: sb, player: pl }));

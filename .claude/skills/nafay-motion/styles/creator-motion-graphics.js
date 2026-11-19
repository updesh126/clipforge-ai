// =====================================================================================================
// STYLE: Creator Motion Graphics
// Kinetic captions slam in word by word, punch zooms and shake on emphasis, highlighter swipes,
// hand-drawn circles and arrows, perspective mockups, rolling counters, whip / glitch cuts, film grain.
// Topic: "How to get real leads at events".
// =====================================================================================================
const TOPIC = 'How to get real leads at events';
const POSTER = 2.45;
const W = 1280, HH = 720;
const { clamp, lerp, span, rng, noise1, ez } = CM;
const C = { bg: '#09090a', ink: '#f4f1ea', dim: '#8e8d94', mute: '#3b3b41', panel: '#151518', panel2: '#1d1d21', line: '#2b2b31', hi: '#ffd60a', money: '#3dff8f', red: '#ff3b30', black: '#0b0b0c' };
const F = { disp: '"Anton", "Bebas Neue", Impact, sans-serif', body: '"Inter", system-ui, sans-serif', serif: '"Instrument Serif", Georgia, serif' };
const disp = (px) => `${px}px ${F.disp}`, inter = (px, w = 600) => `${w} ${px}px ${F.body}`, serif = (px) => `italic ${px}px ${F.serif}`;

// ---------- the timeline: picture and sound both read these ----------
const TL = {
  D: 21.5,
  hook: { w1: [0.15, 0.36, 0.57], w2: [0.82, 1.04], strike: 1.38, shift: 1.55, need: 1.62, reps: 1.84, under: 2.05 },
  skill: { pill: 2.95, w: [3.02, 3.18, 3.36], chips: [3.6, 3.75, 3.9], drop: 4.45, pick: 4.7, ring: 4.8, just: 5.25, arrow: 5.32 },
  build: { pill: 6.42, w: [6.42, 6.62, 6.75], br: 6.45, sub: 7.0, cards: [7.35, 7.6, 7.85], hl: 8.15, cur: 8.3, click: 8.8 },
  dm: { pill: 10.36, w: [10.36, 10.55, 10.75], phone: 10.3, type: [10.9, 11.35], send: 11.4, cnt: [11.5, 13.0], seen: 11.9, dots: [12.05, 12.55], reply: 12.6, ring: 12.85 },
  math: { w: [13.62, 13.78, 13.94, 14.12], cnt: [14.3, 15.35], lock: 15.35, conv: 15.5, sub: 15.8 },
  wrong: { w: [16.86, 17.0, 17.14, 17.28], strike: [17.55, 17.63], stamp: 17.8 },
  take: { vol: 18.78, hl: 19.0, w: [19.2, 19.42], line: 20.0 },
};
// cuts between scenes: [start, duration, type]
const CUTS = [
  { t: 2.6, d: 0.28, type: 'whip', dir: 1 },
  { t: 6.1, d: 0.22, type: 'glitch' },
  { t: 10.0, d: 0.26, type: 'whipV', dir: 1 },
  { t: 13.4, d: 0.14, type: 'flash' },
  { t: 16.6, d: 0.2, type: 'glitch' },
  { t: 18.45, d: 0.25, type: 'whip', dir: -1 },
];
// camera kicks: punch zoom and shake
const PUNCH = [
  { t: 0.15, a: 0.025 }, { t: 0.36, a: 0.025 }, { t: 0.57, a: 0.03 }, { t: 0.82, a: 0.045 }, { t: 1.04, a: 0.075 }, { t: 1.84, a: 0.09 },
  { t: 3.36, a: 0.03 }, { t: 4.7, a: 0.04 }, { t: 6.75, a: 0.035 }, { t: 10.75, a: 0.03 }, { t: 12.6, a: 0.05 },
  { t: 14.12, a: 0.03 }, { t: 15.35, a: 0.12, k: 1.6 }, { t: 17.8, a: 0.07 }, { t: 18.78, a: 0.1 }, { t: 19.42, a: 0.05 },
];
const SHAKE = [{ t: 1.04, a: 7 }, { t: 1.84, a: 13 }, { t: 4.7, a: 5 }, { t: 12.6, a: 6 }, { t: 15.35, a: 18, k: 6 }, { t: 17.8, a: 16 }, { t: 18.78, a: 12 }];
const FLASH = [{ t: 1.84, a: 0.22 }, { t: 13.47, a: 0.0 }, { t: 15.35, a: 0.55 }, { t: 17.8, a: 0.35, col: '255,59,48' }, { t: 18.78, a: 0.25 }];
const LEAK = [1.84, 15.35, 18.78];

// shared value curves (picture and sound)
const dmCount = (t) => (t < TL.dm.cnt[0] ? 1 : 1 + Math.floor(199 * ez.out3(span(t, TL.dm.cnt[0], TL.dm.cnt[1])) + 1e-9));
const mathCount = (t) => Math.round(200 * ez.out3(span(t, TL.math.cnt[0], TL.math.cnt[1])));

// ---------- text helpers ----------
const word = (s, t, font, color, extra) => Object.assign({ s, t, font, color: color || C.ink }, extra || {});
function measure(c, it) { c.font = it.font; c.letterSpacing = it.track || '0px'; const w = c.measureText(it.s).width; c.letterSpacing = '0px'; return w; }
function row(c, items, x, y, gap, align = 'center') {
  let tot = 0; items.forEach((it) => { it.w = measure(c, it); tot += it.w; }); tot += gap * (items.length - 1);
  let cx = align === 'center' ? x - tot / 2 : x;
  items.forEach((it) => { it.x = cx; it.cx = cx + it.w / 2; it.y = y; cx += it.w + gap; });
  return { x0: align === 'center' ? x - tot / 2 : x, w: tot };
}
// a word slams in: big, blurred, settles with an expo ease
function slam(c, it, t, o = {}) {
  if (t < it.t) return;
  const u = span(t, it.t, it.t + (o.dur || 0.2)), e = ez.outExpo(u), s = lerp(o.from || 1.42, 1, e);
  c.save(); c.translate(it.cx, it.y); c.scale(s, s);
  c.globalAlpha = (o.alpha == null ? 1 : o.alpha) * Math.min(1, u * 3.5);
  if (u < 1 && !o.noBlur) { const b = (1 - e) * 9; if (b > 0.5) c.filter = `blur(${b.toFixed(1)}px)`; }
  c.font = it.font; c.letterSpacing = it.track || '0px'; c.textAlign = 'center'; c.textBaseline = it.base || 'middle';
  if (o.glow) { c.shadowColor = o.glow; c.shadowBlur = o.glowBlur || 40; }
  c.fillStyle = o.color || it.color; c.fillText(it.s, 0, 0);
  c.restore();
}
// highlighter swipe behind a word; returns the swipe path so the word can turn dark inside it
function swipe(c, it, t, t0, dur, o = {}) {
  const p = ez.out3(span(t, t0, t0 + dur)); if (p <= 0) return null;
  const px = parseFloat(/(\d+)px/.exec(it.font)[1]), h = (o.h || 0.8) * px, pad = o.pad || 18, y = it.y + (o.dy || 0) - h / 2;
  const x = it.x - pad, w = (it.w + pad * 2) * p, r = rng('sw' + t0);
  const path = new Path2D();
  path.moveTo(x + r.in(0, 6), y + r.in(0, 5)); path.lineTo(x + w, y + r.in(-4, 2));
  path.lineTo(x + w + r.in(-5, 3), y + h + r.in(-2, 4)); path.lineTo(x + r.in(2, 8), y + h + r.in(-3, 2)); path.closePath();
  c.save(); c.fillStyle = o.color || C.hi; c.fill(path); c.restore();
  return path;
}
function slamMarked(c, it, t, path, o = {}) {
  slam(c, it, t, o);
  if (!path) return;
  c.save(); c.clip(path); slam(c, it, t, Object.assign({}, o, { color: C.black, glow: null })); c.restore();
}
function strike(c, x0, x1, y, p, col = C.red, w = 12, tilt = -0.025) {
  if (p <= 0) return; const e = ez.out3(clamp(p)), x = lerp(x0, x1, e);
  c.save(); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = 12;
  c.beginPath(); c.moveTo(x0, y); c.lineTo(x, y + (x - x0) * tilt); c.stroke(); c.restore();
}
// hand-drawn loop around a thing, drawn on to progress p
function scribble(c, cx, cy, rx, ry, p, col, w, seed) {
  if (p <= 0) return; const n = noise1(seed), N = 96, turns = 1.1, a0 = -2.4, m = Math.max(2, Math.ceil(N * clamp(p)));
  c.save(); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
  for (let i = 0; i <= m; i++) { const u = i / N, a = a0 + u * turns * Math.PI * 2, k = 1 + 0.07 * n(u * 5 + seed) + 0.05 * u; const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke(); c.restore();
}
function handArrow(c, p0, q, p1, p, col, w) {
  if (p <= 0) return; const N = 30, m = Math.max(2, Math.round(N * clamp(p))), pts = [];
  for (let i = 0; i <= m; i++) { const u = i / N, v = 1 - u; pts.push([v * v * p0[0] + 2 * v * u * q[0] + u * u * p1[0], v * v * p0[1] + 2 * v * u * q[1] + u * u * p1[1]]); }
  c.save(); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach((q2, i) => (i ? c.lineTo(q2[0], q2[1]) : c.moveTo(q2[0], q2[1]))); c.stroke();
  if (p >= 0.92) { const a = pts[pts.length - 1], b = pts[pts.length - 4], an = Math.atan2(a[1] - b[1], a[0] - b[0]), hl = 22;
    c.beginPath(); c.moveTo(a[0] - Math.cos(an - 0.55) * hl, a[1] - Math.sin(an - 0.55) * hl); c.lineTo(a[0], a[1]); c.lineTo(a[0] - Math.cos(an + 0.55) * hl, a[1] - Math.sin(an + 0.55) * hl); c.stroke(); }
  c.restore();
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function wrap(c, text, maxW) { const out = []; let line = ''; for (const wd of text.split(' ')) { const test = line ? line + ' ' + wd : wd; if (c.measureText(test).width > maxW && line) { out.push(line); line = wd; } else line = test; } if (line) out.push(line); return out; }

// ---------- background, camera, finishing ----------
function background(c, t) {
  c.fillStyle = C.bg; c.fillRect(0, 0, W, HH);
  const glow = (x, y, r, col) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, HH); };
  glow(260 + Math.sin(t * 0.35) * 90, 180 + Math.cos(t * 0.27) * 40, 620, 'rgba(255,214,10,0.055)');
  glow(1050 + Math.cos(t * 0.31) * 70, 560 + Math.sin(t * 0.22) * 50, 640, 'rgba(90,120,255,0.05)');
  // faint editor grid, drifting
  c.save(); c.strokeStyle = 'rgba(244,241,234,0.032)'; c.lineWidth = 1; c.beginPath();
  const off = (t * 8) % 80; for (let x = -off; x < W; x += 80) { c.moveTo(x, 0); c.lineTo(x, HH); } for (let y = -off * 0.5; y < HH; y += 80) { c.moveTo(0, y); c.lineTo(W, y); } c.stroke(); c.restore();
  // red room for the "wrong" beat
  const red = span(t, 16.75, 17.0) * (1 - span(t, 18.4, 18.6)) * (0.6 + 0.4 * span(t, 17.55, 17.8));
  if (red > 0) glow(640, 380, 760, `rgba(255,40,30,${0.16 * red})`);
}
const NX = noise1(11), NY = noise1(23), NR = noise1(37);
// scene-level slow push and focus, per scene index
const PUSH = [[0, 2.6], [2.88, 6.1], [6.32, 10.0], [10.26, 13.4], [13.54, 16.6], [16.8, 18.45], [18.7, 21.5]];
function camera(t, si) {
  let z = 1, dx = 0, dy = 0, rot = 0;
  const [a, b] = PUSH[si]; z *= 1 + 0.035 * ez.inout3(span(t, a, b));
  if (si === 1) z *= 1 + 0.08 * ez.inout3(span(t, TL.skill.pick, TL.skill.pick + 0.35)); // lean in on the chosen chip
  for (const k of PUNCH) { const d = t - k.t; if (d < 0) continue; const e = d < 0.06 ? ez.out3(d / 0.06) : Math.exp(-(d - 0.06) * (k.k || 2.6)); z += k.a * e; }
  for (const k of SHAKE) { const d = t - k.t; if (d < 0 || d > 1.4) continue; const e = k.a * Math.exp(-d * (k.k || 8)); dx += e * NX(t * 34 + k.t * 5); dy += e * NY(t * 37 + k.t * 3); rot += e * 0.0015 * NR(t * 26 + k.t); }
  const fy = si === 1 ? lerp(360, 410, ez.inout3(span(t, TL.skill.pick, TL.skill.pick + 0.35))) : 360;
  return { z, dx, dy, rot, fx: 640, fy };
}
const applyCam = (c, k) => { c.translate(640 + k.dx, 360 + k.dy); c.rotate(k.rot); c.scale(k.z, k.z); c.translate(-k.fx, -k.fy); };

let GRAIN = null;
function grainTiles() { if (GRAIN) return GRAIN; GRAIN = []; for (let g = 0; g < 4; g++) { const L = CM.layer(256, 256), x = L.getContext('2d'), img = x.createImageData(256, 256), r = rng('grain' + g); for (let i = 0; i < img.data.length; i += 4) { const v = 128 + (r() + r() - 1) * 120; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; } x.putImageData(img, 0, 0); GRAIN.push(L); } return GRAIN; }
function finishing(c, t) {
  // light leaks on the big moments
  for (const t0 of LEAK) { const u = span(t, t0, t0 + 0.95); if (u <= 0 || u >= 1) continue; const e = Math.sin(Math.PI * u);
    c.save(); c.globalCompositeOperation = 'screen'; const x = lerp(-150, 1450, ez.out3(u)), g = c.createRadialGradient(x, 120, 0, x, 120, 760);
    g.addColorStop(0, `rgba(255,150,50,${0.42 * e})`); g.addColorStop(0.45, `rgba(255,70,40,${0.16 * e})`); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, W, HH); c.restore(); }
  // flashes
  for (const f of FLASH) { const d = t - f.t; if (d < 0 || d > 0.4 || !f.a) continue; c.fillStyle = `rgba(${f.col || '255,255,255'},${f.a * Math.exp(-d * 11)})`; c.fillRect(0, 0, W, HH); }
  // vignette
  const v = c.createRadialGradient(640, 360, 260, 640, 360, 820); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); c.fillStyle = v; c.fillRect(0, 0, W, HH);
  // film grain, stepped at 24 fps
  const fi = Math.floor(t * 24), r = rng(fi + 900), tile = grainTiles()[fi % 4];
  c.save(); c.globalAlpha = 0.07; c.globalCompositeOperation = 'overlay'; const pat = c.createPattern(tile, 'repeat'); pat.setTransform(new DOMMatrix().translateSelf(-r() * 256, -r() * 256)); c.fillStyle = pat; c.fillRect(0, 0, W, HH);
  c.globalAlpha = 0.035; c.globalCompositeOperation = 'source-over'; c.fillRect(0, 0, W, HH); c.restore();
}

// ---------- persistent chrome: topic label + step pill (screen space) ----------
function chrome(c, t) {
  const a = span(t, 2.86, 3.1) * (1 - span(t, 13.3, 13.45));
  if (a > 0) {
    c.save(); c.globalAlpha = a; c.fillStyle = C.hi; c.fillRect(64, 47, 12, 12);
    c.font = inter(28, 700); c.letterSpacing = '3px'; c.fillStyle = C.dim; c.textBaseline = 'middle'; c.fillText('HOW TO GET REAL LEADS AT EVENTS', 88, 54); c.restore();
  }
  const steps = [['STEP 01', TL.skill.pill, 6.1], ['STEP 02', TL.build.pill, 10.0], ['STEP 03', TL.dm.pill, 13.4]];
  for (const [label, t0, t1] of steps) {
    if (t < t0 || t > t1) continue; const s = ez.back(span(t, t0, t0 + 0.3), 2.2);
    c.save(); c.translate(64, 108); c.scale(s, s); c.font = inter(28, 800); c.letterSpacing = '3px';
    const w = c.measureText(label).width + 30; c.fillStyle = C.hi; rr(c, 0, -23, w, 46, 8); c.fill();
    c.fillStyle = C.black; c.textBaseline = 'middle'; c.fillText(label, 15, 2); c.restore();
  }
}

// =================================== SCENES ===================================
// 0 · hook
function sceneHook(c, t) {
  const H = TL.hook, sh = lerp(45, -70, ez.inout3(span(t, H.shift, H.shift + 0.3)));
  const r1 = [word('YOU', H.w1[0], disp(118), C.ink, { track: '2px' }), word("DON'T", H.w1[1], disp(118), C.ink, { track: '2px' }), word('NEED', H.w1[2], disp(118), C.ink, { track: '2px' })];
  const r2 = [word('MORE', H.w2[0], disp(150), C.ink, { track: '2px' }), word('FOOTFALL.', H.w2[1], disp(150), C.ink, { track: '2px' })];
  row(c, r1, 640, 232 + sh, 30); const b2 = row(c, r2, 640, 392 + sh, 34);
  const dimA = 1 - 0.62 * span(t, H.strike, H.strike + 0.18);
  r1.forEach((it) => slam(c, it, t, { alpha: dimA })); r2.forEach((it) => slam(c, it, t, { alpha: dimA, from: 1.6 }));
  strike(c, b2.x0 - 20, b2.x0 + b2.w + 20, 392 + sh, span(t, H.strike, H.strike + 0.16), C.red, 14);
  if (t >= H.need) {
    const r3 = [word('you need', H.need, inter(46, 600), C.dim, { base: 'alphabetic' }), word('a reason to stay.', H.reps, serif(124), C.hi, { base: 'alphabetic' })];
    row(c, r3, 640, 590, 24);
    slam(c, r3[0], t, { from: 1.15 }); slam(c, r3[1], t, { from: 1.7, glow: 'rgba(255,214,10,0.35)' });
    // marker underline under the yellow phrase
    const p = span(t, H.under, H.under + 0.22); if (p > 0) { const x0 = r3[1].x - 6, x1 = r3[1].x + r3[1].w + 8; c.save(); c.strokeStyle = C.hi; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); const n = 24; for (let i = 0; i <= n * p; i++) { const u = i / n, x = lerp(x0, x1, u), y = 622 + Math.sin(u * 3.2) * 5 - u * 6; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); }
  }
}
// 1 · pick one game
function icon(c, kind, x, y, s, col) {
  c.save(); c.translate(x, y); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 3.5; c.lineJoin = 'round'; c.lineCap = 'round';
  if (kind === 'wheel') { c.beginPath(); c.arc(0, 0, s, 0, 7); c.stroke(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * s, Math.sin(a) * s); c.stroke(); } c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill(); c.beginPath(); c.moveTo(-5, -s - 7); c.lineTo(5, -s - 7); c.lineTo(0, -s + 2); c.closePath(); c.fill(); }
  else if (kind === 'camera') { rr(c, -s, -s * 0.62, s * 2, s * 1.4, 6); c.stroke(); c.beginPath(); c.arc(0, 0.08 * s, s * 0.42, 0, 7); c.stroke(); rr(c, -s * 0.45, -s * 0.9, s * 0.6, s * 0.3, 3); c.fill(); }
  else { c.beginPath(); c.arc(0, 0, s, 0, 7); c.stroke(); c.font = disp(Math.round(s * 1.35)); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, 2); }
  c.restore();
}
function sceneSkill(c, t) {
  const S = TL.skill;
  const head = [word('PICK', S.w[0], disp(108)), word('ONE', S.w[1], disp(108), C.hi), word('GAME', S.w[2], disp(108))];
  row(c, head, 640, 238, 26); head.forEach((it) => slam(c, it, t));
  const chips = [['AR selfie', 'camera'], ['Spin the wheel', 'wheel'], ['60-sec quiz', 'quiz']], X = [290, 640, 990], Y = 455, w = 330, h = 120;
  chips.forEach(([label, ic], i) => {
    const t0 = S.chips[i]; if (t < t0) return;
    const pop = ez.back(span(t, t0, t0 + 0.32), 2), chosen = i === 1;
    const dimA = chosen ? 1 : 1 - 0.7 * span(t, S.drop, S.drop + 0.18);
    const grow = chosen ? 1 + 0.12 * ez.back(span(t, S.pick, S.pick + 0.32), 2.2) : 1;
    const lit = chosen ? span(t, S.pick, S.pick + 0.12) : 0;
    c.save(); c.translate(X[i], Y + (1 - pop) * 40); c.scale(pop * grow, pop * grow); c.globalAlpha = dimA * Math.min(1, pop * 2);
    if (lit > 0) { c.shadowColor = `rgba(255,214,10,${0.55 * lit})`; c.shadowBlur = 44; }
    c.fillStyle = C.panel; rr(c, -w / 2, -h / 2, w, h, 18); c.fill(); c.shadowBlur = 0;
    c.lineWidth = lit > 0 ? 3 : 1.5; c.strokeStyle = lit > 0 ? C.hi : C.line; rr(c, -w / 2, -h / 2, w, h, 18); c.stroke();
    icon(c, ic, -w / 2 + 50, 0, 20, lit > 0 ? C.hi : C.ink);
    c.font = inter(30, 700); c.fillStyle = C.ink; c.textBaseline = 'middle'; c.fillText(label, -w / 2 + 88, 2);
    c.restore();
    if (!chosen) { c.save(); c.globalAlpha = 0.9; strike(c, X[i] - w / 2 + 20, X[i] + w / 2 - 20, Y, span(t, S.drop, S.drop + 0.14), C.dim, 5, 0); c.restore(); }
  });
  scribble(c, 640, Y, 222, 104, span(t, S.ring, S.ring + 0.38), C.hi, 7, 4);
  if (t >= S.just) { const it = word('just one.', S.just, serif(76), C.hi, { base: 'alphabetic' }); row(c, [it], 960, 650, 0); slam(c, it, t, { from: 1.5 }); }
  handArrow(c, [880, 612], [830, 600], [812, 538], span(t, S.arrow, S.arrow + 0.25), C.hi, 6);
}
// 2 · prize for a sign-up (perspective browser mockup)
let BR = null;
function browserLayer(t) {
  const B = TL.build; if (!BR) BR = CM.layer(780, 520); const x = BR.getContext('2d'); const w = 780, h = 520;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
  x.fillStyle = '#f4f2ee'; rr(x, 0, 0, w, h, 18); x.fill();
  x.save(); rr(x, 0, 0, w, h, 18); x.clip();
  x.fillStyle = '#e4e1db'; x.fillRect(0, 0, w, 52);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(28 + i * 22, 26, 7, 0, 7); x.fill(); });
  x.fillStyle = '#ffffff'; rr(x, 120, 12, 420, 28, 14); x.fill(); x.fillStyle = '#6d6a64'; x.font = inter(17, 600); x.textBaseline = 'middle'; x.fillText('play.yourbrand.co/booth', 140, 27);
  x.fillStyle = '#121214'; x.font = disp(54); x.textBaseline = 'alphabetic'; x.letterSpacing = '1px'; x.fillText('SPIN & WIN', 40, 132); x.letterSpacing = '0px';
  x.fillStyle = '#8b877f'; x.font = inter(20, 600); x.fillText('Every play wins something', 40, 164);
  // the prize wheel (spins after the click)
  { const cx = 625, cy = 330, R = 118, rot = 0.3 + 7.2 * ez.out3(span(t, B.click, B.click + 1.6)), cols = ['#ff8a3d', '#ffcf5c', '#28c7ff', '#6a5cff', '#ff4f9a', '#20c46b'];
    x.save(); x.shadowColor = 'rgba(0,0,0,0.18)'; x.shadowBlur = 20; x.shadowOffsetY = 8; x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, R + 10, 0, 7); x.fill(); x.restore();
    cols.forEach((col, i) => { const a0 = rot + (i / 6) * Math.PI * 2, a1 = a0 + Math.PI / 3; x.fillStyle = col; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, a0, a1); x.closePath(); x.fill(); });
    x.fillStyle = '#fff'; x.beginPath(); x.arc(cx, cy, 20, 0, 7); x.fill(); x.fillStyle = '#121214'; x.beginPath(); x.moveTo(cx - 14, cy - R - 18); x.lineTo(cx + 14, cy - R - 18); x.lineTo(cx, cy - R + 8); x.closePath(); x.fill(); }
  const pop = (t0) => ez.back(span(t, t0, t0 + 0.3), 1.8);
  // form: two fields, a consent tick, a button
  [['Your name', 196], ['Mobile number', 266]].forEach(([ph, y], i) => {
    const p = pop(B.cards[i]); if (p <= 0) return; x.save(); x.translate(250, y + 29); x.scale(p, p); x.translate(-250, -(y + 29));
    x.fillStyle = '#fff'; rr(x, 40, y, 420, 58, 12); x.fill(); x.strokeStyle = '#d9d6cf'; x.lineWidth = 2; rr(x, 40, y, 420, 58, 12); x.stroke();
    x.fillStyle = '#9a968e'; x.font = inter(22, 500); x.textBaseline = 'middle'; x.fillText(ph, 62, y + 30); x.restore();
  });
  { const p = pop(B.cards[2]); if (p > 0) { x.save(); x.translate(60, 352); x.scale(p, p); x.translate(-60, -352);
    x.fillStyle = '#fff'; rr(x, 40, 336, 34, 34, 8); x.fill(); x.strokeStyle = '#b9b5ad'; x.lineWidth = 2; rr(x, 40, 336, 34, 34, 8); x.stroke();
    const ck = ez.back(span(t, B.cards[2] + 0.32, B.cards[2] + 0.52), 2.4);
    if (ck > 0) { x.save(); x.translate(57, 353); x.scale(ck, ck); x.fillStyle = '#20c46b'; rr(x, -17, -17, 34, 34, 8); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = 4; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(-7, 1); x.lineTo(-2, 6); x.lineTo(8, -6); x.stroke(); x.restore(); }
    x.fillStyle = '#18181a'; x.font = inter(20, 700); x.textBaseline = 'middle'; x.fillText('I agree to get offers by SMS', 88, 346);
    x.fillStyle = '#3b6cff'; x.font = inter(17, 600); x.fillText('Read the privacy notice', 88, 370); x.fillRect(88, 380, x.measureText('Read the privacy notice').width, 1.5);
    x.restore(); } }
  { const p = pop(B.cards[2] + 0.1), lift = ez.back(span(t, B.click, B.click + 0.25), 2); if (p > 0) { x.save(); x.translate(250, 442); x.scale(p * (1 + 0.04 * lift), p * (1 + 0.04 * lift)); x.translate(-250, -442);
    x.fillStyle = '#121214'; rr(x, 40, 410, 420, 64, 14); x.fill(); if (lift > 0) { x.strokeStyle = `rgba(255,214,10,${lift})`; x.lineWidth = 5; rr(x, 40, 410, 420, 64, 14); x.stroke(); }
    x.fillStyle = '#fff'; x.font = disp(32); x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '2px'; x.fillText('SPIN NOW', 250, 444); x.letterSpacing = '0px'; x.textAlign = 'left'; x.restore(); } }
  // cursor travels to the button and clicks
  if (t > B.cur) {
    const u = ez.inout3(span(t, B.cur, B.click - 0.05)), px = lerp(760, 300, u), py = lerp(520, 448, u);
    const ck = t > B.click ? span(t, B.click, B.click + 0.35) : 0, s = 1 - 0.18 * Math.sin(Math.PI * Math.min(1, ck * 2.5));
    if (ck > 0 && ck < 1) { x.strokeStyle = `rgba(255,214,10,${1 - ck})`; x.lineWidth = 4; x.beginPath(); x.arc(px, py, 10 + 40 * ck, 0, 7); x.stroke(); }
    x.save(); x.translate(px, py); x.scale(1.5 * s, 1.5 * s); x.fillStyle = '#111'; x.strokeStyle = '#fff'; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 22); x.lineTo(5.5, 17); x.lineTo(9.5, 26); x.lineTo(13, 24.5); x.lineTo(9, 15.5); x.lineTo(16, 15.5); x.closePath(); x.fill(); x.stroke(); x.restore();
  }
  x.restore();
  return BR;
}
// draw a flat layer rotated around its vertical axis (perspective by vertical strips)
function drawYaw(c, src, cx, cy, w, h, yaw, alpha) {
  const f = 1500, cs = Math.cos(yaw), sn = Math.sin(yaw);
  const proj = (x) => { const X = x * cs, Z = x * sn, k = f / (f + Z); return { x: cx + X * k, k }; };
  const L = proj(-w / 2), R = proj(w / 2);
  c.save(); c.globalAlpha = alpha;
  c.save(); c.filter = 'blur(30px)'; c.fillStyle = 'rgba(0,0,0,0.7)'; c.beginPath();
  c.moveTo(L.x + 20, cy - (h * L.k) / 2 + 50); c.lineTo(R.x + 20, cy - (h * R.k) / 2 + 50); c.lineTo(R.x + 20, cy + (h * R.k) / 2 + 50); c.lineTo(L.x + 20, cy + (h * L.k) / 2 + 50); c.closePath(); c.fill(); c.restore();
  const sw = 3;
  for (let sx = 0; sx < src.width; sx += sw) {
    const p0 = proj((sx / src.width - 0.5) * w), p1 = proj(((sx + sw) / src.width - 0.5) * w), hh = (h * (p0.k + p1.k)) / 2;
    c.drawImage(src, sx, 0, sw, src.height, p0.x, cy - hh / 2, p1.x - p0.x + 0.7, hh);
  }
  const g = c.createLinearGradient(L.x, cy - h / 2, R.x, cy + h / 2); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.4, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
  c.fillStyle = g; c.beginPath(); c.moveTo(L.x, cy - (h * L.k) / 2); c.lineTo(R.x, cy - (h * R.k) / 2); c.lineTo(R.x, cy + (h * R.k) / 2); c.lineTo(L.x, cy + (h * L.k) / 2); c.closePath(); c.fill();
  c.restore();
}
function sceneBuild(c, t) {
  const B = TL.build;
  const enter = ez.outExpo(span(t, B.br, B.br + 0.65)), yaw = lerp(-0.62, -0.36, enter) + Math.sin(t * 0.9) * 0.015;
  if (t > B.br) drawYaw(c, browserLayer(t), 878 + (1 - enter) * 520, 404 + Math.sin(t * 1.1) * 5, 620, 413, yaw, Math.min(1, enter * 1.6));
  const l1 = [word('PRIZE', B.w[0], disp(124))], l2 = [word('=', B.w[1], disp(124), C.hi), word('SIGN-UP', B.w[2], disp(124))];
  row(c, l1, 72, 270, 0, 'left'); row(c, l2, 72, 405, 24, 'left');
  slam(c, l1[0], t); slam(c, l2[0], t, { from: 1.8 });
  const path = swipe(c, l2[1], t, B.hl, 0.24, { h: 0.82, pad: 14, dy: 4 });
  slamMarked(c, l2[1], t, path);
  if (t > B.sub) { c.save(); const u = ez.out3(span(t, B.sub, B.sub + 0.35)); c.globalAlpha = u; c.font = inter(32, 600); c.fillStyle = C.dim; c.textBaseline = 'middle'; c.fillText('name, number, consent tick', 76, 498 + (1 - u) * 16); c.restore(); }
}
// 3 · follow up in 24 hours (phone mockup)
function bubble(c, lines, x, y, maxW, mine, p, lh = 36) {
  const padX = 18, padY = 14; c.font = inter(28, 600);
  const bw = Math.min(maxW, Math.max(...lines.map((l) => c.measureText(l).width)) + padX * 2), bh = lines.length * lh + padY * 2 - 6;
  const bx = mine ? x - bw : x, s = ez.back(clamp(p), 1.9); if (s <= 0) return bh;
  c.save(); c.translate(mine ? bx + bw : bx, y + bh); c.scale(s, s); c.translate(mine ? -bw : 0, -bh);
  c.fillStyle = mine ? C.hi : '#26262b'; rr(c, 0, 0, bw, bh, 22); c.fill();
  c.fillStyle = mine ? C.black : C.ink; c.textBaseline = 'top'; lines.forEach((l, i) => c.fillText(l, padX, padY + i * lh));
  c.restore(); return bh;
}
const OUT_MSG = 'Hi! Your spin won 15% off. Code: SPIN15', IN_MSG = 'Just used it. Thanks!';
function scenePhone(c, t) {
  const D = TL.dm;
  const l1 = [word('FOLLOW UP', D.w[0], disp(110))], l2 = [word('IN', D.w[1], disp(110)), word('24', D.w[1] + 0.08, disp(110), C.hi)], l3 = [word('HOURS.', D.w[2], disp(110))];
  row(c, l1, 72, 250, 0, 'left'); row(c, l2, 72, 372, 22, 'left'); row(c, l3, 72, 494, 0, 'left');
  [...l1, ...l2, ...l3].forEach((it) => slam(c, it, t));
  if (t > D.send + 0.05) {
    const u = ez.back(span(t, D.send + 0.05, D.send + 0.35), 2); c.save(); c.translate(72, 610); c.scale(u, u); c.globalAlpha = Math.min(1, u * 2);
    c.fillStyle = C.panel; rr(c, 0, -40, 330, 80, 14); c.fill(); c.strokeStyle = C.line; c.lineWidth = 1.5; rr(c, 0, -40, 330, 80, 14); c.stroke();
    c.font = inter(28, 600); c.fillStyle = C.dim; c.textBaseline = 'middle'; c.fillText('follow-ups', 22, 2);
    const n = dmCount(t), bump = 1 + 0.12 * Math.max(0, 1 - ((t - D.cnt[0]) * 12 % 1) * 3) * (t < D.cnt[1] + 0.05 && t > D.cnt[0] ? 1 : 0);
    c.save(); c.translate(258, 4); c.scale(bump, bump); c.font = disp(56); c.fillStyle = n >= 200 ? C.hi : C.ink; c.textAlign = 'center'; c.fillText(String(n), 0, 0); c.restore();
    c.restore();
  }
  // phone
  const enter = ez.outExpo(span(t, D.phone, D.phone + 0.5)); if (enter <= 0) return;
  const shake = t > D.reply ? Math.exp(-(t - D.reply) * 9) * Math.sin((t - D.reply) * 70) * 5 : 0;
  const pw = 372, ph = 640;
  c.save(); c.translate(935 + shake, 382 + (1 - enter) * 560); c.rotate(-0.035); c.translate(-pw / 2, -ph / 2);
  c.save(); c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = 60; c.shadowOffsetY = 30; c.fillStyle = '#18181b'; rr(c, 0, 0, pw, ph, 54); c.fill(); c.restore();
  c.strokeStyle = '#33333a'; c.lineWidth = 3; rr(c, 1.5, 1.5, pw - 3, ph - 3, 53); c.stroke();
  c.fillStyle = '#0e0e10'; rr(c, 11, 11, pw - 22, ph - 22, 44); c.fill();
  c.save(); rr(c, 11, 11, pw - 22, ph - 22, 44); c.clip();
  c.fillStyle = '#000'; rr(c, pw / 2 - 52, 22, 104, 28, 14); c.fill();
  // header
  const ag = c.createLinearGradient(40, 70, 90, 120); ag.addColorStop(0, '#28c7ff'); ag.addColorStop(1, '#6a5cff');
  c.fillStyle = ag; c.beginPath(); c.arc(62, 94, 25, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = disp(26); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('L', 62, 96); c.textAlign = 'left';
  c.fillStyle = C.ink; c.font = inter(26, 700); c.fillText('Lead #128', 100, 84);
  c.fillStyle = C.money; c.beginPath(); c.arc(106, 110, 5, 0, 7); c.fill(); c.fillStyle = C.dim; c.font = inter(19, 500); c.fillText('Met at the booth', 118, 111);
  c.fillStyle = '#222227'; c.fillRect(11, 136, pw - 22, 1.5);
  // thread
  c.font = inter(28, 600);
  const outLines = wrap(c, OUT_MSG, 230);
  let y = 158; const outH = bubble(c, outLines, pw - 26, y, 268, true, span(t, D.send, D.send + 0.28));
  if (t > D.seen) { c.globalAlpha = span(t, D.seen, D.seen + 0.2); c.fillStyle = C.dim; c.font = inter(19, 500); c.textAlign = 'right'; c.textBaseline = 'top'; c.fillText('Seen', pw - 30, y + outH + 8); c.textAlign = 'left'; c.globalAlpha = 1; }
  y += outH + 44;
  if (t > D.dots[0] && t < D.reply) { const a = span(t, D.dots[0], D.dots[0] + 0.12); c.globalAlpha = a; c.fillStyle = '#26262b'; rr(c, 26, y, 96, 52, 22); c.fill();
    for (let i = 0; i < 3; i++) { const b = Math.max(0, Math.sin((t * 7 - i * 0.6) * Math.PI)) * 6; c.fillStyle = C.dim; c.beginPath(); c.arc(52 + i * 22, y + 26 - b, 6, 0, 7); c.fill(); } c.globalAlpha = 1; }
  c.font = inter(28, 600);
  const inLines = wrap(c, IN_MSG, 220);
  const inH = bubble(c, inLines, 26, y, 260, false, span(t, D.reply, D.reply + 0.28));
  // composer
  const cy = ph - 84; c.fillStyle = '#1b1b1f'; rr(c, 24, cy, pw - 104, 52, 26); c.fill();
  const n = Math.floor(OUT_MSG.length * span(t, D.type[0], D.type[1]));
  c.save(); rr(c, 24, cy, pw - 104, 52, 26); c.clip(); c.font = inter(22, 500); c.textBaseline = 'middle';
  if (t > D.type[0] && t < D.send) { const s = OUT_MSG.slice(0, n), tw = c.measureText(s).width, room = pw - 150; c.fillStyle = C.ink; c.fillText(s, 44 + Math.min(0, room - tw), cy + 27); }
  else { c.fillStyle = '#5c5c63'; c.fillText('Message…', 44, cy + 27); }
  c.restore();
  const sp = t > D.send && t < D.send + 0.2 ? 0.85 : 1;
  c.save(); c.translate(pw - 52, cy + 26); c.scale(sp, sp); c.fillStyle = C.hi; c.beginPath(); c.arc(0, 0, 24, 0, 7); c.fill(); c.strokeStyle = C.black; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(0, 10); c.lineTo(0, -9); c.moveTo(-8, -1); c.lineTo(0, -9); c.lineTo(8, -1); c.stroke(); c.restore();
  c.restore();
  c.restore();
  if (t > D.ring) { c.save(); c.translate(935, 382); c.rotate(-0.035); scribble(c, -pw / 2 + 26 + 130, -ph / 2 + y + inH / 2, 175, 70, span(t, D.ring, D.ring + 0.35), C.hi, 6, 9); c.restore(); }
}
// 4 · the math
function sceneMath(c, t) {
  const M = TL.math;
  const r = [word('500', M.w[0], disp(128)), word('×', M.w[1], inter(96, 800), C.dim), word('40%', M.w[2], disp(128)), word('=', M.w[3], inter(96, 800), C.dim)];
  row(c, r, 640, 170, 30); r.forEach((it) => slam(c, it, t));
  if (t > M.cnt[0] - 0.15) {
    const v = mathCount(t), lk = t > M.lock ? span(t, M.lock, M.lock + 0.4) : 0, pop = 1 + 0.16 * Math.sin(Math.PI * lk) * (lk < 1 ? 1 : 0);
    c.save(); c.translate(640, 430); c.scale(pop, pop); c.globalAlpha = span(t, M.cnt[0] - 0.15, M.cnt[0]);
    c.font = disp(250); c.textAlign = 'center'; c.textBaseline = 'middle'; c.letterSpacing = '4px';
    c.shadowColor = `rgba(61,255,143,${0.35 + 0.4 * (t > M.lock ? Math.exp(-(t - M.lock) * 2) : 0)})`; c.shadowBlur = 60; c.fillStyle = C.money; c.fillText(String(v), 0, 0);
    c.shadowBlur = 0; c.fillText(String(v), 0, 0); c.restore();
    const age = t - M.lock;
    if (age > 0 && age < 0.9) { const rr2 = rng('spark'); c.save(); c.lineCap = 'round';
      for (let i = 0; i < 26; i++) { const an = rr2() * Math.PI * 2, sp = rr2.in(260, 520), d0 = sp * ez.out3(Math.min(1, age / 0.6)), len = 46 * (1 - age / 0.9); c.strokeStyle = i % 3 ? `rgba(61,255,143,${1 - age / 0.9})` : `rgba(255,255,255,${1 - age / 0.9})`; c.lineWidth = 4; c.beginPath(); c.moveTo(640 + Math.cos(an) * d0, 430 + Math.sin(an) * d0 * 0.7); c.lineTo(640 + Math.cos(an) * (d0 + len), 430 + Math.sin(an) * (d0 + len) * 0.7); c.stroke(); }
      c.restore(); }
  }
  if (t >= M.conv) { const it = word('real leads', M.conv, serif(96), C.ink, { base: 'alphabetic' }); row(c, [it], 640, 630, 0); slam(c, it, t, { from: 1.4 }); }
  if (t > M.sub) { c.save(); const u = ez.out3(span(t, M.sub, M.sub + 0.35)); c.globalAlpha = u; c.font = inter(30, 600); c.fillStyle = C.dim; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('example: 500 visitors, 40% play', 640, 684 - (1 - u) * 12); c.restore(); }
}
// 5 · the wrong move
let STAMP = null;
function stampLayer() {
  if (STAMP) return STAMP; STAMP = CM.layer(340, 190); const x = STAMP.getContext('2d');
  x.strokeStyle = C.red; x.lineWidth = 10; rr(x, 10, 10, 320, 170, 16); x.stroke();
  x.fillStyle = C.red; x.font = disp(124); x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '4px'; x.fillText('NO.', 172, 100);
  x.globalCompositeOperation = 'destination-out'; const r = rng('stamp'); for (let i = 0; i < 420; i++) { x.globalAlpha = r.in(0.3, 1); x.beginPath(); x.arc(r() * 340, r() * 190, r.in(0.6, 2.6), 0, 7); x.fill(); }
  return STAMP;
}
function sceneWrong(c, t) {
  const X = TL.wrong;
  const r1 = [word('FREE', X.w[0], disp(124)), word('PENS', X.w[1], disp(124))], r2 = [word('FOR', X.w[2], disp(124)), word('EVERYONE?', X.w[3], disp(124))];
  const b1 = row(c, r1, 640, 262, 30), b2 = row(c, r2, 640, 404, 30);
  const dimmed = span(t, X.strike[0], X.strike[0] + 0.2);
  [...r1, ...r2].forEach((it) => slam(c, it, t, { color: dimmed > 0.5 ? '#7a7a80' : it.color }));
  strike(c, b1.x0 - 20, b1.x0 + b1.w + 20, 262, span(t, X.strike[0], X.strike[0] + 0.14), C.red, 15);
  strike(c, b2.x0 - 20, b2.x0 + b2.w + 20, 404, span(t, X.strike[1], X.strike[1] + 0.14), C.red, 15);
  if (t > X.stamp) { const u = span(t, X.stamp, X.stamp + 0.13), s = lerp(2.4, 1, ez.in3(u)); c.save(); c.translate(960, 572); c.rotate(-0.16); c.scale(s, s); c.globalAlpha = Math.min(1, u * 3) * 0.95; c.drawImage(stampLayer(), -170, -95); c.restore(); }
}
// 6 · takeaway
function sceneTake(c, t) {
  const K = TL.take;
  const v = word('PLAY', K.vol, disp(214), C.ink, { track: '4px' }); row(c, [v], 640, 268, 0);
  const path = swipe(c, v, t, K.hl, 0.26, { h: 0.84, pad: 24, dy: 6 });
  slamMarked(c, v, t, path, { from: 1.6 });
  const r2 = [word('BEATS', K.w[0], disp(150)), word('PRINT.', K.w[1], disp(150))]; row(c, r2, 640, 470, 34); r2.forEach((it) => slam(c, it, t));
  if (t > K.line) { c.save(); const u = ez.out3(span(t, K.line, K.line + 0.45)); c.globalAlpha = u; c.font = inter(34, 600); c.fillStyle = C.dim; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Design the reward before the booth.', 640, 612 + (1 - u) * 18); c.restore(); }
}
const SCENES = [sceneHook, sceneSkill, sceneBuild, scenePhone, sceneMath, sceneWrong, sceneTake];

// =================================== COMPOSITOR ===================================
const LA = CM.layer(W, HH), LB = CM.layer(W, HH), LT = CM.layer(W, HH), LR = CM.layer(W, HH), LG = CM.layer(W, HH);
function sceneIndex(t) { let i = 0; for (const c of CUTS) if (t >= c.t) i++; return i; }
function paintScene(c, i, t) { c.save(); applyCam(c, camera(t, i)); SCENES[i](c, t); c.restore(); }
function paintLayer(L, i, t, withBg) { const x = L.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, W, HH); if (withBg) background(x, t); paintScene(x, i, t); return L; }
function explainer(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  const idx = sceneIndex(t), cut = CUTS.find((c) => t >= c.t && t < c.t + c.d);
  if (!cut) { background(ctx, t); paintScene(ctx, idx, t); }
  else {
    const u = (t - cut.t) / cut.d, from = idx - 1, to = idx;
    if (cut.type === 'whip' || cut.type === 'whipV') {
      background(ctx, t);
      const e = ez.inout3(u), vert = cut.type === 'whipV', dir = cut.dir || 1, D = vert ? HH : W, blur = Math.sin(Math.PI * u) * 170;
      paintLayer(LA, from, t, false); paintLayer(LB, to, t, false);
      const T = LT.getContext('2d'); T.setTransform(1, 0, 0, 1, 0, 0); T.clearRect(0, 0, W, HH); T.globalCompositeOperation = 'lighter';
      const N = 8; T.globalAlpha = 1 / N;
      for (let k = 0; k < N; k++) { const o = (k / (N - 1) - 0.5) * blur, oa = -e * D * dir + o, ob = (1 - e) * D * dir + o;
        if (vert) { T.drawImage(LA, 0, oa); T.drawImage(LB, 0, ob); } else { T.drawImage(LA, oa, 0); T.drawImage(LB, ob, 0); } }
      T.globalCompositeOperation = 'source-over'; T.globalAlpha = 1; ctx.drawImage(LT, 0, 0);
    } else if (cut.type === 'glitch') {
      paintLayer(LA, u < 0.5 ? from : to, t, true);
      const fi = Math.floor(t * 60), r = rng('g' + fi), off = (8 + r() * 18) * Math.sin(Math.PI * u) * 1.6;
      const tint = (L, col) => { const x = L.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, W, HH); x.drawImage(LA, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, HH); x.globalCompositeOperation = 'source-over'; return L; };
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, HH); ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(tint(LR, '#ff0000'), off, 0); ctx.drawImage(tint(LG, '#00ffff'), -off, 0); ctx.globalCompositeOperation = 'source-over';
      for (let k = 0; k < 9; k++) { const y = r() * HH, h = 6 + r() * 60, dx = (r() - 0.5) * 140 * Math.sin(Math.PI * u); ctx.drawImage(LA, 0, y, W, h, dx, y, W, h); }
      if (r() > 0.4) { ctx.fillStyle = `rgba(255,255,255,${0.08 + r() * 0.12})`; ctx.fillRect(0, r() * HH, W, 2 + r() * 6); }
    } else {
      background(ctx, t); paintScene(ctx, u < 0.5 ? from : to, t);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - Math.abs(u * 2 - 1))})`; ctx.fillRect(0, 0, W, HH);
    }
  }
  chrome(ctx, t);
  finishing(ctx, t);
}

// =================================== SOUND SCORE ===================================
function scoreSound(k) {
  const H = TL.hook, S = TL.skill, B = TL.build, Dm = TL.dm, M = TL.math, X = TL.wrong, K = TL.take;
  const px = (x) => clamp((x / 1280) * 2 - 1, -1, 1) * 0.55;
  // music: drone into the drop, beat under the steps, cut by a tape stop, back for the takeaway
  k.drone(0, H.reps + 0.05, { gain: 1 });
  k.play('riser', H.reps - 1.15, { dur: 1.15, gain: 0.9 });
  k.music(H.reps, X.strike[0], { bpm: 98, gain: 1 });
  k.music(K.vol, TL.D - 0.15, { bpm: 98, gain: 1 });

  // hook
  H.w1.forEach((t, i) => k.play('slam', t, { gain: 0.65, pan: (i - 1) * 0.25 }));
  k.play('slam', H.w2[0], { gain: 0.85, pan: -0.15 }); k.play('slam', H.w2[1], { gain: 1.15, pan: 0.15 }); k.play('boom', H.w2[1], { gain: 0.5 });
  k.play('strike', H.strike, { gain: 1 });
  k.play('pop', H.need, { f: 520, gain: 0.6, soft: true });
  k.play('boom', H.reps, { gain: 1.1 }); k.play('slam', H.reps, { gain: 0.9 }); k.play('sparkle', H.reps + 0.05, { gain: 0.8 });
  k.play('marker', H.under, { dur: 0.22, gain: 0.8, soft: true });

  // cut 1 (whip right) and step 1: pick one game
  k.play('whoosh', CUTS[0].t - 0.04, { dur: 0.36, gain: 1, dir: 1 });
  k.play('pop', S.pill, { f: 900, gain: 0.7 });
  S.w.forEach((t, i) => k.play('slam', t, { gain: 0.6, pan: (i - 1) * 0.3 }));
  S.chips.forEach((t, i) => k.play('pop', t + 0.05, { f: 640 + i * 120, gain: 0.7, pan: px([290, 640, 990][i]) }));
  k.play('strike', S.drop, { gain: 0.45, pan: px(290) }); k.play('strike', S.drop + 0.03, { gain: 0.45, pan: px(990) });
  k.play('slam', S.pick, { gain: 0.8 }); k.play('shimmer', S.pick + 0.02, { gain: 0.9 });
  k.play('marker', S.ring, { dur: 0.38, gain: 0.7, soft: true });
  k.play('pop', S.just, { f: 600, gain: 0.55 }); k.play('marker', S.arrow, { dur: 0.25, gain: 0.55, pan: 0.4, soft: true });

  // cut 2 (glitch) and step 2: prize = sign-up
  k.play('glitch', CUTS[1].t, { gain: 1 });
  k.play('pop', B.pill, { f: 900, gain: 0.7 });
  k.play('slam', B.w[0], { gain: 0.65, pan: -0.5 }); k.play('slam', B.w[1], { gain: 0.6, pan: -0.5 }); k.play('slam', B.w[2], { gain: 0.75, pan: -0.4 });
  k.play('whoosh', B.br, { dur: 0.55, gain: 0.7, dir: -1, top: 2200 });
  k.play('pop', B.sub, { f: 480, gain: 0.35, soft: true, pan: -0.5 });
  B.cards.forEach((t, i) => k.play('pop', t + 0.06, { f: 700 + i * 110, gain: 0.6, pan: 0.3 + i * 0.12 }));
  k.play('tick', B.cards[2] + 0.4, { f: 4200, gain: 0.8, pan: 0.35 }); // consent tick
  k.play('marker', B.hl, { dur: 0.24, gain: 0.9, pan: -0.4 });
  k.play('whoosh', B.cur, { dur: 0.45, gain: 0.18, dir: -1, top: 1400, soft: true });
  k.play('click', B.click, { gain: 1, pan: 0.3 }); k.play('pop', B.click + 0.04, { f: 980, gain: 0.45, pan: 0.3 });
  { let last = -1; for (let i = 0; i < 12; i++) { const t = B.click + 0.1 + i * 0.1; if (t - last >= 1 / 12) { k.play('tick', t, { f: 3000 + i * 40, gain: 0.35 * (1 - i / 14), pan: 0.5, soft: true }); last = t; } } } // wheel clicks

  // cut 3 (vertical whip) and step 3: follow up
  k.play('whoosh', CUTS[2].t - 0.04, { dur: 0.34, gain: 1, dir: 1, top: 2600 });
  k.play('pop', Dm.pill, { f: 900, gain: 0.7 });
  k.play('whoosh', Dm.phone, { dur: 0.45, gain: 0.5, dir: 1, top: 1800, soft: true });
  k.play('slam', Dm.w[0], { gain: 0.6, pan: -0.5 }); k.play('slam', Dm.w[1], { gain: 0.65, pan: -0.5 }); k.play('slam', Dm.w[2], { gain: 0.65, pan: -0.5 });
  k.play('keys', Dm.type[0], { dur: Dm.type[1] - Dm.type[0], gain: 0.9, pan: 0.45 });
  k.play('send', Dm.send, { gain: 1, pan: 0.45 });
  { let last = -1, prev = dmCount(Dm.cnt[0] - 0.01); for (let t = Dm.cnt[0]; t <= Dm.cnt[1] + 0.01; t += 1 / 240) { const v = dmCount(t); if (v !== prev && t - last >= 1 / 12) { k.play('tick', t, { f: 3000 + v * 6, gain: 0.55, pan: -0.45, soft: true }); last = t; } prev = v; } }
  k.play('pop', Dm.cnt[1], { f: 1100, gain: 0.5, pan: -0.45 });
  k.play('tick', Dm.seen, { f: 5200, gain: 0.35, pan: 0.45, soft: true });
  k.play('ping', Dm.reply, { gain: 1.1, pan: 0.45 }); k.play('slam', Dm.reply, { gain: 0.45, pan: 0.45 });
  k.play('marker', Dm.ring, { dur: 0.35, gain: 0.6, pan: 0.4, soft: true });
  k.play('riser', CUTS[3].t - 0.55, { dur: 0.55, gain: 0.7 });

  // cut 4 (flash) and the math
  k.play('slam', CUTS[3].t + 0.06, { gain: 1 });
  M.w.forEach((t, i) => k.play('slam', t, { gain: i % 2 ? 0.45 : 0.7, pan: (i - 1.5) * 0.25 }));
  { let last = -1, prev = mathCount(M.cnt[0] - 0.01); for (let t = M.cnt[0]; t < M.lock - 0.12; t += 1 / 240) { const v = mathCount(t); if (v !== prev && t - last >= 1 / 12) { k.play('tick', t, { f: 2600 + v * 8, gain: 0.6, soft: true }); last = t; } prev = v; } }
  k.play('riser', M.cnt[0] + 0.2, { dur: M.lock - M.cnt[0] - 0.32, gain: 0.85 }); // ends just before the lock: a breath of near-silence
  k.play('boom', M.lock, { gain: 1.35 }); k.play('slam', M.lock, { gain: 1.1 }); k.play('shimmer', M.lock + 0.03, { gain: 1.2 }); k.play('sparkle', M.lock + 0.08, { gain: 1 });
  k.play('pop', M.conv, { f: 560, gain: 0.5 }); k.play('pop', M.sub, { f: 440, gain: 0.3, soft: true });

  // cut 5 (glitch) and the wrong move
  k.play('glitch', CUTS[4].t, { gain: 1 });
  X.w.forEach((t, i) => k.play('slam', t, { gain: 0.55, pan: (i - 1.5) * 0.2 }));
  k.play('tapeStop', X.strike[0], { gain: 1 });
  k.play('strike', X.strike[0], { gain: 0.9 }); k.play('strike', X.strike[1], { gain: 0.9 });
  k.play('stamp', X.stamp, { gain: 1.2, pan: 0.3 });

  // cut 6 (whip left) and the takeaway
  k.play('whoosh', CUTS[5].t - 0.04, { dur: 0.36, gain: 1, dir: -1 });
  k.play('boom', K.vol, { gain: 1.2 }); k.play('slam', K.vol, { gain: 1 });
  k.play('marker', K.hl, { dur: 0.26, gain: 1 });
  k.play('slam', K.w[0], { gain: 0.7, pan: -0.2 }); k.play('slam', K.w[1], { gain: 0.9, pan: 0.2 });
  k.play('pop', K.line, { f: 520, gain: 0.4, soft: true });
  k.play('shimmer', K.line + 0.05, { gain: 0.6 });
}

// =================================== STORYBOARD ===================================
const BOARD = [
  { a: 0, b: 2.6, still: 2.45, words: "YOU DON'T NEED MORE FOOTFALL. (struck out) / you need a reason to stay.", cam: 'Punch zoom on every word; biggest punch, shake and white flash on "a reason to stay."; yellow marker underline', trans: 'Cold open on the dark edit room', sfx: 'Drone and riser, a slam per word, strike, boom + slam + sparkle on the yellow line, marker' },
  { a: 2.6, b: 6.1, still: 5.75, words: 'STEP 01 · PICK ONE GAME · AR selfie / Spin the wheel / 60-sec quiz · just one.', cam: 'Slow push, then lean in on the chosen chip; other chips struck in grey; yellow ring and hand-drawn arrow', trans: 'Whip pan right with motion blur', sfx: 'Whoosh, pop for the STEP pill, three slams, chip pops, two strikes, slam + shimmer on the pick, marker for ring and arrow' },
  { a: 6.1, b: 10.0, still: 9.75, words: 'STEP 02 · PRIZE = SIGN-UP · name, number, consent tick · page: SPIN & WIN, Your name, Mobile number, I agree to get offers by SMS, SPIN NOW', cam: 'Sign-up page swings in with a 3D tilt; yellow swipe turns SIGN-UP dark; cursor clicks SPIN NOW and the wheel spins', trans: 'RGB glitch cut', sfx: 'Glitch, slams, whoosh for the page, pops per field, tick on the consent check, marker, click, wheel ticks' },
  { a: 10.0, b: 13.4, still: 13.2, words: 'STEP 03 · FOLLOW UP IN 24 HOURS. · follow-ups 200 · chat: "Hi! Your spin won 15% off. Code: SPIN15" / "Just used it. Thanks!"', cam: 'Phone slides up from below; message is typed and sent; phone shakes on the reply; yellow ring on the reply', trans: 'Vertical whip pan', sfx: 'Whoosh, slams, keys, send, counter ticks (max 12 a second), ping on the reply, marker, riser into the cut' },
  { a: 13.4, b: 16.6, still: 16.25, words: '500 × 40% = 200 · real leads · example: 500 visitors, 40% play', cam: 'Green counter rolls up and locks with the biggest punch zoom, shake, white flash, light leak and spark streaks', trans: 'Flash cut', sfx: 'Slam on the flash, slams, counter ticks, riser, a breath of near-silence, then boom + slam + shimmer + sparkle' },
  { a: 16.6, b: 18.45, still: 18.3, words: 'FREE PENS FOR EVERYONE? · NO.', cam: 'Red room glow; both lines get red strike-throughs; NO. stamp lands with a red flash and shake', trans: 'RGB glitch cut', sfx: 'Glitch, slams, tape stop (music cuts out), two strikes, stamp' },
  { a: 18.45, b: 21.5, still: 21.3, words: 'PLAY BEATS PRINT. · Design the reward before the booth.', cam: 'Punch zoom and light leak on PLAY; yellow swipe turns it dark; holds about 1.5 s', trans: 'Whip pan left', sfx: 'Whoosh, boom + slam, beat comes back, marker, two slams, soft pop + shimmer' },
];
const ASSUME = [
  '500 visitors and a 40% play rate are example figures, labelled as such on screen. 500 × 40% = 200.',
  'The follow-up counter climbs to 200 to match those 200 example leads.',
  '"Follow up within 24 hours" is common practice, not a measured rule.',
  '15% off, code SPIN15, play.yourbrand.co and "Lead #128" are made up.',
  'The consent line is placeholder wording. Real DPDP / GDPR notice text should come from the client\'s legal team.',
];

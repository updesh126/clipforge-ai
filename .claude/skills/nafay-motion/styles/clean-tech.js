// ---------- shared UI-style helpers (Clean Tech, Software Walkthrough, Data Story) ----------
const TOPIC = 'How a help-bot answers from your own docs';
const POSTER = 13.8;
const W = 1280, HH = 720;
const { clamp, lerp, span, rng, noise1, ez } = CM;
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
// keyframe track: K = [[t, v1, v2, ...], ...], eased in-out between keys
function track(K, t) {
  if (t <= K[0][0]) return K[0].slice(1);
  for (let i = 0; i < K.length - 1; i++) { const a = K[i], b = K[i + 1]; if (t <= b[0]) { const e = ez.inout3((t - a[0]) / Math.max(1e-6, b[0] - a[0])); return a.slice(1).map((v, j) => lerp(v, b[j + 1], e)); } }
  return K[K.length - 1].slice(1);
}
const textW = (c, s, font) => { c.save(); c.font = font; const w = c.measureText(s).width; c.restore(); return w; };
const pxOf = (font) => parseFloat(/(\d+)px/.exec(font)[1]);
// a word rises from behind a mask line into place; returns its width
function rise(c, s, x, y, font, color, t0, t, o = {}) {
  const w = textW(c, s, font); if (t < t0) return w;
  const px = pxOf(font), X = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x, e = ez.outExpo(span(t, t0, t0 + (o.dur || 0.5)));
  c.save(); c.beginPath(); c.rect(X - 12, y - px * 1.0, w + 24, px * 1.32); c.clip();
  c.globalAlpha *= Math.min(1, e * 1.6) * (o.alpha == null ? 1 : o.alpha); c.font = font; c.fillStyle = color; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.fillText(s, X, y + (1 - e) * px * 0.9); c.restore(); return w;
}
// a line of words, each rising on its own time. words: [[text, t0, color?]]
function riseLine(c, words, x, y, font, color, t, o = {}) {
  const sp = textW(c, ' ', font), ws = words.map(([s]) => textW(c, s, font)), tot = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let cx = o.align === 'center' ? x - tot / 2 : x; const boxes = [];
  words.forEach(([s, t0, col], i) => { boxes.push({ x: cx, w: ws[i], y }); rise(c, s, cx, y, font, col || color, t0, t, { alpha: o.alpha }); cx += ws[i] + sp; });
  return boxes;
}
// pill highlight behind a word box, growing from the left
function pillBehind(c, box, font, p, color, pad = 16) {
  if (p <= 0) return; const px = pxOf(font); c.save(); c.fillStyle = color; rr(c, box.x - pad, box.y - px * 0.88, (box.w + pad * 2) * ez.outExpo(p), px * 1.12, px * 0.26); c.fill(); c.restore();
}
const typed = (full, t, a, b) => full.slice(0, Math.floor(full.length * span(t, a, b)));
function softCard(c, x, y, w, h, r, o = {}) {
  c.save(); c.shadowColor = o.shadow || 'rgba(13,15,40,0.13)'; c.shadowBlur = o.blur == null ? 44 : o.blur; c.shadowOffsetY = o.offY == null ? 16 : o.offY;
  c.fillStyle = o.fill || '#ffffff'; rr(c, x, y, w, h, r); c.fill(); c.restore();
  if (o.border !== false) { c.save(); c.strokeStyle = o.border || 'rgba(13,15,20,0.08)'; c.lineWidth = 1.5; rr(c, x, y, w, h, r); c.stroke(); c.restore(); }
}
function cursorArrow(c, x, y, s = 1.3) {
  c.save(); c.translate(x, y); c.scale(s, s); c.shadowColor = 'rgba(0,0,0,0.3)'; c.shadowBlur = 6; c.shadowOffsetY = 2;
  c.fillStyle = '#111'; c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 22); c.lineTo(5.5, 17); c.lineTo(9.5, 26); c.lineTo(13, 24.5); c.lineTo(9, 15.5); c.lineTo(16, 15.5); c.closePath(); c.fill(); c.shadowColor = 'transparent'; c.stroke(); c.restore();
}
function checkMark(c, x, y, r, p, fill = '#18b46b') {
  if (p <= 0) return; const s = ez.back(clamp(p), 2.2); c.save(); c.translate(x, y); c.scale(s, s); c.fillStyle = fill; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = r * 0.24; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(-r * 0.42, 0.02 * r); c.lineTo(-r * 0.1, r * 0.32); c.lineTo(r * 0.45, -r * 0.3); c.stroke(); c.restore();
}
// scenes on transparent layers, with cuts between them
const LA = CM.layer(W, HH), LB = CM.layer(W, HH);
function sceneLayer(L, draw, t) { const x = L.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.clearRect(0, 0, W, HH); draw(x, t); return L; }
function composite(ctx, t, SCENES, CUTS, background) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  background(ctx, t);
  let idx = 0; for (const c of CUTS) if (t >= c.t) idx++;
  const cut = CUTS.find((c) => t >= c.t && t < c.t + c.d);
  if (!cut) { ctx.drawImage(sceneLayer(LA, SCENES[idx], t), 0, 0); return; }
  const u = (t - cut.t) / cut.d, e = ez.inout3(u), A = sceneLayer(LA, SCENES[idx - 1], t), B = sceneLayer(LB, SCENES[idx], t);
  if (cut.type === 'push') {
    const dir = cut.dir || 1, s = 1 - 0.05 * Math.sin(Math.PI * u);
    for (const [L, off] of [[A, -e * W * dir], [B, (1 - e) * W * dir]]) { ctx.save(); ctx.translate(640 + off, 360); ctx.scale(s, s); ctx.drawImage(L, -640, -360); ctx.restore(); }
  } else if (cut.type === 'zoom') {
    const z = lerp(1, 3.2, ez.in3(clamp(u / 0.65))); ctx.save(); ctx.globalAlpha = 1 - span(u, 0.38, 0.65); ctx.translate(cut.x, cut.y); ctx.scale(z, z); ctx.drawImage(A, -cut.x, -cut.y); ctx.restore();
    const zb = lerp(1.1, 1, ez.out3(span(u, 0.35, 1))); ctx.save(); ctx.globalAlpha = span(u, 0.35, 0.72); ctx.translate(640, 360); ctx.scale(zb, zb); ctx.drawImage(B, -640, -360); ctx.restore();
  } else if (cut.type === 'up') {
    ctx.save(); ctx.globalAlpha = 1 - e; ctx.drawImage(A, 0, -60 * e); ctx.restore(); ctx.save(); ctx.globalAlpha = e; ctx.drawImage(B, 0, 70 * (1 - e)); ctx.restore();
  } else { ctx.save(); ctx.globalAlpha = 1 - e; ctx.drawImage(A, 0, 0); ctx.globalAlpha = e; ctx.drawImage(B, 0, 0); ctx.restore(); }
}
// a soft synth pad and light percussion on the music bus (for scores)
function padBed(k, t0, t1, o = {}) {
  const bpm = o.bpm || 90, beat = 60 / bpm, bar = beat * 4, chords = o.chords, g = o.gain == null ? 1 : o.gain;
  let i = 0;
  for (let tb = t0; tb < t1 - 0.1; tb += bar, i++) {
    const ch = chords[i % chords.length], len = Math.min(bar, t1 - tb);
    ch.forEach((n, j) => { k.voice(tb, { type: 'triangle', f: n, dur: len + 0.4, gain: 0.026 * g, a: 0.5, hold: Math.max(0, len - 0.9), filter: 'lowpass', ff: o.cut || 1300, pan: (j - (ch.length - 1) / 2) * 0.3, verb: 0.3, bus: 'music' }); });
    k.voice(tb, { f: k.hz(ch[0]) / 2, dur: len + 0.2, gain: 0.05 * g, a: 0.3, hold: Math.max(0, len - 0.6), bus: 'music' });
    for (let b = 0; b < 8; b++) {
      const ts = tb + b * beat / 2; if (ts >= t1 - 0.05) break;
      if (o.hats && ts >= o.hats[0] && ts < o.hats[1]) k.hiss(ts, { dur: b % 2 ? 0.03 : 0.045, filter: 'highpass', ff: 8000, gain: (b % 2 ? 0.014 : 0.022) * g, bus: 'music' });
      if (o.kick && ts >= o.kick[0] && ts < o.kick[1] && (b === 0 || b === 4)) k.voice(ts, { f: [[0, 120], [0.09, 46]], dur: 0.26, gain: 0.16 * g, bus: 'music' });
    }
  }
}
// =====================================================================================================
// STYLE: Clean Tech
// Bright, calm product-explainer look: cool off-white with a dot grid, crisp Inter Tight that rises into place,
// white UI cards with soft shadows, one electric blue accent, mono labels, smooth push and zoom-through cuts.
// Topic: "How a help-bot answers from your own docs".
// =====================================================================================================
const C = { bg: '#f5f6f8', ink: '#0d0f14', mute: '#6b7280', faint: '#9aa1ad', line: '#e3e6ec', blue: '#2f5bff', blueSoft: '#e8edff', green: '#18b46b' };
const HEAD = (px) => `800 ${px}px "Inter Tight", system-ui, sans-serif`, BODY = (px, w = 500) => `${w} ${px}px "Inter Tight", system-ui, sans-serif`, MONO = (px) => `700 ${px}px "JetBrains Mono", ui-monospace, monospace`;
function wrapText(c, text, maxW) { const out = []; let line = ''; for (const wd of text.split(' ')) { const test = line ? line + ' ' + wd : wd; if (c.measureText(test).width > maxW && line) { out.push(line); line = wd; } else line = test; } if (line) out.push(line); return out; }

// ---------- the timeline: picture and sound both read these ----------
const TL = {
  D: 20,
  hook: { tag: 0.1, w1: [0.2, 0.32, 0.44], w2: [0.85, 0.97, 1.09], pill: 1.35 },
  agent: { head: 3.15, card: [3.2, 3.8], type: [3.85, 5.0], send: 5.05, move: [5.3, 5.95], nodes: [6.0, 6.2, 6.4], arcs: [6.5, 7.0], loop: [7.0, 10.6], period: 1.2, rows: [7.1, 7.25, 7.4], checks: [7.8, 9.0, 10.2] },
  result: { w: [11.7, 11.9], pill: 12.35, doc: [11.75, 12.35], answer: [12.5, 13.1], src: 13.2, cnt: [12.45, 13.6], badge: 13.95 },
  take: { w1: [16.2, 16.38], w2: [16.8, 17.0], pill: 17.25, note: 18.0 },
};
const CUTS = [{ t: 2.6, d: 0.5, type: 'push', dir: 1 }, { t: 11.0, d: 0.6, type: 'zoom', x: 330, y: 560 }, { t: 15.6, d: 0.5, type: 'push', dir: 1 }];
const BUMPS = [1.35, 12.35, 17.25];
const pageCount = (t) => Math.round(1240 * ez.out3(span(t, TL.result.cnt[0], TL.result.cnt[1])));
const fmtInt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const QUESTION = 'Can I return shoes after 30 days?';
const ANSWER = 'Yes. Unworn shoes can be returned within 45 days of delivery.';
const QUOTE = '“Unworn items can be returned within 45 days of delivery.”';

// ---------- background ----------
function background(c, t) {
  c.fillStyle = C.bg; c.fillRect(0, 0, W, HH);
  const g = c.createRadialGradient(1080 + Math.sin(t * 0.3) * 60, 80, 0, 1080, 80, 720); g.addColorStop(0, 'rgba(47,91,255,0.10)'); g.addColorStop(1, 'rgba(47,91,255,0)'); c.fillStyle = g; c.fillRect(0, 0, W, HH);
  const g2 = c.createRadialGradient(160, 680, 0, 160, 680, 600); g2.addColorStop(0, 'rgba(24,180,107,0.05)'); g2.addColorStop(1, 'rgba(24,180,107,0)'); c.fillStyle = g2; c.fillRect(0, 0, W, HH);
  c.fillStyle = 'rgba(13,15,20,0.085)'; const off = (t * 6) % 32;
  for (let y = 16; y < HH; y += 32) for (let x = 16 - off; x < W; x += 32) { c.beginPath(); c.arc(x, y, 1.4, 0, 7); c.fill(); }
}
// gentle push-in over each scene, and a small bump when a pill lands
function cam(c, t, a, b) { let z = 1 + 0.025 * ez.inout3(span(t, a, b)); for (const tb of BUMPS) { const d = t - tb; if (d > 0 && d < 1.2) z += 0.014 * Math.sin(Math.min(1, d / 0.25) * Math.PI / 2) * Math.exp(-d * 2.5); } c.translate(640, 360); c.scale(z, z); c.translate(-640, -360); }

// ---------- scene 0: hook ----------
function sceneHook(c, t) {
  const H = TL.hook; cam(c, t, 0, 2.6);
  c.save(); c.font = MONO(26); c.fillStyle = C.blue; c.letterSpacing = '4px'; c.textAlign = 'center'; c.globalAlpha = span(t, H.tag, H.tag + 0.3); c.fillText('THE DIFFERENCE', 640, 236); c.restore();
  const F = HEAD(110);
  riseLine(c, [['Most', H.w1[0]], ['bots', H.w1[1]], ['guess.', H.w1[2]]], 640, 360, F, C.ink, t, { align: 'center' });
  const p = span(t, H.pill, H.pill + 0.35), b2 = riseLine(c, [['Good', H.w2[0]], ['bots', H.w2[1]], ['check.', H.w2[2], p > 0.6 ? '#fff' : C.ink]], 640, 494, F, C.ink, t, { align: 'center' });
  if (p > 0) { pillBehind(c, b2[2], F, p, C.blue); rise(c, 'check.', b2[2].x, 494, F, '#fff', H.w2[2], t); }
}
// ---------- scene 1: the answer loop ----------
const LOOP = { P: [890, 190], A: [1095, 400], K: [890, 610] };
const quadPts = (a, q, b, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const u = i / n, v = 1 - u; return [v * v * a[0] + 2 * v * u * q[0] + u * u * b[0], v * v * a[1] + 2 * v * u * q[1] + u * u * b[1]]; });
const ARCS = [quadPts(LOOP.P, [1070, 230], LOOP.A), quadPts(LOOP.A, [1070, 590], LOOP.K), quadPts(LOOP.K, [720, 400], LOOP.P)];
const LOOP_PATH = [...ARCS[0], ...ARCS[1].slice(1), ...ARCS[2].slice(1)];
function promptCard(c, cx, cy, s, t, alpha) {
  const A = TL.agent, w = 820, h = 150;
  c.save(); c.globalAlpha = alpha; c.translate(cx, cy); c.scale(s, s); c.translate(-w / 2, -h / 2);
  softCard(c, 0, 0, w, h, 26);
  c.font = MONO(22); c.fillStyle = C.mute; c.letterSpacing = '3px'; c.fillText('CUSTOMER', 40, 48); c.letterSpacing = '0px';
  const s1 = typed(QUESTION, t, A.type[0], A.type[1]);
  c.font = BODY(30); c.fillStyle = C.ink; c.fillText(s1, 40, 102);
  if (t > A.type[0] - 0.3 && t < A.send && Math.floor(t * 2.4) % 2 === 0) { const cw = c.measureText(s1).width; c.fillStyle = C.blue; c.fillRect(44 + cw, 76, 3, 32); }
  const k = t > A.send ? 1 - 0.12 * Math.sin(Math.PI * span(t, A.send, A.send + 0.2)) : 1;
  c.save(); c.translate(w - 70, h / 2); c.scale(k, k); c.fillStyle = C.blue; c.beginPath(); c.arc(0, 0, 30, 0, 7); c.fill();
  c.strokeStyle = '#fff'; c.lineWidth = 4; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(0, 12); c.lineTo(0, -11); c.moveTo(-9, -2); c.lineTo(0, -11); c.lineTo(9, -2); c.stroke(); c.restore();
  if (t > A.send) { const r = span(t, A.send, A.send + 0.6); if (r < 1) { c.strokeStyle = `rgba(47,91,255,${1 - r})`; c.lineWidth = 3; c.beginPath(); c.arc(w - 70, h / 2, 30 + 44 * r, 0, 7); c.stroke(); } }
  c.restore();
}
function node(c, [x, y], label, sub, t0, t, glow) {
  const s = ez.back(span(t, t0, t0 + 0.4), 2); if (s <= 0) return;
  c.save(); c.translate(x, y); c.scale(s, s);
  if (glow > 0) { c.shadowColor = `rgba(47,91,255,${0.5 * glow})`; c.shadowBlur = 40; }
  softCard(c, -105, -40, 210, 80, 20, { border: glow > 0.3 ? 'rgba(47,91,255,0.7)' : undefined });
  c.fillStyle = C.blueSoft; c.beginPath(); c.arc(-62, 0, 20, 0, 7); c.fill(); c.fillStyle = C.blue; c.beginPath(); c.arc(-62, 0, 7 + 3 * glow, 0, 7); c.fill();
  c.font = MONO(18); c.fillStyle = C.faint; c.letterSpacing = '2px'; c.fillText(sub, -30, -6); c.letterSpacing = '0px';
  c.font = BODY(30, 700); c.fillStyle = C.ink; c.fillText(label, -30, 26); c.restore();
}
function sceneAgent(c, t) {
  const A = TL.agent; cam(c, t, 3.1, 11.0);
  c.save(); c.globalAlpha = 1 - span(t, A.move[0] - 0.1, A.move[0] + 0.2); rise(c, 'A customer asks.', 640, 230, HEAD(84), C.ink, A.head, t, { align: 'center' }); c.restore();
  const enter = ez.outExpo(span(t, A.card[0], A.card[1])), [cx, cy, s] = track([[A.move[0], 640, 380, 1], [A.move[1], 350, 240, 0.7]], t);
  if (enter > 0) promptCard(c, cx, cy + (1 - enter) * 300, s, t, Math.min(1, enter * 1.5));
  const ap = span(t, A.arcs[0], A.arcs[1]);
  if (ap > 0) {
    c.save(); c.strokeStyle = 'rgba(47,91,255,0.55)'; c.lineWidth = 3; c.lineCap = 'round'; c.setLineDash([2, 11]); c.lineDashOffset = -t * 40;
    ARCS.forEach((P) => { const m = Math.max(2, Math.ceil(P.length * ap)); c.beginPath(); P.slice(0, m).forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }); c.restore();
    c.save(); c.font = MONO(22); c.fillStyle = C.blue; c.globalAlpha = 0.7 * ap; c.letterSpacing = '3px'; c.textAlign = 'center'; c.fillText('ANSWER LOOP', 880, 408); c.restore();
  }
  let near = [0, 0, 0];
  if (t > A.loop[0] && t < A.loop[1]) {
    const u = ((t - A.loop[0]) / A.period) % 1, q = LOOP_PATH[Math.min(LOOP_PATH.length - 1, Math.floor(u * (LOOP_PATH.length - 1)))];
    near = [Math.max(0, 1 - Math.min(u, 1 - u) * 8), Math.max(0, 1 - Math.abs(u - 1 / 3) * 8), Math.max(0, 1 - Math.abs(u - 2 / 3) * 8)];
    const g = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 34); g.addColorStop(0, 'rgba(47,91,255,0.45)'); g.addColorStop(1, 'rgba(47,91,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(q[0], q[1], 34, 0, 7); c.fill();
    c.fillStyle = C.blue; c.beginPath(); c.arc(q[0], q[1], 9, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(q[0], q[1], 3.5, 0, 7); c.fill();
  }
  node(c, LOOP.P, 'Search', 'STEP 1', A.nodes[0], t, near[0]); node(c, LOOP.A, 'Read', 'STEP 2', A.nodes[1], t, near[1]); node(c, LOOP.K, 'Cite', 'STEP 3', A.nodes[2], t, near[2]);
  if (t > A.rows[0] - 0.1) {
    const e = ez.outExpo(span(t, A.rows[0] - 0.1, A.rows[0] + 0.4)); c.save(); c.globalAlpha = e; c.translate(0, (1 - e) * 30);
    softCard(c, 90, 390, 500, 250, 24); c.font = MONO(22); c.fillStyle = C.mute; c.letterSpacing = '3px'; c.fillText('TASKS', 124, 434); c.letterSpacing = '0px';
    ['Search 1,240 help pages', 'Find the returns policy', 'Quote the exact line'].forEach((s, i) => {
      const y = 492 + i * 56, a = span(t, A.rows[i], A.rows[i] + 0.25), done = t > A.checks[i]; if (a <= 0) return; c.save(); c.globalAlpha *= a;
      c.strokeStyle = C.line; c.lineWidth = 2.5; c.beginPath(); c.arc(140, y - 9, 14, 0, 7); c.stroke();
      checkMark(c, 140, y - 9, 15, span(t, A.checks[i], A.checks[i] + 0.3), C.green);
      c.font = BODY(28, 600); c.fillStyle = done ? C.mute : C.ink; c.fillText(s, 172, y); c.restore();
    });
    c.restore();
  }
}
// ---------- scene 2: the cited answer ----------
function sceneResult(c, t) {
  const R = TL.result; cam(c, t, 11.6, 15.6);
  const F = HEAD(78), p = span(t, R.pill, R.pill + 0.35);
  const b1 = riseLine(c, [['It', R.w[0]], ['cites', R.w[0] + 0.1, p > 0.6 ? '#fff' : C.ink]], 80, 236, F, C.ink, t);
  if (p > 0) { pillBehind(c, b1[1], F, p, C.blue, 14); rise(c, 'cites', b1[1].x, 236, F, '#fff', R.w[0] + 0.1, t); }
  riseLine(c, [['its', R.w[1]], ['source.', R.w[1] + 0.08]], 80, 330, F, C.ink, t);
  if (t > R.cnt[0] - 0.2) {
    c.save(); c.globalAlpha = span(t, R.cnt[0] - 0.2, R.cnt[0]); c.font = MONO(24); c.fillStyle = C.mute; c.letterSpacing = '3px'; c.fillText('PAGES SEARCHED', 84, 448); c.letterSpacing = '0px';
    const done = t > R.cnt[1], pop = done ? 1 + 0.1 * Math.sin(Math.PI * span(t, R.cnt[1], R.cnt[1] + 0.3)) : 1;
    c.translate(84, 580); c.scale(pop, pop); c.font = HEAD(140); c.fillStyle = C.blue; c.fillText(fmtInt(pageCount(t)), 0, 0);
    c.font = BODY(30, 600); c.fillStyle = C.mute; c.fillText(done ? 'for one question' : '', 4, 46); c.restore();
  }
  // the answer card
  const e = ez.outExpo(span(t, R.doc[0], R.doc[1])); if (e <= 0) return;
  c.save(); c.globalAlpha = Math.min(1, e * 1.4); c.translate((1 - e) * 360, 0);
  const x = 560, y = 110, w = 640, h = 520; softCard(c, x, y, w, h, 26);
  c.font = HEAD(36); c.fillStyle = C.ink; c.fillText('Help-bot answer', x + 40, y + 70);
  const fin = t > R.badge, tag = fin ? 'CITED' : 'DRAFT'; c.font = MONO(18); c.letterSpacing = '2px'; const tw = c.measureText(tag).width + 28;
  c.fillStyle = fin ? '#e3f6ec' : C.blueSoft; rr(c, x + w - 40 - tw, y + 44, tw, 34, 17); c.fill(); c.fillStyle = fin ? C.green : C.blue; c.fillText(tag, x + w - 26 - tw, y + 67); c.letterSpacing = '0px';
  c.fillStyle = C.line; c.fillRect(x + 40, y + 100, w - 80, 1.5);
  c.font = MONO(18); c.fillStyle = C.faint; c.letterSpacing = '2px'; c.fillText('QUESTION', x + 40, y + 138); c.fillText('ANSWER', x + 40, y + 222); c.letterSpacing = '0px';
  c.font = BODY(26, 500); c.fillStyle = C.mute; c.fillText(QUESTION, x + 40, y + 174);
  c.font = BODY(28, 600); c.fillStyle = C.ink; wrapText(c, typed(ANSWER, t, R.answer[0], R.answer[1]), w - 80).forEach((l, i) => c.fillText(l, x + 40, y + 260 + i * 36));
  // the source it quotes
  const se = ez.outExpo(span(t, R.src, R.src + 0.45));
  if (se > 0) { c.save(); c.globalAlpha *= se; c.translate(0, (1 - se) * 24);
    c.fillStyle = '#f3f5ff'; rr(c, x + 40, y + 334, w - 80, 116, 14); c.fill(); c.fillStyle = C.blue; rr(c, x + 40, y + 334, 6, 116, 3); c.fill();
    c.font = MONO(18); c.fillStyle = C.blue; c.letterSpacing = '2px'; c.fillText('SOURCE · RETURNS POLICY §2', x + 66, y + 368); c.letterSpacing = '0px';
    c.font = BODY(26, 500); c.fillStyle = C.ink; wrapText(c, QUOTE, w - 130).forEach((l, i) => c.fillText(l, x + 66, y + 404 + i * 32));
    c.restore(); }
  if (fin) { const s = ez.back(span(t, R.badge, R.badge + 0.35), 2.2); c.save(); c.translate(x + w - 30, y + h - 22); c.scale(s, s); c.fillStyle = C.green; rr(c, -170, -30, 170, 52, 26); c.fill(); checkMark(c, -140, -4, 14, 1, '#ffffff22'); c.font = BODY(26, 700); c.fillStyle = '#fff'; c.fillText('Cited', -116, 5); c.restore(); }
  c.restore();
}
// ---------- scene 3: takeaway ----------
function sceneTake(c, t) {
  const K = TL.take; cam(c, t, 16.1, 20);
  const F = HEAD(104);
  riseLine(c, [['Stop', K.w1[0]], ['guessing.', K.w1[1]]], 640, 316, F, C.faint, t, { align: 'center' });
  const p = span(t, K.pill, K.pill + 0.35), b = riseLine(c, [['Start', K.w2[0]], ['citing.', K.w2[1], p > 0.6 ? '#fff' : C.ink]], 640, 446, F, C.ink, t, { align: 'center' });
  if (p > 0) { pillBehind(c, b[1], F, p, C.blue); rise(c, 'citing.', b[1].x, 446, F, '#fff', K.w2[1], t); }
  if (t > K.note) { c.save(); const e = ez.outExpo(span(t, K.note, K.note + 0.5)); c.globalAlpha = e; c.font = MONO(28); c.fillStyle = C.blue; c.textAlign = 'center'; c.letterSpacing = '2px'; c.fillText('answer = question + your docs + source', 640, 560 + (1 - e) * 16); c.restore(); }
}
const SCENES = [sceneHook, sceneAgent, sceneResult, sceneTake];
function explainer(ctx, t) {
  composite(ctx, t, SCENES, CUTS, background);
  const v = ctx.createRadialGradient(640, 360, 380, 640, 360, 820); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,24,40,0.07)'); ctx.fillStyle = v; ctx.fillRect(0, 0, W, HH);
}

// =================================== SOUND SCORE ===================================
// Airy and precise: a soft pad with light hats, small glassy ticks as words rise, clean swipes for the blue pills,
// soft keyboard and a send blip, pops for cards, a quiet chime per finished task, and smooth pushes between scenes.
function scoreSound(k) {
  { const k0 = k, G = 2.1; k = Object.assign({}, k0, { voice: (t, p) => k0.voice(t, Object.assign({}, p, { gain: (p.gain == null ? 0.3 : p.gain) * G })), hiss: (t, p) => k0.hiss(t, Object.assign({}, p, { gain: (p.gain == null ? 0.3 : p.gain) * G })), play: (n, t, o = {}) => k0.play(n, t, Object.assign({}, o, { gain: (o.gain == null ? 1 : o.gain) * G })) }); } // overall level
  const H = TL.hook, A = TL.agent, R = TL.result, K = TL.take;
  const rise1 = (t, pan = 0, g = 1) => { k.voice(t, { f: [[0, 760], [0.05, 1150]], dur: 0.07, gain: 0.07 * g, pan, soft: true }); k.hiss(t, { dur: 0.012, filter: 'highpass', ff: 6000, gain: 0.05 * g, pan, soft: true }); };
  const swipe = (t, pan = 0) => { k.hiss(t, { dur: 0.24, filter: 'bandpass', ff: [[0, 2400], [0.22, 6200]], q: 1.2, gain: 0.14, a: 0.08, pan }); k.voice(t + 0.12, { f: 'E6', dur: 0.5, gain: 0.05, verb: 0.35, pan }); };
  const chime = (t, pan = 0) => { k.voice(t, { f: 'C6', dur: 0.5, gain: 0.08, a: 0.003, verb: 0.3, pan }); k.voice(t + 0.07, { f: 'G6', dur: 0.6, gain: 0.07, a: 0.003, verb: 0.3, pan }); };
  padBed(k, 0.1, TL.D - 0.2, { bpm: 92, gain: 1, cut: 1400, chords: [['F3', 'A3', 'C4', 'E4'], ['D3', 'F3', 'A3', 'C4'], ['Bb2', 'D3', 'F3', 'A3'], ['C3', 'E3', 'G3', 'B3']], hats: [2.6, 15.6], kick: [3.1, 15.6] });
  // hook
  H.w1.concat(H.w2).forEach((t, i) => rise1(t, (i % 2 ? 0.2 : -0.2)));
  swipe(H.pill, 0.15);
  // scene pushes
  k.play('whoosh', CUTS[0].t, { dur: 0.5, gain: 0.55, dir: 1, top: 2400 }); k.play('whoosh', CUTS[2].t, { dur: 0.5, gain: 0.55, dir: 1, top: 2400 });
  // the question and the loop
  rise1(A.head); k.play('whoosh', A.card[0], { dur: 0.5, gain: 0.25, dir: 1, top: 1500, soft: true });
  k.play('keys', A.type[0], { dur: A.type[1] - A.type[0], gain: 0.8, pan: 0 }); k.play('send', A.send, { gain: 1 });
  k.hiss(A.move[0], { color: 'pink', dur: 0.6, filter: 'bandpass', ff: [[0, 500], [0.3, 1600], [0.6, 600]], q: 0.8, gain: 0.08, a: 0.25, pan: [0.2, -0.4] });
  A.nodes.forEach((t, i) => k.play('pop', t + 0.06, { f: 700 + i * 140, gain: 0.55, pan: [0.4, 0.7, 0.4][i] }));
  k.hiss(A.arcs[0], { dur: A.arcs[1] - A.arcs[0], filter: 'bandpass', ff: [[0, 1500], [0.5, 3500]], q: 1.4, gain: 0.05, a: 0.2, pan: 0.5, soft: true });
  for (let t = A.loop[0]; t < A.loop[1] - 0.05; t += A.period / 3) k.play('tick', t, { f: 5200, gain: 0.3, pan: 0.5, soft: true });
  A.rows.forEach((t) => k.play('tick', t, { f: 3600, gain: 0.35, pan: -0.4, soft: true }));
  A.checks.forEach((t) => chime(t, -0.35));
  // zoom through into the answer
  k.play('riser', CUTS[1].t - 0.5, { dur: 0.55, gain: 0.45 }); k.play('whoosh', CUTS[1].t + 0.1, { dur: 0.45, gain: 0.45, dir: -1, top: 3000 });
  rise1(R.w[0], -0.4); rise1(R.w[0] + 0.1, -0.4); [0, 0.08].forEach((d) => rise1(R.w[1] + d, -0.4, 0.8));
  swipe(R.pill, -0.35);
  k.play('whoosh', R.doc[0], { dur: 0.5, gain: 0.3, dir: -1, top: 1800, soft: true });
  k.play('keys', R.answer[0], { dur: R.answer[1] - R.answer[0], gain: 0.5, pan: 0.4 });
  k.play('pop', R.src + 0.05, { f: 820, gain: 0.5, pan: 0.4 });
  { let last = -1, lt = -1; for (let t = R.cnt[0]; t <= R.cnt[1]; t += 1 / 120) { const v = pageCount(t); if (v !== last && v > 0 && t - lt >= 1 / 14) { k.play('tick', t, { f: 2600 + v * 1.2, gain: 0.45, pan: -0.5, soft: true }); last = v; lt = t; } } }
  k.play('pop', R.cnt[1], { f: 980, gain: 0.5, pan: -0.5 });
  chime(R.badge, 0.45); k.voice(R.badge + 0.14, { f: 'C7', dur: 0.7, gain: 0.05, a: 0.003, verb: 0.35, pan: 0.45 });
  // takeaway: a short gap after "Stop guessing." before the pill
  K.w1.concat(K.w2).forEach((t, i) => rise1(t, 0, i < 2 ? 0.7 : 1));
  swipe(K.pill, 0.1);
  ['F4', 'A4', 'C5', 'E5'].forEach((n, i) => k.voice(K.pill + 0.15 + i * 0.06, { f: n, dur: 1.6, gain: 0.05, a: 0.01, verb: 0.4, pan: (i - 1.5) * 0.25 }));
  rise1(K.note, 0, 0.6);
}

// =================================== STORYBOARD ===================================
const BOARD = [
  { a: 0, b: 2.6, still: 2.45, words: 'THE DIFFERENCE · Most bots guess. / Good bots check.', cam: 'Gentle push-in; blue pill grows behind "check." and the word turns white, small camera bump', trans: 'Opens on the off-white dot grid', sfx: 'Glassy tick per rising word, clean swipe with a bell note on the pill; no pad yet' },
  { a: 2.6, b: 5.3, still: 5.2, words: 'A customer asks. · CUSTOMER: Can I return shoes after 30 days?', cam: 'Prompt card slides up; question is typed with a blinking caret, then sent', trans: 'Clean horizontal push', sfx: 'Whoosh, pad and hats come in, soft keys, send blip' },
  { a: 5.3, b: 7.1, still: 7.08, words: 'ANSWER LOOP · Search (STEP 1) · Read (STEP 2) · Cite (STEP 3)', cam: 'Card shrinks to the corner; nodes pop in; dashed arcs draw between them', trans: 'Same scene, continuous', sfx: 'Soft air sweep, three pops, a light shimmer as the arcs draw' },
  { a: 7.1, b: 11.0, still: 10.45, words: 'TASKS · Search 1,240 help pages · Find the returns policy · Quote the exact line', cam: 'Blue dot travels the loop three times; each lap ticks a task off with a green check', trans: 'Same scene, continuous', sfx: 'Tick at each node, tick per task row, two-note chime per check' },
  { a: 11.0, b: 13.95, still: 13.85, words: 'It cites its source. · PAGES SEARCHED 1,240 · for one question · answer card: Yes. Unworn shoes can be returned within 45 days of delivery. · SOURCE · RETURNS POLICY §2', cam: 'Blue pill on "cites"; counter climbs; answer types in; source box slides up', trans: 'Zoom-through into the task card', sfx: 'Short riser then whoosh, ticks for words, swipe, keys, pop for the source, counter ticks, pop when it lands' },
  { a: 13.95, b: 15.6, still: 15.45, words: 'Tag turns DRAFT → CITED · green "Cited" badge', cam: 'Green badge pops in with overshoot; gentle push continues', trans: 'Same scene, continuous', sfx: 'Two-note chime plus a high bell' },
  { a: 15.6, b: 20, still: 19.8, words: 'Stop guessing. / Start citing. · answer = question + your docs + source', cam: 'Blue pill on "citing." with a camera bump; holds about 1.5 s', trans: 'Clean horizontal push', sfx: 'Whoosh, hats and kick drop out, ticks, short gap, swipe + soft four-note chord' },
];
const ASSUME = [
  'The 45-day returns policy, "Returns policy §2" and the 1,240 help pages are invented examples. No brand name appears on screen.',
  'Search, read, cite is a simplified picture of a retrieval-grounded bot. Real bots also rank results and should say "I don\'t know" when nothing matches.',
  'No speed or accuracy figures are shown, so none are claimed.',
];

// =====================================================================================================
// STYLE: Chalkboard
// Dusty chalk on a long green slate. Every stroke and letter is chalked on in sequence by a visible stick,
// the grain of the board breaks the strokes, dust falls from the tip, the camera tracks along the board,
// numbers are re-chalked as they count, and a felt eraser wipes a section clean for the next idea.
// Topic: "Why a scratched QR code still scans".
// =====================================================================================================
const TOPIC = 'Why a scratched QR code still scans';
const POSTER = 15.0;
const W = 1280, HH = 720;
const { clamp, lerp, span, rng, noise1, ez } = CM;
const BW = 2700; // board width in world units (the board is one long slate, 720 tall)
const C = { slate: '#24392f', chalk: '#f2efe6', yellow: '#f4d35e', pink: '#f39bbb', blue: '#93cbef', dim: 'rgba(242,239,230,0.55)' };
const F = { head: '"Cabin Sketch", "Comic Sans MS", cursive', hand: '"Kalam", "Segoe Print", cursive' };
const head = (px) => `700 ${px}px ${F.head}`, hand = (px, w = 700) => `${w} ${px}px ${F.hand}`;

// ---------- the timeline: picture and sound both read these ----------
const BARS = [['L', 7, 12.55], ['M', 15, 13.1], ['Q', 25, 13.65], ['H', 30, 14.2]]; // level, % it can lose, start time
const TL = {
  D: 21.8,
  title1: [0.25, 1.3], title2: [1.35, 2.0], under: [2.05, 2.35],
  qr: [2.5, 3.7],
  eq1: [3.85, 4.65], eq2: [4.75, 5.5], lab0: [5.55, 5.95],
  scratch: [6.1, 6.6], lab1: [6.65, 7.1],
  eq3: [7.2, 7.9], cnt: [8.0, 9.3], ring1: [9.4, 9.8], lab2: [9.85, 10.25],
  arrow: [10.3, 10.75],
  yAxis: [11.65, 11.9], xAxis: [11.9, 12.15], axLab: [12.15, 12.5],
  ring2: [14.85, 15.2], note: [15.3, 15.85],
  wipe: [16.2, 17.2],
  take1: [17.4, 18.2], take2: [18.25, 19.0], take3: [19.1, 19.5], note2: [19.65, 20.2],
};
// camera keys: [t, centerX, centerY, zoom]
const CAM = [[0, 640, 360, 1], [2.4, 640, 360, 1], [3.1, 600, 400, 1.08], [7.6, 600, 400, 1.08], [8.1, 660, 420, 1.1], [9.9, 660, 420, 1.1], [10.3, 640, 370, 1], [10.8, 640, 370, 1], [11.6, 1950, 370, 1], [16.0, 1950, 370, 1], [21.8, 1950, 360, 1.05]];
function camAt(t) {
  if (t <= CAM[0][0]) return CAM[0].slice(1);
  for (let i = 0; i < CAM.length - 1; i++) { const a = CAM[i], b = CAM[i + 1]; if (t <= b[0]) { const e = ez.inout3((t - a[0]) / (b[0] - a[0])); return [lerp(a[1], b[1], e), lerp(a[2], b[2], e), Math.exp(lerp(Math.log(a[3]), Math.log(b[3]), e))]; } }
  return CAM[CAM.length - 1].slice(1);
}
const applyCam = (c, k) => { c.translate(640, 360); c.scale(k[2], k[2]); c.translate(-k[0], -k[1]); };
const toScreen = (k, x, y) => [(x - k[0]) * k[2] + 640, (y - k[1]) * k[2] + 360];

// shared value curve (picture and sound): the share of data a level-H code can lose, re-chalked 10 times a second
const cntStep = (t) => Math.floor(Math.max(0, t - TL.cnt[0]) * 10);
const cntVal = (t) => { const u = ez.out3(span(Math.min(t, TL.cnt[0] + cntStep(t) / 10), TL.cnt[0], TL.cnt[1])); return 30 * u; };
const cntText = (t) => (t >= TL.cnt[1] ? '30%' : Math.round(cntVal(t)) + '%');

// ---------- 2D value noise (for the slate) ----------
function noise2(seed) {
  const r = rng(seed), N = 256, g = new Float32Array(N * N); for (let i = 0; i < g.length; i++) g[i] = r() * 2 - 1;
  const at = (x, y) => g[((y & 255) << 8) | (x & 255)];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v); };
}

// ---------- the board: baked once ----------
let BOARD_L = null;
function board() {
  if (BOARD_L) return BOARD_L;
  const L = CM.layer(BW, HH), c = L.getContext('2d'), img = c.createImageData(BW, HH), d = img.data, n1 = noise2(5), n2 = noise2(9), r = rng('slate');
  for (let y = 0; y < HH; y++) for (let x = 0; x < BW; x++) {
    const v = 1 + 0.07 * n1(x / 140, y / 140) + 0.04 * n2(x / 22, y / 22) + (r() - 0.5) * 0.07 - 0.08 * (y / HH);
    const i = (y * BW + x) * 4; d[i] = 36 * v; d[i + 1] = 58 * v; d[i + 2] = 47 * v; d[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  // ghosts of earlier lessons, then smeared by old eraser passes
  c.save(); c.globalAlpha = 0.07; c.fillStyle = C.chalk;
  [['x² − 4x + 4 = 0', 930, 90, 34], ['a² + b² = c²', 120, 690, 30], ['f(x) = 2x + 1', 1540, 110, 32], ['∑ n = n(n+1)/2', 2280, 680, 30], ['HW: p. 214', 860, 655, 30], ['y = mx + b', 2350, 120, 34]]
    .forEach(([s, x, y, px]) => { c.font = hand(px, 400); c.fillText(s, x, y); });
  c.restore();
  const rs = rng('smear'); c.save(); c.lineCap = 'round'; c.filter = 'blur(9px)';
  for (let i = 0; i < 70; i++) { const x = rs.in(-100, BW), y = rs.in(40, 700), len = rs.in(160, 460); c.strokeStyle = `rgba(215,228,218,${rs.in(0.018, 0.045)})`; c.lineWidth = rs.in(36, 90); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + len / 2, y + rs.in(-30, 30), x + len, y + rs.in(-20, 20)); c.stroke(); }
  c.restore();
  BOARD_L = L; return L;
}
// board tooth: specks that chalk skips over (punched out of the chalk layer)
let TOOTH = null;
function tooth() {
  if (TOOTH) return TOOTH;
  const L = CM.layer(384, 384), c = L.getContext('2d'), img = c.createImageData(384, 384), r = rng('tooth'), n = noise2(31);
  for (let y = 0; y < 384; y++) for (let x = 0; x < 384; x++) { const v = 0.5 + 0.5 * n(x / 3.2, y / 3.2), a = v > 0.62 ? (v - 0.62) * 2.4 : 0; const i = (y * 384 + x) * 4; img.data[i + 3] = Math.min(255, 255 * (a + (r() < 0.06 ? 0.55 : 0))); }
  c.putImageData(img, 0, 0); TOOTH = L; return L;
}

// ---------- chalk drawing primitives ----------
const resample = (pts, step = 3) => { const out = [pts[0]]; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step)); for (let j = 1; j <= n; j++) out.push([lerp(x0, x1, j / n), lerp(y0, y1, j / n)]); } return out; };
const quad = (a, q, b, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const u = i / n, v = 1 - u; return [v * v * a[0] + 2 * v * u * q[0] + u * u * b[0], v * v * a[1] + 2 * v * u * q[1] + u * u * b[1]]; });
const ellipse = (cx, cy, rx, ry, a0 = -2.5, turns = 1.12, n = 70) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (i / n) * turns * Math.PI * 2, k = 1 + 0.04 * Math.sin(i * 0.31); return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]; });
let TIP = null; // where the chalk stick is right now (world coords)

// a chalk stroke: wobbly, slightly broken, drawn on to progress p
function chalkLine(c, it, p) {
  if (p <= 0) return;
  const P = it._P || (it._P = (() => { const n = noise1(it.seed), raw = resample(it.pts, 3); let len = 0; return raw.map((q, i) => { if (i) len += Math.hypot(q[0] - raw[i - 1][0], q[1] - raw[i - 1][1]); const o = n(len * 0.02) * 1.4; return [q[0] + o, q[1] - o * 0.6, len]; }); })());
  const m = Math.max(2, Math.ceil(P.length * Math.min(1, p))), gap = noise1(it.seed + 7);
  c.save(); c.strokeStyle = it.col; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [w, a, dx] of [[it.w, 0.92, 0], [it.w * 0.55, 0.45, it.w * 0.35]]) {
    c.lineWidth = w; c.globalAlpha = a; c.beginPath(); let pen = false;
    for (let i = 0; i < m; i++) { const q = P[i], skip = gap(q[2] * 0.09) > 0.8; if (skip) { pen = false; continue; } pen ? c.lineTo(q[0] + dx, q[1] - dx) : c.moveTo(q[0] + dx, q[1] - dx); pen = true; }
    c.stroke();
  }
  c.restore();
  if (p < 1) TIP = [P[m - 1][0], P[m - 1][1]];
}
// chalk lettering: parts are runs of text, each with its own font and vertical shift (for exponents)
function layoutText(c, it) {
  if (it._L) return it._L;
  const chars = []; let x = 0;
  for (const part of it.parts) { c.font = part.font; for (const ch of part.s) { const w = c.measureText(ch).width; chars.push({ ch, x, w, font: part.font, dy: part.dy || 0, col: part.col }); x += w; } }
  const x0 = it.align === 'center' ? it.x - x / 2 : it.align === 'right' ? it.x - x : it.x;
  return (it._L = { chars, x0, w: x });
}
function chalkText(c, it, p) {
  if (p <= 0) return;
  const L = layoutText(c, it), n = L.chars.length, shown = Math.min(n, p * n), r = rng('tx' + it.seed);
  c.save(); c.textBaseline = 'alphabetic';
  L.chars.forEach((g, i) => {
    const jy = r.in(-2, 2), jr = r.in(-0.05, 0.05); if (i >= shown) return; const a = Math.min(1, shown - i);
    c.save(); c.translate(L.x0 + g.x + g.w / 2, it.y + g.dy + jy); c.rotate(jr); c.font = g.font; c.textAlign = 'center';
    c.globalAlpha = 0.95 * a; c.fillStyle = g.col || it.col; c.fillText(g.ch, 0, 0);
    c.globalAlpha = 0.5 * a; c.strokeStyle = g.col || it.col; c.lineWidth = 1.4; c.strokeText(g.ch, 0.6, -0.4);
    c.restore();
  });
  c.restore();
  if (p < 1) { const g = L.chars[Math.min(n - 1, Math.floor(shown))]; TIP = [L.x0 + g.x + g.w * (shown % 1), it.y + g.dy - 18]; }
}

// ---------- the lesson, as timed chalk items ----------
let SEEDN = 0;
const A = (k, a, extra) => Object.assign({ k, a: a[0], b: a[1], col: C.chalk, seed: ((a[0] * 1000) | 0) + 7 * SEEDN++ }, extra);
const gx0 = 1440, gy = (v) => 625 - (v / 35) * 430; // chart scale: 0..35 % up the y axis
const barCx = (i) => 1600 + i * 230;
// the QR code: real finder and timing patterns, decorative data
const QX = 110, QY = 300, QM = 15;
const QR = (() => {
  const N = 21, m = [], r = rng('qrdata');
  for (let y = 0; y < N; y++) { m.push([]); for (let x = 0; x < N; x++) m[y].push(r() < 0.48 ? 1 : 0); }
  const finder = (ox, oy) => { for (let y = -1; y <= 7; y++) for (let x = -1; x <= 7; x++) { const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= N || Y >= N) continue; const ring = x === 0 || x === 6 || y === 0 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4; m[Y][X] = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (ring || core) ? 1 : 0; } };
  finder(0, 0); finder(14, 0); finder(0, 14);
  for (let i = 8; i <= 12; i++) { m[6][i] = i % 2 ? 0 : 1; m[i][6] = i % 2 ? 0 : 1; }
  m[13][8] = 1; // the fixed dark module
  const dark = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (m[y][x]) dark.push([x, y]);
  return dark;
})();
function drawQR(c, t) {
  const p = span(t, TL.qr[0], TL.qr[1]); if (p <= 0) return;
  const n = QR.length, shown = p * n, r = rng('qrj');
  c.save(); c.fillStyle = C.chalk;
  QR.forEach(([x, y], i) => { const jx = r.in(-1, 1), jy = r.in(-1, 1), a = r.in(0.78, 0.95); if (i >= shown) return; c.globalAlpha = a * Math.min(1, shown - i); c.fillRect(QX + x * QM + 0.8 + jx, QY + y * QM + 0.8 + jy, QM - 1.6, QM - 1.6); });
  c.restore();
  if (p < 1) { const q = QR[Math.min(n - 1, Math.floor(shown))]; TIP = [QX + q[0] * QM + QM, QY + q[1] * QM]; }
}
const ITEMS = [
  // section A: the hook, the QR, the equations
  A('text', TL.title1, { parts: [{ s: 'Why a scratched QR', font: head(96) }], x: 90, y: 140 }),
  A('text', TL.title2, { parts: [{ s: 'still scans.', font: head(96) }], x: 90, y: 240, col: C.pink }),
  A('line', TL.under, { pts: [[88, 266], [300, 261], [560, 268]], col: C.yellow, w: 7 }),
  A('text', TL.eq1, { parts: [{ s: 'size = 4v + 17', font: hand(64) }], x: 520, y: 380 }),
  A('text', TL.eq2, { parts: [{ s: '4×1 + 17 = 21', font: hand(64) }], x: 520, y: 478 }),
  A('text', TL.lab0, { parts: [{ s: '← version 1', font: hand(40, 400) }], x: 960, y: 474, col: C.blue }),
  A('line', TL.scratch, { pts: Array.from({ length: 13 }, (_, i) => [180 + i * 16, 480 - i * 3 + (i % 2 ? 30 : -30)]), col: C.pink, w: 9 }),
  A('text', TL.lab1, { parts: [{ s: 'still scans!', font: hand(40, 400) }], x: 110, y: 668, col: C.blue }),
  A('text', TL.eq3, { parts: [{ s: 'can lose up to', font: hand(60) }], x: 520, y: 590 }),
  A('line', TL.ring1, { pts: ellipse(1005, 566, 98, 54), col: C.pink, w: 5 }),
  A('text', TL.lab2, { parts: [{ s: 'of its data', font: hand(40, 400) }], x: 944, y: 652, col: C.blue }),
  A('line', TL.arrow, { pts: quad([1110, 520], [1220, 400], [1360, 330], 50), w: 5 }),
  A('line', [TL.arrow[1], TL.arrow[1] + 0.12], { pts: [[1326, 318], [1360, 330], [1338, 360]], w: 5 }),
  // section B: the chart (erased later)
  A('line', TL.yAxis, { pts: [[gx0, 625], [gx0, 190]], w: 5, tag: 'B' }),
  A('line', TL.xAxis, { pts: [[1430, 625], [2470, 625]], w: 5, tag: 'B' }),
  A('text', TL.axLab, { parts: [{ s: 'can lose', font: hand(40) }], x: 1400, y: 170, tag: 'B' }),
  ...[10, 20, 30].map((v, i) => A('text', [TL.axLab[0] + 0.1 * i, TL.axLab[0] + 0.1 * i + 0.15], { parts: [{ s: v + '%', font: hand(36, 400) }], x: 1425, y: gy(v) + 12, align: 'right', tag: 'B' })),
  ...[10, 20, 30].map((v, i) => A('line', [TL.axLab[0] + 0.1 * i, TL.axLab[0] + 0.1 * i + 0.08], { pts: [[1432, gy(v)], [1448, gy(v)]], w: 4, tag: 'B' })),
  ...BARS.flatMap(([lv, v, t0], i) => { const cx = barCx(i), col = lv === 'H' ? C.yellow : C.chalk; return [
    A('text', [t0, t0 + 0.12], { parts: [{ s: lv, font: hand(44) }], x: cx, y: 672, align: 'center', tag: 'B' }),
    A('line', [t0 + 0.12, t0 + 0.42], { pts: [[cx - 60, 625], [cx - 60, gy(v)], [cx + 60, gy(v)], [cx + 60, 625]], col, w: 5, tag: 'B' }),
    A('text', [t0 + 0.42, t0 + 0.55], { parts: [{ s: v + '%', font: hand(44) }], x: cx, y: gy(v) - 16, align: 'center', col, tag: 'B' }),
  ]; }),
  A('line', TL.ring2, { pts: ellipse(barCx(3), gy(30) - 30, 74, 40), col: C.pink, w: 5, tag: 'B' }),
  A('text', TL.note, { parts: [{ s: 'more spare data = more squares', font: hand(40, 400) }], x: 1955, y: 120, align: 'center', col: C.blue, tag: 'B' }),
  // section B after the wipe: the takeaway
  A('text', TL.take1, { parts: [{ s: 'Spare data', font: head(112) }], x: 1950, y: 300, align: 'center' }),
  A('text', TL.take2, { parts: [{ s: 'saves the scan.', font: head(124) }], x: 1950, y: 452, align: 'center', col: C.yellow }),
  A('line', TL.take3, { pts: [[1490, 482], [1950, 474], [2410, 484]], col: C.pink, w: 6 }),
  A('line', [TL.take3[0] + 0.12, TL.take3[1] + 0.05], { pts: [[1530, 500], [1960, 494], [2380, 502]], col: C.pink, w: 4 }),
  A('text', TL.note2, { parts: [{ s: 'scuffed signs? print at level H', font: hand(40, 400) }], x: 1950, y: 566, align: 'center', col: C.blue }),
];
// the counter is re-chalked on its own
function drawCounter(c, t) {
  if (t < TL.cnt[0]) return;
  const s = cntText(t), it = { parts: [{ s, font: head(76) }], x: 944, y: 592, col: C.pink, seed: 9000 + cntStep(t), _L: null };
  chalkText(c, it, Math.min(1, (t - TL.cnt[0] - cntStep(t) / 10) / 0.06 + 0.35));
}

// ---------- eraser wipe over section B ----------
const WIPE = (() => { const pts = [], x0 = 1390, x1 = 2540, y0 = 100, y1 = 690, rows = 6; for (let r = 0; r <= rows; r++) { const y = lerp(y0, y1, r / rows); pts.push(r % 2 ? [x1, y] : [x0, y], r % 2 ? [x0, y + 12] : [x1, y + 12]); } return resample(pts, 14); })();
function wipeMask(c, p) {
  const m = Math.max(2, Math.ceil(WIPE.length * p)); c.save(); c.globalCompositeOperation = 'destination-out'; c.lineCap = 'round'; c.lineJoin = 'round';
  const sweep = (w, a, dy) => { c.lineWidth = w; c.strokeStyle = `rgba(0,0,0,${a})`; c.beginPath(); WIPE.slice(0, m).forEach(([x, y], i) => (i ? c.lineTo(x, y + dy) : c.moveTo(x, y + dy))); c.stroke(); };
  sweep(110, 0.9, 0); sweep(30, 0.9, -38); sweep(30, 0.9, 38); c.restore();
  return WIPE[m - 1];
}

// ---------- props in screen space: frame, tray, chalk stick, eraser, dust ----------
function wood(c, x, y, w, h, light) {
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, light ? '#b07a45' : '#8a5a31'); g.addColorStop(0.5, '#9a6738'); g.addColorStop(1, '#5f3b1e');
  c.fillStyle = g; c.fillRect(x, y, w, h);
  c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.strokeStyle = 'rgba(50,25,8,0.28)'; c.lineWidth = 1;
  for (let k = 0; k < 6; k++) { c.beginPath(); for (let s = 0; s <= 80; s++) { const px = x + (s / 80) * w, py = y + 3 + k * (h / 6) + Math.sin(s * 0.37 + k * 2) * 1.2; s ? c.lineTo(px, py) : c.moveTo(px, py); } c.stroke(); }
  c.restore();
}
function chalkStick(c, x, y, col) {
  c.save(); c.translate(x, y); c.rotate(0.62);
  c.save(); c.filter = 'blur(6px)'; c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.roundRect(10, 8, 120, 22, 10); c.fill(); c.restore();
  const g = c.createLinearGradient(0, -11, 0, 11); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(150,150,140,1)');
  c.fillStyle = g; c.beginPath(); c.moveTo(4, -9); c.lineTo(118, -11); c.quadraticCurveTo(126, 0, 118, 11); c.lineTo(4, 9); c.quadraticCurveTo(-4, 0, 4, -9); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(14, -6, 90, 3);
  c.restore();
}
function eraser(c, x, y) {
  c.save(); c.translate(x, y); c.rotate(-0.06);
  c.save(); c.filter = 'blur(8px)'; c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(-74, -18, 160, 66); c.restore();
  wood(c, -80, -34, 160, 40, true); c.fillStyle = '#e9e4d6'; c.fillRect(-80, 6, 160, 18); c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(-80, 20, 160, 4);
  c.restore();
}
function tray(c, t, hideEraser) {
  wood(c, 0, 0, W, 20, true); c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, 20, W, 5);
  const g = c.createLinearGradient(0, HH - 46, 0, HH); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)'); c.fillStyle = g; c.fillRect(0, HH - 80, W, 80);
  wood(c, 0, HH - 34, W, 34, false); c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, HH - 34, W, 3);
  c.fillStyle = 'rgba(240,236,226,0.12)'; for (let i = 0; i < 40; i++) { const r = rng('dust' + i); c.fillRect(r.in(0, W), HH - 33 + r.in(0, 6), r.in(2, 14), 1.5); }
  [[880, '#f2efe6', 70], [960, '#f4d35e', 46], [1010, '#f39bbb', 58]].forEach(([x, col, len]) => { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x + 2, HH - 26, len, 13); c.fillStyle = col; c.beginPath(); c.roundRect(x, HH - 29, len, 12, 5); c.fill(); });
  if (!hideEraser) { c.save(); c.translate(180, HH - 40); c.scale(0.8, 0.8); eraser(c, 0, 0); c.restore(); }
}
// dust that falls from the chalk while it draws (a pure function of t)
function dust(c, t, k) {
  c.save(); c.fillStyle = 'rgba(240,236,226,0.8)';
  for (const it of ITEMS) {
    if (t < it.a || t > it.b + 0.9) continue;
    const r = rng('du' + it.seed);
    for (let ts = it.a; ts < Math.min(t, it.b); ts += 0.045) {
      const age = t - ts; if (age > 0.9) { r(); r(); continue; }
      const u = (ts - it.a) / (it.b - it.a); let x, y;
      if (it.k === 'line') { const P = it._P; if (!P) continue; const q = P[Math.min(P.length - 1, Math.floor(u * (P.length - 1)))]; x = q[0]; y = q[1]; }
      else { const L = it._L; if (!L) continue; x = L.x0 + L.w * u; y = it.y - 6; }
      const dx = r.in(-8, 8), sz = r.in(0.8, 2.2); const [sx, sy] = toScreen(k, x + dx + age * 6, y + 40 * age + 120 * age * age);
      c.globalAlpha = 0.55 * (1 - age / 0.9); c.fillRect(sx, sy, sz, sz);
    }
  }
  c.restore();
}

// ---------- compositor ----------
const LC = CM.layer(W, HH), LB2 = CM.layer(W, HH), HALO = CM.layer(W / 4, HH / 4);
function explainer(ctx, t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  const k = camAt(t); TIP = null;
  ctx.save(); applyCam(ctx, k); ctx.drawImage(board(), 0, 0); ctx.restore();
  const a = LC.getContext('2d'), b = LB2.getContext('2d');
  for (const L of [a, b]) { L.setTransform(1, 0, 0, 1, 0, 0); L.globalCompositeOperation = 'source-over'; L.globalAlpha = 1; L.clearRect(0, 0, W, HH); }
  a.save(); applyCam(a, k); b.save(); applyCam(b, k);
  drawQR(a, t);
  for (const it of ITEMS) { const p = span(t, it.a, it.b), L = it.tag === 'B' ? b : a; if (it.k === 'line') chalkLine(L, it, p); else chalkText(L, it, p); }
  drawCounter(a, t);
  let eraserAt = null;
  if (t > TL.wipe[0]) { const p = ez.inout3(span(t, TL.wipe[0], TL.wipe[1])); const e = wipeMask(b, p); if (p < 1) eraserAt = toScreen(k, e[0], e[1]); TIP = null; }
  a.restore(); b.restore();
  a.drawImage(LB2, 0, 0);
  a.save(); a.globalCompositeOperation = 'destination-out'; a.globalAlpha = 0.85;
  const pat = a.createPattern(tooth(), 'repeat'); pat.setTransform(new DOMMatrix().translateSelf(640 - k[0] * k[2], 360 - k[1] * k[2]).scaleSelf(k[2], k[2])); a.fillStyle = pat; a.fillRect(0, 0, W, HH); a.restore();
  { const hc = HALO.getContext('2d'); hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, W / 4, HH / 4); hc.drawImage(LC, 0, 0, W / 4, HH / 4); ctx.save(); ctx.globalAlpha = 0.35; ctx.imageSmoothingEnabled = true; ctx.drawImage(HALO, 0, 0, W, HH); ctx.restore(); }
  ctx.drawImage(LC, 0, 0);
  if (t > TL.wipe[0]) { ctx.save(); applyCam(ctx, k); ctx.globalAlpha = 0.6 * span(t, TL.wipe[0], TL.wipe[1]); ctx.filter = 'blur(10px)'; ctx.strokeStyle = 'rgba(215,228,218,0.06)'; ctx.lineWidth = 90; ctx.lineCap = 'round'; ctx.beginPath(); WIPE.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.restore(); }
  dust(ctx, t, k);
  const lg = ctx.createRadialGradient(560, 120, 80, 640, 300, 900); lg.addColorStop(0, 'rgba(255,250,230,0.07)'); lg.addColorStop(1, 'rgba(0,0,0,0.32)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, HH);
  tray(ctx, t, !!eraserAt);
  if (eraserAt) eraser(ctx, eraserAt[0], eraserAt[1]);
  else if (TIP) { const [sx, sy] = toScreen(k, TIP[0], TIP[1]); const active = ITEMS.filter((it) => t > it.a && t < it.b).pop(); chalkStick(ctx, sx, sy, active ? active.col : C.chalk); }
  else if (t > TL.cnt[0] && t < TL.cnt[1]) { const [sx, sy] = toScreen(k, 1010, 570); chalkStick(ctx, sx + 30, sy, C.pink); }
  const fi = Math.floor(t * 12), r = rng('gr' + (fi % 6)); ctx.save(); ctx.globalAlpha = 0.05; ctx.globalCompositeOperation = 'overlay'; const gp = ctx.createPattern(tooth(), 'repeat'); gp.setTransform(new DOMMatrix().translateSelf(-r() * 384, -r() * 384)); ctx.fillStyle = gp; ctx.fillRect(0, 0, W, HH); ctx.restore();
}

// =================================== SOUND SCORE ===================================
// A quiet classroom. Chalk scratches for every word and stroke, a dense tapping run while the QR squares go on,
// a felt eraser rubbing back and forth, a soft wooden knock at the start, and gentle plucks for the big moments.
function scoreSound(k) {
  const G = 1.9; // overall level for this quiet medium
  const px = (t, x) => { const c = camAt(t); return clamp(((x - c[0]) * c[2]) / 640, -1, 1) * 0.6; };
  const tap = (t, pan = 0, g = 1) => { k.hiss(t, { dur: 0.018, filter: 'bandpass', ff: 2600, q: 2.2, gain: 0.32 * g * G, a: 0.001, pan, soft: true }); k.voice(t, { f: [[0, 1100], [0.015, 600]], dur: 0.02, gain: 0.05 * g * G, pan, soft: true }); };
  const scratch = (a, b, pan = 0, g = 1, soft = true) => { const r = CM.rng('ch' + a); tap(a, pan, g * 0.9); for (let x = a; x < b; x += 0.018 + r() * 0.02) { if (r() < 0.12) continue; const d = 0.02 + r() * 0.025; k.hiss(x, { dur: d, filter: 'bandpass', ff: 2400 + r() * 2200, q: 1.3, gain: (0.12 + r() * 0.1) * g * G, a: d * 0.3, pan, soft }); } };
  const write = (s, a, b, pan, g = 1, soft = true) => { const n = s.length, re = /\S+/g; let m; while ((m = re.exec(s))) scratch(a + (b - a) * (m.index / n), a + (b - a) * ((m.index + m[0].length) / n), pan, g, soft); };
  const pluck = (t, note, g = 1, pan = 0) => { const f = k.hz(note); k.voice(t, { f, dur: 0.9, gain: 0.16 * g * G, a: 0.004, verb: 0.3, pan }); k.voice(t, { f: f * 4, dur: 0.08, gain: 0.03 * g, a: 0.001, pan }); k.voice(t, { f: f * 2, type: 'triangle', dur: 0.3, gain: 0.04 * g, a: 0.003, pan }); };
  const textOf = (it) => it.parts.map((p) => p.s).join('');

  k.hiss(0, { color: 'brown', dur: TL.D, filter: 'lowpass', ff: 300, gain: 0.07, a: 0.6, hold: TL.D - 1.2, bus: 'amb' }); // room tone
  k.voice(0.05, { f: [[0, 190], [0.06, 120]], dur: 0.09, gain: 0.22 * G }); k.voice(0.15, { f: [[0, 200], [0.06, 125]], dur: 0.09, gain: 0.18 * G }); // knock knock

  // every chalk item: words get a scratch each, lines one long scratch (rings and underlines a little louder)
  for (const it of ITEMS) {
    const mid = (it.a + it.b) / 2, x = it.k === 'text' ? (it.align === 'center' ? it.x : it.x + 120) : (it.pts[0][0] + it.pts[it.pts.length - 1][0]) / 2, pan = px(mid, x);
    const big = it.col === C.pink || it.col === C.yellow, title = it.parts && /Cabin/.test(it.parts[0].font);
    if (it.k === 'text') write(textOf(it), it.a, it.b, pan, title ? 1 : it.col === C.blue ? 0.7 : 0.9, !title);
    else scratch(it.a, it.b, pan, big ? 1.2 : 1, !big);
  }
  // the QR squares: quick dabs, one per few squares
  { const r = CM.rng('qrs'); for (let t = TL.qr[0]; t < TL.qr[1]; t += 0.03 + r() * 0.02) tap(t, px(t, 260) + r.in(-0.1, 0.1), 0.55 + r() * 0.3); }
  // counter re-chalked ten times a second; a scratch only when the number changes
  { let last = ''; for (let t = TL.cnt[0]; t <= TL.cnt[1] + 0.001; t += 0.1) { const s = cntText(t + 0.001); if (s !== last) { scratch(t, t + 0.05, px(t, 1000), 0.8); last = s; } } }
  pluck(TL.cnt[1], 'E5', 1.1, 0.2); pluck(TL.cnt[1] + 0.09, 'B5', 0.9, 0.2);
  pluck(TL.lab1[1] - 0.1, 'G4', 0.7, -0.4); // "still scans!"
  k.hiss(10.8, { color: 'pink', dur: 0.8, filter: 'lowpass', ff: [[0, 300], [0.4, 900], [0.8, 300]], gain: 0.07, a: 0.35 }); // camera slides along the board
  pluck(BARS[3][2] + 0.55, 'G4', 1, 0.4); pluck(BARS[3][2] + 0.65, 'D5', 0.9, 0.4); pluck(BARS[3][2] + 0.75, 'G5', 0.7, 0.4); // the H bar lands
  // felt eraser: back and forth passes, panned with the eraser
  { const rows = 6, d = (TL.wipe[1] - TL.wipe[0]) / (rows + 1); for (let i = 0; i <= rows; i++) { const t0 = TL.wipe[0] + i * d, dir = i % 2 ? 1 : -1; k.hiss(t0, { color: 'pink', dur: d + 0.02, filter: 'bandpass', ff: 700 + (i % 2) * 120, q: 0.7, gain: 0.26 * G, a: d * 0.25, hold: d * 0.4, pan: [-0.5 * dir, 0.5 * dir] }); k.hiss(t0, { color: 'brown', dur: d, filter: 'lowpass', ff: 400, gain: 0.12 * G, a: d * 0.3 }); } }
  pluck(TL.take3[1], 'C5', 1, -0.2); pluck(TL.take3[1] + 0.1, 'E5', 0.9, 0); pluck(TL.take3[1] + 0.2, 'G5', 0.9, 0.2); pluck(TL.take3[1] + 0.32, 'C6', 0.7, 0.1);
  tap(TL.note2[1] + 0.25, 0.3, 1.2); // the chalk goes back in the tray
}

// =================================== STORYBOARD ===================================
const BOARD = [
  { a: 0, b: 2.5, still: 2.42, words: 'Why a scratched QR / still scans.', cam: 'Wide on the first stretch of slate; yellow underline under the pink line', trans: 'Opens on the board with a double knock', sfx: 'Knock knock, a chalk scratch per word, longer scratch for the underline' },
  { a: 2.5, b: 6.1, still: 5.98, words: 'QR code chalked square by square · size = 4v + 17 · 4×1 + 17 = 21 · ← version 1', cam: 'Leans in gently (1.08×) on the QR and the maths', trans: 'Same board, continuous', sfx: 'Quick chalk dabs for the squares, a scratch per word of each equation' },
  { a: 6.1, b: 9.9, still: 9.88, words: 'Pink scratch across the code · still scans! · can lose up to 30% (ringed) · of its data', cam: 'Leans further in (1.1×) toward the counter; number is re-chalked as it climbs 0% → 30%, then ringed in pink', trans: 'Same board, continuous', sfx: 'Long pink scratch, soft pluck on "still scans!", a short scratch each time the number changes, two plucks when it lands, louder ring scratch' },
  { a: 9.9, b: 11.65, still: 11.2, words: 'Chalk arrow leading right', cam: 'Pulls back to 1× and tracks along the slate to a clean stretch', trans: 'Camera track along the same board', sfx: 'Arrow scratch, soft slide of air as the camera moves' },
  { a: 11.65, b: 14.85, still: 14.8, words: 'Bar chart to scale: can lose 10% / 20% / 30% · L 7% · M 15% · Q 25% · H 30% (yellow)', cam: 'Static wide on the chart while each bar is drawn', trans: 'Same board, continuous', sfx: 'Axis scratches, a scratch per label and bar, three rising plucks when H lands' },
  { a: 14.85, b: 16.2, still: 16.1, words: 'Pink ring round H 30% · more spare data = more squares', cam: 'Holds on the chart', trans: 'Same board, continuous', sfx: 'Louder ring scratch, scratches for the blue note' },
  { a: 16.2, b: 17.4, still: 16.72, words: '(felt eraser wipes the chart)', cam: 'Holds; eraser sweeps back and forth leaving a haze', trans: 'Eraser wipe on the same board', sfx: 'Felt swish per pass, panned with the eraser' },
  { a: 17.4, b: 21.8, still: 21.6, words: 'Spare data / saves the scan. · double pink underline · scuffed signs? print at level H', cam: 'Slow lean-in to 1.05×; takeaway holds about 1.6 s', trans: 'Written into the cleared space', sfx: 'Title scratches, underline scratches, rising four-note arpeggio, chalk back in the tray' },
];
const ASSUME = [
  'QR error-correction levels L, M, Q and H can restore about 7%, 15%, 25% and 30% of the code\'s data. These are the standard\'s nominal figures; the chart is drawn to that scale.',
  'A version-v QR code is 4v + 17 squares (modules) a side, so version 1 is 21 × 21.',
  '"Can lose up to 30%" is true only at level H, and only if the three big corner squares (finder patterns) survive. The pink scratch avoids them.',
  'The QR drawn is decorative: its finder and timing patterns are real, but the data squares are random and will not scan.',
  '"More spare data = more squares": for the same content, a higher level needs a bigger code.',
];

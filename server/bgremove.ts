/**
 * Background removal for flat illustrations (no AI model needed):
 *   1. find the background colour from the image border
 *   2. flood-fill inward from the edges through pixels close to that colour → transparent
 *      (so white *inside* the drawing — eyes, a football's white patches — is kept)
 *   3. soften the edge and remove the background tint from edge pixels (no white halo)
 *   4. trim, then place the subject bottom-centre on a square transparent canvas — same layout
 *      as ClipForge's drawn assets, so it stands on the ground line in Story videos
 * Photos and full scenes (busy borders) are detected and returned as "scene" without cutting.
 */
import sharp from 'sharp';

export interface Cutout {
  png: Buffer;
  kind: 'sprite' | 'scene';
  removed: number; // fraction of pixels made transparent
  note?: string;
}

export interface CutoutOptions {
  size?: number; // square canvas for sprites
  tolerance?: number; // 0-255 colour distance treated as background
  margin?: number; // fraction of canvas kept free at top and sides
  holes?: boolean; // also clear enclosed background gaps (trees, ladders, fences, bicycles…)
}

export async function cutout(input: string | Buffer, opts: CutoutOptions = {}): Promise<Cutout> {
  const size = opts.size ?? 1024;
  const tol = opts.tolerance ?? 34;
  const margin = opts.margin ?? 0.04;
  const img = sharp(input).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const px = (i: number) => i * 4;

  // already transparent? just trim + normalise
  let transparent = 0;
  for (let i = 0; i < W * H; i++) if (data[px(i) + 3] < 250) transparent++;
  if (transparent / (W * H) > 0.02) return { png: await normalise(data, W, H, size, margin), kind: 'sprite', removed: transparent / (W * H), note: 'had transparency' };

  // 1. background colour = most common (quantised) border colour
  const border: number[] = [];
  for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1);
  const counts = new Map<number, number>();
  for (const i of border) {
    const k = ((data[px(i)] >> 3) << 10) | ((data[px(i) + 1] >> 3) << 5) | (data[px(i) + 2] >> 3);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // up to 3 background colours (a baked-in "fake transparency" checkerboard has two)
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const bgs = ranked
    .filter(([, n], idx) => idx === 0 || n / border.length >= 0.12)
    .slice(0, 3)
    .map(([k]) => [((k >> 10) & 31) * 8 + 4, ((k >> 5) & 31) * 8 + 4, (k & 31) * 8 + 4]);
  const bg = bgs[0];
  const distTo = (i: number, c: number[]) => Math.max(Math.abs(data[px(i)] - c[0]), Math.abs(data[px(i) + 1] - c[1]), Math.abs(data[px(i) + 2] - c[2]));
  const plainDist = (i: number) => Math.min(...bgs.map((c) => distTo(i, c)));

  // Checkerboard ("fake transparency") backgrounds: a pixel only counts as background when BOTH checker
  // colours occur within a small window around it — so a solid white patch on a white object is not eaten.
  let patterned: Uint8Array | null = null;
  if (bgs.length >= 2) {
    const r = Math.max(6, Math.round(Math.min(W, H) * 0.02));
    const integral = (c: number[]) => {
      const I = new Int32Array((W + 1) * (H + 1));
      for (let y = 0; y < H; y++) {
        let row = 0;
        for (let x = 0; x < W; x++) {
          row += distTo(y * W + x, c) <= tol ? 1 : 0;
          I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row;
        }
      }
      return I;
    };
    const A = integral(bgs[0]);
    const B = integral(bgs[1]);
    const box = (I: Int32Array, x: number, y: number) => {
      const xa = Math.max(0, x - r);
      const ya = Math.max(0, y - r);
      const xb = Math.min(W, x + r + 1);
      const yb = Math.min(H, y + r + 1);
      return I[yb * (W + 1) + xb] - I[ya * (W + 1) + xb] - I[yb * (W + 1) + xa] + I[ya * (W + 1) + xa];
    };
    patterned = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) patterned[y * W + x] = box(A, x, y) > 0 && box(B, x, y) > 0 ? 1 : 0;
  }
  const dist = (i: number) => (patterned && !patterned[i] ? 255 : plainDist(i));
  const uniform = border.filter((i) => dist(i) <= tol).length / border.length;
  if (uniform < 0.55) return { png: await sharp(input).png().toBuffer(), kind: 'scene', removed: 0, note: 'busy border — kept as a scene' };

  // 2. flood fill from the border
  const isBg = new Uint8Array(W * H);
  const stack: number[] = [];
  for (const i of border) if (!isBg[i] && dist(i) <= tol) {
    isBg[i] = 1;
    stack.push(i);
  }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % W;
    const y = (i - x) / W;
    const n = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
    for (const j of n) if (j >= 0 && !isBg[j] && dist(j) <= tol) {
      isBg[j] = 1;
      stack.push(j);
    }
  }
  // Enclosed gaps not reached from the edge:
  //  • checkerboard images: a region made of BOTH checker colours is fake transparency → remove
  //    (a ball's solid white patch has only one colour, so it stays)
  //  • plain backgrounds: only when the subject really has see-through gaps (opts.holes — trees, ladders, fences…),
  //    and only perfectly flat regions (shaded whites like a chef's coat stay)
  const checker = bgs.length >= 2;
  if (checker || opts.holes) {
    const tight = checker ? tol : 10;
    const seen = new Uint8Array(W * H);
    const minHole = Math.max(250, W * H * 0.0004);
    const nearest = (i: number) => {
      let best = 0;
      for (let c = 1; c < bgs.length; c++) if (distTo(i, bgs[c]) < distTo(i, bgs[best])) best = c;
      return distTo(i, bgs[best]) <= tight ? best : -1;
    };
    for (let s = 0; s < W * H; s++) {
      if (isBg[s] || seen[s] || nearest(s) < 0) continue;
      const comp: number[] = [s];
      const perColour = new Array(bgs.length).fill(0);
      seen[s] = 1;
      for (let k = 0; k < comp.length; k++) {
        const i = comp[k];
        perColour[nearest(i)]++;
        const x = i % W;
        const y = (i - x) / W;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1])
          if (j >= 0 && !seen[j] && !isBg[j] && nearest(j) >= 0) {
            seen[j] = 1;
            comp.push(j);
          }
      }
      if (comp.length < minHole) continue;
      const mixed = perColour.filter((n) => n / comp.length >= 0.15).length >= 2;
      if ((checker && mixed) || (!checker && opts.holes)) for (const i of comp) isBg[i] = 1;
    }
  }

  let removed = 0;
  for (let i = 0; i < W * H; i++) if (isBg[i]) {
    data[px(i) + 3] = 0;
    removed++;
  }
  if (removed / (W * H) < 0.05) return { png: await sharp(input).png().toBuffer(), kind: 'scene', removed: 0, note: 'almost no background — kept as a scene' };

  // 3. soft, de-haloed edges: pixels touching the background get partial alpha + background tint removed
  for (let i = 0; i < W * H; i++) {
    if (isBg[i]) continue;
    const x = i % W;
    const y = (i - x) / W;
    const touches = (x > 0 && isBg[i - 1]) || (x < W - 1 && isBg[i + 1]) || (y > 0 && isBg[i - W]) || (y < H - 1 && isBg[i + W]);
    if (!touches) continue;
    const d = dist(i);
    const a = Math.max(0.15, Math.min(1, (d - tol * 0.5) / (tol * 2.5)));
    for (let c = 0; c < 3; c++) data[px(i) + c] = Math.max(0, Math.min(255, Math.round((data[px(i) + c] - (1 - a) * bg[c]) / a)));
    data[px(i) + 3] = Math.round(a * 255);
  }

  const specks = keepMainSubject(data, W, H);
  const notes = [checker ? 'checkerboard background — review' : '', specks ? `dropped ${specks} stray mark(s) away from the subject` : ''].filter(Boolean);
  return { png: await normalise(data, W, H, size, margin), kind: 'sprite', removed: removed / (W * H), note: notes.join('; ') || undefined };
}

/**
 * Keep the subject: the largest opaque piece plus anything sizeable or close to it.
 * Small detached marks far from the subject (stray dots, corner stamps) are dropped so the sprite trims tightly.
 */
function keepMainSubject(data: Buffer, W: number, H: number): number {
  const label = new Int32Array(W * H).fill(-1);
  const comps: Array<{ size: number; x0: number; y0: number; x1: number; y1: number }> = [];
  for (let s = 0; s < W * H; s++) {
    if (label[s] >= 0 || data[s * 4 + 3] <= 24) continue;
    const id = comps.length;
    const c = { size: 0, x0: W, y0: H, x1: 0, y1: 0 };
    const q = [s];
    label[s] = id;
    while (q.length) {
      const i = q.pop() as number;
      const x = i % W;
      const y = (i - x) / W;
      c.size++;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (label[j] < 0 && data[j * 4 + 3] > 24) {
            label[j] = id;
            q.push(j);
          }
        }
    }
    comps.push(c);
  }
  if (comps.length < 2) return 0;
  const main = comps.reduce((a, b) => (b.size > a.size ? b : a));
  const padX = (main.x1 - main.x0) * 0.08;
  const padY = (main.y1 - main.y0) * 0.08;
  const keep = comps.map((c) => {
    if (c.size >= main.size * 0.03) return true; // sizeable part (a second animal, a detached prop)
    const inside = c.x0 >= main.x0 && c.x1 <= main.x1 && c.y0 >= main.y0 && c.y1 <= main.y1;
    const near = c.x1 >= main.x0 - padX && c.x0 <= main.x1 + padX && c.y1 >= main.y0 - padY && c.y0 <= main.y1 + padY;
    if (inside) return true; // details within the subject's outline (sparks, buttons)
    return near && c.size >= main.size * 0.002; // small bits just beside it; tiny detached marks are dropped
  });
  let dropped = 0;
  keep.forEach((k) => !k && dropped++);
  if (!dropped) return 0;
  for (let i = 0; i < W * H; i++) if (label[i] >= 0 && !keep[label[i]]) data[i * 4 + 3] = 0;
  return dropped;
}

/** Trim to the opaque subject and place it bottom-centre on a square transparent canvas. */
async function normalise(data: Buffer, W: number, H: number, size: number, margin: number): Promise<Buffer> {
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (data[(y * W + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error('Nothing left after removing the background.');
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  const subject = await sharp(data, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left: x0, top: y0, width: cw, height: ch })
    .png()
    .toBuffer();
  const maxW = Math.round(size * (1 - 2 * margin));
  const maxH = Math.round(size * (1 - margin)) - 2;
  const k = Math.min(maxW / cw, maxH / ch);
  const w = Math.max(1, Math.round(cw * k));
  const h = Math.max(1, Math.round(ch * k));
  const resized = await sharp(subject).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left: Math.round((size - w) / 2), top: size - 2 - h }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// Renders a built player page to MP4: seek every frame in headless Chrome, pipe JPEG frames to ffmpeg,
// render the synthesized sound offline and mux it in.
// usage: node render.cjs <player.html or URL> <out.mp4> [fps=30]
// needs: puppeteer-core (resolved from the current folder, e.g. the ClipForge repo root), Chrome or Edge, ffmpeg on PATH.
// Set CHROME_PATH to use another browser.
const { createRequire } = require('module');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const puppeteer = createRequire(path.join(process.cwd(), 'noop.js'))('puppeteer-core');
const [src, out, fpsArg] = process.argv.slice(2); const FPS = +(fpsArg || 30);
if (!src || !out) { console.error('usage: node render.cjs <player.html|url> <out.mp4> [fps]'); process.exit(1); }
const url = /^https?:|^file:/.test(src) ? src : pathToFileURL(path.resolve(src)).href;
const CHROME = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome or Edge found; set CHROME_PATH.'); process.exit(1); }

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 1000 });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__ready === true', { timeout: 60000 });
  const D = await page.evaluate(() => window.DURATION), N = Math.round(D * FPS);

  // sound first, to a raw float file
  const tmp = out + '.f32';
  const b64 = await page.evaluate(async () => {
    const r = await SFX.render(window.scoreSound, window.DURATION, 48000, { voiceover: false });
    const u8 = new Uint8Array(r.inter.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    window.__peak = r.peak; return btoa(s);
  });
  fs.writeFileSync(tmp, Buffer.from(b64, 'base64'));
  const peak = await page.evaluate(() => window.__peak);

  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', tmp,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', (c) => (c ? rej(new Error('ffmpeg ' + c)) : res())));

  let worst = 0, sum = 0;
  for (let i = 0; i < N; i += 8) {
    const batch = await page.evaluate(async (i0, n, fps) => {
      const cvs = document.getElementById('stage'), outB = [], ms = [];
      for (let i = i0; i < i0 + n; i++) {
        const a = performance.now(); window.seek(i / fps); ms.push(performance.now() - a);
        const blob = await new Promise((r) => cvs.toBlob(r, 'image/jpeg', 0.95));
        const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
        outB.push(btoa(s));
      }
      return { outB, ms };
    }, i, Math.min(8, N - i), FPS);
    for (const f of batch.outB) if (!ff.stdin.write(Buffer.from(f, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    for (const m of batch.ms) { worst = Math.max(worst, m); sum += m; }
  }
  ff.stdin.end(); await done; fs.unlinkSync(tmp); await browser.close();
  console.log(JSON.stringify({ out: path.basename(out), frames: N, seconds: D, avgMs: +(sum / N).toFixed(1), worstMs: +worst.toFixed(1), audioPeak: +peak.toFixed(3) }));
})().catch((e) => { console.error(e); process.exit(1); });

#!/usr/bin/env node
/**
 * ClipForge setup wizard — run once on a new computer:
 *
 *   npm install
 *   npm run setup            interactive: checks every engine, asks before installing anything
 *   npm run setup -- --yes   install everything that's missing without asking (recommended defaults)
 *   npm run setup -- --check only report what's installed (no changes) — also used when there is no terminal
 *
 * Windows uses winget, macOS uses Homebrew, Linux uses apt. Nothing is installed without a "yes".
 */
import 'dotenv/config';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { refreshWindowsPath } from './win-path.mjs';

const ROOT = process.cwd();
const PLATFORM = process.platform; // win32 | darwin | linux
const args = new Set(process.argv.slice(2));
const YES = args.has('--yes') || args.has('-y');
// no terminal to ask in → report only, unless --yes says to go ahead
const CHECK_ONLY = args.has('--check') || (!process.stdin.isTTY && !YES);
const ENV_FILE = path.join(ROOT, '.env');
const TOOLS = path.join(ROOT, 'tools');

// ---------------------------------------------------------------- tiny UI helpers
const c = (n) => (s) => (process.stdout.isTTY ? `\x1b[${n}m${s}\x1b[0m` : s);
const bold = c(1);
const dim = c(2);
const green = c(32);
const yellow = c(33);
const red = c(31);
const cyan = c(36);
const OK = green('✔');
const NO = red('✘');
const OPT = yellow('–');

const rl = CHECK_ONLY ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
async function ask(question, def = true) {
  if (CHECK_ONLY) return false;
  if (YES) {
    console.log(`  ${question} ${dim(def ? '[yes — --yes]' : '[no — --yes]')}`);
    return def;
  }
  const a = (await rl.question(`  ${question} ${dim(def ? '[Y/n]' : '[y/N]')} `)).trim().toLowerCase();
  return a ? a.startsWith('y') : def;
}

/** Numbered choice; returns the chosen option's value. --yes takes option 1 (the recommended one). */
async function choose(question, options) {
  console.log(`  ${question}`);
  options.forEach((o, i) => console.log(`    ${i + 1}) ${o.label}`));
  if (CHECK_ONLY) return options[0].value;
  if (YES) {
    console.log(`  ${dim('→ 1 (--yes)')}`);
    return options[0].value;
  }
  const a = Number((await rl.question(`  Pick 1–${options.length} ${dim('[1]')} `)).trim() || 1);
  return (options[a - 1] ?? options[0]).value;
}

/** Windows needs a shell to find .cmd shims (npm, npx, winget); pass one quoted command line instead of args + shell. */
const commandLine = (cmd, cmdArgs) => [cmd, ...cmdArgs].map((a) => (/[\s&|<>^]/.test(a) && !/^".*"$/.test(a) ? `"${a}"` : a)).join(' ');

function run(cmd, cmdArgs, opts = {}) {
  console.log(dim(`  $ ${cmd} ${cmdArgs.join(' ')}`));
  const r = PLATFORM === 'win32' ? spawnSync(commandLine(cmd, cmdArgs), { stdio: 'inherit', shell: true, ...opts }) : spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  return r.status === 0;
}

const has = (bin, a = ['--version']) => {
  try {
    execFileSync(bin, a, { stdio: 'ignore', timeout: 10000, windowsHide: true });
    return true;
  } catch (e) {
    return e.code !== 'ENOENT' && e.code !== 'EACCES' && !/not recognized|not found/i.test(String(e.stderr ?? ''));
  }
};

const refresh = () => {
  refreshWindowsPath();
  // common install folders that may not be on PATH in this terminal yet
  const extra =
    PLATFORM === 'win32'
      ? [path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama'), path.join(process.env.LOCALAPPDATA ?? '', 'Microsoft', 'WinGet', 'Links')]
      : ['/opt/homebrew/bin', '/usr/local/bin'];
  for (const d of extra) if (d && fs.existsSync(d) && !process.env.PATH.includes(d)) process.env.PATH += path.delimiter + d;
};

/** Install with the platform package manager. Returns true when the command succeeded. */
function pkgInstall({ winget, brew, apt }) {
  if (PLATFORM === 'win32' && winget) {
    if (!has('winget', ['--version'])) {
      console.log(red('  winget is missing — install "App Installer" from the Microsoft Store, then run setup again.'));
      return false;
    }
    return run('winget', ['install', '-e', '--id', winget, '--accept-package-agreements', '--accept-source-agreements']);
  }
  if (PLATFORM === 'darwin' && brew) {
    if (!has('brew', ['--version'])) {
      console.log(red('  Homebrew is missing — install it from https://brew.sh, then run setup again.'));
      return false;
    }
    return run('brew', ['install', ...brew.split(' ')]);
  }
  if (PLATFORM === 'linux' && apt) return run('sudo', ['apt-get', 'install', '-y', ...apt.split(' ')]);
  return false;
}

/** Set KEY=value in .env, line by line (works with Windows CRLF files; never merges lines). */
function setEnv(key, value) {
  const text = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const line = `${key}=${value}`;
  const at = lines.findIndex((l) => l.replace(/^[ \t]*#?[ \t]*/, '').startsWith(`${key}=`));
  if (at >= 0) lines[at] = line;
  else {
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.push(line, '');
  }
  fs.writeFileSync(ENV_FILE, lines.join(eol));
  process.env[key] = value;
}

async function fetchJson(url, ms = 3000) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const results = [];
const report = (name, state, note = '') => results.push({ name, state, note });
const section = (title, why) => console.log(`\n${bold(cyan(title))} ${dim(`— ${why}`)}`);

// ---------------------------------------------------------------- steps
async function stepNode() {
  section('Node.js', 'runs ClipForge');
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 22) {
    console.log(`  ${OK} Node ${process.versions.node}`);
    report('Node.js', 'ok', process.versions.node);
  } else {
    console.log(`  ${NO} Node ${process.versions.node} — ClipForge needs Node 22 or newer (https://nodejs.org)`);
    report('Node.js', 'missing', 'needs 22+');
  }
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    console.log(`  ${NO} node_modules missing`);
    if (await ask('Run npm install now?')) run('npm', ['install']);
  }
}

async function stepEnv() {
  section('Settings', '.env file with your choices');
  if (fs.existsSync(ENV_FILE)) {
    console.log(`  ${OK} .env exists`);
  } else if (fs.existsSync(path.join(ROOT, '.env.example'))) {
    if (CHECK_ONLY) console.log(`  ${OPT} no .env yet (defaults are used) — run npm run setup to create one`);
    else {
      fs.copyFileSync(path.join(ROOT, '.env.example'), ENV_FILE);
      console.log(`  ${OK} created .env from .env.example`);
    }
  }
}

async function stepFfmpeg() {
  section('FFmpeg', 'required: cuts, frames and encodes video');
  refresh();
  if (has('ffmpeg', ['-version'])) {
    console.log(`  ${OK} FFmpeg found`);
    return report('FFmpeg', 'ok');
  }
  console.log(`  ${NO} FFmpeg not found`);
  if (await ask('Install FFmpeg now?')) {
    pkgInstall({ winget: 'Gyan.FFmpeg', brew: 'ffmpeg-full', apt: 'ffmpeg' });
    refresh();
  }
  const ok = has('ffmpeg', ['-version']);
  console.log(ok ? `  ${OK} FFmpeg ready` : `  ${NO} FFmpeg still missing — open a NEW terminal and run setup again (PATH refresh)`);
  report('FFmpeg', ok ? 'ok' : 'missing', ok ? '' : 'required');
}

async function downloadWhisperWindows() {
  const dir = path.join(TOOLS, 'whisper');
  const zip = path.join(dir, 'whisper-bin-x64.zip');
  fs.mkdirSync(dir, { recursive: true });
  // binaries live on the build releases (bNNNN), not the tagged versions — find the newest one that has the CPU zip
  let url = null;
  try {
    const rels = await (await fetch('https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=20', { headers: { Accept: 'application/vnd.github+json' } })).json();
    url = rels.flatMap((r) => r.assets ?? []).find((a) => a.name === 'whisper-bin-x64.zip')?.browser_download_url ?? null;
  } catch {
    /* offline or rate-limited */
  }
  if (!url) {
    console.log(red('  Could not find a whisper.cpp Windows download. Get whisper-bin-x64.zip from https://github.com/ggml-org/whisper.cpp/releases,'));
    console.log(red(`  unzip it into ${dir} and run setup again.`));
    return null;
  }
  if (!run('curl.exe', ['-L', '--fail', '--retry', '3', '-o', zip, url])) return null;
  if (!run('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force -Path '${zip}' -DestinationPath '${dir}'`])) return null;
  fs.rmSync(zip, { force: true });
  const find = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        const hit = find(p);
        if (hit) return hit;
      } else if (/^whisper-cli\.exe$/i.test(e.name)) return p;
    }
    return null;
  };
  return find(dir);
}

async function stepWhisper() {
  section('Whisper', 'required: speech-to-text with word timings');
  refresh();
  const local = PLATFORM === 'win32' ? findFile(path.join(TOOLS, 'whisper'), /^whisper-cli\.exe$/i) : null;
  const bin = process.env.WHISPER_BIN || 'whisper-cli';
  if (has(bin, ['--help']) || (local && has(local, ['--help']))) {
    if (local && !has(bin, ['--help']) && !CHECK_ONLY) setEnv('WHISPER_BIN', local);
    console.log(`  ${OK} whisper.cpp found`);
    return report('Whisper', 'ok');
  }
  console.log(`  ${NO} whisper.cpp (whisper-cli) not found`);
  let ok = false;
  if (PLATFORM === 'win32') {
    if (await ask('Download whisper.cpp for Windows (~10 MB) into tools/whisper?')) {
      const exe = await downloadWhisperWindows();
      if (exe) {
        setEnv('WHISPER_BIN', exe);
        ok = true;
      }
    }
  } else if (PLATFORM === 'darwin') {
    if (await ask('Install whisper.cpp with Homebrew?')) {
      pkgInstall({ brew: 'whisper-cpp' });
      ok = has('whisper-cli', ['--help']);
    }
  } else {
    console.log(dim('  Linux: build it from https://github.com/ggml-org/whisper.cpp (cmake -B build && cmake --build build -j) and put build/bin/whisper-cli on PATH,'));
    console.log(dim('  or set WHISPER_BIN in .env to its full path.'));
  }
  if (!ok && fs.existsSync(path.join(ROOT, 'node_modules', 'hyperframes')) && PLATFORM !== 'win32') {
    console.log(`  ${OPT} HyperFrames can install its own Whisper on first use, so transcription will still work.`);
    return report('Whisper', 'optional', 'via HyperFrames');
  }
  console.log(ok ? `  ${OK} whisper.cpp ready (the ~140 MB speech model downloads on first use)` : `  ${NO} whisper.cpp still missing`);
  report('Whisper', ok ? 'ok' : 'missing', ok ? '' : 'required');
}

function findFile(dir, re) {
  if (!fs.existsSync(dir)) return null;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const hit = findFile(p, re);
      if (hit) return hit;
    } else if (re.test(e.name)) return p;
  }
  return null;
}

async function stepOllama() {
  section('Ollama', 'local AI that plans scenes, picks highlights and edits for you');
  refresh();
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  let installed = has('ollama', ['--version']);
  if (!installed) {
    console.log(`  ${OPT} Ollama not installed ${dim('(optional — ClipForge falls back to a built-in scorer, but script → video planning needs it)')}`);
    if (await ask('Install Ollama now?')) {
      if (PLATFORM === 'linux') run('sh', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh']);
      else pkgInstall({ winget: 'Ollama.Ollama', brew: 'ollama' });
      refresh();
      installed = has('ollama', ['--version']);
    }
    if (!installed) return report('Ollama', 'optional', 'not installed');
  }
  let tags = await fetchJson('http://127.0.0.1:11434/api/tags');
  if (!tags) {
    console.log(`  ${OPT} Ollama is installed but not running — starting it`);
    if (!CHECK_ONLY) {
      if (PLATFORM === 'darwin' && has('brew', ['--version'])) run('brew', ['services', 'start', 'ollama']);
      else spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
      for (let i = 0; i < 15 && !tags; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        tags = await fetchJson('http://127.0.0.1:11434/api/tags');
      }
    }
  }
  if (!tags) {
    console.log(`  ${NO} Ollama is not answering — start the Ollama app (or run: ollama serve) and run setup again`);
    return report('Ollama', 'missing', 'not running');
  }
  const base = model.includes(':') ? model : `${model}:latest`;
  const got = tags.models?.some((m) => m.name === base || m.name === model);
  if (got) {
    console.log(`  ${OK} Ollama running with ${model}`);
    return report('Ollama', 'ok', model);
  }
  console.log(`  ${NO} model ${model} not downloaded`);
  if (await ask(`Download ${model} now (~2 GB)?`)) run('ollama', ['pull', model]);
  const again = await fetchJson('http://127.0.0.1:11434/api/tags');
  const ok = Boolean(again?.models?.some((m) => m.name === base || m.name === model));
  console.log(ok ? `  ${OK} ${model} ready` : `  ${OPT} later: ollama pull ${model}`);
  report('Ollama', ok ? 'ok' : 'optional', ok ? model : `ollama pull ${model}`);
}

function findPython() {
  for (const py of [process.env.HYPERFRAMES_PYTHON, 'python', 'python3', 'py'].filter(Boolean)) {
    try {
      const v = execFileSync(py, ['--version'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
      if (/Python 3\./.test(v)) return py;
    } catch {
      /* next */
    }
  }
  return null;
}

async function stepVoices() {
  section('Kokoro voices', 'optional: natural AI narration (otherwise the system voice is used)');
  refresh();
  let py = findPython();
  const kokoroOk = (p) => {
    try {
      execFileSync(p, ['-c', 'import kokoro_onnx, soundfile'], { stdio: 'ignore', timeout: 20000, windowsHide: true });
      return true;
    } catch {
      return false;
    }
  };
  if (py && kokoroOk(py)) {
    console.log(`  ${OK} Kokoro TTS installed (${py})`);
    return report('Kokoro voices', 'ok');
  }
  if (!py) {
    console.log(`  ${OPT} Python 3 not found`);
    if (await ask('Install Python 3.12 (needed for Kokoro voices)?', false)) {
      pkgInstall({ winget: 'Python.Python.3.12', brew: 'python@3.12', apt: 'python3 python3-pip' });
      refresh();
      py = findPython();
    }
    if (!py) return report('Kokoro voices', 'optional', 'system voice');
  }
  console.log(`  ${OPT} Kokoro not installed`);
  if (await ask('Install Kokoro voices with pip (~350 MB)?')) run(py, ['-m', 'pip', 'install', '--user', 'kokoro-onnx', 'soundfile']);
  const ok = kokoroOk(py);
  console.log(ok ? `  ${OK} Kokoro ready` : `  ${OPT} using the system voice`);
  report('Kokoro voices', ok ? 'ok' : 'optional', ok ? '' : 'system voice');
}

async function stepHyperframes() {
  section('HyperFrames', 'motion captions, hook titles and intros for clips');
  const ok = fs.existsSync(path.join(ROOT, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs'));
  console.log(ok ? `  ${OK} installed (with npm install)` : `  ${NO} missing — run npm install`);
  report('HyperFrames', ok ? 'ok' : 'missing');
}

async function stepMaps() {
  section('Satellite maps', 'real Earth photo under maps (NASA Blue Marble, public domain)');
  const dataDir = path.resolve(process.env.CLIPFORGE_DATA_DIR || path.join(ROOT, 'data'));
  const ok = fs.existsSync(path.join(dataDir, 'maps', 'bluemarble', 'world.jpg')) && fs.existsSync(path.join(dataDir, 'maps', 'bluemarble', 'tiles', 'r7c15.jpg'));
  if (ok) {
    console.log(`  ${OK} installed`);
    return report('Satellite maps', 'ok');
  }
  console.log(`  ${OPT} not installed — maps use the drawn look`);
  if (CHECK_ONLY) return report('Satellite maps', 'optional', 'npm run maps:setup');
  if (await ask('Download the satellite imagery now (32.5 MB from NASA)?')) run('node', ['scripts/setup-maps.mjs', '--yes']);
  const done = fs.existsSync(path.join(dataDir, 'maps', 'bluemarble', 'tiles', 'r7c15.jpg'));
  report('Satellite maps', done ? 'ok' : 'optional', done ? '' : 'npm run maps:setup');
}

function gpuInfo() {
  try {
    const out = execFileSync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'], { encoding: 'utf8', timeout: 8000, windowsHide: true });
    const [name, mem] = out.trim().split('\n')[0].split(',').map((s) => s.trim());
    return { name, vramGb: Math.round(Number(mem) / 1024) };
  } catch {
    return null;
  }
}

/** ComfyUI is installed (and looked for) only outside the project: ..\ComfyUI, %LOCALAPPDATA%\ClipForge\ComfyUI, ~/ClipForge/ComfyUI */
function comfyHomes() {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return [
    path.resolve(ROOT, '..', 'ComfyUI'),
    ...(PLATFORM === 'win32' && process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, 'ClipForge', 'ComfyUI')] : []),
    ...(home ? [path.join(home, 'ClipForge', 'ComfyUI')] : []),
  ];
}

function comfyState() {
  const dirs = [process.env.SD_COMFY_DIR, ...comfyHomes().flatMap((h) => [path.join(h, 'ComfyUI_windows_portable'), h])].filter(Boolean);
  const dir = dirs.find((d) => fs.existsSync(path.join(d, 'ComfyUI', 'main.py')) || fs.existsSync(path.join(d, 'main.py')));
  const models = (sub) => {
    const d = dir && [path.join(dir, 'ComfyUI', 'models', sub), path.join(dir, 'models', sub)].find((x) => fs.existsSync(x));
    return d ? fs.readdirSync(d).filter((f) => /\.(safetensors|ckpt)$/i.test(f)) : [];
  };
  const ck = models('checkpoints');
  const te = models('text_encoders');
  const ltx = ck.find((m) => /ltx-?v/i.test(m)) && te.some((f) => /t5xxl/i.test(f)) ? ck.find((m) => /ltx-?v/i.test(m)) : null;
  const wanModel = models('diffusion_models').find((f) => /wan2\.?2.*ti2v.*5b/i.test(f));
  const wan = wanModel && te.some((f) => /umt5/i.test(f)) && models('vae').some((f) => /wan2\.?2.*vae/i.test(f)) ? wanModel : null;
  return {
    dir,
    image: ck.find((m) => !/ltx|wan|hunyuan/i.test(m)),
    ltx,
    wan,
    video: [ltx && `${ltx} (fast)`, wan && `${wan} (best)`].filter(Boolean).join(' + ') || null,
  };
}

async function stepStableDiffusion() {
  section('Stable Diffusion (ComfyUI)', 'AI-painted scenes, Motion (moving scenes) and style thumbnails');
  let st = comfyState();
  if (st.dir && st.image && st.video) {
    console.log(`  ${OK} ComfyUI ${dim(`(${st.dir})`)}`);
    console.log(`  ${OK} AI painting: ${st.image}`);
    console.log(`  ${OK} Motion: ${st.video}`);
    // one Motion model installed → offer the other (default no: it's a big download)
    if (PLATFORM === 'win32' && (!st.ltx || !st.wan)) {
      const other = st.ltx ? { id: 'wan', label: 'Best — Wan 2.2 5B, smoother motion (18.2 GB)' } : { id: 'ltx', label: 'Fast — LTX-Video 2B (11.5 GB)' };
      if (await ask(`Also add the ${other.label} Motion model?`, false)) run('powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/setup-comfyui.ps1', '-Dir', path.dirname(st.dir), '-SkipModel', '-Motion', other.id]);
    }
    const running = startComfy();
    return report('Stable Diffusion', running ? 'ok' : 'optional', running ? 'all models · running' : 'not started, see data/comfyui.log');
  }
  const gpu = gpuInfo();
  if (!gpu) {
    console.log(`  ${OPT} no NVIDIA GPU found — skipped; story videos use the built-in vector art`);
    return report('Stable Diffusion', 'optional', 'no NVIDIA GPU');
  }
  console.log(`  ${dim(`GPU: ${gpu.name}, ${gpu.vramGb} GB`)}`);
  if (gpu.vramGb < 8) {
    console.log(`  ${OPT} AI painting needs 8 GB+ of GPU memory — skipped (vector art still works)`);
    return report('Stable Diffusion', 'optional', `${gpu.vramGb} GB VRAM`);
  }
  if (PLATFORM !== 'win32') {
    console.log(dim('  macOS / Linux: install ComfyUI by hand in ~/ClipForge/ComfyUI (see docs/site/stable-diffusion.md) — it is found automatically'));
    return report('Stable Diffusion', 'optional', 'manual install');
  }
  const missing = [!st.dir && 'ComfyUI (~2 GB)', !st.image && 'SDXL painting model (~7 GB)', !st.video && 'a Motion model'].filter(Boolean);
  console.log(`  ${OPT} missing: ${missing.join(', ')}`);
  // Motion = image-to-video: pick the model(s) to download
  let motion = 'none';
  if (!st.video) {
    motion = await choose('Which Motion (moving scenes) model?', [
      { value: 'ltx', label: `Fast — LTX-Video 2B, ~1 min per scene, 11.5 GB ${dim('(recommended to start)')}` },
      { value: 'wan', label: 'Best — Wan 2.2 5B, smoother motion, several min per scene, 18.2 GB' },
      { value: 'both', label: 'Both — choose per video on the Script page, 29.7 GB' },
      { value: 'none', label: 'None — still paintings only' },
    ]);
  }
  if (!(await ask(`Install ${missing.length > 1 ? 'them' : 'it'} now? Downloads resume if interrupted.`))) return report('Stable Diffusion', 'optional', 'npm run comfy:setup');
  const sevenZip = [process.env.ProgramFiles, process.env['ProgramFiles(x86)']].filter(Boolean).some((d) => fs.existsSync(path.join(d, '7-Zip', '7z.exe')));
  if (!st.dir && !sevenZip) {
    console.log('  7-Zip is needed to unpack ComfyUI — installing it.');
    pkgInstall({ winget: '7zip.7zip' });
  }
  // the script only downloads what's missing; an existing install is reused in place (never inside the project)
  const args = ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/setup-comfyui.ps1', ...(st.dir ? ['-Dir', path.dirname(st.dir)] : []), '-Motion', motion, ...(st.image ? ['-SkipModel'] : [])];
  const ok = run('powershell', args);
  st = comfyState();
  const running = ok && startComfy();
  report('Stable Diffusion', ok && st.image ? 'ok' : 'optional', ok ? `${st.video ? 'all models' : 'painting only'}${running ? ' · running' : ''}` : 'run npm run comfy:setup again to resume');
}

/** Start ComfyUI in the background (same launcher npm run dev uses) and wait until it answers. Skipped in --check. */
function startComfy() {
  if (CHECK_ONLY) {
    console.log(dim('  starts automatically with npm run dev (or: npm run comfy)'));
    return true;
  }
  console.log('  Starting ComfyUI in the background…');
  const ok = run('npx', ['tsx', 'scripts/start-comfy.ts']);
  console.log(ok ? `  ${OK} ComfyUI running on ${process.env.SD_URL || 'http://127.0.0.1:8188'} (it also starts by itself with npm run dev)` : `  ${OPT} ComfyUI did not start — see data/comfyui.log`);
  return ok;
}

// ---------------------------------------------------------------- main
console.log(bold('\nClipForge AI setup') + dim(`  ·  ${os.type()} ${os.arch()}  ·  ${CHECK_ONLY ? 'check only' : YES ? 'installing everything missing' : 'asks before installing'}`));
if (!CHECK_ONLY && !YES) console.log(dim('Press Enter to accept the suggested answer. Nothing is installed without a yes.'));

await stepNode();
await stepEnv();
await stepFfmpeg();
await stepWhisper();
await stepOllama();
await stepVoices();
await stepHyperframes();
await stepStableDiffusion();
await stepMaps();

console.log(`\n${bold('Summary')}`);
for (const r of results) console.log(`  ${r.state === 'ok' ? OK : r.state === 'missing' ? NO : OPT} ${r.name.padEnd(18)} ${dim(r.note)}`);
const blocking = results.filter((r) => r.state === 'missing');
if (blocking.length) {
  console.log(`\n${red('Not ready yet:')} ${blocking.map((r) => r.name).join(', ')} — fix the items above, open a new terminal, then run ${bold('npm run setup')} again.`);
  rl?.close();
  process.exit(CHECK_ONLY ? 1 : 0);
}
console.log(`\n${green('Ready.')} Start ClipForge with ${bold('npm run dev')} and open http://localhost:${process.env.PORT || 3000}`);
if (!CHECK_ONLY && (await ask('Start it now?', false))) {
  rl?.close();
  if (PLATFORM === 'win32') spawnSync('npm run dev', { stdio: 'inherit', shell: true });
  else spawnSync('npm', ['run', 'dev'], { stdio: 'inherit' });
}
rl?.close();

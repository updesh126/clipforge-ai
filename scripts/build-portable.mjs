#!/usr/bin/env node
/**
 * Build a portable Windows copy of ClipForge to share with anyone — no Node, npm or setup needed.
 *
 *   npm run portable      the app            → release/ClipForge-Portable-<date>-<commit>.exe  (~450 MB)
 *   npm run portable:ai   the AI pack        → release/ClipForge-AI-Pack-<model>.exe           (~3 GB)
 *
 * Rebuild only the app after code changes; the AI pack stays the same until you change the model.
 *
 * The friend puts both .exe files in one folder and double-clicks each → "Extract" (same folder for both),
 * then double-clicks ClipForge-Portable\Start ClipForge.cmd. The AI pack is optional: without it ClipForge
 * still runs, just without script writing / Edit with AI.
 *
 * App bundles: Node, FFmpeg, every npm package (incl. Remotion's headless Chrome), the built studio,
 *              and whisper-cli + its model when whisper-cli is installed on this computer.
 * AI pack:     Ollama (NVIDIA CUDA 12 + Vulkan + CPU) and one model (OLLAMA_MODEL, default qwen2.5:3b).
 * Never bundled: your data/, your .env, Stable Diffusion (too big — "Install AI engines (optional).cmd").
 *
 * Needs on THIS computer: 7-Zip (C:\Program Files\7-Zip), FFmpeg on PATH, npm install done; for the AI pack
 * Ollama installed with the model pulled.
 */
import 'dotenv/config';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const RELEASE = path.join(ROOT, 'release');
const SEVEN_DIR = process.env.SEVENZIP_DIR || 'C:\\Program Files\\7-Zip';
const AI = process.argv.includes('--ai');
const INSTALLER = process.argv.includes('--installer'); // npm run installer → ClipForge-Setup-<date>-<commit>.exe
// Windows will not start an .exe of 4 GB or more — stay clearly below it
const MAX_EXE = 3.9 * 1024 ** 3;

const step = (s) => console.log(`\n\x1b[36m▶ ${s}\x1b[0m`);
const fail = (s) => {
  console.error(`\n\x1b[31m✘ ${s}\x1b[0m`);
  process.exit(1);
};

if (process.platform !== 'win32') fail('The portable build is Windows-only.');
const sevenZip = path.join(SEVEN_DIR, '7z.exe');
const sfx = path.join(SEVEN_DIR, '7z.sfx');
if (!fs.existsSync(sevenZip) || !fs.existsSync(sfx)) fail(`7-Zip not found in ${SEVEN_DIR} — install it (winget install 7zip.7zip) or set SEVENZIP_DIR.`);

const where = (bin) => {
  try {
    return execFileSync('where.exe', [bin], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split(/\r?\n/).find(Boolean)?.trim();
  } catch {
    return undefined;
  }
};

/** robocopy: fast copy of big folders; exit codes < 8 mean success. */
function robocopy(src, dst, extra = []) {
  const r = spawnSync('robocopy', [src, dst, '/E', '/NFL', '/NDL', '/NJH', '/NJS', '/NP', '/MT:16', ...extra], { stdio: 'inherit' });
  if (r.status === null || r.status >= 8) fail(`Copy failed: ${src}`);
}

const copyFile = (src, dst) => {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
};

/** 7z the staging folder and prepend 7-Zip's self-extractor → one double-clickable .exe. */
function packExe(stagingRoot, folderName, exe) {
  step(`Packing ${path.basename(exe)} (7-Zip)`);
  const payload = path.join(RELEASE, 'payload.7z');
  fs.rmSync(payload, { force: true });
  // -mx=5 for the app; model weights barely compress, so the AI pack uses fast settings
  const level = AI ? '-mx=1' : '-mx=5';
  const z = spawnSync(sevenZip, ['a', '-t7z', level, '-mmt=on', '-bso0', '-bsp0', payload, path.join(stagingRoot, folderName)], { stdio: 'inherit' });
  if (z.status !== 0) fail('7-Zip packing failed.');
  if (fs.statSync(payload).size + fs.statSync(sfx).size >= MAX_EXE) {
    fail(`The pack is ${(fs.statSync(payload).size / 1024 ** 3).toFixed(1)} GB — Windows cannot start an .exe that big. Use a smaller model (OLLAMA_MODEL in .env).`);
  }
  fs.rmSync(exe, { force: true });
  fs.copyFileSync(sfx, exe);
  // stream the archive onto the self-extractor (it can be several GB)
  const fd = fs.openSync(exe, 'a');
  const inFd = fs.openSync(payload, 'r');
  const buf = Buffer.alloc(16 * 1024 * 1024);
  for (let n; (n = fs.readSync(inFd, buf, 0, buf.length, null)) > 0; ) fs.writeSync(fd, buf, 0, n);
  fs.closeSync(inFd);
  fs.closeSync(fd);
  fs.rmSync(payload, { force: true });
}

const mb = (p) => `${Math.round(fs.statSync(p).size / 1048576)} MB`;
fs.mkdirSync(RELEASE, { recursive: true });

if (AI) buildAiPack();
else buildApp();

// ==================================================================== the app
function buildApp() {
  const OUT = path.join(RELEASE, 'ClipForge-Portable');
  const APP = path.join(OUT, 'app');
  const RUNTIME = path.join(OUT, 'runtime');

  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) fail('Run npm install first.');
  const ffmpeg = where('ffmpeg');
  const ffprobe = where('ffprobe');
  if (!ffmpeg || !ffprobe) fail('FFmpeg not found on PATH — run npm run setup first.');

  step('Building the studio (vite build)');
  if (spawnSync('npm run build', { stdio: 'inherit', shell: true }).status !== 0) fail('vite build failed.');

  step(`Preparing ${path.relative(ROOT, OUT)}`);
  // keep runtime\ollama* if an AI pack was extracted into this test folder
  fs.rmSync(APP, { recursive: true, force: true });
  for (const d of ['node.exe', 'npm', 'npm.cmd', 'npx', 'npx.cmd', 'node_modules', 'ffmpeg', 'whisper']) fs.rmSync(path.join(RUNTIME, d), { recursive: true, force: true });
  fs.mkdirSync(APP, { recursive: true });

  // tracked source only — never caches, your data/, .env or local tools
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter((f) => f && !f.startsWith('.claude/') && fs.existsSync(f));
  for (const f of tracked) copyFile(f, path.join(APP, f));
  console.log(`  ${tracked.length} source files`);
  robocopy(path.join(ROOT, 'dist'), path.join(APP, 'dist'));
  let env = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');

  step('Copying packages (node_modules, incl. Remotion headless Chrome)');
  robocopy(path.join(ROOT, 'node_modules'), path.join(APP, 'node_modules'), ['/XD', path.join(ROOT, 'node_modules', '.cache'), path.join(ROOT, 'node_modules', '.vite')]);

  step('Copying Node and FFmpeg');
  const nodeDir = path.dirname(process.execPath);
  copyFile(process.execPath, path.join(RUNTIME, 'node.exe'));
  for (const f of ['npm', 'npm.cmd', 'npx', 'npx.cmd']) if (fs.existsSync(path.join(nodeDir, f))) copyFile(path.join(nodeDir, f), path.join(RUNTIME, f));
  if (fs.existsSync(path.join(nodeDir, 'node_modules', 'npm'))) robocopy(path.join(nodeDir, 'node_modules', 'npm'), path.join(RUNTIME, 'node_modules', 'npm'));
  copyFile(ffmpeg, path.join(RUNTIME, 'ffmpeg', 'ffmpeg.exe'));
  copyFile(ffprobe, path.join(RUNTIME, 'ffmpeg', 'ffprobe.exe'));
  console.log(`  Node ${process.version}, FFmpeg from ${path.dirname(ffmpeg)}`);

  // Whisper (speech-to-text): only useful with the whisper-cli program, so bundle both or neither
  step('Whisper');
  // WHISPER_BIN may be a full path (npm run setup writes one), a name on PATH, or the setup's tools\whisper copy
  const findIn = (d) => {
    if (!fs.existsSync(d)) return undefined;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      const hit = e.isDirectory() ? findIn(p) : /^whisper-cli\.exe$/i.test(e.name) ? p : undefined;
      if (hit) return hit;
    }
  };
  const wb = process.env.WHISPER_BIN;
  const whisperCli = (wb && fs.existsSync(wb) && fs.statSync(wb).isFile() ? wb : undefined) ?? where(wb || 'whisper-cli') ?? findIn(path.join(ROOT, 'tools', 'whisper'));
  const whisperName = process.env.WHISPER_MODEL || 'base';
  const whisperModel = path.join(ROOT, 'data', 'models', `ggml-${whisperName}.bin`);
  if (whisperCli && fs.existsSync(whisperModel)) {
    robocopy(path.dirname(whisperCli), path.join(RUNTIME, 'whisper')); // the exe and its DLLs
    // whisper.cpp needs the Visual C++ runtime, which many PCs lack — Microsoft allows shipping these DLLs beside the exe
    for (const dll of ['msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll', 'vcomp140.dll']) {
      const src = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', dll);
      if (fs.existsSync(src)) copyFile(src, path.join(RUNTIME, 'whisper', dll));
      else console.log(`  \x1b[33m${dll} not found\x1b[0m — install the Visual C++ Redistributable on this PC first`);
    }
    copyFile(whisperModel, path.join(APP, 'data', 'models', path.basename(whisperModel)));
    env = env.replace(/^WHISPER_BIN=.*$/m, 'WHISPER_BIN=whisper-cli');
    console.log(`  bundled ${path.basename(whisperCli)} + ggml-${whisperName}.bin`);
  } else {
    console.log(`  \x1b[33mskipped\x1b[0m — ${whisperCli ? `no data\\models\\ggml-${whisperName}.bin` : 'whisper-cli is not installed here'}; captions/clipping need it (npm run setup installs it)`);
  }
  fs.writeFileSync(path.join(APP, '.env'), env);

  // ---------------------------------------------------------------- launchers + read-me
  const pathLine = 'set "PATH=%~dp0runtime;%~dp0runtime\\ffmpeg;%~dp0runtime\\whisper;%PATH%"\r\nset "FFMPEG_DIR=%~dp0runtime\\ffmpeg"';
  fs.writeFileSync(
    path.join(OUT, 'Start ClipForge.cmd'),
    [
      '@echo off',
      'rem ClipForge AI (portable) - double-click to start. Keep this window open while you use ClipForge.',
      'title ClipForge AI - keep this window open',
      pathLine,
      'set NODE_ENV=production',
      'rem AI pack: start the bundled Ollama unless one is already running',
      'if exist "%~dp0runtime\\ollama\\ollama.exe" (',
      '  curl.exe -s -m 2 http://127.0.0.1:11434 >nul 2>nul || (',
      '    echo   Starting the AI engine...',
      '    set "OLLAMA_MODELS=%~dp0runtime\\ollama-models"',
      '    start "ClipForge AI engine - closes with ClipForge" /min "%~dp0runtime\\ollama\\ollama.exe" serve',
      '  )',
      ')',
      'cd /d "%~dp0app"',
      'echo.',
      'echo   ClipForge is starting. Your browser opens by itself in a few seconds.',
      'echo   If it does not, open  http://localhost:3000',
      'echo   To stop ClipForge, close this window.',
      'echo.',
      'start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"',
      'node server.ts',
      'echo.',
      'echo ClipForge stopped. If you see an error above, send a photo of this window to whoever shared ClipForge.',
      'pause',
      '',
    ].join('\r\n')
  );
  fs.writeFileSync(
    path.join(OUT, 'Install AI engines (optional).cmd'),
    [
      '@echo off',
      'rem Optional: installs more local AI engines (Whisper, voices, Stable Diffusion). Needs internet; can be many GB.',
      'title ClipForge AI - install AI engines',
      pathLine,
      'cd /d "%~dp0app"',
      'node scripts\\setup-wizard.mjs',
      'echo.',
      'echo Done. Close this window and double-click "Start ClipForge.cmd".',
      'pause',
      '',
    ].join('\r\n')
  );
  fs.writeFileSync(
    path.join(OUT, 'READ ME FIRST.txt'),
    [
      'ClipForge AI - portable',
      '=======================',
      '',
      '1. Double-click "Start ClipForge.cmd".',
      '   A black window opens - keep it open. Your browser opens ClipForge by itself.',
      '   If Windows says "Windows protected your PC", click "More info" then "Run anyway".',
      '',
      '2. To stop ClipForge, close the black window (and the small "AI engine" window if there is one).',
      '',
      'AI pack (script writing, Edit with AI):',
      '   If you were also given "ClipForge-AI-Pack-....exe", double-click it and extract it to the SAME',
      '   place you extracted ClipForge. Then start ClipForge as usual - the AI starts by itself.',
      '',
      'More AI (voices, AI paintings) - optional:',
      '   Double-click "Install AI engines (optional).cmd". Needs internet and can download many GB.',
      '',
      'Your videos and projects are saved in the "app\\data" folder.',
      'Keep that folder if you replace ClipForge with a newer version.',
      '',
    ].join('\r\n')
  );

  let commit = 'local';
  try {
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    /* not a git checkout */
  }
  const stamp = `${new Date().toISOString().slice(0, 10)}-${commit}`;
  if (INSTALLER) return buildInstaller(OUT, stamp);
  const exe = path.join(RELEASE, `ClipForge-Portable-${stamp}.exe`);
  packExe(RELEASE, 'ClipForge-Portable', exe);

  console.log(`\n\x1b[32m✔ Done.\x1b[0m`);
  console.log(`  Share this file:  ${exe}  (${mb(exe)})`);
  console.log(`  Test folder:      ${OUT}  → double-click "Start ClipForge.cmd"`);
  console.log(`  AI pack (build once): npm run portable:ai`);
}

// ==================================================================== the installer (setup.exe)
/** Inno Setup installer from the staged app: installs per user, adds shortcuts, downloads Ollama + model on the PC. */
function buildInstaller(stage, stamp) {
  const iscc = [
    process.env.ISCC,
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  ].find((p) => p && fs.existsSync(p));
  if (!iscc) fail('Inno Setup not found — install it: winget install -e --id JRSoftware.InnoSetup');

  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || '0.1.0';
  const modelsDir = path.join(stage, 'app', 'data', 'models');
  const whisperModel = fs.existsSync(modelsDir) ? fs.readdirSync(modelsDir, { withFileTypes: true }).find((e) => e.name.endsWith('.bin')) : undefined;
  const outName = `ClipForge-Setup-${stamp}`;
  const defines = [`/DStage=${stage}`, `/DOutDir=${RELEASE}`, `/DAppVer=${version}`, `/DOutName=${outName}`];
  if (whisperModel) defines.push(`/DWhisperModel=${path.join(stage, 'app', 'data', 'models', whisperModel.name)}`);

  step('Compiling the installer (Inno Setup) — takes a few minutes');
  const r = spawnSync(iscc, ['/Q', ...defines, path.join(ROOT, 'scripts', 'installer', 'clipforge.iss')], { stdio: 'inherit' });
  if (r.status !== 0) fail('Inno Setup failed (see above).');

  const exe = path.join(RELEASE, `${outName}.exe`);
  console.log(`\n\x1b[32m✔ Done.\x1b[0m`);
  console.log(`  Share this file:  ${exe}  (${mb(exe)})`);
  console.log('  Your friend double-clicks it → Next → Install. It downloads Ollama + the AI model itself (needs internet).');
}

// ==================================================================== the AI pack (Ollama + one model)
function buildAiPack() {
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
  const [name, tag = 'latest'] = model.split(':');
  const ollamaExe = where('ollama');
  if (!ollamaExe) fail('Ollama is not installed on this computer.');
  const ollamaDir = path.dirname(fs.realpathSync(ollamaExe));
  const modelsDir = process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models');
  const manifestRel = path.join('manifests', 'registry.ollama.ai', ...(name.includes('/') ? name.split('/') : ['library', name]), tag);
  const manifestPath = path.join(modelsDir, manifestRel);
  if (!fs.existsSync(manifestPath)) fail(`Model ${model} is not pulled — run: ollama pull ${model}`);

  // staging root mirrors the app folder, so extracting next to the app merges into ClipForge-Portable\runtime
  const STAGE = path.join(RELEASE, 'ai-pack');
  const RUNTIME = path.join(STAGE, 'ClipForge-Portable', 'runtime');
  fs.rmSync(STAGE, { recursive: true, force: true });

  step(`Copying Ollama from ${ollamaDir}`);
  copyFile(path.join(ollamaDir, 'ollama.exe'), path.join(RUNTIME, 'ollama', 'ollama.exe'));
  // CPU + NVIDIA (CUDA 12) + Vulkan (AMD/Intel GPUs). Skip CUDA 13 and ROCm to keep the pack under 4 GB.
  robocopy(path.join(ollamaDir, 'lib'), path.join(RUNTIME, 'ollama', 'lib'), ['/XD', 'cuda_v13', 'rocm_v7_1', 'rocm']);

  step(`Copying model ${model}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  copyFile(manifestPath, path.join(RUNTIME, 'ollama-models', manifestRel));
  for (const layer of [manifest.config, ...manifest.layers]) {
    const blob = layer.digest.replace(':', '-');
    const src = path.join(modelsDir, 'blobs', blob);
    if (fs.existsSync(src)) copyFile(src, path.join(RUNTIME, 'ollama-models', 'blobs', blob));
    else if (layer !== manifest.config) fail(`Missing model file ${blob} — run: ollama pull ${model}`);
  }

  const exe = path.join(RELEASE, `ClipForge-AI-Pack-${model.replace(/[^a-zA-Z0-9.-]+/g, '-')}.exe`);
  packExe(STAGE, 'ClipForge-Portable', exe);
  fs.rmSync(STAGE, { recursive: true, force: true });

  console.log(`\n\x1b[32m✔ Done.\x1b[0m`);
  console.log(`  Share this file too:  ${exe}  (${mb(exe)})`);
  console.log('  Your friend extracts it to the SAME place as ClipForge-Portable-....exe.');
}

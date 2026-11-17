// Checks that local engines are installed and prints the exact install command for anything missing.
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { refreshWindowsPath } from './win-path.mjs';

refreshWindowsPath();

const os = process.platform;
const has = (bin, args = ['--help']) => {
  try { execFileSync(bin, args, { stdio: 'ignore', timeout: 8000 }); return true; }
  catch (e) { return e.code !== 'ENOENT'; }
};
const hint = {
  ffmpeg: { darwin: 'brew install ffmpeg-full', linux: 'sudo apt install ffmpeg', win32: 'winget install Gyan.FFmpeg' },
  'whisper-cli': { darwin: 'brew install whisper-cpp', linux: 'build from https://github.com/ggml-org/whisper.cpp', win32: 'download whisper-bin-x64.zip from github.com/ggml-org/whisper.cpp/releases and add to PATH' },
  ollama: { darwin: 'brew install ollama  (or download from ollama.com)', linux: 'curl -fsSL https://ollama.com/install.sh | sh', win32: 'winget install Ollama.Ollama' },
};

let ok = true;
const whisperBin = process.env.WHISPER_BIN || 'whisper-cli';
const hfCli = path.join(process.cwd(), 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');
const hyperframes = fs.existsSync(hfCli);

for (const [bin, args, required] of [['ffmpeg', ['-version'], true], [whisperBin, ['--help'], false], ['ollama', ['--version'], false]]) {
  const found = has(bin, args);
  let note = '';
  if (!found && bin === whisperBin) note = hyperframes && os !== 'win32' ? '  (optional — HyperFrames can install Whisper on first use)' : '';
  console.log(`${found ? '✔' : '✘'} ${bin}${found ? '' : `  →  ${hint[bin]?.[os] ?? 'install it'}${note}`}`);
  if (!found && required) ok = false;
  if (!found && bin === whisperBin && (!hyperframes || os === 'win32') && !process.env.HYPERFRAMES_WHISPER_PATH) ok = false;
}

console.log(`${hyperframes ? '✔' : '✘'} HyperFrames (motion captions, hook titles, TTS)${hyperframes ? '' : '  →  npm install'}`);

// Kokoro TTS is a Python package used by `hyperframes tts`
let kokoro = false;
for (const py of [process.env.HYPERFRAMES_PYTHON, 'python3', 'python', 'py'].filter(Boolean)) {
  try { execFileSync(py, ['-c', 'import kokoro_onnx, soundfile'], { stdio: 'ignore', timeout: 15000 }); kokoro = true; break; }
  catch { /* try next */ }
}
console.log(`${kokoro ? '✔' : '–'} Kokoro TTS (natural AI voices)${kokoro ? '' : '  →  optional: pip install kokoro-onnx soundfile  (system voice is used otherwise)'}`);

const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
try {
  const tags = await (await fetch('http://127.0.0.1:11434/api/tags')).json();
  const got = tags.models?.some((m) => m.name.startsWith(model));
  console.log(`${got ? '✔' : '✘'} Ollama model ${model}${got ? '' : `  →  ollama pull ${model}`}`);
} catch {
  console.log(`– Ollama not running (optional). Start it with: ollama serve  then: ollama pull ${model}`);
}
// Stable Diffusion (ComfyUI) for "AI painting" — optional; npm run dev starts it automatically when installed
{
  const { existsSync, readdirSync } = await import('node:fs');
  const { join, resolve } = await import('node:path');
  const dirs = [process.env.SD_COMFY_DIR, join(process.cwd(), 'tools', 'ComfyUI', 'ComfyUI_windows_portable'), resolve(process.cwd(), '..', 'ComfyUI', 'ComfyUI_windows_portable')].filter(Boolean);
  const dir = dirs.find((d) => existsSync(join(d, 'ComfyUI', 'main.py')) || existsSync(join(d, 'main.py')));
  const ckDir = dir && [join(dir, 'ComfyUI', 'models', 'checkpoints'), join(dir, 'models', 'checkpoints')].find((d) => existsSync(d));
  const models = ckDir ? readdirSync(ckDir).filter((f) => /\.(safetensors|ckpt)$/i.test(f)) : [];
  const fix = os === 'win32' ? 'npm run comfy:setup' : 'see docs/site/stable-diffusion.md';
  if (!dir) console.log(`– Stable Diffusion / ComfyUI (AI painting, optional)  →  ${fix}`);
  else if (!models.length) console.log(`✘ ComfyUI found in ${dir} but no model in models/checkpoints  →  ${fix}`);
  else console.log(`✔ Stable Diffusion: ComfyUI + ${models[0]} (starts automatically with npm run dev)`);
}

console.log(ok ? '\nReady. Run: npm run dev' : '\nInstall the missing tools above, then run: npm run dev');

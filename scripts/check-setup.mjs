// Checks that local engines are installed and prints the exact install command for anything missing.
import { execFileSync } from 'node:child_process';

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
for (const [bin, args] of [['ffmpeg', ['-version']], [process.env.WHISPER_BIN || 'whisper-cli', ['--help']], ['ollama', ['--version']]]) {
  const found = has(bin, args);
  console.log(`${found ? '✔' : '✘'} ${bin}${found ? '' : `  →  ${hint[bin]?.[os] ?? 'install it'}`}`);
  if (!found && bin !== 'ollama') ok = false;
}
const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
try {
  const tags = await (await fetch('http://127.0.0.1:11434/api/tags')).json();
  const got = tags.models?.some((m) => m.name.startsWith(model));
  console.log(`${got ? '✔' : '✘'} Ollama model ${model}${got ? '' : `  →  ollama pull ${model}`}`);
} catch {
  console.log(`– Ollama not running (optional). Start it with: ollama serve  then: ollama pull ${model}`);
}
console.log(ok ? '\nReady. Run: npm run dev' : '\nInstall the missing tools above, then run: npm run dev');

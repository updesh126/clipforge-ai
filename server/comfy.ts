/**
 * Starts ComfyUI (local Stable Diffusion) for you, so "AI painting" works without opening it by hand.
 *
 *   SD_COMFY_DIR   folder of the portable build (the one with run_nvidia_gpu.bat) — auto-detected otherwise:
 *                  ../ComfyUI/ComfyUI_windows_portable, then %LOCALAPPDATA%/ClipForge/ComfyUI (Windows) or ~/ClipForge/ComfyUI.
 *                  ComfyUI is never kept inside the project folder.
 *   SD_AUTOSTART   true (default) = start ComfyUI when ClipForge starts; false = only when a painting is needed
 *   SD_COMFY_ARGS  extra arguments, e.g. "--lowvram"
 *   SD_PREVIEW     live preview while painting: taesd (default), latent2rgb, auto or none
 *
 * ComfyUI runs detached (it survives `npm run dev` reloads) and logs to data/comfyui.log.
 * A server that is already listening on SD_URL is always reused, never started twice.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.ts';
import { SD_URL, sdStatus } from './imagegen.ts';

export const COMFY_LOG = path.join(DATA_DIR, 'comfyui.log');

/** Where ClipForge installs / looks for ComfyUI — always outside the project. */
export function comfyHomes(): string[] {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  return [
    path.resolve(process.cwd(), '..', 'ComfyUI'),
    ...(process.platform === 'win32' && process.env.LOCALAPPDATA ? [path.join(process.env.LOCALAPPDATA, 'ClipForge', 'ComfyUI')] : []),
    ...(home ? [path.join(home, 'ClipForge', 'ComfyUI')] : []),
  ];
}

const CANDIDATES = [
  process.env.SD_COMFY_DIR,
  ...comfyHomes().flatMap((h) => [path.join(h, 'ComfyUI_windows_portable'), h]),
].filter((d): d is string => Boolean(d));

interface Install {
  dir: string;
  python: string;
  main: string;
}

/** The ComfyUI install ClipForge will start, or null when none is found. */
export function findComfy(): Install | null {
  for (const dir of CANDIDATES) {
    const portablePy = path.join(dir, 'python_embeded', 'python.exe');
    const portableMain = path.join(dir, 'ComfyUI', 'main.py');
    if (fs.existsSync(portablePy) && fs.existsSync(portableMain)) return { dir, python: portablePy, main: portableMain };
    // manual (git) install: <dir>/main.py with a venv
    const main = path.join(dir, 'main.py');
    if (fs.existsSync(main)) {
      const venv = [path.join(dir, 'venv', 'Scripts', 'python.exe'), path.join(dir, 'venv', 'bin', 'python'), path.join(dir, '.venv', 'bin', 'python')].find((p) => fs.existsSync(p));
      return { dir, python: venv ?? (process.platform === 'win32' ? 'python' : 'python3'), main };
    }
  }
  return null;
}

let starting: Promise<boolean> | null = null;

/**
 * Make sure ComfyUI is up. Starts it when installed and not running, then waits until it answers.
 * Returns true when it is running. Never throws.
 */
export function ensureComfy(onProgress?: (msg: string) => void, timeoutMs = 4 * 60_000): Promise<boolean> {
  if (starting) return starting;
  starting = (async () => {
    if ((await sdStatus(true)).running) return true;
    const install = findComfy();
    if (!install) return false;
    const port = new URL(SD_URL).port || '8188';
    const host = new URL(SD_URL).hostname;
    if (!['127.0.0.1', 'localhost', '0.0.0.0'].includes(host)) return false; // a remote ComfyUI is not ours to start
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const log = fs.openSync(COMFY_LOG, 'a');
    fs.writeSync(log, `\n---- ${new Date().toISOString()} starting ComfyUI from ${install.dir}\n`);
    const extra = (process.env.SD_COMFY_ARGS ?? '').split(/\s+/).filter(Boolean);
    // live previews for the Script page (TAESD = clear previews; ComfyUI falls back to latent2rgb without the model)
    const previewMethod = process.env.SD_PREVIEW || 'taesd';
    const args = ['-s', install.main, '--disable-auto-launch', ...(previewMethod === 'none' ? [] : ['--preview-method', previewMethod]), '--listen', host === 'localhost' ? '127.0.0.1' : host, '--port', port, ...(install.python.includes('python_embeded') ? ['--windows-standalone-build'] : []), ...extra];
    console.log(`[clipforge] starting ComfyUI (Stable Diffusion) from ${install.dir} — log: ${COMFY_LOG}`);
    const child = spawn(install.python, args, { cwd: install.dir, detached: true, stdio: ['ignore', log, log], windowsHide: true });
    child.unref();
    let exited: number | null = null;
    child.on('exit', (code) => (exited = code ?? -1));
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      await new Promise((r) => setTimeout(r, 2000));
      if (exited !== null) {
        console.warn(`[clipforge] ComfyUI exited (code ${exited}) — see ${COMFY_LOG}`);
        return false;
      }
      onProgress?.(`Starting Stable Diffusion… ${Math.round((Date.now() - started) / 1000)}s`);
      if ((await sdStatus(true)).running) {
        console.log(`[clipforge] ComfyUI ready on ${SD_URL}`);
        return true;
      }
    }
    console.warn(`[clipforge] ComfyUI did not answer within ${Math.round(timeoutMs / 1000)}s — see ${COMFY_LOG}`);
    return false;
  })().finally(() => {
    starting = null;
  });
  return starting;
}

/** Called once when ClipForge starts (unless SD_AUTOSTART=false). */
export function autostartComfy() {
  if (/^(0|false|no|off)$/i.test(process.env.SD_AUTOSTART ?? '')) return;
  if (!findComfy()) return; // not installed — AI painting stays optional
  void ensureComfy();
}

/**
 * Start local Stable Diffusion (ComfyUI) without starting ClipForge:  npm run comfy
 * (npm run dev does this automatically; set SD_AUTOSTART=false to turn that off.)
 */
import 'dotenv/config';
import { COMFY_LOG, ensureComfy, findComfy } from '../server/comfy.ts';
import { SD_URL, sdStatus } from '../server/imagegen.ts';

const install = findComfy();
if (!install) {
  console.error('ComfyUI is not installed. Run: npm run comfy:setup');
  process.exit(1);
}
console.log(`ComfyUI: ${install.dir}`);
const ok = await ensureComfy((m) => process.stdout.write(`\r${m}   `), 5 * 60_000);
const st = await sdStatus(true);
console.log(ok ? `\nReady on ${SD_URL} with ${st.checkpoint ?? 'no model (add one to models/checkpoints)'}` : `\nComfyUI did not start — see ${COMFY_LOG}`);
process.exit(ok ? 0 : 1);

/**
 * Build / refresh the object database (assets/library/objects.json) with a local vision model.
 *   npm run describe-assets                 only new or changed pictures
 *   npm run describe-assets -- --force      re-describe everything (locked entries are kept)
 *   npm run describe-assets -- --limit 20   stop after 20
 *   npm run describe-assets -- animals      only one folder
 * Model: OLLAMA_VISION_MODEL, else gemma3:4b if pulled, else qwen3.5:4b. Needs Ollama running.
 */
import 'dotenv/config';
import { describeAndSave, libraryPictures, needsDescribing, readObjects, relOf, resolveVisionModel } from '../server/objectdb.ts';

const args = process.argv.slice(2);
const force = args.includes('--force');
const li = args.indexOf('--limit');
const limit = li >= 0 ? Number(args[li + 1]) : Infinity;
const folder = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--limit');

const db = readObjects();
const todo = libraryPictures()
  .filter((p) => !folder || relOf(p).startsWith(`${folder}/`))
  .filter((p) => (force ? !db[relOf(p)]?.locked : needsDescribing(p, db)))
  .slice(0, limit);

console.log(`Describing ${todo.length} picture(s) with ${await resolveVisionModel()}…`);
const t0 = Date.now();
let ok = 0;
let failed = 0;
for (const [i, p] of todo.entries()) {
  try {
    const info = await describeAndSave(p);
    ok++;
    const eta = (((Date.now() - t0) / (i + 1)) * (todo.length - i - 1)) / 1000;
    console.log(`[${i + 1}/${todo.length}] ${relOf(p)} → ${info?.name} (${info?.kind})  ~${Math.round(eta)}s left`);
  } catch (e) {
    failed++;
    console.log(`[${i + 1}/${todo.length}] ${relOf(p)} ✘ ${(e as Error).message}`);
  }
}
console.log(`Done: ${ok} described, ${failed} failed, ${Object.keys(readObjects()).length} objects in the database (${Math.round((Date.now() - t0) / 1000)}s).`);
process.exit(failed && !ok ? 1 : 0);

/**
 * Import a folder of images into the asset library (background removed, sorted, licence-tagged).
 *
 *   npm run import-images -- "C:\path\to\folder" [--source "AI-generated (Gemini)"] [--licence "own work"] [--move]
 *
 * Writes a review report to assets/library/import-report.md (flagged items + what went where).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ASSETS_DIR } from '../server/assets.ts';
import { importFolder } from '../server/importer.ts';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const opt = (k: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!dir || !fs.existsSync(dir)) {
  console.error('Usage: npm run import-images -- "<folder>" [--source "..."] [--licence "..."] [--move]');
  process.exit(1);
}

const source = opt('source') ?? `import from ${path.basename(dir)}`;
const started = Date.now();
const results = await importFolder(dir, { source, licence: opt('licence'), move: args.includes('--move') }, (done, total, r) => {
  if (done % 20 === 0 || done === total || r.error) console.log(`${done}/${total} ${r.error ? `✗ ${r.file}: ${r.error}` : `→ ${r.category}`}`);
});

const by = (k: string) => results.filter((r) => r.category === k).length;
const flagged = results.filter((r) => r.flag);
const failed = results.filter((r) => r.error);
const md = [
  `# Import report — ${path.basename(dir)}`,
  '',
  `${results.length} images · ${Math.round((Date.now() - started) / 1000)} s · source: ${source} · licence: ${opt('licence') ?? 'unverified'}`,
  '',
  '| Folder | Count |',
  '|---|---|',
  ...['characters', 'animals', 'birds', 'nature', 'buildings', 'props', 'backgrounds'].map((k) => `| ${k} | ${by(k)} |`),
  '',
  `## Please review (${flagged.length})`,
  '',
  ...(flagged.length ? flagged.map((r) => `- [${r.file}](${r.url?.replace('/media/assets/', '')}) — ${r.flag}`) : ['Nothing flagged.']),
  '',
  ...(failed.length ? [`## Failed (${failed.length})`, '', ...failed.map((r) => `- ${r.file}: ${r.error}`), ''] : []),
  '## All files',
  '',
  ...results.filter((r) => r.url).map((r) => `- ${r.file} → \`${decodeURIComponent((r.url ?? '').replace('/media/assets/', ''))}\` (${r.kind}${r.kind === 'sprite' ? `, ${Math.round((r.removed ?? 0) * 100)}% background removed` : ''})`),
];
fs.writeFileSync(path.join(ASSETS_DIR, 'import-report.md'), md.join('\n'), 'utf-8');
console.log(`Done: ${results.length - failed.length} imported, ${flagged.length} flagged for review, ${failed.length} failed. Report: assets/library/import-report.md`);
process.exit(0);

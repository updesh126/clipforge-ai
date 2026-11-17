#!/usr/bin/env node
/**
 * ClipForge director helper — drives the local ClipForge server (npm run dev) from Claude Code.
 *
 *   node cf.mjs health                                   engines, Stable Diffusion, Ollama
 *   node cf.mjs styles                                   art styles with best-for / avoid-for
 *   node cf.mjs paint --style warli --prompt "..." [--aspect 9:16] [--seed 7]
 *                                                        one test painting → prints the PNG path
 *   node cf.mjs make brief.json                          script → video, live progress → prints the edit id
 *   node cf.mjs scenes <editId>                          scene list (time, painting, title, atmosphere)
 *   node cf.mjs stills <editId> [t1 t2 …]                render stills (default: middle of every scene) → PNG paths
 *   node cf.mjs repaint <editId> <scene#> --prompt "..." [--seed 99]
 *                                                        repaint one scene's picture and put it in the edit
 *   node cf.mjs ai <editId> "instruction"                Edit with AI (local LLM)
 *   node cf.mjs render <editId> [--format mp4|webm|gif] [--quality high|standard|draft]
 *
 * brief.json: { "script", "title", "aspect", "style", "mode": "story", "illustration": "ai"|"vector", "animate": true|false, "voice", "language", "captions" }
 * Set CLIPFORGE_URL if the server isn't on http://localhost:3000.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = (process.env.CLIPFORGE_URL || 'http://localhost:3000').replace(/\/+$/, '');
const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) flags[rest[i].slice(2)] = rest[i + 1]?.startsWith('--') || rest[i + 1] === undefined ? true : rest[++i];
  else pos.push(rest[i]);
}

async function api(method, url, body, timeoutMs = 20 * 60_000) {
  let res;
  try {
    res = await fetch(BASE + url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    throw new Error(`ClipForge is not reachable at ${BASE} — start it with: npm run dev  (${e.message})`);
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${data.error ?? text.slice(0, 300)}`);
  return data;
}

const dataDir = () => path.resolve(process.env.CLIPFORGE_DATA_DIR || path.join(process.cwd(), 'data'));
const fileOf = (url) => path.join(dataDir(), url.replace(/^\/media\//, '').split('?')[0]);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

async function getEdit(id) {
  const d = await api('GET', `/api/edits/${id}`);
  return d.edit ?? d;
}

/** Scenes = the full-frame picture items (AI paintings or vector places), in time order. */
function scenesOf(edit) {
  const pics = edit.items.filter((i) => i.kind === 'image' && i.track === 1 && i.scale >= 0.999).sort((a, b) => a.from - b.from);
  return pics.map((p, n) => {
    const within = (i) => i.from < p.from + p.duration && i.from + i.duration > p.from;
    const text = edit.items.filter((i) => i.kind === 'text' && within(i));
    return {
      n: n + 1,
      from: p.from,
      to: p.from + p.duration,
      picture: p,
      title: text.find((i) => ['Title', 'Quote', 'Highlight'].includes(i.name))?.props?.text,
      atmosphere: text.find((i) => String(i.name).startsWith('Atmosphere'))?.name?.replace('Atmosphere · ', ''),
      camera: edit.items.find((i) => i.kind === 'effect' && String(i.name).startsWith('Camera') && within(i))?.effect,
      words: edit.items.find((i) => i.kind === 'captions' && within(i))?.words?.map((w) => w.text).join(' '),
    };
  });
}

const commands = {
  async health() {
    const h = await api('GET', '/api/health');
    const row = (name, ok, note = '') => console.log(`${ok ? '✔' : '✘'} ${name.padEnd(18)} ${note}`);
    row('FFmpeg', h.ffmpeg);
    row('Whisper', h.whisper, h.whisperName);
    row('Ollama', h.ollama && h.ollamaModelInstalled, h.ollamaModel);
    row('Voices (Kokoro)', h.tts, `${h.voices?.length ?? 0} voices`);
    row('Motion (video)', Boolean(h.sdVideo), h.sdVideo ?? 'not installed → npm run comfy:setup -- -Motion ltx (or wan)');
    row('Stable Diffusion', h.sd, h.sd ? h.sdModel : h.sdInstalled ? 'installed, not running (starts on demand)' : 'not installed → vector illustration only');
  },

  async styles() {
    const dir = path.join(process.cwd(), 'src', 'artstyles');
    for (const f of fs.readdirSync(dir).filter((f) => /^[a-z][A-Za-z]+\.json$/.test(f))) {
      const s = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (s.engine === 'picker') continue;
      console.log(`${s.id.padEnd(13)} ${s.label} — best: ${(s.bestFor ?? []).slice(0, 3).join('; ')} | avoid: ${(s.avoidFor ?? []).join('; ')}`);
    }
  },

  async paint() {
    if (!flags.prompt || !flags.style) throw new Error('paint needs --style and --prompt');
    const r = await api('POST', '/api/sd/test', { style: flags.style, prompt: flags.prompt, aspect: flags.aspect || '16:9', seed: Number(flags.seed) || 7 });
    console.log(r.file ?? fileOf(r.url));
  },

  async make() {
    const brief = JSON.parse(fs.readFileSync(pos[0], 'utf8'));
    if (!brief.script?.trim()) throw new Error('brief.json needs "script"');
    const jobId = `job_dir_${Date.now()}`;
    console.log(`job ${jobId}`);
    // the POST can outlive Node fetch's 5-minute header timeout on long videos, so the job (not the response) is the source of truth
    let postError = null;
    api('POST', '/api/script-video', { mode: 'story', captions: 'karaoke', ...brief, jobId }).catch((e) => {
      if (!/fetch failed|timeout|aborted/i.test(e.message)) postError = e;
    });
    let last = '';
    let missing = 0;
    for (;;) {
      await new Promise((res) => setTimeout(res, 3000));
      if (postError) throw postError;
      const j = (await api('GET', `/api/jobs/${jobId}`, undefined, 15_000).catch(() => ({}))).job;
      if (j?.result?.error) throw new Error(j.result.error);
      if (j?.result?.editId) {
        console.log(`\nEDIT ${j.result.editId} — open: ${BASE}/#/edit/${j.result.editId}`);
        return;
      }
      if (!j && ++missing > 40) throw new Error(`job ${jobId} disappeared (server restarted?) — run make again`);
      if (j) {
        missing = 0;
        const m = j.media ?? {};
        const line = `${String(j.pct).padStart(3)}%  ${j.label}${m.sceneTotal ? `  [scene ${m.sceneIndex}/${m.sceneTotal}${m.scenes ? `, painted ${m.scenes.length}` : ''}]` : ''}`;
        if (line !== last) console.log(line);
        last = line;
      }
    }
  },

  async scenes() {
    const edit = await getEdit(pos[0]);
    console.log(`${edit.name} · ${edit.width}×${edit.height}`);
    for (const s of scenesOf(edit)) {
      console.log(`#${s.n} ${fmt(s.from)}–${fmt(s.to)}  ${s.picture.name}  camera=${s.camera ?? '-'}  atmosphere=${s.atmosphere ?? '-'}${s.title ? `  title="${s.title}"` : ''}`);
      console.log(`    picture: ${fileOf(s.picture.src)}`);
      if (s.words) console.log(`    says: ${s.words.slice(0, 160)}`);
    }
  },

  async stills() {
    const edit = await getEdit(pos[0]);
    const times = pos.length > 1 ? pos.slice(1).map(Number) : scenesOf(edit).map((s) => +((s.from + s.to) / 2).toFixed(2));
    for (const t of times) {
      const r = await api('POST', `/api/edits/${edit.id}/render`, { format: 'still', stillAt: t, scale: 0.5 });
      console.log(`${t}s  ${fileOf(r.export.url)}`);
    }
  },

  async repaint() {
    const [id, nStr] = pos;
    if (!flags.prompt) throw new Error('repaint needs --prompt (describe the scene: who, where, doing what, time of day)');
    const edit = await getEdit(id);
    const scene = scenesOf(edit)[Number(nStr) - 1];
    if (!scene) throw new Error(`no scene #${nStr}`);
    const style = flags.style || edit.items.find((i) => i.name?.startsWith('Frame · '))?.props?.style || edit.items.find((i) => i.template === 'artBanner')?.props?.style;
    if (!style) throw new Error('could not tell the art style — pass --style');
    const aspect = edit.height > edit.width ? '9:16' : edit.width === edit.height ? '1:1' : edit.height === 1350 ? '4:5' : '16:9';
    const r = await api('POST', '/api/sd/test', { style, prompt: flags.prompt, aspect, seed: Number(flags.seed) || Math.floor(Math.random() * 1e6) });
    edit.items = edit.items.map((i) => (i.id === scene.picture.id ? { ...i, src: r.url } : i));
    await api('PUT', `/api/edits/${id}`, edit);
    console.log(`scene #${nStr} repainted → ${r.file ?? fileOf(r.url)}`);
  },

  async ai() {
    const [id, ...words] = pos;
    const d = await api('POST', `/api/edits/${id}/ai`, { instruction: words.join(' ') });
    console.log(d.reply ?? d.message ?? 'done');
  },

  async render() {
    const r = await api('POST', `/api/edits/${pos[0]}/render`, { format: flags.format || 'mp4', quality: flags.quality || 'high' });
    console.log(fileOf(r.export.url));
  },
};

if (!commands[cmd]) {
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 20).join('\n').replace(/^ \* ?/gm, ''));
  process.exit(cmd ? 1 : 0);
}
commands[cmd]().catch((e) => {
  console.error(`✘ ${e.message}`);
  process.exit(1);
});

/**
 * Explainer accents: small hand-made touches on top of a scene's picture, built from the narration with simple
 * rules (no AI needed, so they are always valid and only ever use words that are actually said).
 *
 *   "ten years ago … today …"               → thenVsNow     (two eras side by side)
 *   "A, B and C" (short items)              → cardList      (sticker chips, one per item)
 *   "Name Surname, a/the role,"             → lowerThird    (name and role)
 *   "reported / announced / headline"       → newspaperZoom (paper slides in, phrase highlighted)
 *   "banned / illegal / approved / fake…"   → stampReveal   (rubber stamp slams down)
 *   "the first / the biggest / record…"     → markerHighlight on that phrase
 *   "But / Yet / However / Surprisingly…"   → handwrittenNote with the turn ("But…")
 *
 * Used for documentary, tech and fun videos (Script → video) and by the Script Writer to add [tags].
 */
import type { Directive } from './directives.ts';
import type { VideoType } from '../src/videotypes.ts';

export interface Accent {
  id: string;
  params: Record<string, string | number>;
}

/** Which accents suit each video type (stories keep the picture clean). */
const BY_TYPE: Record<VideoType, string[]> = {
  story: [],
  documentary: ['thenVsNow', 'lowerThird', 'newspaperZoom', 'stampReveal', 'cardList', 'markerHighlight', 'handwrittenNote'],
  tech: ['thenVsNow', 'cardList', 'markerHighlight', 'lowerThird', 'handwrittenNote'],
  fun: ['stampReveal', 'handwrittenNote', 'markerHighlight', 'cardList'],
};

/** Colours per art style for the two-era panel (collage: grey past, yellow present). */
const ERA_COLOURS: Record<string, [string, string]> = {
  collage: ['#6E6E6E', '#FFD400'],
  handDrawn: ['#8D6E63', '#2A2622'],
  inkWash: ['#9A9A96', '#B3261E'],
};

const clean = (s: string) => s.replace(/^[\s,;:—-]+|[\s,;:.!?—-]+$/g, '').replace(/\s+/g, ' ');
const firstWords = (s: string, n: number) => {
  const w = clean(s).replace(/^(and|but|so|then|the|a|an)\s+/i, '').split(' ').slice(0, n);
  while (w.length > 1 && /^(the|a|an|of|to|and|with|in|on|at|for|by|from|was|were|is|are)$/i.test(w[w.length - 1])) w.pop();
  return w.join(' ').replace(/[,;:.!?—-]+$/, '');
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const PAST = /\b(\d+|ten|twenty|thirty|fifty|a hundred|a few)\s+(years|decades)\s+ago\b|\bback then\b|\bin the (19|20)\d0s\b|\bonce\b|\bused to\b|\bin (1[89]\d\d|20[01]\d)\b/i;
const NOW = /\b(today|now|these days|nowadays|this year)\b/i;

function thenVsNow(text: string, prev: string | undefined, style: string): Accent | null {
  const [colorA, colorB] = ERA_COLOURS[style] ?? ['#8D6E63', '#2A6FDB'];
  const label = (m: RegExpMatchArray) => cap(clean(m[0]).replace(/^in /i, ''));
  // both eras in one line: "Ten years ago … cash. Today … a QR code."
  const p = text.match(PAST);
  const n = text.match(NOW);
  if (p && n && (n.index ?? 0) > (p.index ?? 0)) {
    const pastPart = text.slice((p.index ?? 0) + p[0].length, n.index).replace(/^[\s,]+/, '');
    const nowPart = text.slice((n.index ?? 0) + n[0].length);
    return { id: 'thenVsNow', params: { labelA: label(p), textA: cap(firstWords(pastPart, 8)), labelB: 'Today', textB: cap(firstWords(nowPart, 8)), colorA, colorB } };
  }
  // past in the line before, present here
  const pp = prev?.match(PAST);
  if (pp && n && !p) {
    const pastPart = prev!.slice((pp.index ?? 0) + pp[0].length).replace(/^[\s,]+/, '');
    const nowPart = text.slice((n.index ?? 0) + n[0].length);
    return { id: 'thenVsNow', params: { labelA: label(pp), textA: cap(firstWords(pastPart, 8)), labelB: 'Today', textB: cap(firstWords(nowPart, 8)), colorA, colorB } };
  }
  return null;
}

function stickerList(text: string): Accent | null {
  // "farmers, traders and students" — 3 to 5 short items
  const m = text.match(/((?:[\w'’-]+(?:\s[\w'’-]+){0,2},\s+){2,4}(?:and|or)\s+[\w'’-]+(?:\s[\w'’-]+){0,2})/i);
  if (!m) return null;
  const items = m[1].split(/,\s+|\s+(?:and|or)\s+/i).map((s) => cap(clean(s))).filter((s) => s && s.split(' ').length <= 3);
  if (items.length < 3) return null;
  return { id: 'cardList', params: { items: items.slice(0, 5).join('; '), layout: 'list', highlight: 0 } };
}

function nameAndRole(text: string): Accent | null {
  const m = text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2}),\s+(?:a|an|the)\s+([a-z][a-z\s-]{3,40}?)(?:\s+(?:from|at|in|of)\s+([A-Z][\w\s]{2,30}?))?[,.]/);
  if (!m) return null;
  return { id: 'lowerThird', params: { text: m[1], subtitle: cap(clean(`${m[2]}${m[3] ? `, ${m[3]}` : ''}`)) } };
}

function headline(text: string): Accent | null {
  const m = text.match(/\b(reported|announced|declared|headlines?|newspapers?|according to)\b(.*)$/i);
  if (!m) return null;
  const line = firstWords(m[2].replace(/^\s*(that|:)\s*/i, ''), 9);
  if (line.split(' ').length < 3) return null;
  const words = line.split(' ');
  // a generic masthead — never a real publication's name
  return { id: 'newspaperZoom', params: { masthead: 'THE DAILY REPORT', text: cap(line), highlight: words.slice(-3).join(' ') } };
}

function stamp(text: string): Accent | null {
  const m = text.match(/\b(banned|illegal|approved|rejected|confirmed|fake|false|official|cancelled|denied|verified|classified|guilty)\b/i);
  return m ? { id: 'stampReveal', params: { text: m[1].toUpperCase(), rotate: -8 } } : null;
}

function keyPhrase(text: string): Accent | null {
  const m = text.match(/\b((?:the\s+)?(?:first|biggest|largest|fastest|only|oldest|cheapest|most|highest|lowest)\b[^,.;!?]{3,40}|(?:a\s+)?record[^,.;!?]{3,40}|more than[^,.;!?]{3,40})/i);
  if (!m) return null;
  return { id: 'markerHighlight', params: { text: firstWords(m[1], 7) } };
}

function twist(text: string): Accent | null {
  const m = text.match(/^\s*(But|Yet|However|Surprisingly|Instead|Then|Suddenly)\b/);
  return m ? { id: 'handwrittenNote', params: { text: `${m[1]}…`, size: 7, x: 18, y: 18, rotate: -6 } } : null;
}

/**
 * One accent for each scene that should get one (null = leave the picture alone).
 * `busy[i]` marks scenes that already have a full-screen explainer, so they are skipped.
 */
export function autoAccents(scenes: string[], vtype: VideoType | undefined, style: string, busy: boolean[] = []): Array<Accent | null> {
  const allowed = BY_TYPE[vtype ?? 'story'] ?? [];
  if (!allowed.length) return scenes.map(() => null);
  let last = -9;
  return scenes.map((text, i) => {
    if (i === 0 || busy[i] || i - last < 2) return null; // never on the title scene, never two in a row
    const tries: Array<[string, () => Accent | null]> = [
      ['thenVsNow', () => thenVsNow(text, scenes[i - 1], style)],
      ['lowerThird', () => nameAndRole(text)],
      ['newspaperZoom', () => headline(text)],
      ['stampReveal', () => stamp(text)],
      ['cardList', () => stickerList(text)],
      ['markerHighlight', () => keyPhrase(text)],
      ['handwrittenNote', () => twist(text)],
    ];
    for (const [id, make] of tries) {
      if (!allowed.includes(id)) continue;
      const a = make();
      if (a) {
        last = i;
        return a;
      }
    }
    return null;
  });
}

/** An accent as a directive, so it goes through the same path as a [tag] the writer typed. */
export const accentDirective = (a: Accent): Directive => ({ kind: 'graphic', id: a.id, params: a.params, raw: a.id });

/** An accent as script tag text: [thenVsNow labelA="…" …]. */
export function accentTag(a: { id: string; params: Record<string, string | number> }): string {
  const v = (x: string | number) => (typeof x === 'number' ? String(x) : `"${String(x).replace(/"/g, "'")}"`);
  return `[${a.id}${Object.entries(a.params).map(([k, x]) => ` ${k}=${v(x)}`).join('')}]`;
}

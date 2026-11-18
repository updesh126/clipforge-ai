/**
 * Rule-based explainer graphics for documentary / tech / fun videos.
 * Small local models rarely fill the planner's optional "motion" field, so these rules build the obvious ones
 * straight from the narration — using only words and numbers that are actually said:
 *   a "quotation" … wrote/said X   → quoteStatement
 *   two or more years in a scene   → timelineHistory
 *   "in YEAR … N … by YEAR … M"    → comparison
 *   "first … then … finally …"     → processExplain
 *   a question that the next scene answers → questionReveal (fun)
 *   a country or a known city               → mapInvestigation (real Natural Earth map, zoom + pin + info card)
 */
import { ALIASES, CITY_COUNTRY, COUNTRY_NAMES } from '../src/motion/places.ts';
export interface AutoMotion {
  id: string;
  params: Record<string, string | number>;
}

const YEAR = /\b(1[0-9]{3}|20[0-9]{2})\b/g;
/** First n words of a phrase, as a clean label: no leading article, no trailing punctuation or dangling little word. */
const words = (s: string, n: number) => {
  const w = s.replace(/^[\s,;:—-]*(the|a|an)\s+/i, '').split(/\s+/).filter(Boolean).slice(0, n);
  while (w.length > 1 && /^(the|a|an|of|to|through|and|with|in|on|at|for|by|from|over|its|their|his|her)$/i.test(w[w.length - 1].replace(/[^\w]/g, ''))) w.pop();
  return w.join(' ').replace(/[.!?;:,]+$/g, '');
};

/** Last n words before a year ("…, finishing in 1653" → "finishing"), cleaned the same way. */
const lastWords = (s: string, n: number) => {
  const w = s.trim().split(/\s+/).filter(Boolean).slice(-n);
  while (w.length && /^(and|then|so|but|the|a|an)$/i.test(w[0])) w.shift();
  return words(w.join(' '), n);
};

function quote(text: string): AutoMotion | null {
  const m = text.match(/["“]([^"”]{12,220})["”]/);
  if (!m) return null;
  const q = m[1].trim().replace(/[,.]$/, '');
  const src = text.match(/(?:wrote|said|says|writes|asked|explained)\s+(?:the\s+)?(?:\w+\s+)?([A-Z][\w.]*(?:\s+[A-Z][\w.]*){0,3})/)?.[1] ?? text.match(/[”"]\s*[—-]\s*([A-Z][\w.]*(?:\s+[A-Z][\w.]*){0,3})/)?.[1] ?? '';
  const qw = q.split(/\s+/);
  const highlight = qw.slice(Math.max(0, qw.length - 3)).join(' ').replace(/[,.]$/, '');
  return { id: 'quoteStatement', params: { text: q, highlight, source: src.replace(/[.,;]+$/, '') } };
}

function timeline(text: string): AutoMotion | null {
  const hits = [...text.matchAll(YEAR)];
  const years = [...new Set(hits.map((h) => h[1]))];
  if (years.length < 2) return null;
  const events = years.slice(0, 5).map((y) => {
    const at = text.indexOf(y);
    // the clause after the year ("1653 — finishing it"), else the words before it
    const after = text.slice(at + y.length).split(/[.;]|,\s*(?=\w+\s+\d)/)[0];
    const before = text.slice(0, at).split(/[.;,]/).pop() ?? '';
    const label = words(after.replace(/^[\s,]*(it|they|he|she)?\s*/i, ''), 5) || lastWords(before, 5);
    return `${y}|${label || 'milestone'}`;
  });
  return { id: 'timelineHistory', params: { events: events.join('; ') } };
}

function comparison(text: string): AutoMotion | null {
  // "in 2016 … 0.1 million payments a month; by 2024 … 13,000 million" (decimals allowed; never crosses a sentence)
  const m = text.match(/\b(?:in|by|from)\s+(1\d{3}|20\d{2})\b[^;]*?\b(\d[\d,]*(?:\.\d+)?)\s*(million|crore|lakh|billion|thousand|%|percent)?([^;.]*)[;,.]?\s*[^;]*?\b(?:by|in|to)\s+(1\d{3}|20\d{2})\b[^;]*?\b(\d[\d,]*(?:\.\d+)?)\s*(million|crore|lakh|billion|thousand|%|percent)?/i);
  if (!m) return null;
  const a = Number(m[2].replace(/,/g, ''));
  const b = Number(m[6].replace(/,/g, ''));
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  const unit = (m[7] || m[3] || '').toLowerCase();
  // the words after the first number ("payments a month") say what is being compared
  const what = words(m[4].replace(/^[\s,]*(of\s+)?/i, ''), 4);
  const title = `${what ? what.charAt(0).toUpperCase() + what.slice(1) : 'Then and now'}${unit ? ` (${unit})` : ''}`;
  return { id: 'comparison', params: { title, labelA: m[1], valueA: a, labelB: m[5], valueB: b } };
}

function process_(text: string): AutoMotion | null {
  if (!/\bfirst\b/i.test(text) || !/\b(then|next|finally|after that)\b/i.test(text)) return null;
  const body = text.slice(text.search(/\bfirst\b/i));
  const parts = body
    .split(/\b(?:first|then|next|finally|after that|and then)\b|,\s*and\s+|\s+and\s+|;\s*/i)
    .map((p) => words(p.replace(/^[\s,]*(it|your bank|the bank)?\s*/i, ''), 5))
    .filter((p) => p.length > 2);
  if (parts.length < 3) return null;
  return { id: 'processExplain', params: { steps: parts.slice(0, 5).join('; ') } };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Longest names first, so "South Korea" wins over "Korea" and "New Delhi" over "Delhi". */
const PLACE_NAMES: Array<[string, string, string | null]> = [
  ...COUNTRY_NAMES.map((n) => [n, n, null] as [string, string, string | null]),
  ...Object.entries(ALIASES).filter(([k]) => k.length > 2).map(([k, v]) => [k, v, null] as [string, string, string | null]),
  ...Object.entries(CITY_COUNTRY).map(([city, country]) => [city, country, city] as [string, string, string | null]),
].sort((a, b) => b[0].length - a[0].length);
const PLACE_RE = new RegExp(`\\b(${PLACE_NAMES.map(([n]) => escapeRe(n)).join('|')})\\b`, 'i');

function place(text: string, earlier = ''): AutoMotion | null {
  // every place named in the line; the news is a place not talked about before ("beyond India … now France" → France)
  const found = [...text.matchAll(new RegExp(PLACE_RE.source, 'gi'))]
    .map((m) => PLACE_NAMES.find(([n]) => n.toLowerCase() === m[1].toLowerCase()))
    .filter((h): h is [string, string, string | null] => Boolean(h));
  if (!found.length) return null;
  const seenBefore = (h: [string, string, string | null]) => new RegExp(`\\b${escapeRe(h[0])}\\b`, 'i').test(earlier) || (!h[2] && new RegExp(`\\b${escapeRe(h[1])}\\b`, 'i').test(earlier));
  const fresh = found.filter((h) => !seenBefore(h));
  const others = found.filter((h) => h[1] !== found[0][1]);
  // a new place wins; else, with two places in the line, the later one (the destination); else the only one
  const hit = fresh.length ? fresh[fresh.length - 1] : others.length ? found[found.length - 1] : found[0];
  const [, country, city] = hit;
  // a city named later in the same scene pins the map; otherwise the country's name is the pin label
  const cityHit = city ?? Object.keys(CITY_COUNTRY).find((c) => CITY_COUNTRY[c] === country && new RegExp(`\\b${escapeRe(c)}\\b`, 'i').test(text)) ?? null;
  const title = (s: string) => s.replace(/\b\w/g, (ch) => ch.toUpperCase());
  return { id: 'mapInvestigation', params: { country, city: cityHit ? title(cityHit) : country, note: words(text, 9) } };
}

function question(text: string, next: string | undefined): AutoMotion | null {
  const q = text.match(/([^.!?]{8,120}\?)/)?.[1]?.trim();
  if (!q || !next) return null;
  return { id: 'questionReveal', params: { text: q, answer: words(next, 12) } };
}

/** Years spread over several scenes → one timeline on the scene with the last of them. */
function scriptTimeline(scenes: string[]): { at: number; motion: AutoMotion } | null {
  const marks: Array<{ y: string; scene: number; label: string }> = [];
  scenes.forEach((text, i) => {
    for (const h of text.matchAll(YEAR)) {
      if (marks.some((m) => m.y === h[1])) continue;
      const after = text.slice((h.index ?? 0) + h[1].length).split(/[.;]/)[0];
      const before = text.slice(0, h.index ?? 0).split(/[.;,]/).pop() ?? '';
      marks.push({ y: h[1], scene: i, label: words(after.replace(/^[\s,]*(it|they|he|she)?\s*/i, ''), 5) || lastWords(before, 5) });
    }
  });
  if (marks.length < 2 || new Set(marks.map((m) => m.scene)).size < 2) return null;
  const sorted = [...marks].sort((a, b) => Number(a.y) - Number(b.y)).slice(0, 5);
  return { at: Math.max(...sorted.map((m) => m.scene)), motion: { id: 'timelineHistory', params: { events: sorted.map((m) => `${m.y}|${m.label || 'milestone'}`).join('; ') } } };
}

/** Explainer sequences for each scene (null = none), limited to `allowed` ids. */
export function autoSequences(scenes: string[], allowed: string[]): Array<AutoMotion | null> {
  const wide = allowed.includes('timelineHistory') ? scriptTimeline(scenes) : null;
  const mapped = new Set<string>(); // one map per country — a second one adds nothing
  return scenes.map((text, i) => {
    if (wide && wide.at === i) return wide.motion;
    const tries: Array<[string, () => AutoMotion | null]> = [
      ['quoteStatement', () => quote(text)],
      ['comparison', () => comparison(text)],
      ['timelineHistory', () => timeline(text)],
      ['mapInvestigation', () => place(text, scenes.slice(0, i).join(' '))],
      ['processExplain', () => process_(text)],
      ['questionReveal', () => question(text, scenes[i + 1])],
    ];
    for (const [id, make] of tries) {
      if (!allowed.includes(id)) continue;
      const m = make();
      if (m && m.id === 'mapInvestigation') {
        const key = String(m.params.country);
        if (mapped.has(key)) continue;
        mapped.add(key);
      }
      if (m) return m;
    }
    return null;
  });
}

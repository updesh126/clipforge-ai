/**
 * Keep writing out of AI paintings. Stable Diffusion paints fake letters whenever the prompt mentions things that
 * carry text (logos, headlines, signs, screens "showing" something), quoted words or numbers — so those are taken
 * out or turned into blank versions, and a strong weighted no-text negative is always added.
 */

/** The no-text negative, weighted so SDXL takes it seriously (ComfyUI "(…:1.3)" syntax). */
export const NO_TEXT_NEGATIVE =
  '(text, letters, words, writing, typography, caption, subtitles, numbers, digits, watermark, signature, logo, brand name, label text, signage text, gibberish lettering, written characters:1.35)';

/** Things that usually carry writing → their blank version. */
const BLANKS: Array<[RegExp, string]> = [
  [/\b(signboards?|signs?|shop signs?|street signs?|billboards?|banners?|posters?|placards?|nameplates?|plaques?)\b/gi, 'blank $1'],
  [/\b(price tags?|labels?|tags)\b/gi, 'plain $1'],
  // print can't be painted without fake letters — paper stays paper (the [newspaperZoom] graphic shows real words)
  [/\b(newspapers?|magazines?|documents?|reports?|letters? on paper|notebooks?|pages?|leaflets?|brochures?|menus?)\b/gi, 'folded plain grey paper'],
  [/\b(books?)\b/gi, 'closed $1'],
];

/** Make a painting prompt free of text triggers. Safe to run twice. */
export function noTextPrompt(prompt: string): string {
  let p = ` ${prompt} `;
  // quoted words would be painted as lettering
  p = p.replace(/[“"]([^”"]{1,120})[”"]/g, ' ').replace(/'([^']{3,60})'/g, ' ');
  // "a screen showing the UPI logo and 3.5 billion transactions" → "a screen with soft abstract glowing shapes"
  p = p.replace(/\b(showing|displaying|reading|that reads|that says|which says|with the words?|with the text|labelled|labeled|written|spelling out|counting)\b[^,.;]*/gi, 'with soft abstract glowing shapes');
  // logos, headlines, titles, acronyms and the word "text" itself
  p = p.replace(/\b(?:the\s+)?(?:[A-Z][\w-]*\s+)?logos?\b/g, 'a simple abstract emblem');
  p = p.replace(/\b(headlines?|captions?|titles?|typography|lettering|slogans?|text|words|letters|acronyms?|hashtags?|subtitles?)\b/gi, ' ');
  // numbers become counts SD can't spell ("249 banks" → "many banks"); years and stray digits go
  p = p.replace(/\b\d[\d,.]*\s*(%|percent|million|billion|crore|lakh|thousand|hundred)?\s+(?=[a-z])/gi, 'many ');
  p = p.replace(/\b\d[\d,.:/%-]*\b/g, ' ');
  // all-caps brand-like words (UPI, NPCI) are spelled out as letters by SD
  p = p.replace(/\b[A-Z]{2,6}\b/g, (w) => (/^(QR|TV|LED|DNA|ATM)$/.test(w) ? w : ' '));
  for (const [re, to] of BLANKS) p = p.replace(re, (m, g1: string) => (/blank|plain|blurred/.test(p.slice(Math.max(0, p.indexOf(m) - 8), p.indexOf(m))) ? m : to.replace('$1', g1)));
  return p
    .replace(/\s+([,.;])/g, '$1')
    .replace(/(,\s*){2,}/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '');
}

/** Add the no-text negative once. */
export function withNoTextNegative(negative: string): string {
  return negative.includes('gibberish lettering') ? negative : [negative, NO_TEXT_NEGATIVE].filter(Boolean).join(', ');
}

/**
 * A ready-made prompt for writing a ClipForge script with another AI (ChatGPT, Claude, Gemini…): the format,
 * the scene tags ([place:], [scene:], [time:]), the effect tags that suit the video type (taken from the real
 * catalogue, so only tags ClipForge understands are taught), a structure and a short example.
 * Also: checkScript() — what ClipForge will make of a pasted script (scenes, tags it knows, tags it will skip).
 */
import { SEQUENCES } from '../src/motion/sequences.ts';
import { EFFECTS_LIB } from '../src/motion/catalog.ts';
import { VIDEO_TYPES, isVideoType, type VideoType } from '../src/videotypes.ts';
import { parseTag, scenesWithDirectives, tokeniseScript } from './directives.ts';
import { splitScenes } from './scriptVideo.ts';

type Tag = { id: string; example: string; when: string };

/** Effect tags worth teaching, per video type — example syntax + when to use it. */
const TAGS: Record<VideoType, Tag[]> = {
  story: [
    { id: 'quoteStatement', example: '[quoteStatement text="Fireflies need the dark." source="Old fisherman"]', when: 'a line someone says that matters' },
    { id: 'rainFx', example: '[rainFx]', when: 'rain in the scene' },
    { id: 'fireflyGlow', example: '[fireflyGlow]', when: 'magical night, fireflies' },
    { id: 'embers', example: '[embers]', when: 'fire, warmth, danger' },
    { id: 'lightRays', example: '[lightRays]', when: 'hope, morning, a reveal' },
    { id: 'snowFx', example: '[snowFx]', when: 'snow, winter' },
  ],
  documentary: [
    { id: 'bigStat', example: '[bigStat value=3.5 suffix=" billion" label="payments every month"]', when: 'one big number' },
    { id: 'timelineHistory', example: '[timelineHistory events="1947|Independence; 1991|Reforms; 2016|UPI launched"]', when: 'dates across history' },
    { id: 'mapInvestigation', example: '[mapInvestigation country="France" city="Paris" note="Shops now accept UPI"]', when: 'a country or city (shown on a real map)' },
    { id: 'comparison', example: '[comparison title="Payments a month" labelA=2016 valueA=0.1 labelB=2024 valueB=13000]', when: 'two numbers, before and after' },
    { id: 'thenVsNow', example: '[thenVsNow labelA="10 years ago" textA="Cash for everything" labelB="Today" textB="A QR code at every stall"]', when: 'how things changed' },
    { id: 'quoteStatement', example: '[quoteStatement text="We had no idea it would spread this fast." source="Bank official"]', when: 'a real quotation' },
    { id: 'lowerThird', example: '[lowerThird text="Nandan Nilekani" subtitle="Tech entrepreneur"]', when: 'a real person is named' },
    { id: 'newspaperZoom', example: '[newspaperZoom masthead="THE DAILY REPORT" text="New payment system launched" highlight="launched"]', when: 'news, a report, an announcement' },
    { id: 'stampReveal', example: '[stampReveal text="BANNED"]', when: 'banned, approved, fake, official' },
    { id: 'evidence', example: '[evidence title="Report, 2024" text="Inspectors found the lights were installed without any study." highlight="without any study"]', when: 'a document or finding' },
  ],
  tech: [
    { id: 'processExplain', example: '[processExplain steps="Scan the code; Enter the PIN; Money moves"]', when: 'steps of how it works' },
    { id: 'comparison', example: '[comparison title="Time to pay" labelA="Card" valueA=30 labelB="UPI" valueB=3]', when: 'two numbers side by side' },
    { id: 'chartExplain', example: '[chartExplain title="Payments by app" data="App A:48, App B:35, Others:17" highlight="App A"]', when: 'a few numbers to compare' },
    { id: 'causeEffect', example: '[causeEffect steps="Phones got cheap; Data got cheap; Everyone pays by phone"]', when: 'one thing leads to another' },
    { id: 'questionReveal', example: '[questionReveal text="So how does the money move?" answer="Through a shared network every bank joins"]', when: 'a question the next line answers' },
    { id: 'cardList', example: '[cardList items="Fast; Free; Works on any bank"]', when: 'three short points' },
    { id: 'bigStat', example: '[bigStat value=249 label="banks connected"]', when: 'one big number' },
  ],
  fun: [
    { id: 'questionReveal', example: '[questionReveal text="Can fireflies talk?" answer="Yes — with light"]', when: 'a fun question' },
    { id: 'mythVsFact', example: '[mythVsFact textA="Fireflies only live in jungles" textB="They thrive near rivers and fields"]', when: 'busting a myth' },
    { id: 'rankingCountdown', example: '[rankingCountdown title="Brightest spots" data="Kochi:92, Goa:88, Coorg:85"]', when: 'a countdown or ranking' },
    { id: 'bigStat', example: '[bigStat value=2000 suffix="+" label="firefly species"]', when: 'a surprising number' },
    { id: 'stampReveal', example: '[stampReveal text="FAKE"]', when: 'a myth is busted' },
    { id: 'confetti', example: '[confetti]', when: 'a celebration' },
  ],
};

/** Moves and cuts every type can use. */
const COMMON: Tag[] = [
  { id: 'markerHighlight', example: '[markerHighlight text="the biggest payment system"]', when: 'stress a key phrase said in that line' },
  { id: 'pushIn', example: '[pushIn]', when: 'camera moves closer — emotion' },
  { id: 'pullOut', example: '[pullOut]', when: 'camera pulls back — endings' },
  { id: 'panRight', example: '[panRight]', when: 'camera pans to reveal' },
  { id: 'zoomPunch', example: '[zoomPunch]', when: 'a punchline' },
  { id: 'paperTearTransition', example: '[transition: paperTearTransition]', when: 'a new chapter starts' },
  { id: 'move', example: '[move]', when: 'this scene should become a moving clip' },
];

const STRUCTURE: Record<VideoType, string> = {
  story: `1. HOOK: one surprising line, with a place and one striking thing.
2. WORLD: where and when; a place, a time and 1-2 things we see.
3. CHARACTER: who it's about, described once (an old fisherman, a girl with a lantern).
4. WANT: what they want or what is normal.
5. CHANGE: something happens (a storm, a tiger, a letter).
6. STRUGGLE: what they do; action verbs.
7. TURN: the key moment; a quote works well.
8. RESULT: what changed; the same place at a new time.
9. CLOSE: the line to remember.`,
  documentary: `1. HOOK: a surprising fact or question, with a real place.
2. THEN vs NOW: "Ten years ago … Today …".
3. CONTEXT: when and who, with a year.
4. HOW IT WORKS: what we would see happening.
5. THE NUMBER: one big figure, in its own sentence.
6. THE WIDER WORLD: another country or city.
7. THE TURN: "But …" — a problem, a record or a ban.
8. CLOSE: what it means for the viewer.`,
  tech: `1. PROBLEM: what was slow, costly or hard.
2. QUESTION: "So how does it work?" (the next line answers it).
3. STEPS: "First … then … finally …" in one paragraph.
4. COMPARISON: "In 2016 … X; by 2024 … Y".
5. LIST: three short items, "A, B and C".
6. THE NUMBER: one big figure.
7. TAKEAWAY: what to remember or do.`,
  fun: `1. QUESTION: a curious question the next line answers.
2. MYTH: what people believe.
3. FACT: "But actually …".
4. COUNTDOWN or LIST: three to five short items.
5. SURPRISE: "the biggest / the first / a record …".
6. CLOSE: a punchline.`,
};

const EXAMPLE: Record<VideoType, string> = {
  story: `[title: The Night the Fireflies Left] [place: quiet river bank in Kerala] [time: night] Every summer night, a tiny village in Kerala glows with fireflies. [scene: hundreds of fireflies glowing over tall grass beside a calm river, coconut trees behind] [fireflyGlow]

Meera is a girl with a lantern who loves them more than anything. [scene: a young girl in a yellow dress holding up a small oil lantern at the water's edge] [pushIn]

One evening, not a single firefly rises from the grass. [scene: the same river bank, dark and empty, the girl looking around worried] [move]`,
  documentary: `[title: How UPI Changed India] [place: busy old market street in Mumbai] Ten years ago, almost every payment in this market was made in cash. [scene: a shopkeeper counting stacks of paper money at a crowded market stall]

Today a vegetable seller simply holds up a QR code. [scene: a vegetable seller on a wooden cart holding up a phone next to a QR code sticker] [thenVsNow labelA="10 years ago" textA="Cash for everything" labelB="Today" textB="A QR code at every stall"]

Over 3.5 billion payments now happen every month. [place: bank control room] [scene: a wall of screens with soft glowing network lines in a dark control room] [bigStat value=3.5 suffix=" billion" label="payments every month"]`,
  tech: `[title: How a UPI Payment Works] [place: small tea stall] Paying by phone feels instant, but a lot happens in one second. [scene: a customer holding a phone towards a QR code at a tea stall counter]

First the app reads the code, then your bank checks your PIN, and finally the money moves. [place: bank server room] [scene: rows of servers with blinking lights in a cool blue room] [processExplain steps="App reads the code; Bank checks the PIN; Money moves"]

It works with 249 banks, and it is free. [scene: a tea seller smiling as his phone lights up] [bigStat value=249 label="banks connected"]`,
  fun: `[title: Can Fireflies Talk?] [place: dark garden at night] Can fireflies actually talk to each other? [scene: two fireflies glowing on a leaf in a dark garden] [questionReveal text="Can fireflies talk?" answer="Yes — with light"]

Most people think fireflies only live in jungles. [scene: a thick misty jungle with tall trees]

But actually, they love rivers and open fields. [place: open field by a river] [scene: fireflies glowing over a wide field next to a river] [mythVsFact textA="Only in jungles" textB="Rivers and fields"]`,
};

const LANG: Record<string, string> = { same: 'the same language as the topic or source', en: 'English', hi: 'Hindi (Devanagari script)' };

/** Only tags ClipForge really has (guards against catalogue renames). */
const exists = (t: Tag) => ['pushIn', 'pullOut', 'panRight', 'zoomPunch', 'move'].includes(t.id) || Boolean(SEQUENCES[t.id] || EFFECTS_LIB[t.id]);

export function externalPrompt(opts: { videoType?: string; minutes?: number; language?: string }): string {
  const vtype: VideoType = isVideoType(opts.videoType) ? opts.videoType : 'story';
  const minutes = Math.max(0.5, Math.min(10, Number(opts.minutes) || 1.5));
  const words = Math.round(minutes * 150);
  const paras = Math.max(5, Math.round(words / 22));
  const lang = LANG[opts.language ?? 'same'] ?? LANG.same;
  const tags = [...TAGS[vtype], ...COMMON].filter(exists);
  return `You are a scriptwriter for ClipForge, an app that turns a script into a narrated, illustrated video: every paragraph becomes one scene with an AI-painted picture, a voice-over, captions and motion graphics.

Write a ${VIDEO_TYPES[vtype].label.toLowerCase()} script about the TOPIC below: about ${words} words (≈${minutes} min of voice-over), ${paras}–${paras + 3} paragraphs, in ${lang}.

## Format — follow exactly
- One paragraph per scene: 1–2 short sentences (8–25 words). One blank line between paragraphs.
- The words are read aloud exactly as written: no headings, no "Scene 1:", no stage directions, no emojis, no markdown, no bullet points.
- Numbers in digits (249, 3.5 billion, 2016). Quotations in "double quotes".
- Directions go in [square brackets] at the END of a paragraph. They are never spoken.
- Keep every fact true. Never invent numbers, names or quotes.

## Scene tags — what the picture shows (use them on every paragraph)
- [place: …] — the real setting in 2–6 words ("busy market street in Mumbai", "bank server room"). Write it on the first paragraph and whenever the place changes; it carries on to the next paragraphs.
- [scene: …] — exactly what the picture shows, ONE concrete sentence of 10–20 words: the real subject, objects and action of that line. No text, signs, screens with writing, logos or brand names in the picture.
- [time: day] / [time: sunset] / [time: night] / [time: dawn] — only when the light matters; it carries on.
- First paragraph only: [title: a short video title].
- Call each person by the same name every time, and describe them once ("an old fisherman in a blue shirt").

## Effect tags — use on 2–5 key moments only (never two in a row)
${tags.map((t) => `- ${t.example} — ${t.when}`).join('\n')}
Use ONLY numbers and words that are in that paragraph. If unsure, leave the effect out — ClipForge adds graphics by itself.

## Structure
${STRUCTURE[vtype]}

## Example (format only — do not copy the content)
${EXAMPLE[vtype]}

Reply with ONLY the script — no introduction, no notes, no code block.

TOPIC / NOTES / SOURCE:
<<paste your topic, notes or a video transcript here>>
`;
}

/** What ClipForge will do with a pasted script: scenes, tags it knows and tags it will skip. */
export function checkScript(script: string) {
  const { script: tok, tags } = tokeniseScript(script);
  const scenes = scenesWithDirectives(splitScenes(tok), tags);
  const all = [...script.matchAll(/\[([^[\]\n]{1,600})\]/g)].map((m) => m[1]);
  const unknown = all.filter((t) => !parseTag(t));
  const spoken = script.replace(/\[[^[\]\n]{1,600}\]/g, ' ').trim();
  const words = spoken ? spoken.split(/\s+/).length : 0;
  // things that would be read aloud by mistake
  const problems: string[] = [];
  if (/^\s*(#|\*\*|scene\s*\d+\s*[:.-])/im.test(script)) problems.push('It has headings or "Scene 1:" labels — those would be read aloud. Remove them.');
  if (/```/.test(script)) problems.push('It is wrapped in a code block (```). Remove the ``` lines.');
  if (/^\s*[-*•]\s/m.test(script)) problems.push('It has bullet points — write plain paragraphs instead.');
  if (/\((?:camera|cut|scene|visual|music|sfx)[^)]*\)/i.test(script)) problems.push('It has stage directions in (round brackets) — those would be read aloud. Use [square-bracket] tags.');
  return {
    scenes: scenes.length,
    words,
    seconds: Math.round(words / 2.5),
    tags: all.length,
    unknown,
    problems,
    withPicture: scenes.filter((s) => s.directives.some((d) => d.kind === 'scene')).length,
  };
}

import type { WordTiming } from '../types.ts';

/** The longest word of four or more letters gets the accent (mirrors server/styledCaptions.ts keyWordIndex). */
function keyWordIndex(words: { text: string }[]): number {
  let best = -1,
    len = 3;
  words.forEach((w, i) => {
    const n = w.text.replace(/[^\p{L}\p{N}]/gu, '').length;
    if (n > len) {
      len = n;
      best = i;
    }
  });
  return best;
}

const FONT = {
  creator: '"Anton", "Bebas Neue", Impact, "Arial Narrow", sans-serif',
  chalk: '"Kalam", "Segoe Print", "Comic Sans MS", cursive',
  cleantech: '"Inter Tight", "Segoe UI", system-ui, sans-serif',
};

/** Live preview of the creator / chalk / cleantech captions. The export (HyperFrames) adds the full motion. */
export function StyledCaptionPreview({
  look,
  words,
  current,
  portrait,
}: {
  look: 'creator' | 'chalk' | 'cleantech';
  words: WordTiming[];
  current: number;
  portrait: boolean;
}) {
  const key = words.length > 1 || (words[0]?.text.length ?? 0) > 5 ? keyWordIndex(words) : -1;
  const plate =
    look === 'chalk'
      ? 'rounded-md border-[5px] border-[#8a5a31] bg-[#24392f] px-3 py-1 text-[#f2efe6] shadow-xl [text-shadow:0_0_2px_rgba(242,239,230,.7)]'
      : look === 'cleantech'
        ? 'rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[#0d0f14] shadow-xl tracking-tight'
        : 'uppercase text-[#f4f1ea] [text-shadow:0_2px_10px_rgba(0,0,0,.85),0_0_2px_#000]';
  const size = look === 'creator' ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl';
  return (
    <div className={`pointer-events-none absolute inset-x-3 flex justify-center ${portrait ? 'bottom-[20%]' : 'bottom-6'}`}>
      <p
        style={{ fontFamily: FONT[look], fontWeight: look === 'creator' ? 400 : 800 }}
        className={`text-center leading-tight ${size} ${plate}`}
      >
        {words.map((w, i) => {
          const shown = i <= current;
          const accent = i === key && i <= current;
          let cls = 'mx-[0.14em] inline-block transition-all duration-150 ';
          cls += shown ? 'opacity-100 translate-y-0 scale-100 ' : look === 'creator' ? 'opacity-0 scale-125 blur-[2px] ' : 'opacity-0 translate-y-2 ';
          if (accent && look === 'creator') cls += 'bg-[#ffd60a] px-1 text-[#0b0b0c] [text-shadow:none] ';
          if (accent && look === 'chalk') cls += 'text-[#f39bbb] underline decoration-[#f4d35e] decoration-2 underline-offset-4 ';
          if (accent && look === 'cleantech') cls += 'rounded-md bg-[#2f5bff] px-1.5 text-white ';
          return (
            <span key={i} className={cls}>
              {w.text}
            </span>
          );
        })}
      </p>
    </div>
  );
}

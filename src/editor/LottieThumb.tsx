import { useEffect, useRef, useState } from 'react';

type Anim = { goToAndStop: (v: number, isFrame?: boolean) => void; play: () => void; destroy: () => void; totalFrames: number };

/**
 * Lottie preview for library tiles: loads when it scrolls into view, rests on a frame from the middle of the
 * animation, and plays while hovered. Falls back to a "▶ Lottie" label if the file can't be read.
 */
export function LottieThumb({ url, name }: { url: string; name: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const anim = useRef<Anim | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !box.current) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ default: lottie }, data] = await Promise.all([import('lottie-web'), fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))]);
        if (cancelled || !box.current) return;
        const a = lottie.loadAnimation({ container: box.current, renderer: 'svg', loop: true, autoplay: false, animationData: data, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } }) as unknown as Anim;
        anim.current = a;
        const rest = () => a.goToAndStop(Math.floor((a.totalFrames || 1) * 0.4), true);
        if (a.totalFrames) rest();
        else (a as unknown as { addEventListener: (e: string, f: () => void) => void }).addEventListener('DOMLoaded', rest);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
      anim.current?.destroy();
      anim.current = null;
    };
  }, [visible, url]);

  if (failed) return <span className="grid aspect-square w-full place-items-center bg-lavender/10 text-[10px] font-semibold text-lavender">▶ Lottie</span>;
  return (
    <span
      ref={box}
      role="img"
      aria-label={`${name} (Lottie animation)`}
      onMouseEnter={() => anim.current?.play()}
      onMouseLeave={() => { const a = anim.current; if (a) a.goToAndStop(Math.floor((a.totalFrames || 1) * 0.4), true); }}
      className="relative block aspect-square w-full [&>svg]:!h-full [&>svg]:!w-full"
    >
      <span className="pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-black/70 px-1 text-[8px] font-semibold text-lavender">LOTTIE</span>
    </span>
  );
}

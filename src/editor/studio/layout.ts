import { useCallback, useEffect, useState } from 'react';

/** Pane sizes and visibility for the Studio editor, remembered in this browser. */
export interface StudioLayout {
  chat: boolean; // chat column shown
  library: boolean; // library fills the chat column (composer stays at its foot)
  chatW: number;
  inspector: boolean;
  inspW: number;
  tlH: number;
}

export const LAYOUT_LIMITS = { chatW: [300, 720], inspW: [260, 560], tlH: [130, 560] } as const;
export const DEFAULT_LAYOUT: StudioLayout = { chat: true, library: false, chatW: 380, inspector: true, inspW: 320, tlH: 240 };

/** Named arrangements, as in OpenFilm's Layout menu. */
export const PRESETS: Array<{ id: string; label: string; hint: string; apply: (l: StudioLayout) => StudioLayout }> = [
  { id: 'standard', label: 'Standard', hint: 'Chat, viewer, inspector and timeline', apply: (l) => ({ ...l, chat: true, library: false, inspector: true }) },
  { id: 'library', label: 'Library', hint: 'The library open in the chat column', apply: (l) => ({ ...l, chat: true, library: true, inspector: true }) },
  { id: 'focus', label: 'Focus', hint: 'Just the viewer and the timeline', apply: (l) => ({ ...l, chat: false, inspector: false }) },
];

const KEY = 'clipforge.studio.layout';
const clamp = (v: number, [a, b]: readonly [number, number]) => Math.min(b, Math.max(a, v));

function load(): StudioLayout {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<StudioLayout> | null;
    if (!raw) return DEFAULT_LAYOUT;
    const l = { ...DEFAULT_LAYOUT, ...raw };
    return { ...l, chatW: clamp(l.chatW, LAYOUT_LIMITS.chatW), inspW: clamp(l.inspW, LAYOUT_LIMITS.inspW), tlH: clamp(l.tlH, LAYOUT_LIMITS.tlH) };
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function useStudioLayout() {
  const [layout, setLayout] = useState<StudioLayout>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      /* storage blocked: layout just isn't remembered */
    }
  }, [layout]);
  const set = useCallback((patch: Partial<StudioLayout>) => setLayout((l) => {
    const n = { ...l, ...patch };
    return { ...n, chatW: clamp(n.chatW, LAYOUT_LIMITS.chatW), inspW: clamp(n.inspW, LAYOUT_LIMITS.inspW), tlH: clamp(n.tlH, LAYOUT_LIMITS.tlH) };
  }), []);
  return { layout, set, reset: () => setLayout(DEFAULT_LAYOUT) };
}

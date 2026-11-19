import { useRef } from 'react';

/**
 * A 1px divider between Studio panes with a wider invisible grab area. Drag to resize; double-click to reset.
 * `sign` flips the direction for panes on the right or bottom (dragging towards them makes them bigger).
 */
export function Splitter({ dir, value, sign = 1, onChange, onReset, label }: { dir: 'x' | 'y'; value: number; sign?: 1 | -1; onChange: (v: number) => void; onReset?: () => void; label: string }) {
  const start = useRef<{ p: number; v: number } | null>(null);
  const vertical = dir === 'x';
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      tabIndex={0}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 40 : 10;
        if ((vertical && e.key === 'ArrowLeft') || (!vertical && e.key === 'ArrowUp')) onChange(value - step * sign);
        if ((vertical && e.key === 'ArrowRight') || (!vertical && e.key === 'ArrowDown')) onChange(value + step * sign);
      }}
      onDoubleClick={onReset}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        start.current = { p: vertical ? e.clientX : e.clientY, v: value };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const d = (vertical ? e.clientX : e.clientY) - start.current.p;
        onChange(start.current.v + d * sign);
      }}
      onPointerUp={() => (start.current = null)}
      onPointerCancel={() => (start.current = null)}
      className={`group relative z-20 shrink-0 bg-black outline-none ${vertical ? 'w-px cursor-col-resize' : 'h-px cursor-row-resize'}`}
    >
      <span className={`absolute ${vertical ? '-left-1 -right-1 inset-y-0' : '-top-1 -bottom-1 inset-x-0'} group-hover:bg-accent/30 group-focus-visible:bg-accent/50`} />
    </div>
  );
}

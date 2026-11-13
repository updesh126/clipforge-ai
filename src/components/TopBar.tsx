import { Plus } from 'lucide-react';
import type { AppTab } from '../types.ts';

interface TopBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onNewVideo: () => void;
}

export function TopBar({ activeTab, onSelectTab, onNewVideo }: TopBarProps) {
  const navItems: Array<{ id: AppTab; label: string }> = [
    { id: 'studio', label: 'Studio' },
    { id: 'library', label: 'Library' },
    { id: 'architecture', label: 'Architecture' },
  ];

  return (
    <header className="h-14 shrink-0 border-b border-zinc-900 bg-black px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single-line brand wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('studio')}
        className="font-display text-base font-semibold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-zinc-200 transition-colors cursor-pointer"
      >
        ClipForge AI
      </button>

      {/* Zone 2: Concise single-line navigation links */}
      <nav className="flex items-center gap-7 text-sm">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-4 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-[2px] bg-[#4F8BFF]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onNewVideo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F8BFF] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#3b7af5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          New Video
        </button>
      </div>
    </header>
  );
}

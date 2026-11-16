import { useState } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';

export interface ChatMsg {
  role: 'user' | 'ai' | 'error';
  text: string;
}

interface Props {
  messages: ChatMsg[];
  busy: boolean;
  onSend: (text: string) => void;
}

const SUGGESTIONS = [
  'Make the opening punchier',
  'Add a Vox-style stat where a number is said',
  'Highlight the key sentence with a marker',
  'Add a lower third for the speaker',
  'Switch captions to pop style',
];

export function AiPanel({ messages, busy, onSend }: Props) {
  const [text, setText] = useState('');
  const send = (t: string) => {
    const v = t.trim();
    if (!v || busy) return;
    onSend(v);
    setText('');
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="rounded-lg border border-zinc-900 bg-black p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Edit with AI
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">Tell the local model what to change. It reads the transcript, so you can say “when they mention…”.</p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-accent hover:text-white cursor-pointer">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
              m.role === 'user' ? 'ml-6 bg-zinc-900 text-zinc-100' : m.role === 'error' ? 'mr-6 border border-red-900/60 bg-red-950/30 text-red-200' : 'mr-6 border border-accent/30 bg-accent/5 text-zinc-200'
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="mr-6 inline-flex items-center gap-2 rounded-lg border border-zinc-900 px-3 py-2 text-xs text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Thinking locally…
          </div>
        )}
      </div>
      <form
        className="border-t border-zinc-900 p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="flex items-end gap-2 rounded-lg border border-zinc-800 bg-black p-1.5 focus-within:border-accent">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder="e.g. add a bar chart of TikTok 92, Reels 78 when they talk about platforms"
            className="flex-1 resize-none bg-transparent px-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
          />
          <button type="submit" disabled={busy || !text.trim()} className="rounded-md bg-accent p-2 text-black disabled:opacity-40 cursor-pointer" title="Send (Enter)">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
}

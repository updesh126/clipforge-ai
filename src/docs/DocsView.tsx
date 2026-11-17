import { useEffect, useMemo, useRef, useState } from 'react';
import { Marked } from 'marked';
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Copy, Menu, Search, X } from 'lucide-react';
import { DOC_GROUPS, DOC_PAGES, docPage, groupOf } from './manifest.ts';

/**
 * In-app documentation, laid out like the Remotion docs: grouped sidebar, search, breadcrumbs,
 * "On this page" contents, copy-page button, prev / next links. Route: #/docs/<slug>.
 */
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

interface Heading {
  depth: number;
  text: string;
  id: string;
}

function render(md: string): { html: string; headings: Heading[]; title: string } {
  const headings: Heading[] = [];
  let title = '';
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = text.replace(/<[^>]+>/g, '');
        if (depth === 1 && !title) {
          title = plain;
          return ''; // the page header shows the title
        }
        const id = slugify(plain);
        if (depth <= 3) headings.push({ depth, text: plain, id });
        return `<h${depth} id="${id}"><a class="doc-anchor" href="#${id}" aria-hidden="true">#</a>${text}</h${depth}>`;
      },
      link({ href, title: t, tokens }) {
        const text = this.parser.parseInline(tokens);
        // repo-relative .md links → the matching docs page when there is one
        const md = href.match(/(?:^|\/)([A-Za-z_-]+)\.md$/);
        if (md) {
          const hit = DOC_PAGES.find((p) => p.file.endsWith(`${md[1]}.md`));
          if (hit) href = `#/docs/${hit.slug}`;
        }
        const external = /^https?:/.test(href);
        return `<a href="${href}"${t ? ` title="${t}"` : ''}${external ? ' target="_blank" rel="noreferrer"' : ''}>${text}</a>`;
      },
    },
  });
  const html = marked.parse(md, { async: false }) as string;
  // blockquotes that start with **Note:** / **Tip:** / **Licence:** become callouts
  const withCallouts = html.replace(/<blockquote>\s*<p><strong>(Note|Tip|Licence|Warning):<\/strong>/g, (_m, kind: string) => `<blockquote class="doc-callout doc-${kind.toLowerCase()}"><p><strong>${kind}:</strong>`);
  return { html: withCallouts, headings, title };
}

export function DocsView({ slug, onNavigate }: { slug: string | null; onNavigate: (slug: string) => void }) {
  const page = docPage(slug);
  const { html, headings, title } = useMemo(() => render(page.body), [page]);
  const [q, setQ] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const idx = DOC_PAGES.findIndex((p) => p.slug === page.slug);
  const prev = DOC_PAGES[idx - 1];
  const next = DOC_PAGES[idx + 1];

  // search across titles and page text
  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return DOC_PAGES.map((p) => {
      const hay = `${p.title}\n${p.body}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return null;
      const at = hay.indexOf(words[0]);
      const snippet = p.body.slice(Math.max(0, at - 40), at + 80).replace(/[#*`|>\n]+/g, ' ').trim();
      return { p, snippet, score: (p.title.toLowerCase().includes(words[0]) ? 10 : 0) + words.length };
    })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [q]);

  // copy buttons on code blocks, in-page anchors, back to top on page change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    const root = bodyRef.current;
    if (!root) return;
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.querySelector('.doc-copy')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'doc-copy';
      btn.textContent = 'Copy';
      btn.onclick = () => {
        void navigator.clipboard?.writeText(pre.querySelector('code')?.textContent ?? '');
        btn.textContent = 'Copied';
        window.setTimeout(() => (btn.textContent = 'Copy'), 1200);
      };
      pre.appendChild(btn);
    });
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a');
      const href = a?.getAttribute('href') ?? '';
      if (href.startsWith('#/docs/')) {
        e.preventDefault();
        onNavigate(href.slice('#/docs/'.length));
      } else if (href.startsWith('#') && !href.startsWith('#/')) {
        e.preventDefault();
        root.querySelector(`#${CSS.escape(href.slice(1))}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [html, onNavigate]);

  // highlight the section in view
  useEffect(() => {
    const root = bodyRef.current;
    const scroller = scrollRef.current;
    if (!root || !scroller || !headings.length) return;
    const onScroll = () => {
      let cur: string | null = null;
      for (const h of headings) {
        const el = root.querySelector(`#${CSS.escape(h.id)}`) as HTMLElement | null;
        if (el && el.getBoundingClientRect().top < 140) cur = h.id;
      }
      setActive(cur);
    };
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [headings, html]);

  const go = (s: string) => {
    onNavigate(s);
    setQ('');
    setMenuOpen(false);
  };

  const sidebar = (
    <nav className="space-y-5" aria-label="Docs">
      {DOC_GROUPS.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{g.label}</p>
          <ul className="space-y-0.5">
            {g.pages.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => go(p.slug)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-[13px] cursor-pointer ${p.slug === page.slug ? 'bg-accent/10 font-medium text-accent' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'}`}
                >
                  {p.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-0 flex-1 bg-black">
      {/* left sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-900 lg:flex">
        <div className="border-b border-zinc-900 p-3">
          <SearchBox q={q} setQ={setQ} />
        </div>
        <div className="flex-1 overflow-y-auto p-3">{q ? <Results results={results} go={go} /> : sidebar}</div>
      </aside>

      {/* mobile menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/95 p-4 lg:hidden overflow-y-auto">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Docs</span>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu" className="p-1 text-zinc-400 cursor-pointer">
              <X className="h-5 w-5" />
            </button>
          </div>
          <SearchBox q={q} setQ={setQ} />
          <div className="mt-4">{q ? <Results results={results} go={go} /> : sidebar}</div>
        </div>
      )}

      <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl gap-10 px-4 py-8 sm:px-8">
          <article className="min-w-0 max-w-3xl flex-1">
            <button type="button" onClick={() => setMenuOpen(true)} className="mb-4 inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 lg:hidden cursor-pointer">
              <Menu className="h-3.5 w-3.5" /> Menu
            </button>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <BookOpen className="h-3.5 w-3.5" /> Docs <ChevronRight className="h-3 w-3" /> {groupOf(page.slug)}
            </div>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white">{title || page.title}</h1>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(page.body);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1200);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-white cursor-pointer"
                title="Copy this page as Markdown"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy page'}
              </button>
            </div>

            <div ref={bodyRef} className="doc-prose mt-6" dangerouslySetInnerHTML={{ __html: html }} />

            <p className="mt-10 border-t border-zinc-900 pt-4 text-xs text-zinc-500">
              Edit this page: <code className="text-zinc-400">{page.file}</code>
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {prev ? (
                <button type="button" onClick={() => go(prev.slug)} className="rounded-lg border border-zinc-800 p-3 text-left hover:border-accent cursor-pointer">
                  <span className="flex items-center gap-1 text-[11px] text-zinc-500"><ArrowLeft className="h-3 w-3" /> Previous</span>
                  <span className="mt-0.5 block text-sm font-medium text-white">{prev.title}</span>
                </button>
              ) : (
                <span />
              )}
              {next && (
                <button type="button" onClick={() => go(next.slug)} className="rounded-lg border border-zinc-800 p-3 text-right hover:border-accent cursor-pointer">
                  <span className="flex items-center justify-end gap-1 text-[11px] text-zinc-500">Next <ArrowRight className="h-3 w-3" /></span>
                  <span className="mt-0.5 block text-sm font-medium text-white">{next.title}</span>
                </button>
              )}
            </div>
          </article>

          {/* on this page */}
          {headings.length > 1 && (
            <aside className="sticky top-8 hidden h-fit w-52 shrink-0 xl:block">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">On this page</p>
              <ul className="space-y-1 border-l border-zinc-900">
                {headings.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => bodyRef.current?.querySelector(`#${CSS.escape(h.id)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                      className={`-ml-px block w-full border-l py-0.5 text-left text-[12.5px] cursor-pointer ${h.depth === 3 ? 'pl-6' : 'pl-3'} ${active === h.id ? 'border-accent text-accent' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
                    >
                      {h.text}
                    </button>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchBox({ q, setQ }: { q: string; setQ: (s: string) => void }) {
  return (
    <label className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-surface px-2 py-1.5">
      <Search className="h-3.5 w-3.5 text-zinc-500" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search docs" aria-label="Search docs" className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none" />
    </label>
  );
}

function Results({ results, go }: { results: Array<{ p: { slug: string; title: string }; snippet: string }>; go: (s: string) => void }) {
  if (!results.length) return <p className="px-2 py-4 text-xs text-zinc-500">No matches.</p>;
  return (
    <ul className="space-y-1">
      {results.map(({ p, snippet }) => (
        <li key={p.slug}>
          <button type="button" onClick={() => go(p.slug)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-zinc-900 cursor-pointer">
            <span className="block text-[13px] font-medium text-white">{p.title}</span>
            <span className="block truncate text-[11px] text-zinc-500">{snippet}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

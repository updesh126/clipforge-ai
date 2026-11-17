/**
 * Docs site table of contents. Pages are Markdown files in docs/ (bundled as raw text by Vite).
 * To add a page: write docs/site/<slug>.md, import it below and add it to a group.
 */
import intro from '../../docs/site/intro.md?raw';
import installation from '../../docs/site/installation.md?raw';
import firstVideo from '../../docs/site/first-video.md?raw';
import clipping from '../../docs/site/clipping.md?raw';
import scriptToVideo from '../../docs/site/script-to-video.md?raw';
import scriptGuide from '../../docs/STORY_SCRIPT_GUIDE.md?raw';
import artStyles from '../../docs/site/art-styles.md?raw';
import stableDiffusion from '../../docs/site/stable-diffusion.md?raw';
import editor from '../../docs/site/editor.md?raw';
import shortcuts from '../../docs/site/shortcuts.md?raw';
import motionLibrary from '../../docs/MOTION_LIBRARY.md?raw';
import exportPage from '../../docs/site/export.md?raw';
import settings from '../../docs/site/settings.md?raw';
import api from '../../docs/site/api.md?raw';
import architecture from '../../docs/ARCHITECTURE.md?raw';
import vectorEngine from '../../docs/VECTOR_ENGINE.md?raw';
import faq from '../../docs/site/faq.md?raw';

export interface DocPage {
  slug: string;
  title: string;
  file: string; // repo path, shown as "Edit this page"
  body: string;
}

export interface DocGroup {
  label: string;
  pages: DocPage[];
}

const page = (slug: string, title: string, file: string, body: string): DocPage => ({ slug, title, file, body });

export const DOC_GROUPS: DocGroup[] = [
  {
    label: 'Getting started',
    pages: [
      page('intro', 'Introduction', 'docs/site/intro.md', intro),
      page('installation', 'Installation', 'docs/site/installation.md', installation),
      page('first-video', 'Your first video', 'docs/site/first-video.md', firstVideo),
    ],
  },
  {
    label: 'Make videos',
    pages: [
      page('clipping', 'Clip long videos', 'docs/site/clipping.md', clipping),
      page('script-to-video', 'Script → video', 'docs/site/script-to-video.md', scriptToVideo),
      page('script-guide', 'Writing a story script', 'docs/STORY_SCRIPT_GUIDE.md', scriptGuide),
      page('art-styles', 'Art styles', 'docs/site/art-styles.md', artStyles),
      page('stable-diffusion', 'Stable Diffusion setup', 'docs/site/stable-diffusion.md', stableDiffusion),
    ],
  },
  {
    label: 'Editor',
    pages: [
      page('editor', 'Editor basics', 'docs/site/editor.md', editor),
      page('motion-library', 'Motion & effects library', 'docs/MOTION_LIBRARY.md', motionLibrary),
      page('shortcuts', 'Keyboard shortcuts', 'docs/site/shortcuts.md', shortcuts),
      page('export', 'Export', 'docs/site/export.md', exportPage),
    ],
  },
  {
    label: 'Reference',
    pages: [
      page('settings', 'Settings', 'docs/site/settings.md', settings),
      page('api', 'API reference', 'docs/site/api.md', api),
      page('architecture', 'Architecture', 'docs/ARCHITECTURE.md', architecture),
      page('vector-engine', 'Vector engine', 'docs/VECTOR_ENGINE.md', vectorEngine),
    ],
  },
  {
    label: 'Help',
    pages: [page('faq', 'Troubleshooting & FAQ', 'docs/site/faq.md', faq)],
  },
];

export const DOC_PAGES: DocPage[] = DOC_GROUPS.flatMap((g) => g.pages);
export const docPage = (slug: string | null | undefined): DocPage => DOC_PAGES.find((p) => p.slug === slug) ?? DOC_PAGES[0];
export const groupOf = (slug: string): string => DOC_GROUPS.find((g) => g.pages.some((p) => p.slug === slug))?.label ?? '';

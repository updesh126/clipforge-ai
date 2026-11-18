import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { TopBar } from './components/TopBar.tsx';
import { UploadStage } from './components/UploadStage.tsx';
import { StudioWorkspace } from './components/StudioWorkspace.tsx';
import { LibraryView } from './components/LibraryView.tsx';
import { ArchitectureView } from './components/ArchitectureView.tsx';
import { HomeView } from './components/HomeView.tsx';
// The Remotion editor is loaded only when opened, keeping Home and Clip light
const ScriptView = lazy(() => import('./editor/ScriptView.tsx').then((m) => ({ default: m.ScriptView })));
const WriterView = lazy(() => import('./editor/WriterView.tsx').then((m) => ({ default: m.WriterView })));
const EditorView = lazy(() => import('./editor/EditorView.tsx').then((m) => ({ default: m.EditorView })));
const DocsView = lazy(() => import('./docs/DocsView.tsx').then((m) => ({ default: m.DocsView })));
import { createEdit, listEdits, type EditSummary } from './editor/api.ts';
import type { AppTab, ClipLengthPreset, ClipProject, EngineStatus, JobProgress } from './types.ts';
import { postJson, withProgress } from './utils/api.ts';

/** URL hash ↔ screen, so a reload (or server restart) returns to the same place: #/script, #/edit/<id>, … */
const TAB_HASH: Record<AppTab, string> = { home: 'home', studio: 'clip', script: 'script', writer: 'writer', editor: 'edit', library: 'library', architecture: 'how', docs: 'docs' };

function readHash(): { tab: AppTab; editId: string | null; docSlug: string | null } {
  const [, seg, id] = window.location.hash.replace(/^#/, '').split('/');
  const tab = (Object.keys(TAB_HASH) as AppTab[]).find((t) => TAB_HASH[t] === seg) ?? 'home';
  return { tab, editId: tab === 'editor' && id ? decodeURIComponent(id) : null, docSlug: tab === 'docs' && id ? decodeURIComponent(id) : null };
}

export default function App() {
  const initial = readHash();
  const [activeTab, setActiveTab] = useState<AppTab>(initial.tab);
  const [projects, setProjects] = useState<ClipProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showUploadStage, setShowUploadStage] = useState<boolean>(false);

  const [isBusy, setIsBusy] = useState(false);
  const [busyStage, setBusyStage] = useState('');
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [engines, setEngines] = useState<EngineStatus | null>(null);
  const [edits, setEdits] = useState<EditSummary[]>([]);
  const [activeEditId, setActiveEditId] = useState<string | null>(initial.editId);
  const [docSlug, setDocSlug] = useState<string | null>(initial.docSlug);

  // keep the URL in sync with the screen …
  useEffect(() => {
    const sub = activeTab === 'editor' && activeEditId ? activeEditId : activeTab === 'docs' && docSlug ? docSlug : null;
    const want = `#/${TAB_HASH[activeTab]}${sub ? `/${encodeURIComponent(sub)}` : ''}`;
    if (window.location.hash !== want) window.history.replaceState(null, '', want);
  }, [activeTab, activeEditId, docSlug]);

  // … and follow manual URL changes
  useEffect(() => {
    const onHash = () => {
      const h = readHash();
      setActiveTab(h.tab);
      if (h.tab === 'editor') setActiveEditId(h.editId);
      if (h.tab === 'docs') setDocSlug(h.docSlug);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const refreshEdits = useCallback(() => {
    void listEdits().then(setEdits).catch(() => setEdits([]));
  }, []);

  const refreshEngines = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      setEngines((await res.json()) as EngineStatus);
    } catch {
      setEngines(null);
    }
  }, []);

  useEffect(() => {
    void refreshEngines();
    refreshEdits();
    void (async () => {
      try {
        const res = await fetch('/api/projects');
        const data = (await res.json()) as { projects?: ClipProject[] };
        const loaded = data.projects ?? [];
        setProjects(loaded);
        if (loaded.length > 0) setActiveProjectId(loaded[0].id);
        setShowUploadStage(loaded.length === 0);
      } catch {
        setShowUploadStage(true);
      }
    })();
  }, [refreshEngines, refreshEdits]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  /** Shared wrapper for every "create a project" flow: busy state, live progress, errors. */
  const createProject = async (label: string, run: (jobId: string) => Promise<{ project: ClipProject }>) => {
    setIsBusy(true);
    setError(null);
    setBusyStage(label);
    try {
      const { project } = await withProgress(run, setProgress);
      setProjects((prev) => [project, ...prev]);
      setActiveProjectId(project.id);
      setShowUploadStage(false);
      setActiveTab('studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setIsBusy(false);
      setBusyStage('');
    }
  };

  const handleUploadFile = (file: File, preset: ClipLengthPreset) =>
    createProject(`Copying "${file.name}"`, async (jobId) => {
      const formData = new FormData();
      formData.append('jobId', jobId);
      formData.append('clipLengthPreset', preset);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));
      formData.append('video', file); // file last so text fields are parsed first
      const res = await fetch('/api/projects/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to analyse uploaded video.');
      return data;
    });

  const handleGenerateDemo = (preset: ClipLengthPreset) =>
    createProject('Creating a narrated sample video', (jobId) =>
      postJson('/api/projects/demo', { clipLengthPreset: preset, jobId })
    );

  const handleOpenLocalPath = (filePath: string, preset: ClipLengthPreset) =>
    createProject('Opening video from disk', (jobId) =>
      postJson('/api/projects/local', { path: filePath, clipLengthPreset: preset, jobId })
    );

  const handleImportYoutube = (url: string, preset: ClipLengthPreset) =>
    createProject('Fetching YouTube video', (jobId) =>
      postJson('/api/projects/youtube', { url, clipLengthPreset: preset, jobId })
    );

  const handleUpdateProject = (updated: ClipProject) => {
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  const handlePersistProject = async (project: ClipProject) => {
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: project.name, clips: project.clips, transcript: project.transcript }),
      });
    } catch {
      // retried on the next blur/save
    }
  };

  const handleReanalyze = async (preset: ClipLengthPreset) => {
    if (!activeProject || isReanalyzing) return;
    setIsReanalyzing(true);
    try {
      const data = await withProgress(
        (jobId) => postJson<{ project?: ClipProject }>(`/api/projects/${activeProject.id}/reanalyze`, { clipLengthPreset: preset, jobId }),
        setProgress
      );
      if (data.project) handleUpdateProject(data.project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-analysis failed.');
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    if (res.ok) {
      setProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== projectId);
        if (activeProjectId === projectId) {
          setActiveProjectId(remaining[0]?.id ?? null);
          if (remaining.length === 0) setShowUploadStage(true);
        }
        return remaining;
      });
    }
  };

  const handleDeleteProjects = async (projectIds: string[]) => {
    const res = await fetch('/api/projects/bulk-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: projectIds }) });
    if (!res.ok) return;
    setProjects((prev) => {
      const remaining = prev.filter((p) => !projectIds.includes(p.id));
      if (activeProjectId && projectIds.includes(activeProjectId)) {
        setActiveProjectId(remaining[0]?.id ?? null);
        if (remaining.length === 0) setShowUploadStage(true);
      }
      return remaining;
    });
  };

  const openInEditor = async (projectId: string, clipId: string) => {
    try {
      const e = await createEdit({ projectId, clipId });
      refreshEdits();
      setActiveEditId(e.id);
      setActiveTab('editor');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the editor.');
    }
  };

  const openUpload = () => {
    setError(null);
    setActiveTab('studio');
    setShowUploadStage(true);
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-black text-zinc-100">
      <TopBar
        activeTab={activeTab}
        engines={engines}
        onRefreshEngines={refreshEngines}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'studio' && !activeProject) setShowUploadStage(true);
        }}
        onNewVideo={openUpload}
        onHome={() => setActiveTab('home')}
      />

      {/* page transitions (Motion) — a short cross-fade so switching tabs feels connected */}
      <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeTab}
        className="flex-1 min-h-0 flex flex-col"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
      >
      {activeTab === 'home' && (
        <HomeView
          projects={projects}
          edits={edits}
          onStartClipping={openUpload}
          onStartScript={() => setActiveTab('script')}
          onStartEditing={() => {
            setActiveEditId(null);
            setActiveTab('editor');
          }}
          onOpenProject={(p) => {
            setActiveProjectId(p.id);
            setShowUploadStage(false);
            setActiveTab('studio');
          }}
          onOpenEdit={(id) => {
            setActiveEditId(id);
            setActiveTab('editor');
          }}
        />
      )}

      {activeTab === 'writer' && (
        <Suspense fallback={<div className="flex-1 grid place-items-center text-xs text-zinc-500">Loading…</div>}>
          <WriterView onOpenScript={() => setActiveTab('script')} />
        </Suspense>
      )}

      {activeTab === 'script' && (
        <Suspense fallback={<div className="flex-1 grid place-items-center text-xs text-zinc-500">Loading…</div>}>
          <ScriptView
            engines={engines}
            onCreated={(id) => {
              refreshEdits();
              setActiveEditId(id);
              setActiveTab('editor');
            }}
          />
        </Suspense>
      )}

      {activeTab === 'editor' && (
        <Suspense fallback={<div className="flex-1 grid place-items-center text-xs text-zinc-500">Loading editor…</div>}>
          <EditorView editId={activeEditId} projects={projects} onOpenEdit={setActiveEditId} onEditsChanged={refreshEdits} />
        </Suspense>
      )}

      {activeTab === 'studio' &&
        (showUploadStage || !activeProject ? (
          <UploadStage
            isBusy={isBusy}
            busyStage={busyStage}
            progress={progress}
            error={error}
            engines={engines}
            onUploadFile={handleUploadFile}
            onImportYoutube={handleImportYoutube}
            onOpenLocalPath={handleOpenLocalPath}
            onGenerateDemo={handleGenerateDemo}
          />
        ) : (
          <StudioWorkspace
            project={activeProject}
            engines={engines}
            onUpdateProject={handleUpdateProject}
            onPersistProject={handlePersistProject}
            onReanalyze={handleReanalyze}
            isReanalyzing={isReanalyzing}
            reanalyzeProgress={isReanalyzing ? progress : null}
            onOpenInEditor={(pid, cid) => void openInEditor(pid, cid)}
          />
        ))}

      {activeTab === 'library' && (
        <LibraryView
          projects={projects}
          activeProjectId={activeProjectId}
          onOpenProject={(project) => {
            setActiveProjectId(project.id);
            setShowUploadStage(false);
            setActiveTab('studio');
          }}
          onDeleteProject={handleDeleteProject}
          onDeleteProjects={handleDeleteProjects}
          onNewVideo={openUpload}
        />
      )}

      {activeTab === 'architecture' && <ArchitectureView />}
      {activeTab === 'docs' && (
        <Suspense fallback={<div className="flex-1 bg-black" />}>
          <DocsView slug={docSlug} onNavigate={setDocSlug} />
        </Suspense>
      )}
      </motion.div>
      </AnimatePresence>
    </div>
  );
}

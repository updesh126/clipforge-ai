import { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar.tsx';
import { UploadStage } from './components/UploadStage.tsx';
import { StudioWorkspace } from './components/StudioWorkspace.tsx';
import { LibraryView } from './components/LibraryView.tsx';
import { ArchitectureView } from './components/ArchitectureView.tsx';
import type { AppTab, ClipLengthPreset, ClipProject } from './types.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('studio');
  const [projects, setProjects] = useState<ClipProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showUploadStage, setShowUploadStage] = useState<boolean>(false);

  const [isBusy, setIsBusy] = useState(false);
  const [busyStage, setBusyStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/projects');
        const data = (await res.json()) as { projects?: ClipProject[] };
        const loaded = data.projects ?? [];
        setProjects(loaded);
        if (loaded.length > 0) {
          setActiveProjectId(loaded[0].id);
          setShowUploadStage(false);
        } else {
          setShowUploadStage(true);
        }
      } catch {
        setShowUploadStage(true);
      }
    })();
  }, []);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) ?? null;

  const handleUploadFile = async (file: File, preset: ClipLengthPreset) => {
    setIsBusy(true);
    setError(null);
    setBusyStage(`Uploading "${file.name}" and selecting AI clips...`);

    try {
      const formData = new FormData();
      formData.append('video', file);
      formData.append('clipLengthPreset', preset);
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''));

      const res = await fetch('/api/projects/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze uploaded video.');
      }

      const created = data.project as ClipProject;
      setProjects((prev) => [created, ...prev]);
      setActiveProjectId(created.id);
      setShowUploadStage(false);
      setActiveTab('studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsBusy(false);
      setBusyStage('');
    }
  };

  const handleGenerateDemo = async (preset: ClipLengthPreset) => {
    setIsBusy(true);
    setError(null);
    setBusyStage('Generating spoken sample video and extracting highlights...');

    try {
      const res = await fetch('/api/projects/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipLengthPreset: preset }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate sample session.');
      }

      const created = data.project as ClipProject;
      setProjects((prev) => [created, ...prev]);
      setActiveProjectId(created.id);
      setShowUploadStage(false);
      setActiveTab('studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sample generation failed.');
    } finally {
      setIsBusy(false);
      setBusyStage('');
    }
  };

  const handleOpenLocalPath = async (filePath: string, preset: ClipLengthPreset) => {
    setIsBusy(true);
    setError(null);
    setBusyStage('Opening video from disk and selecting AI clips (large files can take a while)...');
    try {
      const res = await fetch('/api/projects/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, clipLengthPreset: preset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open local video.');
      const created = data.project as ClipProject;
      setProjects((prev) => [created, ...prev]);
      setActiveProjectId(created.id);
      setShowUploadStage(false);
      setActiveTab('studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opening local video failed.');
    } finally {
      setIsBusy(false);
      setBusyStage('');
    }
  };

  const handleImportYoutube = async (url: string, preset: ClipLengthPreset) => {
    setIsBusy(true);
    setError(null);
    setBusyStage('Fetching YouTube video and extracting AI highlight clips...');

    try {
      const res = await fetch('/api/projects/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, clipLengthPreset: preset }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import YouTube video.');
      }

      const created = data.project as ClipProject;
      setProjects((prev) => [created, ...prev]);
      setActiveProjectId(created.id);
      setShowUploadStage(false);
      setActiveTab('studio');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'YouTube import failed.');
    } finally {
      setIsBusy(false);
      setBusyStage('');
    }
  };

  const handleUpdateProject = (updated: ClipProject) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const handlePersistProject = async (project: ClipProject) => {
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: project.name,
          clips: project.clips,
          transcript: project.transcript,
        }),
      });
    } catch {
      // silent retry on next blur/save
    }
  };

  const handleReanalyze = async (preset: ClipLengthPreset) => {
    if (!activeProject || isReanalyzing) return;
    setIsReanalyzing(true);
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/reanalyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipLengthPreset: preset }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Re-analysis failed.');
      }
      if (data.project) {
        handleUpdateProject(data.project);
      }
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
          if (remaining.length === 0) {
            setShowUploadStage(true);
          }
        }
        return remaining;
      });
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-black text-zinc-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'studio' && !activeProject) {
            setShowUploadStage(true);
          }
        }}
        onNewVideo={() => {
          setError(null);
          setActiveTab('studio');
          setShowUploadStage(true);
        }}
      />

      {activeTab === 'studio' && (
        showUploadStage || !activeProject ? (
          <UploadStage
            isBusy={isBusy}
            busyStage={busyStage}
            error={error}
            onUploadFile={handleUploadFile}
            onImportYoutube={handleImportYoutube}
            onOpenLocalPath={handleOpenLocalPath}
            onGenerateDemo={handleGenerateDemo}
          />
        ) : (
          <StudioWorkspace
            project={activeProject}
            onUpdateProject={handleUpdateProject}
            onPersistProject={handlePersistProject}
            onReanalyze={handleReanalyze}
            isReanalyzing={isReanalyzing}
          />
        )
      )}

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
          onNewVideo={() => {
            setError(null);
            setActiveTab('studio');
            setShowUploadStage(true);
          }}
        />
      )}

      {activeTab === 'architecture' && <ArchitectureView />}
    </div>
  );
}

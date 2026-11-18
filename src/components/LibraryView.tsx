import { Trash2, FolderOpen, Download, Film } from 'lucide-react';
import type { ClipProject } from '../types.ts';
import { formatBytes, formatRelativeDate, formatTimecode } from '../utils/format.ts';
import { BulkBar, SelectBox, useSelection } from './BulkSelect.tsx';

interface LibraryViewProps {
  projects: ClipProject[];
  activeProjectId: string | null;
  onOpenProject: (project: ClipProject) => void;
  onDeleteProject: (projectId: string) => Promise<void>;
  onDeleteProjects: (projectIds: string[]) => Promise<void>;
  onNewVideo: () => void;
}

export function LibraryView({
  projects,
  activeProjectId,
  onOpenProject,
  onDeleteProject,
  onDeleteProjects,
  onNewVideo,
}: LibraryViewProps) {
  const sel = useSelection();
  if (projects.length === 0) {
    return (
      <div className="flex-1 bg-black flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <div className="mx-auto h-12 w-12 rounded-xl bg-[#111114] border border-zinc-800 flex items-center justify-center mb-4">
            <Film className="h-5 w-5 text-zinc-400" />
          </div>
          <h2 className="font-display text-xl font-semibold text-white">
            No local projects yet
          </h2>
          <p className="mt-2 text-sm text-zinc-400">
            Import a video or generate a sample session to see your clips, transcripts, and exported MP4 files stored locally here.
          </p>
          <button
            type="button"
            onClick={onNewVideo}
            className="mt-6 rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-black hover:bg-accent-strong transition-colors cursor-pointer"
          >
            Import First Video
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-black overflow-y-auto px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 pb-6 border-b border-zinc-900">
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">
              Local Project Library
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              Stored on disk in data/uploads and data/exports · {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <BulkBar sel={sel} allIds={projects.map((p) => p.id)} noun="project" note="Each project's imported video copy, clips and exports are removed from disk." onDelete={onDeleteProjects} />
            {!sel.selecting && (
              <button
                type="button"
                onClick={onNewVideo}
                className="rounded-lg border border-zinc-800 bg-[#0C0C0E] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                Import Another Video
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 divide-y divide-zinc-900 border border-zinc-900 rounded-xl bg-[#09090B]">
          {projects.map((project) => {
            const isActive = project.id === activeProjectId;
            const exportCount = project.clips.reduce(
              (acc, c) => acc + (c.exportedFiles?.length ?? 0),
              0
            );
            const latestExport = project.clips
              .flatMap((c) => c.exportedFiles ?? [])
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

            return (
              <div
                key={project.id}
                onClick={sel.selecting ? () => sel.toggle(project.id) : undefined}
                className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#0F0F12] transition-colors ${sel.selecting ? 'cursor-pointer' : ''} ${sel.has(project.id) ? 'bg-accent/5' : ''}`}
              >
                <SelectBox sel={sel} id={project.id} label={project.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {project.name}
                    </h3>
                    {isActive && (
                      <span className="text-[11px] font-medium text-accent whitespace-nowrap shrink-0">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400 line-clamp-1">
                    {project.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500 font-mono">
                    <span>{formatTimecode(project.metadata.duration)}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {project.metadata.width}x{project.metadata.height}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(project.metadata.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{project.clips.length} clips</span>
                    <span aria-hidden="true">·</span>
                    <span>{exportCount} exports</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-sans">{formatRelativeDate(project.createdAt)}</span>
                  </div>
                </div>

                {!sel.selecting && <div className="flex items-center gap-2 shrink-0">
                  {latestExport && (
                    <a
                      href={`/api/download/${latestExport.fileName}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-black px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors whitespace-nowrap shrink-0"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Latest MP4
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenProject(project)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-accent-strong transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteProject(project.id)}
                    aria-label={`Delete ${project.name}`}
                    className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-black p-1.5 text-zinc-400 hover:border-red-900/60 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

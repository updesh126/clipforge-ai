import fs from 'node:fs';
import path from 'node:path';
import type { ClipProject } from './types.ts';

// Override with CLIPFORGE_DATA_DIR to keep projects, models and exports on another drive
export const DATA_DIR = path.resolve(process.env.CLIPFORGE_DATA_DIR || path.join(process.cwd(), 'data'));
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
export const TEMP_DIR = path.join(DATA_DIR, 'temp');
const DB_FILE = path.join(DATA_DIR, 'projects.json');

export function ensureDataDirs() {
  for (const dir of [DATA_DIR, UPLOADS_DIR, EXPORTS_DIR, TEMP_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ projects: [] }, null, 2), 'utf-8');
  }
}

export function readProjects(): ClipProject[] {
  ensureDataDirs();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as { projects?: ClipProject[] };
    return Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
}

export function writeProjects(projects: ClipProject[]) {
  ensureDataDirs();
  fs.writeFileSync(DB_FILE, JSON.stringify({ projects }, null, 2), 'utf-8');
}

export function getProjectById(id: string): ClipProject | undefined {
  return readProjects().find((p) => p.id === id);
}

export function upsertProject(project: ClipProject): ClipProject {
  const projects = readProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  writeProjects(projects);
  return project;
}

export function deleteProjectById(id: string): boolean {
  const projects = readProjects();
  const target = projects.find((p) => p.id === id);
  if (!target) return false;

  // Clean up local uploaded video and any exported clip files
  const uploadPath = path.join(UPLOADS_DIR, target.sourceFileName);
  const proxyPath = uploadPath.replace(/\.[^.]+$/, '') + '_preview.mp4';
  for (const p of target.sourceFileName ? [uploadPath, proxyPath] : []) {
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {
        // ignore cleanup error
      }
    }
  }
  for (const clip of target.clips) {
    for (const exp of clip.exportedFiles ?? []) {
      const mp4Path = path.join(EXPORTS_DIR, exp.fileName);
      const srtPath = mp4Path.replace(/\.mp4$/i, '.srt');
      for (const f of [mp4Path, srtPath]) {
        if (fs.existsSync(f)) {
          try {
            fs.unlinkSync(f);
          } catch {
            // ignore
          }
        }
      }
    }
  }

  writeProjects(projects.filter((p) => p.id !== id));
  return true;
}

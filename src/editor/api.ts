import type { EditProject } from './types.ts';
import { postJson } from '../utils/api.ts';

export interface EditSummary {
  id: string;
  name: string;
  width: number;
  height: number;
  itemCount: number;
  updatedAt: string;
}

export async function listEdits(): Promise<EditSummary[]> {
  const r = await fetch('/api/edits');
  return ((await r.json()) as { edits?: EditSummary[] }).edits ?? [];
}

export async function loadEdit(id: string): Promise<EditProject> {
  const r = await fetch(`/api/edits/${id}`);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Could not open edit.');
  return d.edit as EditProject;
}

export async function createEdit(body: { projectId?: string; clipId?: string; name?: string; aspect?: string }): Promise<EditProject> {
  return (await postJson<{ edit: EditProject }>('/api/edits', body)).edit;
}

export async function saveEditRemote(edit: EditProject): Promise<EditProject> {
  const r = await fetch(`/api/edits/${edit.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: edit.name, width: edit.width, height: edit.height, background: edit.background, items: edit.items }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Save failed.');
  return d.edit as EditProject;
}

/**
 * Drag and drop from the library onto the timeline or the viewer. The dragged thing travels as JSON under our own
 * type, so the drop targets ignore files and text dragged in from elsewhere.
 */
import type { DragEvent } from 'react';
import type { EffectId, TemplateId } from '../types.ts';
import type { AssetEntry } from '../../assetkit/types.ts';

export type DragItem =
  | { type: 'motion'; fx: string; label?: string }
  | { type: 'effect'; id: EffectId; label?: string }
  | { type: 'template'; id: TemplateId; props?: Record<string, string | number>; label?: string }
  | { type: 'asset'; asset: AssetEntry; label?: string };

export const DND_MIME = 'application/x-clipforge-item';

export function startDrag(e: DragEvent, item: DragItem) {
  e.dataTransfer.setData(DND_MIME, JSON.stringify(item));
  e.dataTransfer.setData('text/plain', item.label ?? (item.type === 'motion' ? item.fx : item.type === 'asset' ? item.asset.name : item.id));
  e.dataTransfer.effectAllowed = 'copy';
}

export const isLibraryDrag = (e: DragEvent) => e.dataTransfer.types.includes(DND_MIME);

export function readDrag(e: DragEvent): DragItem | null {
  try {
    const v = JSON.parse(e.dataTransfer.getData(DND_MIME)) as DragItem;
    return v && typeof v === 'object' && 'type' in v ? v : null;
  } catch {
    return null;
  }
}

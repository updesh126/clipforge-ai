import { Composition } from 'remotion';
import type { CompositionProps } from '../editor/types.ts';
import { editDuration } from '../editor/types.ts';
import { EditorComposition } from './EditorComposition.tsx';
import { AssetStill, type AssetStillProps } from './AssetStill.tsx';
import { MotionFx } from '../motion/MotionFx.tsx';

/** Motion-library preview: one effect or sequence on a neutral backdrop (contact sheets, thumbnails). */
export const MOTION_COMPOSITION_ID = 'ClipForgeMotion';
interface MotionPreviewProps { fx: string; width: number; height: number; duration: number; [key: string]: unknown }
const MotionPreview = ({ fx }: MotionPreviewProps) => (
  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, #2b3443, #0d1117)' }}>
    <MotionFx props={{ fx }} />
  </div>
);

export const COMPOSITION_ID = 'ClipForgeEdit';
export const ASSET_COMPOSITION_ID = 'ClipForgeAsset';

const assetDefaults: AssetStillProps = { spec: { type: 'object', kind: 'sun' }, style: 'flat', width: 768, height: 768 };

const emptyEdit: CompositionProps = {
  assetBase: '',
  preview: false,
  edit: { id: 'empty', name: 'Empty', width: 1080, height: 1920, fps: 30, background: '#000', items: [], createdAt: '', updatedAt: '' },
};

export function RemotionRoot() {
  return (
    <>
    <Composition
      id={COMPOSITION_ID}
      component={EditorComposition}
      defaultProps={emptyEdit}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={30}
      calculateMetadata={({ props }) => ({
        width: props.edit.width,
        height: props.edit.height,
        fps: props.edit.fps,
        durationInFrames: Math.max(1, Math.ceil(editDuration(props.edit) * props.edit.fps)),
      })}
    />
    <Composition
      id={ASSET_COMPOSITION_ID}
      component={AssetStill}
      defaultProps={assetDefaults}
      width={768}
      height={768}
      fps={30}
      durationInFrames={1}
      calculateMetadata={({ props }) => ({ width: props.width, height: props.height })}
    />
    <Composition
      id={MOTION_COMPOSITION_ID}
      component={MotionPreview}
      defaultProps={{ fx: 'bigStat', width: 1080, height: 1920, duration: 4 } as MotionPreviewProps}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={120}
      calculateMetadata={({ props }) => ({ width: props.width, height: props.height, durationInFrames: Math.max(1, Math.round(props.duration * 30)) })}
    />
    </>
  );
}

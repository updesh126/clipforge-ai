import { AbsoluteFill } from 'remotion';
import { AssetSvg } from '../assetkit/kit.tsx';
import type { AssetSpec } from '../assetkit/types.ts';

export interface AssetStillProps {
  spec: AssetSpec;
  style: string;
  width: number;
  height: number;
  [key: string]: unknown;
}

/** Renders one asset recipe; the page stays transparent so the PNG keeps its alpha. */
export function AssetStill({ spec, style, width, height }: AssetStillProps) {
  return (
    <AbsoluteFill>
      <AssetSvg spec={spec} style={style} width={width} height={height} />
    </AbsoluteFill>
  );
}

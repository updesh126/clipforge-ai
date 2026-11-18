/**
 * Where /media/… files live for motion graphics: '' in the browser (same origin), http://localhost:PORT when
 * Remotion renders. Set once by the composition before its layers render.
 */
let base = '';
export const setAssetBase = (b: string | undefined) => {
  base = (b ?? '').replace(/\/+$/, '');
};
export const assetUrl = (p: string) => `${base}${p}`;

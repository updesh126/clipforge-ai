export function kokoroInstallCommand(): string {
  const isWindows = typeof navigator !== 'undefined' && /^Win/.test(navigator.platform);
  return isWindows
    ? 'py -3.12 -m pip install --user kokoro-onnx soundfile'
    : 'python3.12 -m pip install --user kokoro-onnx soundfile';
}

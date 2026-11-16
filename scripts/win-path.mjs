// Windows: terminals opened before an install (winget, a PATH edit) keep an old PATH.
// Merge the current User + Machine PATH from the registry so newly installed tools are found.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export function refreshWindowsPath() {
  if (process.platform !== 'win32') return;
  const read = (key) => {
    try {
      const out = execFileSync('reg', ['query', key, '/v', 'Path'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      const m = out.match(/Path\s+REG_(?:EXPAND_)?SZ\s+(.*)/i);
      return m ? m[1].trim().replace(/%([^%]+)%/g, (_, v) => process.env[v] ?? `%${v}%`) : '';
    } catch {
      return '';
    }
  };
  const fresh = [read('HKCU\\Environment'), read('HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment')]
    .join(';')
    .split(';')
    .filter(Boolean);
  const current = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const seen = new Set(current.map((p) => p.toLowerCase()));
  const added = fresh.filter((p) => !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase()));
  if (added.length) process.env.PATH = [...current, ...added].join(path.delimiter);
}

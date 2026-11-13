import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { DATA_DIR } from './store.ts';

const execFileAsync = promisify(execFile);

export interface ParsedYoutubeUrl {
  videoId: string;
  normalizedUrl: string;
}

export function parseYoutubeUrl(raw: string): ParsedYoutubeUrl {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('Please enter a valid YouTube URL (e.g. https://www.youtube.com/watch?v=...).');
  }

  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  let videoId = '';

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';
  } else if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com'
  ) {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v') ?? '';
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    } else if (url.pathname.startsWith('/live/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    }
  }

  videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!videoId || videoId.length < 6) {
    throw new Error('Could not extract a valid YouTube video ID from that URL.');
  }

  return {
    videoId,
    normalizedUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

export async function fetchYoutubeOembed(
  normalizedUrl: string
): Promise<{ title?: string; authorName?: string }> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`
    );
    if (!res.ok) return {};
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      title: data.title?.trim(),
      authorName: data.author_name?.trim(),
    };
  } catch {
    return {};
  }
}

async function resolveYtDlpCommand(): Promise<string> {
  // 1. Prefer system yt-dlp on user's PC if installed
  try {
    await execFileAsync('yt-dlp', ['--version']);
    return 'yt-dlp';
  } catch {
    // not in PATH
  }

  // 2. Otherwise cache official standalone yt-dlp binary inside data/bin/
  const binDir = path.join(DATA_DIR, 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const binPath = path.join(binDir, binName);

  if (fs.existsSync(binPath)) {
    return binPath;
  }

  const releaseAsset = isWin
    ? 'yt-dlp.exe'
    : isMac
      ? 'yt-dlp_macos'
      : 'yt-dlp_linux';
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${releaseAsset}`;

  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch yt-dlp binary (HTTP ${response.status}).`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(binPath, Buffer.from(arrayBuffer));
  if (!isWin) {
    fs.chmodSync(binPath, 0o755);
  }
  return binPath;
}

export async function downloadYoutubeMp4(
  normalizedUrl: string,
  outMp4Path: string
): Promise<{ downloaded: true } | { downloaded: false; reason: string }> {
  try {
    const ytDlp = await resolveYtDlpCommand();
    await execFileAsync(
      ytDlp,
      [
        '--no-playlist',
        '--no-warnings',
        // Best quality up to 1080p, preferring H.264 + AAC so the browser preview plays smoothly
        '-f',
        'bv*[height<=1080]+ba/b[height<=1080]/b',
        '-S',
        'res:1080,fps,vcodec:h264,acodec:m4a',
        '--merge-output-format',
        'mp4',
        '--extractor-args',
        'youtube:player_client=android,web',
        '-o',
        outMp4Path,
        normalizedUrl,
      ],
      { timeout: 45 * 60_000, maxBuffer: 1024 * 1024 * 10 }
    );

    if (fs.existsSync(outMp4Path) && fs.statSync(outMp4Path).size > 10_000) {
      return { downloaded: true };
    }
    return { downloaded: false, reason: 'Downloaded file was empty.' };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    return {
      downloaded: false,
      reason: rawMsg.slice(0, 300),
    };
  }
}

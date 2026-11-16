/**
 * Text-to-speech: HyperFrames Kokoro-82M (natural, local) → fallback to the OS voice
 * (macOS `say`, Windows SAPI, Linux espeak-ng). Always returns a WAV file.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { DEFAULT_VOICE, synthesizeSpeech, ttsAvailable } from './hyperframes.ts';

const execFileAsync = promisify(execFile);

export async function speak(
  text: string,
  outWav: string,
  voice = DEFAULT_VOICE
): Promise<{ path: string; engine: 'kokoro' | 'os' }> {
  if (await ttsAvailable()) {
    try {
      await synthesizeSpeech(text, outWav, voice);
      return { path: outWav, engine: 'kokoro' };
    } catch (err) {
      console.warn('[clipforge] Kokoro TTS failed, using OS voice:', (err as Error).message);
    }
  }
  await osSpeak(text, outWav);
  return { path: outWav, engine: 'os' };
}

async function osSpeak(text: string, wav: string) {
  if (process.platform === 'darwin') {
    const aiff = wav.replace(/\.wav$/, '.aiff');
    await execFileAsync('say', ['-o', aiff, text]);
    await execFileAsync('ffmpeg', ['-y', '-i', aiff, wav]);
    fs.rmSync(aiff, { force: true });
  } else if (process.platform === 'win32') {
    const safeWav = wav.replace(/'/g, "''");
    const ps = `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${safeWav}'); $s.Speak(@'\n${text}\n'@); $s.Dispose()`;
    await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true });
  } else {
    await execFileAsync('espeak-ng', ['-w', wav, text]).catch(() => execFileAsync('espeak', ['-w', wav, text]));
  }
  if (!fs.existsSync(wav)) throw new Error('No text-to-speech engine available.');
}

export async function audioDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(stdout.trim()) || 0;
}

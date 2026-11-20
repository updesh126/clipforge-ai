/**
 * Text-to-speech, all local:
 *   1. Kokoro-82M via HyperFrames (natural; English + Hindi voices) — needs Python 3.12 with `kokoro-onnx` and `soundfile`
 *   2. OS voice: Windows (SAPI desktop voices, or OneCore voices such as Hindi "Kalpana"/"Hemant" through WinRT),
 *      macOS `say`, Linux espeak-ng.
 * Always returns a WAV file.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { DEFAULT_VOICE, synthesizeSpeech, ttsAvailable } from './hyperframes.ts';

const execFileAsync = promisify(execFile);

export type VoiceLanguage = 'en' | 'hi';

/** Kokoro v1.0 Hindi voices (h-prefix → HyperFrames picks the Hindi phonemiser automatically). */
export const KOKORO_HINDI_VOICES = [
  { id: 'hf_alpha', label: 'Alpha (Hindi, female)', language: 'hi', gender: 'female' },
  { id: 'hf_beta', label: 'Beta (Hindi, female)', language: 'hi', gender: 'female' },
  { id: 'hm_omega', label: 'Omega (Hindi, male)', language: 'hi', gender: 'male' },
  { id: 'hm_psi', label: 'Psi (Hindi, male)', language: 'hi', gender: 'male' },
];
export const DEFAULT_HINDI_VOICE = 'hf_alpha';

/** Devanagari in the text → Hindi, whatever the UI said (a Hindi script must never be read by an English voice). */
export function languageOf(text: string, requested?: string): VoiceLanguage {
  if (requested === 'hi') return 'hi';
  const dev = (text.match(/[ऀ-ॿ]/g) ?? []).length;
  const lat = (text.match(/[A-Za-z]/g) ?? []).length;
  return dev > lat ? 'hi' : 'en';
}

export async function speak(
  text: string,
  outWav: string,
  voice = DEFAULT_VOICE,
  language: VoiceLanguage = languageOf(text)
): Promise<{ path: string; engine: 'kokoro' | 'os' }> {
  // OneCore voices are addressed as "os:<name>" (e.g. os:Microsoft Kalpana)
  const osVoice = voice.startsWith('os:') ? voice.slice(3) : '';
  if (!osVoice && (await ttsAvailable())) {
    // a Hindi script needs a Hindi voice: swap in a Hindi Kokoro voice if an English one was picked
    const v = language === 'hi' && !/^h[fm]_/.test(voice) ? DEFAULT_HINDI_VOICE : language === 'en' && /^h[fm]_/.test(voice) ? DEFAULT_VOICE : voice;
    try {
      await synthesizeSpeech(text, outWav, v);
      return { path: outWav, engine: 'kokoro' };
    } catch (err) {
      console.warn('[clipforge] Kokoro TTS failed, using OS voice:', (err as Error).message);
    }
  }
  await osSpeak(text, outWav, language, osVoice);
  return { path: outWav, engine: 'os' };
}

/** Windows OneCore voices (Settings → Time & language → Speech → Add voices). Cached once per run. */
let oneCore: { name: string; language: string; gender: string }[] | null = null;
export async function windowsVoices(): Promise<{ name: string; language: string; gender: string }[]> {
  if (process.platform !== 'win32') return [];
  if (oneCore) return oneCore;
  const ps = `[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime] | Out-Null; [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { $_.DisplayName + '|' + $_.Language + '|' + $_.Gender }`;
  try {
    const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true, timeout: 20_000 });
    oneCore = stdout
      .split(/\r?\n/)
      .map((l) => l.trim().split('|'))
      .filter((p) => p.length === 3 && p[0])
      .map(([name, language, gender]) => ({ name, language, gender: gender.toLowerCase() }));
  } catch {
    oneCore = [];
  }
  return oneCore;
}

async function osSpeak(text: string, wav: string, language: VoiceLanguage, voiceName = '') {
  if (process.platform === 'darwin') {
    const aiff = wav.replace(/\.wav$/, '.aiff');
    await execFileAsync('say', [...(language === 'hi' ? ['-v', voiceName || 'Lekha'] : voiceName ? ['-v', voiceName] : []), '-o', aiff, text]);
    await execFileAsync('ffmpeg', ['-y', '-i', aiff, wav]);
    fs.rmSync(aiff, { force: true });
  } else if (process.platform === 'win32') {
    if (language === 'hi' || voiceName) await windowsOneCoreSpeak(text, wav, language, voiceName);
    else {
      const safeWav = wav.replace(/'/g, "''");
      const ps = `Add-Type -AssemblyName System.Speech; $s=New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${safeWav}'); $s.Speak(@'\n${text}\n'@); $s.Dispose()`;
      await execFileAsync('powershell', ['-NoProfile', '-Command', ps], { windowsHide: true });
    }
  } else {
    const v = language === 'hi' ? ['-v', 'hi'] : [];
    await execFileAsync('espeak-ng', [...v, '-w', wav, text]).catch(() => execFileAsync('espeak', [...v, '-w', wav, text]));
  }
  if (!fs.existsSync(wav)) throw new Error('No text-to-speech engine available.');
}

/**
 * Windows OneCore synthesis through WinRT (works with Hindi voices that SAPI cannot see).
 * The text goes through a UTF-8 file, never the command line, so Devanagari and quotes are safe.
 */
async function windowsOneCoreSpeak(text: string, wav: string, language: VoiceLanguage, voiceName: string) {
  const voices = await windowsVoices();
  const pick = voiceName ? voices.find((v) => v.name === voiceName) : voices.find((v) => v.language.toLowerCase().startsWith(language === 'hi' ? 'hi' : 'en'));
  if (!pick) {
    const installCommand = process.platform === 'win32'
      ? 'py -3.12 -m pip install --user kokoro-onnx soundfile'
      : 'python3.12 -m pip install --user kokoro-onnx soundfile';
    throw new Error(
      language === 'hi'
        ? `No Hindi voice found. Install Kokoro with \`${installCommand}\`, or add the Windows Hindi voice: Settings → Time & language → Speech → Add voices → Hindi (India).`
        : `Voice "${voiceName}" is not installed.`
    );
  }
  const tmp = path.join(os.tmpdir(), `cf_tts_${process.pid}_${Date.now()}`);
  fs.writeFileSync(`${tmp}.txt`, text, 'utf8');
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.SpeechSynthesis.SpeechSynthesizer,Windows.Media.SpeechSynthesis,ContentType=WindowsRuntime] | Out-Null
[Windows.Storage.Streams.DataReader,Windows.Storage.Streams,ContentType=WindowsRuntime] | Out-Null
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
$text = [IO.File]::ReadAllText($args[0], [Text.Encoding]::UTF8)
$s = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$s.Voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -eq $args[2] } | Select-Object -First 1
$stream = Await ($s.SynthesizeTextToStreamAsync($text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
$n = Await ($reader.LoadAsync([uint32]$stream.Size)) ([uint32])
$bytes = New-Object byte[] $n
$reader.ReadBytes($bytes)
[IO.File]::WriteAllBytes($args[1], $bytes)
`;
  fs.writeFileSync(`${tmp}.ps1`, `﻿${script}`, 'utf8');
  try {
    await execFileAsync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${tmp}.ps1`, `${tmp}.txt`, wav, pick.name], { windowsHide: true, timeout: 1000 * 60 * 5 });
  } finally {
    fs.rmSync(`${tmp}.txt`, { force: true });
    fs.rmSync(`${tmp}.ps1`, { force: true });
  }
}

export async function audioDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]);
  return Number(stdout.trim()) || 0;
}

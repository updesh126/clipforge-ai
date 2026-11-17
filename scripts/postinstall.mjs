// Printed after `npm install` — points new users at the setup wizard. Never fails the install.
try {
  const fs = await import('node:fs');
  const first = !fs.existsSync('.env');
  console.log(`\n  ClipForge AI: ${first ? 'next step →' : 'to check or install engines →'} \x1b[1mnpm run setup\x1b[0m  (guides you through FFmpeg, Whisper, Ollama, voices and Stable Diffusion)\n`);
} catch {
  /* ignore */
}

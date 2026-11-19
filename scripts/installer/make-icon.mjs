#!/usr/bin/env node
// Builds scripts/installer/clipforge.ico — the app's "C" logo on its brand gradient (same as the TopBar badge).
// Run once after changing the design:  node scripts/installer/make-icon.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#B5E2DD"/><stop offset=".35" stop-color="#D8CCE8"/>
    <stop offset=".7" stop-color="#F4C7D6"/><stop offset="1" stop-color="#FBDFCB"/>
  </linearGradient></defs>
  <rect x="8" y="8" width="240" height="240" rx="56" fill="url(#g)"/>
  <text x="128" y="182" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="800" font-size="160" fill="#000">C</text>
</svg>`;

const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = await Promise.all(sizes.map((s) => sharp(Buffer.from(svg)).resize(s, s).png().toBuffer()));

// ICO = 6-byte header + 16-byte entry per image + PNG payloads (PNG-in-ICO works on Windows Vista and later)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const entries = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s >= 256 ? 0 : s, 0);
  e.writeUInt8(s >= 256 ? 0 : s, 1);
  e.writeUInt16LE(1, 4); // colour planes
  e.writeUInt16LE(32, 6); // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
const out = path.join(import.meta.dirname, 'clipforge.ico');
fs.writeFileSync(out, Buffer.concat([header, ...entries, ...pngs]));
console.log(`wrote ${out}`);

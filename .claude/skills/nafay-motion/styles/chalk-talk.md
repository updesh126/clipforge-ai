# Chalk Talk (Hand-Drawn)

A teacher at a long green slate: grainy chalk strokes that skip over the board's tooth, coloured chalk for emphasis, dust falling from the stick as it writes, faint ghosts of old lessons, a wooden frame and a dusty chalk tray.

Reference code: `chalk-talk.js` (demo: "Why a scratched QR code still scans", 21.8 s). Fonts: Cabin Sketch 700, Kalam 400 and 700.

## Replace for a new film
TOPIC, POSTER, TL, CAM, the counter curve (cntStep, cntVal, cntText), ITEMS, drawCounter(), WIPE and its timing, custom props (the demo's QR and drawQR), scoreSound(), BOARD and ASSUME. Keep: board(), tooth(), noise2, chalkLine, chalkText, layoutText, resample, quad, ellipse, wipeMask, wood/tray/frame, chalkStick, eraser, dust() and the compositor (explainer).

## The look
- One long slate (BW wide, 720 tall) baked once, with mottled green, ghosts of old lessons and eraser smears. The tooth is punched out of the chalk layer every frame. Wooden frame, tray with chalk pieces, classroom light falloff, fine grain.
- Everything is chalked on in order: letters one at a time with jitter, lines along their path with small skips. The stick follows the tip and dust falls from it.
- Cabin Sketch for titles and the takeaway; Kalam for equations, labels and notes. White for content, yellow for the main idea and curves, pink for emphasis and key numbers, blue for side notes. Exponents use the dy offset on text parts.
- One board, one continuous shot. The camera tracks to a fresh stretch for each idea and leans in gently on the key moment. No cuts. Keep the visible area inside the slate (cy ± 360/zoom must stay within the board plus the tray).
- Pink rings on the key number, yellow underlines and brackets, chalk arrows that lead the eye.
- Numbers are re-chalked about 10 times a second as they count, then ringed.
- The felt eraser wipes a section and leaves a faint haze; the next idea is written in the cleared space.
- Charts are real and to scale, computed from the actual values.
- Pace: something is always being written; 0.4–1.2 s per line; takeaway holds about 1.5 s.

## Legibility at 1280×720
Headings ≥ 90 px, chalked writing ≥ 56 px, labels ≥ 36 px, key numbers ≥ 72 px.

## Sound
Room tone only, no music; a double knock can open. Every word gets its own scratch timed by character position (write); lines one long scratch, rings and underlines louder (scratch); a scratch each time the counter's shown number changes; a felt swish per eraser pass, panned with it; soft plucks on big moments (two for a landed number, a rising arpeggio for the takeaway).

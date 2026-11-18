# Writing a script for ClipForge

ClipForge turns each short chunk of your script into one **scene**. A scene has:
- a picture: a place, the things in it and the light
- a camera move
- sometimes a graphic: a map, stat, timeline or quote
- the voice-over and captions

The clearer each chunk says **where we are** and **what we see**, the better the video. This guide covers what to write; [Script tags](#/docs/script-tags) lists every tag.

## The fastest way to a good video

1. **Pick the video type** on the Script page: Storytelling, Documentary, Fun or Tech explainer. It picks the art style, captions and graphics for you.
2. **Write one paragraph per scene**, using the structure for your type (below).
3. Press **Plan scenes (preview)**. In about 20 seconds you see every line as a task: what we see, where, the camera, the graphics, and whether it moves.
4. **Fix any picture that's off** right in the plan, and press **Use this plan**. It's written into your script as tags.
5. Press **Create video**.

Writing with ChatGPT, Claude or Gemini? On the Writer page open **Write with another AI**. Copy the ready-made prompt (it teaches them these rules and tags), paste their script back, press **Check it**, then **Make this video**.

Starting from a YouTube video? Use the [Script Writer](#/docs/script-writer). It keeps every fact and writes a new script with tags and a scene plan. Then press **Make this video**.

## How ClipForge reads your script

| What you write | What happens |
|---|---|
| A blank line | Starts a new paragraph. Scenes never cross paragraphs. |
| 1–2 sentences (up to about 220 characters) | One scene, about 6–12 seconds of voice-over. Longer paragraphs are split automatically. |
| A place (forest, river bank, bank office, Mumbai street…) | That scene's setting. Or write it exactly with `[place: …]`. |
| Things we can see (girl, elephant, lantern, phone, QR code…) | What's in the picture. Or write the whole picture with `[scene: …]`. |
| A time word (dawn, sunset, night) | The light of the scene. Or `[time: night]`. |
| A number (40%, 3 crore, 1,200 years) | A big counting stat, in documentaries, tech and fun. |
| “A quote in quotation marks” | A quote card. |
| A country or big city (documentary) | A real map that zooms in and highlights it. |
| More than 60 scenes | Only the first 60 are used. |

## Pick a structure for your video type

Each numbered line is **one paragraph**. Leave a blank line between them. For a 60-second short use 6–8 paragraphs of one sentence; for 2–3 minutes use 9–12 paragraphs of two sentences.

### Storytelling (fables, folk tales, kids' stories)

```
1. HOOK: one surprising line. Name the place and one striking thing.
2. WORLD: where and when. A place + time + 1–2 things we see there.
3. CHARACTER: who it's about, described once (an old fisherman, a girl with a lantern).
4. WANT: what they want or what is normal. Same character, same name.
5. CHANGE: something happens. A new thing appears (a storm, a tiger, a letter).
6. STRUGGLE: what they do about it. Action verbs: walks, climbs, follows, builds.
7. TURN: the key moment. A quote works well here.
8. RESULT: what changed. The same place at a new time (sunset, dawn).
9. CLOSE: the one line you want people to remember.
```

### Documentary (real places, history, social issues)

```
1. HOOK: a surprising fact or question, with a real place.        "Ten years ago, almost every payment in this market was cash."
2. THEN vs NOW: the change in one or two lines.                    "Today a vegetable seller simply holds up a QR code."
3. CONTEXT: when and who, with a year.                             "In 2016, the National Payments Corporation of India launched UPI."
4. HOW IT WORKS: what we would see happening.                      "Behind that tap, a bank in one city talks to a bank in another."
5. THE NUMBER: one big figure in its own sentence.                 "Over 3.5 billion payments now happen every month."
6. THE WIDER WORLD: another country or city (gets a real map).     "Now shops in France accept these payments too."
7. THE TURN: "But…", a problem, a record or a ban.                 "But the system is not without risks."
8. CLOSE: what it means for the viewer.                            "By evening, millions of small payments have moved quietly across the country."
```

### Tech explainer (how things work)

```
1. PROBLEM: what was slow, costly or hard.
2. QUESTION: "So how does it work?" (the next line answers it — becomes a question reveal).
3. STEPS: "First … then … finally …" in one paragraph (becomes a process graphic).
4. COMPARISON: "In 2016 … X; by 2024 … Y" (becomes a then-vs-now or comparison chart).
5. LIST: "A, B and C" — three short items (becomes sticker chips).
6. THE NUMBER: one big figure.
7. TAKEAWAY: what the viewer should remember or do.
```

### Fun (myths, countdowns, surprises)

```
1. QUESTION: a curious question the next line answers.
2. MYTH: what people believe.
3. FACT: "But actually…" (becomes a handwritten "But…" note).
4. COUNTDOWN or LIST: three to five short items.
5. SURPRISE: "the biggest / the first / a record…" (becomes a marker highlight).
6. CLOSE: a punchline.
```

## Sentences that make graphics by themselves

You don't need tags for these. Write the sentence this way and the graphic appears. It is only ever built from words you actually wrote, never invented.

| Write it like this | You get |
|---|---|
| "Ten years ago … Today …" | A then-vs-now panel |
| "In 1947 … In 1991 … In 2016 …" (across lines) | A timeline |
| "In 2016 … 0.1 million … by 2024 … 13,000 million" | A comparison chart |
| "First … then … finally …" | Process steps |
| "Over 3.5 billion …" | A big counting stat |
| "… shops in France …" | A real map zooming to France (documentary) |
| "Nandan Nilekani, a tech entrepreneur from Bengaluru, …" | A name-and-role lower-third |
| "Newspapers reported that …" | A newspaper headline zoom |
| "… was banned / approved / fake …" | A rubber stamp |
| "Farmers, traders and students …" | Sticker chips, one per item |
| "… the biggest / the first / a record …" | A marker highlight on that phrase |
| "But …" at the start of a line | A handwritten "But…" note |
| "A quotation," said Gandhi | A quote card |

## Rules that give the best pictures

1. **One place per paragraph.** Say it plainly ("In a quiet forest at night, …") or tag it: `[place: quiet forest]`. A new place means a new paragraph.
2. **Name what we see, 1–3 things.** "…fireflies drift between the trees while an owl watches." More than three and only the first three appear.
3. **For the key moments, describe the picture** with `[scene: …]`: one concrete sentence of the subject, objects and action. Example: `[scene: a hand holding a phone scanning a QR code at a tea stall]`.
4. **Use everyday names.** "elephant", not "pachyderm"; "phone", not "handheld device".
5. **Keep one name per character** all the way through, and describe them once, early (an old farmer in a turban). The same face is then used in every scene.
6. **Feelings need a visible thing.** Not "hope filled the air", but "a single lamp glowed in the window". Wind, light, love and sound can't be painted.
7. **Numbers in digits, in their own sentence:** "Each night, 2,000 fireflies light up this valley."
8. **Short sentences read better aloud.** Aim for 8–20 words.
9. **Write the time of day** when it matters (dawn, sunset, night) or tag `[time: night]`.
10. **Documentaries are set today** unless the line is about the past. Mention the year or "decades ago" for historical scenes.

## Directing with tags: three levels

**Level 1: no tags.** The video type and your sentences decide everything. Fine for a first try.

**Level 2: pictures only (recommended).** Add a `[place: …]` where the location changes and a `[scene: …]` on the 3–5 lines that matter. This fixes almost every "the picture has nothing to do with the line" problem.

```text
[place: busy market street in Mumbai] Ten years ago, almost every payment in this market was made in cash.

Today a vegetable seller simply holds up a QR code. [scene: a vegetable seller on a wooden cart holding up a phone next to a QR code sticker]

[place: bank server room] Behind that tap, a bank in one city talks to a bank in another, all within a single second.
```

**Level 3: full direction.** Choose the graphics, camera, transitions and Motion yourself. See [Script tags](#/docs/script-tags) for all 244 names.

```text
Over 3.5 billion payments now happen every month. [bigStat value=3.5 suffix=" billion" label="payments every month"] [zoomPunch]

The storm reaches the village at night. [time: night] [rainFx] [shake] [transition: paperTearTransition] [move]
```

## Example: weak vs good

**Weak** (abstract, no place, nothing to paint):

> The beautiful lights made everyone feel magical and happy that evening.

**Good** (place, time, three visible things):

> At sunset in the old forest, fireflies rose from the grass. A small girl held up her lantern, and an owl watched from a branch.

**Good documentary line** (place, picture, a number, a map):

> Today, shops in France accept UPI too. [place: small shop in Paris] [scene: a shopkeeper scanning a payment QR code at the counter]

## Full sample: story (shadow puppet or ink wash)

```
Every summer night, a tiny village in Kerala glows with fireflies.

The village sits beside a quiet river, under tall coconut trees. At dusk, the fishermen pull their boats onto the sand.

Meera is a girl with a lantern who loves the fireflies more than anything.

Each night she walks to the river bank and counts them, one by one.

One evening, the river bank is dark. Not a single firefly rises from the grass.

Meera asks the old fisherman why. He points at the new bright lamps on the bridge.

“Fireflies need the dark to find each other,” he says.

So Meera and the villagers switch off the bridge lamps after sunset.

The next night, more than 1,000 fireflies return to the river bank.

Sometimes, to see the light, we just have to turn ours off.
```

## Full sample: documentary (Explainer collage)

```
[title: How UPI Changed India] [place: busy old market street in Mumbai] Ten years ago, almost every payment in this market was made in cash.

Today a vegetable seller simply holds up a QR code, and the money arrives in seconds. [scene: a vegetable seller on a wooden cart holding up a phone next to a printed QR code sticker]

In 2016, the National Payments Corporation of India launched UPI.

Behind that tap, a bank in one city talks to a bank in another, all within a single second. [place: bank server room]

Over 3.5 billion payments now happen every month.

The idea travelled far beyond India, and now shops in France accept these payments too.

By evening, millions of small payments have moved quietly across the country. [time: sunset]
```

What happens automatically:
- **Scene 2:** a then-vs-now panel.
- **Scene 5:** a big stat.
- **Scene 6:** a real map of France on satellite imagery, with the "Visuals are generated by AI" note.
- **Throughout:** torn-paper transitions and film grain from the collage style.

## Hindi voice-over (हिन्दी)

- On the Script page set **Voice-over → हिन्दी Hindi**, then pick a voice: Alpha or Beta (female), Omega or Psi (male). These are Kokoro voices that run on this computer. The Windows Hindi voice (Kalpana or Hemant) also appears once you add it in Settings → Time & language → Speech.
- Write in **Devanagari**. End sentences with **।** (or . ? !). Each paragraph is still one scene.
- Write numbers as digits (१,००० or 1,000) so the stat can show them.
- Captions show your exact words, and Whisper only provides the timing. On-screen titles are written in Hindi too.
- **Tags stay in English** (`[place: …]`, `[scene: …]`, `[bigStat]`), even in a Hindi script. The `[place:]` and `[scene:]` text is best in English too, because it guides the painting.

## Quick checklist before you press Create

- [ ] The right **video type** is picked
- [ ] A blank line between every paragraph, and no paragraph longer than two sentences
- [ ] Every paragraph names a place (or clearly stays in the last one), or has a `[place: …]`
- [ ] Every paragraph has 1–3 things we can see; key lines have a `[scene: …]`
- [ ] Characters keep one name throughout
- [ ] Numbers are digits in their own sentence; quotes are in quotation marks
- [ ] The first line is a hook; the last line is the takeaway
- [ ] **Plan scenes (preview)** looks right, and **Use this plan** has been pressed

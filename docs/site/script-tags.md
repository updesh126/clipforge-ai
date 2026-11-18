# Script tags

Put **[tags]** in your script to tell ClipForge exactly which motion graphic, camera move, transition or atmosphere to use in a scene. Tags are never spoken and never appear in captions. Anything you don't tag is still chosen automatically.

```text
[title: The Digital Leap] India now has 900 million internet users. [bigStat value=900 suffix=" million" label="India now has" text="internet users"]

The storm reaches the village at night. [rainFx] [shake] [transition: paperTearTransition]

First the farmer checks the sky, then he covers the seeds, and finally he runs home. [processExplain steps="Check the sky; Cover the seeds; Run home"] [move]
```

## How to write a tag

| Form | Example | Meaning |
|---|---|---|
| `[name]` | `[rainFx]` | Use this effect in this scene |
| `[name key=value …]` | `[bigStat value=900 suffix=" million"]` | …with these settings (quote values that have spaces) |
| `[kind: name]` | `[transition: irisWipe]` | Same, saying what it is (optional — the name already tells ClipForge) |
| `[title: text]` | `[title: Why the river turned dark]` | Title banner for this scene |
| `[move]` / `[still]` | `[still]` | With Motion on: force this scene to move / stay a painting (overrides Mix) |
| `[place: setting]` | `[place: old market street in Mumbai]` | Where the scene happens. **Carries on** to the next scenes until you write another `[place: …]` |
| `[scene: picture]` | `[scene: a seller holding up a phone next to a QR code]` | Exactly what this scene's picture shows (also `[show: …]`). Beats the planner's guess |
| `[time: day/sunset/night/dawn]` | `[time: night]` | Light of the scene; carries on like `[place: …]` |

Rules:

- **A tag belongs to the scene it's written in** (a paragraph is a scene; a long paragraph may become two — the tag goes with its own sentence). A line with only tags joins the scene above it.
- **Names are forgiving:** case, spaces and dashes don't matter, and display names work too — `[Big statistic reveal]` = `[bigStat]`.
- **Unknown names are skipped** and listed while the video is made ("Ignored unknown tags…"); they are never read aloud.
- **Numbers only come from you:** a sequence that needs a number (like `value`) takes it from the tag or from the scene's own words. If neither has it, the tag is skipped rather than inventing one.
- Text settings you leave out are filled from the scene's narration (e.g. `[wordReveal]` reveals the first words of the scene).
- Your tags always win over the automatic choices for that scene.

## Tips for the best output

1. **Tag the 2–4 key moments**, not every scene — let ClipForge handle the rest. One strong stat or timeline beats five weak ones.
2. **Write the facts in the sentence too** ("900 million internet users"), so captions, voice and graphic agree.
3. **Give sequences their settings** for full control: `events="1947|Independence; 1991|Reforms"`, `steps="Plan; Build; Launch"`, `data="Delhi:21, Mumbai:24"`.
4. **One transition per cut** and one atmosphere per scene; atmosphere suits the mood (rain, fireflies, embers), not decoration.
5. **Camera:** `pushIn` for emotion, `panLeft`/`panRight` to reveal, `pullOut` for endings, `zoomPunch` for a punchline.
6. **With Motion on**, use `[move]` on action scenes and `[still]` on quiet ones to steer Mix.
7. **Pictures off-topic?** Set the setting once with `[place: …]` and describe key pictures with `[scene: …]` — your words always beat the AI planner. Documentaries also get a real world map automatically when a line names a country or a big city.
7. **Match the video type:** documentary → timelines, maps, quotes; tech → processes, charts, comparisons; fun → questions, myths, countdowns.

## Camera moves

5 planned moves replace the scene's camera; the others are added on top.

| Tag | What it does | Length |
|---|---|---|
| `[zoomPunch]` | Quick punch-in on the video, then hold | 1.2s |
| `[slowZoom]` | Gentle Ken Burns push-in | 5s |
| `[shake]` | Camera shake for impact | 0.5s |
| `[pushIn]` | 2.5D dolly towards the scene (parallax by layer depth) *(replaces the planned camera)* | 5s |
| `[pullOut]` | 2.5D dolly away from the scene *(replaces the planned camera)* | 5s |
| `[panLeft]` | Camera slides left; near layers move more *(replaces the planned camera)* | 5s |
| `[panRight]` | Camera slides right; near layers move more *(replaces the planned camera)* | 5s |
| `[tiltUp]` | Camera rises to reveal the sky *(replaces the planned camera)* | 5s |

Settings: `intensity` (0.2–2) for the add-on effects, e.g. `[shake intensity=0.5]`.

## Transitions

Used to cut **into** the scene the tag is in.

| Tag | What it does | Length |
|---|---|---|
| `[whipPan]` | Fast blurred swipe — place it across a scene cut | 0.5s |
| `[irisWipe]` | Ink circle closes and opens — place it across a scene cut | 0.8s |
| `[flash]` | White flash transition | 0.4s |
| `[fadeIn]` | Fade from black | 0.8s |
| `[fadeOut]` | Fade to black | 0.8s |
| `[wipeTransition]` | Colour panel wipes across the cut | 0.9s |
| `[dipToColour]` | Fade through a colour | 0.9s |
| `[irisTransition]` | Circle closes and opens | 1s |
| `[radialWipe]` | Sweeps round like a clock hand | 1s |
| `[shutterTransition]` | Top and bottom halves close and open | 0.9s |
| `[blindsTransition]` | Strips close and open | 1s |
| `[splitTransition]` | Two halves slide shut and apart | 1s |
| `[gridWipe]` | Squares fill diagonally | 1.1s |
| `[pixelDissolve]` | Random blocks cover and clear | 1.1s |
| `[paperTearTransition]` | A torn paper sheet slides through | 1.2s |
| `[lineWipe]` | Diagonal colour bars sweep | 1s |
| `[textWipe]` | Wipe that carries a word | 1.2s |

Settings for the colour wipes: `accent`, `accent2`, `direction` (left, right, up, down); `[textWipe text="MEANWHILE"]`.

## Atmosphere

A see-through overlay for the whole scene (replaces the automatic one).

| Tag | What it does |
|---|---|
| `[dustParticles]` | Soft motes drifting |
| `[rainFx]` | Falling rain streaks |
| `[snowFx]` | Drifting snowflakes |
| `[confetti]` | Celebration confetti |
| `[sparks]` | Rising sparks |
| `[embers]` | Orange embers floating up |
| `[bokeh]` | Soft out-of-focus circles |
| `[twinklingStars]` | Night sky sparkle |
| `[fireflyGlow]` | Glowing fireflies wandering |
| `[lightSweep]` | A sheen sweeps across |
| `[lightRays]` | Rotating god rays |
| `[filmGrain]` | Animated grain overlay |
| `[vignette]` | Darkened edges |
| `[lightLeak]` | Warm film light leaks |
| `[filmBurn]` | A burn flash (use at a cut) |
| `[vhsLook]` | Scanlines, tracking noise, PLAY tag |
| `[glitchBars]` | Glitch bars in red and cyan |
| `[spotlight]` | Darken everything but one spot |
| `[fogDrift]` | Soft fog drifting |
| `[gradientMove]` | Slowly rotating colour gradient background |
| `[patternBackground]` | Moving dots / grid / stripes |
| `[colourWash]` | Tint the footage a colour |
| `[glowPulse]` | A pulsing radial glow |

Settings: `count` and `colors` for particles; `amount` (0–1) for looks, e.g. `[vignette amount=0.6]`.

## Explainer sequences

Full storytelling beats (a big stat, a timeline, a map…). Settings marked **number** must come from the tag or the scene's words.

| Tag | What it shows | Settings | Example |
|---|---|---|---|
| `[bigStat]` | Backdrop, small label, number counts up and settles, support text, underline | `label`, `value` (number), `suffix`, `text` | `[bigStat label="India now has" value=900 suffix=" million" text="internet users"]` |
| `[chartExplain]` | Title, axes draw, bars grow, the key bar turns accent, an arrow points to it, conclusion | `title`, `data`, `highlight`, `note` | `[chartExplain title="Who uses the most data?" data="Delhi:21, Mumbai:24, Pune:18, Kochi:31" highlight=Kochi note="Kochi leads — despite being the smallest city"]` |
| `[mapInvestigation]` | World map, zoom into a country, highlight, pin, info card | `country`, `city`, `note` | `[mapInvestigation country=India city=Kochi note="Kerala: 1 in 3 villages saw fireflies return"]` |
| `[evidence]` | Paper enters, camera pushes in, text highlighted, red circle, arrow, pull quote | `title`, `text`, `highlight`, `quote` | `[evidence title="Report, 2024" text="Inspectors found that the bridge lights were installed without any study of their effect on local wildlife." highlight="without any study" quote="Without any study."]` |
| `[comparison]` | Two values side by side, counting, with the difference highlighted | `title`, `labelA`, `valueA` (number), `labelB`, `valueB` (number) | `[comparison title="Fireflies counted" labelA=2004 valueA=1200 labelB=2024 valueB=140]` |
| `[timelineHistory]` | Line draws, years appear one by one, last milestone pulses | `events` | `[timelineHistory events="1947\|Independence; 1969\|ISRO founded; 1991\|Reforms; 2023\|Moon landing"]` |
| `[processExplain]` | Nodes appear, connectors draw, each step lights up in turn | `steps` | `[processExplain steps="Seed; Sprout; Flower; Fruit"]` |
| `[quoteStatement]` | Frame darkens, quote marks, lines reveal, key phrase highlighted, source | `text`, `highlight`, `source` | `[quoteStatement text="Fireflies need the dark to find each other." highlight="the dark" source="Old fisherman"]` |
| `[spotlightInvestigation]` | Spotlight on a subject, circle draws, magnifier, label — place over footage or a photo | `x` (number), `y` (number), `label` | `[spotlightInvestigation x=55 y=45 label="the suspect"]` |
| `[chapterTransition]` | Scene wipes out, chapter number and title, subtitle | `number`, `text`, `subtitle` | `[chapterTransition number=02 text="The darkness" subtitle="Chapter two"]` |
| `[breakingNews]` | Red headline bar, ticker, facts lower third | `text`, `ticker`, `facts` | `[breakingNews text="Fireflies return to the river" ticker="BREAKING • 1,000 fireflies counted • Bridge lights switched off • Villagers celebrate" facts="Kerala, 9 pm"]` |
| `[questionReveal]` | Big question mark, headline, highlight, explanation | `text`, `answer` | `[questionReveal text="Where did the fireflies go?" answer="They were blinded by the new lights."]` |
| `[mythVsFact]` | Myth card crossed out, fact card ticked | `textA`, `textB` | `[mythVsFact textA="Fireflies only live in jungles" textB="They thrive near rivers and fields"]` |
| `[rankingCountdown]` | Ranks count down to #1, which glows | `title`, `data` | `[rankingCountdown title="Brightest firefly spots" data="Kochi:92, Goa:88, Coorg:85, Munnar:80, Wayanad:76"]` |
| `[topFive]` | Title, five cards, sequential highlights, winner | `title`, `items` | `[topFive title="Top 5 reasons" items="Dark skies\|No street lights; Clean water\|No pesticides; Tall grass\|Safe for larvae; Quiet nights\|Less traffic; Care\|Villagers protect them"]` |
| `[moneyBreakdown]` | Total counts up, then splits into a labelled donut | `value` (number), `label`, `data` | `[moneyBreakdown value=120000 label="Monthly budget" data="Rent:40, Food:25, Travel:15, Savings:20"]` |
| `[mapComparison]` | Two regions highlighted in contrasting colours | `country`, `title` | `[mapComparison country="India, China" title="Two giants"]` |
| `[productBreakdown]` | Shape appears, numbered parts, labelled connectors | `labels` | `[productBreakdown labels="Lens; Battery; Sensor"]` |
| `[socialAnalysis]` | Post, likes/comments count, a comment is highlighted | `text`, `likes` (number), `comment` | `[socialAnalysis text="The fireflies are back!! 😭✨" likes=248000 comment="“Switching off one bridge did this?”"]` |
| `[websiteAnalysis]` | Browser loads, a line is boxed, cursor clicks, circle annotation | `url`, `text` | `[websiteAnalysis url=gov.in/wildlife-report text="Wildlife Report 2025"]` |
| `[searchInvestigation]` | Search bar, typing, results, selected result | `query`, `results` | `[searchInvestigation query="why are fireflies disappearing" results="Light pollution confuses fireflies; Pesticides harm larvae; Habitat loss near rivers"]` |
| `[newsHeadline]` | Newspaper slides in, zoom to headline, highlight | `text`, `highlight` | `[newsHeadline text="Fireflies return to the river after 20 years" highlight="after 20 years"]` |
| `[historicalProgression]` | Year counter rolls, then milestones down a vertical timeline | `from` (number), `value` (number), `events` | `[historicalProgression from=1950 value=2025 events="1950\|Lamps; 1980\|Street lights; 2005\|LEDs; 2025\|Dark-sky zones"]` |
| `[characterIntro]` | Name, role, then fact labels | `name`, `role`, `facts` | `[characterIntro name=Meera role="Firefly counter, age 9" facts="Counts every night\|Since age 6; Favourite\|The river bank"]` |
| `[globalStats]` | Globe spins to a country, then the figure counts up | `country`, `value` (number), `suffix`, `label` | `[globalStats country=India value=2000 suffix=+ label="firefly species worldwide"]` |
| `[networkConnections]` | First node, connected nodes, network expansion with pulses | `nodes` | `[networkConnections nodes="Meera; Fisherman; Villagers; Panchayat; Forest dept.; School; Media"]` |
| `[causeEffect]` | Cause → arrow → effect → result | `steps` | `[causeEffect steps="Bright bridge lamps; Fireflies cannot see each other; No fireflies"]` |
| `[questionAnswer]` | Question, pause, answer reveal, tick | `text`, `answer` | `[questionAnswer text="Can one switch save them?" answer="Yes — 1,000 came back in a night."]` |
| `[finalConclusion]` | Main statement, key statistic, end card | `text`, `value` (number), `label`, `end` | `[finalConclusion text="To see the light, turn ours *off*." value=1000 label="fireflies came back" end="Thanks for watching"]` |
| `[dataStory]` | Line draws over time, a label pins the turning point | `title`, `data`, `note` | `[dataStory title="Fireflies counted per night" data="2004:1200, 2010:900, 2016:400, 2020:140, 2024:1000" note="Lights off in 2023 → instant recovery"]` |

## Motion graphics

Added on top of the scene for a few seconds. Every one also takes the common settings: `delay`, `speed`, `easing`, `exit`, `scale`, `color`, `accent`.

### Typography

Kinetic text, marker highlight, title cards, word reveal.

| Tag | What it does | Settings |
|---|---|---|
| `[wordReveal]` | Words rise in one after another with the narration | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[letterReveal]` | Each letter fades up in sequence | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[typewriter]` | Characters type on with a blinking caret | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[lineReveal]` | Lines slide up through a mask, one by one | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[sentenceReveal]` | The whole sentence fades up at once | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textSlideIn]` | Words slide in from the side | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textScaleIn]` | Words grow from small to full size | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textFade]` | A calm fade, word by word | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textBlurReveal]` | Words come into focus from a blur | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textMaskReveal]` | Words emerge from behind an invisible line | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textWipeReveal]` | The line is wiped on from left to right | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textPop]` | Words pop in with a bounce | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textRotateReveal]` | Words swing up into place | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textFlip]` | Words flip up like a departure board | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textDrop]` | Words drop in from above | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[trackingExpand]` | Letters spread from wide tracking into place | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textScramble]` | Letters decode from random characters | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[staggeredType]` | Long stagger, big type, cinematic | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[perspectiveText]` | Text tilted in 3-D space | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[subtitleEmphasis]` | *Starred* words pop in the accent with a marker behind | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textOnPaper]` | Words on a paper-coloured strip | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[textTag]` | Small label tag that snaps in | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |
| `[oversizedHeadline]` | Huge stacked words slam in one by one | `text`, `size`, `stagger`, `wobble`, `font` |
| `[kineticTypography]` | Alternating sizes and colours, energetic | `text`, `size`, `stagger`, `wobble`, `font` |
| `[paperTitle]` | Torn paper slides up, title fades in, marker line draws | `text`, `kicker`, `size`, `font`, `bg`, `ink`, `tilt`, `x`, `y` |
| `[markerHighlight]` | Highlighter sweeps behind a phrase | `text`, `mode`, `anim`, `size`, `font`, `ink`, `markAt`, `x`, `y` |
| `[markerUnderline]` | Hand-drawn underline sweeps beneath | `text`, `mode`, `anim`, `size`, `font`, `ink`, `markAt`, `x`, `y` |
| `[doubleUnderline]` | Two quick marker strokes | `text`, `mode`, `anim`, `size`, `font`, `ink`, `markAt`, `x`, `y` |
| `[strikeThrough]` | A marker line crosses the phrase out | `text`, `mode`, `anim`, `size`, `font`, `ink`, `markAt`, `x`, `y` |
| `[circledWord]` | A red pen circle around a phrase | `text`, `mode`, `anim`, `size`, `font`, `ink`, `markAt`, `x`, `y` |
| `[boxedWord]` | A hand-drawn box around a phrase | `text`, `mode`, `anim`, `size`, `font`, `ink`, `markAt`, `x`, `y` |
| `[quoteCard]` | Frame dims, big quote marks, lines reveal, phrase highlighted | `text`, `highlight`, `source`, `size`, `font` |
| `[pullQuote]` | Short, punchy quote with source | `text`, `highlight`, `source`, `size`, `font` |
| `[lowerThird]` | Name and role slide in beside an accent bar | `text`, `subtitle`, `size`, `x`, `y` |
| `[newsTicker]` | Scrolling breaking-news bar | `text`, `label`, `direction`, `size`, `pace`, `barColor`, `y` |
| `[scrollingCredits]` | Vertical scroll like end credits | `text`, `label`, `direction`, `size`, `pace`, `barColor`, `y` |
| `[chapterCard]` | Colour panel wipes, chapter number and title | `number`, `text`, `subtitle`, `size`, `bg`, `ink`, `font` |
| `[textMorph]` | One phrase blurs and morphs into another | `text`, `text2`, `size`, `swapAt`, `x`, `y` |
| `[numberToText]` | A number transforms into its meaning | `text`, `text2`, `size`, `swapAt`, `x`, `y` |
| `[circularText]` | Text runs around a rotating ring | `text`, `center`, `radius`, `size`, `spin`, `x`, `y` |
| `[handwrittenNote]` | Marker-style handwriting that writes on | `text`, `subtitle`, `unit`, `anim`, `stagger`, `size`, `font`, `weight`, `case`, `box`, `emMarker`, `tilt`, `align`, `x`, `y` |

### Data visualisation

Bar charts, line graphs, counters, donut charts.

| Tag | What it does | Settings |
|---|---|---|
| `[countingNumber]` | A big number counts up and settles | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |
| `[percentCounter]` | Counts up to a percentage | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |
| `[currencyCounter]` | Rupee (or any currency) amount with Indian grouping | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |
| `[decimalCounter]` | Counts with decimals (e.g. 7.2%) | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |
| `[odometer]` | Digits roll like a meter | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |
| `[numberRoll]` | Fast slot-machine roll to the value | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |
| `[countDown]` | Counts down from a value (e.g. decline) | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |
| `[barGrowth]` | Bars grow from the baseline with labels | `title`, `data`, `orientation`, `mode`, `sort`, `highlight`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `colors`, `stagger` |
| `[horizontalBars]` | Bars grow sideways — best for long labels | `title`, `data`, `orientation`, `mode`, `sort`, `highlight`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `colors`, `stagger` |
| `[stackedBars]` | Each bar is made of segments | `title`, `data`, `orientation`, `mode`, `sort`, `highlight`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `colors`, `stagger` |
| `[groupedBars]` | Side-by-side series per category | `title`, `data`, `orientation`, `mode`, `sort`, `highlight`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `colors`, `stagger` |
| `[barHighlight]` | One bar turns accent, others dim | `title`, `data`, `orientation`, `mode`, `sort`, `highlight`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `colors`, `stagger` |
| `[chartSorting]` | Bars arranged from biggest to smallest | `title`, `data`, `orientation`, `mode`, `sort`, `highlight`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `colors`, `stagger` |
| `[lineDraw]` | A line traces across the years; the head carries its value | `title`, `data`, `mode`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `drawDur`, `zeroBase` |
| `[multiLine]` | Two or more series draw together | `title`, `data`, `mode`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `drawDur`, `zeroBase` |
| `[areaReveal]` | Filled area grows under the line | `title`, `data`, `mode`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `drawDur`, `zeroBase` |
| `[pieReveal]` | Slices sweep around in order | `title`, `data`, `mode`, `highlight`, `center` |
| `[donutReveal]` | Segments sweep around a ring with a centre total | `title`, `data`, `mode`, `highlight`, `center` |
| `[radialProgress]` | A ring fills to a percentage | `value`, `label`, `mode`, `suffix` |
| `[gaugeDial]` | Needle swings across a dial | `value`, `label`, `mode`, `suffix` |
| `[pictogram]` | “3 in 10 people…” icons fill in | `title`, `value`, `total`, `text`, `icon`, `cols` |
| `[beforeAfter]` | Two values count and grow side by side, difference badge | `title`, `labelA`, `valueA`, `labelB`, `valueB`, `diffText`, `format`, `prefix`, `suffix`, `grouping`, `showDiff` |
| `[rankingChart]` | Ranked rows slide in; #1 glows | `title`, `data`, `order`, `format`, `prefix`, `suffix`, `grouping` |
| `[funnelChart]` | Stages narrow down | `title`, `data`, `mode` |
| `[pyramidChart]` | Layers build into a pyramid | `title`, `data`, `mode` |
| `[bubbleChart]` | Circles sized by value pop in, packed together | `title`, `data` |
| `[heatmapReveal]` | Cells fill in a diagonal wave | `title`, `data` |
| `[waterfallChart]` | Running total with rises and falls | `title`, `data` |
| `[histogram]` | Distribution bars, no gaps feel | `title`, `data`, `orientation`, `mode`, `sort`, `highlight`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `colors`, `stagger` |
| `[dataLabelReveal]` | Small number + label to pin on footage | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |

### Maps

Map zoom, route drawing, location pins, region highlights.

| Tag | What it does | Settings |
|---|---|---|
| `[countryHighlight]` | World map; one country lights up with a pulse | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |
| `[mapZoomIn]` | World map zooms into a country, which highlights | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |
| `[pinDrop]` | Pins drop on cities one by one | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |
| `[routeDraw]` | A great-circle route draws between two places | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |
| `[flightPath]` | Dotted flight route with a travelling dot | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |
| `[shippingRoute]` | Dashed sea route on a paper map | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |
| `[regionCompare]` | Two countries in contrasting colours | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |
| `[choropleth]` | Countries shaded by value | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |
| `[globeSpin]` | A globe spins to a country and pins it | `country`, `label`, `title`, `spinDur`, `mapTheme` |
| `[paperMap]` | Vintage paper-style map with a highlight | `mode`, `country`, `cities`, `from`, `to`, `line`, `data`, `title`, `note`, `label`, `mapTheme` |

### Annotations

Arrows, circles, labels, stamps, evidence markers.

| Tag | What it does | Settings |
|---|---|---|
| `[redCircle]` | Hand-drawn circle around a subject | `shape`, `x`, `y`, `w`, `h`, `label`, `stroke`, `double`, `drawDur` |
| `[handOval]` | Wide oval around a phrase or object | `shape`, `x`, `y`, `w`, `h`, `label`, `stroke`, `double`, `drawDur` |
| `[handRect]` | Marker box around a region | `shape`, `x`, `y`, `w`, `h`, `label`, `stroke`, `double`, `drawDur` |
| `[handUnderline]` | Marker underline to place under anything | `shape`, `x`, `y`, `w`, `h`, `label`, `stroke`, `double`, `drawDur` |
| `[crossOut]` | Big red X over something wrong | `shape`, `x`, `y`, `w`, `h`, `label`, `stroke`, `double`, `drawDur` |
| `[checkMark]` | Green tick draws on | `shape`, `x`, `y`, `w`, `h`, `label`, `stroke`, `double`, `drawDur` |
| `[questionMark]` | Big marker “?” pops in | `shape`, `x`, `y`, `w`, `h`, `label`, `stroke`, `double`, `drawDur` |
| `[exclamationMark]` | Big marker “!” pops in | `shape`, `x`, `y`, `w`, `h`, `label`, `stroke`, `double`, `drawDur` |
| `[arrowDraw]` | Straight arrow draws to a point | `x1`, `y1`, `x2`, `y2`, `style`, `curve`, `label`, `stroke` |
| `[curvedArrow]` | Curved marker arrow with a label | `x1`, `y1`, `x2`, `y2`, `style`, `curve`, `label`, `stroke` |
| `[dottedArrow]` | Dotted path arrow | `x1`, `y1`, `x2`, `y2`, `style`, `curve`, `label`, `stroke` |
| `[leaderLine]` | Dot on a point, line out to a label | `x`, `y`, `lx`, `ly`, `text`, `subtitle`, `style` |
| `[dashedConnector]` | Dashed pointer to a label | `x`, `y`, `lx`, `ly`, `text`, `subtitle`, `style` |
| `[bracketAnnotation]` | Curly bracket groups a region | `x`, `y`, `len`, `orientation`, `label` |
| `[magnifier]` | A lens glides in to inspect a detail | `x`, `y`, `radius`, `text`, `label` |
| `[stampReveal]` | A stamp slams down with ink texture | `text`, `x`, `y`, `size`, `rotate` |
| `[approvedStamp]` | Green APPROVED stamp | `text`, `x`, `y`, `size`, `rotate` |
| `[fakeStamp]` | Red FAKE stamp for debunks | `text`, `x`, `y`, `size`, `rotate` |
| `[redaction]` | Black bars wipe over text lines | `x`, `y`, `w`, `lines`, `lineHeight`, `text` |
| `[stickyNote]` | Yellow note drops in with tape | `text`, `x`, `y`, `size`, `rotate`, `bg` |
| `[speechBubble]` | A speech bubble pops from a point | `text`, `kind`, `x`, `y`, `tx`, `ty`, `size` |
| `[thoughtBubble]` | Cloud bubble with trailing dots | `text`, `kind`, `x`, `y`, `tx`, `ty`, `size` |
| `[numberedCallouts]` | Numbered markers pop in one by one | `points`, `labels`, `stagger` |
| `[documentExcerpt]` | Paper slides in, camera pushes, phrase is highlighted | `title`, `text`, `highlight`, `source`, `size`, `rotate`, `zoom` |
| `[cursorClick]` | Mouse glides to a spot and clicks | `x1`, `y1`, `x2`, `y2`, `label` |

### Shapes

Path drawing, shape morphing, geometric reveals.

| Tag | What it does | Settings |
|---|---|---|
| `[circleDraw]` | A circle outline draws on | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[circleExpand]` | A filled circle grows from the centre | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[squareReveal]` | A square draws on | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[triangleBuild]` | Triangle path draws then fills | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[polygonReveal]` | Hexagon pops in | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[starPop]` | Star pops with a spin | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[lineDrawShape]` | A single line draws across | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[shapeWipe]` | Shape wiped on from the left | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[shapeMorph]` | Circle morphs to square and back | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[ripple]` | Concentric rings ripple outward | `shape`, `anim`, `size`, `filled`, `stroke`, `x`, `y` |
| `[geometricExplosion]` | Pieces burst outward | `count`, `direction`, `shape`, `colors`, `x`, `y` |
| `[shapeAssembly]` | Scattered pieces gather into a point | `count`, `direction`, `shape`, `colors`, `x`, `y` |
| `[gridReveal]` | Grid lines draw across the frame | `cols`, `mode` |
| `[tileReveal]` | Tiles pop in a diagonal wave | `cols`, `mode` |

### Layouts

Split screen, cards, browser, chat, newspaper, evidence board.

| Tag | What it does | Settings |
|---|---|---|
| `[splitScreen]` | Two panels slide in with a VS badge | `labelA`, `textA`, `labelB`, `textB`, `colorA`, `colorB`, `vs`, `vsText` |
| `[cardRow]` | Cards rise in side by side | `title`, `items`, `layout`, `highlight`, `stagger` |
| `[cardList]` | Stacked rows of key points | `title`, `items`, `layout`, `highlight`, `stagger` |
| `[cardStack]` | Cards pile up at angles | `title`, `items`, `layout`, `highlight`, `stagger` |
| `[cardFan]` | Cards fan out like a hand | `title`, `items`, `layout`, `highlight`, `stagger` |
| `[browserReveal]` | URL types, page loads, a line is boxed | `url`, `text`, `highlightLine` |
| `[searchInvestigation]` | Query types, results drop, one is selected | `query`, `results`, `select` |
| `[chatConversation]` | Phone with messages popping in | `messages`, `stagger` |
| `[socialPost]` | Post card with counting likes and a highlighted comment | `name`, `handle`, `text`, `likes`, `comments`, `comment` |
| `[newspaperZoom]` | Paper slides in, zooms to the headline, highlight | `masthead`, `text`, `highlight`, `zoomTo` |
| `[evidenceBoard]` | Pinned cards joined by red string | `items` |
| `[mythVsFact]` | Myth crossed out, fact ticked | `labelA`, `textA`, `labelB`, `textB` |

### Timelines

Historical progression, dates, milestone reveals.

| Tag | What it does | Settings |
|---|---|---|
| `[timelineHorizontal]` | Line draws, events appear, big year counter | `events`, `orientation`, `bigYear`, `stagger` |
| `[timelineVertical]` | Top-to-bottom milestones | `events`, `orientation`, `bigYear`, `stagger` |
| `[decadeProgression]` | Decades step by with a year counter | `events`, `orientation`, `bigYear`, `stagger` |
| `[thenVsNow]` | Two eras side by side | `labelA`, `textA`, `labelB`, `textB`, `colorA`, `colorB`, `vs`, `vsText` |
| `[yearCounter]` | Years roll forward to a date | `value`, `from`, `label`, `text`, `format`, `prefix`, `suffix`, `grouping`, `currency`, `decimals`, `style`, `size`, `countDur`, `underline`, `font`, `x`, `y` |

### Diagrams

Flowcharts, networks, processes, cause and effect.

| Tag | What it does | Settings |
|---|---|---|
| `[processFlow]` | Steps appear with arrows; the active one glows | `steps`, `layout`, `stagger` |
| `[circularProcess]` | Steps around a cycle | `steps`, `layout`, `stagger` |
| `[networkGraph]` | Hub and connected nodes with travelling pulses | `nodes`, `mesh` |
| `[causeAndEffect]` | Cause → effect → result chain | `steps`, `labels` |
| `[orgChart]` | Levels reveal top-down with connectors | `tree` |
| `[decisionTree]` | Branching choices | `tree` |

### Scientific

Atoms, waves, gears, DNA, orbits, circuits.

| Tag | What it does | Settings |
|---|---|---|
| `[atomOrbit]` | Electrons orbit a nucleus | `kind`, `label`, `size`, `x`, `y` |
| `[wavePropagation]` | A travelling sine wave | `kind`, `label`, `size`, `x`, `y` |
| `[gearAnimation]` | Two meshing gears turn | `kind`, `label`, `size`, `x`, `y` |
| `[dnaHelix]` | A rotating double helix | `kind`, `label`, `size`, `x`, `y` |
| `[solarSystem]` | Planets orbit the sun | `kind`, `label`, `size`, `x`, `y` |
| `[circuitTrace]` | Electric pulses race along circuit lines | `kind`, `label`, `size`, `x`, `y` |
| `[molecule]` | A rotating water molecule | `kind`, `label`, `size`, `x`, `y` |
| `[heartbeat]` | ECG line pulses across | `kind`, `label`, `size`, `x`, `y` |

### Finance

Currency, coins, money flow, budgets.

| Tag | What it does | Settings |
|---|---|---|
| `[coinStack]` | Stacks of coins grow to their values | `data` |
| `[currencyConversion]` | Amount counts, converts and counts again | `value`, `rate`, `from`, `to`, `note` |
| `[moneyFlow]` | Money travels from one side to the other | `from`, `to`, `value`, `prefix`, `suffix`, `icon` |
| `[budgetDonut]` | Where the money goes, as a donut | `title`, `data`, `mode`, `highlight`, `center` |
| `[revenueGraph]` | Revenue line with crore values | `title`, `data`, `mode`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `drawDur`, `zeroBase` |
| `[stockMove]` | Jagged price line with the latest value | `title`, `data`, `mode`, `legend`, `note`, `source`, `format`, `prefix`, `suffix`, `grouping`, `drawDur`, `zeroBase` |
| `[salaryCompare]` | Two salaries with the difference | `title`, `labelA`, `valueA`, `labelB`, `valueB`, `diffText`, `format`, `prefix`, `suffix`, `grouping`, `showDiff` |
| `[financialWaterfall]` | Revenue to profit, step by step | `title`, `data` |

### Audio reactive

Waveforms, beat pulses, narration progress.

| Tag | What it does | Settings |
|---|---|---|
| `[waveformBars]` | Voice-like bars pulsing | `kind`, `bpm`, `text`, `x`, `y` |
| `[soundwaveLine]` | A flowing wave line | `kind`, `bpm`, `text`, `x`, `y` |
| `[circularSpectrum]` | Radial frequency bars | `kind`, `bpm`, `text`, `x`, `y` |
| `[beatPulse]` | A disc pulsing to a BPM | `kind`, `bpm`, `text`, `x`, `y` |
| `[narrationProgress]` | A glowing line fills as the story plays | `kind`, `bpm`, `text`, `x`, `y` |
| `[speakerIndicator]` | Name tag with a talking glow | `kind`, `bpm`, `text`, `x`, `y` |

---

This page is generated from ClipForge's motion catalogue (`npm run tags-doc`), so every name here works.

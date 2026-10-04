# Broodfall comics

Comics made from a script on rfab.ai: we write the cast, every picture and every word, and the server draws each panel
from the pictures of the people in it, letters the words as written and lays out the page. Started Oct 4 2026 (Collins:
"practice with comics for broodfall").

| Comic | What is in it | Page |
|---|---|---|
| Ship's Night | YOKE and the Technician, YOKE's lines word for word from the lorebook | `ships-night/pages/page_01.jpg` |
| A Message From the Boss | the boss scene (`content/boss.ts`), every line as written, over two pages; Barnabas is a real dog in a jacket cut for a dog, drawn once from a description | `a-message-from-the-boss/pages/page_01.jpg`, `page_02.jpg` |
| The Thing From the Sky | the B-movie look, an insect couple drawn from descriptions alone | `the-thing-from-the-sky/pages/page_01.jpg` |

Each folder: `script.json` (the whole comic: edit it and run again), `pages/` (the page with words and without),
`panels/` (each picture, clean and with its words).

## In the game

The player unlocks these on the ship and reads them again whenever he likes: COMICS in the room bar
(`src/ui/comics.ts`). `content/comics.ts` lists the comics the game has and what earns each; the pages it loads are
baked from this folder:

```
node tools/comics/bake.mjs            comics/<id>/pages + a cover  ->  public/art/ship/comics/<id>/
npx vitest run tests/comics.test.ts   the shipped folder against content/comics.ts
node tools/shot-comics.mjs            the shelf walked in the real page
```

To put a new comic in the game: make it here, add its row to `content/comics.ts` (its id, its pages, one line about
it, how it is earned, and the fact that earns it), bake, run the test and the walk. `"cover": "<panel id>"` in a
`script.json` picks the picture on its tile (the first panel when it is left out).

## Make one

```
set RFAB_API_KEY=...                                            (already a user env var on this box)
node C:/Users/Merry/agent-tools/rfab-comic.js guide             the rules: read them first (free)
node C:/Users/Merry/agent-tools/rfab-comic.js estimate <script.json> --prompts     the price, and every prompt as it is sent (free)
node C:/Users/Merry/agent-tools/rfab-comic.js save <script.json>                   prints the comic id (free)
node C:/Users/Merry/agent-tools/rfab-comic.js run <id> cast      only when someone in the cast has no picture; LOOK at them
node C:/Users/Merry/agent-tools/rfab-comic.js run <id> pictures  then LOOK: rfab-comic pull <id> --out <dir>
node C:/Users/Merry/agent-tools/rfab-comic.js run <id> words
node C:/Users/Merry/agent-tools/rfab-comic.js run <id> pages
node C:/Users/Merry/agent-tools/rfab-comic.js download <id> --out <dir>
```

To change a panel: edit its `picture` (or its words) in `script.json`, `save <script.json> --comic <id>`, run again.
Only what changed is drawn again. `run <id> pictures --reroll <panel>` draws one again as it is written.

Six panels cost about 26,000 tokens ($0.52): $0.08 a picture on GPT Image 2, a small look per picture for the balloons.

## What works for Broodfall

- **Copy the cast block** from `ships-night/script.json`: YOKE from `notes/concepts/2026-09-29/r4-yoke-colour.png`, the
  Technician from `hero-behind-desk.png` (always from behind). A character with art in the repo gives `image`; one
  without gives a `description` and the cast phase draws them once (Barnabas, Mabel, Earl).
- **The look says how the world is drawn, never who is in it.** The first take's look said "the one drawn thing aboard
  is the ship's AI, a hologram" and the engine put a hologram in the one panel YOKE was not in. That YOKE is a drawn
  hologram in a photoreal room is in HER description.
- **The four looks stay apart** (`assets/style-bible.md`): the ship (photoreal, black and bare), the films (1950s
  Technicolor), the board, the map units. One comic, one look.
- Every person in the film look is an insect: say so in the look, or the engine draws humans.
- Leave the balloons room: ask for plain wall or sky where the words will go.
- **A character who is an animal is an animal.** Barnabas first came out as a retriever's head on a man's shoulders
  (the game's own still is that too). Collins: "really cute but it could be a little more natural". His description now
  says a real dog in every way, a dog's body and posture, in a jacket tailored for a dog, "never a human body"; his
  panels are things a dog does (circling the chair before sitting, a bite out of the report, watching a ball, ending
  the call with his nose).
- Something on a screen is drawn in the room as well unless told not to: "the only dog is the one on the display:
  there is no dog in the room".
- The engine improvises when a panel is vague (it drew a giant spider for "the creep is climbing the houses"). Say
  what is there and what is not, then run again: only that panel is redrawn.
- YOKE's lines are quoted, not written: `content/lore/ship-ai-lorebook.md`, `content/boss.ts`, `content/yokeScenes.ts`.

Not yet: the pictures are 1024 x 768 (the engine's smaller size); a balloon can sit on a character's body (it only
keeps off faces).

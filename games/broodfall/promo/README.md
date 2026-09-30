# Broodfall: covers and promotional art (Sep 30 2026)

Store covers, key art, posters and screenshots for Broodfall. **No picture carries lettering
from the image model.** The title is the game's own logo: the emblem picture
(`public/art/screens/emblem.webp`) with the word BROODFALL set in type exactly as
`src/screens.css` `.logo-word` sets it (Impact, the orange-to-blood gradient, the rough edge,
the lean). Taglines and credits are set in type as well. The whole set can be rebuilt for free
from the raw pictures in `art-src/promo/` (git-ignored, on Collins's PC only).

| Script | What it does |
|---|---|
| `tools/promo/gen.mjs` | Draws the raw pictures through the RFab image API (gpt-image-2, high quality). **Spends tokens.** Skips what is already on disk. |
| `tools/promo/compose.mjs` | Lays out every cover and poster in HTML at its exact size and photographs it with headless Chromium. Free. |
| `tools/promo/shots.mjs` | Plays the real game on the dev server (GPU on) and photographs moments at 1920×1080 into `art-src/promo-shots/`; the good ones are copied to `screenshots/`. |
| `tools/promo/contact-sheet.mjs` | Builds `contact-sheet.jpg`. |

## The taglines

Written in the game's voice (procurement-speak, 1950s newsreel, B-movie barker):

1. **EVERY LIMB A TOWER. EVERY STREET A MEAL.** Used on the Steam main capsule, the itch.io cover and the social banner.
2. **THIS TIME, YOU ARE THE INFESTATION.** Used on the vertical capsule, the square social post and the titled key art.
3. **IT CAME FROM ORBIT. ON PURPOSE.** Used on the B-movie poster.
4. **THE EMPIRE'S NEWEST PEST-CONTROL ASSET.** Used on the procurement notice.
5. **WASTE NOTHING. NOT EVEN THE ENEMY.** Used on the procurement notice's foot.
6. **YOUR SHIP'S AI HAS NOTES.** Used on the YOKE poster.

## key-art/ (no title unless the name says so)

| File | Size | For |
|---|---|---|
| `broodfall-keyart-meteor-2048x1152.jpg` | 2048×1152 | The living meteor falling on the insect town at night (the title screen's picture, repainted wide). Press kit, trailer end card, store background. |
| `broodfall-keyart-siege-2048x1152.jpg` | 2048×1152 | The creep has swallowed half a street of the insects' paper-and-honeycomb city; grown limbs on the roofs (acid spitter, lightning frond, bombard, eye stalk) fire into a column of Orthodox-armoured insect soldiers and a beetle tank. |
| `broodfall-keyart-orbit-yoke-2048x1152.jpg` | 2048×1152 | The campaign: the ring ship in orbit over the infested planet, YOKE's hologram looking down at it. |
| `broodfall-keyart-crater-2048x1152.jpg` | 2048×1152 | The board as a painting: the split meteor pod in its crater, creep roots up the honeycomb blocks, limbs on the roofs firing on squads in the streets. |
| `broodfall-keyart-panorama-3072x1024.jpg` | 3072×1024 | A 3:1 panorama of the meteor over the town (the source of the library hero and banner). |
| `broodfall-keyart-meteor-titled-1920x1080.jpg` | 1920×1080 | The meteor key art with the logo and tagline 2: a desktop wallpaper, a press image, a video thumbnail. |

## covers/

| File | Size | For |
|---|---|---|
| `steam-header-capsule-920x430.jpg` | 920×430 | Steam header capsule (top of the store page). |
| `steam-small-capsule-462x174.jpg` | 462×174 | Steam small capsule (lists, search). The logo fills it so it reads at this size. |
| `steam-main-capsule-1232x706.jpg` | 1232×706 | Steam main capsule (front page features), with tagline 1. |
| `steam-vertical-capsule-600x900.jpg` | 600×900 | Steam vertical library capsule, with tagline 2 (a tall repaint of the meteor scene). |
| `steam-library-hero-3840x1240.jpg` | 3840×1240 | Steam library hero: no title (Steam lays the library logo over it). |
| `steam-library-logo-1280x720.png` | 1280×720 | Steam library logo: transparent PNG of the emblem and word. |
| `itch-cover-630x500.jpg` | 630×500 | itch.io cover, with tagline 1. |
| `social-square-1080x1080.jpg` | 1080×1080 | Square social post (Instagram, Bluesky, Discord), with tagline 2. |

## posters/

| File | Size | For |
|---|---|---|
| `bmovie-poster-1200x1800.jpg` | 1200×1800 (2:3) | A mock 1950s B-movie poster: the growth rising over the town, townsfolk fleeing. "THE EMPIRE PRESENTS", tagline 3, "SEE A WHOLE TOWN SWALLOWED! SEE GUNS GROW FROM ROOFTOPS! SEE THE EMPIRE FILE THE PAPERWORK!", "IN SPORE-O-VISION · NOT SUITABLE FOR INSECTS". |
| `procurement-notice-1200x1800.jpg` | 1200×1800 (2:3) | The in-world poster: an Imperial Procurement Office public notice, screen-printed in black, cream and red; a technician in black releases the seed from the ship's bay. Taglines 4 and 5, the Technopuritan gear drawn as a plain vector gear. |
| `yoke-character-1200x1800.jpg` | 1200×1800 (2:3) | YOKE, the ship's AI, in her approved look (silver hair, gear clip, amber eyes, black high collar), one finger raised, the infested planet at her shoulder. Tagline 6, "She runs the ship. She reads your reports. She is not impressed." |
| `social-banner-1500x500.jpg` | 1500×500 | Social header banner (X / Bluesky / Twitch), with tagline 1. |

## screenshots/

Real frames of the game (dev server, GPU on, the scripted player at play, wave 7 to 10), 1920×1080.
The board is normally drawn at 1360×1000 and letterboxed; for these its drawing surface was resized
at run time to fill a 16:9 window (no game code changed). The scripted player's "demo mode" line is
hidden. Candidates (about 40) are in `art-src/promo-shots/`.

| File | Size | What it shows |
|---|---|---|
| `01-siege-megacity-limbs-firing.jpg` | 1920×1080 | A siege in the Megacity: bombard bulbs, maws, a galvanic frond arcing, insect soldiers in the channels. |
| `02-royal-boss-among-the-maws.jpg` | 1920×1080 | The insect royal (a boss) wading into a field of maws on the creep. |
| `03-siege-temple-city-lightning.jpg` | 1920×1080 | The Temple Cities: the body's limbs holding a street, frond lightning and shots. |
| `04-creep-spreading-farmland.jpg` | 1920×1080 | The Granary Belt: the creep running over farmland toward the unclaimed fields. |
| `05-the-body-late-run.jpg` | 1920×1080 | Wave 10 in the Deep Hive: the whole body grown across its districts. |
| `06-district-draft.jpg` | 1920×1080 | The district draft: three plates to consume next. |
| `07-ship-yoke-ai-core.jpg` | 1920×1080 | The ship: the AI Core, the hero from behind, YOKE's hologram. |
| `08-ship-gene-bay.jpg` | 1920×1080 | The ship: the Gene Bay, a specimen in its tank, the lineages to requisition. |

## contact-sheet.jpg

Every picture above on one sheet with its name and size.

## What was drawn and not used

- `art-src/promo/yoke.png` (v1 of the YOKE piece): the globe beside her was EARTH (Africa was plain
  on it) and she was small in the frame. The planet is the insects' own world; redrawn as `yoke-v2`.
- In-game screenshots taken with the scripted player on a fat wallet (100+ limbs): the whole board a
  carpet of limbs with nothing readable. Retaken with the scripted player's own economy.

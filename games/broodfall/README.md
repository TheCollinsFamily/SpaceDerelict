# Broodfall (working title)

You are the escaped bioweapon. Grow across an insect civilization's city, pay for limbs in caste meat, feed your own towers into new builds, and complete command's directive before the locals put you down. Design: `DESIGN.md`. Build spec: `TECH.md`.

## Run it

Double-click **`Play Broodfall.bat`** in this folder (installs dependencies on first run, starts the server, opens the browser). Or from a terminal:

```powershell
cd C:\Users\Merry\dev\space-derelict\games\broodfall
npm start            # opens http://localhost:5199 in your browser
```

Useful URLs:

- `http://localhost:5199/` — play (random seed)
- `http://localhost:5199/?seed=42` — fixed seed
- `http://localhost:5199/?directive=royal` — force a directive (hold / royal / harvest)
- `http://localhost:5199/?auto=1&speed=8&seed=42` — demo mode: the autoplayer pilots the asset

## Surface inventory (per PLAYTEST_PROTOCOL.md — kept honest)

| Surface | Status |
|---|---|
| Opening cinematic (first launch only; 8 generated shots, titles in type, skippable, replayable from the menu) | BUILT (Sep 30; `node tools/shot-onboarding.mjs`, `src/ui/intro.ts`) |
| Mission 1 (first launch: straight into a plain tower-defence game at the crash site, the coach's hint line) | BUILT (Sep 30; `shot-onboarding.mjs A`) |
| Main menu: the ship's console over the viewport's looping video (continue, new campaign, skirmish, replay the opening, settings) | BUILT (Sep 30; `src/ui/menu.ts`, `shot-onboarding.mjs A`, `shot-screens.mjs title`) |
| Home menu / title screen (the emblem, the name set in type from `src/ui/screens.ts` GAME_NAME) | BUILT (Sep 30; `node tools/shot-screens.mjs title`) |
| The dark Directive Desk (AWAITING CLEARANCE, the ship's own pick) until the first win after mission 1 | BUILT (Sep 30; `shot-onboarding.mjs A B`) |
| YOKE's greeting on every return (prewritten, her clips + voice) and her intercom from any room | BUILT (Sep 30; `content/greetings.ts`, `shot-onboarding.mjs`) |
| The boss's message (first landing), the quarters' data pad (partner file, inbox), the print-a-body scene | BUILT (Sep 30; `content/boss.ts`, `content/partner.ts`, `content/yokeScenes.ts`); the print-a-body clips and the quarters/partner pictures are MISSING (storyboard cards and the Procreation Board's room picture stand in) |
| Loading screen (deploy clicked, or a run started from the address, before the art is in) | BUILT (Sep 30; `shot-screens.mjs loading`, throttled network) |
| Fault screens: art list missing (play on without pictures), some pictures missing (a line over the board), no WebGL (drawn on a plain canvas, a line says so), nothing to draw with, the code failing while it loads | BUILT (Sep 30; `shot-screens.mjs faults`, each failure forced) |
| Deployment (board, waves, drafts) | BUILT |
| District draft overlay (each plate drawn as the board will draw it, and a map of where it goes) | BUILT (Sep 30; `shot-screens.mjs draft`) |
| Debrief screen, skirmish and campaign (the outcome's newsreel still, a photograph of the board at the end, the limbs grown, what the colony sent) | BUILT (Sep 30; `shot-screens.mjs debrief campaign`) |
| Gene Bay organ cards with each organ's scan picture | BUILT (Sep 30; `shot-screens.mjs genes`) |
| Ship gene bay (standing + splices, localStorage) | BUILT (prototype persistence; account-side later) |
| Empire Directives: Command's standing orders (three open, progress across deployments, standing, issued equipment and a trial lineage), every landing site's directive on file, the Office's notices | BUILT (Sep 30; ship room after the desk clears; `src/ui/directives.ts`, `node tools/shot-camp.mjs A`) |
| Hobby missions: the Notebook (8 pages sparked by play, one pinned per deployment, its checklist on the board, unique genes spliced two at a time) | BUILT (Sep 30; ship room after the desk clears; `src/ui/hobby.ts`, DESIGN.md "Hobby missions", `shot-camp.mjs A`) |
| Territory pictures over the globe briefing (16, one per landing site, in its tile set's look) | BUILT (Sep 30; `node tools/art/make.mjs ship territories`; `shot-camp.mjs A`) |
| Settings (menu, ship ⚙, in a deployment Esc or ⚙ pauses it): sound levels, YOKE's voice, HUD style, text size, reduce motion/flashes, colour-blind-safe caste colours, turn keys, edge scroll, zoom speed, starting speed, replay the opening, reset; a slot for YOKE's account and model | BUILT (Sep 30; `src/ui/settings.ts`, `shot-camp.mjs B`); music and effects sliders wait for sound |
| Break cinematics / propaganda video layer | MISSING (design doc) |
| The painted isometric board (26 units, 36 limbs, 8 tile sets, the ship) | BUILT (Sep 29; `HANDOFF.md` "The art") |
| Turning the view (Q, E, two buttons on the board) | BUILT (Sep 29) |
| BIG limbs: Broodmother, Ward Membrane, Trap Cage stand on 2 by 2 cells | BUILT (Sep 29; `DESIGN.md` "BIG limbs") |
| Attack clips for 25 of 26 units, death clips, state sprites | MISSING (code-drawn stand-ins) |

## How to play

- **The view:** Q and E turn the board a quarter turn (so do the two buttons at its top
  left); the wheel zooms on the pointer; Shift-drag, the middle button or the arrow keys
  move it; Home frames the whole body again. `?view=top` is the old board drawn as shapes.
- **BIG limbs** (Broodmother, Ward Membrane, Trap Cage) need 2 by 2 cells of one flat roof
  that the creep holds. Point anywhere on such a roof: the preview lights the four cells.

- The map starts as ONE district and grows: every 3rd cleared wave you draft one of three districts to consume. New districts bring new winding streets, high blocks, and new gates. The camera zooms out as the body spreads.
- Enemies march the carved street channels in squads; they cannot cross city blocks. Click a card, then click a CREEPED CITY BLOCK overlooking a street (taller blocks shoot further). Spine walls instead plug the street itself and must be chewed through. Right-click cancels. The ✕ on a card discards it for 3 war meat.
- Watch the top bar during growth: ASSAULT FORMING names the gates, and the gates glow on the map. Reinforce that approach, or CALL THE WAVE early for bonus meat.
- After a run: debrief, then the ship's gene bay — spend the trip splicing one of three genes into the next organism. Standing accrues toward the procreation license.
- CANNIBALIZE (no mode, no toggle): with a card selected, hover any of your towers — it highlights with a salvage preview — and click it. The limb is eaten on the spot: part of its cost comes back as meat immediately, and its whole trait history banks into your next build (eat two limbs, the build inherits both). The donor's family becomes a visible trait pip on the new limb. Pips stack deterministically: spitter pips add fire rate, lasher damage, burster blast radius, maw meat yield, spine hit points, lure interest, tangler slow, blighter poison, impaler armor-piercing, choir range.
- Organs (bottom-left) grow inside the body mass only. The pheromone gland cycles calm / lure / challenge when clicked. The TENDRIL ROOT grows a creep lobe toward its arrow — click it to re-aim (N→E→S→W).
- The SPORE SLING (card) is creep logistics: build it, click it to arm (a range ring appears), then click any claimed ground — a clot arcs out and seeds a growing creep patch you can build on long before the body reaches it. 20s recharge. Its pip makes any limb seep creep around its own block. The BILE LOBBER uses the same click-to-arm interaction but throws a detonating volley instead.
- Full roster (17 limb families): spitter, burster, lasher, maw, spine wall, lure gland, snare bed (slow), blight vent (poison), impaler (pierce), choir node (rate aura), spore sling, broodmother (fields broodlings that block and fight), digestive pit (a passable mouth IN the street), galvanic frond (chain arcs), bile lobber, caustic mister (armor shred for everyone), ocular stalk (board-wide support-killer). Every family's verb is also its cannibalize pip — DESIGN.md carries the combination algebra.
- War caste attacks because you exist. Science caste comes when you are interesting, and it is SMART: researchers read your gun coverage, walk around it, and go for your least-defended limb — sedate it and carry it off (kill the courier and the limb re-roots). Past a fame threshold their parties include THIEVES who steal banked war meat the same way. Royals move only when you are a crisis: super-strong warriors whose presence makes nearby war bodies hit harder and take less, while the CONSORT promotes them a rank at a time. Royal meat converts to raw mass (ROYAL SURGE).
- CLICK ANY LIMB (nothing armed) for its panel: hp, stats, traits, and targeting — Auto / First / Strongest / Weakest / Focus plus a caste priority (e.g. set periphery guns to SCIENCE to stop limb theft). Right-click closes it.
- The ARC PRISM ramps its beam on a held target, and idle prisms relay their charge through each other to whichever prism is firing — build them as a network.
- The SPORE BOMBARD shells a spot YOU choose: click it, click the map to set its marker (gold crosshair). Put it on an emplaced enemy cannon — nothing else outranges them as well. The WARD MEMBRANE shields every other limb near it (blue bubble); shields soak all harm first, including the sedation that science uses to steal limbs. Sacrifice a ward for a permanent shield on the new limb; sacrifice a bombard to double the new limb's range.
- EVERY CARD says what it can shoot: AIR + GROUND, GROUND, AIR ONLY, or SUPPORT. On the board a sky-blue chevron under a limb = it reaches fliers. The NETCASTER hits only fliers and drags them to the ground where ground limbs can finish them.
- CLOAKED enemies (faint shimmer outlines) can only be targeted by limbs with detection (violet dot): the Ocular Stalk reveals everything within 180px for all your limbs; Lure clouds, Caustic mist and FIRE mark them. Five cloaked kinds: Stalker, Shadewing (a cloaked flier), Ghost Sapper (a cloaked climber), Infiltrator (a cloaked researcher), and the royal Veil Matron, who cloaks every war body near her — kill her first.
- COMBO ENGINES are what science meat is for: the Marrow Conduit (funnel everything nearby into one limb), the Resonance Amplifier (its target's bonus counts ×1.5, rounded down — stack a type to 2+ first), and the Mosaic Node (one of every bonus type nearby). They chain: conduit and mosaic feed a carry, the amplifier multiplies the lot. The Twinning Gland doubles its target's projectiles; the Marrow Tap freezes its target but can be sacrificed over and over (it never disappears) to bank copies of the target's bonuses. The Mitosis Node buds a plain copy of the limb next to it each cleared wave (until the free spaces fill); the Capacitor Sac banks idle shots and fires them at 400% speed; the Boomerang Node (placed anywhere down a projectile limb's lane) calls its shots back through the hive; the Meat Press turns war kills into science; the Reliquary, which comes as a free pair, banks a limb's bonuses if it dies. `node tools/shot-engines.mjs` builds all five in the real page and checks them. THE CAMPAIGN (menu → CAMPAIGN): the ship's rooms, a globe of 16 territories, Requisition Board goals (standing) and dares/experiments (field notes), three factions with their own routes and endings, the ship AI's discussions (`node tools/shot-campaign.mjs`). QUICK DEPLOYMENT is the old skirmish with everything unlocked. THE ORGAN STAGE (after every wave, or the ORGANS button before the wave starts): shaped organs grow around the half-buried meteor; theme organs unlock and level limb groups, touching themes share verbs, heart/brain/gland zones boost what they touch, roots carry adjacency; unspent war/science is lost when the next wave starts (`node tools/shot-under.mjs`). CREEP NODES (the green bottom-bar tray, free; limbs come as a separate 4-card hand): Spore Bladders grow one every 2 turns (every turn with a Pacemaker), the creep organs touching a bladder set their strain (faster, doubled, bigger, thrown, mire, burning); click a chip then the map to place one; click a mature node to spread its child; trampled or shelled nodes die and take their creep with them (`node tools/shot-creep.mjs`). The Creep Lance lays a strip of creep along its facing. EVOLVE (limb panel): every limb and engine has three stages, choose A or B at each; stages 1-2 cost science, stage 3 science + one royal point; the path shows as a crest on the limb (`node tools/shot-evolve.mjs` clicks through it). The conduit passes at most 2 copies of each bonus.
- The MARROW CONDUIT copies every bonus from the limbs around it and feeds them all to the one limb it points at — then sacrifice the conduit to HARVEST that whole pool into your next build. Placing it (or the Skipping Mortar) shows its field of fire; RIGHT-CLICK rotates while placing or once built; Esc cancels. Open its panel to see exactly what it is funnelling where.
- The EMBER SAC sprays a flame cone. Fire spreads body to body through a crowd and lights up anything cloaked.
- Hovering a limb to cannibalize it now tells you exactly what its bonus gives the new limb — and warns if other limbs stand on its creep and would wither.
- Both castes field CANNONS: they walk up, brace, and lob shells over the blocks until killed. The science one (pale) darts your weakest limb to stun it for the researchers, then goes home when its kit is spent.
- The top bar telegraphs each wave's RISK — every enemy kind carries a risk weight, and waves scale by the risk law: cheap ranks multiply with the clock, risky specialists (sappers, mortars, drummers) stay punctuation. Watch for: splitters (burst into skitterlings unless eaten whole), mortar beetles (besiege from standoff — long guns answer), carapace lords (block the first 6 hits — big blows strip the shell).
- Win: complete the DIRECTIVE in the top bar — hold for N waves, destroy the royal, or bank the science quota. Each run rolls one (force it with `?directive=hold|royal|harvest`). Lose: asset integrity hits zero. The core fights back on its own.

## Verify it

```powershell
npm test             # 250 headless tests: the sim, the campaign, the camera, the baked art, big limbs, full autoplayer runs
# The whole list of browser beats, and what each proves, is in HANDOFF.md ("How to verify").
# tools/shot-preview.mjs is older than the organ stage and does not run: it is not in that list.
npm run build
npm run test:visual  # headless chromium: sim + HUD + per-region pixel checks; screenshots in tools/screenshots/
npm run test:input   # headless chromium: real player gestures (build, cannibalize, organ, cancel)
node tools/shot-screens.mjs  # the DEV server: title, loading (throttled), draft previews, debriefs, Gene Bay, every fault forced (notes/screens/2026-09-30/screens-*)
```

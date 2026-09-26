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
| Home menu | BUILT |
| Deployment (board, waves, drafts) | BUILT |
| District draft overlay | BUILT |
| Debrief screen | BUILT |
| Ship gene bay (standing + splices, localStorage) | BUILT (prototype persistence; account-side later) |
| Empire directives / hobby missions | MISSING (design doc) |
| Break cinematics / propaganda video layer | MISSING (design doc) |
| Real AI art pipeline | MISSING (TECH.md phase) |

## How to play

- The map starts as ONE district and grows: every 3rd cleared wave you draft one of three districts to consume. New districts bring new winding streets, high blocks, and new gates. The camera zooms out as the body spreads.
- Enemies march the carved street channels in squads; they cannot cross city blocks. Click a card, then click a CREEPED CITY BLOCK overlooking a street (taller blocks shoot further). Spine walls instead plug the street itself and must be chewed through. Right-click cancels. The ✕ on a card discards it for 3 war meat.
- Watch the top bar during growth: ASSAULT FORMING names the gates, and the gates glow on the map. Reinforce that approach, or CALL THE WAVE early for bonus meat.
- After a run: debrief, then the ship's gene bay — spend the trip splicing one of three genes into the next organism. Standing accrues toward the procreation license.
- CANNIBALIZE (no mode, no toggle): with a card selected, hover any of your towers — it highlights with a salvage preview — and click it. The limb is eaten on the spot: part of its cost comes back as meat immediately, and its whole trait history banks into your next build (eat two limbs, the build inherits both). The donor's family becomes a visible trait pip on the new limb. Pips stack deterministically: spitter pips add fire rate, lasher damage, burster blast radius, maw meat yield, spine hit points, lure interest, tangler slow, blighter poison, impaler armor-piercing, choir range.
- Organs (bottom-left) grow inside the body mass only. The pheromone gland cycles calm / lure / challenge when clicked. The TENDRIL ROOT grows a creep lobe toward its arrow — click it to re-aim (N→E→S→W).
- The SPORE SLING (card) is creep logistics: build it, click it to arm (a range ring appears), then click any claimed ground — a clot arcs out and seeds a growing creep patch you can build on long before the body reaches it. 20s recharge. Its pip makes any limb seep creep around its own block. The BILE LOBBER uses the same click-to-arm interaction but throws a detonating volley instead.
- Full roster (17 limb families): spitter, burster, lasher, maw, spine wall, lure gland, snare bed (slow), blight vent (poison), impaler (pierce), choir node (rate aura), spore sling, broodmother (fields broodlings that block and fight), digestive pit (a passable mouth IN the street), galvanic frond (chain arcs), bile lobber, caustic mister (armor shred for everyone), ocular stalk (board-wide support-killer). Every family's verb is also its cannibalize pip — DESIGN.md carries the combination algebra.
- War caste attacks because you exist. Science caste comes to study you when you are interesting, and is edible — but past a fame threshold their parties include SPECIMEN THIEVES who steal banked war meat and run (kill the courier to get it back). Royals move only when you are a crisis, arrive with a CONSORT that breeds militia while it lives, and royal meat converts to raw mass (ROYAL SURGE).
- The top bar telegraphs each wave's RISK — every enemy kind carries a risk weight, and waves scale by the risk law: cheap ranks multiply with the clock, risky specialists (sappers, mortars, drummers) stay punctuation. Watch for: splitters (burst into skitterlings unless eaten whole), mortar beetles (besiege from standoff — long guns answer), carapace lords (block the first 6 hits — big blows strip the shell).
- Win: complete the DIRECTIVE in the top bar — hold for N waves, destroy the royal, or bank the science quota. Each run rolls one (force it with `?directive=hold|royal|harvest`). Lose: asset integrity hits zero. The core fights back on its own.

## Verify it

```powershell
npm test             # 61 headless sim tests incl. per-verb behavior pins + full autoplayer runs
npm run build
npm run test:visual  # headless chromium: sim + HUD + per-region pixel checks; screenshots in tools/screenshots/
npm run test:input   # headless chromium: real player gestures (build, cannibalize, organ, cancel)
```

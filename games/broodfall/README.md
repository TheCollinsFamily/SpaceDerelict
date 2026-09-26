# Broodfall (working title)

You are the escaped bioweapon. Grow across an insect civilization's city, pay for limbs in caste meat, feed your own towers into new builds, and reach sporulation mass before the locals put you down. Design: `DESIGN.md`. Build spec: `TECH.md`.

## Run it

```powershell
cd C:\Users\Merry\dev\space-derelict\games\broodfall
npm install
npm run dev          # http://localhost:5199
```

Useful URLs:

- `http://localhost:5199/` — play (random seed)
- `http://localhost:5199/?seed=42` — fixed seed
- `http://localhost:5199/?auto=1&speed=8&seed=42` — demo mode: the autoplayer pilots the asset

## How to play

- Click a card, then click the creep to grow that limb. Right-click cancels.
- FEED A LIMB with a card selected: click one of your towers (the donor), then place. The donor is consumed and its family becomes a visible trait pip on the new limb. Pips stack deterministically: spitter pips add fire rate, lasher damage, burster blast radius, maw meat yield, spine hit points, lure interest.
- Organs (bottom-left) grow inside the body mass only. The pheromone gland cycles calm / lure / challenge when clicked.
- War caste attacks because you exist. Science caste comes to study you when you are interesting, and is edible. Royals move only when you are a crisis, and royal meat converts to raw mass (ROYAL SURGE).
- Win: MASS TO SPORULATION reaches 1000. Lose: asset integrity hits zero. The core fights back on its own.

## Verify it

```powershell
npm test             # 16 headless sim tests incl. full autoplayer runs
npm run build
npm run test:visual  # headless chromium: sim + HUD + per-region pixel checks; screenshots in tools/screenshots/
npm run test:input   # headless chromium: real player gestures (build, cannibalize, organ, cancel)
```

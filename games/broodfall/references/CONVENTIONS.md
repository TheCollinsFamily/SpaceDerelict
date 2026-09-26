# TD genre conventions — checklist (per PLAYTEST_PROTOCOL.md)

Reference wall: `reference-td-map.png` (Collins, Sep 26 2026 — the bar for map structure),
Tower Dominion / Nordhold (expansion drafting), Kingdom Rush (lanes and telegraphs).

Assessed against live play + `tools/screenshots/beat-*.png`. Every iteration re-runs this list.

| # | Convention | Status Sep 26 2026 | Evidence |
|---|---|---|---|
| 1 | Towers stand BESIDE the path, never in it (walls excepted) | YES (enforced: shooters Block-only; audited in placement runs) | beat-3, terrain audit test |
| 2 | Paths are carved channels through raised buildable ground | YES (sunken streets, raised blocks with faces/shadows) | beat-3 |
| 3 | Verticality: raised build spots, mechanically meaningful | YES (heights 1-3, +10% range per level, autoplayer prefers) | beat-5; sim statsOf |
| 4 | Paths wind; switchback pockets create prime real estate | YES (hand-authored plate patterns) | plates.ts, beat-5 |
| 5 | Lanes merge at architectural chokepoints | PARTIAL (confluence merging only when drafted plates route through shared approaches; start plate has 4 separate exits) | beat-5 |
| 6 | Map starts small and EXPANDS by player draft | YES (district draft every 3 waves, 3 offers, camera grows) | beat-4 |
| 7 | Waves are discrete: telegraph, assault, cleared-banner, reward | YES (ASSAULT FORMING + banners + wave bonus + call-early) | beat-3/5; rhythm test |
| 8 | Distinct build phase vs combat phase | YES (growth countdown / siege; researchers only in growth) | rhythm test |
| 9 | Placement measurably matters | YES (guardrail: outcome flips smart 2 : 1 random, smart 7/8 wins) | tests/placement.test.ts |
| 10 | Complete loop: menu → run → debrief → meta → next run | YES (menu, debrief, ship gene bay, standing persists) | beat-1, beat-6/7 (prior shoot) |
| 13 | Blocks are typed by openings; openings centered; opening-to-opening only; no blocked openings | YES (canPlace algebra + invariant test) | plates.test.ts |
| 14 | Run starts with a district beyond every entrance (guns before contact) | YES (pre-placed connector ring) | beat-2b-onegate-start |
| 15 | Entrance count is a chosen difficulty wager with a reward modifier | YES (insertion profile: 1-3 gates, +25% meat each) | menu/ship pickers |
| 11 | Block-vs-street read stays clear UNDER the creep at far zoom | WEAK — membrane helps but at 3+ districts the distinction blurs | beat-5 |
| 12 | The city looks alive before you eat it | PARTIAL (doorway lights; no wandering civilians yet) | beat-2 |

Known WEAK/PARTIAL items are the top of the next iteration's list.

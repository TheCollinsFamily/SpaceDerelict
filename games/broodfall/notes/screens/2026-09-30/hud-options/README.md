# The in-run HUD: the ship's console look (Sep 30 2026)

Collins picked it from the first drafts: "would go with a style that looks like one of the
consoles on the ship", then, on `ship-a.jpg`, "ya that hud looks great". It is now the
default HUD. The old khaki console stays reachable as `?hud=classic`, or in the main menu under
SETTINGS ("HUD STYLE"), which is remembered.

## The idea
The HUD is one of the ship's consoles, in the same family as the main menu and the ship's rooms:
matte black bezels, dark screen glass with faint scan lines, thin white lines, a white bar on the
left edge of a live panel, Bahnschrift in widely spaced capitals, and small indicator lights.
Colour appears only where it means something: the three castes, health, and danger.

## What changed, surface by surface
- **Top bar:** the purses are small screens with a lit caste dot and a caste-coloured edge,
  and big light numbers. The directive bar is thin and white. The phase has a light that blinks
  red in a siege. CALL THE WAVE is the one cyan control. The speed buttons form one segmented
  strip.
- **Hand:** each card is a small screen with the limb standing in its light. The name is on
  one line. The price shows a caste dot and number (`hud.ts` now puts each caste price in a
  span; the text is unchanged). The armed card gets the white edge bar.
- **Inspect panel:** menu glass with a white edge. Section labels are underlined by a hairline.
  Targeting and caste buttons light up in reverse when on.
- **Wave banner:** a band of glass across the board, the line set wide in light type, with
  the ship's kicker inside the band.
- **Feed:** log lines on glass, each with its caste's lit edge.
- **Hint, view controls, core health, district draft, end card, board goals:** the same glass
  and lines.
- **Organ stage:** the ship's ground scan (already dark) now sits in the same console. The
  title is set in the console type. TO THE SURFACE looks like a menu item.
- **Smaller windows:** at 1500, 1280 and 1050 px wide, words give way before numbers. In short
  windows, the limb panel scrolls and the view buttons move right. At 1280x720 and 1024x640
  the bars fit, and the beat checks this. The classic bottom bar overflows by 106 px at 1024.

## Strengths and weaknesses for play
- **Strengths:** a dark frame does not compete with the bright painted board, so the board
  reads as the brightest thing on screen. Numbers are bigger than before and use fixed-width
  digits. Caste is shown by colour and by a dot on every purse and price. The run feels like
  the ship and its menu. The bars are no taller than the classic ones.
- **Weaknesses:** light type in wide capitals reads more slowly than the classic bold type for
  long hint lines. Disabled buttons are dim (55%). The empire's goofy "broadcast" register
  (DESIGN.md, tone stack) is not in the HUD now; it survives only in the feed's wording.

## Files
- The style: `src/hud/themes/ship.css`, loaded by `src/hud/themes.ts` (the loader, from
  `index.html`).
- The pictures: `tools/shot-hud-options.mjs` (its own build `dist-hud/`, port 5247, GPU
  Chromium, seed 7).
- `current-*.jpg` = classic, `ship-*.jpg` = the new default, `compare.jpg` = both (a) side by
  side.
  - a: mid-siege, limb inspected, card armed
  - b: the wave banner
  - c: the organ stage
  - d: close-up of the purses and a card, at 2x
  - a-1280 / a-1024: smaller windows

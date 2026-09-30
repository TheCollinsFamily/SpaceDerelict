# Persona passes — Empire Directives, hobby missions, territory pictures, Settings (Sep 30 2026)

Played on the dev server through `node tools/shot-camp.mjs` (menu → mission 1 → ship → assigned
run → desk clears → the new rooms → a pinned page run and won → report → ship; settings from the
menu, the ship and a paused run). Screenshots: `notes/screens/2026-09-30/camp-*.jpg`.

## Newcomer
- The two new rooms appear only when the desk clears, with everything else the campaign opens then:
  nothing new is on screen during mission 1 or the dark-desk run (checked in the beat). PASS.
- The Notebook reads at once as "his own ideas": handwriting, doodles, a button that says "pin it to
  the next drop". The pinned page shows on the board in the same hand. PASS.
- Empire Directives is dense (orders, the file of directives, acknowledgements) but each order says
  what to do, how far along it is and what it pays. PASS, with one note: the room bar now wraps to a
  second line at 1600 px (Settings and YOKE go under). Acceptable; a later pass could shorten names.
- Settings: Esc with nothing in hand opens it and pauses, as in most games; the ⚙ says so. PASS.
- The territory picture made the briefing's forms scroll below the fold at 3:2; cut to a 16:7 strip.

## Genre veteran
- Standing orders are the "achievement contracts / boss blind" layer of the genre (Balatro's blinds,
  Kingdom Rush's challenge stars): cross-run goals that reward leaving a comfort build. Two orders
  change the runs while open (a trap cage issued; a lineage on trial). PASS.
- Hobby pages are the "self-set challenge" layer; each pays one unique gene, two carried at once:
  a choice, not a stack. PASS.
- Settings has the genre's expected set (volume channels, key rebinding, edge scroll, zoom speed,
  default speed, text size, reduced motion/flashes, colour-blind option, reset with confirm). PASS.
  Music and effects sliders are stored and wait for sound (there is none yet).

## Breaker
- **Found and fixed:** a page with a directive override (Royal taste test) could be pinned to a
  hold-12 landing site to turn it into a royal fight. Pages no longer change a site's directive.
- Can a gene trivialise the run? Measured over ten seeds with the naive player, each gene alone
  (`tools/measure/hobbygenes.measure.ts`); results in HANDOFF/the report. No gene is on by default,
  and the guardrails (naive win rate, placement) run without genes.
- Farming standing: orders pay once each (13 in all, 47 standing), issued three at a time; the
  licence is 60. They speed the licence up, they do not replace the Requisition Board.
- Esc as "cancel" habit: Esc cancels whatever is in hand first; only an Esc with nothing to cancel
  opens the settings. Right-click on the limb panel itself now closes it too (it sits over the
  board's corner; `test:input` found it).

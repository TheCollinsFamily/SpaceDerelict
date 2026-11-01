# Broodfall: the Steam "Coming Soon" page (wishlistable), ready to paste

Everything Steamworks asks for to post a wishlistable page, in the order its store-page editor asks.
Valve's rules (checked Oct 1 2026 against partner.steamgames.com/doc/store/coming_soon and
/doc/store/assets): the page must pass Valve's review (ask for it at least 7 business days before
you want it live), then you press the green "Post as Coming Soon" button; it must be up at least
two weeks before release. Making the app itself needs the Steam Direct fee ($100 per game, paid back
after $1,000 of gross sales) and a Steamworks partner account with tax and bank details done.
No game build is needed for a Coming Soon page.

## What only Collins can do

1. Sign in at https://partner.steamgames.com (or join it at https://partner.steamgames.com/steamdirect),
   with the company's legal, tax and bank forms done. Identity checks can take a few days.
2. Pay the $100 Steam Direct fee for one app. Steam then gives Broodfall an App ID.
3. Answer the content survey (below: the answers I'd give, which are his to confirm).

Everything after that (filling the store page, uploading every image, asking for review) can be
driven by an agent in his signed-in browser.

## Basic info

- **Name:** Broodfall
- **Developer / publisher:** (the Steamworks partner name)
- **Release date:** "Coming soon" (Steam lets the date read "Coming soon" until one is set)
- **Price:** not needed for a Coming Soon page
- **Languages:** English: interface, full audio (YOKE's voice and the narrator), subtitles
- **Platforms:** Windows (the web build is wrapped for desktop later, TECH.md "Packaging")
- **Genres:** Strategy, Indie, Simulation
- **Tags (in order, the first ones count most):** Tower Defense, Roguelite, Strategy,
  Play as the Monster, Base Building, Deckbuilding, Isometric, Sci-fi, Dark Comedy,
  Story Rich, Lore-Rich, Singleplayer, Replay Value, Aliens, Insects, Gore

## Short description (Steam allows 300 characters; what is on the page, Collins's own words, 245)

> Genocide simulator. You are the Empire's newest pest-control asset: a living meteor dropped on an
> insect civilisation. Grow limbs into towers on their rooftops, eat their citizens for currency and
> report back to a ship's AI who is not impressed.

## About this game (long description, what is on the page since Nov 1 2026)

Collins rewrote the opening paragraph in his own voice (first person, "Try the demo and let me know") some time after
Oct 26; Valve failed the page on Oct 28-31 because that paragraph alone "doesn't fully explain what features and
content a customer can expect". Nov 1 2026: his paragraph kept word for word (two spellings fixed: Inscryption,
roguelite) and the feature sections below added under it, every claim checked against README.md / DESIGN.md /
content/campaign.ts (17 limb families and 36 limbs, two dozen enemy kinds, 17 landing sites, the three factions, the
four strains, 8 hobby pages, hold = 12 waves, a deployment 20 to 30 minutes: the autoplayer wins seeds 1-2 at 19.6 and
21.2 sim minutes, tests/fullrun.test.ts; 12 siege tracks + 6 organ-stage tracks in public/audio). Steam markup:
[h2], [b], [list] [*]. The editor only keeps text that was TYPED (its model syncs on key events): setting the
textarea by script and pressing Save silently keeps the old text, so set the text by script, type one character at
the end, then Save ("Changes saved" banner).

```
This is a genocide simulator I built inspired by Inscryption (for gameplay) and Red Alert 2 (for story telling and art). Its a tower defense roguelite that takes place in a far future where you are an exterminator working for a far future Christian extremist human empire. I really wanted to build a game that felt like those experiences I enjoyed in the 90s with RTSs but that draws from modern game design ideas from experiences like Ball X Pit, FTL, and Inscryption. All while doing it with an over the top story that makes you think. Did I pull it off? Try the demo and let me know.

[h2]WHAT YOU DO[/h2]
You are the Empire's pest control: a living meteor dropped on a city of intelligent insects. Your creep swallows the city blocks, the limbs you grow on the rooftops are your towers, and the locals march on your buried core down the streets between them. Each deployment is one run: grow, hold the streets, draft the next district to consume, grow organs under the city between waves, and finish Command's directive before the city puts you down. Between deployments you live aboard the ship that dropped you, where the story happens.

[h2]THE TOWER DEFENCE[/h2]
[list]
[*][b]17 limb families, 36 limbs.[/b] Acid spitters, lightning fronds that chain arcs through a crowd, spore bombards you aim by hand, maws that swallow soldiers whole, snare beds, blight vents, ember sacs that set a column on fire, broodmothers that field their own young, ward membranes that shield their neighbours, and spine walls that plug a street and must be chewed through. Every card says what it can hit: ground, air or both.
[*][b]Height matters.[/b] Towers perch on city blocks above the traffic, and a taller block shoots further. The land rolls in hills, so the high plateau that fits a big limb is the lucky find.
[*][b]Waves you can read.[/b] Two dozen enemy kinds: soldiers, sappers, tanks, cannons that besiege from standoff, fliers, splitters that burst into skitterlings, carapace lords that shrug off the first six hits, and cloaked stalkers only an eye stalk can see. Every wave's risk, and the gates it will come through, is telegraphed on the top bar before it forms. Call a wave early for bonus meat.
[*][b]Three castes, three currencies.[/b] The war caste attacks because you exist, and its meat pays for the body. The science caste comes when you are interesting: researchers read your gun coverage, walk around it, sedate your least-defended limb and carry it off (kill the courier and the limb re-roots). Royals move only when you are a crisis; they make every army around them worse, and their meat is raw mass.
[*][b]Cannibalize.[/b] Hover any of your limbs to see what eating it gives, then click to eat it: part of its cost comes back and its whole trait history banks into the next limb you grow, as stacking pips. Eat two, and the next limb inherits both.
[*][b]Evolve.[/b] Every limb has three stages, A or B at each, and the last costs a royal point. A stage bought grows the limb into a new look.
[*][b]Combo engines.[/b] Science meat buys conduits, amplifiers, mosaic nodes, twinning glands, capacitors and a mitosis node that buds copies: engines that funnel, multiply and copy bonuses between limbs. They chain.
[/list]

[h2]THE MAP YOU BUILD[/h2]
Every run starts as one district under smoke. Every third cleared wave you draft one of three hand-made districts to consume, each with its own winding streets, high ground and gates: research quarters, provision districts, temple heights. Wall yourself in, or burrow back out through a wall for a new gate. The camera zooms out as the body spreads. Spore bladders grow free creep nodes on a timer, and the organs touching a bladder set its strain: bigger, doubled, thrown forward, slowing, burning. A node that survives a wave can spread a child of its own.

[h2]THE ORGAN STAGE[/h2]
After every wave the game goes underground, to a cross-section around your half-buried meteor where you grow shaped organs against it like tiles. Theme organs unlock and level whole groups of limbs (the Bone Forge brings impalers and mortars, the Venom Sac blight and fire, the Nerve Cluster arcs and eyes, the Brood Womb broodmothers and lures), and two organs that touch share their signature verbs, so where you grow the Venom Sac decides whose shots poison. Hearts, brains and glands boost whatever they touch, and buried deposits pay out when you grow over them. Meat you have not spent is lost when the next wave starts.

[h2]THE SHIP, THE GLOBE, THE STORY[/h2]
Between deployments you live aboard the ship with YOKE, who runs it, reads your reports and is not impressed. You can talk to her, and she talks back. Take Command's directives across a globe of seventeen landing sites, from the Crash Site and the Granary Belt to the Temple Terraces, the Glass Spires and the Hive House itself. Three factions of the locals reach out with signals of their own (the Friendship Delegation, the Faithful of the Last Hour, the Institute for Long-Term Hive Flourishing), each with its own route and ending. Splice genes in the Gene Bay, pick a starting strain (Standard, Venom, Spore or Brood), keep a notebook of eight hobby missions, earn comics, intercept the Roach King's broadcasts, and climb toward the one thing you actually want from the Empire: a licence to have a family.

[h2]MODES, LENGTH AND SOUND[/h2]
[list]
[*][b]Campaign:[/b] the globe, the ship, the factions, the last mission. Each deployment rolls one directive: hold for twelve waves, destroy the royal, or bank the science quota.
[*][b]Quick Deployment:[/b] a skirmish with everything unlocked, on a random or chosen seed.
[*][b]Defence deployments:[/b] when the locals counter-attack a territory you hold, one siege the size of a late wave, with a grown core and banked meat, warned a turn ahead.
[*][b]Length:[/b] a deployment is a sitting of twenty to thirty minutes, the organ stage included. The campaign is many of them.
[*][b]Difficulty:[/b] open two or three gates at deploy for more meat and a harder siege.
[*][b]Soundtrack:[/b] original 1940s electro swing, twelve tracks for the siege and six for the organ stage, with a newsreel narrator calling the play.
[*][b]Options:[/b] colour-blind-safe caste colours, reduced motion and flashes, text size, subtitles on films. Keyboard and mouse.
[/list]

A 1950s newsreel of a game about the end of a world, told by the people filing the paperwork.
```

## Images (all in this folder, all checked against Steam's sizes)

Store (required):

| Steam slot | File |
|---|---|
| Header capsule 920×430 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-header-capsule-920x430.jpg` |
| Small capsule 462×174 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-small-capsule-462x174.jpg` |
| Main capsule 1232×706 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-main-capsule-1232x706.jpg` |
| Vertical capsule 748×896 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-vertical-capsule-748x896.jpg` |
| Page background 1438×810 (optional) | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-page-background-1438x810.jpg` |

Library (needed before release, fine to upload now):

| Steam slot | File |
|---|---|
| Library capsule 600×900 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-library-capsule-600x900.jpg` |
| Library header 920×430 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-header-capsule-920x430.jpg` |
| Library hero 3840×1240 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-library-hero-3840x1240.jpg` |
| Library logo 1280×720 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-library-logo-1280x720.png` |
| Community icon 184×184 | `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\covers\steam-community-icon-184x184.jpg` |

Steam's rule for every capsule: no text but the game's name. So the store capsules carry the logo
only; the taglined cuts are `press-main-capsule-taglined-1232x706.jpg` and
`press-vertical-taglined-600x900.jpg`, for press and social, never for Steam.

Screenshots (Steam needs at least 5 at 1920×1080, gameplay only, at least 4 suitable for all ages):
all eight in `C:\Users\Merry\dev\space-derelict\games\broodfall\promo\screenshots\`, in their numbered
order. They are real frames of the game.

Trailer: none yet. Not required for a Coming Soon page; it is the biggest single lift for wishlists
afterwards.

## Content survey (answers for Collins to confirm)

- Frequent violence or gore: **yes**. Insect soldiers are shot, dissolved and eaten; it is painted,
  not photographic, and the people are insects.
- Mature themes: **yes**. The pitch is a genocide, played as satire; sex is talked about (the
  procreation licence, one comic exchange about "recreational sex") and never shown.
- Nudity or sexual content: **no**.
- Adult only: **no**.
- AI-generated content disclosure (Steam requires it): **yes, pre-generated**. The art, the
  cinematics, the music and the voices were made with generative tools (the RFab image, video, music and voice APIs).
  **Live-generated: yes.** YOKE talks to the player through an AI model at play time, with
  guardrails.

## Status (Oct 1 2026)

- Steamworks partner account made on the Steam login `merrymilkman`, as an individual: legal name
  Malcolm Collins, "A Sole Proprietorship", Eagleville PA, payment email collinsmalcolm@gmail.com.
- Steam Direct fee paid **twice** (two $100 charges, Oct 1 2026, MasterCard ending 69): the second
  should be a spare app credit for the next game, or a refund via https://help.steampowered.com.
- Bank (Chase checking) and tax interview done. Identity check (KYC): ID + selfie uploaded to
  Valve's Dropbox request on Oct 1 2026; Valve quotes 10 to 15 business days (to about Oct 15–22).
- **Until that clears, Steamworks keeps the account in onboarding**: https://partner.steamgames.com/apps/
  redirects to the public landing page and no app can be created. Check
  https://partner.steamgames.com/newpartner/ ; when "Complete Account Creation" unlocks, create the
  app, fill this file's fields in, upload the images, and submit the store page for review.
- Checked Oct 9 2026: still "Identity Verification Pending" (last upload Oct 1), "Complete Account
  Creation" still locked. Valve asks not to contact support during the 10–15 business days.
- Oct 26 2026: Collins is signed in to Steamworks as partner **The Pragmatist Foundation**
  (PartnerID 304682, login `pragmatistfoundation`), not the `merrymilkman` individual account
  above. It has **no apps yet and 1 app credit** (https://partner.steamgames.com/apps/). Creating
  the app ("Create new app...", type Game, name Broodfall, not free) spends that credit and
  gives the App ID; the agent's click on "Create Now" was refused by the auto-mode classifier
  as an unrequested commit, so Collins has to click it or OK it. After that, everything in
  this file goes in via the browser.
- Oct 26 2026 (later): **App created: Broodfall, App ID 5509240** (store item 1406224), on The
  Pragmatist Foundation. Store page editor: https://partner.steamgames.com/admin/game/edit/1406224
  Done and saved: Basic Info (developer/publisher The Pragmatist Foundation, Windows, English
  interface + full audio + subtitles, single-player, genres Strategy (primary) + Indie + Simulation,
  support email Partners@pragmatistfoundation.com), 20 tags (Collins, in the wizard), both
  descriptions (this file's copy), all 5 store graphics, 8 screenshots (04, 06, 07, 08 marked all
  ages; 01-06 gameplay, 07-08 in-game menu), library capsule/header/hero/logo, and the content
  survey, PUBLISHED: General Mature + Frequent Violence/Gore (Violent, Gore), moderate crude language,
  adult humour with sexual connotations, unrealistic blood / cartoon violence / killing, mention of
  illegal drugs (the Empire's anti-mysticism lore line), sexual innuendo; AI: pre-generated art,
  films, music and voices + live YOKE text and voice via rfab.ai (Kimi K2.6), billed to a linked
  rfab.ai account. Generated ratings: Brazil 14. The moderation answer describes only what
  content/lore/yoke-brain.md actually says; an explicit content-rules block in YOKE's prompt
  (no real-world hate, no harm instructions) would make that answer stronger before review.
  Still open: release date "Coming soon", controller wizard (keyboard and mouse only: there is no
  gamepad code), library logo placement (all three open Steamworks pop-up windows an agent's
  browser tool cannot see), the trailer upload (43 MB, over the agent's 10 MB upload cap), then
  Publish tab -> request review.
- Oct 26 2026 (evening): **store page submitted to Valve review** (queue, 3-5 business days; reply
  comes by email and on https://help.steampowered.com). Since the entry above: release date set
  (intended Jun 29 2027, a placeholder after June 2027 Next Fest; customers see "Coming Soon"),
  controller support = mouse and keyboard only, logo placement done, Windows minimum requirements
  (Win 10 64-bit, dual-core 2.5 GHz, 8 GB, WebGL 2 GPU with 2 GB VRAM / GTX 960 class, DX11, 2 GB
  disk: estimates, the public folder is 787 MB before an Electron wrap), shortcut + app icon from
  `games/broodfall/broodfall.ico`. Store checklist: complete. Still to do: upload
  `promo/trailer/broodfall-trailer-90s.mp4` on the Trailers tab (43 MB, over the agent browser
  tool's 10 MB cap, so Collins drags it in); after approval, press "Post as Coming Soon".
  Note for agents: Steamworks' pencil/"Start Wizard" buttons open in-page dialogs; a coordinate
  click can miss them silently. Click by element ref.
- Nov 1 2026: **Valve FAILED the store page review** (seen on https://partner.steamgames.com/apps/landing/5509240, the
  Store Presence box; no email was looked for). Two failures: (1) the written description "doesn't fully explain what
  features and content a customer can expect" (story, progression, goals, challenges, mechanics, playtime, genre,
  soundtrack, modes); (2) the Generative AI survey "contains links to external sites" (https://rfab.ai/). **Both fixed
  the same day and the page marked ready for re-review** (the queue says 3-5 business days, feedback by email and on help.steampowered.com; "Submitted for review on Nov 1"): the content survey draft
  (Copy My Published Answers) reworded without the domain in any text field (store description: "Kimi K2.6, run through
  a third-party AI service"; model name: "Kimi K2.6 language model (via Reality Fabricator)"; moderation and
  monetisation answers likewise; the new required "content generated in your game" answer written: text and voice only,
  the brief, length cap, no media requests, fallback lines, Steam overlay reporting) and the ratings republished (still
  Brazil 14, Germany 16). The survey's own "Website URL of service" field still holds https://rfab.ai, because the form
  requires it for an external service. Tried to blank it the same day (Collins: "do this safer option"): with "connects
  to an external, third party AI service" answered Yes the field turns required (red asterisk, "Section Incomplete"), so
  the survey cannot be published without a URL there; the draft was discarded, Version 2 stays. The only way to remove it
  is to answer No, which would be untrue (YOKE calls the RFab API at play time and a player can be billed from a linked
  account), so it stays unless Valve names that field. That the field is mandatory is itself evidence the reviewer
  flagged the prose, not the field. The long description expanded
  (section "About this game" above). **Three demo trailers uploaded** (the 720p copies, through the drop zone: a file
  input created by script inside the entry's `.drag_and_drop`, the file put on it, then a DragEvent `drop` with its
  DataTransfer dispatched on the zone), each category Gameplay, visible, before the screenshots, not all-ages:
  "Broodfall Gameplay: The Fight", "Broodfall Gameplay: The Body", "Broodfall Gameplay: The Map" (new entries land at
  the top of the list). Not live and not shareable until Valve approves and "Post as Coming Soon" is pressed; the
  address will be https://store.steampowered.com/app/5509240 . A first form_input into the description editor landed
  in the hidden French field and was saved; cleared the same day (every other language empty).
- Oct 26 2026 (night): **two trailers on the Trailers tab**, both visible and shown before the
  screenshots, neither marked all-ages (combat): "Broodfall Gameplay" (category Gameplay, listed
  first, `promo/trailer/broodfall-trailer-gameplay-steam-upload-720p.mp4`, 55.9 s, pure gameplay)
  and "Broodfall Trailer" (General/Cinematic, `promo/trailer/broodfall-trailer-90s-steam-upload-720p.mp4`).
  The uploaded copies are 720p two-pass re-encodes under 10 MB because the agent browser tool caps
  uploads at 10 MB; to put the 1080p masters (`broodfall-trailer-gameplay.mp4`,
  `broodfall-trailer-90s.mp4`) up instead, drag them onto each trailer's "Replace" by hand.
  Steamworks trailer flow: "Create New Trailer" (name) -> drop the file on that entry's drop zone ->
  wait for "Converting..." to finish (a few minutes, server side) -> only then do category and the
  check boxes appear; set them and press that entry's own Save.

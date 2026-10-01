# The Roach King: the head of the Commonwealth (lore and voice bible)

**Canon (Collins, Oct 1 2026):** "the core enemy leader is a patriotic upstanding and over the top
character (modelled after a President Camacho style mixed with Asmongold) called the Roach King (you
can have the country's flag be the Texas flag with an insect head instead of a star) ... I would not
have him come in until a couple missions in though and would come from cut scenes." And: the operator
never meets anyone ("as far as I know you don't directly interact with anyone").

Everything else here is **PROPOSAL** (built Oct 1 2026), fitted to `content/lore/insects.md`. In the
game: `content/roachKing.ts` (his addresses), `src/meta/roachKing.ts` (when), `src/ui/roachKing.ts`
(how they play), `tools/media/roachking.ts` (how the pictures, clips and voice are made).

He is an ORIGINAL character. The two references are for energy only: a wrestler-showman head of state,
and a gremlin streamer who talks to his chat. No real person's name, face, likeness or catchphrase.

## Who he is (PROPOSAL)

- **Name:** President **Duke Crawley**, of House Crawley (Crawley & Daughters, a small beetle-freight
  House in the Commuter Ring). Everybody calls him **the Roach King**, his old ring name. Nobody has called
  him "Mr. President" to his face and been answered.
- **What he is:** a cockroach-morph royal **male**, a *spare* (insects.md 1.4): fertile, royal by birth,
  and of no use to anyone. Spares have nothing to do, so this one did everything. He wrestled in the
  Commonwealth Wrestling Federation ("the Roach King", four arms, a folding chair), then started
  broadcasting from his room (League of Larvae, hot takes, eating on camera), then ran for President as a
  bit and won by the widest margin since the Unification.
- **The first male President.** The office has always gone to a worker of a Great House (insects.md 4).
  The Houses backed him because a spare owes no House anything and can be bought by all of them; he did not
  notice. The Great Queen has not blessed him and he has not asked. By custom a royal male is a colonel
  (insects.md 1.3, the consort): he wears the colonel's gilded Orthodox dress coat over a tank top, and has
  promoted himself to Field Marshal twice.
- **Patriotic and upstanding, in his own eyes.** He loves the Commonwealth, the Host, the flag and every
  sister in it, loudly and sincerely. He is not cruel and not a coward; he is an idiot with a big heart,
  a bigger voice and a gold machine gun.
- **Where he lives:** the Hive House, the presidential palace in the capital (pale wax, paper onion domes,
  a gold ball on each). He runs the country from his gaming den in its east wing: a carved desk under
  takeout boxes, a wall of monitors of his chat, a ring light.
- **His chat:** about forty thousand antennae that follow his broadcast and argue with him. He reads them
  out loud. YOKE renders "chat" (content/translation.ts).
- **His look (the den still, `art-src-new/roach/stills/den.png`, baked into every clip):** a huge,
  barrel-chested cockroach-man, glossy chestnut-brown, a shiny shield over his head like a helmet brim,
  very long antennae, amber eyes, four thick arms; the dark green gold-braided dress coat, a sweat-stained
  white tank top, a gold championship belt, a black gaming headset, and the flag tied on as a cape.

## The flag (Collins; details PROPOSAL)

The Commonwealth's flag since the Unification, called **the Lone Head**: the Texas flag's layout (a deep
blue band at the hoist, white over red), with a white cockroach head, antennae up, where the lone star
would be. The insects.md rule against political symbols in pictures does not cover it: it is the one flag,
and it is everywhere he is. Baked: `public/media/roach/flag.webp` (flat), `flag-wave.webp` (on a pole).
(Why a roach for the nation, when he is a roach: he says it was always a roach. It was a generic beetle
head until his first week in office.)

## How the player meets him: never

The Host has the ship on radar and nothing that reaches it (insects.md 9.1). He does not know the operator
exists. He calls the Growth "the Crater Thing" and talks about it to his nation, on air, and the ship's
survey array picks up the Commonwealth's television band. YOKE renders it (the translation layer: the
intercept band, the TV-band signal under each line, her notes). So every scene of him is an **intercepted
broadcast**, played after a deployment's news, never a call, never a meeting.

## His arc (built; `src/meta/roachKing.ts`)

At most one address after a deployment, the first that is due, most urgent first.

1. **An Address to the Nation** (after the campaign's 3rd deployment). Why the third: mission 1 is the
   crash and the town's own film; mission 2 opens the Directive Desk and the three factions call; by the
   third the waves have reached the Host's regulars, which is when a head of state goes on the air. He
   introduces himself, calls the Growth a fungus according to chat, sends in "the big girls with the guns",
   and fires the gold gun into the ceiling. Every other address waits for this one.
2. **The President Calls Up the Home Levy** (3 territories held). On the Hive House steps, the flag behind
   him: every sister with four arms and a pulse to her branch-hive. "You are MID."
3. **Operation Take It Back** (the first counter-attack the colony telegraphs). He named it himself. It
   took four hours. Ties the pushback (the Host retaking a town) to him.
4. **On your ally** (allied, and two of its beats seen; once per faction, so a player who switches at the
   midpoint hears him on both):
   - **The Delegation:** he HATES them. Somebody cut a love letter to the Crater Thing into his wheat, a mile high (the Delegation's crop letter; the second comma is a barn).
     "Peace is losing, slower." "The wheat has a family."
   - **The Faithful:** he goes on The Hour Is Near, big fan of the show, did the reading, and is pretty sure
     he is the Awaited One. (The Voice nods. The operator is building a different Awaited One, out of spare meat.)
   - **The Institute:** the Director is his new adviser. Bad at League of Larvae. Sent an expected-value
     table; read upside down, it still said we win. The Director keeps asking about an upload.
5. **The Last Stand** (the ally's finale opens; or 8 territories held with no ally). From the back of a
   gilded war beetle at the front, the Host behind him: "The bunker is full of my merchandise." "Come and
   get some!" The finale's board is his last stand, seen from orbit.
6. **The Hive House Stream** (the campaign has ended). Late, the den, a red light under the door. "Hold
   on, chat. Something is at the door. Be right back." Then the empty chair, the chat still scrolling, his
   cape over the chair. Nobody comes back.

**PROPOSAL, for the reveal (not built):** absorbed with everyone else, he wakes in the archive in a world
cut to his desires: a stream with a billion viewers and every one of them agreeing. He is the only
absorbed citizen who has not lodged a complaint.

## Voice bible

- **Who speaks him:** the video model, on camera (Veo 3.1 Lite, image-to-video with sound), every clip
  asked for the same voice: "a booming, gravelly, over-the-top voice like a pro-wrestling announcer with a
  thick Texas drawl, loud, fast and full of swagger". Through YOKE, as every insect voice is: it is her
  rendering, lip-synced to his mandibles ("The lip sync is mine. You are welcome.").
- **How he talks:** short, loud, declarative sentences; a big build then a dumb landing ("I had heart. And
  a folding chair."). He repeats himself for emphasis. He talks to his chat as much as to the nation ("Chat
  is WRONG", "Chat, spam it"). He never swears on air (he is upstanding). He loves the sisters, the Host and
  the flag, and says so. Capitals in a line are stress.
- **Words he uses:** the Crater Thing, the big girls (the Host), sisters, chat, mid, the Lone Head, "This
  concludes the address!" (then the gun).
- **Words he never uses:** the Visitor (that is the Delegation's word), the asset, fauna (the Empire's),
  anything that shows he knows there is someone in orbit.
- **Each address ends** with the gun, a slogan, or him walking off; never with a question.

## Open for Collins

1. His name (Duke Crawley) and the "first male President, a royal spare" reading of the lore.
2. Whether he should show up in the board itself in the last stand (a unit or a boss on the finale board).
   Today he is cutscenes only, as asked.
3. The reveal line above (PROPOSAL, not built).

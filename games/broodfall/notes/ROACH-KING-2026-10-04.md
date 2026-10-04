# The Roach King scenes and the last mission (Collins, Oct 4 2026)

What he wrote, what was built from it, and what is his to decide. The design is in `DESIGN.md` "THE LAST MISSION, AND
THE ROACH KING OFF THE AIR"; where the code is, in `HANDOFF.md` "The last mission, and the Roach King off the air".

## 1. His text, verbatim

> OK while we are waiting on that I finaly through together the roach king scenes and a final mission idea /
>
> “Roach King the alliance of nations have lost another territory” hand to head “of course the have” other guy “evry
> time they make landfall they have been sending troops at them as soon as they can get there” the king “are you
> fucking kidding me ... so they just send and endless wave of troopes to an enemy that appears to grow more powerful
> the more it kills .... why don’t they just batch them or better yet send nothing and wait until you have enough
> troops to absolutely kill them” the other guy “well we might be able to get the science cast or royals to do that but
> the warrior caste have a long tradition of honor” hands to face in frustration “they have a long tradition of being
> retards is more like it ... they are going to get us all killed”
>
> This one is the roach king giving a speech from in front of a government looking building with lots of patriotism
> “We can’t be consumed by our petty differences anymore. We will be united in our common interests. Perhaps it’s fate
> that today is the founding day of the empire, and you will once again be fighting for our freedom — not from tyranny,
> oppression, or persecution, but from annihilation. We’re fighting for our right to live, to exist. And should we win
> the day, the founding day will no longer be known as an imperial holiday, but as the day when the world declared in
> one voice: “We will not go quietly into the night! We will not vanish without a fight! We’re going to live on! We’re
> going to survive!” Today we celebrate our Independence Day!
>
> Before the last message we see the roach king on a vid call with a member of the military cast clearly furius “the
> transports have been sabatagode this is the last fight we will never make it in time” He responds “You disapprove?
> Well, too bad! We’re in this war for the species. It’s simple numbers. They have more. And every day I have to make
> decisions that send hundreds of people like you to their deaths. If we could have just one confrontation without the
> war cast feeding them from the start I think we could win.” (This is before the final mission that you should also
> build ... it is unique in that it starts with a turn count down timer until the military arives until then its only
> science and royals ... you will have to start them with a shelter evry time on this map because otherwise there will
> be know way to get the basic meat the need to build any limbs)

## 2. The scenes as built

`content/roachKing.ts` `ROACH_SCENES`. His words; spelling and punctuation corrected; a sentence over 22 words is split
into two lines (a clip of the film is 8 seconds); his stage directions are in brackets, acted and not said. Nothing else
is changed.

| Scene | When it plays | Who speaks |
|---|---|---|
| **Another Territory** (`rk-briefing`) | after a deployment, once five territories are held (and he has given his first address) | his aide; the Roach King |
| **The Transports** (`rk-transports`) | when the last mission is launched, first | a general of the Host, on a video call; the Roach King |
| **Founding Day** (`rk-founding`) | when the last mission is launched, after the call: "the last message" | the Roach King, to the planet |

Each is caught by the ship's survey: the first two off a private line ("NOT FOR BROADCAST"), the last on every band at
once. YOKE renders them, as she renders everything they say; she has a note under "a long tradition of being retards"
and under "Today we celebrate our Independence Day!".

**How they are shown today:** as the intercept's transcript (the stamp, where it was caught, the title, her band, every
line with who says it, CONTINUE). Each has a film's shot list ready (`content/cutscenes.ts`: `rk-briefing` 9 shots,
`rk-transports` 4, `rk-founding` 9; one camera position each, one take, both speakers in the picture, so there is no
cut from one to the other), and plays as that film once it is baked. **No film of them is made**: the remade test film
is his to approve first, and each of these costs about $3 to $5 a clean take.

## 3. The last mission as built

The Hive House. It opens when the ally's finale has been played, and is the only landing left; winning it ends the
campaign. `content/campaign.ts` `LAST_MISSION = { turns: 5, hostWaves: 4, minTier: 6, ration: [45, 60, 80] }`.

- **The countdown.** Five turns. Each is a wave of the science caste (it steals limbs and walks the gaps in your fire)
  and the court (consorts and matrons; a royal on the fifth), and nothing of the war caste. It is on the HUD's order
  ("HOLD 9 WAVES · THE HOST IN 3 TURNS"), in every wave's banner and on the briefing.
- **The shelter.** One stands by the body from the first frame and is already the asset's. Protected through a turn, it
  gives 45 war meat at the clear (60, then 80, as it grows), with the clearing wage the only war meat there is until
  the Host comes. The war caste goes for it first when it arrives.
- **The Host.** From wave 6: the top row of the wave table, sized as a sixth wave. Hold four of them.
- **Measured:** the scripted player wins 6 of 10 with the ration and 4 of 10 without it.

## 4. His to decide

1. **The ration is my reading.** A shelter as it was built pays a SHARE of the meat banked in a wave; with no war body
   there is none to share, so "start them with a shelter" would not by itself give basic meat. On this map it also gives
   up the people inside it. Say if that is what was meant, and whether every shelter in the game should do it.
2. **His from the start, or to be taken?** It is his already (no Infestor needed: a player may not own the cyst). The
   other reading is an intact shelter and a free Infestor.
3. **The numbers:** five turns, then four waves; the Host at the top tier.
4. **The win is a hold.** The Roach King is not on the field. A boss body for him would need its own art.
5. **How his three scenes sit with his addresses.** The addresses built on Oct 1 make him a showman streaming from the
   Hive House, President of "the Commonwealth". These scenes speak of "the alliance of nations", "the founding day of
   the empire" and "an imperial holiday", and show a sharp, tired man. I read it as: in public the showman, in private
   this; the Commonwealth was founded as an empire of his House, and is one of the allied nations
   (`content/lore/roach-king.md` "Off the air"). The older addresses are left as they are. Say if any should go.
6. **Founding Day follows a famous film speech almost word for word.** Fine as a joke between friends; say if it should
   be reworded before the game is sold.
7. **A campaign with no ally** has no finale, so it never reaches the last mission.

"""Generate event illustration assets for Space Derelict via Reality Fabricator API.
Run once to create assets/events/ directory with themed event images.
"""
import requests
import os
import time
from pathlib import Path

API_KEY = "rfab_SHK-pdCAXXkptzMYVslPYP7jcPk2grwXfVupZkXsi28"
BASE_URL = "http://localhost:3000"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

OUTPUT_DIR = Path("assets/events")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Event prompts - dark sci-fi pixel art, must match game lore:
# - Setting: deep space, franken-ships, reality TV show about clones
# - Felonia: sexy cat-girl aliens (anime-inspired feline humanoids)
# - Confederacy: dog-like loyal naive humanoids, noble but gullible
# - Pop Fiz: uplifted psychotic dolphins/whales in bizarre ships
# - Raiders: scavenger pirates with cobbled-together junk spaceships
# - Techopuritan: cold religious tech zealots, angular sterile ships
# - All scenes in SPACE (not ocean, not land)
EVENT_PROMPTS = {
    "event_raider": "pixel art, deep space scene with stars, a ragtag group of 3 cobbled-together junk spaceships approaching, welded scrap metal hulls, mismatched engines glowing orange, pirate flags, one ship has cargo bay open showing trade goods, dark gritty sci-fi, 16-bit retro game style",
    "event_felonia": "pixel art, deep space scene, a sleek organic spaceship shaped like a crescent, on the viewscreen a beautiful cat-girl alien with feline ears and tail in revealing outfit is hailing you seductively, purple and magenta color scheme, anime-inspired, 16-bit retro game style",
    "event_confederacy": "pixel art, deep space scene, a formation of pristine white and blue military spaceships with golden emblems approaching diplomatically, noble flags on their hulls, clean orderly design contrasting with dark space, trusting naive vibes, 16-bit retro game style",
    "event_pop_fiz": "pixel art, deep space scene, a pod of bizarre whale-shaped spaceships covered in neon graffiti and blinking party lights, one has a dolphin-shaped cockpit window, chaotic energy trails in rainbow colors, unhinged and playful, 16-bit retro game style",
    "event_techopuritan": "pixel art, deep space scene, a single menacing angular spaceship made of polished steel and circuit-board patterns, cold white and blue lights, religious tech symbols glowing on the hull, sterile and threatening, 16-bit retro game style",
    "event_distress": "pixel art, deep space scene with stars and nebula, a heavily damaged spaceship drifting with hull breaches, flickering red emergency lights, small distress beacon pulsing, debris field around it, eerie and lonely, 16-bit retro game style",
    "event_artifact": "pixel art, deep space scene, a cluster of glowing alien crystal artifacts floating in a small nebula, unstable energy arcing between them, beautiful but dangerous, mysterious ancient technology, purple and cyan glow, 16-bit retro game style",
    "event_rival": "pixel art, deep space scene, two heavily modified frankenstein spaceships facing each other in a standoff, both cobbled from salvage with weapons powered up, competitive arena tension, dark red and blue lighting on each, 16-bit retro game style",
    "event_crew": "pixel art, interior of a dark grimy spaceship corridor with exposed pipes and wires, several identical clone crew members in jumpsuits arguing under flickering red warning lights, tense mutinous atmosphere, industrial sci-fi, 16-bit retro game style",
    "event_genocide": "pixel art, deep space scene, a massive war fleet of ships bearing down on a tiny last remaining vessel, apocalyptic red explosions, broadcast camera drones visible filming the destruction, grim spectacular, 16-bit retro game style",
    "event_base": "pixel art, interior of a dark cyberpunk space station broadcast studio, multiple holographic screens showing ratings numbers and viewer counts, camera drones floating, neon signs saying LIVE, reality TV production vibes, 16-bit retro game style",
    "event_merchant": "pixel art, deep space scene with stars, a convoy of 3 friendly round cargo spaceships with open trade bays and warm golden interior lights visible, containers of goods floating between ships, welcoming and naive, 16-bit retro game style",
}


def generate_image(name: str, prompt: str) -> str | None:
    """Generate an image and save it to OUTPUT_DIR. Returns the saved path or None."""
    out_path = OUTPUT_DIR / f"{name}.png"
    if out_path.exists():
        print(f"  [SKIP] {name} already exists")
        return str(out_path)

    print(f"  [GEN] {name}...")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/image-generation/generate",
            headers=HEADERS,
            json={
                "prompt": prompt,
                "style": "pixel-art",
                "width": 768,
                "height": 432,
                "steps": 25,
                "guidanceScale": 7.5,
            },
            timeout=120,
        )
        data = resp.json()
        if not data.get("success"):
            print(f"  [ERR] {name}: {data.get('error', 'unknown error')}")
            return None

        image_url = data.get("imageUrl") or (data.get("images") or [None])[0]
        if not image_url:
            print(f"  [ERR] {name}: no image URL in response")
            return None

        # Download the image
        img_resp = requests.get(image_url, timeout=60)
        if img_resp.status_code == 200:
            out_path.write_bytes(img_resp.content)
            print(f"  [OK] {name} saved ({len(img_resp.content) // 1024}KB)")
            return str(out_path)
        else:
            print(f"  [ERR] {name}: download failed ({img_resp.status_code})")
            return None

    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return None


def main():
    print(f"Generating {len(EVENT_PROMPTS)} event illustrations...")
    print(f"Output: {OUTPUT_DIR.resolve()}\n")

    results = {}
    for name, prompt in EVENT_PROMPTS.items():
        path = generate_image(name, prompt)
        results[name] = path
        if path and not path.endswith("already exists"):
            time.sleep(1)  # Rate limit courtesy

    print(f"\n{'='*50}")
    print(f"Results: {sum(1 for v in results.values() if v)}/{len(results)} generated")
    for name, path in results.items():
        status = "OK" if path else "FAILED"
        print(f"  {status}: {name}")


if __name__ == "__main__":
    main()

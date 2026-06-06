"""Generate faction-specific combat backgrounds for each enemy type."""
import requests
import time
from pathlib import Path

API_KEY = "rfab_SHK-pdCAXXkptzMYVslPYP7jcPk2grwXfVupZkXsi28"
BASE_URL = "http://localhost:3000"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
OUTPUT_DIR = Path("assets/ui")

FACTION_BGS = {
    "combat_bg_raider": (
        "pixel art, deep space scene near an asteroid field, dark black void with scattered debris, "
        "wrecked ship hulls and junk floating, orange rust-colored asteroids, distant dim stars, "
        "gritty dangerous pirate territory atmosphere, very dark for UI readability, "
        "16-bit retro game style, wide panoramic"
    ),
    "combat_bg_felonia": (
        "pixel art, deep space near a lush green and purple planet, bioluminescent organic debris floating, "
        "magenta and violet nebula wisps, exotic alien spore clouds glowing softly, "
        "seductive and dangerous atmosphere, very dark overall for UI readability, "
        "16-bit retro game style, wide panoramic"
    ),
    "combat_bg_confederacy": (
        "pixel art, deep space near a pristine ice-blue planet, clean and orderly star field, "
        "distant white space stations with golden lights, faint blue aurora-like energy, "
        "noble and civilized territory atmosphere, very dark overall for UI readability, "
        "16-bit retro game style, wide panoramic"
    ),
    "combat_bg_pop_fiz": (
        "pixel art, chaotic deep space with rainbow-colored nebula gas clouds, "
        "neon pink green and orange energy trails everywhere, bizarre crystalline asteroids, "
        "everything looks unhinged and psychedelic but still dark space, "
        "party in the void atmosphere, dark for UI readability, 16-bit retro game style, wide panoramic"
    ),
    "combat_bg_techopuritan": (
        "pixel art, deep space near a massive angular space station made of cold steel, "
        "white and blue circuit-pattern lights on the station hull, perfectly ordered geometry, "
        "cold sterile threatening atmosphere, religious tech symbols faintly visible, "
        "very dark overall for UI readability, 16-bit retro game style, wide panoramic"
    ),
}


def generate(name, prompt):
    out = OUTPUT_DIR / f"{name}.png"
    if out.exists():
        print(f"  [SKIP] {name} exists")
        return True
    print(f"  [GEN] {name}...")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/image-generation/generate",
            headers=HEADERS,
            json={"prompt": prompt, "style": "pixel-art", "width": 1280, "height": 800, "steps": 25, "guidanceScale": 7.0},
            timeout=120,
        )
        data = resp.json()
        if not data.get("success"):
            print(f"  [ERR] {name}: {data.get('error')}")
            return False
        url = data.get("imageUrl") or (data.get("images") or [None])[0]
        if not url:
            print(f"  [ERR] {name}: no URL")
            return False
        img = requests.get(url, timeout=60)
        if img.status_code == 200:
            out.write_bytes(img.content)
            print(f"  [OK] {name} ({len(img.content)//1024}KB)")
            return True
        print(f"  [ERR] download {img.status_code}")
        return False
    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return False


print(f"Generating {len(FACTION_BGS)} faction combat backgrounds...")
for name, prompt in FACTION_BGS.items():
    generate(name, prompt)
    time.sleep(1)
print("Done!")

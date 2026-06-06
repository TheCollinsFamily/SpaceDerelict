"""Generate background images for Main Menu, Combat, Post-Combat, and Game Over screens."""
import requests
import time
from pathlib import Path

API_KEY = "rfab_SHK-pdCAXXkptzMYVslPYP7jcPk2grwXfVupZkXsi28"
BASE_URL = "http://localhost:3000"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
OUTPUT_DIR = Path("assets/ui")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Screen backgrounds - wide 16:10 ratio to match 1280x800 window
BACKGROUNDS = {
    "main_menu_bg": (
        "pixel art, dark sci-fi title screen, center frame shows a massive frankenstein spaceship "
        "made of salvaged alien parts and welded scrap hovering menacingly in deep space, "
        "the ship has mismatched components glowing different colors - red engines blue shields green weapons, "
        "below it are tiny fleeing ships, the void of space with distant nebula and stars behind, "
        "dramatic backlit silhouette composition, dark and moody, 16-bit retro game aesthetic, cinematic wide shot"
    ),
    "combat_bg": (
        "pixel art, deep space background for a combat scene, dark black void with scattered stars, "
        "a distant purple and blue nebula in the upper corner casting faint light, "
        "subtle orange debris particles floating, very dark overall for UI readability, "
        "minimalist space atmosphere, retro 16-bit game style, wide panoramic"
    ),
    "post_combat_bg": (
        "pixel art, interior of a dark spaceship salvage bay, mechanical arms and grappling hooks "
        "holding chunks of a destroyed alien ship, sparks from welding torches, dim orange work lights, "
        "exposed hull showing stars outside through gaps, industrial and grimy atmosphere, "
        "the sense of dissecting a defeated vessel for parts, 16-bit retro game aesthetic, wide shot"
    ),
    "game_over_bg": (
        "pixel art, dark sci-fi clone vat laboratory, a single large glass tank in the center "
        "with a humanoid silhouette floating in green-blue nutrient fluid, cables and tubes attached, "
        "monitors showing flatline then reboot sequence, dim eerie lighting from the tank, "
        "the sense of death and rebirth, lonely and atmospheric, 16-bit retro game aesthetic, wide shot"
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
            json={"prompt": prompt, "style": "pixel-art", "width": 1280, "height": 800, "steps": 28, "guidanceScale": 7.5},
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


print(f"Generating {len(BACKGROUNDS)} screen backgrounds...")
for name, prompt in BACKGROUNDS.items():
    generate(name, prompt)
    time.sleep(1)
print("Done!")

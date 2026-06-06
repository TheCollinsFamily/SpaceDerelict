"""Generate faction emblems and contract card illustrations."""
import requests
import time
from pathlib import Path

API_KEY = "rfab_SHK-pdCAXXkptzMYVslPYP7jcPk2grwXfVupZkXsi28"
BASE_URL = "http://localhost:3000"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# === FACTION EMBLEMS (48x48 pixel art icons) ===
EMBLEM_DIR = Path("assets/factions")
EMBLEM_DIR.mkdir(parents=True, exist_ok=True)

EMBLEMS = {
    "raider": (
        "pixel art icon, a skull with crossed jagged blades on dark background, "
        "pirate raider emblem, red and rust orange colors, menacing, simple bold design, "
        "game faction logo, 16-bit retro style, no text"
    ),
    "felonia": (
        "pixel art icon, a stylized cat face with fangs and a rose on dark background, "
        "seductive and dangerous, magenta and purple colors, feline faction emblem, "
        "game faction logo, 16-bit retro style, no text"
    ),
    "confederacy": (
        "pixel art icon, a noble shield with a star on dark background, "
        "honorable military emblem, blue and gold colors, clean geometric design, "
        "the good guys faction logo, 16-bit retro style, no text"
    ),
    "pop_fiz": (
        "pixel art icon, a grinning dolphin face with chaotic bubbles on dark background, "
        "unhinged and playful, neon green and hot pink colors, reef creature emblem, "
        "game faction logo, 16-bit retro style, no text"
    ),
    "techopuritan": (
        "pixel art icon, a mechanical eye inside a gear/cog on dark background, "
        "cold and menacing, white and electric blue colors, zealot tech faction emblem, "
        "game faction logo, 16-bit retro style, no text"
    ),
}

# === CONTRACT CARD ILLUSTRATIONS (small cards) ===
CONTRACT_DIR = Path("assets/contracts")
CONTRACT_DIR.mkdir(parents=True, exist_ok=True)

CONTRACTS = {
    "felonia_purge": (
        "pixel art, a predator ship attacking a fleet of sleek feline ships in deep space, "
        "explosions and debris, cat-eared ship silhouettes being destroyed, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "tech_martyr": (
        "pixel art, a lone ship charging into a massive angular techopuritan crusade battlestation, "
        "white beam weapons firing, religious circuit symbols on the station, "
        "suicidal bravery, dark dramatic scene, 16-bit retro game style"
    ),
    "shatter_spectacle": (
        "pixel art, two enemy ships exploding into fragments in deep space, "
        "massive debris field and fire, overkill destruction, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "explosive_content": (
        "pixel art, a chain of reactor explosions on a damaged spaceship, "
        "cascading fire and volatile energy bursts, spectacular fireworks in space, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "confederacy_interview": (
        "pixel art, a captured confederacy officer in spotlight with cameras recording, "
        "interrogation room on a space station, blue military uniform in harsh light, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "no_witnesses": (
        "pixel art, a completely destroyed ship leaving only scattered atoms in dark space, "
        "total annihilation with no survivors, cold void, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "live_feed_special": (
        "pixel art, a captured ship hull with cameras and broadcast drones filming, "
        "live recording indicator lights glowing red, space documentary crew, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "feast_haul": (
        "pixel art, a large cargo ship with grappling arms hauling biomass containers, "
        "green glowing vats being filled, harvest in space, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "low_profile_carnage": (
        "pixel art, a predator ship moving in a straight line through multiple destroyed ships, "
        "never stopping or turning back, arrow-like path of destruction, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "brutality_spike": (
        "pixel art, a ratings graph spiking upward with explosions in the background, "
        "TV broadcast overlay showing rising numbers, combat carnage behind, "
        "dark dramatic scene, 16-bit retro game style"
    ),
    "artifact_hunters": (
        "pixel art, glowing alien artifacts being used as weapons in ship combat, "
        "purple crystals firing energy beams, exotic tech showcase, "
        "dark dramatic scene, 16-bit retro game style"
    ),
}


def generate(name, prompt, output_dir, size=(256, 256)):
    out = output_dir / f"{name}.png"
    if out.exists():
        print(f"  [SKIP] {name} exists")
        return True
    print(f"  [GEN] {name}...")
    try:
        resp = requests.post(
            f"{BASE_URL}/api/image-generation/generate",
            headers=HEADERS,
            json={
                "prompt": prompt, "style": "pixel-art",
                "width": size[0], "height": size[1],
                "steps": 25, "guidanceScale": 7.5,
            },
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


print(f"=== Generating {len(EMBLEMS)} faction emblems ===")
for name, prompt in EMBLEMS.items():
    generate(name, prompt, EMBLEM_DIR, size=(256, 256))
    time.sleep(1)

print(f"\n=== Generating {len(CONTRACTS)} contract illustrations ===")
for name, prompt in CONTRACTS.items():
    generate(name, prompt, CONTRACT_DIR, size=(512, 320))
    time.sleep(1)

print("\nDone!")

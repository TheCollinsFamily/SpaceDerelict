"""Generate sci-fi UI assets for Space Derelict sector map using RFAB API.

Uses pixel-art-diffusion-xl for retro pixel art style (matching the game's
existing 80s-CRT aesthetic) and nano-banana-pro for instruction-following
when precise compositions are needed.

The CRT monitor frame itself is fully programmatic (in game.py). These
assets are backgrounds and textures that render inside the CRT "screen".
"""
import requests, os, time

API_KEY = os.environ.get("RFAB_API_KEY", "rfab_SHK-pdCAXXkptzMYVslPYP7jcPk2grwXfVupZkXsi28")
BASE = os.environ.get("RFAB_BASE", "http://localhost:3000")
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
OUT = os.path.join(os.path.dirname(__file__), "assets", "ui")
os.makedirs(OUT, exist_ok=True)

# NEW: Use the `style` parameter instead of model_id for auto-selection:
#   style: "pixel-art"  → pixel-art-diffusion-xl (retro pixel art)
#   style: "fast"       → atlascloud:flux-schnell (cheap/fast iteration)
#   style: "precise"    → nano-banana-pro (instruction following)
# Or still use model_id directly for full control.

ASSETS = [
    # --- Backgrounds (rendered inside the CRT screen area) ---
    {
        "name": "nebula_dark.png",
        "prompt": "deep space nebula, dark blue and purple gas clouds with scattered stars, very dark background, black void of space, distant tiny stars, no planets no text, game background, pixel art style retro",
        "style": "pixel-art",
        "w": 1024, "h": 768,
    },
    {
        "name": "starfield_wide.png",
        "prompt": "wide panoramic starfield, thousands of tiny stars on black void of deep space, some colorful distant nebula wisps, very dark, retro pixel art style, 16 bit, no planets no text no objects",
        "style": "pixel-art",
        "w": 1024, "h": 768,
    },
    {
        "name": "nebula_bg.png",
        "prompt": "dark space nebula background, swirling purple blue green gas clouds, scattered bright stars, deep black space, retro pixel art style, 16 bit video game background, atmospheric moody",
        "style": "pixel-art",
        "w": 1024, "h": 768,
    },
    # --- CRT bezel texture (optional — can be tiled on the bezel border) ---
    {
        "name": "crt_bezel_texture.png",
        "prompt": "seamless tileable texture of old dark grey plastic computer monitor casing, scratched worn industrial plastic surface, subtle grain, very dark, retro 1980s computer hardware, pixel art style",
        "style": "pixel-art",
        "w": 256, "h": 256,
    },
    # --- NEW: Cockpit frame with transparent viewport (uses alphaRegion) ---
    {
        "name": "cockpit_frame_retro.png",
        "prompt": "retro 80s spaceship cockpit control panel frame border, dark metal and plastic CRT monitor housing, buttons dials gauges on edges, worn scratched industrial, pixel art style 16 bit, game UI overlay",
        "style": "pixel-art",
        "w": 1024, "h": 768,
        "alphaRegion": {"x": 0.08, "y": 0.06, "width": 0.64, "height": 0.82, "cornerRadius": 0.03},
    },
]

# NEW: alphaRegion replaces the old inpainting workflow for viewport frames.
# Just pass alphaRegion={x, y, width, height, cornerRadius} and the API
# generates the image then cuts out a transparent viewport automatically.
# No mask upload or inpainting step needed!

for asset in ASSETS:
    out_path = os.path.join(OUT, asset["name"])
    if os.path.exists(out_path):
        print(f"Skipping {asset['name']} (already exists, delete to regenerate)")
        continue

    label = asset.get('style', asset.get('model_id', 'default'))
    print(f"Generating {asset['name']} with style={label}...")
    try:
        body = {
            "prompt": asset["prompt"],
            "negativePrompt": "text, letters, words, watermark, bright, white background, logo, blurry, low quality, realistic, photorealistic",
            "width": asset["w"],
            "height": asset["h"],
            "imageCount": 1,
            "steps": 25,
            "guidanceScale": 7.5,
        }
        if "style" in asset:
            body["style"] = asset["style"]
        if "model_id" in asset:
            body["modelId"] = asset["model_id"]
        if "alphaRegion" in asset:
            body["alphaRegion"] = asset["alphaRegion"]

        r = requests.post(f"{BASE}/api/image-generation/generate", headers=HEADERS, json=body, timeout=120)
        data = r.json()
        if data.get("success") and data.get("imageUrl"):
            img_url = data["imageUrl"]
            alpha_applied = data.get("alphaRegionApplied", False)
            if alpha_applied:
                print(f"  -> alphaRegion applied (transparent viewport cutout)")
            else:
                print(f"  -> {img_url[:80]}...")

            # Handle data URI (from alphaRegion) vs URL
            if img_url.startswith("data:"):
                import base64
                b64 = img_url.split(",", 1)[1]
                img_data = base64.b64decode(b64)
            else:
                img_data = requests.get(img_url, timeout=60).content

            with open(out_path, "wb") as f:
                f.write(img_data)
            print(f"  Saved to {out_path} ({len(img_data)} bytes)")
        else:
            print(f"  ERROR: {data}")
    except Exception as e:
        print(f"  EXCEPTION: {e}")
    time.sleep(2)

print("\nDone! All assets saved to:", OUT)

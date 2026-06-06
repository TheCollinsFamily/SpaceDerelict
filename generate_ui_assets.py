"""Generate sci-fi UI assets for Space Derelict sector map using RFAB API.

Uses pixel-art-diffusion-xl for retro pixel art style (matching the game's
existing 80s-CRT aesthetic) and nano-banana-pro for instruction-following
when precise compositions are needed.

The CRT monitor frame itself is fully programmatic (in game.py). These
assets are backgrounds and textures that render inside the CRT "screen".
"""
import requests, os, time

API_KEY = os.environ.get("RFAB_API_KEY", "rfab_PIvyOCAr_Zk3HaFQ-WQKtPF5xWU1sr1CZt2xf90OqY0")
BASE = "https://rfab.ai"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}
OUT = os.path.join(os.path.dirname(__file__), "assets", "ui")
os.makedirs(OUT, exist_ok=True)

# Models:
#   pixel-art-diffusion-xl  — retro pixel art, matches game aesthetic
#   replicate:google/nano-banana-pro — good instruction following
#   flux-schnell — fast general purpose (good for backgrounds/nebulas)

ASSETS = [
    # --- Backgrounds (rendered inside the CRT screen area) ---
    {
        "name": "nebula_dark.png",
        "prompt": "deep space nebula, dark blue and purple gas clouds with scattered stars, very dark background, black void of space, distant tiny stars, no planets no text, game background, pixel art style retro",
        "model_id": "pixel-art-diffusion-xl",
        "w": 1024, "h": 768,
    },
    {
        "name": "starfield_wide.png",
        "prompt": "wide panoramic starfield, thousands of tiny stars on black void of deep space, some colorful distant nebula wisps, very dark, retro pixel art style, 16 bit, no planets no text no objects",
        "model_id": "pixel-art-diffusion-xl",
        "w": 1024, "h": 768,
    },
    {
        "name": "nebula_bg.png",
        "prompt": "dark space nebula background, swirling purple blue green gas clouds, scattered bright stars, deep black space, retro pixel art style, 16 bit video game background, atmospheric moody",
        "model_id": "pixel-art-diffusion-xl",
        "w": 1024, "h": 768,
    },
    # --- CRT bezel texture (optional — can be tiled on the bezel border) ---
    {
        "name": "crt_bezel_texture.png",
        "prompt": "seamless tileable texture of old dark grey plastic computer monitor casing, scratched worn industrial plastic surface, subtle grain, very dark, retro 1980s computer hardware, pixel art style",
        "model_id": "pixel-art-diffusion-xl",
        "w": 256, "h": 256,
    },
]

# Optional inpainting workflow for creating frame with viewport hole:
# 1. Generate a full console/cockpit image
# 2. Create a mask (white=viewport area to clear, black=frame to keep)
# 3. POST /api/image-generation/inpaint with mask to clear the viewport
# 4. Use background removal to get transparent frame
# Example:
#   r = requests.post(f"{BASE}/api/image-generation/inpaint", headers=HEADERS, json={
#       "imageUrl": "https://...(generated cockpit image)",
#       "maskUrl": "https://...(mask with white rectangle in center)",
#       "prompt": "black void empty dark space through viewport",
#       "model_id": "flux-schnell",
#       "strength": 0.95,
#   })

for asset in ASSETS:
    out_path = os.path.join(OUT, asset["name"])
    if os.path.exists(out_path):
        print(f"Skipping {asset['name']} (already exists, delete to regenerate)")
        continue

    print(f"Generating {asset['name']} with {asset.get('model_id', 'flux-schnell')}...")
    try:
        r = requests.post(f"{BASE}/api/image-generation/generate", headers=HEADERS, json={
            "prompt": asset["prompt"],
            "negativePrompt": "text, letters, words, watermark, bright, white background, logo, blurry, low quality, realistic, photorealistic",
            "model_id": asset.get("model_id", "flux-schnell"),
            "width": asset["w"],
            "height": asset["h"],
            "imageCount": 1,
            "steps": 25,
            "guidanceScale": 7.5,
        }, timeout=120)
        data = r.json()
        if data.get("success") and data.get("imageUrl"):
            img_url = data["imageUrl"]
            print(f"  -> {img_url}")
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

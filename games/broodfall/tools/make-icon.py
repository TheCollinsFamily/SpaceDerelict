"""Make Broodfall's icon from the game's emblem (public/art/screens/emblem.webp).

Run: python tools/make-icon.py

Writes:
- broodfall.ico (game folder; the launcher shortcut and a later packaged .exe use it)
- public/favicon.png and public/favicon-32.png (the browser tab)

Large sizes use the whole emblem (meteor in its ring of tendrils); 16-32 px use the meteor
alone, cropped tight, because the thin ring disappears that small.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'public' / 'art' / 'screens' / 'emblem.webp'


def square(img: Image.Image, box=None) -> Image.Image:
    if box:
        img = img.crop(box)
    w, h = img.size
    s = max(w, h)
    out = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    out.paste(img, ((s - w) // 2, (s - h) // 2))
    return out


def main() -> None:
    em = Image.open(SRC).convert('RGBA')
    whole = square(em, em.getbbox())
    # The meteor body with its flame, without the ring (measured on the 640 px emblem).
    k = em.width / 640
    meteor = square(em, tuple(int(v * k) for v in (80, 110, 580, 610)))
    big = [whole.resize((s, s), Image.LANCZOS) for s in (256, 128, 64, 48)]
    small = [meteor.resize((s, s), Image.LANCZOS) for s in (32, 24, 16)]
    frames = big + small
    frames[0].save(ROOT / 'broodfall.ico', format='ICO', sizes=[f.size for f in frames], append_images=frames[1:])
    whole.resize((192, 192), Image.LANCZOS).save(ROOT / 'public' / 'favicon.png')
    meteor.resize((32, 32), Image.LANCZOS).save(ROOT / 'public' / 'favicon-32.png')
    print('wrote broodfall.ico, public/favicon.png, public/favicon-32.png')


if __name__ == '__main__':
    main()

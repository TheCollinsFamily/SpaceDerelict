"""Helper of tools/shot-impaler.mjs: `one <png> <jpg>` crops a shot round the middle of the canvas;
`sheet <out> <jpg> <label> ...` lays the shots out four to a row with their labels."""
import sys
from PIL import Image, ImageDraw

if sys.argv[1] == 'one':
    im = Image.open(sys.argv[2]).convert('RGB')
    w, h = im.size
    cw, ch = 760, 560
    im.crop(((w - cw) // 2, (h - ch) // 2, (w + cw) // 2, (h + ch) // 2)).save(sys.argv[3], quality=88)
else:
    out = sys.argv[2]
    pairs = list(zip(sys.argv[3::2], sys.argv[4::2]))
    tw, th = 380, 280
    rows = (len(pairs) + 3) // 4
    sheet = Image.new('RGB', (tw * 4, th * rows), (20, 20, 20))
    d = ImageDraw.Draw(sheet)
    for i, (f, label) in enumerate(pairs):
        x, y = (i % 4) * tw, (i // 4) * th
        sheet.paste(Image.open(f).convert('RGB').resize((tw, th)), (x, y))
        d.rectangle((x, y, x + 230, y + 18), fill=(0, 0, 0))
        d.text((x + 4, y + 3), label, fill=(255, 255, 255))
    sheet.save(out, quality=88)

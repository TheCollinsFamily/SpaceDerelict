"""
Is a baked film STEADY from its first frame to its last? (Oct 4 2026.) A film made of clips each started on the last
frame of the one before can rot as it goes: its sharpness (each clip softer than the last), its brightness (a bad colour
correction once bleached the last third of a film), and its specks (motes of light that multiply into "static":
Collins, of the second take). This prints all three through the film and on either side of every join.

    python tools/measure/film-steady.py <film>      (free; reads public/media/scenes/)
"""
import json
import subprocess
import sys

W, H = 640, 360
film = sys.argv[1] if len(sys.argv) > 1 else 'delegation-understand'
f = f'public/media/scenes/{film}.mp4'
cues = json.load(open('public/media/scenes/scenes.json'))['films'][film]['cues']


def raw(t):
    return subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', f'{t:.3f}', '-i', f, '-vf', f'scale={W}:{H}',
                           '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout


def sharp(px):
    s = n = 0
    for y in range(1, H - 1, 2):
        row = y * W
        for x in range(1, W - 1, 2):
            v = 4 * px[row + x] - px[row + x - 1] - px[row + x + 1] - px[row - W + x] - px[row + W + x]
            s += v * v
            n += 1
    return round(s / n)


def specks(px):
    n = 0
    for y in range(2, H - 2, 1):
        row = y * W
        for x in range(2, W - 2):
            v = px[row + x]
            if v - px[row + x - 2] >= 25 and v - px[row + x + 2] >= 25 and v - px[row - 2 * W + x] >= 25 and v - px[row + 2 * W + x] >= 25:
                n += 1
    return n


def bright(px):
    return round(sum(px[::13]) / len(px[::13]), 1)


dur = cues[-1]['t1']
# A join is where the picture of one clip gives way to the next: a cue whose start is far from a round frame of speech
# cannot be told from here, so every cue start is printed with the frames either side of it.
times = sorted(set([0.1] + [round(x, 2) for x in [dur * k / 12 for k in range(1, 12)]] + [dur - 0.5]))
print(f'{film}: {dur:.1f} s')
print('  through the film:   ' + '   '.join(f'{t:5.1f}s sharp {sharp(raw(t)):3d} bright {bright(raw(t)):5.1f} specks {specks(raw(t)):3d}' for t in times[::2]))
for t in times[1::2]:
    px = raw(t)
    print(f'                      {t:5.1f}s sharp {sharp(px):3d} bright {bright(px):5.1f} specks {specks(px):3d}')
if len(sys.argv) > 2:
    for j in [float(x) for x in sys.argv[2].split(',')]:
        print(f'  join at {j:.2f} s: ' + '  '.join(f'{d:+.2f}s {sharp(raw(j + d))}/{bright(raw(j + d))}' for d in [-1.0, -0.1, 0.04, 0.2, 0.4, 0.7, 1.5]))

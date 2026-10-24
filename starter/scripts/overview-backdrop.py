"""The Overview's backdrop art: blurred light trails and film grain in Bahn's colours.

Our own art, drawn here from curves (no photo, no Bahn asset), in the spirit of the
hero on bahnexpress.com: long-exposure light trails in coral red, pink and ice blue,
heavily blurred, with grain on top. Re-run to change it:

    /usr/bin/python3 scripts/overview-backdrop.py public/control-room/overview

Writes trails.jpg (the hero, light at the top for black type), trails-top.jpg (the
light band that fades into the map) and grain.png (256 px tile, used at 30% overlay).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
W, H = 1600, 1000
rng = np.random.default_rng(7)

RED = (253, 74, 97)       # bx red-500
CORAL = (255, 122, 110)
PINK = (248, 178, 182)
ICE = (169, 214, 224)     # towards bx teal-200
CREAM = (246, 238, 232)
LILAC = (226, 218, 232)
ASPHALT = (30, 28, 23)    # bx grey-950
ORANGE = (253, 106, 49)   # bx orange-500


def bezier(p, n=400):
    p = np.array(p, float)
    t = np.linspace(0, 1, n)[:, None]
    k = len(p) - 1
    from math import comb
    return sum(comb(k, i) * (1 - t) ** (k - i) * t ** i * p[i] for i in range(k + 1))


def layer_stroke(size, pts, colour, width, alpha, blur, swell=(0.35, 1.0)):
    """A stroke whose width and strength swell along the path, like a light trail."""
    layer = Image.new("RGBA", size, colour + (0,))
    d = ImageDraw.Draw(layer)
    xy = bezier(pts, 220)
    lo, hi = swell
    for i in range(len(xy) - 1):
        t = i / (len(xy) - 1)
        k = lo + (hi - lo) * (0.5 - 0.5 * np.cos(2 * np.pi * (t * 0.9 + 0.05)))  # thin, full, thin
        w = max(1, int(width * (0.55 + 0.45 * k)))
        a = int(255 * alpha * k)
        (x0, y0), (x1, y1) = xy[i], xy[i + 1]
        d.line((x0, y0, x1, y1), fill=colour + (a,), width=w)
        d.ellipse((x1 - w / 2, y1 - w / 2, x1 + w / 2, y1 + w / 2), fill=colour + (a,))
    return layer.filter(ImageFilter.GaussianBlur(blur)) if blur else layer


def trail(img, pts, layers):
    """One long-exposure trail: a wide soft halo, a body, a bright core."""
    for colour, width, alpha, blur in layers:
        img.alpha_composite(layer_stroke(img.size, pts, colour, width, alpha, blur))


def blob(img, box, colour, alpha, blur=120):
    layer = Image.new("RGBA", img.size, colour + (0,))
    ImageDraw.Draw(layer).ellipse(box, fill=colour + (int(255 * alpha),))
    img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)))


def vertical(top, bottom, h=H):
    a = np.linspace(0, 1, h)[:, None, None]
    g = np.array(top)[None, None, :] * (1 - a) + np.array(bottom)[None, None, :] * a
    return Image.fromarray(np.repeat(g, W, axis=1).astype("uint8")).convert("RGBA")


RED_TRAIL = [(RED, 320, 0.5, 110), (RED, 180, 0.9, 52), (CORAL, 96, 0.9, 32), (PINK, 46, 0.95, 20), ((255, 226, 224), 18, 0.85, 11)]
ICE_TRAIL = [(ICE, 300, 0.55, 110), (ICE, 150, 0.85, 50), ((212, 236, 240), 46, 0.85, 22)]


def hero():
    img = vertical(LILAC, (236, 222, 222))
    blob(img, (950, -360, 1950, 420), ICE, 0.75)            # cold haze, top right
    blob(img, (-250, -300, 750, 380), CREAM, 0.9)           # warm haze, top left
    blob(img, (-520, 470, 470, 1420), ASPHALT, 0.97, 60)    # the dark mass, low left
    blob(img, (1150, 820, 2000, 1350), (46, 36, 34), 0.8, 90)  # shadow, low right
    # The main trail: up out of the dark, over the middle, away to the lower right.
    trail(img, [(420, 720), (860, 650), (1300, 610), (1800, 590)], ICE_TRAIL)  # the cold band, behind
    trail(img, [(-160, 930), (230, 470), (640, 520), (1000, 780), (1760, 880)], RED_TRAIL)
    trail(img, [(-100, 860), (300, 440), (700, 470), (1040, 700), (1760, 800)], [(PINK, 70, 0.7, 30), ((255, 214, 214), 14, 0.7, 9)])
    trail(img, [(-120, 1010), (260, 640), (620, 690), (960, 900), (1760, 990)], [(RED, 160, 0.5, 70), (ORANGE, 60, 0.6, 30)])
    return img.filter(ImageFilter.GaussianBlur(12)).convert("RGB")


def top_band():
    """Light for black type at the top; the page fades it into the map underneath."""
    img = vertical(LILAC, CREAM, H)
    blob(img, (900, -380, 1950, 380), ICE, 0.8)
    blob(img, (-300, -300, 650, 320), CREAM, 0.95)
    trail(img, [(500, 600), (1000, 520), (1400, 480), (1800, 460)], ICE_TRAIL)
    trail(img, [(-200, 700), (280, 360), (700, 400), (1080, 610), (1800, 580)], RED_TRAIL)
    trail(img, [(-160, 640), (330, 330), (740, 350), (1100, 540), (1800, 500)], [(PINK, 70, 0.7, 30), ((255, 214, 214), 14, 0.7, 9)])
    return img.filter(ImageFilter.GaussianBlur(12)).convert("RGB")


def grain():
    n = rng.normal(128, 52, (256, 256)).clip(0, 255).astype("uint8")
    return Image.fromarray(n).filter(ImageFilter.GaussianBlur(0.45))


os.makedirs(OUT, exist_ok=True)
hero().save(os.path.join(OUT, "trails.jpg"), quality=84, optimize=True, progressive=True)
top_band().save(os.path.join(OUT, "trails-top.jpg"), quality=84, optimize=True, progressive=True)
grain().save(os.path.join(OUT, "grain.png"), optimize=True)
print("ok", OUT)

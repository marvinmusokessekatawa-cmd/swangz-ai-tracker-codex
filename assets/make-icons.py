#!/usr/bin/env python3
"""App icons for the installable Swangz AI Tracker.

The shipped badge is 35x41 — fine beside a wordmark, mush at 512. The source
here is the hardened, re-gradiented mark built for the tutorial film
(brand/make-mark.sh), which is 1050x1230 and keeps a clean edge when scaled.

Three shapes, because the platforms want different things:

  icon-192 / icon-512   the mark on the app's own ground, edge to edge
  icon-maskable-512     the same mark pulled in to ~62% of the canvas. Android
                        crops a maskable icon to whatever shape the launcher
                        uses — circle, squircle, teardrop — so anything outside
                        the inner 80% circle can be cut off. Ours sits well
                        inside it.
  apple-touch-icon      180x180, opaque. iOS applies its own rounded corner and
                        does NOT understand maskable or transparency; a
                        transparent icon comes out black on black.

Usage:  python3 assets/make-icons.py
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.expanduser('~/swangz-tutorial/brand/mark-gold.png')
FALLBACK = os.path.join(HERE, 'swangz-badge.webp')

# The midnight ground, which is now the app's default theme.
BG_TOP = (13, 12, 22)
BG_BOT = (2, 4, 10)


def ground(size):
    """A vertical wash rather than a flat fill — a flat near-black icon reads
    as a hole on a dark launcher; the gradient gives it an edge."""
    img = Image.new('RGB', (size, size), BG_BOT)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / max(1, size - 1)
        d.line([(0, y), (size, y)],
               fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOT)))
    return img.convert('RGBA')


def mark():
    path = SRC if os.path.exists(SRC) else FALLBACK
    im = Image.open(path).convert('RGBA')
    print(f'  source: {os.path.relpath(path, ROOT) if path.startswith(ROOT) else path} {im.size}')
    return im


def compose(size, coverage, out, opaque=True):
    """coverage = the fraction of the canvas the mark's longest side may use."""
    m = mark()
    target = round(size * coverage)
    w, h = m.size
    scale = target / max(w, h)
    m = m.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = ground(size) if opaque else Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(m, ((size - m.size[0]) // 2, (size - m.size[1]) // 2))
    if opaque:
        canvas = canvas.convert('RGB')
    canvas.save(os.path.join(HERE, out))
    print(f'  {out}  {size}x{size}')


if __name__ == '__main__':
    print('Swangz AI Tracker — app icons')
    compose(192, 0.68, 'icon-192.png')
    compose(512, 0.68, 'icon-512.png')
    # Pulled in hard: everything outside the inner 80% circle can be cropped.
    compose(512, 0.52, 'icon-maskable-512.png')
    compose(180, 0.66, 'apple-touch-icon.png')
    compose(32,  0.78, 'favicon-32.png')

#!/usr/bin/env python3
"""Finish the slipmats: every picture in assets/_mats/ gets a felt texture (fibres and grain, like a real felt mat) and the fine
silver edge rings of the Original mat, then is saved as assets/slipmat-*.png (the circuit mat is saved as assets/slipmat.png).
Usage: python3 tools/slipmat-finish.py"""
import os, glob, numpy as np, math
from PIL import Image, ImageDraw, ImageFilter
ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets'); N = 1200; C = N / 2
rng = np.random.default_rng(21)
def felt_map():
    # fine grain + thousands of short curly fibres, as a brightness multiplier around 1.0
    g = rng.normal(0, 1, (N, N)).astype(np.float32)
    g = np.asarray(Image.fromarray(((g * 30 + 128).clip(0, 255)).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.7))).astype(np.float32) / 128 - 1
    fib = Image.new('L', (N, N), 128); d = ImageDraw.Draw(fib)
    for i in range(26000):
        x, y = rng.uniform(0, N), rng.uniform(0, N); a = rng.uniform(0, 6.3); ln = rng.uniform(5, 18); cv = rng.uniform(-0.25, 0.25)
        pts = []
        for k in range(6): t = k / 5; aa = a + cv * k; pts.append((x + math.cos(aa) * ln * t, y + math.sin(aa) * ln * t))
        d.line(pts, fill=int(rng.choice([88, 100, 160, 175])), width=1)
    fib = np.asarray(fib.filter(ImageFilter.GaussianBlur(0.45))).astype(np.float32) / 128 - 1
    lo = rng.normal(0, 1, (N // 40, N // 40)).astype(np.float32)          # soft blotches where the felt is thicker / thinner
    lo = np.asarray(Image.fromarray(((lo * 40 + 128).clip(0, 255)).astype(np.uint8)).resize((N, N), Image.BICUBIC)).astype(np.float32) / 128 - 1
    return 1 + g * 0.06 + fib * 0.17 + lo * 0.05
FELT = felt_map()
yy, xx = np.mgrid[0:N, 0:N]; r = np.hypot(xx - C, yy - C) / C
def finish(src, dst, rings=True):
    im = Image.open(src).convert('RGBA').resize((N, N), Image.LANCZOS); a = np.asarray(im).astype(np.float32)
    rgb = a[..., :3] * FELT[..., None]
    rgb *= (1 - 0.18 * np.clip((r - 0.9) / 0.1, 0, 1))[..., None]        # felt edge darkens slightly where it rolls over
    out = Image.fromarray(np.concatenate([rgb.clip(0, 255), a[..., 3:]], -1).astype(np.uint8), 'RGBA')
    if rings:
        d = ImageDraw.Draw(out)
        for rr, w, c in [(0.955, 3, (154, 163, 173, 255)), (0.93, 1, (108, 116, 126, 255))]:
            R = rr * C; d.ellipse([C - R, C - R, C + R, C + R], outline=c, width=w)
    m = Image.new('L', (N, N), 0); ImageDraw.Draw(m).ellipse([0, 0, N - 1, N - 1], fill=255)
    out.putalpha(Image.fromarray(np.minimum(np.asarray(out.getchannel('A')), np.asarray(m)))); out.save(dst)
for f in sorted(glob.glob(os.path.join(ROOT, '_mats', 'slipmat-*.png'))):
    name = os.path.basename(f); dst = os.path.join(ROOT, 'slipmat.png' if name == 'slipmat-circuit.png' else name)
    finish(f, dst, rings=name != 'slipmat-original.png'); print('finished', os.path.basename(dst))

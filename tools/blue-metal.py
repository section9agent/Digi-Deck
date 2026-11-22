#!/usr/bin/env python3
"""Tint the silver (grey, light) metal in player artwork a vivid light blue; darks, colours and see-through parts are left alone.
Usage: python3 tools/blue-metal.py in.png [out.png]   (originals of the bundled art are kept in assets/_silver/)"""
import sys, numpy as np
from PIL import Image
HUE = 200 / 360.0   # light blue
def tint(src, dst):
    im = Image.open(src); mode = im.mode; im = im.convert('RGBA'); a = np.asarray(im).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3:]
    mx, mn = rgb.max(-1), rgb.min(-1); L = (mx + mn) / 2; sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    ss = lambda e0, e1, v: np.clip((v - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((v - e0) / (e1 - e0), 0, 1))
    k = ss(0.28, 0.5, L) * (1 - ss(0.1, 0.22, sat))          # how much this pixel is "silver"
    # target colour: same lightness, blue hue, strong saturation that eases off in the brightest highlights
    S = 0.78 * (1 - ss(0.9, 1.0, L) * 0.6)
    q = np.where(L < 0.5, L * (1 + S), L + S - L * S); p = 2 * L - q
    def h2(t):
        t = t % 1
        return np.where(t < 1/6, p + (q - p) * 6 * t, np.where(t < 1/2, q, np.where(t < 2/3, p + (q - p) * (2/3 - t) * 6, p)))
    blue = np.stack([h2(HUE + 1/3), h2(HUE), h2(HUE - 1/3)], -1)
    out = rgb * (1 - k[..., None]) + blue * k[..., None]
    res = Image.fromarray((np.concatenate([out, al], -1) * 255 + 0.5).clip(0, 255).astype(np.uint8), 'RGBA')
    if mode == 'RGB': res = res.convert('RGB')
    res.save(dst)
if __name__ == '__main__':
    tint(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else sys.argv[1])

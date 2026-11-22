#!/usr/bin/env python3
"""Give the (blue-tinted) metal in player artwork a brushed-aluminium finish like the DAT deck: fine horizontal grain,
random longer streaks, a soft diagonal sheen and a bright top edge. Only the metal is touched: the "silver" mask is taken
from the untinted original in assets/_silver/, so windows, labels, darks and colours stay as they are.
Usage: python3 tools/brushed-metal.py            (brushes every file that has an original in assets/_silver/; the plain-tinted versions are kept in assets/_tinted/)"""
import os, sys, glob, numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location('bm', os.path.join(os.path.dirname(__file__), 'blue-metal.py')); bm = importlib.util.module_from_spec(spec); spec.loader.exec_module(bm)
ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
def ss(e0, e1, v): t = np.clip((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)
def brush(orig, tinted, dst, seed=7):
    o = np.asarray(Image.open(orig).convert('RGBA')).astype(np.float32) / 255
    im = Image.open(tinted); mode = im.mode; t = np.asarray(im.convert('RGBA')).astype(np.float32) / 255
    H, W = o.shape[:2]; rgb = o[..., :3]; mx, mn = rgb.max(-1), rgb.min(-1); L = (mx + mn) / 2
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    k = ss(0.28, 0.5, L) * (1 - ss(0.1, 0.22, sat))                     # metal mask (same rule as the blue tint)
    # where the shipped art was edited after tinting (e.g. printed labels erased), take the mask from the tinted art instead
    tr = t[..., :3]; tL = (tr.max(-1) + tr.min(-1)) / 2; tb = (tr[..., 2] - tr[..., 0])
    edited = ss(0.08, 0.15, np.abs(tL - L)); km = ss(0.28, 0.5, tL) * ss(0.12, 0.25, tb)
    k = k * (1 - edited) + km * edited
    rng = np.random.default_rng(seed); s = max(W, H) / 2000                # scale streaks with the image size
    # fine grain: each row gets its own brightness, smeared a little along the row
    rows = rng.normal(0, 1, (H, 1)).astype(np.float32); grain = np.repeat(rows, W, 1)
    noise = rng.normal(0, 1, (H, W)).astype(np.float32)
    kw = max(3, int(40 * s)); ker = np.ones(kw, np.float32) / kw
    noise = np.apply_along_axis(lambda r: np.convolve(r, ker, 'same'), 1, noise) * np.sqrt(kw) * 0.5
    g = (grain * 0.6 + noise * 0.4) * 0.035
    # long random streaks
    st = np.zeros((H, W), np.float32)
    for _ in range(int(500 * (W * H) / (2000 * 880))):
        y = rng.integers(0, H); x0 = rng.integers(0, W); ln = int(rng.uniform(60, 400) * s); th = max(1, int(s))
        st[y:y + th, x0:x0 + ln] += rng.uniform(0.02, 0.06)
    # broad diagonal sheen and top highlight
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32); d = (xx / W + yy / H) / 2
    sheen = 0.06 * np.exp(-((d - 0.55) / 0.09) ** 2) + 0.04 * np.exp(-((d - 0.08) / 0.1) ** 2) - 0.03 * ss(0.7, 1.0, d)
    top = 0.12 * np.exp(-(yy / (H * 0.012)) )
    add = (g + st + sheen + top) * k
    out = np.clip(t[..., :3] + add[..., None], 0, 1)
    res = Image.fromarray((np.concatenate([out, t[..., 3:]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA')
    if mode == 'RGB': res = res.convert('RGB')
    res.save(dst)
if __name__ == '__main__':
    for orig in sorted(glob.glob(os.path.join(ROOT, '_silver', '**', '*.png'), recursive=True)):
        rel = os.path.relpath(orig, os.path.join(ROOT, '_silver')); dst = os.path.join(ROOT, rel)
        base = os.path.join(ROOT, '_tinted', rel)          # the blue-tinted art before brushing (kept so running twice doesn't stack)
        if not os.path.exists(base): os.makedirs(os.path.dirname(base), exist_ok=True); Image.open(dst).save(base)
        if Image.open(orig).size[0] >= 140: brush(orig, base, dst)
        else: Image.open(base).save(dst)
        print('brushed', rel)

import re, colorsys, sys
def tint_hex(h):
    s = h[1:]
    if len(s) == 3: s = ''.join(c*2 for c in s)
    alpha = s[6:] if len(s) == 8 else ''
    r, g, b = (int(s[i:i+2], 16) / 255 for i in (0, 2, 4))
    mx, mn = max(r, g, b), min(r, g, b); L = (mx + mn) / 2; sat = (mx - mn) / mx if mx else 0
    ss = lambda e0, e1, v: (lambda t: t*t*(3-2*t))(min(1, max(0, (v-e0)/(e1-e0))))
    k = ss(0.28, 0.5, L) * (1 - ss(0.1, 0.22, sat))
    if k <= 0.01: return h
    S = 0.78 * (1 - ss(0.9, 1.0, L) * 0.6)
    br, bg, bb = colorsys.hls_to_rgb(200/360, L, S)
    o = [round((c*(1-k) + t*k) * 255) for c, t in zip((r, g, b), (br, bg, bb))]
    return '#%02x%02x%02x' % tuple(o) + alpha
HEX = re.compile(r'#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
def tint_text(t): return HEX.sub(lambda m: tint_hex(m.group(0)), t)

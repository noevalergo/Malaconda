"""Snake illustrations for the site, built from the real logo artwork (client/images/snake.svg).

 - the head and the pineapple are the logo's own paths, cut out of it along a clean line and placed unchanged;
 - the body is a ribbon of the logo's width whose edges flow tangentially into the logo's own edges at the cut;
 - the pattern is the logo's own paisley (outline + dot), bent along the body; paisleys never touch each other and
   some straddle the edge so the silhouette cuts them (the negative-space notches of the logo).
Run:  python3 tools/gen_snakes.py
"""
import math, re
import numpy as np
from PIL import Image, ImageDraw, ImageChops

ROOT = '/Users/nicolasgastin/Sites/Malaconda/client/images/'
LOGO = open(ROOT + 'snake.svg').read()
D = re.search(r' d="([^"]+)"', LOGO).group(1)
W = 43.4            # body width of the logo
GAP = 5.0           # minimum distance between two paisleys (logo units)

# ------------------------------------------------------------------ logo parsing
def parse_sub(s):
    toks = re.findall(r'[MCLZ]|-?\d+\.?\d*', s)
    segs, i, cur, cmd = [], 0, None, None
    while i < len(toks):
        t = toks[i]
        if t in 'MCLZ':
            cmd = t; i += 1
            if cmd == 'Z': continue
        if cmd == 'M':
            cur = (float(toks[i]), float(toks[i+1])); i += 2; cmd = 'L'
        elif cmd == 'L':
            p = (float(toks[i]), float(toks[i+1])); segs.append(('L', cur, p)); cur = p; i += 2
        elif cmd == 'C':
            c = [float(x) for x in toks[i:i+6]]
            segs.append(('C', cur, (c[0], c[1]), (c[2], c[3]), (c[4], c[5]))); cur = (c[4], c[5]); i += 6
    return segs

def poly(segs, n=16):
    out = []
    for s in segs:
        if s[0] == 'L':
            out.append(s[1])
        else:
            p0, p1, p2, p3 = s[1:]
            for k in range(n):
                t = k / n; u = 1 - t
                out.append((u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                            u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
    return out

SUBS = [s for s in re.split(r'(?=M)', D) if s.strip()]
def bbox_of(s):
    n = [float(x) for x in re.findall(r'-?\d+\.?\d*', s)]
    xs, ys = n[0::2], n[1::2]
    return min(xs), min(ys), max(xs), max(ys)
BOXES = [bbox_of(s) for s in SUBS]

def subs_in(rect):
    x0, y0, x1, y1 = rect
    return ''.join(s for s, b in zip(SUBS, BOXES) if not (b[2] < x0 or b[0] > x1 or b[3] < y0 or b[1] > y1))

# raster of the logo's silhouette (even-odd over all sub-paths), used to measure the cuts
_RS = 10; _RX0, _RY0, _RX1, _RY1 = 100, -10, 300, 290
def _logo_raster():
    w = (_RX1 - _RX0) * _RS; h = (_RY1 - _RY0) * _RS
    acc = Image.new('1', (w, h), 0)
    for s in SUBS:
        p = [((x - _RX0) * _RS, (y - _RY0) * _RS) for x, y in poly(parse_sub(s), 10)]
        im = Image.new('1', (w, h), 0); ImageDraw.Draw(im).polygon(p, fill=1)
        acc = ImageChops.logical_xor(acc, im)
    return np.array(acc, dtype=bool)
RASTER = _logo_raster()

def ink(x, y):
    i = int((y - _RY0) * _RS); j = int((x - _RX0) * _RS)
    return 0 <= i < RASTER.shape[0] and 0 <= j < RASTER.shape[1] and bool(RASTER[i, j])

# ------------------------------------------------------------------ the cuts
class Cut:
    """A clean cut across the logo's silhouette: centre c, direction phi (towards the part we keep), in logo units.
    Measures the chord (width), its midpoint, and how fast the chord widens along the axis."""
    def __init__(self, c, phi, rect, extra=()):
        self.c, self.phi, self.rect, self.extra = c, phi, rect, extra
        a = math.radians(phi); self.axis = (math.cos(a), math.sin(a)); self.perp = (-math.sin(a), math.cos(a))
        lo, hi = self._run(c)
        assert hi - lo > 3, 'cut centre is not on ink'
        ts = np.arange(lo + .6, hi - .6, .05)
        assert all(ink(c[0] + self.perp[0]*t, c[1] + self.perp[1]*t) for t in ts), 'a hole crosses the cut'
        self.width = hi - lo
        self.mid = (c[0] + self.perp[0]*(lo + hi)/2, c[1] + self.perp[1]*(lo + hi)/2)
        ds, los, his = [], [], []
        for d in (1, 2, 3, 4, 5):
            cc = (self.mid[0] + self.axis[0]*d, self.mid[1] + self.axis[1]*d)
            l2, h2 = self._run(cc)
            assert h2 - l2 > 2, 'the measuring points leave the ink'
            ds.append(d); los.append(l2); his.append(h2)
        # how the logo's two edges leave the cut, relative to the axis: the body's edges are made to meet them tangentially
        self.slope_lo = float(np.polyfit(ds, los, 1)[0]); self.slope_hi = float(np.polyfit(ds, his, 1)[0])
        self.dwds = self.slope_hi - self.slope_lo           # widening of the chord
        self.drift = (self.slope_hi + self.slope_lo) / 2    # sideways drift of the chord's midpoint
    def _run(self, c):
        def f(t): return ink(c[0] + self.perp[0]*t, c[1] + self.perp[1]*t)
        if not f(0): return (0, 0)
        lo = hi = 0.0
        while f(lo - .05) and lo > -80: lo -= .05
        while f(hi + .05) and hi < 80: hi += .05
        return lo, hi
    def clip_polygon(self):
        far = 400
        p1 = (self.mid[0] - self.perp[0]*far, self.mid[1] - self.perp[1]*far)
        p2 = (self.mid[0] + self.perp[0]*far, self.mid[1] + self.perp[1]*far)
        p3 = (p2[0] + self.axis[0]*far, p2[1] + self.axis[1]*far)
        p4 = (p1[0] + self.axis[0]*far, p1[1] + self.axis[1]*far)
        return [p1, p2, p3, p4]

HEAD = Cut((155, 25.6), 21, (140, -5, 250, 77))
# the fruit hangs from the logo's own stalk: the cut crosses the thick leg of the stalk (about 12 units wide), between two of
# the logo's little paisleys, and everything right of x=242 (the pineapple, which hangs lower than the cut) is kept whole
FRUIT = Cut((227.5, 131), -93, (219.5, 70, 292, 150), extra=((242, 70, 292, 150),))

# ------------------------------------------------------------------ geometry helpers
def turtle(x, y, heading, steps, ds=.8):
    pts = [(x, y)]; h = math.radians(heading)
    for st in steps:
        if st[0] == 'L':
            n = max(1, int(st[1] / ds))
            for _ in range(n):
                x += math.cos(h) * st[1] / n; y += math.sin(h) * st[1] / n; pts.append((x, y))
        else:
            r, turn = st[1], math.radians(st[2]); n = max(2, int(abs(turn) * r / ds))
            for _ in range(n):
                dh = turn / n; hm = h + dh / 2
                x += math.cos(hm) * r * abs(dh); y += math.sin(hm) * r * abs(dh); h += dh; pts.append((x, y))
    return pts, math.degrees(h)

def resample(c, ds):
    cum = [0.0]
    for i in range(1, len(c)): cum.append(cum[-1] + math.dist(c[i], c[i-1]))
    L = cum[-1]; n = max(2, int(L / ds)); out = []; j = 0
    for k in range(n + 1):
        s = L * k / n
        while j < len(c) - 2 and cum[j+1] < s: j += 1
        seg = cum[j+1] - cum[j] or 1; t = (s - cum[j]) / seg
        out.append((c[j][0] + (c[j+1][0]-c[j][0])*t, c[j][1] + (c[j+1][1]-c[j][1])*t))
    return out

def spline(points, ds=.8, seg=40):
    """Catmull-Rom through points, resampled uniformly"""
    P = [(2*points[0][0]-points[1][0], 2*points[0][1]-points[1][1])] + list(points) + [(2*points[-1][0]-points[-2][0], 2*points[-1][1]-points[-2][1])]
    c = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        for j in range(seg):
            t = j / seg; t2 = t*t; t3 = t2*t
            c.append(tuple(0.5*((2*p1[k]) + (-p0[k]+p2[k])*t + (2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t2 + (-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t3) for k in (0, 1)))
    c.append(tuple(points[-1]))
    return resample(c, ds)

class Line:
    def __init__(self, pts):
        self.p = pts; self.s = [0.0]
        for i in range(1, len(pts)): self.s.append(self.s[-1] + math.dist(pts[i], pts[i-1]))
        self.L = self.s[-1]
        self.ang = []
        for i in range(len(pts)):
            a = pts[max(0, i-3)]; b = pts[min(len(pts)-1, i+3)]
            self.ang.append(math.atan2(b[1]-a[1], b[0]-a[0]))
        self.arr = np.array(pts)
    def at(self, s):
        s = min(max(s, 0), self.L)
        lo, hi = 0, len(self.s) - 1
        while hi - lo > 1:
            m = (lo + hi) // 2
            if self.s[m] <= s: lo = m
            else: hi = m
        t = (s - self.s[lo]) / ((self.s[hi] - self.s[lo]) or 1)
        a, b = self.p[lo], self.p[hi]
        da = (self.ang[hi] - self.ang[lo] + math.pi) % (2*math.pi) - math.pi
        return (a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t), self.ang[lo] + da*t

def hermite(t, y0, y1, m0, m1):
    t2, t3 = t*t, t*t*t
    return (2*t3 - 3*t2 + 1)*y0 + (t3 - 2*t2 + t)*m0 + (-2*t3 + 3*t2)*y1 + (t3 - t2)*m1

def ribbon(line, wfun, extend_end=0.0, ext_slope=0.0, shift=None, ext_drift=0.0):
    left, right = [], []
    n = int(line.L) + 1
    for k in range(n + 1):
        s = line.L * k / n
        (x, y), a = line.at(s); w = wfun(s); sh = shift(s) if shift else 0.0
        nx, ny = -math.sin(a), math.cos(a)
        left.append((x + nx*(w/2 + sh), y + ny*(w/2 + sh))); right.append((x - nx*(w/2 - sh), y - ny*(w/2 - sh)))
    if extend_end:
        (x, y), a = line.at(line.L); w = wfun(line.L) + ext_slope * extend_end - 0.7     # a hair inside the logo's own silhouette
        nx, ny = -math.sin(a), math.cos(a)
        px, py = x + math.cos(a)*extend_end, y + math.sin(a)*extend_end
        sh = ext_drift * extend_end
        left.append((px + nx*(w/2 + sh), py + ny*(w/2 + sh))); right.append((px - nx*(w/2 - sh), py - ny*(w/2 - sh)))
    return left + right[::-1]

def path_d(polys):
    return ''.join('M' + ' L'.join(f'{x:.2f},{y:.2f}' for x, y in p) + 'Z' for p in polys)

# ------------------------------------------------------------------ the paisleys
# The logo has several different paisleys (outline, inner outline, dot): all of them are used, at their own size.
def _inside(a, b, tol=1.5):
    return a[0] >= b[0]-tol and a[1] >= b[1]-tol and a[2] <= b[2]+tol and a[3] <= b[3]+tol

def make_templates():
    out = []
    for i, b in enumerate(BOXES):
        if max(b[2]-b[0], b[3]-b[1]) > 80: continue
        ch = [j for j in range(len(SUBS)) if j != i and _inside(BOXES[j], b)]
        if len(ch) != 2: continue
        A, B, Dt = [poly(parse_sub(SUBS[k]), 14) for k in (i, *ch)]
        if len(poly(parse_sub(SUBS[ch[0]]))) < len(poly(parse_sub(SUBS[ch[1]]))): B, Dt = Dt, B   # inner outline is the longer one
        cx = sum(p[0] for p in A) / len(A); cy = sum(p[1] for p in A) / len(A)
        sxx = sum((p[0]-cx)**2 for p in A); syy = sum((p[1]-cy)**2 for p in A); sxy = sum((p[0]-cx)*(p[1]-cy) for p in A)
        ang = 0.5 * math.atan2(2*sxy, sxx - syy)
        dx = sum(p[0] for p in Dt)/len(Dt) - cx; dy = sum(p[1] for p in Dt)/len(Dt) - cy
        if dx*math.cos(ang) + dy*math.sin(ang) < 0: ang += math.pi
        ca, sa = math.cos(-ang), math.sin(-ang)
        g = [[((x-cx)*ca - (y-cy)*sa, (x-cx)*sa + (y-cy)*ca) for x, y in P] for P in (A, B, Dt)]
        length = max(p[0] for p in g[0]) - min(p[0] for p in g[0])
        if 30 <= length <= 80: out.append(g)
    return out
TEMPLATES = make_templates()

def place(line, T, s, lat, tilt, flip, mirror, sc):
    t = math.radians(tilt); ct, st = math.cos(t), math.sin(t)
    group = []
    for P in T:
        q = []
        for u, v in P:
            v = v * mirror
            u2, v2 = (u*ct - v*st) * sc * flip, (u*st + v*ct) * sc * flip
            (cx, cy), a = line.at(s + u2)
            off = v2 + lat
            q.append((cx - math.sin(a)*off, cy + math.cos(a)*off))
        group.append(q)
    return group

def edge_excess(line, wfun, outer):
    """how far the outline pokes beyond the body edge (negative: that far inside)"""
    pts = np.array(outer)
    d = np.sqrt(((pts[:, None, :] - line.arr[None, ::2, :])**2).sum(-1))
    j = d.argmin(axis=1) * 2
    dist = d.min(axis=1)
    half = np.array([wfun(line.s[k]) / 2 for k in j])
    return float((dist - half).max())

def pattern(line, wfun, s_start, s_stop, seed=1, min_scale=.55, margin=3.0, tries=16):
    """Irregular, like the logo: different paisleys, pointing along or against the body, tilted, mirrored, slightly different
    sizes, at random lateral positions and with varying gaps. Never closer than GAP; none sits in the hairline zone of the edge."""
    import random
    rng = random.Random(seed)
    arrs = []; out = []
    s = s_start
    while s > s_stop:
        w = wfun(s); base = min(1.0, w / W)
        if base >= min_scale:
            for _ in range(tries):
                T = rng.choice(TEMPLATES)
                flip = rng.choice((1, 1, -1)); mirror = rng.choice((1, -1))
                tilt = rng.uniform(-34, 34); lat = rng.uniform(-.34, .34) * w
                sc = base * rng.uniform(.82, 1.06); sc_s = s - rng.uniform(0, 12)
                g = place(line, T, sc_s, lat, tilt, flip, mirror, sc)
                A = np.array(g[0])
                if -margin < edge_excess(line, wfun, g[0]) < margin: continue
                if any(abs(cs - sc_s) < 140 and np.sqrt(((A[:, None, :] - B[None, :, :])**2).sum(-1)).min() < GAP for B, cs in arrs): continue
                out.append(g); arrs.append((A, sc_s)); break
        s -= rng.uniform(3, 9) + (rng.uniform(0, 16) if rng.random() < .3 else 0)
    return out

# ------------------------------------------------------------------ the logo's pieces, placed
def piece_group(cut, gid, m_world, rot, mirror):
    sx = -1 if mirror else 1
    tf = f'translate({m_world[0]:.3f} {m_world[1]:.3f}) rotate({rot:.3f}) scale({sx} 1) translate({-cut.mid[0]:.3f} {-cut.mid[1]:.3f})'
    pts = ' '.join(f'{x:.2f},{y:.2f}' for x, y in cut.clip_polygon())
    x0, y0, x1, y1 = cut.rect
    extra = ''.join(f'<rect x="{a}" y="{b}" width="{c-a}" height="{d-b}"/>' for a, b, c, d in cut.extra)
    defs = (f'<clipPath id="{gid}r"><rect x="{x0}" y="{y0}" width="{x1-x0}" height="{y1-y0}"/></clipPath>'
            f'<clipPath id="{gid}"><polygon points="{pts}"/>{extra}</clipPath>')
    body = f'<g transform="{tf}"><g clip-path="url(#{gid})"><path fill-rule="evenodd" clip-path="url(#{gid}r)" d="{subs_in(cut.rect)}"/></g></g>'
    return defs, body

def piece_points(cut, m_world, rot, mirror, stride=4):
    """sample points of the kept ink, in world coordinates"""
    ys, xs = np.nonzero(RASTER[::stride, ::stride])
    px = _RX0 + xs * stride / _RS; py = _RY0 + ys * stride / _RS
    x0, y0, x1, y1 = cut.rect
    keep = (px >= x0) & (px <= x1) & (py >= y0) & (py <= y1) & (((px - cut.mid[0])*cut.axis[0] + (py - cut.mid[1])*cut.axis[1]) >= 0)
    for a, b, c, d in cut.extra: keep |= (px >= a) & (px <= c) & (py >= b) & (py <= d)
    px, py = px[keep] - cut.mid[0], py[keep] - cut.mid[1]
    if mirror: px = -px
    r = math.radians(rot); c, s = math.cos(r), math.sin(r)
    return np.stack([m_world[0] + px*c - py*s, m_world[1] + px*s + py*c], axis=1)

def width_profile(L, w_body=W, end_cut=None, taper=None):
    """body width along s (0 far end .. L at the attach point). With end_cut the width narrows to a neck then flares into the
    cut's chord at the cut's own slope, so the edges flow into the logo's edges. taper=(length, final width): long taper to a thin stalk."""
    knots = [(0.0, w_body, 0.0)]
    if taper and end_cut is not None:
        knots += [(max(1.0, L - taper), w_body, 0.0), (L, end_cut.width, end_cut.dwds)]
    elif end_cut is not None:
        knots += [(L - 110, w_body, 0.0), (L - 22, end_cut.width * .8, 0.0), (L, end_cut.width, end_cut.dwds)]
    knots.sort()
    def f(s):
        s = min(max(s, 0), L)
        for (s0, y0, m0), (s1, y1, m1) in zip(knots, knots[1:]):
            if s0 <= s <= s1:
                if s1 == s0: return y1
                t = (s - s0) / (s1 - s0)
                return hermite(t, y0, y1, m0 * (s1 - s0), m1 * (s1 - s0))
        return knots[-1][1]
    return f

def shift_profile(L, cut, span=48):
    """sideways offset of the body's edges near the cut so that both of them leave along the logo's own edges"""
    def f(s):
        if s <= L - span: return 0.0
        t = (s - (L - span)) / span
        return hermite(t, 0.0, 0.0, 0.0, cut.drift * span)
    return f

def build(lines, name, vb, cut_flush=None):
    """lines: list of dict(line, wfun, piece(optional: cut, mirror, delta), pat_from, pat_to).
    Several bodies can share one svg (story pieces). vb = (x0, y0, x1, y1) frame in the same units."""
    defs, shapes, holes, bodies = [], [], [], []
    pieces_pts = []
    for i, ln in enumerate(lines):
        line, wf = ln['line'], ln['wfun']
        cutp = ln['piece']['cut'] if ln.get('piece') else None
        bodies.append(ribbon(line, wf, extend_end=1.5 if cutp else 0, ext_slope=cutp.dwds if cutp else 0,
                             shift=shift_profile(line.L, cutp) if cutp else None, ext_drift=cutp.drift if cutp else 0))
        avoid = []
        if ln.get('piece'):
            p = ln['piece']; cut = p['cut']; mir = p['mirror']; rot = p.get('rot', 0.0)
            ex, ey = line.p[-1]
            d, b = piece_group(cut, f'p{i}', (ex, ey), rot, mir)
            defs.append(d); shapes.append(b)
            pts = piece_points(cut, (ex, ey), rot, mir)
            pieces_pts.append(pts)
        holes += pattern(line, wf, ln.get('pat_from', line.L - 36), ln.get('pat_to', 0), seed=ln.get('seed', 1))
    x0, y0, x1, y1 = vb
    w, h = x1 - x0, y1 - y0
    mask = ''.join(f'<path fill="#000" fill-rule="evenodd" d="{path_d(g)}"/>' for g in holes)
    out = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.2f} {y0:.2f} {w:.2f} {h:.2f}"><defs>{"".join(defs)}'
           f'<mask id="pm" maskUnits="userSpaceOnUse" x="{x0:.2f}" y="{y0:.2f}" width="{w:.2f}" height="{h:.2f}"><rect x="{x0:.2f}" y="{y0:.2f}" width="{w:.2f}" height="{h:.2f}" fill="#fff"/>{mask}</mask></defs>'
           f'<path mask="url(#pm)" d="{path_d(bodies)}"/>{"".join(shapes)}</svg>')
    open(ROOT + name, 'w').write(out)
    print(f'{name}: viewBox {w:.1f}x{h:.1f}  aspect {w:.2f}/{h:.2f}  {len(out)//1024} KB  paisleys {len(holes)}')
    return pieces_pts

def line_bbox(line, wfun):
    a = line.arr; ws = np.array([wfun(s) for s in line.s]) / 2
    return a[:, 0].min() - ws.max(), a[:, 1].min() - ws.max(), a[:, 0].max() + ws.max(), a[:, 1].max() + ws.max()


if __name__ == '__main__':
    print('head cut : width %.1f  mid (%.1f, %.1f)  dw/ds %.3f' % (HEAD.width, *HEAD.mid, HEAD.dwds))
    print('fruit cut: width %.1f  mid (%.1f, %.1f)  dw/ds %.3f' % (FRUIT.width, *FRUIT.mid, FRUIT.dwds))
    exec(open(__file__.replace('gen_snakes.py', 'snake_scenes.py')).read())

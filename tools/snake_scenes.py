# scenes for gen_snakes.py (exec'd in its namespace)

def box_of(pts_list, extra=()):
    a = np.vstack([p for p in pts_list if len(p)] + [np.array(e) for e in extra if len(e)])
    return a[:, 0].min(), a[:, 1].min(), a[:, 0].max(), a[:, 1].max()

# ---- contact: the head rises above the title, the body arrives from the left edge of the page -------------
def contact():
    axis = -12.0                                   # world direction of the head (slightly raised)
    rot = axis - HEAD.phi
    line, _ = reverse_from_attach((0.0, 0.0), axis + 180, [('A', 95, -36), ('A', 95, 44), ('L', 220)])
    wf = width_profile(line.L, W, end_cut=HEAD)
    far_x = line.p[0][0]
    pts = piece_points(HEAD, line.p[-1], rot, False)
    bb = line_bbox(line, wf)
    x0 = far_x + 50                                 # 70 units of body beyond the page edge, so the cut is never visible
    y0 = min(bb[1], pts[:, 1].min()) - 2
    y1 = max(line.arr[:, 1].max() + W / 2, pts[:, 1].max()) + 2
    x1 = pts[:, 0].max() + 2
    build([dict(line=line, wfun=wf, piece=dict(cut=HEAD, mirror=False, rot=rot), pat_from=line.L - 34, pat_to=0, seed=3)],
          'snake-contact.svg', (x0, y0, x1, y1))

def reverse_from_attach(attach, heading_away, steps):
    pts, hend = turtle(attach[0], attach[1], heading_away, steps)
    return Line(pts[::-1]), hend


# ---- story ---------------------------------------------------------------------------------------------------
# Drawn after the user's own pen curves (Pixelmator screenshot, 1844 px wide viewport). 1 logo unit = SC design px.
SC = 1.15
STORY_W = 1844
def P(x, y): return (x / SC, y / SC)

def story_top():
    """body sweeping in from the right edge in an S, ending in the logo's head, hanging at the top of the section"""
    pts = [(1355, 240), (1390, 239), (1420, 236), (1450, 231), (1480, 223), (1510, 212), (1540, 197), (1570, 178), (1600, 155),
           (1630, 131), (1660, 109), (1690, 92), (1720, 79), (1750, 70), (1780, 64), (1840, 60), (1874, 59), (1990, 58), (2120, 58), (2260, 58), (2400, 58), (2560, 58), (2700, 58)]
    line = Line(spline([P(*q) for q in pts][::-1][::-1], ds=.8)[::-1])        # far end -> head
    axis = math.degrees(line.ang[-1]) + 0           # direction of travel at the head
    rot = axis - (180 - HEAD.phi)                     # head is mirrored: it looks left
    wf = width_profile(line.L, W, end_cut=HEAD)
    build([dict(line=line, wfun=wf, piece=dict(cut=HEAD, mirror=True, rot=rot), pat_from=line.L - 34, pat_to=0, seed=7)],
          'snake-story-top.svg', (0, 0, (STORY_W + 450) / SC, 340 / SC))   # 150 design px of body beyond the section edge: room for the parallax

def story_bottom():
    """tail with the logo's pineapple at the left (hanging from the logo's own thick stalk), the body weaving out of and back into
    the bottom edge, rising to the right edge"""
    H = 330
    C = P(520, 292)
    away = 180 - FRUIT.phi + 180 if False else (180 - FRUIT.phi) + 180      # world direction leaving the cut (mirrored axis + 180)
    pre, hend = turtle(C[0], C[1], away % 360, [('A', 48, -44), ('L', 10)], ds=.8)
    pre_s = pre[::12]
    wave = [(590, 372), (670, 404), (760, 410), (840, 380), (890, 335), (940, 292), (1010, 264), (1080, 256), (1160, 260), (1240, 270),
            (1320, 292), (1400, 334), (1480, 382), (1570, 404), (1650, 440)]
    pts = pre_s + [P(*q) for q in wave]
    line = Line(spline(pts, ds=.8)[::-1])               # far end -> tail
    axis = math.degrees(line.ang[-1])
    rot = axis - (180 - FRUIT.phi)
    wf = width_profile(line.L, W, end_cut=FRUIT, taper=360)
    build([dict(line=line, wfun=wf, piece=dict(cut=FRUIT, mirror=True, rot=rot), pat_from=line.L - 30, pat_to=0, seed=11)],
          'snake-story-bottom.svg', (0, 0, STORY_W / SC, H / SC))

story_top()
story_bottom()

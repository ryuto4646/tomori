# TOMORI World V2 のワールドキットを Blender で生成する（外部素材なし・テクスチャなし・頂点色だけ）
#
# 実行（リポジトリのルートで）:
#   "C:\Users\DELL\Tools\Blender-5.2.1\blender.exe" --background --factory-startup --python tools/world-v2/generate_tomori_world.py
#
# 出力:
#   assets/world-v2/tomori-world-kit.glb   … 素材ひとそろい（glTF 2.0・1ファイルで完結）
#   assets/world-v2/manifest.json          … ファイルの大きさ・SHA-256・ノード一覧・三角形の数
#   assets/world-v2/LICENSE.txt            … 権利表記（TOMORI のために生成した独自素材）
#
# 座標のきまり：この中では Three.js と同じ向き（x＝右、y＝上、z＝手前）で考え、P() で Blender の向きへ直す。
# 乱数の種は固定なので、何度実行しても同じ形になる。
import bpy, bmesh, math, random, os, json, hashlib
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'world-v2'))
GLB = os.path.join(OUT_DIR, 'tomori-world-kit.glb')
SEED = 20261001


def P(x, y, z):
    """Three.js の座標 (x, 上, 手前) を Blender の座標 (x, 奥, 上) へ"""
    return Vector((x, -z, y))


def lin(hexv):
    """sRGB の色（0xRRGGBB）を、glTF の頂点色（リニア）へ"""
    def f(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f((hexv >> 16) & 255), f((hexv >> 8) & 255), f(hexv & 255), 1.0)


def mix(a, b, k):
    return tuple(a[i] + (b[i] - a[i]) * k for i in range(4))


class Kit:
    """1つの素材（1つのノード）を組み立てる"""
    def __init__(self, name, rng):
        self.name, self.rng = name, rng
        self.bm = bmesh.new()
        self.col = self.bm.verts.layers.float_color.new('Col')

    def paint(self, verts, color, jitter=0.04):
        for v in verts:
            k = 1 + (self.rng.random() - .5) * 2 * jitter
            v[self.col] = (min(1, color[0] * k), min(1, color[1] * k), min(1, color[2] * k), 1.0)

    def blob(self, c, size, color, subdiv=1, rough=.12, flat_base=None, shade_top=None):
        """丸いかたまり（葉・茂み・岩）。頂点を少しずつ動かして、完全な球にしない"""
        m = Matrix.Translation(P(*c)) @ Matrix.Diagonal((size[0], size[2], size[1], 1))
        r = bmesh.ops.create_icosphere(self.bm, subdivisions=subdiv + 1, radius=1.0, matrix=m)   # Blender の 1 は正二十面体そのもの
        vs = r['verts']
        center = P(*c)
        for v in vs:
            d = v.co - center
            v.co = center + d * (1 + (self.rng.random() - .5) * 2 * rough)
            if flat_base is not None and v.co.z < flat_base:
                v.co.z = flat_base
        self.paint(vs, color)
        if shade_top:                        # 上の面ほど明るく・苔の色を足す
            top_col, k = shade_top
            zs = [v.co.z for v in vs]; z0, z1 = min(zs), max(zs)
            for v in vs:
                t = (v.co.z - z0) / max(1e-6, z1 - z0)
                v[self.col] = mix(v[self.col], top_col, k * t * t)
        return vs

    def tube(self, pts, radii, color, sides=6, tip=True, color_end=None):
        """点をつないだ太さの変わる管（幹・枝・根）"""
        pts = [P(*p) for p in pts]
        rings = []
        prev_n = None
        for i, p in enumerate(pts):
            t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
            ref = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
            n = t.cross(ref).normalized() if prev_n is None else (prev_n - t * prev_n.dot(t)).normalized()
            b = t.cross(n)
            prev_n = n
            ring = []
            for s in range(sides):
                a = s / sides * math.tau
                ring.append(self.bm.verts.new(p + (n * math.cos(a) + b * math.sin(a)) * radii[i]))
            k = i / max(1, len(pts) - 1)
            self.paint(ring, mix(color, color_end, k) if color_end else color)
            rings.append(ring)
        for i in range(len(rings) - 1):
            for s in range(sides):
                a, b2 = rings[i][s], rings[i][(s + 1) % sides]
                c, d = rings[i + 1][(s + 1) % sides], rings[i + 1][s]
                self.bm.faces.new((a, b2, c, d))
        if tip:
            apex = self.bm.verts.new(pts[-1] + (pts[-1] - pts[-2]).normalized() * radii[-1] * 1.5)
            self.paint([apex], color_end or color)
            for s in range(sides):
                self.bm.faces.new((rings[-1][s], rings[-1][(s + 1) % sides], apex))

    def tier(self, y, r, h, color, segs=11, droop=.18, off=(0, 0)):
        """針葉樹の段：ふちが波打ち、少し垂れ下がる傘。下面もある"""
        cx, cz = off
        apex = self.bm.verts.new(P(cx, y + h, cz))
        rim, inner = [], []
        for s in range(segs):
            a = s / segs * math.tau + self.rng.random() * .2
            rr = r * (.82 + self.rng.random() * .3)
            dy = -droop * (.5 + self.rng.random())
            rim.append(self.bm.verts.new(P(cx + math.cos(a) * rr, y + dy, cz + math.sin(a) * rr)))
            inner.append(self.bm.verts.new(P(cx + math.cos(a) * rr * .45, y + h * .18, cz + math.sin(a) * rr * .45)))
        self.paint([apex], color); self.paint(rim, mix(color, (0, 0, 0, 1), .22)); self.paint(inner, mix(color, (0, 0, 0, 1), .45))
        for s in range(segs):
            n = (s + 1) % segs
            self.bm.faces.new((rim[s], rim[n], apex))
            self.bm.faces.new((inner[s], inner[n], rim[n], rim[s]))

    def blade(self, base, angle, lean, h, w, color, tip_color, segs=3):
        """草の葉：根元が太く、先が細く、外へ反る細い帯（両面から見える）"""
        x0, y0, z0 = base
        dx, dz = math.cos(angle), math.sin(angle)
        px, pz = -dz, dx
        left, right = [], []
        for i in range(segs + 1):
            t = i / segs
            bend = lean * t * t
            cx, cy, cz = x0 + dx * bend, y0 + h * t, z0 + dz * bend
            ww = w * (1 - t) + .004
            left.append(self.bm.verts.new(P(cx + px * ww, cy, cz + pz * ww)))
            right.append(self.bm.verts.new(P(cx - px * ww, cy, cz - pz * ww)))
            c = mix(color, tip_color, t)
            self.paint([left[-1], right[-1]], c, .02)
        for i in range(segs):
            self.bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))

    def flower(self, c, r, color, center_color, tilt=.25):
        """花：5枚の花びらの星形（平たい）と小さな中心。宝石の破片に見えないよう、平たく柔らかく"""
        x, y, z = c
        ctr = self.bm.verts.new(P(x, y + r * .12, z))
        self.paint([ctr], center_color, 0)
        ring = []
        for s in range(10):
            a = s / 10 * math.tau
            rr = r if s % 2 == 0 else r * .45
            ring.append(self.bm.verts.new(P(x + math.cos(a) * rr, y + math.sin(a) * rr * tilt, z + math.sin(a) * rr)))
        self.paint(ring, color, .03)
        for s in range(10):
            self.bm.faces.new((ctr, ring[s], ring[(s + 1) % 10]))

    def slab(self, c, size, yaw, color, segs=7, rough=.12):
        """平たい石（石畳・台）"""
        x, y, z = c
        sx, sy, sz = size
        top, bot = [], []
        for s in range(segs):
            a = s / segs * math.tau
            rr = 1 + (self.rng.random() - .5) * 2 * rough
            px, pz = math.cos(a) * sx * rr, math.sin(a) * sz * rr
            qx, qz = px * math.cos(yaw) - pz * math.sin(yaw), px * math.sin(yaw) + pz * math.cos(yaw)
            top.append(self.bm.verts.new(P(x + qx, y + sy, z + qz)))
            bot.append(self.bm.verts.new(P(x + qx * 1.04, y, z + qz * 1.04)))
        self.paint(top, color); self.paint(bot, mix(color, (0, 0, 0, 1), .25))
        self.bm.faces.new(top)
        for s in range(segs):
            n = (s + 1) % segs
            self.bm.faces.new((bot[s], bot[n], top[n], top[s]))

    def finish(self, location=(0, 0, 0)):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        for poly in me.polygons:
            poly.use_smooth = True
        me.color_attributes.active_color = me.color_attributes['Col']
        obj = bpy.data.objects.new(self.name, me)
        obj.location = P(*location)
        bpy.context.scene.collection.objects.link(obj)
        return obj


# ── 色（sRGB で決め、頂点色ではリニアへ直す）─────────────────────────────
BARK = lin(0x7a5a40); BARK_D = lin(0x5e4532)
LEAF_WARM = lin(0x8cbf4e); LEAF_MID = lin(0x5d9a48); LEAF_DEEP = lin(0x4f8a62); LEAF_LIGHT = lin(0xb4d66a)
CONIFER = lin(0x4e8a55); CONIFER_L = lin(0x6aa85a)
GRASS = lin(0x5f9d3f); GRASS_TIP = lin(0xb9d978); GRASS_DRY = lin(0xa7b763); GRASS_BLUE = lin(0x5c9a72)
ROCK = lin(0xa8a090); ROCK_D = lin(0x8f887a); MOSS = lin(0x7f9a52)
RUIN = lin(0xb8b0a0); RUIN_D = lin(0x9d9586)
ROOT = lin(0x6b4a33); ROOT_L = lin(0x8a6447); ROOT_MOSS = lin(0x6f8a45)
WT_BARK = lin(0x8a6446); WT_BARK_L = lin(0xab875f); WT_LEAF = lin(0x4e9c88); WT_LEAF_L = lin(0xa9d465)   # 葉：影は青緑、日の当たる中心は若葉色
FRUIT = lin(0xfff3cf)
SEED_GOLD = lin(0xe9b84a); SEED_CREAM = lin(0xfff0c4); SEED_GLOW = lin(0xa6dcf2)   # ことばのタネ：中心は金色、外側は水色


def build_all():
    rng = random.Random(SEED)
    objs = []

    # ── 丸い樹冠の木（2種類）──────────────────────────────────────────
    for name, blobs, h in [('Tree_Round_A', [((0, 2.35, 0), (1.35, 1.05, 1.25)), ((.75, 1.95, .35), (.85, .7, .85)), ((-.6, 2.05, -.35), (.8, .72, .8))], 1.9),
                           ('Tree_Round_B', [((0, 2.6, 0), (1.15, 1.0, 1.1)), ((-.55, 2.15, .45), (.75, .66, .75)), ((.5, 2.95, -.3), (.62, .55, .6))], 2.1)]:
        k = Kit(name, rng)
        lean = rng.uniform(-.12, .12)
        k.tube([(0, 0, 0), (lean * .3, h * .45, 0), (lean, h * .8, .05), (lean * 1.2, h, 0)], [.2, .15, .12, .08], BARK_D, sides=6, tip=False, color_end=BARK)
        k.tube([(lean * .6, h * .62, 0), (.45, h * .85, .15), (.62, h * 1.0, .3)], [.07, .05, .03], BARK, sides=5)
        for i, (c, s) in enumerate(blobs):
            k.blob(c, s, mix(LEAF_MID, LEAF_WARM, .35 + .2 * i), subdiv=1, rough=.14, shade_top=(LEAF_LIGHT, .55))
        objs.append(k.finish())

    # ── 縦に伸びる木（2種類）：段の数・ずれ・垂れ方を変える ──────────────────
    for name, tiers, h in [('Tree_Tall_A', [(1.0, 1.25, 1.2), (1.8, 1.0, 1.05), (2.55, .75, .95), (3.25, .48, .9)], 3.9),
                           ('Tree_Tall_B', [(1.2, 1.05, 1.3), (2.05, .82, 1.1), (2.85, .55, 1.0)], 3.7)]:
        k = Kit(name, rng)
        k.tube([(0, 0, 0), (0, 1.2, .02), (.03, 2.4, 0)], [.17, .13, .08], BARK_D, sides=6, tip=False, color_end=BARK)
        for i, (y, r, th) in enumerate(tiers):
            off = ((rng.random() - .5) * .16, (rng.random() - .5) * .16)
            k.tier(y, r, th, mix(CONIFER, CONIFER_L, i / len(tiers) * .8), segs=11, droop=.16 + .05 * (len(tiers) - i), off=off)
        objs.append(k.finish())

    # ── 若木 ─────────────────────────────────────────────────────────
    k = Kit('Tree_Sapling_A', rng)
    k.tube([(0, 0, 0), (.05, .5, 0), (.02, .95, .04)], [.07, .05, .03], BARK, sides=5, tip=False)
    k.blob((.05, 1.1, 0), (.42, .38, .4), mix(LEAF_WARM, LEAF_LIGHT, .3), subdiv=1, rough=.16, shade_top=(LEAF_LIGHT, .4))
    k.blob((-.18, .85, .12), (.26, .24, .26), LEAF_WARM, subdiv=1, rough=.16)
    objs.append(k.finish())

    # ── 草のまとまり（3種類）：根元から外へ広がる葉。どの向きからも葉が見える ──
    for name, n, h, base_col, tip in [('Grass_A', 9, .42, GRASS, GRASS_TIP), ('Grass_B', 7, .3, GRASS_BLUE, GRASS_TIP), ('Grass_C', 8, .36, GRASS_DRY, lin(0xd9d79a))]:
        k = Kit(name, rng)
        for i in range(n):
            a = i / n * math.tau + rng.random() * .5
            k.blade(((rng.random() - .5) * .12, 0, (rng.random() - .5) * .12), a, .12 + rng.random() * .14, h * (.7 + rng.random() * .45), .035, base_col, tip)
        objs.append(k.finish())

    # ── 花のまとまり（3種類）：茎と葉の上に、平たい花 ─────────────────────
    for name, petal, centre in [('Flowers_A', lin(0xfff6e2), lin(0xf2c14e)), ('Flowers_B', lin(0xf6b3a8), lin(0xffe7a1)), ('Flowers_C', lin(0xaed6f0), lin(0xfff3cf))]:
        k = Kit(name, rng)
        for i in range(5):
            a = i / 5 * math.tau + rng.random() * .6
            k.blade((math.cos(a) * .06, 0, math.sin(a) * .06), a, .1, .26, .03, GRASS, GRASS_TIP)
        for i in range(4):
            a = i / 4 * math.tau + rng.random()
            r = .08 + rng.random() * .1
            x, z, y = math.cos(a) * r, math.sin(a) * r, .22 + rng.random() * .14
            k.tube([(x * .4, 0, z * .4), (x, y, z)], [.012, .01], GRASS, sides=3, tip=False)
            k.flower((x, y, z), .07 + rng.random() * .025, petal, centre)
        objs.append(k.finish())

    # ── 低い茂み（2種類）─────────────────────────────────────────────
    for name, parts in [('Bush_A', [((0, .3, 0), (.55, .38, .5)), ((.42, .24, .18), (.36, .28, .34)), ((-.38, .22, -.1), (.34, .26, .32))]),
                        ('Bush_B', [((0, .26, 0), (.48, .3, .42)), ((-.3, .2, .28), (.3, .22, .28))])]:
        k = Kit(name, rng)
        for i, (c, s) in enumerate(parts):
            k.blob(c, s, mix(LEAF_DEEP, LEAF_MID, .3 + .25 * i), subdiv=1, rough=.16, flat_base=0.0, shade_top=(LEAF_LIGHT, .35))
        objs.append(k.finish())

    # ── 岩（小石・中くらい2・立ち石2）：底は平ら、上に少し苔 ─────────────────
    k = Kit('Rock_Pebbles', rng)
    for (x, z, s) in [(0, 0, .16), (.22, .1, .11), (-.15, .16, .09)]:
        k.blob((x, s * .35, z), (s, s * .6, s * .85), ROCK, subdiv=0, rough=.2, flat_base=0.0)
    objs.append(k.finish())
    for name, size in [('Rock_Medium_A', (.62, .45, .52)), ('Rock_Medium_B', (.5, .36, .6))]:
        k = Kit(name, rng)
        k.blob((0, size[1] * .55, 0), size, mix(ROCK, ROCK_D, rng.random()), subdiv=1, rough=.22, flat_base=0.0, shade_top=(MOSS, .55))
        objs.append(k.finish())
    for name, h in [('Stone_Standing_A', 1.2), ('Stone_Standing_B', .85)]:
        k = Kit(name, rng)
        k.blob((0, h * .5, 0), (.4, h * .55, .32), RUIN, subdiv=1, rough=.17, flat_base=0.0, shade_top=(MOSS, .4))
        objs.append(k.finish())

    # ── 小さな祠（ミッション地点）：原点＝結晶の真下。入口は手前（+z）、右奥（根の門の方向）は出口 ──
    # 黄色い輪（半径0.9）は、低い円形の石の台（半径1.22）にはめこまれて見える高さ。結晶は石の受け皿の上に浮かぶ
    k = Kit('Shrine', rng)
    k.slab((0, 0, 0), (1.22, .045, 1.22), .2, mix(RUIN, MOSS, .12), segs=16, rough=.03)
    ENTRANCE, EXIT = 90, 312                     # 度（x＝右、z＝手前。入口は手前、出口は根の門の方向）
    def away(ang, center, width):
        d = abs((ang - center + 180) % 360 - 180)
        return d > width
    for i in range(14):                          # 台のふちの石（入口と出口はあける）
        ang = i * 360 / 14 + 6
        if not (away(ang, ENTRANCE, 26) and away(ang, EXIT, 26)): continue
        a = math.radians(ang)
        k.slab((math.cos(a) * 1.33, -.01, math.sin(a) * 1.33), (.17, .085, .12), a, mix(RUIN_D, RUIN, rng.random() * .5), segs=6, rough=.15)
    # 結晶の受け皿：低い柱と、浅い皿（結晶は皿の上に浮かぶ）
    k.slab((0, .045, 0), (.24, .5, .24), .3, RUIN_D, segs=8, rough=.06)
    k.slab((0, .545, 0), (.36, .07, .36), .1, RUIN, segs=10, rough=.04)
    # 立ち石：左から奥へ、結晶の方へ少し傾いた弧。出口（右奥）と入口（手前）はあける
    for (ang, r, h, w) in [(150, 2.15, .75, .3), (178, 2.3, 1.05, .34), (205, 2.35, 1.3, .36), (232, 2.4, 1.55, .38), (258, 2.35, 1.4, .36), (282, 2.25, 1.0, .32), (30, 2.2, .55, .26)]:
        a = math.radians(ang)
        x, z = math.cos(a) * r, math.sin(a) * r
        lean = .18 + rng.random() * .1
        k.tube([(x, -.05, z), (x - math.cos(a) * lean * .45, h * .55, z - math.sin(a) * lean * .45), (x - math.cos(a) * lean, h, z - math.sin(a) * lean)],
               [w, w * .92, w * .55], mix(RUIN, RUIN_D, rng.random() * .6), sides=6, color_end=mix(RUIN, MOSS, .35))
    # 石畳：入口から台へ、台から出口（根の門の方向）へ。半分草に埋もれる
    for (x, z, sz, yaw) in [(-.1, 2.9, .3, .3), (.2, 2.25, .28, 1.1), (-.15, 1.65, .26, 2.0)] + \
            [(math.cos(math.radians(EXIT)) * r + (rng.random() - .5) * .25, math.sin(math.radians(EXIT)) * r, .27, rng.random() * 3) for r in (1.75, 2.35, 2.95, 3.55)]:
        k.slab((x, -.02, z), (sz, .05, sz * .8), yaw, mix(RUIN, MOSS, .2), segs=6, rough=.18)
    objs.append(k.finish())

    # ── 秘密の根の門（閉じた状態）：根の柱が左右に立ち、上を根の弧が結ぶ。真ん中の通り道を細い根が交差してふさぐ ──
    # 左右は根元（柱の足もと）が回転の中心。Part 2 で、左右を外へ回すと通り道があく
    def pillar(k, height, strands, lean, phase):
        for j in range(strands):
            pts, radii = [], []
            for i in range(9):
                t = i / 8
                ang = phase + j * math.tau / strands + t * 2.3
                pts.append((math.cos(ang) * .2 + lean * t, t * height, math.sin(ang) * .2))
                radii.append(.21 - .09 * t)
            k.tube(pts, radii, ROOT, sides=6, tip=False, color_end=ROOT_L)
        # 地面へもぐる太い根（外・前・後ろへ）
        for (dx, dz) in [(-.9, .45), (-.7, -.6), (.15, .95), (.2, -.9)]:
            k.tube([(0, .55, 0), (dx * .5, .3, dz * .5), (dx, .05, dz), (dx * 1.25, -.3, dz * 1.25)], [.17, .13, .09, .05], ROOT_L, sides=6)
        k.blob((0, .25, 0), (.42, .32, .4), ROOT_L, subdiv=1, rough=.2, flat_base=-0.05, shade_top=(ROOT_MOSS, .45))

    def crossing(k, sign, pairs):
        # 柱から反対側の柱へ渡る細い根（通り道をふさぐ）
        for (y0, y1, z0) in pairs:
            span = 2.75
            k.tube([(sign * .12, y0, z0), (sign * span * .35, y0 + (y1 - y0) * .35 + .15, z0 + .08), (sign * span * .7, y0 + (y1 - y0) * .7 + .1, z0 - .06), (sign * span, y1, z0)],
                   [.075, .065, .055, .04], ROOT_L, sides=5)

    k = Kit('RootGate_Left', rng)                 # 左の柱（根元が回転の中心）
    pillar(k, 3.0, 3, .1, 0.4)
    crossing(k, 1, [(.75, 2.05, .06), (1.95, 1.05, -.05)])
    objs.append(k.finish(location=(-1.35, 0, 0)))
    k = Kit('RootGate_Right', rng)                # 右の柱：少し細く、少し外へ傾く（左右対称にしない）
    pillar(k, 3.25, 2, -.18, 1.7)
    crossing(k, -1, [(1.05, 2.4, .02), (2.3, .7, -.07)])
    objs.append(k.finish(location=(1.45, 0, 0)))
    k = Kit('RootGate_Top', rng)                  # 上：2本の柱の頭を結ぶ根の弧と、通り道へ垂れる細い根
    for (lift, zo, r0) in [(0, 0, .17), (.22, .12, .13), (-.12, -.14, .11)]:
        k.tube([(-1.4, 2.75 + lift * .3, zo), (-.8, 3.45 + lift, zo - .05), (0, 3.7 + lift, zo + .04), (.85, 3.5 + lift * .8, zo), (1.35, 2.95 + lift * .3, zo)],
               [r0, r0 * .9, r0 * .85, r0 * .9, r0], ROOT, sides=6, tip=False, color_end=ROOT_L)
    for (x, l) in [(-.55, .55), (.1, .8), (.6, .45)]:
        k.tube([(x, 3.55, .02), (x + .05, 3.55 - l * .5, .05), (x - .03, 3.55 - l, 0)], [.05, .04, .02], ROOT_L, sides=4)
    k.blob((-.5, 3.75, 0), (.5, .26, .36), ROOT_MOSS, subdiv=1, rough=.2)
    k.blob((.75, 3.6, .05), (.36, .22, .3), mix(ROOT_MOSS, LEAF_MID, .4), subdiv=1, rough=.2)
    objs.append(k.finish(location=(0, 0, 0)))

    # ── ことばの樹：太い二本の幹がねじれて昇り、高いところで枝が大きく広がる。樹冠は離れた葉のかたまりの集まり ──
    k = Kit('WordTree', rng)
    for ph in (0, math.pi):
        pts, radii = [], []
        for i in range(13):
            t = i / 12
            a = ph + t * 3.0
            r = .7 * (1 - t) + .16
            pts.append((math.cos(a) * r, t * 7.0, math.sin(a) * r)); radii.append(.78 * (1 - t) + .24)
        k.tube(pts, radii, WT_BARK, sides=8, tip=False, color_end=WT_BARK_L)
    for ang in (20, 110, 200, 290):              # 根の張り出し
        a = math.radians(ang)
        k.tube([(math.cos(a) * .5, .9, math.sin(a) * .5), (math.cos(a) * 1.3, .3, math.sin(a) * 1.3), (math.cos(a) * 1.9, -.2, math.sin(a) * 1.9)], [.38, .24, .1], WT_BARK, sides=6)
    BR = [(0, 6.6, 4.4, 1.6), (65, 6.2, 3.9, 2.3), (130, 6.8, 4.6, 1.2), (195, 6.0, 4.2, 2.6), (255, 6.7, 4.0, 1.8), (320, 6.4, 3.6, 2.9)]
    tips = []
    for (ang, y0, reach, rise) in BR:
        a = math.radians(ang)
        dx, dz = math.cos(a), math.sin(a)
        p = [(dx * .35, y0, dz * .35), (dx * reach * .45, y0 + rise * .65, dz * reach * .45), (dx * reach, y0 + rise, dz * reach)]
        k.tube(p, [.32, .2, .08], WT_BARK, sides=6, color_end=WT_BARK_L)
        tips.append(p[-1])
    for i, (x, y, z) in enumerate(tips):
        k.blob((x, y + .5, z), (1.65, 1.0, 1.5), mix(WT_LEAF, WT_LEAF_L, .35 + .08 * (i % 3)), subdiv=1, rough=.16, shade_top=(WT_LEAF_L, .9))
        k.blob((x * .78 + .3, y + 1.1, z * .78), (1.0, .7, .95), mix(WT_LEAF, WT_LEAF_L, .55), subdiv=1, rough=.18, shade_top=(WT_LEAF_L, .7))
    k.blob((0, 9.9, 0), (1.5, .9, 1.4), mix(WT_LEAF, WT_LEAF_L, .45), subdiv=1, rough=.15, shade_top=(WT_LEAF_L, .9))
    objs.append(k.finish())
    # 光の実：同じ形を共有する5つ。樹冠の下に輪の形で並び、どの方向からも3つ前後がまとまって見える
    fk = Kit('WordTree_Fruit', rng)
    fk.blob((0, 0, 0), (.3, .36, .3), FRUIT, subdiv=1, rough=.04)
    fruit = fk.finish()
    fruit.name = 'WordTree_Fruit_01'
    ring = [(math.cos(math.radians(a)) * 2.5, 6.55 + .25 * (i % 2), math.sin(math.radians(a)) * 2.5) for i, a in enumerate((15, 87, 159, 231, 303))]
    fruit.location = P(*ring[0])
    for i in range(1, 5):
        o = fruit.copy()                    # メッシュは共有（GLB の中でも1つ）
        o.name = 'WordTree_Fruit_%02d' % (i + 1)
        o.location = P(*ring[i])
        bpy.context.scene.collection.objects.link(o)

    # ── ことばのタネ（Part 2 で使う。今回は世界に置かない）──
    # 自分の言葉から生まれた小さな命の種：金色の実（芽がひとつ）と、外側の薄い水色の光。ヒロリの手に収まる大きさ（高さ約0.2m）
    # 「WordSeed」は入れ物（形なし）。中身の「WordSeed_Core」と「WordSeed_Glow」を、Part 2 で一緒に動かす
    seed_root = bpy.data.objects.new('WordSeed', None)
    bpy.context.scene.collection.objects.link(seed_root)
    k = Kit('WordSeed_Core', rng)
    k.blob((0, .07, 0), (.055, .075, .055), SEED_GOLD, subdiv=1, rough=.05, shade_top=(SEED_CREAM, .6))
    k.blob((0, .125, 0), (.03, .03, .03), SEED_GOLD, subdiv=0, rough=.05)
    k.blade((0, .14, 0), .6, .04, .07, .022, LEAF_WARM, LEAF_LIGHT, segs=2)
    k.blade((0, .14, 0), 3.7, .03, .055, .018, LEAF_WARM, LEAF_LIGHT, segs=2)
    core = k.finish(); core.parent = seed_root
    k = Kit('WordSeed_Glow', rng)
    k.blob((0, .08, 0), (.1, .12, .1), SEED_GLOW, subdiv=1, rough=.02)
    glow = k.finish(); glow.parent = seed_root
    return objs


def export():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build_all()
    os.makedirs(OUT_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format='GLB', use_selection=False,
        export_cameras=False, export_lights=False, export_animations=False, export_extras=False,
        export_materials='NONE', export_vertex_color='ACTIVE', export_active_vertex_color_when_no_material=True,
        export_normals=True, export_tangents=False, export_yup=True, export_apply=True,
        export_draco_mesh_compression_enable=False, export_meshopt_compression_enable=False)
    data = open(GLB, 'rb').read()
    nodes = []
    for o in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        if o.data is None:                     # 入れ物（ことばのタネの親）。形は子のノードにある
            nodes.append({'name': o.name, 'triangles': 0, 'type': 'group', 'children': sorted(c.name for c in o.children)})
            continue
        o.data.calc_loop_triangles()
        nodes.append({'name': o.name, 'triangles': len(o.data.loop_triangles)})
    manifest = {
        'name': 'TOMORI World V2 kit',
        'generator': 'tools/world-v2/generate_tomori_world.py (Blender %s)' % bpy.app.version_string,
        'seed': SEED,
        'files': [{'path': 'assets/world-v2/tomori-world-kit.glb', 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                   'format': 'glTF 2.0 binary', 'textures': 0, 'external_uris': 0}],
        'nodes': nodes,
        'external_assets': 0,
        'not_placed_yet': ['WordSeed', 'WordSeed_Core', 'WordSeed_Glow'],   # ことばのタネ：Part 2 で表示・取得・移動する

        'license': 'TOMORI original: generated for TOMORI by this script. No third-party, redistributed or Craftopia assets.',
    }
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2); f.write('\n')
    with open(os.path.join(OUT_DIR, 'LICENSE.txt'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('TOMORI World V2 kit (assets/world-v2/)\n\n'
                'tomori-world-kit.glb is original 3D content generated for TOMORI by\n'
                'tools/world-v2/generate_tomori_world.py with Blender (no textures, vertex colors only).\n\n'
                'External assets used: 0\n'
                'Third-party, redistributed, downloaded or Craftopia assets: 0\n\n'
                'TOMORI のために、このリポジトリのスクリプトで生成した独自素材です。\n'
                '外部素材・再配布素材・第三者素材・クラフトピアの素材は使っていません。\n')
    print('WORLD_V2_EXPORTED', len(data), manifest['files'][0]['sha256'])
    for n in nodes:
        print('NODE', n['name'], n['triangles'])


export()

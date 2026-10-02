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
WT_BARK = lin(0x8a7563); WT_BARK_L = lin(0xa8957f); WT_LEAF = lin(0x6fb59a); WT_LEAF_L = lin(0xa9dcc4)
FRUIT = lin(0xfff3cf)


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

    # ── 小さな祠（ミッション地点）：原点＝結晶の真下。入口は手前（+z 側）、右奥は根の門への出口 ──
    k = Kit('Shrine', rng)
    # 台座と光の受け皿（結晶の輪の内側に収まる大きさ）
    k.slab((0, 0, 0), (.62, .1, .62), 0, RUIN_D, segs=10, rough=.04)
    k.slab((0, .1, 0), (.46, .05, .46), .3, RUIN, segs=10, rough=.04)
    # 立ち石：奥と左に弧。高さ・太さ・傾きを不揃いに。手前と右奥は空ける
    for (ang, r, h, w) in [(200, 2.2, .8, .36), (235, 2.35, 1.1, .42), (262, 2.25, 1.35, .44), (292, 2.4, .95, .38), (160, 2.3, .55, .34), (20, 2.25, .5, .3)]:
        a = math.radians(ang)
        x, z = math.cos(a) * r, math.sin(a) * r
        tilt = (rng.random() - .5) * .12
        k.blob((x + tilt, h * .48, z), (w, h * .55, w * .8), mix(RUIN, RUIN_D, rng.random() * .6), subdiv=1, rough=.17, flat_base=0.0, shade_top=(MOSS, .35))
    # 草に半分埋もれた石畳：入口（手前）から台座へ、右奥の出口へ
    for (x, z, s, yaw) in [(-.1, 2.4, .32, .3), (.25, 1.75, .28, 1.1), (-.35, 1.25, .26, 2.0), (1.05, -1.1, .27, .7), (1.55, -1.65, .3, 1.6), (2.05, -2.15, .26, .2), (-1.4, .9, .24, 1.2), (1.45, .7, .25, .4)]:
        k.slab((x, -.02, z), (s, .05, s * .8), yaw, mix(RUIN, MOSS, .2), segs=6, rough=.18)
    objs.append(k.finish())

    # ── 秘密の根の門（閉じた状態）：左・右・上の3つ。左右は根元を回転の中心にしてあり、Part 2 で開ける ──
    def root_bundle(k, side):
        s = 1 if side == 'R' else -1
        # 根元の太い根株
        k.blob((0, .35, 0), (.55, .55, .5), ROOT_L, subdiv=1, rough=.18, flat_base=0.0, shade_top=(ROOT_MOSS, .5))
        for i in range(5):
            y0 = .2 + i * .18
            reach = 1.55 + rng.random() * .35
            up = .9 + i * .38 + rng.random() * .25
            sway = (rng.random() - .5) * .35
            pts = [(0, y0, sway * .2), (-s * .35, y0 + .35, sway), (-s * reach * .6, up * .8, sway * .6 + .1), (-s * reach, up, -sway * .5), (-s * (reach + .35), up - .25, .1)]
            k.tube(pts, [.17 - i * .015, .14, .11, .08, .05], ROOT, sides=6, color_end=ROOT_L)

    for side, x in [('L', -1.55), ('R', 1.55)]:
        k = Kit('RootGate_' + ('Left' if side == 'L' else 'Right'), rng)
        root_bundle(k, side)
        objs.append(k.finish(location=(x, 0, 0)))
    k = Kit('RootGate_Top', rng)
    for i in range(4):
        y = 2.45 + i * .12
        sw = (rng.random() - .5) * .3
        k.tube([(-1.9, y - .4, sw), (-.9, y + .15, -sw), (0, y + .05 + rng.random() * .2, sw), (.95, y + .2, -sw * .5), (1.9, y - .35, sw)], [.13, .12, .11, .12, .13], ROOT, sides=6, tip=False, color_end=ROOT_L)
    k.blob((-.4, 2.85, 0), (.45, .3, .35), ROOT_MOSS, subdiv=1, rough=.2)
    k.blob((.6, 2.95, .05), (.35, .25, .3), mix(ROOT_MOSS, LEAF_MID, .4), subdiv=1, rough=.2)
    objs.append(k.finish(location=(0, 0, 0)))

    # ── ことばの樹：二本の幹がねじれて昇り、枝が広がり、葉のかたまりの間に空間がある ──
    k = Kit('WordTree', rng)
    for ph in (0, math.pi):
        pts, radii = [], []
        for i in range(11):
            t = i / 10
            a = ph + t * 2.4
            r = .55 * (1 - t) + .12
            pts.append((math.cos(a) * r, t * 6.2, math.sin(a) * r)); radii.append(.62 * (1 - t) + .2)
        k.tube(pts, radii, WT_BARK, sides=8, tip=False, color_end=WT_BARK_L)
    BR = [(0, 6.0, 3.8, 1.3), (70, 5.6, 3.3, 1.9), (140, 6.2, 3.9, 1.0), (205, 5.4, 3.5, 2.2), (275, 6.1, 3.6, 1.5), (330, 5.8, 2.9, 2.6)]
    tips = []
    for (ang, y0, reach, rise) in BR:
        a = math.radians(ang)
        dx, dz = math.cos(a), math.sin(a)
        p = [(dx * .3, y0, dz * .3), (dx * reach * .45, y0 + rise * .6, dz * reach * .45), (dx * reach, y0 + rise, dz * reach)]
        k.tube(p, [.26, .16, .07], WT_BARK, sides=6, color_end=WT_BARK_L)
        tips.append(p[-1])
    for i, (x, y, z) in enumerate(tips):
        k.blob((x * .95, y + .45, z * .95), (1.75, 1.1, 1.6), mix(WT_LEAF, WT_LEAF_L, .15 + .1 * (i % 3)), subdiv=1, rough=.16, shade_top=(WT_LEAF_L, .5))
        k.blob((x * .6, y + .2, z * .6), (1.1, .8, 1.0), WT_LEAF, subdiv=1, rough=.18)
    k.blob((0, 8.3, 0), (1.9, 1.25, 1.8), WT_LEAF, subdiv=1, rough=.15, shade_top=(WT_LEAF_L, .55))
    objs.append(k.finish())
    # 光の実：同じ形を共有する5つのノード。枝先の葉のかたまりの下にぶら下がる
    fk = Kit('WordTree_Fruit', rng)
    fk.blob((0, 0, 0), (.2, .24, .2), FRUIT, subdiv=1, rough=.04)
    fruit = fk.finish()
    fruit.name = 'WordTree_Fruit_01'
    fruit.location = P(tips[0][0] * .9, tips[0][1] - .35, tips[0][2] * .9)
    for i in range(1, 5):
        o = fruit.copy()                    # メッシュは共有（GLB の中でも1つ）
        o.name = 'WordTree_Fruit_%02d' % (i + 1)
        x, y, z = tips[i]
        o.location = P(x * .9, y - .35, z * .9)
        bpy.context.scene.collection.objects.link(o)
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

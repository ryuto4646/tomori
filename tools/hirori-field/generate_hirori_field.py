# Field ヒロリ（探索用の低ポリ・静止・リグなし）を、Blender のスクリプトだけで作る（Step 11L-A）
# 2.5頭身：頭（あごから頭頂）が全高の約40%。少ない面で、とさか・羽・顔・足の特徴を強く見せる
# 実行: blender.exe --background --factory-startup --python tools/hirori-field/generate_hirori_field.py -- [--render] [--preview] [--out 撮影・.blend の置き場所]
# 出力: assets/hirori-field/hirori-field.glb（リポジトリ）。撮影画像・.blend・model-report.json は --out（リポジトリの外）
# 座標: Blender は Z が上、ヒロリは -Y（正面）を向く。glTF では +Y が上、+Z が正面になる（Three.js でそのまま正立）
import bpy, bmesh, math, os, sys, json, hashlib, struct
from mathutils import Vector, Matrix, kdtree

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = '--render' in ARGS
PREVIEW = '--preview' in ARGS
OUT = ARGS[ARGS.index('--out') + 1] if '--out' in ARGS else os.path.join(HERE, 'out')
RENDER_DIR = os.path.join(OUT, 'renders')
ASSET_DIR = os.path.join(REPO, 'assets', 'hirori-field')
SUF = ''

def lerp(a, b, t): return a + (b - a) * t
def V(*a): return Vector(a)
def smoothstep(a, b, x):
    k = min(1.0, max(0.0, (x - a) / (b - a))); return k * k * (3 - 2 * k)

# ── 形の数値（全高はとさかの先まで約1.0。原点は両足の中央・地面） ─────────────
# Step 11J-B：頭を大きく（幅 約+20%）、首は細い筒にせず頭から胴へ連続、胴は短く横にふっくら（洋梨形）、脚は短く
# 体（頭から腰まで1つのなめらかな形）の断面：高さ z ごとに、左右の半径・前の半径・後ろの半径・前後の中心
# ── 形の数値（Step 11L-A 修正：ひよこ型。丸い卵形の胴が頭より大きく、脚はほとんど見えない）──────────
# 胴は修正前より約12%横に広く、背も高い卵形。頭は修正前の頭を 0.82 倍にして、首（z=0.40 → 0.50）の上に置く
HEAD_K, NECK0, NECK1 = 0.78, 0.400, 0.490          # 頭の縮小率・修正前の首の高さ・修正後の首の高さ
def head_row(z, rx, ryF, ryB, yc):
    return (NECK1 + (z - NECK0) * HEAD_K, rx * HEAD_K, ryF * HEAD_K * 1.06, ryB * HEAD_K, yc * HEAD_K)   # 顔の側は少し深く
BODY = [  # z,     rx,    ryF,   ryB,   yc     （前は -y）
    (0.066, 0.046, 0.042, 0.038, 0.004),
    (0.080, 0.116, 0.106, 0.096, 0.002),
    (0.115, 0.166, 0.150, 0.136, 0.000),
    (0.170, 0.188, 0.168, 0.152, -0.004),     # 胴のいちばん広い所（幅 約0.38。頭の幅 約0.32 より広い）
    (0.240, 0.190, 0.172, 0.154, -0.008),
    (0.310, 0.182, 0.166, 0.148, -0.012),     # 胸：丸く前へ
    (0.375, 0.162, 0.150, 0.134, -0.015),
    (0.430, 0.136, 0.126, 0.112, -0.017),     # 肩：羽の付け根
    (0.470, 0.118, 0.110, 0.098, -0.018),
    (0.490, 0.112, 0.104, 0.094, -0.018),     # 首（短く太い。頭から胸へ段差なくつなぐ）
] + [head_row(*r) for r in [
    (0.428, 0.134, 0.114, 0.108, -0.024),
    (0.470, 0.168, 0.138, 0.134, -0.024),
    (0.530, 0.200, 0.160, 0.160, -0.022),     # 頬
    (0.590, 0.206, 0.164, 0.168, -0.020),
    (0.650, 0.196, 0.158, 0.166, -0.018),
    (0.710, 0.168, 0.138, 0.148, -0.016),
    (0.760, 0.122, 0.100, 0.110, -0.014),
    (0.792, 0.066, 0.056, 0.060, -0.012),
    (0.806, 0.026, 0.022, 0.024, -0.012),
]]
BODY_BOTTOM, BODY_TOP = 0.066, BODY[-1][0] + 0.004
# クリーム色：胸・おなかの卵形と、顔（目のまわり）。顔の範囲は、修正前の顔を頭と同じ割合で縮めた位置
hz = lambda z: NECK1 + (z - NECK0) * HEAD_K
CREAM_SIDE = [(0.150, 0), (0.175, 24), (0.220, 33), (0.280, 35), (0.340, 31), (0.390, 24), (0.440, 17), (0.470, 16), (hz(0.410), 24), (hz(0.440), 26),
              (hz(0.480), 33), (hz(0.530), 39), (hz(0.590), 42), (hz(0.640), 40), (hz(0.672), 34), (hz(0.700), 24)]
def cream_top(a):
    return hz(0.700) - 0.026 * HEAD_K * math.exp(-(a / 0.30) ** 2)      # 額の上端：まんなかで浅く下がるハート形
EYE_K, CREST_K = 0.72, 0.50                         # 目の縮小率・とさかの縮小率（根もとを中心に）
P = dict(
    head_c=(0.0, -0.020 * HEAD_K, hz(0.600)),
    shoulder_x=0.145, shoulder_y=0.004, shoulder_z=0.420,
    wing_len=0.430, wing_w=0.138, wing_back_deg=8.0, wing_face_deg=40.0, wing_open_min=14.0, wing_open_max=18.0,   # Step 11L-B：羽先が足の横から地面近くまで届く長さ（約1.9倍）・幅は約1.2倍。外へ14〜18°
    leg_x=0.056, hip_z=0.110, ankle_z=0.040, leg_r_top=0.046, leg_r_bot=0.036,     # 脚の上はおなかの中。見える長さは修正前の約半分
    foot_len=0.148, foot_w=0.094, foot_h=0.050, foot_out_deg=8.0,                  # 足は修正前の約88%（3本指・しっかり踏む）
    eye_x=0.086 * HEAD_K * 0.92 * 0.85, eye_z=hz(0.592), eye_r=(0.01935, 0.008, 0.01935), eye_proud=0.0068,   # 目の直径は前の50%（正円）
    crest_len=tuple(v * CREST_K for v in (0.235, 0.200, 0.168, 0.136)), crest_w=tuple(v * CREST_K for v in (0.080, 0.070, 0.060, 0.050)),
    crest_t=tuple(v * CREST_K for v in (0.104, 0.090, 0.076, 0.062)),
    crest_root_deg=(-4.0, 18.0, 40.0, 62.0), crest_dir_deg=(36.0, 62.0, 88.0, 114.0), crest_bend=0.34,
)
COL = dict(  # sRGB の16進（Blender にはリニアにして渡す）
    coral=0xEE8471, cream=0xF7EBDB, blue=0xBCCAEA, eye_out=0x2A160E, iris=0x8C5228, pupil=0x0D0705, hilite=0xFFFFFF,

)

def lin(hexv):
    def ch(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (ch((hexv >> 16) & 255), ch((hexv >> 8) & 255), ch(hexv & 255), 1.0)

def interp_table(tab, z, col):
    """表の行を、なめらか（Catmull-Rom）に補間する"""
    zs = [r[0] for r in tab]
    if z <= zs[0]: return tab[0][col]
    if z >= zs[-1]: return tab[-1][col]
    i = max(k for k in range(len(zs) - 1) if zs[k] <= z)
    t = (z - zs[i]) / (zs[i + 1] - zs[i])
    p0 = tab[max(i - 1, 0)][col]; p1 = tab[i][col]; p2 = tab[i + 1][col]; p3 = tab[min(i + 2, len(tab) - 1)][col]
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)

def table_lin(tab, z):
    zs = [r[0] for r in tab]
    if z <= zs[0]: return tab[0][1]
    if z >= zs[-1]: return tab[-1][1]
    i = max(k for k in range(len(zs) - 1) if zs[k] <= z)
    return lerp(tab[i][1], tab[i + 1][1], (z - zs[i]) / (zs[i + 1] - zs[i]))

def cream_f(a, z):
    """クリーム色の内側なら正、外側なら負（単位はおよそメートル）。a は正面からの角度、z は高さ"""
    if z < CREAM_SIDE[0][0]: return -0.05
    rx = interp_table(BODY, z, 1)
    side = (math.radians(table_lin(CREAM_SIDE, z)) - abs(a)) * rx
    return min(side, cream_top(a) - z)

# ── 準備 ──────────────────────────────────────────────────────────────
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0   # .blend1（自動の控え）を作らない
scene = bpy.context.scene
col = scene.collection

def material(name, color, rough=0.82, sheen=0.35, vcol=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = lin(color)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = 0.0
    if 'Specular IOR Level' in b.inputs: b.inputs['Specular IOR Level'].default_value = 0.25
    if sheen and 'Sheen Weight' in b.inputs:
        b.inputs['Sheen Weight'].default_value = sheen
        b.inputs['Sheen Roughness'].default_value = 0.6
    if vcol:
        a = nt.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Col'
        nt.links.new(a.outputs['Color'], b.inputs['Base Color'])
    return m

MAT = dict(
    coral=material('MAT_Coral', COL['coral']),
    cream=material('MAT_Cream', COL['cream']),
    blue=material('MAT_SoftBlue', COL['blue']),
    eye=material('MAT_Eye', 0xFFFFFF, rough=0.3, sheen=0.0, vcol=True),
)

def link(obj, parent=None):
    col.objects.link(obj)
    if parent: obj.parent = parent
    return obj

def mesh_obj(name, bm, mats, origin=(0, 0, 0), parent=None, smooth=True):
    """bmesh（ワールド座標）から、原点を origin（回転・変形の中心）に置いたオブジェクトを作る"""
    me = bpy.data.meshes.new(name)
    # 四角形は、ここで決まった向きに三角形へ分けておく（書き出しのたびに分け方が変わらないように）
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3], quad_method='FIXED', ngon_method='EAR_CLIP')
    bmesh.ops.translate(bm, verts=bm.verts, vec=-Vector(origin))
    bm.to_mesh(me); bm.free()
    for m in mats: me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    ob.location = origin
    link(ob, parent)
    for p in me.polygons: p.use_smooth = smooth
    return ob

def metaball_mesh(name, elems, res):
    """メタボール（いくつかの楕円体をなめらかにつないだ形）を、bmesh にして返す。表面は 0.575×半径×size の位置"""
    mb = bpy.data.metaballs.new(name + '_MB'); mb.resolution = res; mb.render_resolution = res; mb.threshold = 0.6
    R = 1.0 / 0.575
    for (c, r) in elems:
        e = mb.elements.new(); e.type = 'ELLIPSOID'; e.co = c; e.radius = R
        e.size_x, e.size_y, e.size_z = r
    ob = bpy.data.objects.new(name + '_MB', mb); col.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = ob.evaluated_get(dg).to_mesh()
    bm = bmesh.new(); bm.from_mesh(me)
    ob.evaluated_get(dg).to_mesh_clear()
    bpy.data.objects.remove(ob); bpy.data.metaballs.remove(mb)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    return bm

def decimate_to(ob, target_tris):
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    if tris <= target_tris: return
    mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = target_tris / tris; mod.use_collapse_triangulate = True
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier='dec')

root = link(bpy.data.objects.new('Hirori_Root', None))

# ── 体：頭・首・胴・腰を、断面をつないだ1つのなめらかな形にする ─────────────────
# クリーム色との境目は、境目の線の近くの頂点を線の上へ動かしてから分ける（ギザギザにしない・段差もない）
FACE_EYE_LOW, FACE_TIP, FACE_CHIN = hz(0.552), hz(0.537), hz(0.497)   # 目の少し下・鼻先にあたる高さ・あご
def face_push(a, z):
    """顔の前へのふくらみ（正面のまんなかほど大きく、横へなめらかに消える）。鼻そのものではなく、顔の骨格の立体感"""
    c = math.cos(a)
    if c <= 0: return 0.0
    g = lambda u, s: math.exp(-(u / s) ** 2)
    fill = 0.005 * g(z - FACE_EYE_LOW, 0.026) * c ** 4          # 目の下：少しふっくら
    tip = 0.016 * g(z - FACE_TIP, 0.030) * c ** 8               # 鼻先にあたる所：頭の奥行きの約6%だけ、小さく丸く前へ
    chin = -0.004 * g(z - FACE_CHIN, 0.018) * c ** 4             # あご：鼻先より後ろへ戻す
    return fill + tip + chin

def body_xyz(a, z):
    rx, ryF, ryB, yc = (interp_table(BODY, z, c) for c in (1, 2, 3, 4))
    ry = ryF if math.cos(a) > 0 else ryB
    return V(rx * math.sin(a), yc - ry * math.cos(a) - face_push(a, z), z)

def build_body():
    C = 18                                       # 一周の点の数（低ポリ）（j=0 が正面、+ は体の左＝+X）
    zs = []
    for i in range(len(BODY) - 1):               # 表の行のあいだを分ける（頭と顔は細かく）
        z0, z1 = BODY[i][0], BODY[i + 1][0]
        n = max(1, round((z1 - z0) / (0.026 if z0 >= NECK1 else 0.040)))
        for k in range(n): zs.append(lerp(z0, z1, k / n))
    zs.append(BODY[-1][0])
    # 媒介変数（角度 a, 高さ z）の格子。境目をまたぐ辺ごとに、境目に近いほうの頂点を1つだけ、境目の線の上へ動かす
    # （左右対称：a >= 0 の側で決めて、右側は鏡にする）
    H = C // 2
    grid = [[[2 * math.pi * j / C, z] for j in range(H + 1)] for z in zs]   # a = 0..pi
    snapped = set()
    def solve(fn, lo, hi):
        flo = fn(lo)
        for _ in range(40):
            mid = (lo + hi) / 2; fm = fn(mid)
            if (fm > 0) == (flo > 0): lo, flo = mid, fm
            else: hi = mid
        return (lo + hi) / 2
    for i in range(1, len(zs) - 1):                       # 横向きの境目（頬・胸の両側）：同じ輪の中で角度を動かす
        z = zs[i]
        for j in range(H):
            a0, a1 = grid[i][j][0], grid[i][j + 1][0]
            if (cream_f(a0, z) > 0) != (cream_f(a1, z) > 0):
                ac = solve(lambda a: cream_f(a, z), a0, a1)
                k = j if abs(ac - a0) < abs(ac - a1) else j + 1
                if 0 < k < H and (i, k) not in snapped: grid[i][k][0] = ac; snapped.add((i, k))
    for j in range(1, H):                                 # 上向きの境目（額のハート形）：同じ列の中で高さを動かす
        for i in range(1, len(zs) - 2):
            a = grid[i][j][0]
            z0, z1 = grid[i][j][1], grid[i + 1][j][1]
            if (i, j) in snapped or (i + 1, j) in snapped: continue
            if (cream_f(a, z0) > 0) != (cream_f(a, z1) > 0):
                zc = solve(lambda z: cream_f(a, z), z0, z1)
                k = i if abs(zc - z0) < abs(zc - z1) else i + 1
                if 0 < k < len(zs) - 1: grid[k][j][1] = zc; snapped.add((k, j))
    full = []
    for i in range(len(zs)):
        row = []
        for j in range(C):
            if j <= H: a, z = grid[i][j]
            else: a, z = -grid[i][C - j][0], grid[i][C - j][1]
            row.append((a, z))
        full.append(row)
    snap_full = set(snapped) | {(i, C - j) for (i, j) in snapped}
    b = bmesh.new()
    rings = [[b.verts.new(body_xyz(a, z)) for (a, z) in row] for row in full]
    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(C):
            jn = (j + 1) % C
            a, bq, c, d = r0[j], r0[jn], r1[jn], r1[j]
            pa = [full[i][j], full[i][jn], full[i + 1][jn], full[i + 1][j]]
            # 境目の点が対角にあれば、その対角で三角形に分ける（境目を辺にのせる）。それ以外は左右対称に
            if (i, j) in snap_full and (i + 1, jn) in snap_full: idxs = ((0, 1, 2), (0, 2, 3))
            elif (i, jn) in snap_full and (i + 1, j) in snap_full: idxs = ((0, 1, 3), (1, 2, 3))
            else: idxs = ((0, 1, 2), (0, 2, 3)) if j < H else ((0, 1, 3), (1, 2, 3))
            vs = (a, bq, c, d)
            for idx in idxs:
                ca = sum(abs(pa[k][0]) for k in idx) / 3; cz = sum(pa[k][1] for k in idx) / 3
                f = b.faces.new([vs[k] for k in idx])
                f.material_index = 1 if cream_f(ca, cz) > 0 else 0
    for ring, z, up in ((rings[0], BODY_BOTTOM, False), (rings[-1], BODY_TOP, True)):
        pole = b.verts.new(V(0, interp_table(BODY, z, 4), z))
        for j in range(C):
            f = b.faces.new((ring[j], ring[(j + 1) % C], pole) if up else (ring[(j + 1) % C], ring[j], pole))
            f.material_index = 0
    bmesh.ops.remove_doubles(b, verts=b.verts, dist=1e-6)
    bmesh.ops.dissolve_degenerate(b, edges=b.edges, dist=1e-7)
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    return b

bm_all = build_body()
tmp = bpy.data.meshes.new('tmp'); bm_all.to_mesh(tmp)
for p in tmp.polygons: p.use_smooth = True
vnorm = {tuple(round(c, 6) for c in v.co): v.normal.copy() for v in tmp.vertices}
def split_part(keep_index, name, mat):
    b = bm_all.copy()
    bmesh.ops.delete(b, geom=[f for f in b.faces if f.material_index != keep_index], context='FACES')
    bmesh.ops.delete(b, geom=[v for v in b.verts if not v.link_faces], context='VERTS')
    for f in b.faces: f.material_index = 0
    ob = mesh_obj(name, b, [mat], (0, 0, 0), root)
    # 色の境目で陰影が折れないよう、分ける前の全体の法線を使う
    ob.data.normals_split_custom_set_from_vertices([vnorm[tuple(round(c, 6) for c in v.co)] for v in ob.data.vertices])
    return ob
body = split_part(0, 'Hirori_Body', MAT['coral'])
cream = split_part(1, 'Hirori_CreamPatch', MAT['cream'])
bm_all.free(); bpy.data.meshes.remove(tmp)

def inside_body(p, pad=0.0):
    """点が体の中（pad だけ外側まで）にあるか：断面の楕円で判定"""
    if p.z < BODY_BOTTOM or p.z > BODY_TOP: return False
    rx, ryF, ryB, yc = (interp_table(BODY, p.z, c) for c in (1, 2, 3, 4))
    dy = p.y - yc; ry = ryF if dy < 0 else ryB
    return (p.x / (rx + pad)) ** 2 + (dy / (ry + pad)) ** 2 < 1.0

def surface_point(origin, direction):
    """体の表面との交点（目・口・とさかの根元をのせる）"""
    best = None
    for ob in (body, cream):
        mw = ob.matrix_world; inv = mw.inverted()
        ok, loc, nor, idx = ob.ray_cast(inv @ origin, (inv.to_3x3() @ direction).normalized())
        if ok:
            w = mw @ loc
            if best is None or (w - origin).length < (best[0] - origin).length: best = (w, (mw.to_3x3() @ nor).normalized())
    return best

# ── 目：濃い茶色・暖かい茶色の虹彩・小さな黒い瞳孔（頂点色）＋小さなハイライト ─────
def ellipsoid_bm(r, segs=24, rings=16):
    """楕円体（輪を重ねて自分で作る。書き出すたびに同じファイルになるように）"""
    b = bmesh.new()
    top = b.verts.new(V(0, 0, r[2])); bot = b.verts.new(V(0, 0, -r[2]))
    rows = []
    for i in range(1, rings):
        th = math.pi * i / rings
        rows.append([b.verts.new(V(r[0] * math.sin(th) * math.cos(2 * math.pi * j / segs), r[1] * math.sin(th) * math.sin(2 * math.pi * j / segs), r[2] * math.cos(th))) for j in range(segs)])
    for j in range(segs):
        b.faces.new((top, rows[0][j], rows[0][(j + 1) % segs]))
        b.faces.new((bot, rows[-1][(j + 1) % segs], rows[-1][j]))
    for i in range(len(rows) - 1):
        for j in range(segs):
            b.faces.new((rows[i][j], rows[i + 1][j], rows[i + 1][(j + 1) % segs], rows[i][(j + 1) % segs]))
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    return b

def paint(b, fn):
    # 色は頂点ごとに持たせる（角ごとに持たせると、書き出しのたびに三角形の並びが変わり、同じファイルにならないため）
    lay = b.verts.layers.float_color.new('Col')
    for v in b.verts: v[lay] = fn(v.co)

def eye(side):
    nm = 'L' if side > 0 else 'R'
    hit = surface_point(V(side * P['eye_x'], -0.5, P['eye_z']), V(0, 1, 0))
    n = hit[1]; yaw = 0.35 * math.atan2(n.x, -n.y); pitch = 0.5 * math.atan2(n.z, math.hypot(n.x, n.y))   # ほぼ正面を向ける（左右の目が外を向かない）
    aim = Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Rotation(-pitch, 4, 'X')   # 顔の表面の向きにそろえる（外向き・上向きの傾きも）
    r = P['eye_r']
    center = hit[0] + aim @ V(0, r[1] - P['eye_proud'], 0)                     # 顔にうめ、前へ少しだけ出す
    b = ellipsoid_bm((r[0], r[2], r[1]), 20, 12)                                  # 奥行きの軸を極にして作り、正面（-Y）へ向ける
    bmesh.ops.rotate(b, verts=b.verts, cent=V(0, 0, 0), matrix=Matrix.Rotation(math.radians(90), 3, 'X'))
    out, iris, pupil = Vector(lin(COL['eye_out'])[:3]), Vector(lin(COL['iris'])[:3]), Vector(lin(COL['pupil'])[:3])
    def col_fn(co):
        d = Vector((co.x / r[0], co.z / r[2])).length if co.y < 0 else 2.0   # 正面（-Y）の中心からの距離
        if d < 0.70: c = pupil                    # 黒い瞳が主体。茶色は細い円の輪
        elif d < 0.80: c = iris
        else: c = out
        return (c.x, c.y, c.z, 1.0)
    paint(b, col_fn)
    bmesh.ops.transform(b, matrix=aim, verts=b.verts)
    bmesh.ops.translate(b, verts=b.verts, vec=center)
    ob = mesh_obj('Hirori_Eye_' + nm, b, [MAT['eye']], center, root)
    hb = ellipsoid_bm((0.0036, 0.0018, 0.0036), 8, 5)                          # ハイライト：瞳の上、少し外側（左右で同じ向き）
    paint(hb, lambda co: lin(COL['hilite']))
    hp = center + aim @ V(-0.0065 * EYE_K, -r[1] * 1.05, 0.009 * EYE_K)
    bmesh.ops.translate(hb, verts=hb.verts, vec=hp)
    mesh_obj('Hirori_EyeHighlight_' + nm, hb, [MAT['eye']], hp, root)
    return ob
eye(1); eye(-1)


# ── とさか：4枚。頭のまんなかの線（x=0）の上に、頭頂から後頭部へ前後に並ぶ ─────────
# Step 11J-B：棒・へらではなく、ふっくらした涙滴形（断面は楕円）。根元が太く、先へ薄くなり、先は丸い
def petal(i):
    hc = V(*P['head_c'])
    L, W, T = P['crest_len'][i], P['crest_w'][i], P['crest_t'][i]
    th = math.radians(P['crest_root_deg'][i]); ph = math.radians(P['crest_dir_deg'][i])
    hit = surface_point(hc, V(0, math.sin(th), math.cos(th)))
    root_p = hit[0] - V(0, math.sin(th), math.cos(th)) * 0.022 * CREST_K                    # 根元は頭の中へうめる（こぶを作らない）
    d0 = V(0, math.sin(ph), math.cos(ph))                                          # 出ていく向き（上→後ろ）
    nrm = V(0, math.cos(ph), -math.sin(ph))                                        # 面の中で、向きに直角（下・前側）
    S, C = 7, 8
    def width(t):
        if t < 0.58: return W * (0.34 + 0.66 * math.sin(math.pi * 0.5 * t / 0.58))
        return W * math.sqrt(max(0.0, 1 - ((t - 0.58) / 0.42) ** 2))
    def pos(t, a):
        bend = P['crest_bend'] * t * t * L                                         # 先へ行くほど後ろへそる
        center = root_p + d0 * (t * L) + nrm * (-bend * 0.35)
        w = width(t)                                                               # 涙滴：根元はやや細く、6割で最も広く、先は丸い
        tt = T * (1.0 - 0.22 * t) * (w / W) ** 0.8                                 # 厚みも同じ涙滴形で、先へ少しずつ薄く
        return center + nrm * (math.cos(a) * max(w, 0.002)) + V(1, 0, 0) * (math.sin(a) * max(tt, 0.0015))
    def blue(t, a):
        """両側面の楕円（内側の淡い水色）。正なら水色"""
        u = math.cos(a)
        su = 0.26 + 0.40 * min(1.0, max(0.0, (t - 0.15) / 0.55))     # 根元は細く、先へ向かって広がる涙滴（花びらの下側＝内側に寄せ、下の面まで回す）
        return 1.0 - ((t - 0.56) / 0.38) ** 2 - ((u - 0.52) / su) ** 2
    # 格子（t, a）。水色の楕円の境目に近い頂点を、境目の線の上へ動かす（ふちをギザギザにしない）
    grid = [[[k / S, 2 * math.pi * j / C] for j in range(C)] for k in range(S + 1)]
    snapped = set()
    def solve(fn, lo, hi):
        flo = fn(lo)
        for _ in range(40):
            mid = (lo + hi) / 2; fm = fn(mid)
            if (fm > 0) == (flo > 0): lo, flo = mid, fm
            else: hi = mid
        return (lo + hi) / 2
    for k in range(1, S):
        t = grid[k][0][0]
        for j in range(C):
            a0 = 2 * math.pi * j / C; a1 = 2 * math.pi * (j + 1) / C
            if (blue(t, a0) > 0) != (blue(t, a1) > 0):
                ac = solve(lambda a: blue(t, a), a0, a1)
                jj = j if abs(ac - a0) < abs(ac - a1) else (j + 1) % C
                if (k, jj) not in snapped: grid[k][jj][1] = ac if jj == j or ac < 2 * math.pi else ac - 2 * math.pi; snapped.add((k, jj))
    for j in range(C):
        for k in range(1, S - 1):
            if (k, j) in snapped or (k + 1, j) in snapped: continue
            a = grid[k][j][1]; t0, t1 = grid[k][j][0], grid[k + 1][j][0]
            if (blue(t0, a) > 0) != (blue(t1, a) > 0):
                tc = solve(lambda t: blue(t, a), t0, t1)
                kk = k if abs(tc - t0) < abs(tc - t1) else k + 1
                if 0 < kk < S: grid[kk][j][0] = tc; snapped.add((kk, j))
    b = bmesh.new()
    vv = [[b.verts.new(pos(t, a)) for (t, a) in row] for row in grid]
    rows = [(vv[k], k / S) for k in range(S + 1)]
    for k in range(S):
        for j in range(C):
            jn = (j + 1) % C
            q = (vv[k][j], vv[k][jn], vv[k + 1][jn], vv[k + 1][j]); pq = (grid[k][j], grid[k][jn], grid[k + 1][jn], grid[k + 1][j])
            if (k, j) in snapped and (k + 1, jn) in snapped: idxs = ((0, 1, 2), (0, 2, 3))
            elif (k, jn) in snapped and (k + 1, j) in snapped: idxs = ((0, 1, 3), (1, 2, 3))
            else: idxs = ((0, 1, 2), (0, 2, 3))
            for idx in idxs:
                ct = sum(pq[m][0] for m in idx) / 3
                ca = math.atan2(sum(math.sin(pq[m][1]) for m in idx), sum(math.cos(pq[m][1]) for m in idx))
                f = b.faces.new([q[m] for m in idx])
                f.material_index = 1 if blue(ct, ca) > 0 else 0   # 内側（下の面と両側面の下寄り）を淡い水色。上のふち・先・根元はサンゴ色
    tipc = b.verts.new(sum((v.co for v in rows[-1][0]), Vector()) / C)
    for j in range(C): b.faces.new((rows[-1][0][j], rows[-1][0][(j + 1) % C], tipc))
    basec = b.verts.new(sum((v.co for v in rows[0][0]), Vector()) / C)
    for j in range(C): b.faces.new((rows[0][0][(j + 1) % C], rows[0][0][j], basec))
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    return mesh_obj('Hirori_Crest_%02d' % (i + 1), b, [MAT['coral'], MAT['blue']], root_p, root, smooth=False)
for i in range(4): petal(i)

# ── 羽：休めた状態。肩から下・うしろへ流れ、胴に沿う細長い涙滴形。外側サンゴ色・内側（体のほう）淡い水色 ──
def wing_frame(side, open_deg):
    op, bk, fa = math.radians(open_deg), math.radians(P['wing_back_deg']), math.radians(P['wing_face_deg'])
    D = V(side * math.sin(op), math.sin(bk), -math.cos(op) * math.cos(bk)).normalized()     # 長さの向き：下・少し外・少しうしろ
    side_out = V(side, 0, 0)
    Out = (side_out * math.cos(fa) + V(0, 1, 0) * math.sin(fa))                                # 外側の面：外とうしろ
    Out = (Out - D * Out.dot(D)).normalized()
    X = D.cross(Out).normalized()
    return D, Out, X

def wing(side):
    nm = 'L' if side > 0 else 'R'
    L, Wm = P['wing_len'], P['wing_w']
    S, C = 7, 6
    sh = V(side * P['shoulder_x'], P['shoulder_y'], P['shoulder_z'])
    def shape(t, s):
        """羽の形：幅方向 s=-1..1、長さ方向 t=0..1 の点（ローカル：長さ=+Y、外側の面=+Z）"""
        if t < 0.58: w = Wm * (0.16 + 0.84 * math.sin(math.pi * 0.5 * t / 0.58) ** 1.1)
        else: w = Wm * math.sqrt(max(0.0, 1 - ((t - 0.58) / 0.42) ** 2))
        thick = (0.046 * (1 - 0.72 * t) + 0.008) * min(1.0, 0.45 + 0.55 * t / 0.25)   # 根元は厚く（付け根の端は丸める）、先は薄い
        e = math.sqrt(max(0.0, 1 - s * s))
        cup = 0.016 * (1 - s * s) * min(1.0, t * 2.5)                 # 内側が少しくぼむ
        bow = -0.030 * math.sin(math.pi * t)                          # 長さ方向にも軽く湾曲（内側がくぼむ向き）
        return s * w, thick * 0.5 * e + bow, -thick * 0.5 * e + cup * 0.8 + bow
    # 開く角度：体に当たらない、いちばん小さい角度（胴に沿わせる）
    open_deg = P['wing_open_min']
    while open_deg < P['wing_open_max']:
        D, Out, X = wing_frame(side, open_deg); ok = True
        for k in range(1, 11):
            t = k / 10
            for s in (-1, -0.5, 0, 0.5, 1):
                x, zt, zb = shape(t, s)
                p = sh - D * 0.02 + D * (t * L) + X * x + Out * zb
                if t > 0.30 and inside_body(p, 0.030): ok = False   # 羽の中ほどから先は、胴から少し離す
        if ok: break
        open_deg += 1.0
    D, Out, X = wing_frame(side, open_deg)
    b = bmesh.new(); top, bot = [], []
    for k in range(S + 1):
        t = k / S; rt, rb = [], []
        for j in range(C + 1):
            s = -1 + 2 * j / C
            x, zt, zb = shape(t, s)
            rt.append(b.verts.new(V(x, t * L, zt))); rb.append(b.verts.new(V(x, t * L, zb)))
        top.append(rt); bot.append(rb)
    for k in range(S):
        for j in range(C):
            b.faces.new((top[k][j], top[k][j + 1], top[k + 1][j + 1], top[k + 1][j])).material_index = 0
            g = b.faces.new((bot[k][j + 1], bot[k][j], bot[k + 1][j], bot[k + 1][j + 1]))
            t = (k + 0.5) / S; s = -1 + 2 * (j + 0.5) / C
            g.material_index = 1 if (0.16 < t < 0.90 and abs(s) < 0.70) else 0           # 水色のまわりにサンゴ色の縁を残す
    bmesh.ops.remove_doubles(b, verts=b.verts, dist=1e-6)
    for k in range(S):
        for j in (0, C):
            vs = [v for v in (top[k][j], top[k + 1][j], bot[k + 1][j], bot[k][j]) if v.is_valid]
            if len(set(vs)) >= 3:
                try: b.faces.new(vs).material_index = 0
                except ValueError: pass
    for j in range(C):
        for vs in ((top[0][j + 1], top[0][j], bot[0][j], bot[0][j + 1]), (top[S][j], top[S][j + 1], bot[S][j + 1], bot[S][j])):
            vs = [v for v in vs if v.is_valid]
            if len(set(vs)) >= 3:
                try: b.faces.new(vs).material_index = 0
                except ValueError: pass
    M = Matrix((X, D, Out)).transposed().to_4x4()
    bmesh.ops.transform(b, matrix=M, verts=b.verts)
    bmesh.ops.translate(b, verts=b.verts, vec=sh - D * 0.040 - V(side * 0.012, 0, 0))     # 付け根を肩にうめる（段差を見せない）
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    ob = mesh_obj('Hirori_Wing_' + nm, b, [MAT['coral'], MAT['blue']], sh, root, smooth=False)
    WING_OPEN[nm] = open_deg
    return ob
WING_OPEN = {}
wing(1); wing(-1)

# ── 脚：短く安定。太ももから足首へ細くなる ───────────────────────────────
def leg(side):
    nm = 'L' if side > 0 else 'R'
    S, C = 2, 8
    b = bmesh.new(); rows = []
    x0 = side * P['leg_x']
    for k in range(S + 1):
        t = k / S
        z = lerp(P['hip_z'] + 0.03, P['ankle_z'], t)
        r = lerp(P['leg_r_top'], P['leg_r_bot'], t ** 0.8) * (1 + 0.06 * math.sin(math.pi * t))
        yc = -0.006 * math.sin(math.pi * t)
        rows.append([b.verts.new(V(x0 + math.cos(2 * math.pi * j / C) * r, yc + math.sin(2 * math.pi * j / C) * r * 0.95, z)) for j in range(C)])
    for k in range(S):
        for j in range(C): b.faces.new((rows[k][j], rows[k][(j + 1) % C], rows[k + 1][(j + 1) % C], rows[k + 1][j]))
    for ring, up in ((rows[0], True), (rows[-1], False)):
        c = b.verts.new(sum((v.co for v in ring), Vector()) / C + V(0, 0, 0.012 if up else -0.01))
        for j in range(C): b.faces.new((ring[j], ring[(j + 1) % C], c) if not up else (ring[(j + 1) % C], ring[j], c))
    bmesh.ops.recalc_face_normals(b, faces=b.faces)
    return mesh_obj('Hirori_Leg_' + nm, b, [MAT['coral']], V(x0, 0, P['hip_z']), root, smooth=False)
leg(1); leg(-1)

# ── 足：丸い3本指（爪なし）。足の裏は平らで地面（z=0）につく ─────────────────
def foot(side):
    nm = 'L' if side > 0 else 'R'
    x0 = side * (P['leg_x'] + 0.004)
    L, W, H = P['foot_len'], P['foot_w'], P['foot_h']
    E = [(V(x0, 0.008, H * 0.55), (W * 0.42, L * 0.34, H * 0.55)),
         (V(x0, -0.012, H * 0.62), (W * 0.30, L * 0.25, H * 0.50))]
    for dx in (-1, 0, 1):
        E.append((V(x0 + dx * W * 0.34, -L * 0.38 + abs(dx) * 0.016, H * 0.32), (W * 0.19, L * 0.17, H * 0.32)))
    b = metaball_mesh('Foot' + nm, E, 0.012)
    bmesh.ops.rotate(b, verts=b.verts, cent=V(x0, 0, 0), matrix=Matrix.Rotation(math.radians(-side * P['foot_out_deg']), 3, 'Z'))   # つま先を少し外へ
    for v in b.verts:
        if v.co.z < 0.004: v.co.z = 0.0
    for _ in range(1): bmesh.ops.smooth_vert(b, verts=b.verts, factor=0.4, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    for v in b.verts:
        if v.co.z < 0.002: v.co.z = 0.0
    return mesh_obj('Hirori_Foot_' + nm, b, [MAT['coral']], V(x0, 0, P['ankle_z']), root, smooth=False)
for s in (1, -1):
    f = foot(s); decimate_to(f, 160)
    lg = bpy.data.objects['Hirori_Leg_' + ('L' if s > 0 else 'R')]
    mw = f.matrix_world.copy(); f.parent = lg; f.matrix_world = mw   # 足は脚の子（歩くとき、脚と一緒に動く）

for ob in [o for o in scene.objects if o.type == 'MESH']:
    ob.data.validate()

# ── 確認用の撮影（撮影用の物は、書き出し前にすべて消す） ─────────────────────────
def render_all(outdir):
    os.makedirs(outdir, exist_ok=True)
    sc = scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 16 if PREVIEW else 64; sc.cycles.use_denoising = True
    sc.cycles.seed = 1
    sc.render.resolution_x = sc.render.resolution_y = 768 if PREVIEW else 2048
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    world = bpy.data.worlds.new('W'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.92, 0.92, 0.93, 1); bg.inputs['Strength'].default_value = 0.85
    gm = bpy.data.materials.new('Ground'); gm.use_nodes = True
    gb = gm.node_tree.nodes['Principled BSDF']; gb.inputs['Base Color'].default_value = (0.86, 0.86, 0.87, 1); gb.inputs['Roughness'].default_value = 1.0
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0)); ground = bpy.context.active_object; ground.name = 'RenderGround'; ground.data.materials.append(gm)
    sun = bpy.data.objects.new('RenderSun', bpy.data.lights.new('RenderSun', 'SUN')); col.objects.link(sun)
    sun.data.energy = 2.4; sun.data.angle = math.radians(14); sun.rotation_euler = (math.radians(38), 0, math.radians(-28))
    fill = bpy.data.objects.new('RenderFill', bpy.data.lights.new('RenderFill', 'SUN')); col.objects.link(fill)
    fill.data.energy = 0.7; fill.data.angle = math.radians(30); fill.rotation_euler = (math.radians(60), 0, math.radians(150))
    cam = bpy.data.objects.new('RenderCam', bpy.data.cameras.new('RenderCam')); col.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.22
    # 全身：同じ縮尺・同じ照明。とさかの先と足先を切らない
    views = {
        'front': ((0, -4, 0.52), (90, 0, 0), 1.22),
        'side': ((-4, 0, 0.52), (90, 0, -90), 1.22),             # 左真横（ヒロリの右側から。顔は画面の左を向く）
        'back': ((0, 4, 0.52), (90, 0, 180), 1.22),
        'three-quarter': ((-2.6, -3.0, 1.35), (76, 0, -41), 1.22),
        'rear-three-quarter': ((2.6, 3.0, 1.35), (76, 0, 139), 1.22),
        'top': ((0, -0.02, 4.0), (0, 0, 0), 1.22),                # 真上（顔＝正面が画面の下）
        'face-closeup': ((-0.9, -3.9, 0.66), (90, 0, -13), 0.40),
        'face-front': ((0, -4, 0.70), (90, 0, 0), 0.30),
        'face-side': ((-4, -0.10, 0.70), (90, 0, -90), 0.42),
        'crest-closeup': ((-4, 0.08, 0.83), (90, 0, -90), 0.52),
    }
    for name, (loc, rot, scale) in views.items():
        cam.location = loc; cam.rotation_euler = [math.radians(a) for a in rot]; cam.data.ortho_scale = scale
        ground.hide_render = (name == 'top')
        sc.render.filepath = os.path.join(outdir, name + SUF + '.png'); bpy.ops.render.render(write_still=True)
    # ゲーム内と同じくらいの小さな表示（約160px）：斜め前
    rx, ry = sc.render.resolution_x, sc.render.resolution_y
    sc.render.resolution_x = sc.render.resolution_y = 160
    loc, rot, scale = views['three-quarter']; cam.location = loc; cam.rotation_euler = [math.radians(a) for a in rot]; cam.data.ortho_scale = scale
    ground.hide_render = False; sc.render.filepath = os.path.join(outdir, 'small-three-quarter.png'); bpy.ops.render.render(write_still=True)
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    # シルエット：6方向（全部を黒に）
    ground.hide_render = True
    blk = bpy.data.materials.new('Black'); blk.use_nodes = True
    nb = blk.node_tree.nodes; nb.remove(nb['Principled BSDF']); em = nb.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (0, 0, 0, 1)
    blk.node_tree.links.new(em.outputs['Emission'], nb['Material Output'].inputs['Surface'])
    vl = sc.view_layers[0]; vl.material_override = blk
    bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 1.0
    sc.cycles.samples = 4
    for name in ('front', 'side', 'back', 'three-quarter', 'top', 'rear-three-quarter'):
        loc, rot, scale = views[name]
        cam.location = loc; cam.rotation_euler = [math.radians(a) for a in rot]; cam.data.ortho_scale = scale
        sc.render.filepath = os.path.join(outdir, 'sil-' + name + SUF + '.png'); bpy.ops.render.render(write_still=True)
    vl.material_override = None
    for o in (ground, sun, fill, cam): bpy.data.objects.remove(o)
    for m in (gm, blk): bpy.data.materials.remove(m)
    sc.world = None; bpy.data.worlds.remove(world)

os.makedirs(OUT, exist_ok=True); os.makedirs(ASSET_DIR, exist_ok=True)
BLEND = os.path.join(OUT, 'hirori-field.blend')
GLB = os.path.join(ASSET_DIR, 'hirori-field.glb')
# 全高（とさかの先まで）を 1.0 にそろえる：ひよこ型で背が低くなったぶん、全体を同じ割合で大きくする（根の大きさで調整）
_dg = bpy.context.evaluated_depsgraph_get(); _top = 0.0
for _o in [o for o in scene.objects if o.type == 'MESH']:
    _top = max(_top, max((_o.matrix_world @ v.co).z for v in _o.data.vertices))
root.scale = (1.0 / _top,) * 3
bpy.context.view_layer.update()
if RENDER:
    render_all(RENDER_DIR)

# 使われていないデータ（撮影用のメッシュ・カメラ・ライト・ワールド）を消してから書き出す
for coll in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights, bpy.data.worlds, bpy.data.images, bpy.data.materials):
    for d in list(coll):
        if d.users == 0: coll.remove(d)
bpy.ops.export_scene.gltf(
    filepath=GLB, export_format='GLB', use_selection=False,
    export_cameras=False, export_lights=False, export_animations=False, export_skins=False, export_morph=False,
    export_extras=False, export_materials='EXPORT', export_vertex_color='MATERIAL',
    export_normals=True, export_tangents=False, export_yup=True, export_apply=True, export_image_format='NONE',
    export_draco_mesh_compression_enable=False)
bpy.ops.wm.save_as_mainfile(filepath=BLEND, compress=False, relative_remap=True)

# ── 検証の記録 ─────────────────────────────────────────────────────────────
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
data = open(GLB, 'rb').read()
magic, ver, total = struct.unpack('<4sII', data[:12]); jlen = struct.unpack('<I', data[12:16])[0]
gj = json.loads(data[20:20 + jlen])
objs = sorted(o.name for o in scene.objects)
meshes = [o for o in scene.objects if o.type == 'MESH']
deps = bpy.context.evaluated_depsgraph_get()
tri = 0; verts = 0; mins = [1e9] * 3; maxs = [-1e9] * 3; per = {}
for o in sorted(meshes, key=lambda o: o.name):
    me2 = o.evaluated_get(deps).to_mesh(); me2.calc_loop_triangles()
    t = len(me2.loop_triangles); tri += t; verts += len(me2.vertices)
    per[o.name] = {'triangles': t, 'vertices': len(me2.vertices), 'location': [round(c, 5) for c in o.matrix_world.translation], 'rotation': [round(c, 5) for c in o.rotation_euler], 'scale': [round(c, 5) for c in o.scale], 'materials': [m.name for m in o.data.materials]}
    for v in me2.vertices:
        w = o.matrix_world @ v.co
        for i in range(3): mins[i] = min(mins[i], w[i]); maxs[i] = max(maxs[i], w[i])
    o.evaluated_get(deps).to_mesh_clear()
names = [n.lower() for n in objs]
cnt = lambda key: sum(1 for n in objs if n.startswith(key))
forbid = {k: sum(1 for n in names if k in n) for k in ('tail', 'arm', 'hand', 'finger', 'claw', 'ear', 'horn')}
raw = data.decode('latin1')
report = {
    'blender_version': bpy.app.version_string,
    'files': {'blend': {'bytes': os.path.getsize(BLEND), 'sha256': sha(BLEND)}, 'glb': {'bytes': os.path.getsize(GLB), 'sha256': sha(GLB)}},
    'glb_header': {'magic': magic.decode('latin1'), 'version': ver, 'length': total},
    'objects': objs, 'object_count': len(objs),
    'materials': sorted(m.name for m in bpy.data.materials if m.users),
    'per_object': per,
    'vertices': verts, 'triangles': tri, 'mesh_count': len(meshes),
    'gltf': {k: len(gj.get(k, [])) for k in ('meshes', 'materials', 'textures', 'images', 'animations', 'skins', 'cameras', 'nodes', 'samplers')},
    'gltf_lights': len(gj.get('extensions', {}).get('KHR_lights_punctual', {}).get('lights', [])),
    'external_uris': sum(1 for b in gj.get('buffers', []) if 'uri' in b) + sum(1 for i in gj.get('images', []) if 'uri' in i),
    'extensions_used': gj.get('extensionsUsed', []),
    'bounding_box_blender_zup': {'min': [round(c, 4) for c in mins], 'max': [round(c, 4) for c in maxs], 'size': [round(maxs[i] - mins[i], 4) for i in range(3)]},
    'origin': 'Hirori_Root at (0,0,0): between the feet, on the ground',
    'ground_height': round(mins[2], 5),
    'counts': {'crest': cnt('Hirori_Crest_'), 'wing': cnt('Hirori_Wing_'), 'leg': cnt('Hirori_Leg_'), 'foot': cnt('Hirori_Foot_'), 'eye': cnt('Hirori_Eye_'), **forbid},
    'private_strings_in_glb': sum(raw.count(s) for s in ('C:\\Users', 'C:/Users', 'Users\\', '\\Users', '/home/')),
}
json.dump(report, open(os.path.join(OUT, 'model-report.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
# リポジトリに置く記録（GLB の中身の要約。撮影画像・.blend はリポジトリの外）
manifest = {
    'name': 'TOMORI Field Hirori (low-poly, static, no rig)',
    'file': 'hirori-field.glb', 'bytes': report['files']['glb']['bytes'], 'sha256': report['files']['glb']['sha256'],
    'generator': 'tools/hirori-field/generate_hirori_field.py (Blender ' + bpy.app.version_string + ')',
    'triangles': report['triangles'], 'materials': report['materials'], 'textures': 0, 'external_uris': report['external_uris'],
    'height': round(report['bounding_box_blender_zup']['size'][2], 4), 'up': '+Y', 'front': '+Z', 'sole_y': 0,
    'parts': sorted(o for o in report['objects'] if o.startswith('Hirori_')),
    'game_scale': 2.0,
    'license': 'TOMORI original: generated for TOMORI by this script. No third-party, downloaded or AI-generated 3D assets.',
}
json.dump(manifest, open(os.path.join(ASSET_DIR, 'manifest.json'), 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
print('HIRORI_REPORT', json.dumps({k: report[k] for k in ('triangles', 'vertices', 'mesh_count', 'bounding_box_blender_zup', 'counts', 'gltf', 'external_uris', 'private_strings_in_glb')}))

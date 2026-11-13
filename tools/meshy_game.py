# Meshy の GLB（4096 の PNG 3枚つき）から、ゲーム用の軽い GLB を作る
# 形（位置・法線・UV・三角形）はそのまま。色の絵（baseColor）だけを 1024 の JPEG にして入れる。法線・金属感の絵は外す
# 使い方：python -I meshy_game.py 入力.glb 出力.glb [大きさ]
import sys, json, struct, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
b = open(src, 'rb').read()
assert b[:4] == b'glTF'
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
bin0 = 20 + jl + 8
def view(i):
    bv = j['bufferViews'][i]; o = bin0 + bv.get('byteOffset', 0); return b[o:o + bv['byteLength']]
pr = j['meshes'][0]['primitives'][0]
assert len(j['meshes']) == 1 and len(j['meshes'][0]['primitives']) == 1
mat = j['materials'][pr['material']]
tex = j['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
img = Image.open(io.BytesIO(view(j['images'][tex['source']]['bufferView']))).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
jb = io.BytesIO(); img.save(jb, 'JPEG', quality=86, optimize=True); jpg = jb.getvalue()
out_bin = bytearray(); views = []; accs = []
def add(data, target=None):
    while len(out_bin) % 4: out_bin.append(0)
    v = {'buffer': 0, 'byteOffset': len(out_bin), 'byteLength': len(data)}
    if target: v['target'] = target
    out_bin.extend(data); views.append(v); return len(views) - 1
def copy_acc(i, target):
    a = dict(j['accessors'][i]); bv = j['bufferViews'][a['bufferView']]
    assert not bv.get('byteStride') or a['type'] in ('VEC3', 'VEC2')
    comp = {5126: 4, 5125: 4, 5123: 2, 5121: 1}[a['componentType']] * {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    raw = view(a['bufferView'])[a.get('byteOffset', 0):]
    stride = bv.get('byteStride') or comp
    data = b''.join(raw[k * stride:k * stride + comp] for k in range(a['count'])) if stride != comp else raw[:comp * a['count']]
    a['bufferView'] = add(data, target); a.pop('byteOffset', None); accs.append(a); return len(accs) - 1
attrs = {k: copy_acc(pr['attributes'][k], 34962) for k in ('POSITION', 'NORMAL', 'TEXCOORD_0')}
ind = copy_acc(pr['indices'], 34963)
iv = add(jpg)
out = {'asset': {'version': '2.0', 'generator': 'tomori meshy_game.py'},
       'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': j['nodes'][0].get('name', 'mesh')}],
       'meshes': [{'primitives': [{'attributes': attrs, 'indices': ind, 'material': 0}]}],
       'materials': [{'name': 'Base', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1}}],
       'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
       'images': [{'bufferView': iv, 'mimeType': 'image/jpeg'}],
       'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': 0}]}
while len(out_bin) % 4: out_bin.append(0)
out['buffers'][0]['byteLength'] = len(out_bin)
js = json.dumps(out, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
total = 12 + 8 + len(js) + 8 + len(out_bin)
with open(dst, 'wb') as f:
    f.write(b'glTF' + struct.pack('<II', 2, total))
    f.write(struct.pack('<I', len(js)) + b'JSON' + js)
    f.write(struct.pack('<I', len(out_bin)) + b'BIN\x00' + out_bin)
print(dst, 'bytes', total, 'jpeg', len(jpg), 'tris', j['accessors'][pr['indices']]['count'] // 3)

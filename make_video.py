"""
TOMORI デモムービー自動生成スクリプト
playwright でシーンをキャプチャ → MP4 に変換
"""
import asyncio, os, sys
from pathlib import Path
from PIL import Image
import imageio.v3 as iio
import numpy as np

OUT_DIR  = Path(__file__).parent / "demo_frames"
OUT_MP4  = Path(__file__).parent / "tomori-demo.mp4"
URL      = "http://localhost:3456/demo-movie.html"
N_SCENES = 9

# 各シーンの秒数（demo-movie.html の d: 値と合わせる）
SCENE_DURATIONS = [5.8, 6.5, 7.5, 6.2, 7.5, 6.0, 6.5, 7.0, 8.0]
FPS       = 24
WAIT_ANIM = 0.9   # アニメーション待機秒

async def capture():
    from playwright.async_api import async_playwright

    OUT_DIR.mkdir(exist_ok=True)
    frames_per_scene = [max(1, int(d * FPS)) for d in SCENE_DURATIONS]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 860})
        await page.goto(URL)
        await page.wait_for_timeout(1200)

        for i in range(N_SCENES):
            print(f"  シーン {i+1}/{N_SCENES} キャプチャ中…")
            await page.evaluate(f"show({i})")
            await page.wait_for_timeout(int(WAIT_ANIM * 1000))

            # 各シーンを frames_per_scene[i] 枚撮影（静止だが FPS 合わせ）
            n = frames_per_scene[i]
            png = await page.screenshot(type="png")
            frame_path = OUT_DIR / f"scene_{i:02d}.png"
            frame_path.write_bytes(png)

            # 枚数分コピーして後で連結
            for j in range(n):
                dst = OUT_DIR / f"frame_{i:02d}_{j:04d}.png"
                if j == 0:
                    frame_path.rename(dst)
                    frame_path = OUT_DIR / f"scene_{i:02d}.png"
                else:
                    dst.write_bytes((OUT_DIR / f"frame_{i:02d}_0000.png").read_bytes() if j==1 else (OUT_DIR / f"frame_{i:02d}_{j-1:04d}.png").read_bytes())

        await browser.close()
    print("  キャプチャ完了！")

def make_mp4():
    print("  MP4 生成中…")
    paths = sorted(OUT_DIR.glob("frame_*.png"))
    if not paths:
        print("  フレームが見つかりません")
        return

    with iio.imopen(str(OUT_MP4), "w", plugin="pyav") as writer:
        writer.init_video_stream("libx264", fps=FPS)
        for i, p in enumerate(paths):
            if i % 50 == 0:
                print(f"    {i}/{len(paths)} フレーム書き込み中…")
            img = np.array(Image.open(p).convert("RGB"))
            writer.write_frame(img)

    print(f"  完成: {OUT_MP4}")

async def main():
    print("=== TOMORI デモムービー生成 ===")
    print("サーバー起動確認中… (localhost:3456)")
    import urllib.request
    try:
        urllib.request.urlopen(URL, timeout=3)
    except Exception:
        print("エラー: localhost:3456 に接続できません。")
        print("先に demo-movie.html を開いてサーバーを起動してください。")
        sys.exit(1)

    print("シーンのキャプチャを開始します…")
    await capture()
    make_mp4()
    print(f"\n完成！ → {OUT_MP4}")

asyncio.run(main())

"""Build the display-size image files index.html references from the masters in img/.

Deterministic; re-run after replacing a master.   python scripts/optimize-images.py
Needs Pillow with WebP support.

Why (measured 2026-09-22, phone on slow 4G): the feature screenshots were full-size PNG/GIF
masters. The page now references these derived files instead; the masters stay as the source.
  img/settings.gif          -> img/settings.webp          animated, LOSSLESS (same 11 frames,
                                                           same 1.6 s timing, pixel-identical)
  img/preview-collage.webp  -> img/preview-collage-1240.webp  2074 px wide master shown at most
                                                           620 CSS px: 1240 px covers 2x screens
  img/preview-quicklook.png -> img/preview-quicklook.webp  same pixels, WebP q90
  img/convert.png           -> img/convert.webp           same pixels, WebP q90
  img/logo.png (256 px)     -> img/logo-81.png            header logo is drawn at 27 CSS px;
                                                           81 px covers 3x screens (logo.png
                                                           stays for the web manifest)
The format gallery (img/gallery) is left alone: it is already WebP and shows at up to 274 CSS
px (548 device px), wider than its 512 px files.
"""

import os

from PIL import Image, ImageSequence

IMG = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "img")


def report(src: str, dst: str) -> None:
    print(f"{src}: {os.path.getsize(os.path.join(IMG, src)) // 1024} KB -> "
          f"{dst}: {os.path.getsize(os.path.join(IMG, dst)) // 1024} KB")


def animated_webp(src: str, dst: str) -> None:
    gif = Image.open(os.path.join(IMG, src))
    frames, durations = [], []
    for f in ImageSequence.Iterator(gif):
        frames.append(f.convert("RGBA"))
        durations.append(f.info.get("duration", 100))
    frames[0].save(os.path.join(IMG, dst), "WEBP", save_all=True, append_images=frames[1:],
                   duration=durations, loop=gif.info.get("loop", 0), lossless=True,
                   quality=100, method=6, minimize_size=True)
    report(src, dst)


def still_webp(src: str, dst: str, width: int | None = None, quality: int = 90) -> None:
    im = Image.open(os.path.join(IMG, src)).convert("RGB")
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(IMG, dst), "WEBP", quality=quality, method=6)
    report(src, dst)


def small_png(src: str, dst: str, size: int) -> None:
    im = Image.open(os.path.join(IMG, src)).convert("RGBA").resize((size, size), Image.LANCZOS)
    im.save(os.path.join(IMG, dst), "PNG", optimize=True)
    report(src, dst)


if __name__ == "__main__":
    animated_webp("settings.gif", "settings.webp")
    still_webp("preview-collage.webp", "preview-collage-1240.webp", width=1240, quality=88)
    still_webp("preview-quicklook.png", "preview-quicklook.webp")
    still_webp("convert.png", "convert.webp")
    small_png("logo.png", "logo-81.png", 81)

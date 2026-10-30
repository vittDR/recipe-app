#!/usr/bin/env python3
"""Write a small copy of each recipe photo for grids and lists.

The full photos (900x675, under 100 KB each) are for the swipe card and the
recipe page; a grid of 100 of them is ~14 MB. Thumbnails are 480x360, ~20 KB.

Usage:
    pip install pillow
    python3 make_thumbnails.py web/public/recipe-photos

Writes <dir>/thumb/<name>.webp for every <dir>/<name>.webp. Re-run after adding photos.
"""
import sys
from pathlib import Path

from PIL import Image

SIZE = (480, 360)


def main(src: Path) -> None:
    out = src / "thumb"
    out.mkdir(exist_ok=True)
    for f in sorted(src.glob("*.webp")):
        im = Image.open(f).convert("RGB")
        im.thumbnail(SIZE, Image.LANCZOS)
        im.save(out / f.name, "WEBP", quality=70, method=6)
    total = sum(p.stat().st_size for p in out.glob("*.webp"))
    print(f"{len(list(out.glob('*.webp')))} thumbnails, {total // 1000} KB")


if __name__ == "__main__":
    main(Path(sys.argv[1] if len(sys.argv) > 1 else "web/public/recipe-photos"))

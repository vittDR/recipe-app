#!/usr/bin/env python3
"""Download each recipe's photo, crop it to the app's image spec and save it as WebP.

Spec (recipe-template.md): 4:3 landscape, 1600x1200 (min 1200x900), dish centred,
WebP ~q80, under 300 KB (500 KB max).

Usage:
    pip install requests pillow
    python3 download_images.py recipes.json images/
    python3 download_images.py recipes.json images/ --base-url https://<project>.supabase.co/storage/v1/object/public/recipe-images/seed/

Writes images/<slug>.webp for every recipe with an image_url, and images/report.csv.
With --base-url it also writes recipes.hosted.json next to recipes.json, where
image_url points at your copy (base-url + file name) and image_source_url keeps
the original. Existing files are skipped, so you can re-run it after a failure.
"""
import argparse, csv, io, json, re, sys, time, unicodedata
from pathlib import Path
from urllib.parse import urlparse

import requests
from PIL import Image, ImageOps

TARGET = (1600, 1200)
MIN = (1200, 900)
MAX_BYTES, GOAL_BYTES = 500_000, 300_000
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


def slug(title: str) -> str:
    for a, b in (("œ", "oe"), ("Œ", "Oe"), ("æ", "ae"), ("ı", "i"), ("ß", "ss")):
        title = title.replace(a, b)
    s = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:80]


def to_webp(data: bytes) -> tuple[bytes, tuple[int, int], str]:
    """Centre-crop to 4:3, resize, encode WebP under the size goal."""
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im)
    if getattr(im, "is_animated", False):
        im.seek(0)
    im = im.convert("RGB")  # drops alpha / CMYK; Pillow output is sRGB
    w, h = im.size
    note = ""
    if w / h > 4 / 3:      # too wide: trim the sides
        nw = round(h * 4 / 3); im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    elif w / h < 4 / 3:    # too tall: trim top and bottom
        nh = round(w * 3 / 4); im = im.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    w, h = im.size
    if w >= TARGET[0]:
        im = im.resize(TARGET, Image.LANCZOS)
    elif w >= MIN[0]:
        im = im.resize((w, round(w * 3 / 4)), Image.LANCZOS)
    else:
        note = f"upscaled from {w}x{h} (source is small)"
        im = im.resize(MIN, Image.LANCZOS)
    for q in (80, 75, 70, 65, 60, 55):
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=q, method=6)
        if buf.tell() <= GOAL_BYTES:
            break
    if buf.tell() > MAX_BYTES:
        note = (note + "; " if note else "") + f"still {buf.tell()//1000} KB"
    return buf.getvalue(), im.size, note


def fetch(url: str, referer: str) -> bytes:
    p = urlparse(referer)
    r = requests.get(url, timeout=30, headers={
        "User-Agent": UA,
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        "Referer": f"{p.scheme}://{p.netloc}/",
    })
    r.raise_for_status()
    if not r.headers.get("content-type", "").startswith("image/") and len(r.content) < 2000:
        raise ValueError(f"not an image ({r.headers.get('content-type')})")
    return r.content


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("recipes")
    ap.add_argument("out_dir")
    ap.add_argument("--base-url", help="public URL prefix where you will upload the files")
    a = ap.parse_args()

    recipes = json.loads(Path(a.recipes).read_text(encoding="utf-8"))
    out = Path(a.out_dir); out.mkdir(parents=True, exist_ok=True)
    rows = []
    for r in recipes:
        src = r.get("image_source_url") or r.get("image_url")
        name = slug(r["title"]) + ".webp"
        dest = out / name
        if not src:
            rows.append((r["title"], name, "no image", "")); continue
        if dest.exists():
            rows.append((r["title"], name, "skipped (exists)", "")); r["_file"] = name; continue
        try:
            webp, size, note = to_webp(fetch(src, r.get("source_url") or src))
            dest.write_bytes(webp)
            r["_file"] = name
            rows.append((r["title"], name, f"ok {size[0]}x{size[1]} {len(webp)//1000} KB", note))
            print(f"ok    {name}  {note}")
        except Exception as e:
            rows.append((r["title"], name, "failed", str(e)[:200]))
            print(f"FAIL  {name}  {e}", file=sys.stderr)
        time.sleep(0.5)  # be polite to the source sites

    with open(out / "report.csv", "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows([("title", "file", "status", "note"), *rows])

    if a.base_url:
        base = a.base_url if a.base_url.endswith("/") else a.base_url + "/"
        for r in recipes:
            f = r.pop("_file", None)
            r["image_source_url"] = r.get("image_source_url") or r.get("image_url")
            r["image_url"] = base + f if f else None
        hosted = Path(a.recipes).with_name("recipes.hosted.json")
        hosted.write_text(json.dumps(recipes, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"wrote {hosted}")
    ok = sum(1 for x in rows if x[2].startswith(("ok", "skipped")))
    print(f"{ok}/{len(rows)} images ready in {out}  (details in report.csv)")


if __name__ == "__main__":
    main()

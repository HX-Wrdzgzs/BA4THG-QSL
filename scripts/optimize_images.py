from __future__ import annotations

import hashlib
import re
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
APP_PATH = ROOT / "app.js"
INDEX_PATH = ROOT / "index.html"
THUMB_DIR = ROOT / "图片" / "thumbs"
FULL_DIR = ROOT / "图片" / "webp"
THUMB_DIR.mkdir(parents=True, exist_ok=True)
FULL_DIR.mkdir(parents=True, exist_ok=True)

SOURCE_IMAGES = {
    "nanjing-second-bridge": "图片/A面 南京二桥航拍.png",
    "nanjing-fourth-bridge-portrait": "图片/A面 南京四桥航拍 竖拍.png",
    "nanjing-fourth-bridge-angle": "图片/A面 南京四桥航拍 斜拍.png",
    "mizuki-01": "图片/A面 mzk 1 2版.png",
    "mizuki-02": "图片/A面 mzk 2 2版.png",
    "ena-01": "图片/A面 ena 1 2版.png",
    "ena-02": "图片/A面 ena 2 2版.png",
    "kanade-01": "图片/A面 knd 1 2版.png",
    "maimai-prism-plus": "图片/A面 maimai prism plus.png",
    "rll-quotes": "图片/A面 RLL经典语录.png",
    "back-landscape": "图片/QSL横版B面.png",
    "back-portrait": "图片/QSL竖版B面.png",
}


def webp_ready(image: Image.Image) -> Image.Image:
    if image.mode in {"RGB", "RGBA"}:
        return image
    if "A" in image.getbands() or "transparency" in image.info:
        return image.convert("RGBA")
    return image.convert("RGB")


def generate_assets() -> dict[str, dict[str, str]]:
    generated: dict[str, dict[str, str]] = {}
    expected_thumbnails: set[Path] = set()
    expected_full_images: set[Path] = set()

    for card_id, source_rel in SOURCE_IMAGES.items():
        source = ROOT / source_rel
        if not source.is_file():
            raise FileNotFoundError(f"Missing source image for {card_id}: {source}")

        digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
        thumb_rel = Path("图片") / "thumbs" / f"{card_id}.{digest}.webp"
        full_rel = Path("图片") / "webp" / f"{card_id}.{digest}.webp"
        thumb_path = ROOT / thumb_rel
        full_path = ROOT / full_rel

        with Image.open(source) as original:
            normalized = ImageOps.exif_transpose(original)

            full_image = webp_ready(normalized.copy())
            full_image.save(
                full_path,
                "WEBP",
                quality=88,
                method=6,
                optimize=True,
            )

            thumbnail = normalized.copy()
            thumbnail.thumbnail((960, 960), Image.Resampling.LANCZOS)
            thumbnail = webp_ready(thumbnail)
            thumbnail.save(
                thumb_path,
                "WEBP",
                quality=74,
                method=6,
                optimize=True,
            )

        expected_thumbnails.add(thumb_path)
        expected_full_images.add(full_path)
        generated[card_id] = {
            "thumbnail": f"./{thumb_rel.as_posix()}",
            "image": f"./{full_rel.as_posix()}",
        }

    for stale in THUMB_DIR.glob("*.webp"):
        if stale not in expected_thumbnails:
            stale.unlink()
    for stale in FULL_DIR.glob("*.webp"):
        if stale not in expected_full_images:
            stale.unlink()

    return generated


def update_app(generated: dict[str, dict[str, str]]) -> None:
    app_text = APP_PATH.read_text(encoding="utf-8")
    catalog_start = app_text.index("const cardCatalog = [")
    catalog_end = app_text.index("\n];", catalog_start)
    catalog = app_text[catalog_start:catalog_end]
    card_pattern = re.compile(r"  \{\n(?P<body>.*?)\n  \},", re.DOTALL)
    updated_ids: set[str] = set()

    def update_card(match: re.Match[str]) -> str:
        block = match.group(0)
        card_id_match = re.search(r'id:\s*"([^"]+)"', block)
        if not card_id_match:
            return block

        card_id = card_id_match.group(1)
        paths = generated.get(card_id)
        if not paths:
            raise KeyError(f"No image source mapping for catalog card: {card_id}")

        updated_ids.add(card_id)
        block, thumb_count = re.subn(
            r'thumbnail:\s*"[^"]+"',
            f'thumbnail: "{paths["thumbnail"]}"',
            block,
            count=1,
        )
        block, image_count = re.subn(
            r'image:\s*"[^"]+"',
            f'image: "{paths["image"]}"',
            block,
            count=1,
        )
        if thumb_count != 1 or image_count != 1:
            raise RuntimeError(f"Could not update image fields for {card_id}")
        return block

    updated_catalog = card_pattern.sub(update_card, catalog)
    missing = set(SOURCE_IMAGES).difference(updated_ids)
    if missing:
        raise RuntimeError(f"Source mappings missing from cardCatalog: {sorted(missing)}")

    app_text = app_text[:catalog_start] + updated_catalog + app_text[catalog_end:]
    app_text = app_text.replace(
        '  image.loading = index < 4 ? "eager" : "lazy";\n  image.decoding = "async";',
        '  image.loading = "lazy";\n  image.decoding = "async";\n  image.fetchPriority = "low";',
    )
    app_text = app_text.replace(
        'function fillDialog(card) {\n  dialogImage.src = card.image;',
        'function fillDialog(card) {\n  dialogImage.fetchPriority = "high";\n  dialogImage.src = card.image;',
    )
    app_text = app_text.replace(
        'dialog.addEventListener("close", () => {\n  dialogImage.src = "";\n});',
        'dialog.addEventListener("close", () => {\n  dialogImage.removeAttribute("src");\n});',
    )

    if re.search(r"\.png(?:[?\"'\s#]|$)", app_text, re.IGNORECASE):
        raise RuntimeError("app.js still contains a PNG page reference")
    APP_PATH.write_text(app_text, encoding="utf-8", newline="\n")


def update_index(generated: dict[str, dict[str, str]]) -> None:
    index_text = INDEX_PATH.read_text(encoding="utf-8")
    hero_cards = {
        "hero-card-main": (
            "nanjing-second-bridge",
            "南京二桥航拍主题 QSL 卡片",
            ' fetchpriority="high"',
        ),
        "hero-card-tall": (
            "nanjing-fourth-bridge-portrait",
            "南京四桥竖版航拍主题 QSL 卡片",
            "",
        ),
        "hero-card-accent": (
            "mizuki-01",
            "晓山瑞希主题 QSL 卡片",
            "",
        ),
    }

    for class_name, (card_id, alt, priority) in hero_cards.items():
        pattern = re.compile(
            rf'(<figure class="hero-card {re.escape(class_name)}">\s*)<img\b[^>]*>',
            re.DOTALL,
        )
        replacement = (
            rf'\1<img src="{generated[card_id]["thumbnail"]}" alt="{alt}" '
            rf'loading="eager" decoding="async"{priority}>'
        )
        index_text, count = pattern.subn(replacement, index_text, count=1)
        if count != 1:
            raise RuntimeError(f"Could not update Hero image: {class_name}")

    preload = (
        f'  <link rel="preload" as="image" href="{generated["nanjing-second-bridge"]["thumbnail"]}" '
        'type="image/webp" fetchpriority="high">'
    )
    preload_pattern = re.compile(r'  <link rel="preload" as="image"[^>]*>\n')
    if preload_pattern.search(index_text):
        index_text = preload_pattern.sub(preload + "\n", index_text, count=1)
    else:
        favicon_line = '  <link rel="icon" type="image/svg+xml" href="./assets/ba4thg-mark.svg">'
        index_text = index_text.replace(favicon_line, favicon_line + "\n" + preload, 1)

    index_text = index_text.replace(
        '<img data-dialog-image src="" alt="">',
        '<img data-dialog-image alt="" decoding="async">',
    )
    if re.search(r"\.png(?:[?\"'\s#]|$)", index_text, re.IGNORECASE):
        raise RuntimeError("index.html still contains a PNG page reference")
    INDEX_PATH.write_text(index_text, encoding="utf-8", newline="\n")


def main() -> None:
    generated = generate_assets()
    update_app(generated)
    update_index(generated)

    print(f"Generated {len(generated)} WebP thumbnail/full-size pairs")
    for card_id, paths in generated.items():
        thumb_size = (ROOT / paths["thumbnail"].removeprefix("./")).stat().st_size
        full_size = (ROOT / paths["image"].removeprefix("./")).stat().st_size
        print(
            f"- {card_id}: thumbnail={thumb_size / 1024:.1f} KiB, "
            f"full={full_size / 1024:.1f} KiB"
        )


if __name__ == "__main__":
    main()

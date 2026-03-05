import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from pipeline.preprocess import preprocess  # noqa: E402

LETTERS_PATH = BASE_DIR / "data" / "letters.json"
OUTPUT_DIR = BASE_DIR / "data" / "templates" / "isolated"
FONT_PATH = Path(__file__).resolve().parent / "NotoNaskhArabic-Regular.ttf"

VARIANTS = [
    {"size": 160, "rotation": 0, "dx": 0, "dy": 0},
    {"size": 150, "rotation": -2, "dx": -4, "dy": 0},
    {"size": 150, "rotation": 2, "dx": 4, "dy": 0},
    {"size": 145, "rotation": -4, "dx": -6, "dy": 2},
    {"size": 145, "rotation": 4, "dx": 6, "dy": 2},
    {"size": 155, "rotation": 0, "dx": 0, "dy": -4},
    {"size": 150, "rotation": -1, "dx": 0, "dy": 4},
    {"size": 140, "rotation": 3, "dx": 0, "dy": 0},
]


def _render_letter(letter: str, font_size: int, rotation: float, dx: int, dy: int) -> Image.Image:
    canvas = Image.new("L", (512, 512), 255)
    draw = ImageDraw.Draw(canvas)

    font = ImageFont.truetype(str(FONT_PATH), font_size)
    bbox = draw.textbbox((0, 0), letter, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]

    x = (512 - w) // 2 + dx
    y = (512 - h) // 2 + dy
    draw.text((x, y), letter, fill=0, font=font)

    if rotation:
        canvas = canvas.rotate(rotation, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=255)

    return canvas


def _to_png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main() -> None:
    if not FONT_PATH.exists():
        raise FileNotFoundError(
            f"Missing font at {FONT_PATH}. Add NotoNaskhArabic-Regular.ttf to grading-server/scripts/."
        )

    with LETTERS_PATH.open("r", encoding="utf-8") as f:
        letters = json.load(f)

    for letter in letters:
        slug = letter["slug"]
        arabic = letter["arabic"]
        folder = OUTPUT_DIR / slug
        folder.mkdir(parents=True, exist_ok=True)

        for i, variant in enumerate(VARIANTS, start=1):
            img = _render_letter(
                arabic,
                font_size=variant["size"],
                rotation=variant["rotation"],
                dx=variant["dx"],
                dy=variant["dy"],
            )
            processed = preprocess(_to_png_bytes(img))
            Image.fromarray(processed).save(folder / f"{i:02d}.png")

    print(f"Generated templates in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

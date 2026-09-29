"""Genera le icone della PWA (CLAUDE.md §9). Uso: python make_icons.py (richiede Pillow)."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "public"
GREEN = (15, 107, 63)
RED = (192, 38, 45)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
S = 1024  # disegno in alta risoluzione, poi ridimensiono


def card(size: int, angle: float, symbol: str, color, label: str) -> Image.Image:
    w, h = int(size * 0.62), int(size * 0.86)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=w // 9, fill="white", outline=(0, 0, 0, 40), width=6)
    big = ImageFont.truetype(FONT, int(h * 0.42))
    small = ImageFont.truetype(FONT, int(h * 0.16))
    d.text((w / 2, h * 0.55), symbol, font=big, fill=color, anchor="mm")
    d.text((w * 0.1, h * 0.05), label, font=small, fill=color, anchor="la")
    return im.rotate(angle, resample=Image.BICUBIC, expand=True)


def icon(safe: float) -> Image.Image:
    """`safe` è la frazione del lato occupata dal disegno (le maskable ritagliano i bordi)."""
    im = Image.new("RGBA", (S, S), GREEN + (255,))
    inner = int(S * safe)
    back = card(inner, 14, "♠", (20, 20, 20), "A")
    front = card(inner, -10, "♥", RED, "A")
    cx, cy = S // 2, S // 2
    im.alpha_composite(back, (cx - back.width // 2 + inner // 7, cy - back.height // 2))
    im.alpha_composite(front, (cx - front.width // 2 - inner // 8, cy - front.height // 2 + inner // 30))
    return im


def main() -> None:
    regular = icon(0.78)
    maskable = icon(0.6)
    for size in (192, 512):
        regular.resize((size, size), Image.LANCZOS).save(OUT / f"icon-{size}.png")
    maskable.resize((512, 512), Image.LANCZOS).save(OUT / "icon-maskable-512.png")
    regular.convert("RGB").resize((180, 180), Image.LANCZOS).save(OUT / "apple-touch-icon.png")
    regular.resize((64, 64), Image.LANCZOS).save(OUT / "favicon.png")


if __name__ == "__main__":
    main()

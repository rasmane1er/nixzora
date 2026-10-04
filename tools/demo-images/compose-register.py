"""Sign-up illustration: the laptop, headphones, phone and controller on a soft peach disc.

Uses the cut-outs rendered by render-hero.mjs. Output (transparent, 2x for sharp screens):
  apps/storefront/public/account/register-art.webp (760×560, shown at 380×280)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
W, H = 760, 560
FLOOR = 470  # where the products stand

# slug, height, left x, how far below the floor line, in drawing order (back to front)
PLACEMENTS = [
    ("vela-15-studio", 300, 70, 0),
    ("halo-anc-headphones", 230, 330, 10),
    ("orbit-phone-256", 190, 560, 0),
    ("pulse-controller", 120, 440, 60),
]
PEACH = (252, 226, 208, 255)
ACCENT = (232, 99, 44, 255)


def sprite(slug: str, height: int) -> Image.Image:
    im = Image.open(HERE / "sprites" / f"{slug}.png").convert("RGBA")
    im = im.crop(im.getbbox())
    return im.resize((round(im.width * height / im.height), height), Image.LANCZOS)


def main() -> None:
    scene = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    disc = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(disc).ellipse((110, 30, 690, 545), fill=PEACH)
    scene.alpha_composite(disc)

    # A few accent strokes, like a little burst of energy.
    draw = ImageDraw.Draw(scene)
    for (x0, y0, x1, y1) in [(640, 40, 660, 70), (690, 75, 725, 55), (700, 120, 735, 120),
                             (70, 470, 45, 495), (110, 505, 100, 535)]:
        draw.line((x0, y0, x1, y1), fill=ACCENT, width=7)

    shadows = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadows)
    placed = []
    for slug, height, x, below in PLACEMENTS:
        im = sprite(slug, height)
        bottom = FLOOR + below
        cx = x + im.width / 2
        sdraw.ellipse((cx - im.width * 0.46, bottom - 8, cx + im.width * 0.46, bottom + 14),
                      fill=(80, 40, 20, 110))
        placed.append((im, (x, bottom - im.height)))
    scene = Image.alpha_composite(scene, shadows.filter(ImageFilter.GaussianBlur(9)))
    for im, pos in placed:
        scene.alpha_composite(im, pos)

    out = ROOT / "apps/storefront/public/account"
    out.mkdir(parents=True, exist_ok=True)
    scene.save(out / "register-art.webp", quality=85, method=6)
    print("wrote", out / "register-art.webp")


if __name__ == "__main__":
    main()

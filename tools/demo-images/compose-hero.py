"""
NOTE (October 2026): superseded by compose-store-hero.py, which draws a room with products from
every department. Running this script replaces the current hero with the old desk artwork.
Places the product cut-outs on the hero desk and writes the web and app images.

Each product is cropped to its outline, scaled to a height, and stood on the desk line with a
soft contact shadow. Outputs:
  apps/storefront/public/home/hero-desk.webp (1600×900, web hero)
  apps/mobile/assets/home/hero-desk.webp     (1200×675, app hero)
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
DESK = 640  # desk line in the backdrop (y)

# slug, height on screen, x of the left edge, how far below the desk line it stands, layer order
PLACEMENTS = [
    ("arden-27-4k-usb-c", 470, 910, -10),
    ("vela-15-studio", 285, 560, 52),
    ("halo-anc-headphones", 205, 1010, 40),
    ("orbit-phone-256", 165, 905, 58),
    ("pulse-controller", 115, 1150, 110),
]


def sprite(slug: str, height: int) -> Image.Image:
    im = Image.open(HERE / "sprites" / f"{slug}.png").convert("RGBA")
    im = im.crop(im.getbbox())
    width = round(im.width * height / im.height)
    return im.resize((width, height), Image.LANCZOS)


def contact_shadow(size: tuple[int, int], width: int) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    return layer, width


def main() -> None:
    scene = Image.open(HERE / "sprites" / "_backdrop.png").convert("RGBA")
    shadows = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadows)
    placed = []
    for slug, height, x, below in PLACEMENTS:
        im = sprite(slug, height)
        bottom = DESK + below
        top = bottom - im.height
        cx = x + im.width / 2
        draw.ellipse(
            (cx - im.width * 0.48, bottom - 10, cx + im.width * 0.48, bottom + 16), fill=(0, 0, 0, 150)
        )
        placed.append((im, (x, top)))
    scene = Image.alpha_composite(scene, shadows.filter(ImageFilter.GaussianBlur(10)))
    for im, pos in placed:
        scene.alpha_composite(im, pos)

    web = ROOT / "apps/storefront/public/home"
    web.mkdir(parents=True, exist_ok=True)
    scene.convert("RGB").save(web / "hero-desk.webp", quality=82, method=6)
    app = ROOT / "apps/mobile/assets/home"
    app.mkdir(parents=True, exist_ok=True)
    # The app shows the products only (its hero text sits above the picture).
    scene.crop((420, 120, 1600, 784)).resize((1180 * 3 // 4, 664 * 3 // 4), Image.LANCZOS).convert(
        "RGB"
    ).save(app / "hero-desk.webp", quality=80, method=6)
    print("wrote", web / "hero-desk.webp", "and", app / "hero-desk.webp")


if __name__ == "__main__":
    main()

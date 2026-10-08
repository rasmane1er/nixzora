"""
The home page hero (October 2026): a cozy room with products from every department, drawn from
the demo catalog's own artwork (no real brands). Replaces the earlier desk photo.

  python3 tools/demo-images/compose-store-hero.py cutouts   # writes product cut-out SVGs
  node tools/demo-images/render-cutouts.mjs                  # renders them to transparent PNGs
  python3 tools/demo-images/compose-store-hero.py            # composes and writes the heroes

Outputs:
  apps/storefront/public/home/hero-desk.webp (1600x900, web and seller page)
  apps/mobile/assets/home/hero-desk.webp     (885x496, app)
The left side stays dark for the headline; products sit on the right.
"""
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).parent
ROOT = HERE.parent.parent
CUTS = HERE / "cutouts"
SLUGS = [
    "vela-15-studio", "halo-anc-headphones", "hearth-electric-kettle", "stride-runner",
    "linden-fleece-hoodie", "dewdrop-hydrating-serum", "summit-insulated-bottle", "core-yoga-mat",
    "trailhead-28-backpack", "orbit-phone-256", "dewdrop-daily-sunscreen",
]

if len(sys.argv) > 1 and sys.argv[1] == "cutouts":
    sys.path.insert(0, str(HERE))
    import generate as g

    CUTS.mkdir(exist_ok=True)
    for slug in SLUGS:
        svg = g.PRODUCTS[slug].replace(f'<rect width="{g.W}" height="{g.H}" fill="url(#bg)"/>', "")
        svg = re.sub(r'<ellipse [^>]*fill="url\(#shadow\)"/>', "", svg)
        (CUTS / f"{slug}.svg").write_text(svg)
    print(f"wrote {len(SLUGS)} cut-outs to {CUTS}")
    sys.exit(0)

W, H = 1600, 900
TABLE = 650  # table top line

def grad(w, h, top, bottom):
    im = Image.new('RGB', (w, h)); d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return im

scene = grad(W, H, (22, 30, 52), (14, 19, 34)).convert('RGBA')
d = ImageDraw.Draw(scene)
# wall panels
panels = Image.new('RGBA', (W, H), (0, 0, 0, 0)); pd = ImageDraw.Draw(panels)
for x in range(0, W, 120):
    pd.line([(x, 0), (x, TABLE)], fill=(255, 255, 255, 9), width=2)
scene = Image.alpha_composite(scene, panels)
# warm lamp glow
glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
for r, a in [(520, 26), (380, 34), (240, 44)]:
    gd.ellipse([1230 - r, 150 - r, 1230 + r, 150 + r], fill=(255, 170, 90, a))
glow = glow.filter(ImageFilter.GaussianBlur(90)); scene = Image.alpha_composite(scene, glow)
d = ImageDraw.Draw(scene)
# pendant lamp
d.line([(1230, 0), (1230, 70)], fill=(40, 44, 54), width=4)
d.polygon([(1180, 120), (1280, 120), (1255, 70), (1205, 70)], fill=(36, 40, 50))
d.ellipse([1200, 110, 1260, 132], fill=(255, 214, 150))
# shelf
SHELF = 330
d.rectangle([1290, SHELF, 1600, SHELF + 18], fill=(92, 64, 44)); d.rectangle([1290, SHELF + 18, 1600, SHELF + 24], fill=(60, 40, 28))
# table
top = grad(W, H - TABLE, (120, 82, 54), (62, 42, 30)).convert('RGBA'); scene.paste(top, (0, TABLE))
d = ImageDraw.Draw(scene)
d.rectangle([0, TABLE, W, TABLE + 6], fill=(150, 104, 70))
grain = Image.new('RGBA', (W, H), (0, 0, 0, 0)); gr = ImageDraw.Draw(grain)
for y in range(TABLE + 44, H, 52): gr.line([(0, y), (W, y)], fill=(0, 0, 0, 34), width=2)
scene = Image.alpha_composite(scene, grain); d = ImageDraw.Draw(scene)

def cut(slug):
    im = Image.open(CUTS / f'{slug}.png').convert('RGBA'); return im.crop(im.getbbox())

K = 0.8  # products sit in the right part of the hero, clear of the headline
def place(slug, height, x, base, shadow=True, rot=0):
    global scene
    height = int(height * K); x = W - (W - x) * K - 30
    base = TABLE + (base - TABLE) * K if base > TABLE - 20 else base
    im = cut(slug)
    if rot: im = im.rotate(rot, expand=True, resample=Image.BICUBIC); im = im.crop(im.getbbox())
    s = height / im.height; im = im.resize((int(im.width * s), height), Image.LANCZOS)
    if shadow:
        sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
        sd.ellipse([x + im.width * 0.08, base - 10, x + im.width * 0.92, base + 14], fill=(0, 0, 0, 120))
        scene = Image.alpha_composite(scene, sh.filter(ImageFilter.GaussianBlur(9)))
    scene.alpha_composite(im, (int(x), int(base - im.height)))

# hanging hoodie on a wall hook
hx = W - (W - 997) * K - 30
d = ImageDraw.Draw(scene); d.ellipse([hx - 7, 92, hx + 7, 106], fill=(200, 160, 100)); d.line([(hx, 104), (hx, 128)], fill=(200, 160, 100), width=5)
place('linden-fleece-hoodie', 280, 885, 385, shadow=False)
# shelf items
place('dewdrop-hydrating-serum', 130, 1290, SHELF)
place('dewdrop-daily-sunscreen', 62, 1352, SHELF, rot=4)
place('summit-insulated-bottle', 178, 1495, SHELF)
# table, back row
place('vela-15-studio', 240, 690, TABLE + 6)
place('halo-anc-headphones', 136, 1010, TABLE + 8)
place('hearth-electric-kettle', 190, 1185, TABLE + 8)
place('trailhead-28-backpack', 245, 1380, TABLE + 14)
# table, front row
place('orbit-phone-256', 100, 935, TABLE + 80)
place('stride-runner', 100, 735, TABLE + 165)
place('core-yoga-mat', 78, 1060, TABLE + 160)
# darken the left side for the headline (the page puts its own gradient over it too)
fade = Image.new('RGBA', (W, H), (0, 0, 0, 0)); fd = ImageDraw.Draw(fade)
for x in range(0, 900):
    a = int(170 * max(0, 1 - x / 900) ** 1.6)
    fd.line([(x, 0), (x, H)], fill=(8, 12, 22, a))
scene = Image.alpha_composite(scene, fade)
rgb = scene.convert('RGB')
rgb.save(ROOT / 'apps/storefront/public/home/hero-desk.webp', quality=86)
rgb.resize((885, 498), Image.LANCZOS).crop((0, 1, 885, 497)).save(
    ROOT / 'apps/mobile/assets/home/hero-desk.webp', quality=86
)
print('wrote the web and app heroes')

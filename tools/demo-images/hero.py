"""The storefront home hero: a desk at night, built from the demo catalog's own illustrations.

Original artwork only (no real brands or product designs). Writes svg/_hero-desk.svg; render with
  python3 tools/demo-images/hero.py && node tools/demo-images/render-hero.mjs
"""

import re
from pathlib import Path

HERE = Path(__file__).parent
W, H = 1600, 900


def product(slug: str, prefix: str) -> str:
    """A product illustration without its studio background, ids namespaced."""
    svg = (HERE / "svg" / f"{slug}.svg").read_text()
    inner = svg.split(">", 1)[1].rsplit("</svg>", 1)[0]
    inner = re.sub(r'<rect width="1200" height="900" fill="url\(#bg\)"/>', "", inner)
    # Drop the studio floor shadow: the desk draws its own.
    inner = re.sub(r'<ellipse[^>]*fill="url\(#shadow\)"/>', "", inner)
    inner = re.sub(r'id="([^"]+)"', lambda m: f'id="{prefix}-{m.group(1)}"', inner)
    inner = re.sub(r"url\(#([^)]+)\)", lambda m: f"url(#{prefix}-{m.group(1)})", inner)
    return inner


def place(slug: str, prefix: str, x: float, y: float, scale: float, crop=(0, 0, 1200, 900)) -> str:
    cx, cy, cw, ch = crop
    return (
        f'<svg x="{x}" y="{y}" width="{cw * scale}" height="{ch * scale}" '
        f'viewBox="{cx} {cy} {cw} {ch}" overflow="visible">{product(slug, prefix)}</svg>'
    )


def soft_shadow(cx, cy, rx, ry, opacity=0.55):
    return (
        f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#desk-shadow)" '
        f'opacity="{opacity}"/>'
    )


def plant(x, y):
    leaves = []
    for i, (dx, dy, rot, s) in enumerate(
        [(-40, -150, -35, 1.0), (10, -190, -8, 1.15), (55, -150, 28, 1.0), (-70, -95, -60, 0.85),
         (85, -100, 55, 0.85), (-10, -120, -20, 0.9), (30, -130, 15, 0.95)]
    ):
        leaves.append(
            f'<ellipse cx="{x + dx}" cy="{y + dy}" rx="{22 * s}" ry="{70 * s}" '
            f'transform="rotate({rot} {x + dx} {y + dy})" fill="{"#2f6b45" if i % 2 else "#3f8a58"}"/>'
        )
    return f"""<g>
  {''.join(leaves)}
  <path d="M{x - 55} {y - 40} L {x + 55} {y - 40} L {x + 42} {y + 70} L {x - 42} {y + 70} Z" fill="#d8d2c6"/>
  <rect x="{x - 60}" y="{y - 48}" width="120" height="14" rx="5" fill="#e8e2d6"/>
</g>"""


def lamp(x, y):
    return f"""<g>
  <circle cx="{x}" cy="{y + 40}" r="320" fill="url(#lamp-glow)"/>
  <path d="M{x - 70} {y} L {x + 70} {y} L {x + 40} {y - 46} L {x - 40} {y - 46} Z" fill="#2a2420"/>
  <ellipse cx="{x}" cy="{y}" rx="70" ry="9" fill="#ffd9a0" opacity="0.9"/>
  <rect x="{x - 3}" y="{y - 46 - 160}" width="6" height="160" fill="#2a2420"/>
</g>"""


def scene() -> str:
    desk_y = 640
    body = f"""
<rect width="{W}" height="{H}" fill="url(#sky)"/>
{lamp(790, 215)}
<rect x="0" y="{desk_y}" width="{W}" height="{H - desk_y}" fill="url(#desk)"/>
<rect x="0" y="{desk_y}" width="{W}" height="3" fill="#3b4a66" opacity="0.6"/>
<rect x="1000" y="{desk_y + 45}" width="430" height="120" rx="10" fill="#141a26" opacity="0.7"/>
{soft_shadow(1180, desk_y + 18, 260, 22)}
{place('arden-27-4k-usb-c', 'mon', 740, 50, 0.92, (180, 80, 840, 720))}
{plant(1490, desk_y - 10)}
{soft_shadow(780, desk_y + 120, 330, 30)}
{place('vela-15-studio', 'lap', 470, 330, 0.66, (0, 100, 1200, 700))}
{soft_shadow(1000, desk_y + 30, 120, 18)}
{place('halo-anc-headphones', 'hp', 840, 300, 0.42, (150, 60, 900, 820))}
{soft_shadow(1110, desk_y + 70, 70, 12)}
{place('orbit-phone-256', 'ph', 1030, 400, 0.34, (300, 60, 600, 820))}
{soft_shadow(1250, desk_y + 120, 150, 20)}
{place('pulse-controller', 'ctl', 1130, 520, 0.36, (150, 180, 900, 560))}
<rect width="{W}" height="{H}" fill="url(#vignette)"/>
"""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0b1220"/><stop offset="0.6" stop-color="#121c33"/><stop offset="1" stop-color="#1b2a4a"/>
  </linearGradient>
  <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a3550"/><stop offset="1" stop-color="#121826"/>
  </linearGradient>
  <radialGradient id="lamp-glow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#ffb35c" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb35c" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="desk-shadow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#000" stop-opacity="0.8"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="0.65" cy="0.45" r="0.8">
    <stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/>
  </radialGradient>
</defs>
{body}
</svg>"""


SPRITES = ["arden-27-4k-usb-c", "vela-15-studio", "halo-anc-headphones", "orbit-phone-256", "pulse-controller"]


def backdrop() -> str:
    """The room and desk only; products are composited on top (render-hero.mjs + compose)."""
    full = scene()
    return re.sub(r"<svg x=.*?</svg>\n", "", full, flags=re.S)


if __name__ == "__main__":
    (HERE / "svg" / "_hero-desk.svg").write_text(backdrop())
    sprites = HERE / "sprites"
    sprites.mkdir(exist_ok=True)
    for slug in SPRITES:
        (sprites / f"{slug}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">{product(slug, "p")}</svg>'
        )
    print("wrote backdrop and", len(SPRITES), "sprites")

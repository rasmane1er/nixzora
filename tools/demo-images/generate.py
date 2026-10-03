"""Draws the demo catalog's product illustrations (original artwork, no real brands).

Writes one SVG per product slug to ./svg; render.mjs turns them into WebP for the storefront.
Run: python3 tools/demo-images/generate.py && node tools/demo-images/render.mjs
"""

from pathlib import Path

W, H = 1200, 900
OUT = Path(__file__).parent / "svg"


def page(body: str, bg=("#f4f1ea", "#e6e1d6"), defs: str = "") -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{bg[0]}"/><stop offset="1" stop-color="{bg[1]}"/>
  </linearGradient>
  <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#000" stop-opacity="0.28"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  {defs}
</defs>
<rect width="{W}" height="{H}" fill="url(#bg)"/>
{body}
</svg>"""


def shadow(cx, cy, rx, ry):
    return f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="url(#shadow)"/>'


def wallpaper(id_, a, b, c):
    return f"""<linearGradient id="{id_}" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="{a}"/><stop offset="0.55" stop-color="{b}"/><stop offset="1" stop-color="{c}"/>
</linearGradient>"""


def screen_art(x, y, w, h, wp, r=6):
    """A wallpaper with soft waves, used on laptops, monitors and phones."""
    return f"""<g>
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="url(#{wp})"/>
  <path d="M{x} {y + h * 0.62} C {x + w * 0.3} {y + h * 0.45}, {x + w * 0.6} {y + h * 0.85}, {x + w} {y + h * 0.6} L {x + w} {y + h} L {x} {y + h} Z" fill="#fff" opacity="0.12"/>
  <path d="M{x} {y + h * 0.78} C {x + w * 0.35} {y + h * 0.6}, {x + w * 0.65} {y + h * 0.98}, {x + w} {y + h * 0.75} L {x + w} {y + h} L {x} {y + h} Z" fill="#fff" opacity="0.1"/>
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="url(#gloss)"/>
</g>"""


# ───────────── Devices ─────────────


def laptop(body, edge, keys, wp, slim=1.0, accent=None):
    sw, sh = 640 * slim + 40, 400
    sx, sy = (W - sw) / 2, 140
    base_y = sy + sh + 18
    bw = sw + 120
    bx = (W - bw) / 2
    depth = 120 * slim + 20
    kb = []
    rows, cols = 5, 14
    kx0, ky0 = bx + 120, base_y + 14
    kw = (bw - 240) / cols
    kh = (depth - 50) / rows
    for r in range(rows):
        for c in range(cols):
            inset = r * 6
            kb.append(
                f'<rect x="{kx0 + inset + c * (kw - inset * 2 / cols):.1f}" y="{ky0 + r * kh:.1f}" width="{kw - 4 - inset * 2 / cols:.1f}" height="{kh - 4:.1f}" rx="3" fill="{keys}"/>'
            )
    accent_line = (
        f'<rect x="{bx + 40}" y="{base_y + depth - 6}" width="{bw - 80}" height="3" rx="1.5" fill="{accent}"/>'
        if accent
        else ""
    )
    return page(
        f"""
{shadow(W / 2, base_y + depth + 20, bw * 0.55, 34)}
<rect x="{sx - 14}" y="{sy - 14}" width="{sw + 28}" height="{sh + 32}" rx="20" fill="{edge}"/>
<rect x="{sx - 8}" y="{sy - 8}" width="{sw + 16}" height="{sh + 16}" rx="14" fill="#0d0f14"/>
{screen_art(sx, sy, sw, sh, "wp")}
<circle cx="{W / 2}" cy="{sy - 2}" r="3" fill="#2a2f3a"/>
<path d="M{bx} {base_y} L {bx + bw} {base_y} L {bx + bw - 30} {base_y + depth} L {bx + 30} {base_y + depth} Z" fill="{body}"/>
<path d="M{bx} {base_y} L {bx + bw} {base_y} L {bx + bw - 6} {base_y + 8} L {bx + 6} {base_y + 8} Z" fill="#fff" opacity="0.25"/>
{''.join(kb)}
<rect x="{W / 2 - 90}" y="{base_y + depth - 44}" width="180" height="34" rx="6" fill="#000" opacity="0.08"/>
<path d="M{bx + 30} {base_y + depth} L {bx + bw - 30} {base_y + depth} L {bx + bw - 34} {base_y + depth + 10} L {bx + 34} {base_y + depth + 10} Z" fill="{edge}"/>
{accent_line}
""",
        defs=wallpaper("wp", *wp),
    )


def tower():
    x, y, w, h = 430, 110, 340, 640
    fans = "".join(
        f'<circle cx="{x + w / 2 + 20}" cy="{y + 150 + i * 170}" r="62" fill="none" stroke="url(#rgb)" stroke-width="10"/>'
        f'<circle cx="{x + w / 2 + 20}" cy="{y + 150 + i * 170}" r="44" fill="#141821"/>'
        f'<circle cx="{x + w / 2 + 20}" cy="{y + 150 + i * 170}" r="12" fill="#2b3140"/>'
        for i in range(3)
    )
    return page(
        f"""
{shadow(W / 2, y + h + 18, 230, 26)}
<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="#22262f"/>
<rect x="{x + 18}" y="{y + 18}" width="{w - 36}" height="{h - 36}" rx="10" fill="#0e1117"/>
{fans}
<rect x="{x + 18}" y="{y + 18}" width="{w - 36}" height="{h - 36}" rx="10" fill="url(#gloss)"/>
<rect x="{x + 40}" y="{y + 26}" width="60" height="8" rx="4" fill="#3a404d"/>
<circle cx="{x + w - 40}" cy="{y + 30}" r="6" fill="#6fd1c7"/>
<rect x="{x + 10}" y="{y + h - 6}" width="40" height="14" rx="4" fill="#15181e"/>
<rect x="{x + w - 50}" y="{y + h - 6}" width="40" height="14" rx="4" fill="#15181e"/>
""",
        defs="""<linearGradient id="rgb" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#e8622c"/><stop offset="0.5" stop-color="#d94a8c"/><stop offset="1" stop-color="#4f7cff"/>
</linearGradient>""",
    )


def monitor(width, height, wp, curved=False, frame="#1a1d24", stand="#9aa0aa"):
    x, y = (W - width) / 2, 120
    if curved:
        bezel = f'<path d="M{x - 12} {y - 12} Q {W / 2} {y + 26} {x + width + 12} {y - 12} L {x + width + 12} {y + height + 12} Q {W / 2} {y + height + 46} {x - 12} {y + height + 12} Z" fill="{frame}"/>'
        clip = f'<clipPath id="cv"><path d="M{x} {y} Q {W / 2} {y + 34} {x + width} {y} L {x + width} {y + height} Q {W / 2} {y + height + 34} {x} {y + height} Z"/></clipPath>'
        art = f'<g clip-path="url(#cv)">{screen_art(x, y, width, height + 40, "wp", 0)}</g>'
    else:
        bezel = f'<rect x="{x - 12}" y="{y - 12}" width="{width + 24}" height="{height + 24}" rx="12" fill="{frame}"/>'
        clip = ""
        art = screen_art(x, y, width, height, "wp", 4)
    neck_top = y + height + (30 if curved else 12)
    return page(
        f"""
{shadow(W / 2, 770, 260, 26)}
<path d="M{W / 2 - 34} {neck_top} L {W / 2 + 34} {neck_top} L {W / 2 + 24} 740 L {W / 2 - 24} 740 Z" fill="{stand}"/>
<path d="M{W / 2 - 170} 760 Q {W / 2} 732 {W / 2 + 170} 760 L {W / 2 + 160} 772 L {W / 2 - 160} 772 Z" fill="{stand}"/>
{bezel}
{art}
<rect x="{W / 2 - 18}" y="{y + height + (22 if curved else 4)}" width="36" height="4" rx="2" fill="#3a3f4a"/>
""",
        defs=wallpaper("wp", *wp) + clip,
    )


def headphones(band, cup, pad, accent):
    return page(
        f"""
{shadow(W / 2, 770, 280, 28)}
<path d="M360 520 C 360 200, 840 200, 840 520" fill="none" stroke="{band}" stroke-width="46" stroke-linecap="round"/>
<path d="M372 500 C 380 250, 820 250, 828 500" fill="none" stroke="#fff" stroke-opacity="0.18" stroke-width="10" stroke-linecap="round"/>
<rect x="330" y="470" width="60" height="70" rx="14" fill="{band}"/>
<rect x="810" y="470" width="60" height="70" rx="14" fill="{band}"/>
<ellipse cx="350" cy="620" rx="118" ry="150" fill="{cup}"/>
<ellipse cx="850" cy="620" rx="118" ry="150" fill="{cup}"/>
<ellipse cx="392" cy="620" rx="72" ry="118" fill="{pad}"/>
<ellipse cx="808" cy="620" rx="72" ry="118" fill="{pad}"/>
<ellipse cx="320" cy="560" rx="60" ry="70" fill="url(#gloss)"/>
<ellipse cx="880" cy="560" rx="60" ry="70" fill="url(#gloss)"/>
<rect x="276" y="600" width="8" height="40" rx="4" fill="{accent}"/>
"""
    )


def earbuds():
    return page(
        f"""
{shadow(W / 2, 760, 260, 26)}
<rect x="380" y="430" width="440" height="300" rx="130" fill="#f6f5f1"/>
<rect x="380" y="430" width="440" height="140" rx="70" fill="#e9e6df"/>
<path d="M380 560 L 820 560" stroke="#d8d4ca" stroke-width="3"/>
<rect x="380" y="430" width="440" height="300" rx="130" fill="url(#gloss)"/>
<circle cx="600" cy="660" r="6" fill="#6fd1c7"/>
<g transform="translate(470 300) rotate(-18)">
  <ellipse cx="0" cy="0" rx="62" ry="70" fill="#2a2621"/>
  <rect x="-18" y="40" width="36" height="120" rx="18" fill="#2a2621"/>
  <ellipse cx="-14" cy="-10" rx="22" ry="26" fill="#fff" opacity="0.15"/>
</g>
<g transform="translate(730 300) rotate(18)">
  <ellipse cx="0" cy="0" rx="62" ry="70" fill="#2a2621"/>
  <rect x="-18" y="40" width="36" height="120" rx="18" fill="#2a2621"/>
  <ellipse cx="-14" cy="-10" rx="22" ry="26" fill="#fff" opacity="0.15"/>
</g>
"""
    )


def speaker(cx, scale=1.0, wood="#c9a27a", face="#2b2a28"):
    w, h = 230 * scale, 380 * scale
    x, y = cx - w / 2, 760 - h
    return f"""
<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" fill="{wood}"/>
<rect x="{x + 12}" y="{y + 12}" width="{w - 24}" height="{h - 24}" rx="12" fill="{face}"/>
<circle cx="{cx}" cy="{y + h * 0.28}" r="{38 * scale}" fill="#16171a"/>
<circle cx="{cx}" cy="{y + h * 0.28}" r="{14 * scale}" fill="#4a4b50"/>
<circle cx="{cx}" cy="{y + h * 0.65}" r="{78 * scale}" fill="#16171a"/>
<circle cx="{cx}" cy="{y + h * 0.65}" r="{58 * scale}" fill="#24252a"/>
<circle cx="{cx}" cy="{y + h * 0.65}" r="{20 * scale}" fill="#4a4b50"/>
<rect x="{x + 12}" y="{y + 12}" width="{w - 24}" height="{h - 24}" rx="12" fill="url(#gloss)"/>
"""


def speakers(wood="#c9a27a", face="#2b2a28", scale=1.0, bg=("#f4f1ea", "#e6e1d6")):
    return page(
        f"{shadow(W / 2, 772, 360, 28)}{speaker(430, scale, wood, face)}{speaker(770, scale, wood, face)}",
        bg=bg,
    )


def phone():
    x, y, w, h = 470, 90, 260, 560
    return page(
        f"""
{shadow(W / 2 + 40, 760, 220, 24)}
<g transform="rotate(-8 600 420)">
  <rect x="{x - 8}" y="{y - 8}" width="{w + 16}" height="{h + 16}" rx="44" fill="#3d4352"/>
  <rect x="{x}" y="{y}" width="{w}" height="{h}" rx="36" fill="#0b0d12"/>
  {screen_art(x + 10, y + 10, w - 20, h - 20, "wp", 28)}
  <rect x="{x + w / 2 - 40}" y="{y + 22}" width="80" height="22" rx="11" fill="#0b0d12"/>
  <text x="{x + w / 2}" y="{y + 150}" text-anchor="middle" font-family="Helvetica, Arial" font-size="58" font-weight="300" fill="#fff">9:41</text>
  <rect x="{x + 40}" y="{y + h - 70}" width="{w - 80}" height="6" rx="3" fill="#fff" opacity="0.6"/>
</g>
""",
        defs=wallpaper("wp", "#283c86", "#45a247", "#f0b35c"),
    )


def smart_hub():
    return page(
        f"""
{shadow(W / 2, 680, 250, 30)}
<ellipse cx="600" cy="620" rx="250" ry="70" fill="#d9d6cf"/>
<rect x="350" y="430" width="500" height="190" fill="#ece9e2"/>
<ellipse cx="600" cy="430" rx="250" ry="70" fill="#f8f7f3"/>
<ellipse cx="600" cy="430" rx="190" ry="50" fill="none" stroke="url(#ring)" stroke-width="10"/>
<ellipse cx="600" cy="430" rx="120" ry="30" fill="#efede7"/>
<g fill="#cfcac0">{''.join(f'<circle cx="{370 + i * 26}" cy="{560 + (i % 2) * 14}" r="5"/>' for i in range(18))}</g>
""",
        defs="""<linearGradient id="ring" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#6fd1c7"/><stop offset="1" stop-color="#4f7cff"/>
</linearGradient>""",
    )


def plug(cx, cy):
    return f"""
<rect x="{cx - 80}" y="{cy - 80}" width="160" height="160" rx="36" fill="#f7f6f2"/>
<rect x="{cx - 80}" y="{cy - 80}" width="160" height="160" rx="36" fill="url(#gloss)"/>
<rect x="{cx - 26}" y="{cy - 30}" width="10" height="34" rx="4" fill="#3b3b3b"/>
<rect x="{cx + 16}" y="{cy - 30}" width="10" height="34" rx="4" fill="#3b3b3b"/>
<circle cx="{cx}" cy="{cy + 34}" r="10" fill="#3b3b3b"/>
<circle cx="{cx + 58}" cy="{cy - 58}" r="6" fill="#6fd1c7"/>
"""


def smart_plugs():
    return page(
        f"{shadow(W / 2, 780, 360, 26)}"
        + plug(450, 380)
        + plug(750, 380)
        + plug(450, 640)
        + plug(750, 640)
    )


def controller():
    return page(
        f"""
{shadow(W / 2, 760, 330, 30)}
<path d="M330 380 C 380 300, 820 300, 870 380 L 960 640 C 990 740, 860 780, 800 690 L 740 610 L 460 610 L 400 690 C 340 780, 210 740, 240 640 Z" fill="#20242c"/>
<path d="M360 390 C 420 330, 780 330, 840 390" fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="14" stroke-linecap="round"/>
<circle cx="450" cy="460" r="52" fill="#11141a"/><circle cx="450" cy="460" r="34" fill="#2c313b"/>
<circle cx="690" cy="560" r="52" fill="#11141a"/><circle cx="690" cy="560" r="34" fill="#2c313b"/>
<g fill="#3a404c"><rect x="490" y="540" width="26" height="78" rx="6"/><rect x="464" y="566" width="78" height="26" rx="6" transform="translate(-2 -2)"/></g>
<circle cx="790" cy="420" r="20" fill="#e8622c"/>
<circle cx="840" cy="465" r="20" fill="#6fd1c7"/>
<circle cx="740" cy="465" r="20" fill="#4f7cff"/>
<circle cx="790" cy="510" r="20" fill="#f0c24b"/>
<rect x="565" y="430" width="70" height="14" rx="7" fill="#e8622c" opacity="0.85"/>
"""
    )


def keyboard_rows(x, y, w, h, cols, rows, key="#f2efe8", mod="#b9b2a4", accent=None):
    out = []
    kw, kh = w / cols, h / rows
    for r in range(rows):
        for c in range(cols):
            fill = mod if (c == 0 or c == cols - 1) else key
            if accent and r == 0 and c == 0:
                fill = accent
            out.append(
                f'<rect x="{x + c * kw + 3:.1f}" y="{y + r * kh + 3:.1f}" width="{kw - 6:.1f}" height="{kh - 6:.1f}" rx="6" fill="{fill}"/>'
                f'<rect x="{x + c * kw + 7:.1f}" y="{y + r * kh + 5:.1f}" width="{kw - 14:.1f}" height="{kh - 16:.1f}" rx="4" fill="#fff" opacity="0.35"/>'
            )
    return "".join(out)


def keyboard75():
    x, y, w, h = 230, 300, 740, 300
    return page(
        f"""
{shadow(W / 2, 680, 420, 30)}
<g transform="skewX(-6) translate(40 0)">
<rect x="{x - 24}" y="{y - 24}" width="{w + 48}" height="{h + 48}" rx="22" fill="#3a3f49"/>
{keyboard_rows(x, y, w, h, 15, 6, accent="#e8622c")}
</g>
"""
    )


def split_keyboard():
    def half(x, rot):
        return f"""<g transform="rotate({rot} {x + 170} 450)">
<rect x="{x - 20}" y="320" width="380" height="270" rx="22" fill="#dcd6ca"/>
{keyboard_rows(x, 340, 340, 230, 7, 5, key="#2f333b", mod="#4a505c")}
</g>"""

    return page(f"{shadow(W / 2, 680, 470, 28)}{half(150, 8)}{half(690, -8)}")


def mouse():
    return page(
        f"""
{shadow(W / 2 + 10, 730, 170, 30)}
<path d="M600 200 C 760 200, 790 340, 780 470 C 770 620, 700 720, 600 720 C 500 720, 430 620, 420 470 C 410 340, 440 200, 600 200 Z" fill="#2a2e36"/>
<path d="M600 210 L 600 400" stroke="#14171c" stroke-width="5"/>
<path d="M430 420 C 520 440, 680 440, 772 420" fill="none" stroke="#14171c" stroke-width="4"/>
<rect x="588" y="260" width="24" height="70" rx="12" fill="#6fd1c7"/>
<path d="M470 260 C 520 220, 560 214, 590 214 L 590 400 L 440 400 C 440 330, 450 290, 470 260 Z" fill="url(#gloss)"/>
<rect x="408" y="470" width="18" height="60" rx="8" fill="#14171c"/>
"""
    )


def watch():
    return page(
        f"""
{shadow(W / 2, 800, 180, 22)}
<rect x="500" y="40" width="200" height="300" rx="40" fill="#e8622c"/>
<rect x="500" y="560" width="200" height="300" rx="40" fill="#e8622c"/>
<rect x="430" y="250" width="340" height="400" rx="88" fill="#2b2f37"/>
<rect x="452" y="272" width="296" height="356" rx="70" fill="#07080b"/>
<circle cx="600" cy="450" r="118" fill="none" stroke="#e8622c" stroke-width="18" stroke-dasharray="520 900" transform="rotate(-90 600 450)"/>
<circle cx="600" cy="450" r="88" fill="none" stroke="#6fd1c7" stroke-width="18" stroke-dasharray="360 900" transform="rotate(-90 600 450)"/>
<text x="600" y="466" text-anchor="middle" font-family="Helvetica, Arial" font-size="56" font-weight="600" fill="#fff">10:09</text>
<rect x="770" y="380" width="24" height="70" rx="10" fill="#4a505c"/>
<rect x="452" y="272" width="296" height="356" rx="70" fill="url(#gloss)"/>
"""
    )


PRODUCTS = {
    "kestrel-14-pro": laptop("#5b616c", "#40454e", "#2a2e35", ("#1f2a44", "#3b5ba5", "#9fc4ff")),
    "arden-16": laptop("#24262b", "#18191d", "#111215", ("#2b0f1a", "#b0324a", "#f3a35c"), accent="#e8622c"),
    "vela-15-studio": laptop("#c9ccd2", "#a9adb5", "#e9ebee", ("#120b3a", "#7b2ff7", "#ff6a88")),
    "vela-13-air": laptop("#e3d5c2", "#c8b79f", "#f6efe4", ("#f6d365", "#fda085", "#f5576c"), slim=0.88),
    "kestrel-tower-x": tower(),
    "arden-27-4k-usb-c": monitor(620, 350, ("#0f2027", "#2c5364", "#7fd1c7")),
    "arden-34-ultrawide": monitor(860, 360, ("#1a1a40", "#7a0bc0", "#fa58b6"), curved=True),
    "lumen-24-everyday": monitor(560, 320, ("#d4e9ff", "#8ab6e8", "#3d6bb3"), frame="#f2f2f0", stand="#e0ded8"),
    "halo-anc-headphones": headphones("#1f2228", "#2a2e36", "#14161a", "#6fd1c7"),
    "drift-over-ear": headphones("#7a5a40", "#efe6d8", "#c9b9a3", "#e8622c"),
    "drift-earbuds": earbuds(),
    "lumen-desk-speakers": speakers(),
    "orbit-phone-256": phone(),
    "nimbus-smart-hub": smart_hub(),
    "nimbus-smart-plug-4": smart_plugs(),
    "pulse-controller": controller(),
    "tactile-75": keyboard75(),
    "tactile-ergo-split": split_keyboard(),
    "tactile-precision-mouse": mouse(),
    "pulse-s-watch": watch(),
    # Demo marketplace seller "Brightline Audio" (Phase 7)
    "brightline-bookshelf-speakers": speakers("#6b4a32", "#e9e4da", 1.12, ("#eef1f4", "#d9dee5")),
    "brightline-studio-headphones": headphones("#8c2f2f", "#2b2d33", "#17181c", "#f2c14e"),
}

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, svg in PRODUCTS.items():
        (OUT / f"{slug}.svg").write_text(svg)
    print(f"wrote {len(PRODUCTS)} SVGs to {OUT}")

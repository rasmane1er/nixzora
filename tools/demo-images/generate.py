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


# ───────────── Clothing & shoes ─────────────


def tee(color, trim, label="#fff"):
    return page(
        f"""
{shadow(W / 2, 805, 300, 26)}
<path d="M430 160 L320 205 L215 330 L315 400 L382 335 L382 770 Q600 792 818 770 L818 335 L885 400 L985 330 L880 205 L770 160 Q700 222 600 222 Q500 222 430 160 Z" fill="{color}"/>
<path d="M430 160 Q500 222 600 222 Q700 222 770 160 Q700 250 600 250 Q500 250 430 160 Z" fill="{trim}"/>
<path d="M248 300 L338 368 M952 300 L862 368" stroke="{trim}" stroke-width="10" stroke-linecap="round"/>
<path d="M382 742 Q600 764 818 742" stroke="{trim}" stroke-width="8" fill="none" opacity="0.7"/>
<rect x="575" y="262" width="50" height="26" rx="4" fill="{label}" opacity="0.85"/>
<path d="M382 335 L382 770 Q600 792 818 770 L818 335" fill="url(#gloss)" opacity="0.5"/>
"""
    )


def hoodie(color, trim):
    return page(
        f"""
{shadow(W / 2, 815, 330, 26)}
<path d="M470 150 Q600 60 730 150 L760 230 Q600 300 440 230 Z" fill="{trim}"/>
<path d="M440 175 L330 220 L250 560 L235 760 L330 768 L350 580 L392 380 L392 780 Q600 800 808 780 L808 380 L850 580 L870 768 L965 760 L950 560 L870 220 L760 175 Q700 260 600 262 Q500 260 440 175 Z" fill="{color}"/>
<rect x="232" y="728" width="102" height="44" rx="14" fill="{trim}"/>
<rect x="866" y="728" width="102" height="44" rx="14" fill="{trim}"/>
<rect x="392" y="736" width="416" height="48" rx="10" fill="{trim}"/>
<path d="M470 560 L730 560 L770 700 L430 700 Z" fill="{trim}" opacity="0.55"/>
<path d="M570 262 L560 420 M630 262 L640 420" stroke="#f4f1ea" stroke-width="9" stroke-linecap="round"/>
<circle cx="560" cy="424" r="9" fill="#f4f1ea"/><circle cx="640" cy="424" r="9" fill="#f4f1ea"/>
<path d="M392 380 L392 780 Q600 800 808 780 L808 380" fill="url(#gloss)" opacity="0.45"/>
"""
    )


def rain_jacket(color, trim):
    return page(
        f"""
{shadow(W / 2, 830, 330, 26)}
<path d="M480 120 Q600 40 720 120 L742 210 Q600 250 458 210 Z" fill="{trim}"/>
<path d="M455 170 L338 215 L262 560 L248 770 L342 778 L360 590 L398 395 L398 800 L802 800 L802 395 L840 590 L858 778 L952 770 L938 560 L862 215 L745 170 L600 250 Z" fill="{color}"/>
<path d="M600 250 L600 800" stroke="{trim}" stroke-width="12"/>
<path d="M600 250 L600 800" stroke="#d9d2c2" stroke-width="3" stroke-dasharray="6 8"/>
<path d="M455 170 L600 250 L745 170 L720 230 L600 290 L480 230 Z" fill="{trim}"/>
<rect x="430" y="560" width="130" height="18" rx="6" fill="{trim}"/><rect x="640" y="560" width="130" height="18" rx="6" fill="{trim}"/>
<path d="M440 578 L440 690 M760 578 L760 690" stroke="{trim}" stroke-width="5" opacity="0.6"/>
<rect x="246" y="740" width="98" height="40" rx="12" fill="{trim}"/><rect x="856" y="740" width="98" height="40" rx="12" fill="{trim}"/>
<path d="M398 395 L398 800 L600 800 L600 250" fill="url(#gloss)" opacity="0.55"/>
"""
    )


def sneaker(upper, accent, sole="#f7f5f0"):
    laces = "".join(
        f'<path d="M{x - 14} {y - 22} L{x + 14} {y + 22}" stroke="#f7f5f0" stroke-width="10" stroke-linecap="round"/>'
        for x, y in [(610, 430), (660, 452), (710, 474), (760, 496)]
    )
    return page(
        f"""
{shadow(W / 2, 700, 440, 32)}
<g transform="translate(-60 -120) scale(1.1)">
<path d="M210 645 L220 470 Q230 425 290 420 Q380 418 440 470 L520 395 Q560 378 592 404 L820 505 Q960 545 1005 615 Q1015 645 990 650 Z" fill="{upper}"/>
<path d="M440 470 L520 395 Q560 378 592 404 L560 450 Q500 430 460 480 Z" fill="#2b2f37" opacity="0.25"/>
<path d="M300 610 Q480 520 720 560 Q520 600 320 650 Z" fill="{accent}"/>
<path d="M220 470 Q230 425 290 420 L300 474 Q258 486 224 530 Z" fill="{accent}"/>
{laces}
<path d="M200 640 Q200 702 262 704 L990 698 Q1042 692 1030 640 L1005 640 Q992 662 960 662 L240 666 Q210 664 205 640 Z" fill="{sole}"/>
<path d="M214 684 L1018 676" stroke="#cfc8ba" stroke-width="6"/>
<path d="M240 470 Q300 430 420 460" fill="none" stroke="#fff" stroke-width="6" opacity="0.45"/>
</g>
"""
    )


# ───────────── Home & kitchen ─────────────


def kettle(body, trim):
    return page(
        f"""
{shadow(W / 2, 800, 260, 26)}
<rect x="400" y="740" width="400" height="48" rx="22" fill="#24272d"/>
<path d="M450 300 L750 300 Q800 520 790 720 Q600 760 410 720 Q400 520 450 300 Z" fill="{body}"/>
<path d="M450 300 Q600 270 750 300 L740 330 Q600 305 460 330 Z" fill="{trim}"/>
<rect x="560" y="246" width="80" height="44" rx="18" fill="{trim}"/>
<path d="M760 340 Q900 360 900 520 Q900 650 785 690" fill="none" stroke="{trim}" stroke-width="46" stroke-linecap="round"/>
<path d="M455 380 L330 300 L310 312 L420 470 Z" fill="{body}"/>
<rect x="470" y="420" width="34" height="230" rx="16" fill="#9fd3ff" opacity="0.55"/>
<path d="M470 560 L504 560" stroke="#3a7bd5" stroke-width="5"/>
<path d="M470 360 Q520 330 560 340 L540 700 Q470 690 440 660 Q430 500 470 360 Z" fill="url(#gloss)"/>
<circle cx="760" cy="732" r="9" fill="#e8622c"/>
"""
    )


def skillet():
    return page(
        f"""
{shadow(560, 700, 330, 40)}
<rect x="800" y="430" width="330" height="62" rx="30" fill="#25272b"/>
<circle cx="1090" cy="461" r="14" fill="#e6e1d6"/>
<ellipse cx="540" cy="460" rx="330" ry="250" fill="#2a2c31"/>
<ellipse cx="540" cy="470" rx="290" ry="214" fill="#17181b"/>
<ellipse cx="540" cy="480" rx="250" ry="180" fill="#1e2024"/>
<path d="M340 400 Q420 300 560 290" fill="none" stroke="#fff" stroke-width="10" opacity="0.18" stroke-linecap="round"/>
<path d="M210 450 L190 470" stroke="#2a2c31" stroke-width="40" stroke-linecap="round"/>
"""
    )


def coffee_maker():
    return page(
        f"""
{shadow(W / 2, 805, 260, 26)}
<rect x="400" y="130" width="400" height="120" rx="30" fill="#2b2f37"/>
<rect x="690" y="130" width="110" height="660" rx="30" fill="#2b2f37"/>
<rect x="400" y="740" width="400" height="56" rx="20" fill="#1f2228"/>
<rect x="430" y="250" width="160" height="30" rx="10" fill="#14161a"/>
<path d="M440 420 L640 420 L660 700 Q600 740 520 740 Q440 740 420 700 Z" fill="#cfe6f2" opacity="0.6"/>
<path d="M432 560 L652 560 L660 700 Q600 740 520 740 Q440 740 420 700 Z" fill="#5a3825"/>
<path d="M640 470 Q690 480 690 560 Q690 640 650 650" fill="none" stroke="#1f2228" stroke-width="26"/>
<rect x="430" y="400" width="220" height="26" rx="10" fill="#1f2228"/>
<circle cx="745" cy="320" r="16" fill="#e8622c"/><circle cx="745" cy="380" r="16" fill="#6fd1c7"/>
<rect x="715" y="430" width="60" height="30" rx="8" fill="#0b0c0f"/><text x="745" y="452" text-anchor="middle" font-family="Helvetica, Arial" font-size="18" fill="#6fd1c7">7:30</text>
<path d="M440 430 L470 430 L480 720 L452 712 Z" fill="#fff" opacity="0.35"/>
"""
    )


def blanket(color, stripe):
    layers = ""
    for i, y in enumerate((620, 520, 420)):
        layers += f'<rect x="300" y="{y}" width="600" height="110" rx="40" fill="{color}"/>'
        layers += f'<path d="M320 {y + 30} Q600 {y + 10} 880 {y + 30}" stroke="{stripe}" stroke-width="10" fill="none" opacity="0.8"/>'
        layers += f'<path d="M300 {y + 80} Q600 {y + 100} 900 {y + 80}" stroke="#000" stroke-width="3" fill="none" opacity="0.12"/>'
    fringe = "".join(f'<path d="M{x} 730 L{x - 6} 770" stroke="{color}" stroke-width="8" stroke-linecap="round"/>' for x in range(320, 890, 26))
    return page(
        f"""
{shadow(W / 2, 790, 340, 28)}
{layers}{fringe}
<rect x="300" y="420" width="600" height="110" rx="40" fill="url(#gloss)" opacity="0.6"/>
"""
    )


# ───────────── Beauty & personal care ─────────────


def serum():
    return page(
        f"""
{shadow(W / 2, 790, 170, 22)}
<rect x="555" y="110" width="90" height="130" rx="44" fill="#1d1f24"/>
<rect x="535" y="230" width="130" height="80" rx="12" fill="#2b2f37"/>
<path d="M470 360 Q470 300 530 300 L670 300 Q730 300 730 360 L730 740 Q730 780 690 780 L510 780 Q470 780 470 740 Z" fill="#c9782f" opacity="0.92"/>
<rect x="500" y="430" width="200" height="230" rx="12" fill="#f6efe4"/>
<text x="600" y="520" text-anchor="middle" font-family="Helvetica, Arial" font-size="30" font-weight="700" fill="#2b2f37" letter-spacing="3">DEWDROP</text>
<text x="600" y="565" text-anchor="middle" font-family="Helvetica, Arial" font-size="22" fill="#5f6673">hydrating serum</text>
<text x="600" y="625" text-anchor="middle" font-family="Helvetica, Arial" font-size="20" fill="#5f6673">30 ml</text>
<path d="M490 330 L540 330 L530 760 L492 740 Z" fill="#fff" opacity="0.3"/>
"""
    )


def sunscreen():
    return page(
        f"""
{shadow(W / 2, 760, 330, 26)}
<g transform="rotate(-12 600 500)">
<path d="M300 380 L820 400 Q860 402 860 440 L860 560 Q860 598 820 600 L300 620 Z" fill="#fdf7ec"/>
<path d="M300 380 L260 420 L260 580 L300 620 Z" fill="#e8dcc6"/>
<rect x="858" y="410" width="120" height="180" rx="26" fill="#f2a541"/>
<rect x="968" y="440" width="22" height="120" rx="8" fill="#d98a2b"/>
<rect x="420" y="430" width="300" height="140" rx="16" fill="#f2a541" opacity="0.18"/>
<text x="570" y="495" text-anchor="middle" font-family="Helvetica, Arial" font-size="58" font-weight="800" fill="#e8622c">SPF 50</text>
<text x="570" y="545" text-anchor="middle" font-family="Helvetica, Arial" font-size="24" fill="#5f6673" letter-spacing="2">DEWDROP · DAILY</text>
<path d="M300 400 L820 418 L820 450 L300 440 Z" fill="#fff" opacity="0.7"/>
</g>
"""
    )


def hair_dryer(body, trim):
    return page(
        f"""
{shadow(W / 2, 800, 300, 26)}
<path d="M560 460 L640 460 L700 780 Q660 800 620 790 Z" fill="{body}"/>
<rect x="606" y="560" width="22" height="70" rx="10" fill="{trim}" transform="rotate(-11 617 595)"/>
<circle cx="420" cy="330" r="170" fill="{body}"/>
<circle cx="420" cy="330" r="120" fill="{trim}" opacity="0.35"/>
<g stroke="{body}" stroke-width="10" opacity="0.8"><path d="M330 330 L510 330"/><path d="M420 240 L420 420"/><path d="M356 266 L484 394"/><path d="M356 394 L484 266"/></g>
<path d="M420 160 L860 230 Q900 240 900 280 L900 380 Q900 420 860 430 L420 500 Z" fill="{body}"/>
<rect x="890" y="236" width="120" height="188" rx="24" fill="#2b2f37"/>
<path d="M440 180 L860 244 L860 280 L440 230 Z" fill="#fff" opacity="0.3"/>
<circle cx="740" cy="330" r="16" fill="{trim}"/>
"""
    )


def trimmer():
    teeth = "".join(f'<rect x="{x}" y="150" width="10" height="46" rx="3" fill="#c9ccd2"/>' for x in range(522, 680, 18))
    return page(
        f"""
{shadow(W / 2, 810, 170, 22)}
{teeth}
<rect x="510" y="190" width="180" height="40" rx="10" fill="#9aa1ad"/>
<path d="M500 230 L700 230 Q730 240 728 290 L700 760 Q690 800 650 800 L550 800 Q510 800 500 760 L472 290 Q470 240 500 230 Z" fill="#23262d"/>
<rect x="560" y="340" width="80" height="120" rx="40" fill="#e8622c"/>
<g fill="#6fd1c7"><circle cx="575" cy="540" r="7"/><circle cx="600" cy="540" r="7"/><circle cx="625" cy="540" r="7"/></g>
<path d="M500 250 L540 250 L560 780 L530 770 Z" fill="#fff" opacity="0.18"/>
<rect x="540" y="620" width="120" height="120" rx="20" fill="#2f333b"/>
"""
    )


# ───────────── Sports & outdoors ─────────────


def yoga_mat(color, edge):
    return page(
        f"""
{shadow(W / 2, 700, 420, 34)}
<rect x="250" y="390" width="700" height="300" rx="20" fill="{color}"/>
<rect x="250" y="390" width="700" height="300" rx="20" fill="url(#gloss)" opacity="0.4"/>
<ellipse cx="950" cy="540" rx="80" ry="150" fill="{edge}"/>
<path d="M950 430 A 60 110 0 1 1 949 430 M950 470 A 40 70 0 1 1 949 470 M950 505 A 20 35 0 1 1 949 505" fill="none" stroke="{color}" stroke-width="10"/>
<ellipse cx="250" cy="540" rx="80" ry="150" fill="{color}"/>
<rect x="420" y="380" width="40" height="320" rx="8" fill="#2b2f37"/><rect x="720" y="380" width="40" height="320" rx="8" fill="#2b2f37"/>
"""
    )


def dumbbells():
    def bell(cx, cy):
        plates = "".join(
            f'<rect x="{cx + dx - 18}" y="{cy - h / 2}" width="36" height="{h}" rx="10" fill="{c}"/>'
            for dx, h, c in [(-150, 240, "#2b2f37"), (-112, 210, "#3a3f4b"), (-76, 180, "#e8622c"), (76, 180, "#e8622c"), (112, 210, "#3a3f4b"), (150, 240, "#2b2f37")]
        )
        return f'<rect x="{cx - 60}" y="{cy - 16}" width="120" height="32" rx="12" fill="#9aa1ad"/>{plates}<rect x="{cx - 190}" y="{cy - 10}" width="380" height="20" rx="8" fill="#6b717c" opacity="0.6"/>'
    return page(
        f"""
{shadow(W / 2, 790, 380, 30)}
{bell(600, 600)}
{bell(600, 330)}
"""
    )


def backpack(color, trim):
    return page(
        f"""
{shadow(W / 2, 820, 290, 26)}
<path d="M520 150 Q600 90 680 150" fill="none" stroke="{trim}" stroke-width="26" stroke-linecap="round"/>
<path d="M380 290 Q380 170 600 165 Q820 170 820 290 L840 760 Q840 800 800 800 L400 800 Q360 800 360 760 Z" fill="{color}"/>
<path d="M410 280 Q600 230 790 280" fill="none" stroke="{trim}" stroke-width="10"/>
<path d="M440 520 Q440 480 480 480 L720 480 Q760 480 760 520 L760 720 Q760 750 730 750 L470 750 Q440 750 440 720 Z" fill="{trim}" opacity="0.85"/>
<path d="M460 500 L740 500" stroke="#d9d2c2" stroke-width="4" stroke-dasharray="8 6"/>
<rect x="700" y="490" width="16" height="44" rx="6" fill="#e8622c"/>
<rect x="320" y="520" width="60" height="220" rx="24" fill="{trim}"/>
<rect x="820" y="520" width="60" height="220" rx="24" fill="{trim}"/>
<path d="M392 290 Q400 200 520 180 L520 780 L400 780 Z" fill="url(#gloss)" opacity="0.6"/>
"""
    )


def bottle(color, cap):
    return page(
        f"""
{shadow(W / 2, 810, 160, 20)}
<rect x="540" y="120" width="120" height="90" rx="26" fill="{cap}"/>
<path d="M650 140 Q720 140 720 190 Q720 235 650 235" fill="none" stroke="{cap}" stroke-width="20"/>
<path d="M520 260 Q520 210 560 210 L640 210 Q680 210 680 260 L700 300 L700 760 Q700 800 660 800 L540 800 Q500 800 500 760 L500 300 Z" fill="{color}"/>
<rect x="500" y="300" width="200" height="20" fill="#000" opacity="0.08"/>
<path d="M520 320 L560 320 L560 780 L522 770 Z" fill="#fff" opacity="0.28"/>
<text x="610" y="560" text-anchor="middle" font-family="Helvetica, Arial" font-size="26" font-weight="700" fill="#fff" opacity="0.85" transform="rotate(-90 610 560)" letter-spacing="4">SUMMIT</text>
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
    # Clothing & shoes
    "linden-organic-tee": tee("#f4f1ea", "#d8d1c2", "#e8622c"),
    "linden-fleece-hoodie": hoodie("#8d939c", "#6d727a"),
    "alder-rain-jacket": rain_jacket("#5e6b3d", "#48532d"),
    "stride-runner": sneaker("#2f3b52", "#e8622c"),
    # Home & kitchen
    "hearth-electric-kettle": kettle("#2b2f37", "#1d2026"),
    "ferro-cast-iron-skillet": skillet(),
    "brewline-coffee-maker": coffee_maker(),
    "haven-throw-blanket": blanket("#d9c7a8", "#c2653f"),
    # Beauty & personal care
    "dewdrop-hydrating-serum": serum(),
    "dewdrop-daily-sunscreen": sunscreen(),
    "aero-ionic-hair-dryer": hair_dryer("#f0e9de", "#c9a46a"),
    "edgeline-beard-trimmer": trimmer(),
    # Sports & outdoors
    "core-yoga-mat": yoga_mat("#7f9c84", "#647e69"),
    "core-adjustable-dumbbells": dumbbells(),
    "trailhead-28-backpack": backpack("#2f5d6b", "#244a55"),
    "summit-insulated-bottle": bottle("#c2653f", "#2b2f37"),
}

# Extra views of every product, so the storefront gallery has several photos to swipe through:
# a close-up, an angled view and the product on a dark wooden table.
VIEWS = {
    "2": "Close-up",
    "3": "Angled",
    "4": "On a table",
}


def view(svg: str, kind: str) -> str:
    head, rest = svg.split("</defs>", 1)
    scene = rest.rsplit("</svg>", 1)[0]
    if kind == "2":
        return svg.replace(f'viewBox="0 0 {W} {H}"', f'viewBox="{W * 0.2:g} {H * 0.18:g} {W * 0.6:g} {H * 0.6:g}"', 1)
    if kind == "3":
        _, bg, body = scene.split("\n", 2)
        turn = f"rotate(-7 {W / 2:g} {H / 2:g}) translate({W / 2:g} {H / 2:g}) scale(0.9) translate({-W / 2:g} {-H / 2:g})"
        return f'{head}</defs>\n{bg}\n<g transform="{turn}">{body}</g></svg>'
    backdrop = f"""<radialGradient id="spot" cx="0.5" cy="0.45" r="0.7">
  <stop offset="0" stop-color="#3a3f4b"/><stop offset="1" stop-color="#14161b"/>
</radialGradient>
<linearGradient id="desk" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#6b4f38"/><stop offset="1" stop-color="#3e2d20"/>
</linearGradient>"""
    bg, body = scene.split("\n", 2)[1], scene.split("\n", 2)[2]
    dark = f'<rect width="{W}" height="{H}" fill="url(#spot)"/><rect y="{H * 0.74:g}" width="{W}" height="{H * 0.26:g}" fill="url(#desk)"/>'
    return f"{head}{backdrop}</defs>\n{dark}\n{body}</svg>" if bg.startswith("<rect") else svg


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, svg in PRODUCTS.items():
        (OUT / f"{slug}.svg").write_text(svg)
        for kind in VIEWS:
            (OUT / f"{slug}-{kind}.svg").write_text(view(svg, kind))
    print(f"wrote {len(PRODUCTS) * (1 + len(VIEWS))} SVGs to {OUT}")

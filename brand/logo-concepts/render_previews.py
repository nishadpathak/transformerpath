#!/usr/bin/env python3
"""Render TransformerPath logo-concept boards. Does not touch the live logo."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
ART = "/opt/cursor/artifacts"
FONT = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
FONT_MED = "/usr/share/fonts/truetype/macos/Inter-Medium.ttf"
FONT_REG = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"

NAVY = (13, 27, 46, 255)
AMBER = (245, 166, 35, 255)
WHITE = (255, 255, 255, 255)
INK = (13, 27, 46, 255)
MUTED = (90, 102, 118, 255)
LINE = (226, 229, 234, 255)
PAPER = (244, 245, 247, 255)
LIGHT_BG = (247, 248, 250, 255)
HAIR = (210, 214, 220, 255)

# Integer 16×16 masks. 1 = mark pixel.
def mask_core():
    m = [[0] * 16 for _ in range(16)]
    for y in range(1, 15):
        for x in range(1, 15):
            m[y][x] = 1
    for y in range(4, 12):
        for x in range(4, 6):
            m[y][x] = 0
        for x in range(10, 12):
            m[y][x] = 0
    return m

def mask_windings():
    m = [[0] * 16 for _ in range(16)]
    for y in range(1, 15):
        m[y][7] = m[y][8] = 1
    for y0 in (2, 7, 12):
        for y in range(y0, y0 + 2):
            for x in range(1, 5):
                m[y][x] = 1
            for x in range(11, 15):
                m[y][x] = 1
    return m

def mask_path():
    m = [[0] * 16 for _ in range(16)]
    for ox, oy in ((1, 1), (11, 1), (1, 11), (11, 11)):
        for y in range(oy, oy + 4):
            for x in range(ox, ox + 4):
                m[y][x] = 1
    for x in range(5, 11):
        m[2][x] = m[3][x] = 1
        m[12][x] = m[13][x] = 1
    for y in range(5, 11):
        m[y][12] = m[y][13] = 1
    return m

MARKS = {
    1: ("Three-limb core", "A core-type transformer seen end-on: two windows, a wider center limb.", mask_core),
    2: ("Core and windings", "A section through the core, with three turns on each side.", mask_windings),
    3: ("Grid path", "Four terminals on an open route — a path across a grid, not a closed box.", mask_path),
}

def font(path, size):
    return ImageFont.truetype(path, size)

def text_width(draw, s, f):
    b = draw.textbbox((0, 0), s, font=f)
    return b[2] - b[0]

def draw_mask(img, mask, ox, oy, scale, color):
    px = img.load()
    h = len(mask)
    w = len(mask[0])
    for y in range(h):
        for x in range(w):
            if not mask[y][x]:
                continue
            for dy in range(scale):
                for dx in range(scale):
                    px[ox + x * scale + dx, oy + y * scale + dy] = color

def lockup(mask, mark_color, word_color, path_color, mark_px, word_size, bg):
    """Return an RGBA image of mark + Transformerpath."""
    f = font(FONT, word_size)
    probe = ImageDraw.Draw(Image.new("RGBA", (8, 8)))
    tw = text_width(probe, "Transformer", f)
    pw = text_width(probe, "path", f)
    gap = max(8, mark_px // 3)
    ascent = f.getmetrics()[0]
    # Cap-height alignment: Inter cap height is about 0.72 of em.
    cap = int(round(word_size * 0.72))
    h = max(mark_px, cap) + 4
    w = mark_px + gap + tw + pw + 2
    im = Image.new("RGBA", (w, h), bg)
    my = (h - mark_px) // 2
    draw_mask(im, mask, 0, my, mark_px // 16, mark_color)
    d = ImageDraw.Draw(im)
    # Align text cap-height with the mark's vertical center.
    bbox = d.textbbox((0, 0), "Transformer", font=f)
    text_h = bbox[3] - bbox[1]
    ty = (h - text_h) // 2 - bbox[1]
    x = mark_px + gap
    d.text((x, ty), "Transformer", font=f, fill=word_color)
    d.text((x + tw, ty), "path", font=f, fill=path_color)
    return im

def rounded_rect(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

def board(n, title, blurb, mask):
    W, H = 1440, 1080
    im = Image.new("RGBA", (W, H), PAPER)
    d = ImageDraw.Draw(im)
    f_title = font(FONT, 28)
    f_sub = font(FONT_REG, 18)
    f_label = font(FONT_MED, 13)
    f_nav = font(FONT_MED, 15)
    f_small = font(FONT_REG, 14)
    f_tab = font(FONT_MED, 13)

    d.text((48, 36), "Option %d  ·  %s" % (n, title), font=f_title, fill=INK)
    d.text((48, 76), blurb, font=f_sub, fill=MUTED)

    # —— Header ——
    d.text((48, 128), "Header", font=f_label, fill=MUTED)
    bar = (48, 152, 1392, 216)
    rounded_rect(d, bar, 0, NAVY)
    lock = lockup(mask, AMBER, WHITE, AMBER, 32, 22, NAVY)
    im.paste(lock, (68, 152 + (64 - lock.size[1]) // 2), lock)
    links = ["Intel", "Directory", "Events", "Learn"]
    gap = 28
    widths = [text_width(d, t, f_nav) for t in links]
    total = sum(widths) + gap * (len(links) - 1)
    x = 1392 - 28 - total
    for t, w in zip(links, widths):
        d.text((x, 176), t, font=f_nav, fill=(203, 213, 225, 255))
        x += w + gap

    # —— Light / dark ——
    d.text((48, 240), "Light background", font=f_label, fill=MUTED)
    d.text((744, 240), "Dark background", font=f_label, fill=MUTED)
    light_box = (48, 264, 696, 464)
    dark_box = (744, 264, 1392, 464)
    rounded_rect(d, light_box, 12, LIGHT_BG)
    d.rectangle(light_box, outline=HAIR, width=1)
    rounded_rect(d, dark_box, 12, NAVY)
    # Brand amber fails on white. Light lockups use the site's text amber.
    path_ink = (180, 83, 9, 255)  # #b45309
    light_lock = lockup(mask, NAVY, NAVY, path_ink, 48, 32, LIGHT_BG)
    dark_lock = lockup(mask, AMBER, WHITE, AMBER, 48, 32, NAVY)
    im.paste(light_lock, (48 + 36, 264 + (200 - light_lock.size[1]) // 2), light_lock)
    im.paste(dark_lock, (744 + 36, 264 + (200 - dark_lock.size[1]) // 2), dark_lock)

    # —— Monochrome ——
    d.text((48, 488), "Monochrome", font=f_label, fill=MUTED)
    mono_w, mono_h = 280, 120
    specs = [
        (WHITE, INK, INK, "Black on white"),
        (INK, WHITE, WHITE, "White on black"),
    ]
    boxes = [(48, 512), (400, 512)]
    for (x, y), (bg, mark_c, word_c, label) in zip(boxes, specs):
        box = (x, y, x + 320, y + 132)
        rounded_rect(d, box, 12, bg)
        if bg == WHITE:
            d.rectangle(box, outline=HAIR, width=1)
        lk = lockup(mask, mark_c, word_c, word_c, 40, 26, bg)
        im.paste(lk, (x + 24, y + (132 - lk.size[1]) // 2), lk)
        d.text((x, y + 140), label, font=f_small, fill=MUTED)

    # —— Favicon ——
    d.text((760, 488), "Favicon", font=f_label, fill=MUTED)
    # Browser tab on light chrome and on dark chrome.
    def tab(origin, chrome, tabfill, title_c, icon_bg, icon_fg, label):
        x, y = origin
        d.rounded_rectangle((x, y, x + 280, y + 132), radius=12, fill=chrome)
        # tab
        d.rounded_rectangle((x + 16, y + 36, x + 196, y + 72), radius=8, fill=tabfill)
        icon = Image.new("RGBA", (16, 16), icon_bg)
        draw_mask(icon, mask, 0, 0, 1, icon_fg)
        im.paste(icon, (x + 28, y + 46), icon)
        d.text((x + 50, y + 46), "TransformerPath", font=f_tab, fill=title_c)
        d.text((x, y + 140), label, font=f_small, fill=MUTED)

    tab((760, 512), (232, 234, 237, 255), WHITE, INK, NAVY, AMBER, "16px in a light tab")
    tab((1080, 512), (32, 33, 36, 255), (53, 54, 58, 255), (228, 230, 233, 255), NAVY, AMBER, "16px in a dark tab")

    # Enlarged 16px, nearest-neighbor, with a pixel grid.
    d.text((48, 700), "16×16 enlarged", font=f_label, fill=MUTED)
    d.text((400, 700), "Same icon at 32px", font=f_label, fill=MUTED)
    cell = 14
    grid = Image.new("RGBA", (16 * cell + 1, 16 * cell + 1), WHITE)
    gd = ImageDraw.Draw(grid)
    for y in range(16):
        for x in range(16):
            col = AMBER if mask[y][x] else NAVY
            gd.rectangle((x * cell, y * cell, (x + 1) * cell - 1, (y + 1) * cell - 1), fill=col)
    im.paste(grid, (48, 728), grid)
    d.text((48, 728 + 16 * cell + 10), "Each square is one favicon pixel. Amber is the mark, navy is the tile.", font=f_small, fill=MUTED)

    icon32 = Image.new("RGBA", (32, 32), NAVY)
    draw_mask(icon32, mask, 0, 0, 2, AMBER)
    tile = Image.new("RGBA", (96, 96), (255, 255, 255, 0))
    # place 32px icon centered in a quiet tile
    plate = Image.new("RGBA", (96, 96), WHITE)
    pd = ImageDraw.Draw(plate)
    pd.rounded_rectangle((0, 0, 95, 95), radius=12, fill=WHITE, outline=HAIR)
    plate.paste(icon32, (32, 32), icon32)
    im.paste(plate, (400, 760), plate)

    # Mono favicon enlarged, so small-size monochrome is visible too.
    d.text((560, 700), "16×16 monochrome, enlarged", font=f_label, fill=MUTED)
    mono_grid = Image.new("RGBA", (16 * cell + 1, 16 * cell + 1), WHITE)
    md = ImageDraw.Draw(mono_grid)
    for y in range(16):
        for x in range(16):
            col = INK if mask[y][x] else WHITE
            md.rectangle((x * cell, y * cell, (x + 1) * cell - 1, (y + 1) * cell - 1), fill=col)
        # hairline grid
    for i in range(17):
        md.line((0, i * cell, 16 * cell, i * cell), fill=(230, 232, 236, 255))
        md.line((i * cell, 0, i * cell, 16 * cell), fill=(230, 232, 236, 255))
    im.paste(mono_grid, (560, 728), mono_grid)

    return im.convert("RGB")

def write_lockup_svg(path, mark_svg_body, mark_fill, word_fill, path_fill, label):
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 32" role="img" aria-label="%s">
  <g transform="scale(2)" fill="%s">
    %s
  </g>
  <text x="44" y="23" font-family="Inter, Liberation Sans, Arial, Helvetica, sans-serif" font-size="22" font-weight="600" letter-spacing="-0.4">
    <tspan fill="%s">Transformer</tspan><tspan fill="%s">path</tspan>
  </text>
</svg>
''' % (label, mark_fill, mark_svg_body, word_fill, path_fill)
    with open(path, "w") as f:
        f.write(svg)

def main():
    os.makedirs(ART, exist_ok=True)
    bodies = {}
    for name in ("option-1-core.svg", "option-2-windings.svg", "option-3-path.svg"):
        raw = open(os.path.join(ROOT, name)).read()
        inner = raw.split(">", 1)[1].rsplit("</svg>", 1)[0].strip()
        bodies[name] = inner
    pairs = [
        (1, "option-1-core.svg", "option-1-lockup-light.svg", "option-1-lockup-dark.svg"),
        (2, "option-2-windings.svg", "option-2-lockup-light.svg", "option-2-lockup-dark.svg"),
        (3, "option-3-path.svg", "option-3-lockup-light.svg", "option-3-lockup-dark.svg"),
    ]
    for n, mark_name, light_name, dark_name in pairs:
        body = bodies[mark_name]
        title, blurb, fn = MARKS[n]
        write_lockup_svg(os.path.join(ROOT, light_name), body, "#0d1b2e", "#0d1b2e", "#b45309", "TransformerPath, " + title + ", for light backgrounds")
        write_lockup_svg(os.path.join(ROOT, dark_name), body, "#f5a623", "#ffffff", "#f5a623", "TransformerPath, " + title + ", for dark backgrounds")
        img = board(n, title, blurb, fn())
        out = os.path.join(ART, "logo-option-%d.png" % n)
        img.save(out, "PNG", optimize=True)
        print(out, img.size)

if __name__ == "__main__":
    main()

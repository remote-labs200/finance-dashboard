#!/usr/bin/env python3
"""
Build a new splash-screen image with tagline text baked in.
"""
from PIL import Image, ImageDraw, ImageFont
import os

SPLASH_PATH = "assets/images/splash-icon.png"
TAGLINE = "Your income, smoothed."

MAX_WIDTH = 430
H_PADDING = 16
MAX_TEXT_WIDTH = MAX_WIDTH - H_PADDING * 2

FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/TTF/DejaVuSans.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
]

# Find a usable font file
font_path = None
for fp in FONT_PATHS:
    if os.path.exists(fp):
        font_path = fp
        break

if font_path is None:
    print("ERROR: No suitable font found. Install DejaVu or Liberation fonts.")
    exit(1)

# Binary search for the largest font size that fits within MAX_TEXT_WIDTH
lo, hi = 8, 80
best_size = 8
best_tw = 0
while lo <= hi:
    mid = (lo + hi) // 2
    font_try = ImageFont.truetype(font_path, mid)
    bb = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox((0, 0), TAGLINE, font=font_try)
    tw = bb[2] - bb[0]
    if tw <= MAX_TEXT_WIDTH:
        best_size = mid
        best_tw = tw
        lo = mid + 1
    else:
        hi = mid - 1

font = ImageFont.truetype(font_path, best_size)

SCALE = 128.0 / 430.0
print(f"Font size: {best_size}px  (text width: {best_tw}px, max: {MAX_TEXT_WIDTH}px)")
print(f"On-screen text height ≈ {round(best_size * SCALE)}px")

# Load the original splash
img = Image.open(SPLASH_PATH).convert("RGBA")
w, h = img.size

# Find the tight content bounds
px = img.load()
max_y = 0
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        if (r + g + b) < 700:
            max_y = max(max_y, y)

icon_bottom = max_y

# Measure final text
draw = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
bb = draw.textbbox((0, 0), TAGLINE, font=font)
tw = bb[2] - bb[0]
th = bb[3] - bb[1]

PAD_TOP = round(20 / SCALE)
PAD_BOT = round(4 / SCALE)

new_h = icon_bottom + PAD_TOP + th + PAD_BOT

# New canvas with splash background colour
BG = (32, 138, 239, 255)
canvas = Image.new("RGBA", (w, new_h), BG)
canvas.paste(img, (0, 0), img)

# Draw tagline centred
tx = (w - tw) // 2
ty = icon_bottom + PAD_TOP
draw = ImageDraw.Draw(canvas)
draw.text((tx, ty), TAGLINE, font=font, fill=(255, 255, 255, 191))

canvas.save(SPLASH_PATH)
print(f"✓ Updated {SPLASH_PATH}")
print(f"  Dimensions: {w}×{new_h} (was {w}×{h})")
print(f"  Tagline at: ({tx}, {ty}) size {tw}×{th}")

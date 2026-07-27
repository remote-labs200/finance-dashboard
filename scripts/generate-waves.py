#!/usr/bin/env python3
"""Generate deep blue water-themed wave background images for auth screens."""

import math
from PIL import Image, ImageDraw

WIDTH = 800
HEIGHT = 1200

# Deep blue water palette
COLORS = {
    'navy': (10, 22, 50),
    'deep_blue': (15, 52, 96),
    'ocean': (20, 80, 140),
    'sky_blue': (40, 120, 184),
    'light_blue': (70, 160, 220),
    'teal': (0, 180, 216),
    'foam': (144, 224, 239),
}


def lerp_color(c1, c2, t):
    """Linearly interpolate between two colors."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def make_gradient(draw, y1, y2, c1, c2):
    """Draw a vertical gradient from y1 to y2."""
    for y in range(y1, y2):
        t = (y - y1) / (y2 - y1) if y2 > y1 else 0
        color = lerp_color(c1, c2, t)
        draw.line([(0, y), (WIDTH, y)], fill=color)


def draw_wave(draw, wave_y, amplitude, phase, color1, color2, thickness=2):
    """Draw an anti-aliased wave curve with gradient fill below."""
    points = []
    for x in range(WIDTH):
        y = wave_y + amplitude * math.sin(x * 0.008 + phase) + amplitude * 0.3 * math.sin(x * 0.015 + phase * 1.5)
        points.append((x, int(y)))

    # Fill below the wave with gradient
    for i, (x, y) in enumerate(points):
        for yy in range(min(y + 1, HEIGHT - 1), HEIGHT):
            t = (yy - wave_y) / (HEIGHT - wave_y) if HEIGHT > wave_y else 1
            c = lerp_color(color1, color2, min(t, 1.0))
            draw.point((x, yy), fill=c)

    # Draw the wave line itself (thicker)
    for dx in range(-thickness // 2, thickness // 2 + 1):
        for dy in range(-thickness // 2, thickness // 2 + 1):
            for (x, y) in points:
                nx, ny = x + dx, y + dy
                if 0 <= nx < WIDTH and 0 <= ny < HEIGHT:
                    draw.point((nx, ny), fill=color1)


def create_wave_image(filename, waves_config, top_gradient_colors):
    """
    Create a wave background image.

    waves_config: list of (wave_y, amplitude, phase, color1, color2) tuples
    top_gradient_colors: (color_top, color_bottom) for gradient above waves
    """
    img = Image.new('RGB', (WIDTH, HEIGHT), COLORS['navy'])
    draw = ImageDraw.Draw(img)

    # Draw top gradient (sky/water surface)
    make_gradient(draw, 0, HEIGHT, top_gradient_colors[0], top_gradient_colors[1])

    # Draw each wave layer (back to front)
    for wave_y, amplitude, phase, c1, c2 in waves_config:
        draw_wave(draw, wave_y, amplitude, phase, c1, c2, thickness=3)

    # Save
    img.save(filename, 'PNG')
    print(f"Created {filename} ({img.size[0]}x{img.size[1]})")


def main():
    # === Welcome Screen Wave ===
    # Gentle, welcoming waves - like a calm ocean surface
    create_wave_image(
        'assets/images/welcome.png',
        [
            (int(HEIGHT * 0.50), 80, 0.0, COLORS['deep_blue'], COLORS['ocean']),
            (int(HEIGHT * 0.58), 60, 1.2, COLORS['ocean'], COLORS['sky_blue']),
            (int(HEIGHT * 0.65), 45, 2.5, COLORS['sky_blue'], COLORS['light_blue']),
            (int(HEIGHT * 0.66), 20, 3.0, COLORS['foam'], COLORS['sky_blue']),
        ],
        (COLORS['navy'], COLORS['deep_blue']),
    )

    # === Sign In Wave ===
    create_wave_image(
        'assets/images/signin.png',
        [
            (int(HEIGHT * 0.48), 100, 0.8, COLORS['deep_blue'], COLORS['ocean']),
            (int(HEIGHT * 0.57), 75, 2.0, COLORS['ocean'], COLORS['sky_blue']),
            (int(HEIGHT * 0.64), 55, 3.5, COLORS['sky_blue'], COLORS['light_blue']),
            (int(HEIGHT * 0.655), 18, 0.5, COLORS['foam'], COLORS['light_blue']),
        ],
        (COLORS['navy'], COLORS['deep_blue']),
    )

    # === Sign Up Wave ===
    create_wave_image(
        'assets/images/signup.png',
        [
            (int(HEIGHT * 0.47), 110, 1.5, COLORS['deep_blue'], COLORS['ocean']),
            (int(HEIGHT * 0.56), 70, 3.0, COLORS['ocean'], COLORS['sky_blue']),
            (int(HEIGHT * 0.63), 50, 4.0, COLORS['sky_blue'], COLORS['light_blue']),
            (int(HEIGHT * 0.59), 35, 1.0, COLORS['teal'], COLORS['sky_blue']),
            (int(HEIGHT * 0.645), 15, 2.0, COLORS['foam'], COLORS['light_blue']),
        ],
        (COLORS['navy'], COLORS['deep_blue']),
    )


if __name__ == '__main__':
    main()

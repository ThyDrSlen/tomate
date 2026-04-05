#!/usr/bin/env python3
"""
Generate Tomate (Pomodoro timer) tomato icons at multiple sizes.
Uses Pillow to draw a clean, flat, recognizable tomato icon.
Draws at 4x resolution then downscales with LANCZOS for crisp results.
"""

from PIL import Image, ImageDraw
import math
import os

# Work at 4x the largest size for crisp antialiasing
CANVAS = 512
HALF = CANVAS // 2
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "icons")
SIZES = [16, 32, 48, 128]

# Color palette
RED_BODY = (220, 38, 38)  # #DC2626 - primary tomato red
RED_DARK = (185, 28, 28)  # #B91C1C - shadow/depth
RED_LIGHT = (248, 113, 113)  # #F87171 - highlight
GREEN_STEM = (22, 101, 52)  # #166534 - dark green stem
GREEN_LEAF = (34, 139, 34)  # #228B22 - leaf green
GREEN_LEAF_LIGHT = (74, 175, 80)  # #4AAF50 - leaf highlight


def draw_tomato(size=512):
    """Draw a premium flat tomato icon on a transparent canvas."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = size / 2, size / 2

    # --- Tomato body ---
    # Slightly wider than tall, sitting slightly below center to leave room for stem/leaf
    body_rx = size * 0.42  # horizontal radius
    body_ry = size * 0.38  # vertical radius
    body_cy = cy + size * 0.06  # shift body down a bit

    # Draw shadow/depth layer (slightly offset down-right)
    shadow_offset = size * 0.01
    draw_ellipse(
        draw, cx + shadow_offset, body_cy + shadow_offset, body_rx, body_ry, RED_DARK
    )

    # Draw main tomato body
    draw_ellipse(draw, cx, body_cy, body_rx, body_ry, RED_BODY)

    # --- Tomato segments (subtle creases) ---
    # Draw subtle darker lines radiating from top-center to suggest tomato segments
    crease_color = (200, 30, 30, 60)  # semi-transparent dark red
    img_overlay = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(img_overlay)

    segment_top_y = body_cy - body_ry * 0.3
    crease_width = max(1, int(size * 0.008))

    for angle_deg in [-25, 0, 25]:
        angle = math.radians(angle_deg)
        x1 = cx + math.sin(angle) * body_rx * 0.05
        y1 = segment_top_y
        x2 = cx + math.sin(angle) * body_rx * 0.6
        y2 = body_cy + body_ry * 0.5
        draw_overlay.line([(x1, y1), (x2, y2)], fill=crease_color, width=crease_width)

    img = Image.alpha_composite(img, img_overlay)
    draw = ImageDraw.Draw(img)

    # --- Highlight / shine ---
    # A subtle light area in upper-left for dimension
    highlight_cx = cx - body_rx * 0.3
    highlight_cy = body_cy - body_ry * 0.25
    highlight_rx = body_rx * 0.35
    highlight_ry = body_ry * 0.25

    # Create highlight as a separate layer with transparency
    highlight_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight_layer)
    draw_ellipse(
        highlight_draw,
        highlight_cx,
        highlight_cy,
        highlight_rx,
        highlight_ry,
        (255, 255, 255, 50),
    )
    img = Image.alpha_composite(img, highlight_layer)
    draw = ImageDraw.Draw(img)

    # --- Stem ---
    stem_width = size * 0.04
    stem_height = size * 0.10
    stem_x = cx
    stem_top = body_cy - body_ry - stem_height * 0.4
    stem_bottom = body_cy - body_ry + stem_height * 0.3

    stem_rect = [
        stem_x - stem_width / 2,
        stem_top,
        stem_x + stem_width / 2,
        stem_bottom,
    ]
    draw.rectangle(stem_rect, fill=GREEN_STEM)

    # Round the top of the stem
    draw_ellipse(draw, stem_x, stem_top, stem_width / 2, stem_width * 0.4, GREEN_STEM)

    # --- Calyx (star-shaped leaves at top of tomato) ---
    leaf_base_y = body_cy - body_ry + size * 0.02
    leaf_length = size * 0.16
    leaf_width = size * 0.05

    # Draw 5 leaves radiating from stem base
    leaf_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    leaf_draw = ImageDraw.Draw(leaf_layer)

    leaf_angles = [-65, -30, 0, 30, 65]
    for angle_deg in leaf_angles:
        draw_leaf(
            leaf_draw,
            cx,
            leaf_base_y,
            leaf_length,
            leaf_width,
            angle_deg,
            GREEN_LEAF,
            size,
        )

    img = Image.alpha_composite(img, leaf_layer)

    # Add lighter leaf highlights
    leaf_hl_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    leaf_hl_draw = ImageDraw.Draw(leaf_hl_layer)
    for angle_deg in [-30, 30]:
        draw_leaf(
            leaf_hl_draw,
            cx,
            leaf_base_y,
            leaf_length * 0.7,
            leaf_width * 0.5,
            angle_deg,
            (*GREEN_LEAF_LIGHT, 120),
            size,
        )

    img = Image.alpha_composite(img, leaf_hl_layer)

    return img


def draw_ellipse(draw, cx, cy, rx, ry, color):
    """Draw a filled ellipse centered at (cx, cy)."""
    bbox = [cx - rx, cy - ry, cx + rx, cy + ry]
    draw.ellipse(bbox, fill=color)


def draw_leaf(draw, base_x, base_y, length, width, angle_deg, color, canvas_size):
    """Draw a pointed leaf shape radiating from (base_x, base_y)."""
    angle = math.radians(angle_deg - 90)  # -90 so 0 degrees points up

    # Tip of leaf
    tip_x = base_x + math.cos(angle) * length
    tip_y = base_y + math.sin(angle) * length

    # Perpendicular for width
    perp_angle = angle + math.pi / 2
    half_w = width / 2

    # Create a leaf polygon (pointed oval approximation)
    # Base left, mid-left, tip, mid-right, base right
    mid_factor = 0.4  # how far along the leaf the widest point is
    mid_x = base_x + math.cos(angle) * length * mid_factor
    mid_y = base_y + math.sin(angle) * length * mid_factor

    points = [
        (base_x, base_y),
        (mid_x + math.cos(perp_angle) * half_w, mid_y + math.sin(perp_angle) * half_w),
        (tip_x, tip_y),
        (mid_x - math.cos(perp_angle) * half_w, mid_y - math.sin(perp_angle) * half_w),
    ]

    draw.polygon(points, fill=color)


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Generate at high resolution
    print(f"Drawing tomato icon at {CANVAS}x{CANVAS}...")
    icon_hires = draw_tomato(CANVAS)

    # Save at each target size
    for size in SIZES:
        out_path = os.path.join(OUTPUT_DIR, f"icon-{size}.png")
        resized = icon_hires.resize((size, size), Image.LANCZOS)
        resized.save(out_path, "PNG", optimize=True)
        file_size = os.path.getsize(out_path)
        print(f"  Saved {out_path} ({size}x{size}, {file_size} bytes)")

    # Also save the hi-res version for reference
    hires_path = os.path.join(OUTPUT_DIR, "icon-512.png")
    icon_hires.save(hires_path, "PNG", optimize=True)
    print(f"  Saved {hires_path} (512x512 reference)")

    print("Done!")


if __name__ == "__main__":
    main()

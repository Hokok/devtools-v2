#!/usr/bin/env python3
"""生成 DevTools 应用图标源图（1024x1024）。

母题：石墨渐变圆角方块上的荧光青「❯_」终端提示符。
4x 超采样抗锯齿；输出 app-icon.png 后用 `pnpm tauri icon app-icon.png` 生成全平台图标集。
"""
import math
import struct
import zlib

SIZE = 1024
SS = 4  # 超采样倍数
N = SIZE * SS

# GitHub 深色画布渐变 + GitHub 蓝（Primer accent-fg dark）
TOP = (22, 27, 34)      # #161b22
BOTTOM = (13, 17, 23)   # #0d1117
ACCENT = (68, 147, 248) # #4493f8
RADIUS = 235
STROKE = 62  # 笔画半宽（1024 空间）

# 「❯」折线（两段）与「_」下划线，坐标为 1024 空间
SEGMENTS = [
    (330, 330, 505, 512),
    (505, 512, 330, 694),
    (575, 688, 770, 688),
]


def seg_distance(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def rounded_rect_mask(x, y, r, size):
    cx = min(max(x, r), size - r)
    cy = min(max(y, r), size - r)
    d = math.hypot(x - cx, y - cy)
    if d <= r - 1.5:
        return 1.0
    if d >= r + 1.5:
        return 0.0
    return (r + 1.5 - d) / 3.0


def sample(x, y):
    """单采样点颜色（supersample 空间）。"""
    fx, fy = x / SS, y / SS
    mask = rounded_rect_mask(fx, fy, RADIUS, SIZE)
    if mask <= 0:
        return (0, 0, 0, 0)
    # 背景垂直渐变
    t = fy / SIZE
    bg = tuple(TOP[i] + (BOTTOM[i] - TOP[i]) * t for i in range(3))
    # 提示符后方的柔光
    glow = max(0.0, 1.0 - math.hypot(fx - 470, fy - 512) / 460.0) ** 2 * 0.07
    r = bg[0] + ACCENT[0] * glow
    g = bg[1] + ACCENT[1] * glow
    b = bg[2] + ACCENT[2] * glow
    # 笔画（圆帽线段），带 1.5px 羽化
    d = min(seg_distance(fx, fy, *s) for s in SEGMENTS)
    if d < STROKE + 1.0:
        a = 1.0 if d <= STROKE - 1.0 else (STROKE + 1.0 - d) / 2.0
        r = r * (1 - a) + ACCENT[0] * a
        g = g * (1 - a) + ACCENT[1] * a
        b = b * (1 - a) + ACCENT[2] * a
    return (min(255, int(r)), min(255, int(g)), min(255, int(b)), int(255 * mask))


def main():
    # 逐行超采样累积后降采样
    rows = []
    for y in range(SIZE):
        row = bytearray()
        for x in range(SIZE):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    c = sample(x * SS + sx, y * SS + sy)
                    for i in range(4):
                        acc[i] += c[i]
            n = SS * SS
            for i in range(4):
                row.append(acc[i] // n)
        rows.append(bytes(row))

    def png_chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + row for row in rows)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )
    with open("app-icon.png", "wb") as f:
        f.write(png)
    print("app-icon.png written")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""生成 DevTools 应用图标源图（1024x1024）。

母题：Primer 蓝渐变圆角方块上的白色「❯_」终端提示符——白笔画沿 y 微渐变、
双层接触落影、边缘压暗勾体积。方块按 macOS 图标网格占 824/1024 居中
（四周 ~100px 透明边距，圆角 185），Dock 中与系统图标视觉等大。
几何与应用内 LogoMark（EmptyState.tsx 的 SVG）完全一致，改一处务必同步另一处。
4x 超采样抗锯齿；输出 app-icon.png 后用 `pnpm tauri icon app-icon.png` 生成全平台图标集。
"""
import math
import struct
import zlib

SIZE = 1024
SS = 4  # 超采样倍数

# Primer 蓝渐变底 + 白渐变笔画 + 落影色
BLUE_TOP = (90, 165, 252)
BLUE_BOTTOM = (26, 92, 205)
WHITE_TOP = (255, 255, 255)
WHITE_BOTTOM = (214, 230, 250)
SHADOW = (8, 34, 96)
# macOS 图标网格：图形 824×824 居中（四周 100px 透明），圆角 185
TILE = 824.0
TILE_MARGIN = (SIZE - TILE) / 2  # 100
RADIUS = 185.0
HALF = 30.0  # 笔画半宽（1024 空间，总宽 60）

# 「❯」折线与「_」下划线；随方块等比缩放后光学居中（包围盒 ≈ 393×327）
CHEVRON = [(316, 352), (512, 515), (316, 679)]
UNDERSCORE = (564, 679, 708, 679)
SEGMENTS = [
    (*CHEVRON[0], *CHEVRON[1]),
    (*CHEVRON[1], *CHEVRON[2]),
    (*UNDERSCORE[0:2], *UNDERSCORE[2:4]),
]


def seg_distance(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / l2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))


def sd_rounded(px, py, r):
    """居中圆角方形（824 边长）带符号距离，负=内部。"""
    half = TILE / 2
    qx = abs(px - SIZE / 2) - (half - r)
    qy = abs(py - SIZE / 2) - (half - r)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def inside_rounded(x, y, r):
    d = sd_rounded(x, y, r)
    if d <= -1.5:
        return 1.0
    if d >= 1.5:
        return 0.0
    return (1.5 - d) / 3.0


def dome(d, blur):
    if d >= blur:
        return 0.0
    x = d / blur
    return (1.0 - x * x) ** 2


def lerp(c1, c2, t):
    return tuple(c1[i] + (c2[i] - c1[i]) * t for i in range(3))


def sample(x, y):
    """单采样点颜色（supersample 空间）。"""
    fx, fy = x / SS, y / SS
    mask = inside_rounded(fx, fy, RADIUS)
    if mask <= 0:
        return (0, 0, 0, 0)
    r, g, b = lerp(BLUE_TOP, BLUE_BOTTOM, fy / SIZE)
    # 边缘压暗勾体积
    d_edge = -sd_rounded(fx, fy, RADIUS)
    k = max(0.0, 1.0 - d_edge / 105.0) * 0.18
    r, g, b = lerp((r, g, b), (0, 0, 0), k)
    # 双层接触落影（正下偏移，压成深蓝）
    for dx, dy in ((0, 21), (0, 42)):
        ds = min(seg_distance(fx - dx, fy - dy, *s) for s in SEGMENTS)
        a = 0.20 * dome(max(ds - HALF, 0.0), 48.0)
        r, g, b = lerp((r, g, b), SHADOW, a)
    # 白渐变笔画（上亮下微灰），圆帽 + 1.5px 羽化
    d = min(seg_distance(fx, fy, *s) for s in SEGMENTS)
    if d < HALF + 1.5:
        a = 1.0 if d <= HALF - 1.5 else (HALF + 1.5 - d) / 3.0
        color = lerp(WHITE_TOP, WHITE_BOTTOM, min(1.0, max(0.0, (fy - 352) / 327.0)))
        r, g, b = lerp((r, g, b), color, a)
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

"""Developer utility: regenerate space_derelict.ico from the source image.

Run: python dev_create_icon.py

It produces:
- space_derelict.ico (in root, for the launcher .lnk)
- assets/space_derelict.ico (copy for packaging later)
- Also updates a high-res PNG preview if wanted.

Uses only pygame (already a project dependency for the graphical build) + stdlib.
The resulting .ico embeds PNG data for full color and alpha at large sizes (modern Windows).
"""

from __future__ import annotations

import io
import struct
import sys
import tempfile
from pathlib import Path

import pygame


def _save_png_bytes(surface: pygame.Surface) -> bytes:
    """Save a surface as PNG bytes using a temp file (most reliable across pygame builds)."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        pygame.image.save(surface, str(tmp_path))
        return tmp_path.read_bytes()
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass


def pngs_to_ico(pngs: list[tuple[int, bytes]]) -> bytes:
    """Assemble a valid .ico file containing the given PNG images.

    pngs: list of (size, png_bytes)
    """
    count = len(pngs)
    if count == 0:
        raise ValueError("No images")

    # ICO header: Reserved (0), Type (1=icon), Count
    header = struct.pack("<HHH", 0, 1, count)

    # Calculate offsets
    header_size = 6
    dir_entry_size = 16
    data_offset = header_size + dir_entry_size * count

    dir_entries = b""
    image_blob = b""
    current_offset = data_offset

    for size, png_bytes in pngs:
        w = 0 if size >= 256 else size
        h = w
        color_count = 0
        reserved = 0
        # For PNG icons, many generators use 0 for planes + bpp.
        # Some use 1, 32. 0,0 is widely compatible for embedded PNG.
        planes = 0
        bpp = 0
        size_bytes = len(png_bytes)

        entry = struct.pack(
            "<BBBBHHII",
            w, h, color_count, reserved,
            planes, bpp,
            size_bytes,
            current_offset,
        )
        dir_entries += entry
        image_blob += png_bytes
        current_offset += size_bytes

    return header + dir_entries + image_blob


def main():
    pygame.init()
    # Some pygame builds (incl. pygame-ce) require an active display surface
    # before certain image operations / convert_alpha. Use a hidden 1x1 window.
    try:
        pygame.display.set_mode((1, 1), pygame.HIDDEN | getattr(pygame, "NOFRAME", 0))
    except Exception:
        pass  # best effort

    root = Path(__file__).parent.resolve()
    source_candidates = [
        root / "assets" / "space_derelict_icon_source.jpg",
        root / "space_derelict_icon_source.jpg",
        root / "assets" / "icon.png",
    ]

    source = None
    for cand in source_candidates:
        if cand.exists():
            source = cand
            break

    if not source:
        print("ERROR: No icon source image found. Expected one of:")
        for c in source_candidates:
            print("  ", c)
        print("Generate one first (e.g. via the imagine tool) and place it as assets/space_derelict_icon_source.jpg")
        sys.exit(1)

    print(f"Loading source: {source}")
    src = pygame.image.load(str(source)).convert_alpha()

    # Target sizes for a good Windows icon (small ones for taskbar, 256 for high-dpi)
    target_sizes = [16, 32, 48, 256]

    png_images: list[tuple[int, bytes]] = []
    for sz in target_sizes:
        # Use smoothscale for nice downscales; for very pixel-art sources you could use scale
        scaled = pygame.transform.smoothscale(src, (sz, sz))
        png_bytes = _save_png_bytes(scaled)
        png_images.append((sz, png_bytes))
        print(f"  Prepared {sz}x{sz} PNG ({len(png_bytes)} bytes)")

    ico_data = pngs_to_ico(png_images)

    # Write outputs
    out_root = root / "space_derelict.ico"
    out_assets = root / "assets" / "space_derelict.ico"

    out_root.write_bytes(ico_data)
    out_assets.write_bytes(ico_data)

    print(f"\nWrote: {out_root}")
    print(f"Wrote: {out_assets}")
    print(f"Total ICO size: {len(ico_data)} bytes")

    # Also drop a 256px PNG preview (useful for other uses)
    preview = root / "assets" / "space_derelict_icon_256.png"
    # Re-render the 256 one cleanly
    preview_256 = pygame.transform.smoothscale(src, (256, 256))
    pygame.image.save(preview_256, str(preview))
    print(f"Also wrote preview PNG: {preview}")

    pygame.quit()
    print("\nDone. You can now use space_derelict.ico for the Windows shortcut.")


if __name__ == "__main__":
    main()

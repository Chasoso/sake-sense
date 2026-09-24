from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/design/visual-identity/assets/logo-mark-large.png"
PUBLIC = ROOT / "public"


def render_icon(name: str, size: int, content_ratio: float, background: str = "#f9f7f2"):
    source = Image.open(SOURCE).convert("RGBA")
    alpha = source.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError(f"Source artwork has no visible pixels: {SOURCE}")

    artwork = source.crop(bbox)
    target = int(size * content_ratio)
    scale = min(target / artwork.width, target / artwork.height)
    artwork = artwork.resize(
        (max(1, round(artwork.width * scale)), max(1, round(artwork.height * scale))),
        Image.Resampling.LANCZOS,
    )

    canvas = Image.new("RGBA", (size, size), background)
    x = (size - artwork.width) // 2
    y = (size - artwork.height) // 2
    canvas.alpha_composite(artwork, (x, y))

    output = PUBLIC / name
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "PNG", optimize=True)


def main():
    # The artwork is kept intact; only transparent padding and scale vary by use.
    render_icon("favicon-16x16.png", 16, 0.9)
    render_icon("favicon-32x32.png", 32, 0.9)
    render_icon("apple-touch-icon.png", 180, 0.82)
    render_icon("icons/pwa-192x192.png", 192, 0.82)
    render_icon("icons/pwa-512x512.png", 512, 0.82)
    # Keep the whole mark inside the maskable safe zone with generous padding.
    render_icon("icons/pwa-maskable-512x512.png", 512, 0.68)


if __name__ == "__main__":
    main()

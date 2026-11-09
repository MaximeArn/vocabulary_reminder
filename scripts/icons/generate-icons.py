"""Génère les icônes de l'app à partir de l'illustration source.

Source attendue (non versionnée, licence de banque d'images) :
    scripts/icons/source/mneme-illustration.png
Prérequis : Python 3 et Pillow (pip install pillow).
Usage : npm run icons
"""
from pathlib import Path
from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "source" / "mneme-illustration.png"
OUTPUT = HERE.parent.parent / "public" / "icons"
BACKGROUND = (255, 255, 255)


def content_box(image: Image.Image) -> tuple[int, int, int, int]:
    """Cadre du dessin : tout ce qui n'est pas (presque) blanc."""
    difference = ImageChops.difference(image, Image.new("RGB", image.size, BACKGROUND))
    mask = difference.convert("L").point(lambda value: 255 if value > 24 else 0)
    return mask.getbbox()


def square_icon(drawing: Image.Image, size: int, fill_ratio: float) -> Image.Image:
    """Le dessin centré sur un carré blanc, occupant `fill_ratio` de sa plus grande dimension."""
    canvas = Image.new("RGB", (size, size), BACKGROUND)
    scale = size * fill_ratio / max(drawing.size)
    resized = drawing.resize((round(drawing.width * scale), round(drawing.height * scale)), Image.LANCZOS)
    canvas.paste(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
    return canvas


def main() -> None:
    image = Image.open(SOURCE).convert("RGB")
    drawing = image.crop(content_box(image))
    OUTPUT.mkdir(parents=True, exist_ok=True)

    # Icônes pleines : marge suffisante pour les coins arrondis d'iOS.
    for name, size in [("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512), ("favicon-64.png", 64)]:
        square_icon(drawing, size, 0.78).save(OUTPUT / name, optimize=True)
    # Icône « maskable » (Android) : tout le dessin dans le cercle central.
    square_icon(drawing, 512, 0.62).save(OUTPUT / "icon-maskable-512.png", optimize=True)
    print(f"Icônes générées dans {OUTPUT.relative_to(HERE.parent.parent)}")


if __name__ == "__main__":
    main()

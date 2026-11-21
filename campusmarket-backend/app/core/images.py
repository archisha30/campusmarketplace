"""Check uploaded images by their actual contents, not the browser's word for it.

The content type and file name in an upload come from the client, so a "photo" could really
be an SVG with script, an HTML page, or a huge file. Pillow decodes the bytes; only real
JPEG/PNG/WEBP/GIF images under the size limit are accepted, and the stored type and
extension come from what Pillow found.
"""

import io

from PIL import Image, ImageOps, UnidentifiedImageError

# Refuse "decompression bombs": tiny files that expand to gigantic images in memory.
Image.MAX_IMAGE_PIXELS = 40_000_000

ALLOWED_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
    "GIF": ("image/gif", ".gif"),
}


class ImageError(ValueError):
    """User-facing reason an upload was refused."""


def read_upload(fileobj, max_bytes: int) -> bytes:
    """Read at most max_bytes+1 so an oversized upload never sits fully in memory."""
    data = fileobj.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ImageError(f"Images must be under {max_bytes // (1024 * 1024)} MB")
    return data


def check_image(data: bytes) -> tuple[str, str]:
    """Return (content_type, extension) for a real, allowed image; raise ImageError otherwise."""
    try:
        with Image.open(io.BytesIO(data)) as img:
            fmt = img.format
            img.verify()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError):
        raise ImageError("That file isn't a supported image. Use a JPG, PNG, WEBP or GIF.")
    if fmt not in ALLOWED_FORMATS:
        raise ImageError("Use a JPG, PNG, WEBP or GIF image")
    return ALLOWED_FORMATS[fmt]


def clean_image(data: bytes) -> tuple[bytes, str, str]:
    """Check an upload (see check_image), then re-save it without its metadata. Phone photos
    carry EXIF: GPS coordinates of where they were taken (often the student's room), the phone
    model, the time. Photos are public, so none of that may be stored. The pixels are kept, the
    right way up (the EXIF rotation is applied, since the tag that held it is dropped), and the
    colour profile is kept so colours don't shift. Returns (bytes, content_type, extension)."""
    content_type, ext = check_image(data)
    return _without_metadata(data), content_type, ext


def _without_metadata(data: bytes) -> bytes:
    out = io.BytesIO()
    with Image.open(io.BytesIO(data)) as img:
        fmt = img.format
        icc = img.info.get("icc_profile")
        if getattr(img, "is_animated", False):
            # Animated GIF/WEBP: every frame is kept; only what's passed here is written.
            img.save(out, fmt, save_all=True)
            return out.getvalue()
        clean = ImageOps.exif_transpose(img).copy()
        clean.info = {}  # nothing from the original (EXIF, XMP, text chunks, comments) is carried over
        extra = {"icc_profile": icc} if icc else {}
        if fmt == "JPEG":
            clean.save(out, "JPEG", quality=90, optimize=True, **extra)
        elif fmt == "PNG":
            clean.save(out, "PNG", optimize=True, **extra)
        elif fmt == "WEBP":
            clean.save(out, "WEBP", quality=90, **extra)
        else:  # GIF
            clean.save(out, "GIF")
    return out.getvalue()


THUMB_SIZE = 480  # longest side; grid cards show photos ~200px wide (2x for sharp phone screens)


def make_thumbnail(data: bytes) -> bytes:
    """A small JPEG of an already-checked image, for listing cards: the right way up (phone
    photos store rotation separately), flattened onto white, longest side THUMB_SIZE."""
    with Image.open(io.BytesIO(data)) as img:
        img = ImageOps.exif_transpose(img)
        img.thumbnail((THUMB_SIZE, THUMB_SIZE))
        if img.mode != "RGB":
            rgba = img.convert("RGBA")
            img = Image.new("RGB", rgba.size, "white")
            img.paste(rgba, mask=rgba.split()[3])
        out = io.BytesIO()
        img.save(out, "JPEG", quality=80, optimize=True, progressive=True)
        return out.getvalue()

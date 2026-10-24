"""Server-side previews: page 1 sharp, the rest genuinely unreadable, nothing past page 4."""

import io

import pymupdf
from PIL import Image, ImageFilter, ImageStat

from app.core.pdf_preview import BLUR_WIDTH, render_previews
from conftest import make_pdf


def _img(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(data)).convert("L")


def _edge_energy(img: Image.Image) -> float:
    """Mean edge response. Crisp text is full of edges; a heavy blur has almost none."""
    return ImageStat.Stat(img.convert("L").filter(ImageFilter.FIND_EDGES)).mean[0]


def _reference(doc, index: int, width: int) -> Image.Image:
    page = doc[index]
    zoom = width / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples).convert("L")


def test_first_page_sharp_rest_blurred_and_capped_at_four():
    doc = pymupdf.open(stream=make_pdf(10), filetype="pdf")
    previews = render_previews(doc)

    assert [p.kind for p in previews] == ["sharp", "blurred", "blurred", "blurred"]

    sharp = _img(previews[0].data)
    assert sharp.width >= 900
    assert _edge_energy(sharp) > 3.0

    for i, p in enumerate(previews[1:], start=1):
        blurred = _img(p.data)
        assert blurred.width <= BLUR_WIDTH  # small on purpose
        # Same page, same size, no blur: the blurred version must have lost almost all detail.
        reference = _reference(doc, i, blurred.width)
        assert _edge_energy(blurred) < 0.15 * _edge_energy(reference), (
            f"page {i + 1}: blurred {_edge_energy(blurred):.2f} vs sharp {_edge_energy(reference):.2f}"
        )
        # And far below the sharp page 1 preview.
        assert _edge_energy(blurred) < 0.1 * _edge_energy(sharp)


def test_single_page_sale_blurs_lower_half():
    doc = pymupdf.open(stream=make_pdf(1, text_lines=60), filetype="pdf")
    previews = render_previews(doc, half_blur_single_page=True)

    assert [p.kind for p in previews] == ["partial"]
    img = _img(previews[0].data)
    w, h = img.size
    top = img.crop((0, 0, w, h // 2 - 4))
    bottom = img.crop((0, h // 2 + 4, w, h))
    assert _edge_energy(top) > 3.0
    assert _edge_energy(bottom) < 0.1 * _edge_energy(top)


def test_single_page_free_stays_sharp():
    doc = pymupdf.open(stream=make_pdf(1), filetype="pdf")
    previews = render_previews(doc, half_blur_single_page=False)
    assert [p.kind for p in previews] == ["sharp"]


def test_upload_writes_public_previews_and_private_pdf(client, create, file_dirs):
    private, previews_dir = file_dirs
    pdf = make_pdf(6)
    body = create(pdf=pdf).json()

    assert body["page_count"] == 6
    assert [p["kind"] for p in body["preview_pages"]] == ["sharp", "blurred", "blurred", "blurred"]
    assert body["thumbnail_url"] == body["preview_pages"][0]["url"]
    assert all("/uploads/resource-previews/" in p["url"] for p in body["preview_pages"])

    # Original lives only in private storage, never under uploads/.
    stored = [p for p in private.rglob("*") if p.is_file()]
    assert len(stored) == 1 and stored[0].read_bytes() == pdf
    public = [p for p in previews_dir.parent.rglob("*") if p.is_file()]
    assert len(public) == 4
    assert not any(p.suffix == ".pdf" for p in public)


def test_single_page_sale_upload_uses_partial_preview_and_rerenders_on_offer_change(client, auth, create):
    body = create(pdf=make_pdf(1)).json()
    assert [p["kind"] for p in body["preview_pages"]] == ["partial"]

    data = {
        "title": body["title"], "subject": "DBMS", "year": "2", "copy_type": "soft",
        "offer_type": "free", "price": "0", "delivery": "pdf", "description": "All units.",
    }
    res = client.put(f"/api/resources/{body['id']}", data=data, headers=auth("owner"))
    assert res.status_code == 200, res.text
    assert [p["kind"] for p in res.json()["preview_pages"]] == ["sharp"]


def test_drive_sample_single_page_is_not_half_blurred(create):
    body = create({"delivery": "drive", "drive_url": "https://drive.google.com/x"}, pdf=make_pdf(1)).json()
    assert [p["kind"] for p in body["preview_pages"]] == ["sharp"]

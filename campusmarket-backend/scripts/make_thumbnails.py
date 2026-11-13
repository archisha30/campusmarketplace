"""One-time: make card thumbnails for listing photos uploaded before thumbnails existed.

Downloads each photo that has no thumbnail yet, stores a small copy next to it and records it
on the listing. Until a listing has one, its cards just load the full photo. Safe to re-run:
photos that already have a thumbnail are skipped.

    uv run python scripts/make_thumbnails.py           # dry run, changes nothing
    uv run python scripts/make_thumbnails.py --apply   # make them
"""

import sys
from pathlib import Path

import httpx
from sqlalchemy import inspect

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app.main  # noqa: F401,E402  (registers every model)
from app.core.images import make_thumbnail  # noqa: E402
from app.core.storage import storage  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.listing import Listing  # noqa: E402


def main(apply: bool) -> None:
    db = SessionLocal()
    if "thumbnails" not in {c["name"] for c in inspect(db.get_bind()).get_columns("listings")}:
        db.close()
        sys.exit("The database doesn't have listings.thumbnails yet. Release the code and let Render "
                 "finish deploying (it runs the migration), then run this again.")
    made, failed = 0, []
    try:
        for listing in db.query(Listing).order_by(Listing.id).all():
            thumbs = dict(listing.thumbnails or {})
            missing = [u for u in (listing.images or []) if u and u not in thumbs]
            for url in missing:
                key = storage.key_from_url(url)
                if key is None:
                    failed.append(f"listing {listing.id}: not in storage ({url})")
                    continue
                if not apply:
                    print(f"would make a thumbnail for listing {listing.id}: {key}")
                    made += 1
                    continue
                try:
                    res = httpx.get(url, timeout=30, follow_redirects=True)
                    res.raise_for_status()
                    thumb_key = f"{key.rsplit('.', 1)[0]}_thumb.jpg"
                    storage.put_public(thumb_key, make_thumbnail(res.content), "image/jpeg")
                    thumbs[url] = storage.public_url(thumb_key, "")
                    made += 1
                except Exception as e:  # noqa: BLE001  report it and carry on with the rest
                    failed.append(f"listing {listing.id}: {key}: {e}")
            if apply and len(thumbs) != len(listing.thumbnails or {}):
                listing.thumbnails = thumbs
                db.commit()
    finally:
        db.close()
    print(f"{'Made' if apply else 'Would make'} {made} thumbnail(s).")
    for line in failed:
        print("  skipped", line)
    if not apply:
        print("Dry run: nothing changed. Re-run with --apply to make them.")


if __name__ == "__main__":
    main(apply="--apply" in sys.argv)

"""Copy every file in the Supabase Storage buckets to a local folder (for the nightly backup),
or put such a copy back (to recover).

Supabase's database backups never include Storage, so photos, avatars, resource previews and
the private PDFs are backed up here, file by file.

    python scripts/backup_storage.py download <folder>   # buckets -> <folder>/<bucket>/<path>
    python scripts/backup_storage.py upload <folder>     # <folder>/<bucket>/<path> -> buckets

Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (never commit them).
Only reads the buckets when downloading. Uploading overwrites files with the same path.
"""

import mimetypes
import os
import sys
from pathlib import Path, PurePosixPath

import httpx

BUCKETS = (
    os.environ.get("SUPABASE_PUBLIC_BUCKET", "campusmarket-public"),
    os.environ.get("SUPABASE_PRIVATE_BUCKET", "campusmarket-private"),
)
PAGE = 1000


def client() -> tuple[httpx.Client, str]:
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    headers = {"Authorization": f"Bearer {key}", "apikey": key}
    return httpx.Client(timeout=120, headers=headers), url.rstrip("/") + "/storage/v1"


def safe_path(root: Path, bucket: str, name: str) -> Path:
    """<root>/<bucket>/<name>, refusing names that would escape the folder."""
    parts = PurePosixPath(name).parts
    if not parts or any(p in ("..", "") for p in parts) or PurePosixPath(name).is_absolute():
        raise ValueError(f"Unsafe object name: {name!r}")
    return root.joinpath(bucket, *parts)


def list_files(http: httpx.Client, base: str, bucket: str, prefix: str = ""):
    """Every object name in the bucket. Folders come back as entries without an id; walk into them."""
    offset = 0
    while True:
        res = http.post(f"{base}/object/list/{bucket}", json={"prefix": prefix, "limit": PAGE, "offset": offset,
                                                              "sortBy": {"column": "name", "order": "asc"}})
        if res.status_code == 400 and "not found" in res.text.lower():
            return  # bucket doesn't exist (yet)
        res.raise_for_status()
        entries = res.json()
        for e in entries:
            path = f"{prefix}{e['name']}"
            if e.get("id") is None:
                yield from list_files(http, base, bucket, path + "/")
            else:
                yield path
        if len(entries) < PAGE:
            return
        offset += PAGE


def download(root: Path) -> None:
    http, base = client()
    total_files = total_bytes = 0
    for bucket in BUCKETS:
        count = 0
        for name in list_files(http, base, bucket):
            res = http.get(f"{base}/object/{bucket}/{name}")
            res.raise_for_status()
            dest = safe_path(root, bucket, name)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(res.content)
            count += 1
            total_bytes += len(res.content)
        print(f"{bucket}: {count} files")  # counts only: the workflow log is public
        total_files += count
    print(f"total: {total_files} files, {total_bytes / 1_048_576:.1f} MB")


def upload(root: Path) -> None:
    http, base = client()
    for bucket in BUCKETS:
        folder = root / bucket
        if not folder.is_dir():
            continue
        count = 0
        for path in sorted(p for p in folder.rglob("*") if p.is_file()):
            name = path.relative_to(folder).as_posix()
            res = http.post(f"{base}/object/{bucket}/{name}", content=path.read_bytes(),
                            headers={"x-upsert": "true",
                                     "Content-Type": mimetypes.guess_type(name)[0] or "application/octet-stream"})
            res.raise_for_status()
            count += 1
        print(f"{bucket}: restored {count} files")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("download", "upload"):
        sys.exit(__doc__)
    (download if sys.argv[1] == "download" else upload)(Path(sys.argv[2]))

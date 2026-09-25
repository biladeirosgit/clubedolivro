import requests

from config import COVERS_DIR, REQUEST_TIMEOUT, USER_AGENT
from lib.covers import trim_frame


def cover_path(book_id):
    return COVERS_DIR / f"{book_id}.jpg"


def download_cover(book_id, url):
    """Descarrega a capa para public/covers/{book_id}.jpg (substitui a que la
    estiver) e corta-lhe a margem lisa, se tiver."""
    dest = cover_path(book_id)
    resp = requests.get(url, timeout=REQUEST_TIMEOUT, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(resp.content)
    trim_frame(dest)


def ensure_cover(book_id, url):
    """Descarrega a capa so se ainda nao existir. True se descarregou."""
    if cover_path(book_id).exists() or not url:
        return False
    download_cover(book_id, url)
    return True

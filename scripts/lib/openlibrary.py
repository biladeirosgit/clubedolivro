"""Open Library (openlibrary.org): so para o ano da primeira publicacao quando
o Goodreads nao o deu. O RSS nem sempre traz o ano, e a pagina do livro no
Goodreads (que o tem) esta atras do anti-bot. A API de pesquisa da Open
Library e publica e nao bloqueia."""
import re
from urllib.parse import urlencode

from lib import http
from lib.goodreads import normalize_name

SEARCH_URL = "https://openlibrary.org/search.json"
# A Open Library aguenta bem mais que o Goodreads.
DELAY_RANGE = (1, 2)


def short_title(title):
    """Sem subtitulo: "Blood Meridian, or, the Evening Redness in the West" e
    "Mistborn: The Final Empire" nao aparecem assim na Open Library."""
    return re.split(r"\s*(?::|,\s*or\b|\()", title, maxsplit=1, flags=re.IGNORECASE)[0].strip()


def first_publish_year(title, author=None):
    """Ano da primeira publicacao da obra, ou None. Tenta o titulo completo e
    depois sem subtitulo.

    Com autor, so aceita resultados desse autor: um titulo como "Hamlet" tem
    dezenas de obras com o mesmo nome. Os dados da Open Library tem erros de
    vez em quando; o ano pode ser corrigido no bookMeta.json ("year")."""
    if not title:
        return None
    for candidate in dict.fromkeys([title, short_title(title)]):
        year = _search_year(candidate, author)
        if year:
            return year
    return None


def _search_year(title, author):
    params = {"title": title, "fields": "first_publish_year,title,author_name", "limit": 10}
    if author:
        params["author"] = author
    resp = http.get(f"{SEARCH_URL}?{urlencode(params)}", allow_404=True, delay_range=DELAY_RANGE)
    if resp is None:
        return None
    wanted = normalize_name(author) if author else None
    for doc in resp.json().get("docs", []):
        if not doc.get("first_publish_year"):
            continue
        if wanted and wanted not in {normalize_name(a) for a in doc.get("author_name") or []}:
            continue
        return doc["first_publish_year"]
    return None


COVER_URL = "https://covers.openlibrary.org/b/olid/{olid}-M.jpg"


def cover_url(olids, cache):
    """Capa de uma das edicoes da Open Library (`olids`), ou None se nenhuma
    tiver. Serve para os livros de fora do clube de quem usa o Hardcover, cujas
    capas sao carregadas pelos utilizadores. `cache` e {olid: True/False} e
    evita voltar a perguntar; as capas por OLID nao tem limite de pedidos."""
    for olid in olids[:3]:
        if olid not in cache:
            try:
                resp = http.get(f"{COVER_URL.format(olid=olid)}?default=false", allow_404=True, delay_range=(0.2, 0.5))
                cache[olid] = resp is not None
            except Exception:  # noqa: BLE001 - uma capa em falta nunca para o pipeline
                continue
        if cache[olid]:
            return COVER_URL.format(olid=olid)
    return None

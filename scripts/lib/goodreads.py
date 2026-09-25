"""Leitura do Goodreads sem API (a API publica fechou em 2020).

- Livros: a pagina /book/show/{id} traz um bloco __NEXT_DATA__ com o estado
  Apollo da pagina (titulo, autores, paginas, generos, obra, capa). Se um dia
  esse bloco mudar, cai-se para o JSON-LD + og:image, que tem menos campos.
- Ratings: cada membro tem um feed RSS publico com as estantes todas
  (/review/list_rss/{user_id}), 100 livros por pagina. Um pedido por pagina e
  por membro, em vez de um por membro e por livro. O feed tambem traz titulo,
  autor, ano, paginas e capa de cada livro.
- Pesquisa: o autocomplete (/book/auto_complete) devolve JSON com edicao,
  obra, autor, paginas e capa.

Anti-bot: as paginas dos livros estao atras de uma AWS WAF que comeca a pedir
um desafio de JavaScript ao fim de uns quantos pedidos. O RSS e o autocomplete
aguentam bem mais, por isso sao a fonte principal e a pagina so serve para o
que so ela tem (generos).

Edicoes vs obras: no Goodreads cada traducao/edicao tem o seu book_id. Se o
clube pos o link da edicao portuguesa e alguem avaliou a inglesa, os ids nao
batem. Por isso compara-se tambem a obra (work id), que e comum a todas as
edicoes.
"""
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import quote

from config import GOODREADS_BASE, MAX_GENRES, PAGE_DELAY_RANGE
from lib import http

BOOK_URL_RE = re.compile(r"goodreads\.com/(?:[a-z]{2}/)?book/show/(\d+)(?:[.-]([\w%-]+))?", re.IGNORECASE)
WORK_URL_RE = re.compile(r"/work/(\d+)")
NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>', re.S)
LD_JSON_RE = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
OG_IMAGE_RE = re.compile(r'<meta property="og:image" content="([^"]+)"')


def book_id_from_url(url):
    """'https://www.goodreads.com/book/show/5907.The_Hobbit' -> '5907'."""
    match = BOOK_URL_RE.search(url or "")
    return match.group(1) if match else None


def title_hint_from_url(url):
    """'.../book/show/18007564-the-martian' -> 'the martian'. So uma pista para
    a pesquisa: nem todos os links trazem o titulo."""
    match = BOOK_URL_RE.search(url or "")
    if not match or not match.group(2):
        return None
    return re.sub(r"[_-]+", " ", match.group(2)).strip() or None


def book_link(book_id):
    return f"{GOODREADS_BASE}/book/show/{book_id}"


def normalize_name(name):
    """Para comparar autores entre edicoes: sem acentos, pontuacao nem espacos."""
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]", "", text.lower())


def _year_from_ms(value):
    if value is None:
        return None
    try:
        return (datetime(1970, 1, 1) + timedelta(milliseconds=value)).year
    except (OverflowError, TypeError, ValueError):
        return None


def _parse_next_data(html, book_id):
    match = NEXT_DATA_RE.search(html)
    if not match:
        return None
    apollo = json.loads(match.group(1)).get("props", {}).get("pageProps", {}).get("apolloState", {})

    book = next(
        (v for k, v in apollo.items() if k.startswith("Book:") and str(v.get("legacyId")) == str(book_id)),
        None,
    )
    if book is None:
        return None

    def deref(ref):
        return apollo.get((ref or {}).get("__ref"), {}) if isinstance(ref, dict) else {}

    # Autor principal + co-autores. Editores, tradutores e ilustradores ficam de fora.
    authors = []
    primary = book.get("primaryContributorEdge") or {}
    if deref(primary.get("node")).get("name"):
        authors.append(deref(primary["node"])["name"])
    for edge in book.get("secondaryContributorEdges") or []:
        name = deref(edge.get("node")).get("name")
        if edge.get("role") == "Author" and name and name not in authors:
            authors.append(name)

    details = book.get("details") or {}
    work = deref(book.get("work"))
    work_details = work.get("details") or {}
    work_match = WORK_URL_RE.search(work_details.get("webUrl") or "")

    genres = [g["genre"]["name"] for g in book.get("bookGenres") or [] if g.get("genre", {}).get("name")]

    return {
        "title": book.get("title") or book.get("titleComplete"),
        "authors": authors,
        # Ano da primeira publicacao da obra; o da edicao so se a obra nao tiver.
        "year": _year_from_ms(work_details.get("publicationTime")) or _year_from_ms(details.get("publicationTime")),
        "pages": details.get("numPages"),
        "genres": genres[:MAX_GENRES],
        "cover": book.get("imageUrl"),
        "workId": work_match.group(1) if work_match else None,
    }


def _parse_fallback(html):
    """So JSON-LD + og:image: sem generos, ano nem obra."""
    data = {}
    match = LD_JSON_RE.search(html)
    if match:
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            data = {}
    authors = data.get("author") or []
    if isinstance(authors, dict):
        authors = [authors]
    og = OG_IMAGE_RE.search(html)
    return {
        "title": data.get("name"),
        # O JSON-LD mistura autores com editores e ilustradores; fica so o primeiro.
        "authors": [a["name"] for a in authors[:1] if a.get("name")],
        "year": None,
        "pages": data.get("numberOfPages"),
        "genres": [],
        "cover": data.get("image") or (og.group(1) if og else None),
        "workId": None,
    }


def fetch_book(book_id):
    """Detalhes de um livro, ou None se o Goodreads der 404."""
    resp = http.get(book_link(book_id), allow_404=True, delay_range=PAGE_DELAY_RANGE)
    if resp is None:
        return None
    html = resp.text
    return _parse_next_data(html, book_id) or _parse_fallback(html)


SERIES_SUFFIX_RE = re.compile(r"\s*\([^()]*#\d+(?:\.\d+)?\)\s*$")
IMAGE_SIZE_RE = re.compile(r"\._S[XY]\d+_(?=\.\w+$)")


def _rss_date(value):
    """'Wed, 16 Sep 2026 00:00:00 +0000' -> '16/09/2026'."""
    try:
        return parsedate_to_datetime(value).strftime("%d/%m/%Y") if value else None
    except (TypeError, ValueError):
        return None


def _int_or_none(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def fetch_user_books(user_id):
    """Todos os livros das estantes de um membro, pelo feed RSS.

    Devolve [{bookId, title, author, rating, review, year, pages, cover,
    readAt, shelves}]. `readAt` e o dia em que marcou como lido (DD/MM/YYYY).
    rating 0 = na estante mas sem nota. Alem das notas, o feed traz os
    detalhes basicos de cada edicao, o que poupa pedidos a pagina do livro
    (que e o que dispara o anti-bot). O feed tem de ser publico: com o
    perfil privado o Goodreads devolve um feed vazio."""
    books = []
    page = 1
    while True:
        url = f"{GOODREADS_BASE}/review/list_rss/{user_id}?shelf=%23ALL%23&page={page}"
        resp = http.get(url, allow_404=True)
        if resp is None:
            break
        # Bytes e nao texto: o XML declara o proprio encoding e o requests
        # adivinhava mal, estragando os acentos.
        items = ET.fromstring(resp.content).findall("./channel/item")
        if not items:
            break
        for item in items:
            books.append({
                "bookId": item.findtext("book_id"),
                "title": SERIES_SUFFIX_RE.sub("", item.findtext("title") or "").strip(),
                "author": item.findtext("author_name"),
                "rating": _int_or_none(item.findtext("user_rating")) or 0,
                "review": (item.findtext("user_review") or "").strip(),
                # book_published e o ano da primeira publicacao da obra.
                "year": _int_or_none(item.findtext("book_published")),
                "pages": _int_or_none(item.findtext("book/num_pages")),
                # Sem o sufixo de tamanho (._SY475_) o CDN devolve a capa original.
                "cover": _clean_cover(item.findtext("book_large_image_url")),
                "readAt": _rss_date(item.findtext("user_read_at")),
                # Vazio = estante "read"; senao "to-read", "currently-reading", etc.
                "shelves": (item.findtext("user_shelves") or "").strip(),
            })
        page += 1
    return books


def _clean_cover(url):
    if not url or "nophoto" in url:
        return None
    return IMAGE_SIZE_RE.sub("", url)


def autocomplete(query):
    """Pesquisa do Goodreads: [{bookId, workId, title, author, pages, cover}]."""
    resp = http.get(f"{GOODREADS_BASE}/book/auto_complete?format=json&q={quote(query)}")
    results = []
    for item in resp.json():
        results.append({
            "bookId": str(item.get("bookId")),
            "workId": str(item["workId"]) if item.get("workId") else None,
            "title": item.get("bookTitleBare") or item.get("title"),
            "author": (item.get("author") or {}).get("name"),
            "pages": item.get("numPages") or None,
            "cover": _clean_cover(item.get("imageUrl")),
        })
    return results


def _pick(results, book_id, title, author):
    """(resultado, exato): a propria edicao se vier na pesquisa; senao o
    primeiro resultado do mesmo autor cujo titulo contenha o procurado (ou
    vice-versa), que e outra edicao da mesma obra."""
    exact = next((r for r in results if r["bookId"] == str(book_id)), None)
    if exact:
        return exact, True
    wanted_title = normalize_name(title)
    wanted_author = normalize_name(author) if author else None
    for result in results:
        if wanted_author and normalize_name(result["author"]) != wanted_author:
            continue
        found_title = normalize_name(result["title"])
        if wanted_title and (wanted_title in found_title or found_title in wanted_title):
            return result, False
    return None, False


def search_work_ids(book_id, title, author=None):
    """Todas as obras candidatas de uma edicao: a da propria edicao, se vier
    na pesquisa, e as de todos os resultados do mesmo autor com o mesmo
    titulo. O Goodreads tem obras duplicadas para o mesmo livro (ex: duas
    "Harry Potter e a Pedra Filosofal" com work ids diferentes), e a primeira
    da pesquisa varia de pedido para pedido. Com a lista toda, basta uma bater
    com a obra do livro do clube."""
    if not title:
        return []
    wanted_title = normalize_name(title)
    wanted_author = normalize_name(author) if author else None
    work_ids = []
    for result in autocomplete(title):
        same_edition = result["bookId"] == str(book_id)
        same_author = not wanted_author or normalize_name(result["author"]) == wanted_author
        found_title = normalize_name(result["title"])
        same_title = wanted_title and (wanted_title in found_title or found_title in wanted_title)
        if result["workId"] and (same_edition or (same_author and same_title)):
            work_ids.append(result["workId"])
    return list(dict.fromkeys(work_ids))


def search_edition(book_id, title, author=None):
    """Procura um livro pelo titulo e devolve (resultado, exato).

    `exato` diz se o resultado e a propria edicao (mesmo book_id). Quando nao
    e, e a edicao mais popular da mesma obra: serve para a obra (workId) e,
    se o livro nao tiver mais nada, para autor, paginas e capa.

    Pesquisa primeiro so o titulo: com o autor junto, "1984 George Orwell" traz
    guias de leitura e ensaios sobre o livro em vez do livro. So se o titulo
    sozinho nao chegar e que se junta o autor (titulos genericos)."""
    if not title:
        return None, False
    queries = [title]
    if author:
        queries.append(f"{title} {author}")
    for query in queries:
        result, exact = _pick(autocomplete(query), book_id, title, author)
        if result:
            return result, exact
    return None, False

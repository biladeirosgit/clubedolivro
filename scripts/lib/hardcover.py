"""Leitura do Hardcover (https://hardcover.app) pela API oficial (GraphQL).

Usa uma chave de API so de leitura (HARDCOVER_TOKEN, no .env ou num secret do
GitHub Actions). Com ela le-se a biblioteca de qualquer membro com o perfil
publico, ou que o dono da chave siga. Os termos do Hardcover pedem que os dados
de uma pessoa so aparecam num site publico com autorizacao dela: cada membro que
passa para o Hardcover da essa autorizacao.

As entradas tem a mesma forma das do RSS do Goodreads (lib/goodreads.py), para
o resto do pipeline nao ter de saber de onde vem cada membro. A diferenca: um
livro do Hardcover junta todas as edicoes, por isso traz os IDs do Goodreads de
todas elas (`goodreadsIds`), que e por onde se liga aos livros do clube.
"""
import re
import time

import requests

from config import HARDCOVER_API_URL, HARDCOVER_TOKEN, REQUEST_TIMEOUT

# O Hardcover pede um User-Agent que diga o que e o script.
USER_AGENT = "clubedolivro-biladeiros (pipeline do site do Clube do Livro dos Biladeiros)"
PAGE_SIZE = 100
# Estados de leitura do Hardcover. So o 3 conta como "lido"; os outros entram
# na mesma se tiverem nota (como no Goodreads, onde a nota manda).
READ_STATUS = 3

USER_BOOKS_QUERY = """
query($uid: Int!, $offset: Int!) {
  user_books(where: {user_id: {_eq: $uid}}, limit: %d, offset: $offset, order_by: {id: asc}) {
    rating
    status_id
    review_raw
    last_read_date
    book {
      id
      title
      release_year
      pages
      contributions(limit: 1) { author { name } }
      book_mappings(where: {platform: {name: {_in: ["goodreads", "openlibrary"]}}}) {
        external_id
        platform { name }
      }
    }
  }
}
""" % PAGE_SIZE


class HardcoverError(Exception):
    """A API recusou o pedido ou a chave falta/expirou."""


_session = requests.Session()


def _query(query, variables=None):
    if not HARDCOVER_TOKEN:
        raise HardcoverError("HARDCOVER_TOKEN nao definido (no .env, ou no secret do GitHub Actions)")
    token = HARDCOVER_TOKEN.strip()
    if token.lower().startswith("bearer "):
        token = token[7:].strip()
    headers = {"Authorization": f"Bearer {token}", "User-Agent": USER_AGENT}
    for attempt in range(4):
        resp = _session.post(
            HARDCOVER_API_URL,
            json={"query": query, "variables": variables or {}},
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code in (429, 503):
            # Limite por minuto: o Retry-After diz quanto esperar.
            time.sleep(int(resp.headers.get("Retry-After", 5)) + attempt)
            continue
        if resp.status_code == 401:
            raise HardcoverError("a chave do Hardcover e invalida ou expirou (401): cria outra e atualiza o HARDCOVER_TOKEN")
        if resp.status_code == 403:
            raise HardcoverError(f"o Hardcover recusou o pedido (403): {resp.text[:200]}")
        resp.raise_for_status()
        data = resp.json()
        if data.get("errors"):
            raise HardcoverError(f"erro do Hardcover: {data['errors'][0].get('message')}")
        return data["data"]
    raise HardcoverError("o Hardcover continuou a pedir para esperar (429); tenta mais tarde")


def _iso_to_ddmmyyyy(value):
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", value or "")
    return f"{match.group(3)}/{match.group(2)}/{match.group(1)}" if match else None


def user_id(username):
    data = _query('query($u: citext!) { users(where: {username: {_eq: $u}}) { id } }', {"u": username})
    users = data.get("users") or []
    if not users:
        raise HardcoverError(f"nao ha nenhum utilizador '{username}' no Hardcover")
    return users[0]["id"]


def book_link(hardcover_id):
    """Link estavel para a pagina do livro (o slug pode mudar; este nao)."""
    return f"https://hardcover.app/id/book/{hardcover_id}"


def fetch_user_books(username):
    """Todos os livros da biblioteca de um membro, no formato do RSS do
    Goodreads: [{bookId, goodreadsIds, openLibraryIds, hardcoverId, title,
    author, rating, review, year, pages, cover, readAt, shelves, link}].

    rating 0 = sem nota. `bookId` e o primeiro ID do Goodreads do livro (ou
    "hc-<id>" se nao tiver nenhum). A capa fica vazia: as do Hardcover sao
    carregadas pelos utilizadores, e os termos deles avisam para nao as mostrar
    num site publico sem politica de direitos de autor."""
    uid = user_id(username)
    books = []
    offset = 0
    while True:
        rows = _query(USER_BOOKS_QUERY, {"uid": uid, "offset": offset})["user_books"]
        for row in rows:
            book = row["book"] or {}
            mappings = book.get("book_mappings") or []
            goodreads_ids = [m["external_id"] for m in mappings if m["platform"]["name"] == "goodreads"]
            # "/books/OL32280764M" -> "OL32280764M"
            ol_ids = [m["external_id"].rstrip("/").split("/")[-1] for m in mappings if m["platform"]["name"] == "openlibrary"]
            authors = [c["author"]["name"] for c in book.get("contributions") or [] if c.get("author")]
            books.append({
                "bookId": goodreads_ids[0] if goodreads_ids else f"hc-{book.get('id')}",
                "goodreadsIds": goodreads_ids,
                "openLibraryIds": ol_ids,
                "hardcoverId": book.get("id"),
                "title": book.get("title"),
                "author": " ".join((authors[0] if authors else "").split()) or None,
                "rating": round(float(row["rating"]) * 4) / 4 if row.get("rating") else 0,
                "review": (row.get("review_raw") or "").strip(),
                "year": book.get("release_year"),
                "pages": book.get("pages"),
                "cover": None,
                "readAt": _iso_to_ddmmyyyy(row.get("last_read_date")),
                "shelves": "" if row.get("status_id") == READ_STATUS else str(row.get("status_id")),
                "link": book_link(book.get("id")),
            })
        if len(rows) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return books

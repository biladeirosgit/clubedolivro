"""
Pipeline principal: atualiza src/cdl/bookData.json a partir do bookMeta.json
(lista mestre dos livros do clube) + Goodreads, preenchendo so o que falta.

bookData.json e tratado como estado vivo: nunca sobrescreve um rating/comentario
ja presente (seja de um run anterior ou escrito a mao), so preenche o que falta.
Membros sem Goodreads (goodreadsUserId=null em members.json) nunca sao lidos do
Goodreads - as suas avaliacoes entram pelo manualRatings.json.

Corre-se via `python scripts/build_book_data.py`, tipicamente a partir do
workflow do GitHub Actions (workflow_dispatch manual). `--last N` limita os
ratings aos N livros mais recentes e `--user NOME` a um membro so; as duas
flags combinam-se.

Os livros de fora do clube (goodreadsShelves.json, so para o perfil) sao de
outro script: build_goodreads_shelves.py.
"""
import argparse
import json
import re
import sys
from datetime import datetime

import requests

from config import (
    BOOK_DATA_PATH,
    MEMBERS_PATH,
    BOOK_META_PATH,
    MANUAL_RATINGS_PATH,
    EDITION_CACHE_PATH,
    TITLES_PATH,
)
from lib import goodreads, images, openlibrary
from lib.http import BlockedError


def load_json(path, default):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        f.write("\n")


def parse_date(value):
    """Converte 'DD/MM/YYYY' num datetime. Devolve None se faltar/for invalido."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d/%m/%Y")
    except ValueError:
        return None


def has_started(value, today=None):
    """True se o livro ja comecou a ser lido (ou se a data falta/e invalida).
    Livros com data no futuro estao no "On the way": ninguem os leu ainda
    para o clube, portanto nao se lhes vai buscar ratings."""
    parsed = parse_date(value)
    if parsed is None:
        return True
    return parsed.date() <= (today or datetime.now().date())


def book_entry_has_meta_title(book_meta, book_id):
    return bool((book_meta.get(book_id) or {}).get("title"))


def meta_entries(book_meta):
    """Entradas do bookMeta.json, sem as chaves de comentario (`_...`)."""
    return {book_id: meta for book_id, meta in book_meta.items() if not book_id.startswith("_")}


def recent_ids(book_meta, limit):
    """Os `limit` livros mais recentes que ja comecaram. Livros sem data valida
    ficam no fim, para nunca roubarem o lugar a um com data."""
    if limit is None:
        return None  # sem limite: todos os livros sao elegiveis

    dated = []
    undated = []
    for book_id, meta in meta_entries(book_meta).items():
        if not has_started(meta.get("date")):
            continue
        parsed = parse_date(meta.get("date"))
        if parsed is None:
            undated.append(book_id)
        else:
            dated.append((parsed, book_id))

    dated.sort(key=lambda pair: pair[0], reverse=True)
    ordered = [book_id for _, book_id in dated] + undated
    return set(ordered[:limit])


class PageFetcher:
    """Pedidos a pagina de um livro e a pesquisa do Goodreads.

    A pagina esta atras do anti-bot, que dispara depressa; a pesquisa aguenta
    bem mais. Cada um tem o seu travao: ao primeiro bloqueio desiste-se desse
    tipo de pedido ate ao fim do run. O resto do trabalho continua e grava-se
    na mesma, e o que faltou fica para o proximo run."""

    def __init__(self, edition_cache):
        self.edition_cache = edition_cache
        self.page_blocked = None
        self.search_blocked = None

    @property
    def blocked(self):
        return self.page_blocked or self.search_blocked

    def book(self, book_id):
        if self.page_blocked:
            return None
        try:
            return goodreads.fetch_book(book_id)
        except BlockedError as exc:
            self.page_blocked = str(exc)
            print(f"  AVISO: {exc}. Paginas de livros (generos) ficam para o proximo run.")
            return None

    def search(self, book_id, title, author=None):
        if self.search_blocked:
            return None, False
        try:
            return goodreads.search_edition(book_id, title, author)
        except BlockedError as exc:
            self.search_blocked = str(exc)
            print(f"  AVISO: {exc}. Pesquisas ficam para o proximo run.")
            return None, False

    def work_ids(self, book_id, title=None, author=None):
        """Obras candidatas de uma edicao, com cache. So pela pesquisa: a
        pagina e cara demais para gastar em cada edicao que alguem leu.
        (Entradas antigas da cache, com uma obra so em vez de lista, voltam a
        ser pesquisadas.)"""
        book_id = str(book_id)
        if isinstance(self.edition_cache.get(book_id), list):
            return self.edition_cache[book_id]
        if self.search_blocked:
            return []
        try:
            work_ids = goodreads.search_work_ids(book_id, title, author)
        except BlockedError as exc:
            self.search_blocked = str(exc)
            print(f"  AVISO: {exc}. Pesquisas ficam para o proximo run.")
            return []
        self.edition_cache[book_id] = work_ids
        return work_ids


# Sinais de um titulo que nao esta em ingles: acentos, escrita japonesa ou
# chinesa, "Tome" (edicoes francesas de manga) e palavras portuguesas. Nao
# apanha tudo (ex: "A Metamorfose"), e so para avisar.
FOREIGN_TITLE_RE = re.compile(
    r"[áâãàçéêíóôõúÁÂÃÀÇÉÊÍÓÔÕÚ]|[\u3040-\u30ff\u3400-\u9fff]|\bTome\b"
    r"|\b(?:da|dos|das|na|nos|nas|um|uma|que|e|o)\b"
)


def warn_foreign_titles(kind, books, titles):
    """Avisa de titulos que parecem nao estar em ingles e ainda nao estao no
    titles.json. `books` e [(book_id, titulo)]."""
    suspects = [(i, t) for i, t in books if i not in titles and t and FOREIGN_TITLE_RE.search(t)]
    if suspects:
        print(f"\nAVISO: {len(suspects)} titulo(s) {kind} que talvez nao estejam em ingles.")
        print("  Poe o titulo ingles (ou o proprio, se for um livro portugues) em scripts/titles.json:")
        for book_id, title in suspects:
            print(f'    "{book_id}": "{title}",')


def replace_cover(book_id, url, stats):
    """Capa escolhida a mao no bookMeta.json ("cover"): substitui a atual."""
    try:
        images.download_cover(book_id, url)
        stats["covers_downloaded"] += 1
        return True
    except requests.RequestException as exc:
        print(f"  AVISO: capa de {book_id} ({url}) falhou ({exc})")
        return False


def download_cover(book_id, url, stats):
    try:
        if images.ensure_cover(book_id, url):
            stats["covers_downloaded"] += 1
    except requests.RequestException as exc:
        print(f"  AVISO: capa de {book_id} falhou ({exc})")


def fill(book, values):
    """Preenche os campos que faltam no livro. True se mudou alguma coisa."""
    changed = False
    for field, value in values.items():
        if not book.get(field) and value:
            book[field] = value
            changed = True
    return changed


def update_book_details(book_id, book, shelf_entry, title_hint, pages, stats):
    """Titulo/autores/ano/paginas/generos/obra e capa, so o que faltar.

    1. O RSS de algum membro (`shelf_entry`), que nao custa pedidos.
    2. A pesquisa do Goodreads, pelo titulo que ja houver ou pela pista do
       bookMeta.json (`title_hint`): da a obra, e a capa se o livro nao estiver
       na estante de ninguem.
    3. A pagina do livro, so para o que so ela tem (generos, co-autores). E
       pedida uma unica vez: depois fica o `_checked` a true e so se volta la
       se a capa desaparecer. Para forcar, apaga-se o `_checked`.
    4. A Open Library, so para o ano, se ainda faltar."""
    changed = False
    if shelf_entry:
        from_shelf = {
            "title": shelf_entry.get("title"),
            "authors": [shelf_entry["author"]] if shelf_entry.get("author") else None,
            "year": shelf_entry.get("year"),
            "pages": shelf_entry.get("pages"),
        }
        changed |= fill(book, from_shelf)
        if not images.cover_path(book_id).exists() and shelf_entry.get("cover"):
            download_cover(book_id, shelf_entry["cover"], stats)

    cover_missing = not images.cover_path(book_id).exists()
    query = book.get("title") or title_hint
    incomplete = not book.get("workId") or not book.get("authors") or cover_missing
    if incomplete and query and not book.get("_searched"):
        author = (book.get("authors") or [None])[0]
        result, exact = pages.search(book_id, query, author)
        if result:
            # Outra edicao da mesma obra so preenche o que nao ha de todo.
            changed |= fill(book, {
                "title": result["title"],
                "authors": [result["author"]] if result["author"] else None,
                "pages": result["pages"],
                "workId": result["workId"],
            })
            if cover_missing and result["cover"]:
                download_cover(book_id, result["cover"], stats)
            if not exact:
                print(f"  {book_id}: sem a edicao exata na pesquisa, usei outra da mesma obra ({result['bookId']})")
        if not pages.search_blocked:
            book["_searched"] = True

    cover_missing = not images.cover_path(book_id).exists()
    if not book.get("_checked") or cover_missing:
        details = pages.book(book_id)
        if details is not None:
            for field in ("title", "authors", "year", "pages", "genres", "workId"):
                # A pagina manda nos autores (o RSS so traz o principal) e na obra
                # (a da pesquisa e um palpite pela edicao mais popular).
                if details.get(field) and (not book.get(field) or field in ("authors", "workId")):
                    if book.get(field) != details[field]:
                        book[field] = details[field]
                        changed = True
            book["_checked"] = True
            if cover_missing and details.get("cover"):
                download_cover(book_id, details["cover"], stats)
        elif not pages.page_blocked:
            print(f"  AVISO: livro {book_id} nao existe no Goodreads (404)")
            book["_checked"] = True

    # 4. Ano da Open Library, se nem o RSS nem a pagina o deram. Uma vez so.
    if not book.get("year") and book.get("title") and not book.get("_openLibrary"):
        try:
            year = openlibrary.first_publish_year(book["title"], (book.get("authors") or [None])[0])
            book["_openLibrary"] = True
            changed |= fill(book, {"year": year})
        except (requests.RequestException, BlockedError, ValueError) as exc:
            print(f"  AVISO: Open Library falhou para {book_id} ({exc})")

    return changed


def match_ratings(shelf, eligible, bookData, pages, stats):
    """Associa as avaliacoes do RSS de um membro aos livros do clube.

    Primeiro pelo book_id (mesma edicao). Senao, se o autor bater com o de um
    livro do clube, compara as obras: o membro pode ter lido outra edicao ou
    outra traducao. So nesse caso se descarrega a pagina da edicao dele, e o
    resultado fica em cache."""
    by_edition = {book_id: book_id for book_id in eligible}
    by_work = {bookData[book_id]["workId"]: book_id for book_id in eligible if bookData[book_id].get("workId")}
    authors = {
        goodreads.normalize_name(author)
        for book_id in eligible
        for author in bookData[book_id].get("authors") or []
    }

    matches = {}
    for entry in shelf:
        if entry["rating"] <= 0:
            continue  # na estante mas sem nota
        club_id = by_edition.get(entry["bookId"])
        if club_id is None and by_work and goodreads.normalize_name(entry["author"]) in authors:
            work_ids = pages.work_ids(entry["bookId"], entry["title"], entry["author"])
            club_id = next((by_work[w] for w in work_ids if w in by_work), None)
            if club_id:
                stats["other_editions"] += 1
        if club_id and club_id not in matches:
            matches[club_id] = entry
    return matches


def fetch_shelves(members):
    """RSS de cada membro com Goodreads: {nome: [livros]}. Um feed bloqueado
    ou vazio fica de fora com um aviso, sem parar o resto."""
    shelves = {}
    for display_name, member in members.items():
        user_id = member.get("goodreadsUserId")
        if not user_id:
            continue  # sem Goodreads: rating so entra a mao
        try:
            shelf = goodreads.fetch_user_books(user_id)
        except BlockedError as exc:
            print(f"  AVISO: RSS de {display_name} falhou: {exc}")
            continue
        if not shelf:
            print(f"  AVISO: feed do Goodreads de {display_name} vazio (perfil privado?)")
            continue
        print(f"  RSS de {display_name}: {len(shelf)} livros nas estantes.")
        shelves[display_name] = shelf
    return shelves


def update_reviews(bookData, eligible, shelves, pages, stats):
    """Idempotente: so escreve (membro, livro) se ainda nao ha nota nem
    comentario desse membro nesse livro."""
    for display_name, shelf in shelves.items():
        pending = [
            book_id for book_id in eligible
            if display_name not in bookData[book_id].get("reviews", {})
            and display_name not in bookData[book_id].get("comments", {})
        ]
        if not pending:
            continue

        matches = match_ratings(shelf, pending, bookData, pages, stats)
        for book_id, entry in matches.items():
            book = bookData[book_id]
            book.setdefault("reviews", {})[display_name] = entry["rating"]
            stats["reviews_added"] += 1
            if entry["review"]:
                book.setdefault("comments", {})[display_name] = entry["review"]
                stats["comments_added"] += 1


def apply_manual_ratings(bookData, stats, only_members=None):
    """Aplica as notas manuais de manualRatings.json (membros sem Goodreads, ou
    lacunas). So preenche o que falta — nunca sobrescreve. O ficheiro e
    organizado por membro: {"Xadas": {"5907": {"rating": 4}, ...}}.
    Com `only_members` (--user) so os membros desse conjunto sao aplicados."""
    manual = load_json(MANUAL_RATINGS_PATH, {})
    for member, books in manual.items():
        if member.startswith("_"):
            continue
        if only_members is not None and member not in only_members:
            continue
        for book_id, entry in books.items():
            if book_id.startswith("_"):
                continue
            rating = entry.get("rating") if isinstance(entry, dict) else entry
            if not isinstance(rating, (int, float)):
                continue  # null / vazio = ainda nao leu
            book = bookData.get(book_id)
            if book is None:
                continue
            reviews = book.setdefault("reviews", {})
            if member in reviews:
                continue  # ja tem nota — nao mexer
            reviews[member] = rating
            stats["reviews_added"] += 1


def build_book_data(members, book_meta, stats, review_limit=None, only_members=None):
    bookData = load_json(BOOK_DATA_PATH, {})
    edition_cache = load_json(EDITION_CACHE_PATH, {})
    titles = {k: v for k, v in load_json(TITLES_PATH, {}).items() if not k.startswith("_")}
    pages = PageFetcher(edition_cache)
    entries = meta_entries(book_meta)
    print(f"bookMeta.json: {len(entries)} livros.")

    # O bookMeta.json e a lista mestre: um livro tirado de la sai do site.
    for book_id in list(bookData):
        if book_id not in entries:
            print(f"  Removido (ja nao esta no bookMeta.json): {bookData[book_id].get('title', book_id)}")
            del bookData[book_id]
            stats["books_removed"] += 1

    rating_ids = recent_ids(book_meta, review_limit)
    if rating_ids is not None:
        print(f"Ratings: so os {len(rating_ids)} livros mais recentes (--last {review_limit}).")

    # As estantes vem primeiro porque tambem servem de fonte de detalhes e capas.
    shelves = fetch_shelves(members)
    shelf_by_id = {}
    for shelf in shelves.values():
        for entry in shelf:
            shelf_by_id.setdefault(entry["bookId"], entry)

    eligible = []
    for book_id, meta in entries.items():
        is_new = book_id not in bookData
        book = bookData.setdefault(book_id, {
            "link": goodreads.book_link(book_id),
            "reviews": {},
            "comments": {},
        })
        if is_new:
            stats["books_added"] += 1

        book["date"] = meta.get("date")
        book["chosenBy"] = meta.get("chosenBy") or []

        # Capa e detalhes tratam-se mesmo para livros futuros: o "On the way"
        # precisa deles.
        before = json.dumps(book, sort_keys=True)
        title_hint = meta.get("title") or meta.get("_title")
        if not meta.get("title") and book.get("title") and book["title"] == meta.get("_title"):
            # Titulo que era so a pista do link (ex: "1q84"): sai, para o
            # Goodreads o poder preencher a serio.
            del book["title"]
        # Capa escolhida a mao: descarrega-se quando o URL muda.
        if meta.get("cover") and book.get("_coverUrl") != meta["cover"]:
            if replace_cover(book_id, meta["cover"], stats):
                book["_coverUrl"] = meta["cover"]
        update_book_details(book_id, book, shelf_by_id.get(book_id), title_hint, pages, stats)
        # Titulo a mao no bookMeta.json (ex: o titulo portugues) manda sobre o
        # do Goodreads.
        if meta.get("title"):
            book["title"] = meta["title"]
        elif titles.get(book_id):
            book["title"] = titles[book_id]
        # Idem para o ano, quando o que veio de fora esta errado.
        if meta.get("year"):
            book["year"] = meta["year"]
        if not book.get("title"):
            book["title"] = meta.get("_title") or book_id
        if not is_new and json.dumps(book, sort_keys=True) != before:
            stats["details_added"] += 1

        if not has_started(book["date"]):
            stats["books_upcoming"] += 1
        elif rating_ids is None or book_id in rating_ids:
            eligible.append(book_id)

    update_reviews(bookData, eligible, shelves, pages, stats)
    apply_manual_ratings(bookData, stats, only_members)

    # Ordem cronologica no ficheiro, para os diffs lerem-se bem.
    ordered = dict(sorted(
        bookData.items(),
        key=lambda kv: parse_date(kv[1].get("date")) or datetime.max,
    ))
    save_json(BOOK_DATA_PATH, ordered)
    warn_foreign_titles(
        "no clube",
        [(book_id, b.get("title")) for book_id, b in ordered.items() if not book_entry_has_meta_title(book_meta, book_id)],
        titles,
    )
    save_json(EDITION_CACHE_PATH, edition_cache)

    missing_chooser = [b.get("title") for b in ordered.values() if not b.get("chosenBy")]
    if missing_chooser:
        print(f"\nAVISO: {len(missing_chooser)} livro(s) sem chosenBy no bookMeta.json:")
        for title in missing_chooser:
            print(f"  - {title}")
    if pages.blocked:
        print("\nO anti-bot do Goodreads travou alguns pedidos. O que se conseguiu foi")
        print("gravado; corre outra vez daqui a uns minutos para completar o resto.")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Atualiza bookData.json (bookMeta.json + Goodreads).",
    )
    parser.add_argument(
        "--last",
        type=int,
        default=None,
        metavar="N",
        help="So vai buscar ratings dos N livros mais recentes (por data em "
             "bookMeta.json). Sem a flag, tenta todos. Capas e detalhes em "
             "falta continuam a ser tratados para todos.",
    )
    parser.add_argument(
        "--user",
        action="append",
        metavar="NOME",
        help="So atualiza este membro (nome de exibicao do members.json, ex: "
             "--user Geremias). Pode repetir-se para varios. Combina com --last. "
             "Sem a flag, atualiza todos os membros.",
    )
    args = parser.parse_args()
    if args.last is not None and args.last < 1:
        parser.error("--last tem de ser >= 1")
    return args


def select_members(members, names):
    """Restringe os membros aos nomes pedidos com --user. Os nomes tem de ser os
    de exibicao do members.json, com maiusculas iguais — sao a chave usada em
    todo o lado, incluindo no bookData.json."""
    if not names:
        return members
    unknown = [name for name in names if name not in members]
    if unknown:
        print(f"ERRO: membro(s) desconhecido(s): {', '.join(unknown)}", file=sys.stderr)
        print(f"Nomes validos: {', '.join(sorted(members))}", file=sys.stderr)
        sys.exit(2)
    return {name: members[name] for name in names}


def main():
    args = parse_args()
    members = load_json(MEMBERS_PATH, {})
    book_meta = load_json(BOOK_META_PATH, {})

    selected_members = select_members(members, args.user)
    only_members = set(selected_members) if args.user else None
    if only_members:
        print(f"Ratings: so o(s) membro(s) {', '.join(args.user)} (--user).")

    stats = {
        "books_added": 0,
        "books_removed": 0,
        "books_upcoming": 0,
        "details_added": 0,
        "covers_downloaded": 0,
        "reviews_added": 0,
        "comments_added": 0,
        "other_editions": 0,
    }

    try:
        build_book_data(
            selected_members,
            book_meta,
            stats,
            review_limit=args.last,
            only_members=only_members,
        )
    except BlockedError as exc:
        print(f"\nERRO FATAL: {exc}", file=sys.stderr)
        print("O Goodreads bloqueou um pedido. Nada foi gravado.", file=sys.stderr)
        sys.exit(1)

    print("\nResumo:")
    print(f"  Livros novos: {stats['books_added']}")
    print(f"  Livros removidos: {stats['books_removed']}")
    print(f"  Livros por chegar (sem ratings): {stats['books_upcoming']}")
    print(f"  Livros ja existentes com detalhes novos: {stats['details_added']}")
    print(f"  Capas descarregadas: {stats['covers_downloaded']}")
    print(f"  Reviews novas: {stats['reviews_added']}")
    print(f"  Comentarios novos: {stats['comments_added']}")
    print(f"  Ratings encontrados noutra edicao: {stats['other_editions']}")


if __name__ == "__main__":
    main()

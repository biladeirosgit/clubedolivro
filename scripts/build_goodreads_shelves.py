"""
Atualiza src/cdl/goodreadsShelves.json: os livros que cada membro avaliou fora
do clube, no Goodreads ou no Hardcover (conforme o members.json). So a pagina
de perfil os usa, com o toggle "Incluir o Goodreads/Hardcover" ligado.

E um script a parte de proposito: o pipeline do clube (build_book_data.py) nao
mexe neste ficheiro, e este script nao mexe no bookData.json (so o le, para
deixar de fora os livros do clube). Quando entra um livro novo no clube, corre
primeiro o do clube; senao esse livro aparece aqui como "de fora" ate a
corrida seguinte deste script.

    python scripts/build_goodreads_shelves.py                # todos os membros
    python scripts/build_goodreads_shelves.py --user Braz    # so um membro

Um membro que nao foi lido nesta corrida (--user, ou RSS que falhou) mantem o
que ja estava no ficheiro.
"""
import argparse
import sys

from config import (
    BOOK_DATA_PATH,
    MEMBERS_PATH,
    EDITION_CACHE_PATH,
    GOODREADS_SHELVES_PATH,
    OPENLIBRARY_COVER_CACHE_PATH,
    TITLES_PATH,
)
from build_book_data import (
    PageFetcher,
    fetch_shelves,
    load_json,
    match_by_title,
    member_source,
    save_json,
    select_members,
    title_index,
    warn_foreign_titles,
)
from lib import goodreads, openlibrary


def club_matcher(bookData, pages):
    """Funcao que diz se um livro de uma estante e um livro do clube: mesma
    edicao, mesmo titulo e autor (ou ano), ou mesma obra. A obra so e procurada (e fica
    em cache) para livros de autores que o clube ja leu: sao os unicos que
    podem ser outra edicao de um livro do clube."""
    club_ids = set(bookData)
    club_works = {b.get("workId") for b in bookData.values() if b.get("workId")}
    club_authors = {
        goodreads.normalize_name(author)
        for b in bookData.values()
        for author in b.get("authors") or []
    }
    by_title = title_index(bookData, bookData)

    def is_club(entry):
        if club_ids.intersection(entry.get("goodreadsIds") or [entry["bookId"]]):
            return True
        if match_by_title(by_title, entry):
            return True
        author = goodreads.normalize_name(entry["author"])
        if author not in club_authors:
            return False
        return bool(club_works.intersection(pages.work_ids(entry["bookId"], entry["title"], entry["author"])))

    return is_club


def save_shelves(shelves, bookData, pages, titles, sources):
    """Grava os livros com nota de cada membro lido que NAO sao do clube.
    `sources` e {membro: 'goodreads' | 'hardcover'}, e fica no ficheiro para o
    perfil saber que nome dar ao toggle. Devolve {membro: (antes, agora)}."""
    data = load_json(GOODREADS_SHELVES_PATH, {})
    data["_comment"] = (
        "Gerado pelo build_goodreads_shelves.py. Livros avaliados no Goodreads ou no "
        "Hardcover por cada membro (a fonte de cada um esta em _sources), sem os do "
        "clube. So aparece no perfil, com o toggle ligado."
    )
    data["_sources"] = {**data.get("_sources", {}), **sources}
    is_club = club_matcher(bookData, pages)
    cover_cache = load_json(OPENLIBRARY_COVER_CACHE_PATH, {})
    counts = {}
    for member, shelf in shelves.items():
        books = []
        for entry in shelf:
            if entry["rating"] <= 0 or is_club(entry):
                continue  # sem nota, ou e do clube
            ids = entry.get("goodreadsIds") or [entry["bookId"]]
            book = {
                "bookId": entry["bookId"],
                "title": next((titles[i] for i in ids if i in titles), None) or entry["title"],
                "author": entry["author"],
                "year": entry["year"],
                "pages": entry["pages"],
                "rating": entry["rating"],
                "readAt": entry["readAt"],
                "cover": entry["cover"],
            }
            if entry.get("hardcoverId"):
                # Do Hardcover: link para la, e capa da Open Library (as do
                # Hardcover sao carregadas pelos utilizadores).
                book["link"] = entry["link"]
                book["cover"] = openlibrary.cover_url(entry.get("openLibraryIds") or [], cover_cache)
            books.append(book)
        counts[member] = (len(data.get(member) or []), len(books))
        data[member] = books
    save_json(OPENLIBRARY_COVER_CACHE_PATH, dict(sorted(cover_cache.items())))
    save_json(GOODREADS_SHELVES_PATH, data)
    warn_foreign_titles(
        "nas estantes do Goodreads",
        [(b["bookId"], b["title"]) for key, books in data.items() if not key.startswith("_") for b in books],
        titles,
    )
    return counts


def parse_args():
    parser = argparse.ArgumentParser(
        description="Atualiza goodreadsShelves.json (livros de fora do clube, so para o perfil).",
    )
    parser.add_argument(
        "--user",
        action="append",
        metavar="NOME",
        help="So atualiza este membro (nome do members.json, ex: --user Braz). "
             "Pode repetir-se. Sem a flag, atualiza todos os que tem Goodreads.",
    )
    return parser.parse_args()


def main():
    args = parse_args()
    members = select_members(load_json(MEMBERS_PATH, {}), args.user)
    without = [name for name, m in members.items() if member_source(m) is None]
    if args.user and without:
        print(f"AVISO: sem Goodreads nem Hardcover no members.json: {', '.join(without)}")

    bookData = load_json(BOOK_DATA_PATH, {})
    edition_cache = load_json(EDITION_CACHE_PATH, {})
    titles = {k: v for k, v in load_json(TITLES_PATH, {}).items() if not k.startswith("_")}
    pages = PageFetcher(edition_cache)

    shelves = fetch_shelves(members)
    if not shelves:
        print("\nNenhuma estante lida. Nada foi gravado.", file=sys.stderr)
        sys.exit(1)

    sources = {name: member_source(members[name]) for name in shelves}
    counts = save_shelves(shelves, bookData, pages, titles, sources)
    save_json(EDITION_CACHE_PATH, edition_cache)

    print("\nLivros fora do clube (so no perfil):")
    for member, (before, after) in counts.items():
        diff = after - before
        change = f" ({'+' if diff >= 0 else ''}{diff})" if diff else ""
        print(f"  {member}: {after}{change}")


if __name__ == "__main__":
    main()

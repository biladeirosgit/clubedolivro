"""
Atualiza src/cdl/goodreadsShelves.json: os livros que cada membro avaliou no
Goodreads fora do clube. So a pagina de perfil os usa, com o toggle
"Incluir o Goodreads" ligado.

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
    TITLES_PATH,
)
from build_book_data import (
    PageFetcher,
    fetch_shelves,
    load_json,
    save_json,
    select_members,
    warn_foreign_titles,
)
from lib import goodreads, openlibrary


def club_matcher(bookData, pages):
    """Funcao que diz se um livro de uma estante e um livro do clube: mesma
    edicao, mesmo titulo e autor, ou mesma obra. A obra so e procurada (e fica
    em cache) para livros de autores que o clube ja leu: sao os unicos que
    podem ser outra edicao de um livro do clube."""
    club_ids = set(bookData)
    club_works = {b.get("workId") for b in bookData.values() if b.get("workId")}
    club_authors = {
        goodreads.normalize_name(author)
        for b in bookData.values()
        for author in b.get("authors") or []
    }
    club_titles = {
        (goodreads.normalize_name(openlibrary.short_title(b.get("title") or "")),
         goodreads.normalize_name(author))
        for b in bookData.values()
        for author in b.get("authors") or []
    }

    def is_club(entry):
        if entry["bookId"] in club_ids:
            return True
        author = goodreads.normalize_name(entry["author"])
        key = (goodreads.normalize_name(openlibrary.short_title(entry["title"] or "")), author)
        if key in club_titles:
            return True
        if author not in club_authors:
            return False
        return bool(club_works.intersection(pages.work_ids(entry["bookId"], entry["title"], entry["author"])))

    return is_club


def save_shelves(shelves, bookData, pages, titles):
    """Grava os livros com nota de cada membro lido que NAO sao do clube.
    Devolve {membro: (livros antes, livros agora)}."""
    data = load_json(GOODREADS_SHELVES_PATH, {})
    data["_comment"] = (
        "Gerado pelo build_goodreads_shelves.py. Livros avaliados no Goodreads por "
        "cada membro, sem os do clube. So aparece no perfil, com o toggle ligado."
    )
    is_club = club_matcher(bookData, pages)
    counts = {}
    for member, shelf in shelves.items():
        books = []
        for entry in shelf:
            if entry["rating"] <= 0 or is_club(entry):
                continue  # sem nota, ou e do clube
            books.append({
                "bookId": entry["bookId"],
                "title": titles.get(entry["bookId"]) or entry["title"],
                "author": entry["author"],
                "year": entry["year"],
                "pages": entry["pages"],
                "rating": entry["rating"],
                "readAt": entry["readAt"],
                "cover": entry["cover"],
            })
        counts[member] = (len(data.get(member) or []), len(books))
        data[member] = books
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
    without = [name for name, m in members.items() if not m.get("goodreadsUserId")]
    if args.user and without:
        print(f"AVISO: sem Goodreads no members.json: {', '.join(without)}")

    bookData = load_json(BOOK_DATA_PATH, {})
    edition_cache = load_json(EDITION_CACHE_PATH, {})
    titles = {k: v for k, v in load_json(TITLES_PATH, {}).items() if not k.startswith("_")}
    pages = PageFetcher(edition_cache)

    shelves = fetch_shelves(members)
    if not shelves:
        print("\nNenhuma estante lida. Nada foi gravado.", file=sys.stderr)
        sys.exit(1)

    counts = save_shelves(shelves, bookData, pages, titles)
    save_json(EDITION_CACHE_PATH, edition_cache)

    print("\nLivros fora do clube (so no perfil):")
    for member, (before, after) in counts.items():
        diff = after - before
        change = f" ({'+' if diff >= 0 else ''}{diff})" if diff else ""
        print(f"  {member}: {after}{change}")


if __name__ == "__main__":
    main()

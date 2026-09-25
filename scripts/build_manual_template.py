"""
Gera/atualiza scripts/manualRatings.json — o ficheiro onde metes as notas dos
membros SEM Goodreads (e lacunas), organizado por membro.

Para cada membro sem Goodreads, lista os livros que ainda NAO tem nota, com o
titulo para referencia e um campo "rating" a null. Escreves a nota (0.5 a 5) nos
que leu e deixas null nos que nao leu.

- Preserva as notas que ja tinhas escrito no ficheiro (nao apaga o teu trabalho).
- Livros que ja tenham nota (no bookData ou preenchidos por ti) saem do template.
- Livros que ainda nao chegaram (data no futuro) nao entram.

Correr:  python scripts/build_manual_template.py
Depois:  preenche scripts/manualRatings.json e corre  python scripts/build_book_data.py
"""
import json
from datetime import datetime

from config import BOOK_DATA_PATH, MEMBERS_PATH, MANUAL_RATINGS_PATH


def parse_date(d):
    try:
        day, month, year = (d or "01/01/1900").split("/")
        return (int(year), int(month), int(day))
    except (ValueError, AttributeError):
        return (1900, 1, 1)


def load_json(path, default):
    if not path.exists():
        return default
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main():
    books = load_json(BOOK_DATA_PATH, {})
    members = load_json(MEMBERS_PATH, {})
    existing = load_json(MANUAL_RATINGS_PATH, {})

    manual_members = [name for name, m in members.items() if not m.get("goodreadsUserId")]

    # livros ja chegados, por ordem cronologica (mais antigo primeiro)
    today = datetime.now()
    today_key = (today.year, today.month, today.day)
    books_sorted = sorted(
        (kv for kv in books.items() if parse_date(kv[1].get("date")) <= today_key),
        key=lambda kv: parse_date(kv[1].get("date")),
    )

    out = {}
    total_slots = 0
    for member in manual_members:
        prev = existing.get(member, {})
        member_block = {
            "_note": f"Nota de 0.5 a 5 nos livros que {member} leu; deixa null nos que nao leu.",
        }
        for slug, book in books_sorted:
            # ja tem nota no site -> nao precisa de estar no template
            if member in (book.get("reviews") or {}):
                continue
            # preserva o que ja tinhas escrito
            prev_rating = None
            if isinstance(prev.get(slug), dict):
                prev_rating = prev[slug].get("rating")
            member_block[slug] = {
                "rating": prev_rating,
                "title": f"{book.get('title')} ({book.get('year')})",
            }
            total_slots += 1
        out[member] = member_block

    with open(MANUAL_RATINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=4)

    print(f"manualRatings.json atualizado: {len(manual_members)} membros, {total_slots} slots por preencher.")
    for member in manual_members:
        filled = sum(
            1 for slug, e in out[member].items()
            if not slug.startswith("_") and isinstance(e.get("rating"), (int, float))
        )
        pending = sum(1 for slug in out[member] if not slug.startswith("_")) - filled
        print(f"  {member:10} preenchidos {filled:3} · por preencher {pending}")


if __name__ == "__main__":
    main()

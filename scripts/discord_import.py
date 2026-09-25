"""
Importa os livros que ja sairam a partir de um export do canal do Discord.

Procura links do Goodreads (goodreads.com/book/show/<ID>) nas mensagens e
acrescenta ao bookMeta.json os que ainda la nao estao, com:

- date      = inicio do periodo de leitura, quando a mensagem o traz (ex:
              "15 julho - 15 agosto", na propria mensagem do link ou numa
              mensagem logo ao lado, do mesmo autor e do mesmo dia). O ano sai
              da data da mensagem. Sem periodo, fica o dia da mensagem.
- chosenBy  = [] (ou o que vier em --chosen-by)
- _title    = titulo tirado do proprio link, quando o traz (ex: .../18007564-the-martian).
              So para te orientares e para ajudar a pesquisa no Goodreads.

Formatos aceites (pelo que o ficheiro parecer, nao pela extensao):
- JSON do DiscordChatExporter
- CSV do DiscordChatExporter
- Texto: o .txt do DiscordChatExporter ("[05/01/2025 20:13] Autor") ou
  mensagens copiadas a mao do Discord ("autor — 05/01/2025 20:13").

Um livro que aparece varias vezes fica com a mensagem mais recente: quando o
periodo muda, volta-se a mandar o link com as datas novas. Nunca mexe em
entradas que ja existam no bookMeta.json.

Correr:  python scripts/discord_import.py scripts/discord_export.json
         python scripts/discord_import.py export.txt --dry-run            (so mostra)
         python scripts/discord_import.py export.txt --chosen-by Braz     (chosenBy provisorio)
"""
import argparse
import csv
import io
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

from config import BOOK_META_PATH
from lib import goodreads

DATE_PATTERNS = [
    (re.compile(r"\b(\d{4})-(\d{2})-(\d{2})"), lambda m: (m.group(3), m.group(2), m.group(1))),
    (re.compile(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b"), lambda m: (m.group(1), m.group(2), m.group(3))),
]
# Cabecalho do .txt do DiscordChatExporter: "[05/01/2025 20:13] Autor"
TXT_HEADER_RE = re.compile(r"^\[(?P<date>[^\]]+)\]\s+(?P<author>.+)$")
# Cabecalho de mensagens copiadas do Discord: "braz — 27/08/2026 21:35",
# "braz — Hoje às 21:35", "braz — Ontem às 21:35".
COPY_HEADER_RE = re.compile(
    r"^(?P<author>\S.*?)\s+—\s+(?P<date>\d{1,2}/\d{1,2}/\d{4}|hoje|ontem|today|yesterday)\b.*$",
    re.IGNORECASE,
)

MONTHS = {
    "janeiro": 1, "fevereiro": 2, "marco": 3, "março": 3, "abril": 4, "maio": 5, "junho": 6,
    "julho": 7, "agosto": 8, "setembro": 9, "outubro": 10, "novembro": 11, "dezembro": 12,
}
# Inicio de um periodo: "15 julho - 15 agosto", "17 janeiro ate dia 18 de fevereiro".
PERIOD_START_RE = re.compile(
    r"\b(\d{1,2})\s*(?:de\s+)?(" + "|".join(MONTHS) + r")\b",
    re.IGNORECASE,
)


def find_date(text):
    """Primeira data reconhecida no texto, como datetime, ou None."""
    for pattern, parts in DATE_PATTERNS:
        match = pattern.search(text or "")
        if match:
            day, month, year = parts(match)
            try:
                return datetime(int(year), int(month), int(day))
            except ValueError:
                continue
    return None


def header_date(value):
    word = (value or "").strip().lower()
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    if word in ("hoje", "today"):
        return today
    if word in ("ontem", "yesterday"):
        return today - timedelta(days=1)
    return find_date(value)


def iso_to_date(value):
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, AttributeError):
        return find_date(value)


def from_json(data):
    """Mensagens do JSON do DiscordChatExporter, pela ordem do ficheiro."""
    messages = []
    for msg in data.get("messages", []):
        author = msg.get("author") or {}
        text_parts = [msg.get("content") or ""]
        for embed in msg.get("embeds") or []:
            text_parts.append(embed.get("url") or "")
        messages.append({
            "date": iso_to_date(msg.get("timestamp")),
            "author": author.get("nickname") or author.get("name"),
            "text": "\n".join(text_parts),
        })
    return messages


def from_csv(text):
    """CSV do DiscordChatExporter (AuthorID,Author,Date,Content,...)."""
    return [
        {"date": iso_to_date(row.get("Date")), "author": row.get("Author"), "text": row.get("Content") or ""}
        for row in csv.DictReader(io.StringIO(text))
    ]


def from_text(text):
    """Texto: cada cabecalho abre uma mensagem, e as linhas seguintes sao dela."""
    messages = []
    current = None
    for line in text.splitlines():
        stripped = line.strip()
        header = TXT_HEADER_RE.match(stripped) or COPY_HEADER_RE.match(stripped)
        if header:
            current = {
                "date": header_date(header.group("date")),
                "author": header.group("author").strip(),
                "lines": [],
            }
            messages.append(current)
        elif current is not None:
            current["lines"].append(line)
    for msg in messages:
        msg["text"] = "\n".join(msg.pop("lines"))
    return messages


def read_messages(path):
    text = Path(path).read_text(encoding="utf-8-sig")
    stripped = text.lstrip()
    if stripped.startswith("{"):
        return from_json(json.loads(text))
    if stripped.startswith("AuthorID,") or stripped.startswith('"AuthorID"'):
        return from_csv(text)
    return from_text(text)


def period_start(text, message_date):
    """Inicio do primeiro periodo "DD mes" no texto, com o ano deduzido da data
    da mensagem: o livro e sorteado antes de comecar, portanto uma data mais de
    dois meses antes da mensagem e do ano seguinte (sorteio em dezembro para
    janeiro)."""
    match = PERIOD_START_RE.search(text or "")
    if not match or message_date is None:
        return None
    day = int(match.group(1))
    month = MONTHS[match.group(2).lower()]
    for year in (message_date.year, message_date.year + 1):
        try:
            start = datetime(year, month, day)
        except ValueError:
            return None
        if start >= message_date - timedelta(days=60):
            return start
    return None


def neighbours(messages, i):
    """Mensagens logo antes e logo depois, do mesmo autor e do mesmo dia, sem
    links do Goodreads. E onde costuma estar o periodo quando nao vem junto
    com o link."""
    msg = messages[i]
    for j in (i - 1, i + 1):
        if 0 <= j < len(messages):
            other = messages[j]
            same_day = other["date"] and msg["date"] and other["date"].date() == msg["date"].date()
            if same_day and other["author"] == msg["author"] and not goodreads.BOOK_URL_RE.search(other["text"]):
                yield other


def extract_books(messages):
    """{book_id: {posted, author, title, start}}, com a mensagem mais recente
    de cada livro."""
    found = {}
    for i, msg in enumerate(messages):
        for match in goodreads.BOOK_URL_RE.finditer(msg["text"] or ""):
            after_link = msg["text"][match.end():]
            start = period_start(after_link, msg["date"])
            if start is None:
                for other in neighbours(messages, i):
                    start = period_start(other["text"], msg["date"])
                    if start:
                        break
            book_id = match.group(1)
            previous = found.get(book_id)
            if previous and previous["posted"] and msg["date"] and previous["posted"] >= msg["date"]:
                continue
            found[book_id] = {
                "posted": msg["date"],
                "author": msg["author"],
                "title": goodreads.title_hint_from_url(match.group(0)),
                "start": start,
            }
    return found


def fmt(date):
    return date.strftime("%d/%m/%Y") if date else None


def main():
    parser = argparse.ArgumentParser(description="Importa livros do export do Discord para o bookMeta.json.")
    parser.add_argument("export", help="Ficheiro exportado do Discord (.json, .csv ou .txt)")
    parser.add_argument("--dry-run", action="store_true", help="So mostra o que ia acrescentar, sem gravar.")
    parser.add_argument("--chosen-by", action="append", metavar="NOME", default=[],
                        help="chosenBy a por em todos os livros novos (provisorio). Pode repetir-se.")
    args = parser.parse_args()

    found = extract_books(read_messages(args.export))
    if not found:
        print("Nenhum link do Goodreads (goodreads.com/book/show/...) encontrado no ficheiro.")
        sys.exit(1)

    book_meta = json.loads(BOOK_META_PATH.read_text(encoding="utf-8")) if BOOK_META_PATH.exists() else {}
    new_ids = [book_id for book_id in found if book_id not in book_meta]
    print(f"{len(found)} livro(s) no export, {len(found) - len(new_ids)} ja no bookMeta.json, {len(new_ids)} novo(s).\n")

    # Por ordem cronologica, que e como se le o bookMeta.json.
    new_ids.sort(key=lambda b: found[b]["start"] or found[b]["posted"] or datetime.max)
    for book_id in new_ids:
        info = found[book_id]
        entry = {}
        if info["title"]:
            entry["_title"] = info["title"]
        entry["date"] = fmt(info["start"] or info["posted"])
        if not info["start"]:
            entry["_date"] = "sem periodo na mensagem: e o dia em que o link foi mandado"
        entry["chosenBy"] = list(args.chosen_by)
        book_meta[book_id] = entry
        source = "periodo" if info["start"] else "mensagem"
        print(f"  {entry['date'] or '??/??/????'} ({source:8})  {book_id:>10}  {info['title'] or ''}")

    no_period = [book_id for book_id in new_ids if not found[book_id]["start"]]
    if no_period:
        print(f"\nAVISO: {len(no_period)} livro(s) sem periodo na mensagem — confirma o 'date' a mao.")

    if args.dry_run:
        print("\n--dry-run: nada gravado.")
        return

    BOOK_META_PATH.write_text(json.dumps(book_meta, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")
    print("\nbookMeta.json atualizado. Revê as datas, o chosenBy e corre:")
    print("  python scripts/build_book_data.py")


if __name__ == "__main__":
    main()

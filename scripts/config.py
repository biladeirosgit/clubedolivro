import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _load_env_file():
    """Le o .env da raiz (KEY=valor por linha) para o ambiente. Nao sobrepoe
    variaveis ja definidas (ex: os secrets do GitHub Actions)."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_env_file()

BOOK_DATA_PATH = ROOT / "src" / "cdl" / "bookData.json"
MEMBERS_PATH = ROOT / "scripts" / "members.json"
BOOK_META_PATH = ROOT / "scripts" / "bookMeta.json"
MANUAL_RATINGS_PATH = ROOT / "scripts" / "manualRatings.json"
# Titulos a mostrar (em ingles, exceto livros portugueses), por ID do Goodreads.
TITLES_PATH = ROOT / "scripts" / "titles.json"
# Livros que cada membro avaliou no Goodreads fora do clube. So a pagina de
# perfil os usa, e so com o toggle ligado.
GOODREADS_SHELVES_PATH = ROOT / "src" / "cdl" / "goodreadsShelves.json"
# Cache edicao -> obra do Goodreads (ver lib/goodreads.py). Evita voltar a
# descarregar a pagina de cada edicao que um membro leu em todos os runs.
EDITION_CACHE_PATH = ROOT / "scripts" / "editionCache.json"

COVERS_DIR = ROOT / "public" / "covers"

GOODREADS_BASE = "https://www.goodreads.com"

# Hardcover: a API oficial, para os membros que usam o Hardcover em vez do
# Goodreads (`hardcoverUsername` no members.json). A chave e so de leitura e
# fica no .env (nunca versionado) ou num secret do GitHub Actions.
HARDCOVER_API_URL = "https://api.hardcover.app/v1/graphql"
HARDCOVER_TOKEN = os.environ.get("HARDCOVER_TOKEN")
# Cache Open Library ID -> tem capa? (capas dos livros de fora do clube de
# quem usa o Hardcover).
OPENLIBRARY_COVER_CACHE_PATH = ROOT / "scripts" / "openLibraryCoverCache.json"

# Quantos generos do Goodreads guardar por livro. A pagina traz os mais votados
# primeiro, e a partir do quinto ja sao coisas como "Audiobook" ou "Adult".
MAX_GENRES = 5

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

# Delay entre pedidos ao Goodreads (segundos). O anti-bot deles dispara com
# uma dezena de pedidos seguidos, por isso vai-se devagar.
REQUEST_DELAY_RANGE = (3, 6)
# As paginas dos livros sao o que o anti-bot vigia mais: ainda mais devagar.
PAGE_DELAY_RANGE = (8, 15)
REQUEST_TIMEOUT = 20
MAX_RETRIES = 3

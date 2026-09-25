from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

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

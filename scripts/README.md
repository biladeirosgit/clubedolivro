# Pipeline de dados do Clube do Livro

O guia completo está no [README da raiz](../README.md). Aqui fica só o mapa dos ficheiros.

| Ficheiro | O que faz |
| --- | --- |
| `build_book_data.py` | Pipeline principal. Lê `bookMeta.json` + Goodreads e escreve `src/cdl/bookData.json` e `public/covers/` |
| `build_goodreads_shelves.py` | Livros de fora do clube, só para o perfil. Escreve `src/cdl/goodreadsShelves.json` |
| `build_manual_template.py` | (Re)gera `manualRatings.json` com os livros por avaliar de cada membro sem Goodreads |
| `discord_import.py` | Lê um export do canal do Discord e acrescenta os livros ao `bookMeta.json` |
| `config.py` | Caminhos e constantes (delays, número de géneros) |
| `lib/goodreads.py` | Leitura do Goodreads: página do livro, RSS das estantes e pesquisa |
| `lib/openlibrary.py` | Ano da primeira publicação, quando o Goodreads não o dá |
| `lib/http.py` | Sessão HTTP com delay, retry e deteção do anti-bot |
| `lib/images.py` | Download das capas |
| `lib/covers.py` | Corta margens lisas das capas, uma vez, no download |
| `bookMeta.json` | **À mão.** Lista mestre dos livros (ID → data, chosenBy) |
| `titles.json` | **À mão.** Títulos em inglês (exceto livros portugueses), por ID |
| `members.json` | **À mão.** Membros e IDs do Goodreads |
| `manualRatings.json` | **À mão.** Notas de quem não tem Goodreads |
| `editionCache.json` | Gerado. Cache edição → obra, para não repetir pesquisas |

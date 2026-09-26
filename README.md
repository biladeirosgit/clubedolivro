# Clube do Livro

Site do Clube do Livro dos Biladeiros: histórico dos livros, notas e estatísticas.
Sai um livro por mês na roda, e cada um dá a sua nota no Goodreads.
É uma app React (Create React App). Os dados são gerados por um pipeline Python
que lê o Goodreads (feeds RSS das estantes de cada membro e a pesquisa do site).

- **Site:** https://biladeirosgit.github.io/clubedolivro/
- Funciona como o [Clube de Cinema](https://biladeirosgit.github.io/clubedecinema/), com Goodreads em vez de Letterboxd/TMDB.

---

## Setup inicial (uma vez só)

```bash
npm install                              # dependências do site
pip install -r scripts/requirements.txt  # dependências do pipeline
```

Não há tokens: o Goodreads não tem API, e o pipeline só usa páginas públicas.
Os perfis do Goodreads dos membros têm de ser **públicos**, senão o feed vem vazio.

---

## O comando mais comum: adicionar o livro do mês

1. Acrescenta uma entrada em `scripts/bookMeta.json`. A chave é o ID do Goodreads,
   ou seja, o número em `goodreads.com/book/show/<ID>`:
   ```json
   "18007564": { "_title": "The Martian", "date": "01/10/2026", "chosenBy": ["Atlas"] }
   ```
   `date` é o dia em que o livro começa. Cada livro acaba na véspera do livro
   seguinte, portanto não há duração fixa. **Sem esta entrada o livro não
   aparece no site.**
2. Corre o pipeline e publica:
   ```bash
   python scripts/build_book_data.py
   npm run deploy
   ```

### Livros com data no futuro

Um livro com data no futuro fica **só na faixa "On the way"** da página inicial.
Fica fora do catálogo, das estatísticas, dos rankings e do jogo. Aparece sozinho
no dia em que começa: a comparação é feita no browser, por isso não precisas de
correr nada nem de fazer deploy outra vez.

O pipeline vai buscar na mesma a capa e os detalhes deste livro, porque o site
precisa deles para o anunciar. As notas só são lidas depois de o livro começar.

---

## Importar os livros que já saíram (canal do Discord)

1. Exporta o canal com o [DiscordChatExporter](https://github.com/Tyrrrz/DiscordChatExporter),
   em formato **JSON**. O caminho seguro é usar um bot:
   - Cria uma aplicação em https://discord.com/developers/applications e, no
     separador Bot, copia o token.
   - Ativa o **Message Content Intent** no mesmo separador.
   - Convida o bot para o servidor com a permissão *Read Message History*
     (precisas de ser admin).
   - No DiscordChatExporter, cola o token do bot e exporta o canal.

   Também dá para usar o token da tua conta pessoal. Isso **viola os termos do
   Discord** e pode dar ban à conta, por isso não recomendo.

   Alternativa sem ferramentas: pesquisa no Discord `in:#nome-do-canal goodreads.com`
   e copia as mensagens (com as datas) para um `.txt`.
2. Guarda o ficheiro em `scripts/discord_export.json` (ou `.txt`) e corre:
   ```bash
   python scripts/discord_import.py scripts/discord_export.json --dry-run   # só mostra
   python scripts/discord_import.py scripts/discord_export.json             # grava
   ```
3. Revê o `scripts/bookMeta.json`:
   - Confirma as datas. A data de cada livro é o início do período de leitura
     escrito na mensagem (ex.: "15 julho - 15 agosto"). Sem período, fica o dia
     da mensagem, marcado com `_date`.
   - Preenche o `chosenBy` de cada livro (ou usa `--chosen-by NOME` no import
     para pôr um provisório em todos).
   - Apaga as entradas que não são livros do clube.
4. Corre `python scripts/build_book_data.py`.

---

## Comandos do site

| Comando | O que faz |
| --- | --- |
| `npm start` | Servidor de desenvolvimento em http://localhost:3000 (recarrega sozinho) |
| `npm run build` | Compila para `build/` |
| `npm run deploy` | Publica no GitHub Pages (faz `build` automaticamente antes) |
| `npm test` | Corre os testes |

O deploy é sempre **manual**. O workflow automático só faz commit dos dados e
nunca publica o site.

---

## Comandos do pipeline de dados

```bash
python scripts/build_book_data.py                   # corrida completa
python scripts/build_book_data.py --last 3          # notas só dos 3 livros mais recentes
python scripts/build_book_data.py --user Geremias   # só um membro
python scripts/build_manual_template.py             # template das notas manuais
python scripts/discord_import.py <export>           # importar do Discord
python scripts/build_goodreads_shelves.py           # livros de fora do clube (perfil)
```

O `build_book_data.py` escreve em `src/cdl/bookData.json` e descarrega as capas
para `public/covers/<ID>.jpg`.

### Livros de fora do clube (perfil)

Na página de perfil há um toggle **"Incluir o Goodreads"**. Quando está ligado,
as estatísticas dessa pessoa passam a contar também os livros que ela avaliou no
Goodreads fora do clube. Esses livros vivem em `src/cdl/goodreadsShelves.json`,
e um teste garante que mais nenhuma página os importa. Atualizam-se com um
script à parte, que não mexe nos dados do clube:

```bash
python scripts/build_goodreads_shelves.py                # todos os membros
python scripts/build_goodreads_shelves.py --user Braz    # só um
```

Lê as estantes de cada membro (o mesmo RSS do pipeline do clube) e deixa de
fora os livros do clube e os que estão nas estantes sem nota. Quando entra um
livro novo no clube, corre primeiro o `build_book_data.py`. Senão, esse livro
aparece como "de fora" até à corrida seguinte deste script.

**De onde vem cada coisa:**

| Dado | Fonte |
| --- | --- |
| Notas e reviews | Feed RSS das estantes de cada membro (`/review/list_rss/<user>`) |
| Título, autor, ano, páginas, capa | O mesmo feed, se alguém tiver o livro na estante. Senão, a pesquisa do Goodreads |
| Obra (para juntar edições diferentes) | Pesquisa do Goodreads |
| Géneros e co-autores | Página do livro |

**Edições diferentes:** se o clube pôs o link da edição portuguesa e alguém
avaliou a inglesa, a nota entra na mesma. O pipeline compara as obras (work) do
Goodreads, que são comuns a todas as edições.

**Anti-bot do Goodreads:** as páginas dos livros estão atrás de uma proteção que
bloqueia ao fim de poucos pedidos. O RSS e a pesquisa aguentam muito mais. Se
houver bloqueio, o script avisa, grava o que conseguiu e deixa o resto (em geral
os géneros) para a corrida seguinte. Basta voltar a correr mais tarde.

**Garantias do script** (podes correr as vezes que quiseres):
- Nunca sobrescreve uma nota ou comentário já existente, seja de uma corrida
  anterior ou escrito por ti à mão.
- Só descarrega capas que ainda não existam em disco.
- Só pede a página de cada livro uma vez (fica marcado com `_checked`).

Podes editar `src/cdl/bookData.json` à mão à vontade. A tua edição sobrevive às
corridas seguintes.

### Correr pelo GitHub Actions

Em alternativa a correr localmente: separador **Actions** → *Update book data* →
**Run workflow**. Faz commit dos dados e das capas. Continuas a ter de fazer
`npm run deploy` à mão para o site mostrar as mudanças.

---

## Notas dos membros sem Goodreads

Quem não tem Goodreads (neste momento Xadas e Joana) mete as notas à mão.

```bash
python scripts/build_manual_template.py
```

Este comando (re)cria `scripts/manualRatings.json` com os livros que ainda não
têm nota de cada membro. Preenche o `rating` (0.5 a 5) nos que a pessoa leu e
deixa `null` nos outros:

```json
"Xadas": {
    "18007564": { "rating": 4.5, "title": "The Martian (2011)" },
    "5907": { "rating": null, "title": "The Hobbit (1937)" }
}
```

Depois corre `python scripts/build_book_data.py` para juntar as notas.

Podes voltar a correr o `build_manual_template.py` sempre que quiseres. Preserva o
que já preencheste e só acrescenta os livros novos.

O mesmo ficheiro serve para forçar a nota de um membro *com* Goodreads.

---

## Ficheiros que editas à mão

| Ficheiro | Para quê |
| --- | --- |
| `scripts/bookMeta.json` | Lista mestre: ID do Goodreads → data, quem escolheu. Opcionais: `title`, `year` e `cover` (URL de uma capa melhor) |
| `scripts/titles.json` | Títulos a mostrar, por ID do Goodreads (clube e estantes do perfil): em inglês, exceto livros portugueses. O pipeline avisa quando aparece um título que não parece inglês |
| `scripts/manualRatings.json` | Notas dos membros sem Goodreads |
| `scripts/members.json` | Membros: nome → ID de utilizador do Goodreads (ou `null`) |
| `public/pfp/<Nome>.png` | Foto de cada membro. Sem foto aparece a inicial |

Os nomes em `chosenBy` têm de bater certo com as chaves do `members.json`.
O ID de utilizador do Goodreads é o número em `goodreads.com/user/show/<ID>`.

**Membro novo:** acrescenta-o ao `members.json` e mete a foto em `public/pfp/<Nome>.png`.

---

## Estrutura

```
src/                app React (componentes, estilos)
src/cdl/            páginas do clube + bookData.json (gerado)
src/cdl/books.js    ponto de entrada dos dados. Separa os livros que já
                    chegaram dos que estão a caminho e calcula o período de
                    leitura de cada um. As páginas importam daqui, nunca o
                    bookData.json cru.
scripts/            pipeline Python
public/             covers/, pfp/
build/              output do npm run build (não versionado)
```

---

## Resolução de problemas

**Um livro não aparece no site:** falta a entrada no `scripts/bookMeta.json`, ou a
data dele ainda não chegou (nesse caso aparece em "On the way").

**`AVISO: feed do Goodreads de X vazio (perfil privado?)`:** o perfil dessa
pessoa no Goodreads não é público. Em *Settings → Privacy*, "Who can view my
profile" tem de estar em "anyone".

**`Pedido travado pelo anti-bot do Goodreads`:** normal de vez em quando. O que se
conseguiu fica gravado. Espera uns minutos e volta a correr.

**Uma nota não entrou:** a pessoa pode ter avaliado uma edição cuja obra a
pesquisa não reconheceu. Põe a nota à mão no `manualRatings.json`.

**Falta a capa de um livro:** o `npm test` avisa. Volta a correr o pipeline, ou
põe a imagem à mão em `public/covers/<ID>.jpg`.

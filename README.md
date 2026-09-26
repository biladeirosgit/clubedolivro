# Clube do Livro

Site do Clube do Livro dos Biladeiros. Todos os meses sai na roda um livro,
escolhido à vez por um membro, e cada um dá a sua nota no Goodreads. O site
junta o histórico dos livros, as notas e as estatísticas de cada pessoa.

É uma app React (Create React App), irmã do
[Clube de Cinema](https://biladeirosgit.github.io/clubedecinema/). Os dados vêm
de um pipeline Python que lê as estantes dos membros no Goodreads (feeds RSS) e
a pesquisa do site.

- **Site:** https://biladeirosgit.github.io/clubedolivro/
- **Hub dos Biladeiros:** https://biladeirosgit.github.io/

---

## Funcionalidades

**Catálogo** (página inicial)
- O livro que se está a ler em destaque ("A ler agora").
- Faixa "On the way" com os livros que ainda não começaram.
- Todos os livros do clube, com pesquisa por título ou autor, filtros por
  género, por quem escolheu e por ano, e ordenação por data, nota ou ano.
- Card de cada livro: autor, páginas, género, período de leitura, e a nota e o
  comentário de cada membro.

**Estatísticas do clube** (`/stats`)
- Números gerais: livros, notas, páginas lidas, membros.
- Distribuições: notas, décadas de publicação, tamanho.
- Rankings de géneros e autores. Ordenam-se pela média ou por quantos livros,
  e o "Ver todos" abre a lista inteira.
- Livros mais divisivos e de maior consenso, escolhas incompreendidas, livros
  mais lidos, pares com gostos mais parecidos e mais opostos, quem dá notas mais
  odiosas, quem mais comenta e melhores recomendadores.
- Melhores e piores livros, e o ranking de membros (lidos, páginas, média,
  streaks...).

**Perfil de cada membro** (`/users/<nome>`)
- Números, distribuições e rankings da pessoa, e os membros com gostos mais
  parecidos com os dela.
- Toggle **"Incluir o Goodreads"**: junta às estatísticas pessoais os livros
  que a pessoa avaliou no Goodreads fora do clube. Esses livros só aparecem no
  perfil. Abrem um card com as notas de todos os membros que os leram.
- Listas das escolhas e dos livros lidos, com pesquisa, filtros e ordenação.

**Guess** (`/guess`): jogo diário para adivinhar o livro do dia, com pistas.

---

## Guia de comandos

| Quero... | Comando |
| --- | --- |
| Instalar tudo (uma vez) | `npm install` e `pip install -r scripts/requirements.txt` |
| Ver o site no meu PC | `npm start` (abre http://localhost:3000) |
| Atualizar os dados do clube (notas, livros novos) | `python scripts/build_book_data.py` |
| Atualizar só as notas dos livros mais recentes | `python scripts/build_book_data.py --last 3` |
| Atualizar só uma pessoa | `python scripts/build_book_data.py --user Geremias` |
| Atualizar os livros de fora do clube (perfil) | `python scripts/build_goodreads_shelves.py` |
| Preparar as notas de quem não tem Goodreads | `python scripts/build_manual_template.py` |
| Importar livros de um export do Discord | `python scripts/discord_import.py <ficheiro>` |
| Correr os testes | `npm test` (fica a vigiar; `q` para sair) |
| Correr os testes uma vez | `npx react-scripts test --watchAll=false` |
| Guardar as alterações no GitHub | `git add -A`, `git commit -m "..."`, `git push` |
| Publicar o site | `npm run deploy` |

Todos os comandos correm na raiz do repositório
(`C:\Users\35191\Desktop\clubedolivro`).

---

## Setup inicial (uma vez só)

```powershell
npm install                              # dependências do site
pip install -r scripts/requirements.txt  # dependências do pipeline
```

Não há tokens: o Goodreads não tem API, e o pipeline só usa páginas públicas.
Os perfis do Goodreads dos membros têm de ser **públicos**, senão o feed vem
vazio.

---

## Tarefas comuns

### Adicionar o livro do mês

1. Acrescenta uma entrada em `scripts/bookMeta.json`. A chave é o ID do
   Goodreads, o número em `goodreads.com/book/show/<ID>`:
   ```json
   "18007564": { "_title": "The Martian", "date": "01/10/2026", "chosenBy": ["Atlas"] }
   ```
   `date` é o dia em que o livro começa. Cada livro acaba na véspera do livro
   seguinte, por isso não há duração fixa. O `_title` é só para te orientares
   no ficheiro. **Sem esta entrada o livro não aparece no site.**
2. Corre o pipeline. Vai buscar a capa, os detalhes e as notas:
   ```powershell
   python scripts/build_book_data.py
   ```
3. Guarda e publica:
   ```powershell
   git add -A
   git commit -m "Livro de outubro"
   git push
   npm run deploy
   ```

Um livro com data no futuro fica **só na faixa "On the way"**: fora do
catálogo, das estatísticas e do jogo. Aparece sozinho no dia em que começa,
porque a comparação é feita no browser. Não precisas de correr nada nem de
voltar a fazer deploy.

### Atualizar as notas

```powershell
python scripts/build_book_data.py
git add -A
git commit -m "Notas novas"
git push
npm run deploy
```

Com `--last 3` só vai buscar notas aos 3 livros mais recentes. Com
`--user Nome` só a uma pessoa. As duas flags combinam-se.

### Notas dos membros sem Goodreads

Quem não tem Goodreads (neste momento Xadas e Joana) mete as notas à mão.

```powershell
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

Depois corre `python scripts/build_book_data.py` para juntar as notas. Podes
voltar a gerar o template quando quiseres: preserva o que já preencheste. O
mesmo ficheiro serve para forçar a nota de um membro *com* Goodreads.

### Livros de fora do clube (toggle do perfil)

Estes livros vivem em `src/cdl/goodreadsShelves.json` e atualizam-se com um
script à parte, que não mexe nos dados do clube:

```powershell
python scripts/build_goodreads_shelves.py                # todos os membros
python scripts/build_goodreads_shelves.py --user Braz    # só um
```

Lê as estantes de cada membro (o mesmo RSS do pipeline do clube) e deixa de
fora os livros do clube e os que estão nas estantes sem nota. Quando entra um
livro novo no clube, corre primeiro o `build_book_data.py`. Senão, esse livro
aparece como "de fora" até à corrida seguinte deste script.

### Títulos, capas e anos errados

O site mostra os títulos em inglês, exceto os livros escritos originalmente em
português.

- **Título:** acrescenta-o a `scripts/titles.json` (ID → título). O pipeline
  avisa quando aparece um título que não parece estar em inglês e mostra a
  linha pronta a colar.
- **Capa má:** põe `"cover": "<URL de uma capa melhor>"` na entrada do
  `bookMeta.json`. As margens lisas à volta das capas são cortadas sozinhas no
  download.
- **Ano ou título errado num livro do clube:** `"year": 1868` ou
  `"title": "..."` na entrada do `bookMeta.json` mandam sobre o que vem de fora.

Depois corre `python scripts/build_book_data.py`.

### Membro novo

1. Acrescenta-o a `scripts/members.json`, com o ID do Goodreads (o número em
   `goodreads.com/user/show/<ID>`) ou `null`:
   ```json
   "Nome": { "goodreadsUserId": "123456789" }
   ```
2. Mete a foto em `public/pfp/Nome.png`. Sem foto aparece a inicial.
3. Corre `python scripts/build_book_data.py` e
   `python scripts/build_goodreads_shelves.py --user Nome`.

### Importar os livros antigos do canal do Discord

Foi assim que se juntou o histórico do clube. Só é preciso outra vez se
faltarem livros antigos.

1. Exporta o canal com o [DiscordChatExporter](https://github.com/Tyrrrz/DiscordChatExporter),
   em JSON, com um bot:
   - Cria uma aplicação em https://discord.com/developers/applications e, no
     separador Bot, copia o token e ativa o **Message Content Intent**.
   - Convida o bot para o servidor com a permissão *Read Message History*.
   - No DiscordChatExporter, cola o token do bot e exporta o canal.

   Usar o token da tua conta pessoal também funciona, mas **viola os termos do
   Discord** e pode dar ban à conta.

   Alternativa sem ferramentas: pesquisa no Discord
   `in:#nome-do-canal goodreads.com` e copia as mensagens (com as datas) para um
   `.txt`.
2. Guarda o ficheiro em `scripts/discord_export.json` (ou `.txt`). O
   `.gitignore` impede que os exports do Discord vão para o GitHub.
3. Corre:
   ```powershell
   python scripts/discord_import.py scripts/discord_export.json --dry-run   # só mostra
   python scripts/discord_import.py scripts/discord_export.json             # grava
   ```
4. Revê o `scripts/bookMeta.json` (datas e `chosenBy`) e corre
   `python scripts/build_book_data.py`.

### Correr o pipeline pelo GitHub Actions

Em alternativa a correr no PC: separador **Actions** → *Update book data* →
**Run workflow**. Faz commit dos dados e das capas. O deploy continua a ser
manual: depois faz `git pull` e `npm run deploy`.

---

## Como funciona o pipeline

O `build_book_data.py` escreve em `src/cdl/bookData.json` e descarrega as capas
para `public/covers/<ID>.jpg`.

| Dado | Fonte |
| --- | --- |
| Notas e reviews | Feed RSS das estantes de cada membro (`/review/list_rss/<user>`) |
| Título, autor, ano, páginas, capa | O mesmo feed, se alguém tiver o livro na estante. Senão, a pesquisa do Goodreads |
| Obra (para juntar edições diferentes) | Pesquisa do Goodreads |
| Géneros e co-autores | Página do livro |
| Ano da primeira publicação | Open Library, quando o Goodreads não o dá |

**Edições diferentes:** se o clube pôs o link da edição portuguesa e alguém
avaliou a inglesa, a nota entra na mesma, porque o pipeline compara as obras do
Goodreads, comuns a todas as edições.

**Anti-bot do Goodreads:** as páginas dos livros bloqueiam ao fim de poucos
pedidos. O RSS e a pesquisa aguentam muito mais. Se houver bloqueio, o script
avisa, grava o que conseguiu e deixa o resto (em geral os géneros) para a
corrida seguinte. Basta voltar a correr mais tarde.

Pode correr-se as vezes que se quiser:
- Nunca sobrescreve uma nota ou comentário que já lá esteja, venha do Goodreads
  ou tenha sido escrito à mão. Podes editar o `bookData.json` à mão e a edição
  sobrevive.
- Só descarrega capas que ainda não existam.
- Só pede a página de cada livro uma vez.

Mapa dos scripts em [scripts/README.md](scripts/README.md).

---

## Ficheiros que editas à mão

| Ficheiro | Para quê |
| --- | --- |
| `scripts/bookMeta.json` | Lista mestre: ID do Goodreads → data, quem escolheu. Opcionais: `title`, `year` e `cover` |
| `scripts/titles.json` | Títulos a mostrar, por ID (em inglês, exceto livros portugueses) |
| `scripts/manualRatings.json` | Notas dos membros sem Goodreads |
| `scripts/members.json` | Membros: nome → ID de utilizador do Goodreads (ou `null`) |
| `public/pfp/<Nome>.png` | Foto de cada membro. Sem foto aparece a inicial |

Os nomes em `chosenBy` têm de ser iguais às chaves do `members.json`. As datas
são `DD/MM/YYYY`.

---

## Estrutura

```
src/cdl/                  páginas do clube e dados gerados
src/cdl/bookData.json     livros do clube (gerado)
src/cdl/goodreadsShelves.json  livros de fora do clube, só para o perfil (gerado)
src/cdl/books.js          ponto de entrada dos dados: separa os livros que já
                          chegaram dos que estão a caminho e calcula o período
                          de leitura de cada um. As páginas importam daqui,
                          nunca o bookData.json cru.
src/components/           peças partilhadas (linhas de livro, barras, navbar...)
src/utils/                cálculos das estatísticas, datas, filtros
scripts/                  pipeline Python (ver scripts/README.md)
public/                   covers/, pfp/
build/                    output do npm run build (não versionado)
```

---

## Resolução de problemas

**Um livro não aparece no site:** falta a entrada no `scripts/bookMeta.json`,
ou a data dele ainda não chegou (está em "On the way").

**`AVISO: feed do Goodreads de X vazio (perfil privado?)`:** o perfil dessa
pessoa no Goodreads não é público. Em *Settings → Privacy*, "Who can view my
profile" tem de estar em "anyone".

**`Pedido travado pelo anti-bot do Goodreads`:** normal de vez em quando. O que
se conseguiu fica gravado. Espera uns minutos e volta a correr.

**Uma nota não entrou:** a pessoa pode ter avaliado uma edição cuja obra a
pesquisa não reconheceu. Põe a nota à mão no `manualRatings.json`.

**Falta a capa de um livro:** o `npm test` avisa. Volta a correr o pipeline, ou
põe a imagem à mão em `public/covers/<ID>.jpg`.

**`detected dubious ownership in repository`:** o repositório foi criado num
terminal de administrador. Corre uma vez:
```powershell
git config --global --add safe.directory C:/Users/35191/Desktop/clubedolivro
```

**`npm run deploy` dá `Failed to get remote.origin.url`:** a cache do
`gh-pages` ficou com outro dono (o mesmo problema de cima). Apaga-a e volta a
publicar:
```powershell
npx gh-pages-clean
npm run deploy
```

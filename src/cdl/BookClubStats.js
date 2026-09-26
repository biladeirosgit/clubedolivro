// src/BookClubStats.js

import { bookData, readingPeriods } from './books'; // so livros que ja chegaram — ver books.js
import React from 'react';
import './BookClubStats.css';
import BookRow from '../components/BookRow';
import RankedBars from '../components/RankedBars';
import { Link } from 'react-router-dom';
import { compareDatesDesc, hasReadingEnded } from '../utils/dates';
import Avatar from '../components/Avatar';
import InfoTip from '../components/InfoTip';
import { HoverAnchor, BookLines } from '../components/HoverBubble';
import { affinityPairs, suggesterRanking, suggesterAudience, suggesterAverages, suggesterYears, genreRanking, creditRanking, ratingDistribution, ratingSpread, misunderstoodChoices, ratingOdiousness, bookAudience, commenterRanking, decadeStats, pageStats, ownChoiceBias, RATING_BUCKETS, MIN_SHARED, AFFINITY_SHRINK, MIN_RECOMMENDATIONS, MIN_OWN_CHOICES, MIN_OTHER_RATINGS, MIN_HARSHNESS_BOOKS, MIN_GENRE_BOOKS, MIN_AUTHOR_BOOKS, MIN_SPREAD_RATINGS } from '../utils/stats';

const BookClubStats = () => {

    // Quem da notas mais altas, e quanto. E precisamente o que a correlacao
    // ignora -- escrever isto ao lado evita que o numero pareca sair do nada.
    const biasLabel = (pair) => {
        const gap = Math.abs(pair.bias);
        if (gap < 0.1) return 'dao notas igualmente generosas';
        const generoso = pair.bias > 0 ? pair.a : pair.b;
        return `o ${generoso} da +${gap.toFixed(1)}★ em media`;
    };

    // Total de paginas lidas pelo clube (cada livro conta uma vez).
    const calculateTotalPages = () => {
        let totalPages = 0;
        for (const [, book] of Object.entries(bookData)) {
            totalPages += book.pages || 0;
        }
        return totalPages;
    };

    // Media de paginas por livro, so entre os livros com numero de paginas.
    const calculateAveragePages = () => {
        const withPages = Object.values(bookData).filter((book) => book.pages);
        if (!withPages.length) return 0;
        return withPages.reduce((sum, book) => sum + book.pages, 0) / withPages.length;
    };

    // Função para encontrar todas as pessoas únicas que assistiram aos livros
    const findUniqueViewers = () => {
        const viewers = new Set();
        for (const [, book] of Object.entries(bookData)) {
            for (const viewer in book.reviews) {
                viewers.add(viewer);
            }
        }
        return viewers.size;
    };

    // Função para calcular o total de pessoas que assistiram aos livros
    const calculateTotalViewers = () => {
        let totalViewers = 0;
        for (const [, book] of Object.entries(bookData)) {
            totalViewers += Object.keys(book.reviews).length;
        }
        return totalViewers;
    };

    const calculateTotalBooks = () => {
        return Object.entries(bookData).length
    }

    const calculateTopWatchers = () => {
        var watchers = {}

        var books = Object.entries(bookData).sort((a, b) => compareDatesDesc(a[1].date, b[1].date));

        // O streak so olha para leituras ja fechadas: enquanto o livro atual nao
        // acabar (ou seja, enquanto nao comecar o seguinte), quem ainda nao o
        // leu nao deve perder o streak por causa disso.
        const settled = books.filter(([slug]) => hasReadingEnded(readingPeriods[slug]));
        // Do mais recente para o mais antigo, um conjunto de quem leu cada um.
        const seenBy = settled.map(([, book]) => new Set(Object.keys(book.reviews)));

        const ensure = (user) => {
            if (!(user in watchers)) {
                watchers[user] = {
                    "total_books" : 0,
                    "total_ratings" : 0,
                    "pages" : 0,
                    "choices" : 0,
                    "streak" : 0,
                    "max_streak" : 0
                }
            }
            return watchers[user];
        }

        for (const [, book] of books) {
            for (const [user, rating] of Object.entries(book.reviews)) {
                const watcher = ensure(user);
                watcher["total_books"] += 1;
                watcher["total_ratings"] += rating;
                watcher["pages"] += book.pages || 0;
            }

            for (const user of book.chosenBy) {
                ensure(user)["choices"] += 1;
            }
        }

        for (const [user, watcher] of Object.entries(watchers)) {
            let run = 0;
            let longest = 0;
            let firstSeen = -1;

            seenBy.forEach((viewers, index) => {
                if (viewers.has(user)) {
                    if (firstSeen === -1) firstSeen = index;
                    run += 1;
                    if (run > longest) longest = run;
                }
                else {
                    run = 0;
                }
            });

            // Streak atual: positivo = livros seguidos ate ao ultimo ja fechado,
            // negativo = quantos dos mais recentes falhou.
            if (firstSeen === 0) {
                let current = 0;
                while (current < seenBy.length && seenBy[current].has(user)) {
                    current += 1;
                }
                watcher["streak"] = current;
            }
            else if (firstSeen > 0) {
                watcher["streak"] = -firstSeen;
            }
            else {
                watcher["streak"] = 0;
            }

            watcher["max_streak"] = longest;
        }

        return watchers
    }

    // Livros por media, do melhor para o pior. Quem ainda nao tem nota nenhuma
    // fica de fora: o livro em leitura nao pode ser o pior do clube so
    // porque ainda ninguem lhe deu nota (e a media dava NaN).
    const calculateTopBooks = () => {
        let books = Object.entries(bookData)
            .map(([slug, book]) => {
                var reviews = 0;
                var total_rating = 0;

                for (const [, rating] of Object.entries(book.reviews)) {
                    reviews += 1;
                    total_rating += rating;
                }

                return {
                    slug,
                    reviews: reviews,
                    average: reviews ? (total_rating / reviews).toFixed(2) : null,
                };
            })
            .filter((m) => m.average !== null);

        books.sort((a, b) => b.average - a.average);

        return books;
    }

    function getTop10Viewers(data) {
        // Converte o objeto em um array de entradas [chave, valor]
        let entries = Object.entries(data);

        // Adiciona a média de avaliações para cada entrada
        entries = entries.map(([name, info]) => {
            return {
                name,
                total_books: info.total_books,
                total_ratings: info.total_ratings,
                pages: info.pages,
                comments: commentsByName[name] ? commentsByName[name].count : 0,
                choiceYear: eraByName[name] ? Math.round(eraByName[name].average) : null,
                choices: info.choices,
                streak: info.streak,
                max_streak: info.max_streak,
                average_ratings: (info.total_ratings / info.total_books).toFixed(2)
            };
        });

        // Ordena o array pelo total de livros, do maior para o menor
        entries.sort((a, b) => {
            if (b.total_books === a.total_books) {
              return a.name.localeCompare(b.name); // Ordena alfabeticamente pelo nome
            }
            return b.total_books - a.total_books; // Ordena por total de livros
          });
        return entries;
    }

    // Sem corte nem minimo: aqui e a tabela toda, nao um top.
    const commentsByName = Object.fromEntries(commenterRanking(bookData).map((c) => [c.name, c]));
    const eraByName = Object.fromEntries(suggesterYears(bookData, 0).map((e) => [e.name, e]));

    const watchers = calculateTopWatchers()
    const top = getTop10Viewers(watchers)

    const topBooks = calculateTopBooks()

    const top10 = topBooks.slice(0, 10)
    const worst10 = topBooks.slice().reverse().slice(0, 10)

    const ratingStats = ratingDistribution(bookData);
    const maxRatingCount = Math.max(1, ...Object.values(ratingStats));
    const allPairs = affinityPairs(bookData);
    const topPairs = allPairs.slice(0, 10);
    // A cauda da mesma lista: os pares que menos vezes concordam.
    const worstPairs = allPairs.slice().reverse().slice(0, 10);
    const spread = ratingSpread(bookData);
    const mostDivisive = spread.slice(0, 10);
    const mostAgreed = spread.slice().reverse().slice(0, 10);
    const misunderstood = misunderstoodChoices(bookData).slice(0, 10);
    const odious = ratingOdiousness(bookData).slice(0, 10);
    const biggestCrowds = bookAudience(bookData).slice(0, 10);
    const topCommenters = commenterRanking(bookData).slice(0, 10);
    const decades = decadeStats(bookData);
    const maxDecadeCount = Math.max(1, ...decades.map((d) => d.count));
    const pageBuckets = pageStats(bookData);
    const maxPageCount = Math.max(1, ...pageBuckets.map((r) => r.count));
    const selfLovers = ownChoiceBias(bookData).slice(0, 10);
    const topGenreRatings = genreRanking(bookData);
    const bestAuthors = creditRanking(bookData, 'authors', null, MIN_AUTHOR_BOOKS);
    const bestSuggesters = suggesterRanking(bookData).slice(0, 10);
    const biggestAudience = suggesterAudience(bookData).slice(0, 10);
    const suggesterEras = suggesterYears(bookData).slice(0, 10);
    const suggesterAvg = suggesterAverages(bookData);

    return (
        <div className="stats-page">
            <div className='title-site'>
                <h1>Estatísticas do Clube</h1>
            </div>
            <div className="kpi-grid">
                <div className="kpi-tile">
                    <span className="kpi-value">{calculateTotalBooks()}</span>
                    <span className="kpi-label">Livros sorteados</span>
                    <div className="kpi-sub">
                        <span className="kpi-sub-value">{calculateTotalViewers()}</span>
                        <span className="kpi-sub-label">Ratings dados</span>
                    </div>
                </div>
                <div className="kpi-tile">
                    <span className="kpi-value">{calculateTotalPages().toLocaleString('pt-PT')}</span>
                    <span className="kpi-label">Páginas lidas</span>
                    <div className="kpi-sub">
                        <span className="kpi-sub-value">{calculateAveragePages().toFixed(0)}</span>
                        <span className="kpi-sub-label">Páginas / livro</span>
                    </div>
                </div>
                <div className="kpi-tile">
                    <span className="kpi-value">{findUniqueViewers()}</span>
                    <span className="kpi-label">Membros</span>
                    <div className="kpi-sub">
                        <span className="kpi-sub-value">{calculateTotalBooks() ? (calculateTotalViewers() / calculateTotalBooks()).toFixed(1) : '-'}</span>
                        <span className="kpi-sub-label">Leitores / livro</span>
                    </div>
                </div>
            </div>

            <div className="insight-grid">
                <div className="insight-card insight-card--third">
                    <h2>Distribuição de ratings<InfoTip>Quantas vezes o clube deu cada nota, de meia a cinco estrelas. Conta <b>notas</b> e não livros: um livro com oito avaliações entra em oito barras.</InfoTip></h2>
                    <div className="rating-bars">
                        {RATING_BUCKETS.map((key) => {
                            const count = ratingStats[key] || 0;
                            return (
                                <div className="rating-bar-row" key={key}>
                                    <span className="rating-bar-label">{(key / 2).toFixed(1)}★</span>
                                    <div className="rating-bar-track">
                                        <div className="rating-bar-fill" style={{ width: `${(count / maxRatingCount) * 100}%` }} />
                                    </div>
                                    <span className="rating-bar-count">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="insight-card insight-card--third">
                    <h2>O clube por década<InfoTip>A barra é quantos livros o clube leu de cada década de <i>publicação</i>; à direita vai <b>livros · média</b>. A média é a das médias de cada livro, portanto cada livro pesa o mesmo, tenha sido lido por dez pessoas ou por duas. Ordem cronológica, não ranking — le-se como uma linha do tempo.</InfoTip></h2>
                    <div className="rating-bars">
                        {decades.map((d) => (
                            <div className="rating-bar-row" key={d.decade}>
                                <span className="rating-bar-label">{d.decade}s</span>
                                <div className="rating-bar-track">
                                    <div className="rating-bar-fill" style={{ width: `${(d.count / maxDecadeCount) * 100}%` }} />
                                </div>
                                <span className="rating-bar-count">{d.count} · {d.average != null ? d.average.toFixed(2) : '-'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="insight-card insight-card--third">
                    <h2>O clube por tamanho<InfoTip>A barra é quantos livros há em cada escalão de páginas; à direita vai <b>livros · média</b>. A média é a das médias de cada livro, portanto cada livro pesa o mesmo. Por ordem de tamanho, não ranking.</InfoTip></h2>
                    <div className="rating-bars">
                        {pageBuckets.map((r) => (
                            <div className="rating-bar-row" key={r.label}>
                                <span className="rating-bar-label">{r.label}</span>
                                <div className="rating-bar-track">
                                    <div className="rating-bar-fill" style={{ width: `${(r.count / maxPageCount) * 100}%` }} />
                                </div>
                                <span className="rating-bar-count">{r.count} · {r.average != null ? r.average.toFixed(2) : '-'}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="insight-card insight-card--half">
                    <h2>Géneros mais bem avaliados<InfoTip>A barra é quantos livros têm esse género; à direita vai <b>livros · média</b>, e dá para ordenar pela média ou por quantos são. Um livro conta para todos os géneros que tem. A média é a das médias de cada livro, portanto cada livro pesa o mesmo, tenha sido lido por dez pessoas ou por duas. Só entram géneros com pelo menos {MIN_GENRE_BOOKS} livros, senão um género com um livro só encabeçava a lista.</InfoTip></h2>
                    <RankedBars rows={topGenreRatings.map((g) => ({ key: g.name, label: g.name, count: g.count, average: g.average }))} />
                </div>

                <div className="insight-card insight-card--half">
                    <h2>Autores mais bem avaliados<InfoTip>Média dos livros de cada autor que o clube leu, com a barra a mostrar quantos são. Mínimo de {MIN_AUTHOR_BOOKS} livros. Um livro com dois autores conta para os dois.</InfoTip></h2>
                    {bestAuthors.length ? (
                        <RankedBars rows={bestAuthors.map((c) => ({ key: c.name, label: <HoverAnchor detail={<BookLines books={c.books} />}>{c.name}</HoverAnchor>, count: c.count, average: c.average }))} />
                    ) : <p className="highlight-sub">Ainda nenhum autor repetiu.</p>}
                </div>

                <div className="insight-card">
                    <h2>Livros mais divisivos<InfoTip>Desvio-padrão das notas de cada livro: quanto maior, mais espalhadas ficaram as opiniões.<span className="info-tip-formula">σ = √( Σ(nota − média)² ÷ n )</span>Mínimo de {MIN_SPREAD_RATINGS} avaliações — duas pessoas em desacordo não são o clube dividido.</InfoTip></h2>
                    <ol className="ranking">
                        {mostDivisive.map((m) => (
                            <li key={m.slug}>
                                <span>
                                    <HoverAnchor detail={`média ${m.average.toFixed(1)} em ${m.count} notas`}>{m.book.title}</HoverAnchor>
                                </span>
                                <strong>{m.spread.toFixed(2)}</strong>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="insight-card">
                    <h2>Livros de maior consenso<InfoTip>A mesma lista lida ao contrário: os livros em que as notas ficaram mais juntas.<span className="info-tip-formula">σ = √( Σ(nota − média)² ÷ n )</span>σ = 0 seria toda a gente na mesma nota. Mínimo de {MIN_SPREAD_RATINGS} avaliações.</InfoTip></h2>
                    <ol className="ranking">
                        {mostAgreed.map((m) => (
                            <li key={m.slug}>
                                <span>
                                    <HoverAnchor detail={`média ${m.average.toFixed(1)} em ${m.count} notas`}>{m.book.title}</HoverAnchor>
                                </span>
                                <strong>{m.spread.toFixed(2)}</strong>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="insight-card">
                    <h2>Escolhas incompreendidas<InfoTip>Por livro, a nota de quem o trouxe menos a média de <b>todos os outros</b> no mesmo livro. Positivo = gostou muito mais do que o clube. Escolha a meias: conta a média dos dois, e nenhum deles entra na média dos outros. Mínimo de {MIN_OTHER_RATINGS} notas de quem não escolheu.</InfoTip></h2>
                    <ol className="ranking">
                        {misunderstood.map((m) => (
                            <li key={m.slug}>
                                <span>
                                    <HoverAnchor detail={`${m.chosenBy.join(' & ')} deu ${m.own.toFixed(1)} · os outros deram ${m.others.toFixed(1)} em ${m.count} notas`}>
                                        {m.book.title}
                                    </HoverAnchor>
                                </span>
                                <strong>{m.gap > 0 ? '+' : ''}{m.gap.toFixed(2)}</strong>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="insight-card">
                    <h2>Livros mais lidos<InfoTip>Quantos membros avaliaram cada livro. Os livros antigos levam vantagem natural: já passaram por mais gente e ainda há quem vá recuperar atrasos.</InfoTip></h2>
                    <ol className="ranking">
                        {biggestCrowds.map((m) => (
                            <li key={m.slug}>
                                <span>
                                    <HoverAnchor detail={`${m.book.year} · média ${m.average != null ? m.average.toFixed(2) : '-'}`}>{m.book.title}</HoverAnchor>
                                </span>
                                <strong>{m.count}</strong>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="insight-card">
                    <h2>Gostos mais parecidos<InfoTip>
                        1.00 seria gosto idêntico.
                        Correlação de Pearson entre as notas dos dois nos <b>n</b> livros que ambos leram, encolhida pelo tamanho da amostra:
                        <span className="info-tip-formula">r = Σ(a−ā)(b−b̄) ÷ √( Σ(a−ā)² × Σ(b−b̄)² )</span>
                        <span className="info-tip-formula">valor = r × n ÷ (n + {AFFINITY_SHRINK})</span>
                        ā e b̄ são as médias de cada um <i>nesses</i> n livros. Subtraí-las é o que faz com que dar sempre mais baixo não conte como discordar. O n ÷ (n + {AFFINITY_SHRINK}) puxa para zero quem tem poucos livros em comum. Mínimo de {MIN_SHARED} livros.
                    </InfoTip></h2>
                    <ol className="ranking">
                        {topPairs.map((pair) => (
                            <li key={`${pair.a}-${pair.b}`}>
                                <HoverAnchor detail={`${pair.shared} livros em comum · concordam em ${pair.agree} · ${biasLabel(pair)}`}>
                                    {pair.a} &amp; {pair.b}
                                </HoverAnchor>
                                <strong>{pair.score > 0 ? '+' : ''}{pair.score.toFixed(2)}</strong>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="insight-card">
                    <h2>Gostos mais opostos<InfoTip>
                        Negativo: quando um sobe, o outro desce.
                        Correlação de Pearson entre as notas dos dois nos <b>n</b> livros que ambos leram, encolhida pelo tamanho da amostra:
                        <span className="info-tip-formula">r = Σ(a−ā)(b−b̄) ÷ √( Σ(a−ā)² × Σ(b−b̄)² )</span>
                        <span className="info-tip-formula">valor = r × n ÷ (n + {AFFINITY_SHRINK})</span>
                        ā e b̄ são as médias de cada um <i>nesses</i> n livros. Subtraí-las é o que faz com que dar sempre mais baixo não conte como discordar. O n ÷ (n + {AFFINITY_SHRINK}) puxa para zero quem tem poucos livros em comum. Mínimo de {MIN_SHARED} livros.
                    </InfoTip></h2>
                    <ol className="ranking">
                        {worstPairs.map((pair) => (
                            <li key={`${pair.a}-${pair.b}`}>
                                <HoverAnchor detail={`${pair.shared} livros em comum · concordam em ${pair.agree} · ${biasLabel(pair)}`}>
                                    {pair.a} &amp; {pair.b}
                                </HoverAnchor>
                                <strong>{pair.score > 0 ? '+' : ''}{pair.score.toFixed(2)}</strong>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="insight-card">
                    <h2>Quem dá notas mais odiosas<InfoTip>Nao e quem dá notas baixas, é quem <b>afunda um livro mesmo quando isso não é hábito dele</b>. A média de referência é sempre <b>sem a nota dele</b>, senão ele próprio puxava-a para baixo e a diferença saia menor. Desconta-se também o quanto cada um costuma dar acima ou abaixo dos outros — quem dá sempre meia estrela a menos não está a ser odioso, é só a escala dele.<span className="info-tip-formula">desvio = (nota − média dos outros) − viés da pessoa</span><span className="info-tip-formula">odiosidade = média dos desvios negativos</span>Mínimo de {MIN_HARSHNESS_BOOKS} livros com {MIN_OTHER_RATINGS}+ notas de outros.</InfoTip></h2>
                    <ol className="ranking">
                        {odious.map((o) => (
                            <li key={o.name}>
                                <span>
                                    <HoverAnchor focusable={false} detail={`Ficou abaixo dos outros em ${o.count} de ${o.rated} livros, já descontado que costuma dar ${o.bias >= 0 ? '+' : ''}${o.bias.toFixed(2)}. O pior foi ${o.worst.title}: deu ${o.worst.own.toFixed(1)} onde os outros deram ${o.worst.others.toFixed(1)}`}>
                                        <Link to={`/users/${o.name}`}>{o.name}</Link>
                                    </HoverAnchor>
                                </span>
                                <strong>{o.average.toFixed(2)}</strong>
                            </li>
                        ))}
                    </ol>
                </div>

                <div className="insight-card">
                    <h2>Quem mais comenta<InfoTip>Em quantos livros cada um deixou comentário. Cada pessoa tem um comentário por livro, portanto é mesmo uma contagem de livros: ou comentou ou não comentou. A percentagem é sobre os livros que <i>essa</i> pessoa leu — em volume ganha sempre quem anda cá há mais tempo.</InfoTip></h2>
                    {topCommenters.length ? (
                        <ol className="ranking">
                            {topCommenters.map((c) => (
                                <li key={c.name}>
                                    <span>
                                        <HoverAnchor focusable={false} detail={`${Math.round(c.rate * 100)}% dos ${c.watched} livros que leu`}>
                                            <Link to={`/users/${c.name}`}>{c.name}</Link>
                                        </HoverAnchor>
                                    </span>
                                    <strong>{c.count}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda ninguém comentou nada.</p>}
                </div>

                <div className="insight-card">
                    <h2>Recomendador mais gostado<InfoTip>Média dos livros que cada um escolheu, <b>sem a nota do próprio</b> (nem a do co-escolhedor, quando a escolha foi a meias). Livros que mais ninguém avaliou são saltados por completo, senão quem sugeriu era penalizado por ninguém o ter lido. Mínimo de {MIN_RECOMMENDATIONS} escolhas.</InfoTip></h2>
                    {bestSuggesters.length ? (
                        <ol className="ranking">
                            {bestSuggesters.map((s) => (
                                <li key={s.name}>
                                    <span>
                                        <HoverAnchor focusable={false} detail={`${s.count} escolhas contadas`}>
                                            <Link to={`/users/${s.name}`}>{s.name}</Link>
                                        </HoverAnchor>
                                    </span>
                                    <strong>{s.average.toFixed(2)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda ninguém escolheu livros suficientes.</p>}
                </div>

                <div className="insight-card">
                    <h2>Quem gosta mais do que traz<InfoTip>Diferença entre a nota que deu ao livro que trouxe e a média dos <b>outros</b> no mesmo livro. Positivo = gosta mais do que traz do que o clube gosta. A nota de quem co-escolheu também fica de fora da média dos outros. Mínimo de {MIN_OWN_CHOICES} escolhas que a pessoa também tenha avaliado.</InfoTip></h2>
                    {selfLovers.length ? (
                        <ol className="ranking">
                            {selfLovers.map((s) => (
                                <li key={s.name}>
                                    <span>
                                        <HoverAnchor focusable={false} detail={`${s.count} escolhas que também avaliou`}>
                                            <Link to={`/users/${s.name}`}>{s.name}</Link>
                                        </HoverAnchor>
                                    </span>
                                    <strong>{s.average > 0 ? '+' : ''}{s.average.toFixed(2)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda ninguém escolheu livros suficientes.</p>}
                </div>

                <div className="insight-card">
                    <h2>Quem põe o clube a ler<InfoTip>Média de quantas pessoas avaliaram cada livro que essa pessoa escolheu. Aqui um livro que ninguém leu conta mesmo como <b>zero</b> — é precisamente o que a métrica quer medir. Mínimo de {MIN_RECOMMENDATIONS} escolhas.</InfoTip></h2>
                    {biggestAudience.length ? (
                        <ol className="ranking">
                            {biggestAudience.map((s) => (
                                <li key={s.name}>
                                    <span>
                                        <HoverAnchor focusable={false} detail={`${s.count} escolhas`}>
                                            <Link to={`/users/${s.name}`}>{s.name}</Link>
                                        </HoverAnchor>
                                    </span>
                                    <strong>{s.average.toFixed(1)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda ninguém escolheu livros suficientes.</p>}
                </div>

                <div className="insight-card">
                    <h2>Quem escolhe mais antigo<InfoTip>Média do ano de <i>publicação</i> dos livros que cada um escolheu, do mais antigo para o mais recente. Um livro escolhido a meias conta para os dois. Mínimo de {MIN_RECOMMENDATIONS} escolhas.</InfoTip></h2>
                    {suggesterEras.length ? (
                        <ol className="ranking">
                            {suggesterEras.map((s) => (
                                <li key={s.name}>
                                    <span>
                                        <HoverAnchor focusable={false} detail={`${s.count} escolhas`}>
                                            <Link to={`/users/${s.name}`}>{s.name}</Link>
                                        </HoverAnchor>
                                    </span>
                                    <strong>{Math.round(s.average)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda ninguém escolheu livros suficientes.</p>}
                </div>

            </div>

            <div className="top-bottom-books">
                <div className="best-worst">
                    <div className="best-worst-col">
                        <h2 className='section-title'>Melhores avaliados</h2>
                        <div className='book-row-grid book-row-grid--pair'>
                            {top10.map((book, i) => (
                                <BookRow key={book.slug} slug={book.slug} book={bookData[book.slug]} rank={i + 1} />
                            ))}
                        </div>
                    </div>
                    <div className="best-worst-col">
                        <h2 className='section-title'>Piores avaliados</h2>
                        <div className='book-row-grid book-row-grid--pair'>
                            {worst10.map((book, i) => (
                                <BookRow key={book.slug} slug={book.slug} book={bookData[book.slug]} rank={i + 1} />
                            ))}
                        </div>
                    </div>
                </div>

                <h2 className='section-title'>Ranking de membros</h2>
                <div className="table-scroll">
                <table className='pretty-table compact-table'>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Membro</th>
                            <th>Lidos<InfoTip placement="below">Livros do clube que já leu e avaliou.</InfoTip></th>
                            <th>Páginas<InfoTip placement="below">Soma das páginas dos livros que leu.</InfoTip></th>
                            <th>Escolhas<InfoTip placement="below">Livros que trouxe ao clube. Um livro escolhido a meias conta para os dois.</InfoTip></th>
                            <th>Ano esc.<InfoTip placement="below">Ano médio de publicação dos livros que escolheu.</InfoTip></th>
                            <th>Média<InfoTip placement="below">Média de todas as notas que deu.</InfoTip></th>
                            <th>Média esc.<InfoTip placement="below">Média dos livros que escolheu, <b>sem a nota do próprio</b>. Livros que mais ninguém avaliou são saltados.</InfoTip></th>
                            <th>Coment.<InfoTip placement="below">Em quantos livros deixou comentário. Uma review por livro, portanto é uma contagem de livros.</InfoTip></th>
                            <th>Streak<InfoTip placement="below">🔥 = leu os últimos x livros seguidos. ❄️ = não leu os últimos x. Conta até ao último livro já fechado: o livro atual só entra quando sair o seguinte.</InfoTip></th>
                            <th>Max<InfoTip placement="below-right">A maior série de livros seguidos de sempre dessa pessoa.</InfoTip></th>
                        </tr>
                    </thead>
                    <tbody>
                        {top.map((viewer, index) => (
                            <tr key={viewer.name}>
                                    <td>{index + 1}</td>
                                    <td>
                                        <Link to={`/users/${viewer.name}`}>
                                            <div className='user'>
                                                <div className='top'>
                                                        <Avatar name={viewer.name} size={28} linkToUser={false} />
                                                </div>
                                                <div className='bottom'>
                                                    {viewer.name}
                                                </div>
                                            </div>
                                        </Link>
                                    </td>
                                    <td>{viewer.total_books}</td>
                                    <td>{viewer.pages.toLocaleString('pt-PT')}</td>
                                    <td>{viewer.choices}</td>
                                    <td>{viewer.choiceYear ?? '-'}</td>
                                    <td>{viewer.average_ratings}</td>
                                    <td>{suggesterAvg[viewer.name] ? suggesterAvg[viewer.name].average.toFixed(2) : '-'}</td>
                                    <td>{viewer.comments || '-'}</td>
                                    {viewer.streak > 0 && <td>{viewer.streak} 🔥</td>}
                                    {viewer.streak < 0 && <td>{-viewer.streak} ❄️</td>}
                                    {viewer.streak === 0 && <td>-</td>}
                                    <td>{viewer.max_streak > 0 ? viewer.max_streak : '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>

                <h2 className='section-title'>Todos os livros</h2>
                <div className='book-row-grid book-row-grid--list'>
                    {topBooks.map((book, index) => (
                        <BookRow key={book.slug} slug={book.slug} book={bookData[book.slug]} rank={index + 1} variant="list" />
                    ))}
                </div>
            </div>
        </div>


    );
}

export default BookClubStats;

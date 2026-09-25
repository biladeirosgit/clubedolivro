import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { bookData } from './books';
// Livros que cada membro avaliou no Goodreads fora do clube. Esta pagina e o
// unico sitio do site que os importa.
import shelves from './goodreadsShelves.json';
import { mergeShelves, shelfCount } from '../utils/goodreads';
import './BookClubStats.css';
import BookRow from '../components/BookRow';
import InfoTip from '../components/InfoTip';
import { HoverAnchor, BookLines } from '../components/HoverBubble';
import { mostSimilarTo, unratedByUser, ratersOfSuggester, suggestersRatedBy, suggesterAverages, genreRanking, genreCounts, creditCounts, creditRanking, ratingDistribution, RATING_BUCKETS, MIN_SHARED, AFFINITY_SHRINK, MIN_GENRE_BOOKS, MIN_AUTHOR_BOOKS, MIN_CROSS_RATED } from '../utils/stats';
import { compareDatesDesc } from '../utils/dates';

// Preferencia de quem ve o site (nao do perfil): fica ligada ou desligada para
// todos os perfis. O localStorage pode nao existir (modo privado), dai o try.
const GOODREADS_KEY = 'cdl-profile-goodreads';
const readPref = () => {
    try { return localStorage.getItem(GOODREADS_KEY) === '1'; } catch { return false; }
};
const writePref = (on) => {
    try { localStorage.setItem(GOODREADS_KEY, on ? '1' : '0'); } catch { /* sem storage: fica so nesta visita */ }
};

const UserStats = () => {
    const { username } = useParams();
    const [includeGoodreads, setIncludeGoodreads] = useState(readPref);
    const extraCount = shelfCount(shelves, username);
    const withGoodreads = includeGoodreads && extraCount > 0;

    // Com o toggle ligado, as stats do perfil correm sobre o clube + as
    // estantes do Goodreads de todos os membros (para os "gostos parecidos"
    // contarem os livros de fora que duas pessoas leram). O que e sobre o
    // clube em si (escolhas, fas, ainda por ler) fica sempre so com o bookData.
    const data = useMemo(() => (withGoodreads ? mergeShelves(bookData, shelves) : bookData), [withGoodreads]);

    const toggleGoodreads = () => {
        writePref(!includeGoodreads);
        setIncludeGoodreads(!includeGoodreads);
    };

    const otherBiasLabel = (other) => {
        const gap = Math.abs(other.bias);
        if (gap < 0.1) return 'dão notas igualmente generosas';
        return other.bias > 0
            ? `${username} dá +${gap.toFixed(1)}★ que ${other.name}`
            : `${other.name} dá +${gap.toFixed(1)}★ que ${username}`;
    };

    let totalBooksWatched = 0;
    let totalRatings = 0;
    let totalPagesRead = 0;
    for (const slug in data) {
        if (data.hasOwnProperty(slug)) {
            const reviews = data[slug].reviews;
            if (reviews && reviews.hasOwnProperty(username)) {
                totalBooksWatched++;
                totalRatings += reviews[username];
                totalPagesRead += data[slug].pages || 0;
            }
        }
    }
    const averageRating = totalRatings / totalBooksWatched;
    const averagePages = totalPagesRead / totalBooksWatched;
    // Media das escolhas dele, sem a nota do proprio -- a mesma do ranking de
    // membros na pagina do clube.
    const choiceAverage = suggesterAverages(bookData)[username];

    // Livros lidos por este membro, ordenados pela nota que deu (desc). Os de
    // fora do clube (so com o toggle) vao para uma lista a parte.
    const read = Object.entries(data)
        .filter(([, book]) => username in (book.reviews || {}))
        .map(([slug, book]) => ({ slug, book, rating: book.reviews[username] }))
        .sort((a, b) => b.rating - a.rating);
    const watched = read.filter((m) => !m.book.external);
    const readOutside = read.filter((m) => m.book.external);

    // Livros que ele escolheu, da escolha mais recente para a mais antiga.
    const recommendations = Object.entries(bookData)
        .filter(([, book]) => (book.chosenBy || []).includes(username))
        .sort(([, a], [, b]) => compareDatesDesc(a.date, b.date))
        .map(([slug, book]) => ({ slug, book, rating: book.reviews?.[username] }));

    const similar = mostSimilarTo(data, username).slice(0, 10);
    const unrated = unratedByUser(bookData, username);
    const fansOfChoices = ratersOfSuggester(bookData, username);
    const favouriteSuggesters = suggestersRatedBy(bookData, username);
    const topGenres = genreRanking(data, username).slice(0, 10);
    const suggestedGenres = genreCounts(bookData, username).slice(0, 10);
    const suggestedAuthors = creditCounts(bookData, 'authors', username).slice(0, 10);
    const favouriteAuthors = creditRanking(data, 'authors', username, MIN_AUTHOR_BOOKS).slice(0, 10);
    const ratingStats = ratingDistribution(data, username);
    const maxRatingCount = Math.max(1, ...Object.values(ratingStats));

    return (
        <div className="stats-page">
            <div className='title-site'>
                <h1>Perfil de {username}</h1>
            </div>
            {extraCount > 0 && (
                <div className="gr-toggle-row">
                    <label className="gr-toggle">
                        <input type="checkbox" checked={includeGoodreads} onChange={toggleGoodreads} />
                        <span className="gr-toggle-track" aria-hidden="true"><span className="gr-toggle-thumb" /></span>
                        <span>Incluir o Goodreads <span className="gr-toggle-count">+{extraCount} livros fora do clube</span></span>
                    </label>
                    <InfoTip>Junta às estatísticas deste perfil os livros que {username} avaliou no Goodreads e que não são do clube. Mexe nos números, na distribuição de ratings, nos gostos parecidos (também com os livros de fora dos outros membros) e nos autores preferidos. As escolhas, os fãs e o "ainda por ler" continuam só com o clube. Estes livros não aparecem em mais lado nenhum do site.</InfoTip>
                </div>
            )}
            <div className="kpi-grid">
                <div className="kpi-tile">
                    <span className="kpi-value">{totalBooksWatched}</span>
                    <span className="kpi-label">Livros lidos</span>
                    <div className="kpi-sub">
                        <span className="kpi-sub-value">{recommendations.length}</span>
                        <span className="kpi-sub-label">Escolhas</span>
                    </div>
                </div>
                <div className="kpi-tile">
                    <span className="kpi-value">{isNaN(averageRating) ? '-' : averageRating.toFixed(2)}</span>
                    <span className="kpi-label">Média das notas</span>
                    <div className="kpi-sub">
                        <span className="kpi-sub-value">{choiceAverage ? choiceAverage.average.toFixed(2) : '-'}</span>
                        <span className="kpi-sub-label">Média das escolhas</span>
                    </div>
                </div>
                <div className="kpi-tile">
                    <span className="kpi-value">{totalPagesRead.toLocaleString('pt-PT')}</span>
                    <span className="kpi-label">Páginas lidas</span>
                    <div className="kpi-sub">
                        <span className="kpi-sub-value">{isNaN(averagePages) ? '-' : averagePages.toFixed(0)}</span>
                        <span className="kpi-sub-label">Páginas / livro</span>
                    </div>
                </div>
            </div>

            <div className="insight-grid">
                <div className="insight-card">
                    <h2>Gostos mais parecidos<InfoTip>
                        Negativo: quando um sobe, o outro desce.
                        Correlação de Pearson entre as notas dos dois nos <b>n</b> livros que ambos leram, encolhida pelo tamanho da amostra:
                        <span className="info-tip-formula">r = Σ(a−ā)(b−b̄) ÷ √( Σ(a−ā)² × Σ(b−b̄)² )</span>
                        <span className="info-tip-formula">valor = r × n ÷ (n + {AFFINITY_SHRINK})</span>
                        ā e b̄ são as médias de cada um <i>nesses</i> n livros. Subtraí-las é o que faz com que dar sempre mais baixo não conte como discordar. O n ÷ (n + {AFFINITY_SHRINK}) puxa para zero quem tem poucos livros em comum. Mínimo de {MIN_SHARED} livros.
                    </InfoTip></h2>
                    {similar.length ? (
                        <ol className="ranking">
                            {similar.map((s) => (
                                <li key={s.name}>
                                    <span>
                                        <HoverAnchor focusable={false} detail={`${s.shared} livros em comum · concordam em ${s.agree} · ${otherBiasLabel(s)}`}>
                                            <Link to={`/users/${s.name}`}>{s.name}</Link>
                                        </HoverAnchor>
                                    </span>
                                    <strong>{s.score > 0 ? '+' : ''}{s.score.toFixed(2)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda poucos livros em comum para comparar.</p>}
                </div>
                <div className="insight-card">
                    <h2>Fãs das escolhas de {username}<InfoTip>Média que cada pessoa deu aos livros que {username} trouxe ao clube. Só conta quem avaliou pelo menos um deles, e a nota do próprio {username} fica de fora.</InfoTip></h2>
                    {fansOfChoices.length ? (
                        <ol className="ranking">
                            {fansOfChoices.map((r) => (
                                <li key={r.name}>
                                    <span>
                                        <HoverAnchor focusable={false} detail={`${r.count} escolhas avaliadas`}>
                                            <Link to={`/users/${r.name}`}>{r.name}</Link>
                                        </HoverAnchor>
                                    </span>
                                    <strong>{r.average.toFixed(2)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda ninguém avaliou escolhas suficientes de {username}.</p>}
                </div>
                <div className="insight-card">
                    <h2>Recomendadores favoritos<InfoTip>O inverso do card ao lado: média que {username} deu aos livros de cada pessoa que escolhe. As escolhas do próprio {username} entram de propósito — dá para ver se se dá melhor nota do que dá aos outros. Mínimo de {MIN_CROSS_RATED} livros avaliados por sugeridor.</InfoTip></h2>
                    {favouriteSuggesters.length ? (
                        <ol className="ranking">
                            {favouriteSuggesters.map((s) => (
                                <li key={s.name}>
                                    <span>
                                        <HoverAnchor focusable={false} detail={`${s.count} escolhas avaliadas`}>
                                            <Link to={`/users/${s.name}`}>{s.name}</Link>
                                        </HoverAnchor>
                                    </span>
                                    <strong>{s.average.toFixed(2)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">{username} ainda não avaliou escolhas suficientes de ninguém.</p>}
                </div>
                <div className="insight-card">
                    <h2>Distribuição de ratings<InfoTip>Quantas vezes {username} deu cada nota, de meia a cinco estrelas. Uma pessoa concentrada em duas ou três barras usa pouco a escala, o que faz as médias dela dizerem menos.</InfoTip></h2>
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
                <div className="insight-card">
                    <h2>Géneros que traz<InfoTip>Géneros dos livros que {username} <b>trouxe</b> ao clube, não dos que leu. Um livro conta para todos os géneros que tem.</InfoTip></h2>
                    {suggestedGenres.length ? (
                        <ol className="ranking">
                            {suggestedGenres.map((g) => (
                                <li key={g.name}>
                                    <span>{g.name}</span>
                                    <strong>{g.count}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda não escolheu nenhum livro.</p>}
                </div>
                <div className="insight-card">
                    <h2>Géneros mais bem avaliados<InfoTip>Média que {username} deu aos livros de cada género, entre os que leu. Mínimo de {MIN_GENRE_BOOKS} livros por género — um género com um livro só não diz nada sobre gosto.</InfoTip></h2>
                    {topGenres.length ? (
                        <ol className="ranking">
                            {topGenres.map((g) => (
                                <li key={g.name}>
                                    <span>
                                        <HoverAnchor detail={<BookLines books={g.books} />}>{g.name}</HoverAnchor>
                                    </span>
                                    <strong>{g.average.toFixed(2)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda leu poucos livros para comparar géneros.</p>}
                </div>
                <div className="insight-card">
                    <h2>Autores que traz<InfoTip>Autores dos livros que {username} <b>trouxe</b> ao clube, não dos que leu.</InfoTip></h2>
                    {suggestedAuthors.length ? (
                        <ol className="ranking">
                            {suggestedAuthors.map((p) => (
                                <li key={p.name}>
                                    <span>{p.name}</span>
                                    <strong>{p.count}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda não escolheu nenhum livro.</p>}
                </div>
                <div className="insight-card">
                    <h2>Autores preferidos<InfoTip>Média que {username} deu aos livros de cada autor, entre os que leu — aqui é sobre o que leu, não sobre o que escolheu. Mínimo de {MIN_AUTHOR_BOOKS} livros.</InfoTip></h2>
                    {favouriteAuthors.length ? (
                        <ol className="ranking">
                            {favouriteAuthors.map((p) => (
                                <li key={p.name}>
                                    <span>
                                        <HoverAnchor detail={<BookLines books={p.books} />}>{p.name}</HoverAnchor>
                                    </span>
                                    <strong>{p.average.toFixed(2)}</strong>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Ainda não leu {MIN_AUTHOR_BOOKS} livros do mesmo autor.</p>}
                </div>
                <div className="insight-card">
                    <h2>Ainda por ler ({unrated.length})</h2>
                    {unrated.length ? (
                        <ol className="ranking">
                            {unrated.slice(0, 10).map((slug) => (
                                <li key={slug}><span>{bookData[slug].title}</span></li>
                            ))}
                        </ol>
                    ) : <p className="highlight-sub">Já avaliou tudo. Lenda. 🏆</p>}
                </div>
            </div>

            <div className="top-bottom-books">
                {recommendations.length > 0 && (
                    <>
                        <h2 className='section-title'>Escolhas de {username}</h2>
                        <div className="book-row-grid">
                            {recommendations.map((r) => (
                                <BookRow key={r.slug} slug={r.slug} book={r.book} userRating={r.rating} userLabel={username} />
                            ))}
                        </div>
                    </>
                )}

                <h2 className='section-title'>{withGoodreads ? 'Livros lidos no clube' : 'Livros lidos'}</h2>
                <div className="book-row-grid">
                    {watched.map((m) => (
                        <BookRow key={m.slug} slug={m.slug} book={m.book} userRating={m.rating} userLabel={username} />
                    ))}
                </div>

                {withGoodreads && (
                    <>
                        <h2 className='section-title'>Fora do clube · Goodreads ({readOutside.length})</h2>
                        <div className="book-row-grid">
                            {readOutside.map((m) => (
                                <BookRow key={m.slug} slug={m.slug} book={m.book} userRating={m.rating} userLabel={username} />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default UserStats;

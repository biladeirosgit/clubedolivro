import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Book.css';
import './ratings.scss';
import { coverSrc } from '../utils/images';
import { joinWithAmpersand } from '../utils/format';
import { averageFixed } from '../utils/ratings';
import { bookData, readingPeriods } from './books';
import Avatar from '../components/Avatar';

// Recebe so o slug e vai buscar o resto ao bookData — assim os sitios que
// abrem o card nao precisam de saber que campos e que ele mostra.
// Um livro de fora do clube (so no perfil, com o Goodreads ligado) nao esta no
// bookData: vem inteiro em `book`, ja com as notas de todos os membros que o
// avaliaram no Goodreads.
const BookCard = ({ slug, book: outside }) => {
    const root = useRef(null);
    const book = outside || bookData[slug];

    // Se o modal trocar de livro sem fechar, o scroll ficava a meio do card anterior.
    useEffect(() => {
        const scroller = root.current?.closest('.modal-content');
        if (scroller) scroller.scrollTop = 0;
    }, [slug]);

    if (!book) return null;

    const { title, year, link, chosenBy, genres, pages, reviews, comments, authors, external } = book;
    const average = averageFixed(reviews, 2);
    const reviewers = Object.keys(reviews || {});
    const period = external ? null : readingPeriods[slug];
    const cover = external ? book.cover : coverSrc(slug);
    const meta = [year, pages ? `${pages} páginas` : null].filter(Boolean).join(' · ');

    return (
        <div className="mc" ref={root}>
            <div className="mc-hero">
                {cover && <div className="cover-blur-bg" style={{ backgroundImage: `url("${cover}")` }} />}
                <div className="mc-poster">
                    {cover && <img src={cover} alt={`${title} capa`} />}
                </div>
                <div className="mc-hero-info">
                    <p className="mc-kicker">{external ? 'Fora do clube · Goodreads' : 'Livro do clube'}</p>
                    <h2 className="mc-title">{title}</h2>
                    {authors && authors.length > 0 && <p className="mc-authors">{joinWithAmpersand(authors)}</p>}
                    <p className="mc-meta">
                        {meta}
                        {average && average !== '-' && <>{meta && ' · '}média <b>{average}</b> ★</>}
                    </p>
                    {period && (
                        <p className="mc-week">
                            {period.end ? `Lido de ${period.start} a ${period.end}` : `A ler desde ${period.start}`}
                        </p>
                    )}
                    <a className="mc-link" href={link} target="_blank" rel="noopener noreferrer">Ver no Goodreads ↗</a>
                </div>
            </div>

            <div className="mc-body">
                {!external && (
                    <section>
                        <h3>Escolhido por</h3>
                        <p className="mc-chosen">{joinWithAmpersand(chosenBy) || 'Roda do clube'}</p>
                    </section>
                )}

                {genres && genres.length > 0 && (
                    <section>
                        <h3>Géneros</h3>
                        <div className="mc-tags">
                            {genres.map((genre) => <span key={genre}>{genre}</span>)}
                        </div>
                    </section>
                )}

                <section>
                    <h3>{external ? 'Ratings dos membros no Goodreads' : 'Ratings do clube'}</h3>
                    {reviewers.length ? (
                        <div className="mc-reviews">
                            {reviewers.map((user) => {
                                const userComment = comments && comments[user];
                                return (
                                    <div className="mc-review" key={user}>
                                        <div className="mc-review-head">
                                            <Link to={`/users/${user}`} className="mc-review-user">
                                                <Avatar name={user} size="sm" linkToUser={false} />
                                                <span>{user}</span>
                                            </Link>
                                            <ul className="rating-score mc-stars" data-rating={reviews[user]}>
                                                <li className="rating-score-item"></li>
                                                <li className="rating-score-item"></li>
                                                <li className="rating-score-item"></li>
                                                <li className="rating-score-item"></li>
                                                <li className="rating-score-item"></li>
                                            </ul>
                                        </div>
                                        {/* Um comentario por pessoa, com as quebras de linha no
                                            proprio texto (o .mc-comment tem white-space: pre-line).
                                            Vai como HTML porque ha comentarios com links a serio. */}
                                        {userComment && (
                                            <p className="mc-comment" dangerouslySetInnerHTML={{ __html: userComment }}></p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="mc-empty">Ainda sem ratings.</p>
                    )}
                </section>
            </div>
        </div>
    );
}

export default BookCard;

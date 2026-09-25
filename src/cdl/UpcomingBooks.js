import React from 'react';
import { coverSrc } from '../utils/images';
import { joinWithAmpersand } from '../utils/format';
import { readingPeriods } from './books';
import './UpcomingBooks.css';

// Livros ja sorteados que ainda nao comecaram. Nao abrem o BookCard (nao ha
// ratings nenhuns para mostrar) — vao direitos ao Goodreads, que e o que
// interessa a quem ainda tem o livro por ler.
const UpcomingBooks = ({ books }) => {
    if (!books.length) return null;

    return (
        <section className="upcoming">
            <div className="upcoming-head">
                <h2 className="upcoming-title">On the way</h2>
                <p className="upcoming-sub">
                    {books.length === 1 ? 'Já sorteado para a próxima leitura.' : `Já sorteados para as próximas ${books.length} leituras.`}
                </p>
            </div>
            <div className="upcoming-grid">
                {books.map(({ slug, book }) => {
                    const period = readingPeriods[slug];
                    return (
                        <a
                            className="upcoming-card"
                            key={slug}
                            href={book.link}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <div className="upcoming-poster">
                                <img src={coverSrc(slug)} alt={`${book.title} capa`} loading="lazy" />
                                <span className="upcoming-week">
                                    {period?.end ? `${period.start.slice(0, 5)} – ${period.end.slice(0, 5)}` : `a partir de ${book.date}`}
                                </span>
                            </div>
                            <h3 className="upcoming-name">{book.title}</h3>
                            <p className="upcoming-meta">
                                {joinWithAmpersand(book.authors || [])}
                                {book.chosenBy && book.chosenBy.length > 0 && <> · {joinWithAmpersand(book.chosenBy)}</>}
                            </p>
                        </a>
                    );
                })}
            </div>
        </section>
    );
};

export default UpcomingBooks;

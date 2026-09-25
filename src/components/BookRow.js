import React, { useState } from 'react';
import BookCard from '../cdl/BookCard';
import Modal from './Modal';
import { coverSrc } from '../utils/images';
import { average } from '../utils/ratings';
import './BookRow.css';

// Cartao horizontal clicavel: capa + titulo + notas. Abre o card no clique.
// variant: 'card' (default) ou 'list' (mais compacto, com rank).
// Um livro de fora do clube (`book.external`, so no perfil com o Goodreads
// ligado) nao tem card: e um link para o Goodreads, com a capa de la.
const BookRow = ({ slug, book, rank, userRating, userLabel = 'rating', showClubAverage = true, variant = 'card' }) => {
    const [openSlug, setOpenSlug] = useState(null);
    const clubAvg = average(book.reviews);
    const clubAvgLabel = clubAvg === null ? '-' : clubAvg.toFixed(2);

    const info = (
        <div className="book-row-info">
            <h3>{book.title} {book.year && <span className="book-row-year">({book.year})</span>}</h3>
            <div className="book-row-ratings">
                {userRating != null && (
                    <span className="book-row-user">{Number(userRating).toFixed(1)} ★ <span className="book-row-note">{userLabel}</span></span>
                )}
                {book.external ? (
                    <span className="book-row-note">Goodreads ↗</span>
                ) : showClubAverage && (
                    <span className="book-row-club">{clubAvgLabel} ★ <span className="book-row-note">club avg</span></span>
                )}
            </div>
        </div>
    );

    if (book.external) {
        return (
            <a className={`book-row book-row--${variant} book-row--external`} href={book.link} target="_blank" rel="noopener noreferrer">
                {rank != null && <span className="book-row-rank">{rank}</span>}
                {book.cover
                    ? <img src={book.cover} alt={`${book.title} capa`} loading="lazy" />
                    : <span className="book-row-nocover" aria-hidden="true" />}
                {info}
            </a>
        );
    }

    return (
        <>
            <button className={`book-row book-row--${variant}`} onClick={() => setOpenSlug(slug)}>
                {rank != null && <span className="book-row-rank">{rank}</span>}
                <img src={coverSrc(slug)} alt={`${book.title} capa`} loading="lazy" />
                {info}
            </button>
            {openSlug && (
                <Modal onClose={() => setOpenSlug(null)}>
                    <BookCard slug={openSlug} />
                </Modal>
            )}
        </>
    );
};

export default BookRow;

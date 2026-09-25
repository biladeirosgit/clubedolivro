import React, { useState } from 'react';
import './Book.css';
import './ratings.scss';
import BookCard from './BookCard';
import Modal from '../components/Modal';
import { coverSrc } from '../utils/images';
import { joinWithAmpersand } from '../utils/format';
import { average } from '../utils/ratings';

const Book = ({ slug, title, year, link, date, chosenBy, genres, pages, reviews, comments }) => {
    const [openSlug, setOpenSlug] = useState(null);

    const titleYear = year ? `${title} (${year})` : title;
    const avg = average(reviews);
    const avgLabel = avg === null ? '-' : avg.toFixed(1);

    return (
        <div className='BookCard' onClick={() => setOpenSlug(slug)}>
            <div className='simple-poster'>
                <div className='title'>
                    <p>{titleYear}</p>
                </div>
                <div className='poster'>
                    <img src={coverSrc(slug)} alt={`${title} capa`} loading="lazy" />
                    <div className="poster-overlay">
                        {avg !== null && <span className="poster-overlay-avg">{avgLabel} ★</span>}
                        {chosenBy && chosenBy.length > 0 && (
                            <span className="poster-overlay-chosen">escolha de {joinWithAmpersand(chosenBy)}</span>
                        )}
                    </div>
                </div>
            </div>
            {openSlug && (
                <Modal onClose={() => setOpenSlug(null)}>
                    <BookCard slug={openSlug} />
                </Modal>
            )}
        </div>
    );
}

export default Book;

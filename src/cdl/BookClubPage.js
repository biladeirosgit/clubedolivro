import React, { useState, useMemo } from 'react';
import Book from './Book';
import BookCard from './BookCard';
import Modal from '../components/Modal';
import UpcomingBooks from './UpcomingBooks';
import { bookData, upcomingBooks } from './books';
import './BookClubPage.css';
import { average } from '../utils/ratings';
import { compareDatesDesc } from '../utils/dates';
import { coverSrc } from '../utils/images';
import { joinWithAmpersand } from '../utils/format';

// Helper functions
const getUniqueValues = (data, key) => {
    const values = new Set();
    Object.values(data).forEach(book => {
        if (Array.isArray(book[key])) {
            book[key].forEach(item => values.add(item));
        } else if (book[key] != null) {
            values.add(book[key]);
        }
    });
    return Array.from(values).sort();
};

const getYearRange = (data) => {
    const years = Object.values(data).map(book => book.year).filter(Boolean);
    if (!years.length) return [0, 0];
    return [Math.min(...years), Math.max(...years)];
};

const BookClubPage = () => {
    const [selectedGenre, setSelectedGenre] = useState('');
    const [selectedChosenBy, setSelectedChosenBy] = useState('');
    const [sortCriteria, setSortCriteria] = useState('date');
    const [search, setSearch] = useState('');
    const [openSlug, setOpenSlug] = useState(null);

    // Calcular ano mínimo e máximo dos livros
    const [minYear, maxYear] = useMemo(() => getYearRange(bookData), []);
    const [yearRange, setYearRange] = useState([minYear, maxYear]);

    const genres = useMemo(() => getUniqueValues(bookData, 'genres'), []);
    const chosenByPeople = useMemo(() => getUniqueValues(bookData, 'chosenBy'), []);

    const [heroSlug, heroBook] = useMemo(() => {
        const entries = Object.entries(bookData).sort(([, a], [, b]) => compareDatesDesc(a.date, b.date));
        return entries[0] || [null, null];
    }, []);
    const heroAverage = useMemo(() => (heroBook ? average(heroBook.reviews) : null), [heroBook]);

    const compareRatings = (book1, book2) => {
        const avg1 = average(book1.reviews) || 0;
        const avg2 = average(book2.reviews) || 0;
        return avg2 - avg1;
    };

    const filteredBooks = useMemo(() => {
        const query = search.trim().toLowerCase();
        return Object.entries(bookData)
            .filter(([slug, book]) => {
                if (slug === heroSlug) return false; // ja aparece em destaque no hero
                const haystack = `${book.title} ${(book.authors || []).join(' ')}`.toLowerCase();
                const matchesSearch = query ? haystack.includes(query) : true;
                const matchesGenre = selectedGenre ? (book.genres || []).includes(selectedGenre) : true;
                const matchesChosenBy = selectedChosenBy ? (book.chosenBy || []).includes(selectedChosenBy) : true;
                const matchesYear = !book.year || (book.year >= yearRange[0] && book.year <= yearRange[1]);
                return matchesSearch && matchesGenre && matchesChosenBy && matchesYear;
            })
            .sort(([, book1], [, book2]) => {
                if (sortCriteria === 'date') return compareDatesDesc(book1.date, book2.date);
                if (sortCriteria === 'rating') return compareRatings(book1, book2);
                if (sortCriteria === 'year') return book2.year - book1.year;
                return 0;
            });
    }, [search, selectedGenre, selectedChosenBy, yearRange, sortCriteria, heroSlug]);

    return (
        <div className="catalog-root">
            {heroBook && (
                <div className="hero-book" onClick={() => setOpenSlug(heroSlug)}>
                    <div className="cover-blur-bg" style={{ backgroundImage: `url("${coverSrc(heroSlug)}")` }} />
                    <div className="hero-book-content">
                        <div className="hero-book-poster">
                            <img src={coverSrc(heroSlug)} alt={`${heroBook.title} capa`} />
                        </div>
                        <div className="hero-book-info">
                            <div className="hero-book-eyebrow">A ler agora</div>
                            <h2 className="hero-book-title">{heroBook.title}{heroBook.year ? ` (${heroBook.year})` : ''}</h2>
                            <div className="hero-book-meta">
                                {heroBook.authors && heroBook.authors.length > 0 && <>{joinWithAmpersand(heroBook.authors)} · </>}
                                Escolhido por <b>{joinWithAmpersand(heroBook.chosenBy || []) || 'a decidir'}</b>
                                {heroAverage !== null && <> · média <b>{heroAverage.toFixed(2)}</b>/5</>}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <UpcomingBooks books={upcomingBooks} />

            {openSlug && (
                <Modal onClose={() => setOpenSlug(null)}>
                    <BookCard slug={openSlug} />
                </Modal>
            )}

            {/* Filtros */}
            <div className="filters">
                <input
                    type="text"
                    className="filter-search"
                    placeholder="Procurar livro ou autor…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
                    <option value="">Todos os géneros</option>
                    {genres.map((genre, index) => (
                        <option key={index} value={genre}>{genre}</option>
                    ))}
                </select>
                <select value={selectedChosenBy} onChange={(e) => setSelectedChosenBy(e.target.value)}>
                    <option value="">Todas as escolhas</option>
                    {chosenByPeople.map((person, index) => (
                        <option key={index} value={person}>{person}</option>
                    ))}
                </select>
                <select value={sortCriteria} onChange={(e) => setSortCriteria(e.target.value)}>
                    <option value="date">Mais recentes</option>
                    <option value="rating">Melhor rating</option>
                    <option value="year">Ano</option>
                </select>
                <div className="filter-year">
                    <span className="filter-year-label">Ano {yearRange[0]}–{yearRange[1]}</span>
                    <div className="filter-year-sliders">
                        <input
                            type="range"
                            min={minYear}
                            max={maxYear}
                            value={yearRange[0]}
                            onChange={(e) => {
                                const newMin = Number(e.target.value);
                                if (newMin <= yearRange[1]) setYearRange([newMin, yearRange[1]]);
                            }}
                        />
                        <input
                            type="range"
                            min={minYear}
                            max={maxYear}
                            value={yearRange[1]}
                            onChange={(e) => {
                                const newMax = Number(e.target.value);
                                if (newMax >= yearRange[0]) setYearRange([yearRange[0], newMax]);
                            }}
                        />
                    </div>
                </div>
            </div>

            {filteredBooks.length === 0 && (
                <p className="no-results">Nenhum livro encontrado.</p>
            )}

            {/* Catálogo de livros */}
            <div className='catalog-page'>
                {filteredBooks.map(([slug, book], index) => (
                    <div className='book' key={slug} style={{ animationDelay: `${Math.min(index, 20) * 0.03}s` }}>
                        <Book
                            slug={slug}
                            title={book.title}
                            year={book.year}
                            link={book.link}
                            date={book.date}
                            chosenBy={book.chosenBy}
                            genres={book.genres}
                            pages={book.pages}
                            reviews={book.reviews}
                            comments={book.comments}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default BookClubPage;

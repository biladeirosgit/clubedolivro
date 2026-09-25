import React, { useState, useEffect } from 'react';
import { bookData } from './books';
import randomValues from './randomValues.json'; // Importe os valores aleatórios
import BookCard from './BookCard';
import './GuessGame.css';
import './Book.css';
import { coverSrc } from '../utils/images';
import { average } from '../utils/ratings';

// O hub e os clubes vivem todos em biladeirosgit.github.io, portanto partilham
// o localStorage. Chave propria para nao pisar o jogo do clube de cinema.
const STORAGE_KEY = 'cdl-guess';

const findByTitle = (title) => {
    const entry = Object.entries(bookData).find(([, book]) => book.title === title);
    return entry ? { slug: entry[0], ...entry[1] } : null;
};

const GuessGame = () => {
    const [selectedBook, setSelectedBook] = useState(null);
    const [guesses, setGuesses] = useState([]);
    const [input, setInput] = useState('');
    const [filteredBooks, setFilteredBooks] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');
    const [dayOfYear, setDayOfYear] = useState(null);
    const maxGuesses = 20;

    useEffect(() => {
        const now = new Date();
        now.setHours(now.getHours() + 1);

        const start = new Date(now.getFullYear(), 0, 1);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const todayDayOfYear = Math.floor(diff / oneDay) + 1;

        setDayOfYear(todayDayOfYear);

        const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (savedState && savedState.dayOfYear === todayDayOfYear) {
            setGuesses(savedState.guesses || []);
            setGameOver(savedState.gameOver || false);
        }

        const timer = setInterval(() => {
            setTimeLeft(getTimeUntilMidnight());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const gameState = {
            guesses,
            gameOver,
            dayOfYear,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    }, [guesses, gameOver, dayOfYear]);

    useEffect(() => {
        const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (savedState && savedState.dayOfYear !== dayOfYear) {
            setGuesses([]);
            setGameOver(false);
            localStorage.removeItem(STORAGE_KEY);
        }

        // Seleciona o livro aleatório baseado no dia do ano
        const randomValue = randomValues[dayOfYear % randomValues.length];
        const bookSlugs = Object.keys(bookData);
        const bookIndex = Math.floor(randomValue * bookSlugs.length);
        const selectedSlug = bookSlugs[bookIndex];
        if (selectedSlug) setSelectedBook({ slug: selectedSlug, ...bookData[selectedSlug] });
    }, [dayOfYear]);


    const getTimeUntilMidnight = () => {
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        const timeDiff = midnight - now;
        const hours = Math.floor(timeDiff / 1000 / 60 / 60);
        const minutes = Math.floor((timeDiff / 1000 / 60) % 60);
        const seconds = Math.floor((timeDiff / 1000) % 60);
        return `${hours}h ${minutes}m ${seconds}s`;
    };

    const handleGuess = () => {
        if (!selectedBook || guesses.length >= maxGuesses || gameOver) return;

        if (input === selectedBook.title) {
            const feedback = getFeedback(input);
            setGuesses([...guesses, { guess: input, feedback }]);
            setGameOver(true);
        } else {
            if (input === "") { return; }
            if (findByTitle(input) == null) { return; }
            const feedback = getFeedback(input);
            setGuesses([...guesses, { guess: input, feedback }]);
            setInput('');
            setShowSuggestions(false);
        }
    };

    const getFeedback = (guessTitle) => {
        const guessedBook = findByTitle(guessTitle);
        if (!guessedBook) return null;

        const feedback = {};


        feedback.year = {
            color: getYearFeedback(guessedBook.year, selectedBook.year),
            value: guessedBook.year,
            actualValue: selectedBook.year,
            direction: guessedBook.year < selectedBook.year ? ' (cima)' : ' (baixo)'
        }
        feedback.pages = {
            color: getColorFeedback(guessedBook.pages, selectedBook.pages),
            value: guessedBook.pages ?? '-',
            actualValue: selectedBook.pages,
            direction: guessedBook.pages < selectedBook.pages ? ' (cima)' : ' (baixo)'
        };
        feedback.authors = {
            color: getArrayFeedback(guessedBook.authors || [], selectedBook.authors || []),
            value: (guessedBook.authors || []).join(', ') || '-',
            actualValue: (selectedBook.authors || []).join(', ')
        };
        feedback.genres = {
            color: getArrayFeedback(guessedBook.genres || [], selectedBook.genres || []),
            value: (guessedBook.genres || []).join(', ') || '-',
            actualValue: (selectedBook.genres || []).join(', ')
        };
        feedback.reviews = {
            color: getNumberFeedback(Object.keys(guessedBook.reviews).length, Object.keys(selectedBook.reviews).length),
            value: Object.keys(guessedBook.reviews).length,
            actualValue: Object.keys(selectedBook.reviews).length,
            direction: Object.keys(guessedBook.reviews).length < Object.keys(selectedBook.reviews).length ? ' (cima)' : ' (baixo)'
        };
        // Um livro sem notas nenhumas tem media null: mostra-se '-' e so da
        // verde contra outro livro tambem sem notas.
        const fmtAverage = (reviews) => {
            const avg = average(reviews);
            return avg == null ? '-' : avg.toFixed(2);
        };
        let guessedAverage = fmtAverage(guessedBook.reviews)
        let actualAverage = fmtAverage(selectedBook.reviews)

        feedback.average = {
            color: getAverageFeedback(guessedAverage,actualAverage),
            value: guessedAverage,
            actualValue: actualAverage,
            direction: guessedAverage < actualAverage ? ' (cima)' : ' (baixo)'
        };
        feedback.chosenBy = {
            color: getChoosenByFeedback(guessedBook.chosenBy || [], selectedBook.chosenBy || []),
            value: getValueChoosenBy(guessedBook.chosenBy || []) || '-',
            actualValue: selectedBook.chosenBy
        };

        return feedback;
    };

    const getChoosenByFeedback = (guessValue, actualValue) => {
        //actual Value can be a list and guessValue can be a list
        if (actualValue.length === 0 && guessValue.length === 0) return 'green';
        const matchingElements = guessValue.filter(element => actualValue.includes(element));
        var ratio = 0;
        if(matchingElements.length !== 0){
            ratio = matchingElements.length / actualValue.length;
        }
        if (ratio === 1 && actualValue.length === guessValue.length) return 'green';
        if (ratio > 0) return 'yellow';
        return 'red';
    }

    const getValueChoosenBy = (guessValue) => {
        //actual Value can be a list e guessValue pode ser uma lista
        let value = guessValue[0]
        for (let i in guessValue){
            if (i==="0"){
                continue
            }
            else{
                value += " & " + guessValue[i];
            }
        }
        return value
    }

    const getAverageFeedback = (guessValue, actualValue) => {
        if (guessValue === '-' || actualValue === '-') return guessValue === actualValue ? 'green' : 'red';
        const diff = Math.abs(guessValue - actualValue);
        if (diff === 0) return 'green';
        if (diff <= 0.5) return 'yellow';
        return 'red';
    };

    const getYearFeedback = (guessValue, actualValue) => {
        const diff = Math.abs(guessValue - actualValue);
        if (diff === 0) return 'green';
        if (diff <= 5) return 'yellow';
        return 'red';
    };

    // Paginas: amarelo ate 50 paginas de diferenca.
    const getColorFeedback = (guessValue, actualValue) => {
        if (guessValue == null || actualValue == null) return guessValue == actualValue ? 'green' : 'red'; // eslint-disable-line eqeqeq
        const diff = Math.abs(guessValue - actualValue);
        if (diff === 0) return 'green';
        if (diff <= 50) return 'yellow';
        return 'red';
    };

    const getArrayFeedback = (guessArray, actualArray) => {
        if (actualArray.length === 0 && guessArray.length === 0) return 'green';
        const matchingElements = guessArray.filter(element => actualArray.includes(element));
        var ratio = 0;
        if(matchingElements.length !== 0){
            ratio = matchingElements.length / actualArray.length;
        }
        if (ratio === 1 && actualArray.length === guessArray.length) return 'green';
        if (ratio > 0) return 'yellow';
        return 'red';
    };

    const getNumberFeedback = (guessNumber, actualNumber) => {
        const diff = Math.abs(guessNumber - actualNumber);
        if (diff === 0) return 'green';
        if (diff === 1) return 'yellow';
        return 'red';
    };

    const handleChange = (e) => {
        const value = e.target.value;
        setInput(value);
        if (value) {
            const filtered = Object.values(bookData)
                .map(book => book.title)
                .filter(title =>
                    title.toLowerCase().includes(value.toLowerCase()) &&
                    !guesses.some(guessObj => guessObj.guess === title)
                );
            setFilteredBooks(filtered);
            setShowSuggestions(true);
        } else {
            setFilteredBooks([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (bookTitle) => {
        setInput(bookTitle);
        setFilteredBooks([]);
        setShowSuggestions(false);
    };

    if (Object.keys(bookData).length === 0) {
        return (
            <div className="container-guessgame">
                <p className="guess-kicker">Jogo diário</p>
                <h1>Adivinha o livro do dia</h1>
                <p className="guess-sub">Ainda não há livros no clube.</p>
            </div>
        );
    }

    return (
        <div className="container-guessgame">
            <p className="guess-kicker">Jogo diário</p>
            <h1>Adivinha o livro do dia</h1>
            <p className="guess-sub">Dia {dayOfYear} · {maxGuesses - guesses.length} tentativas restantes</p>
            <div className="input-container">
                <input
                    type="text"
                    value={input}
                    onChange={handleChange}
                    placeholder="Escreve um palpite…"
                    disabled={gameOver}
                />
                {showSuggestions && (
                    <div className="suggestions">
                        {filteredBooks.map((bookTitle, index) => {
                            const book = findByTitle(bookTitle);
                            return (
                                <div key={index} className="suggestion-item" onClick={() => handleSuggestionClick(bookTitle)}>
                                    <img src={coverSrc(book.slug)} alt={`${bookTitle} capa`} style={{ width: '36px', height: '54px' }} />
                                    <span>{bookTitle}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            <div className="button">
                <button onClick={handleGuess} disabled={gameOver}>Adivinhar</button>
            </div>

            <div className="guess-table-wrap">
                <table className='pretty-table guess-game'>
                    <thead>
                        <tr>
                            <th>Livro</th>
                            <th>Ano</th>
                            <th>Páginas</th>
                            <th>Autor</th>
                            <th>Géneros</th>
                            <th>Nº reviews</th>
                            <th>Média</th>
                            <th>Escolha</th>
                        </tr>
                    </thead>
                    <tbody>
                        {guesses.map((guessObj, index) => {
                            const guessedBook = findByTitle(guessObj.guess);
                            return (
                                <tr key={index}>
                                    <td>
                                        <div className="firstCol">
                                            <img src={coverSrc(guessedBook.slug)} alt={`${guessObj.guess} capa`} style={{ width: '46px', height: '69px' }} />
                                            <span>{guessObj.guess}</span>
                                        </div>
                                    </td>
                                    <td className={`feedback ${guessObj.feedback.year.color}`}>
                                        {guessObj.feedback.year.value} {guessObj.feedback.year.color !== 'green' ? guessObj.feedback.year.direction : ''}
                                    </td>
                                    <td className={`feedback ${guessObj.feedback.pages.color}`}>
                                        {guessObj.feedback.pages.value} {guessObj.feedback.pages.color !== 'green' && guessObj.feedback.pages.value !== '-' ? guessObj.feedback.pages.direction : ''}
                                    </td>
                                    <td className={`feedback ${guessObj.feedback.authors.color}`}>
                                        {guessObj.feedback.authors.value}
                                    </td>
                                    <td className={`feedback ${guessObj.feedback.genres.color}`}>
                                        {guessObj.feedback.genres.value}
                                    </td>
                                    <td className={`feedback ${guessObj.feedback.reviews.color}`}>
                                        {guessObj.feedback.reviews.value} {guessObj.feedback.reviews.color !== 'green' ? guessObj.feedback.reviews.direction : ''}
                                    </td>
                                    <td className={`feedback ${guessObj.feedback.average.color}`}>
                                        {guessObj.feedback.average.value} {guessObj.feedback.average.color !== 'green' && guessObj.feedback.average.value !== '-' && guessObj.feedback.average.actualValue !== '-' ? guessObj.feedback.average.direction : ''}
                                    </td>
                                    <td className={`feedback ${guessObj.feedback.chosenBy.color}`}>
                                        {guessObj.feedback.chosenBy.value}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {gameOver && (
                <div className="guess-win">
                    <h2>Acertaste em <b>"{selectedBook.title}"</b> com {guesses.length} tentativas!</h2>
                    <p className="guess-next">Próximo livro em {timeLeft}</p>
                    <div className="book-card">
                        <div className="modal-content">
                            <BookCard slug={selectedBook.slug} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GuessGame;

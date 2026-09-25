import rawBookData from './bookData.json';
import { hasArrived, compareDatesAsc, readingPeriods as computePeriods } from '../utils/dates';

// Ponto de entrada unico para os dados do clube.
//
// O bookData.json tem todos os livros ja sorteados, incluindo os que ainda nao
// chegaram. Nenhuma pagina deve importar o JSON cru: quem importa daqui recebe
// so os livros que ja chegaram, e portanto nao ha maneira de um livro por ler
// entrar sem querer numa media, num ranking ou no jogo.

export const splitBySchedule = (data, now = new Date()) => {
    const arrived = {};
    const upcoming = [];

    Object.entries(data).forEach(([slug, book]) => {
        if (hasArrived(book.date, now)) {
            arrived[slug] = book;
        } else {
            upcoming.push({ slug, book });
        }
    });

    // Por ordem cronologica: o proximo livro a chegar aparece primeiro.
    upcoming.sort((a, b) => compareDatesAsc(a.book.date, b.book.date));

    return { arrived, upcoming };
};

const { arrived, upcoming } = splitBySchedule(rawBookData);

// Livros que o clube ja leu (ou esta a ler agora).
export const bookData = arrived;

// Livros ja sorteados mas que ainda nao comecaram: [{ slug, book }].
export const upcomingBooks = upcoming;

// Periodo de leitura de cada livro, calculado sobre todos (futuros incluidos).
export const readingPeriods = computePeriods(rawBookData);

export default bookData;

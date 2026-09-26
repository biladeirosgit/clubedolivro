import { average } from './ratings';
import { parseDDMMYYYY } from './dates';

// Filtros e ordenacao das listas de livros lidos do perfil (os do clube e, com
// o toggle ligado, os do Goodreads), como os do catalogo. Cada item e
// { slug, book, rating, date }: `rating` e a nota do dono do perfil e `date` o
// dia em que o leu (a data do clube, ou a do Goodreads nos livros de fora).

export const DEFAULT_FILTERS = { search: '', genre: '', chosenBy: '', yearRange: null, sort: 'rating' };

// A primeira ('rating') e a nota do dono do perfil: o label leva o nome dele.
export const PROFILE_SORTS = [
    { value: 'rating', label: 'Nota' },
    { value: 'club', label: 'Média dos membros' },
    { value: 'date', label: 'Mais recentes' },
    { value: 'year', label: 'Ano' },
    { value: 'pages', label: 'Mais páginas' },
    { value: 'title', label: 'Título' },
];

const time = (date) => {
    if (!date) return null;
    const t = parseDDMMYYYY(date).getTime();
    return Number.isNaN(t) ? null : t;
};

// Maior primeiro; o que nao tem valor (livro sem paginas, lido sem data) vai
// sempre para o fim, qualquer que seja a ordenacao.
const desc = (a, b) => {
    if (a == null) return b == null ? 0 : 1;
    if (b == null) return -1;
    return b - a;
};

const SORT_KEYS = {
    rating: (item) => item.rating,
    club: (item) => average(item.book.reviews),
    date: (item) => time(item.date),
    year: (item) => item.book.year,
    pages: (item) => item.book.pages,
};

// [ano mais antigo, mais recente] dos livros da lista, ou null se nenhum tem ano.
export const yearBounds = (items) => {
    const years = items.map((item) => item.book.year).filter(Boolean);
    return years.length ? [Math.min(...years), Math.max(...years)] : null;
};

// O intervalo de anos escolhido, encaixado nos limites da lista. `null` (o
// inicial) e a lista toda, e continua a ser quando a lista muda (ex: ao ligar o
// Goodreads entram livros mais antigos).
export const effectiveYearRange = (range, bounds) => {
    if (!bounds) return null;
    if (!range) return bounds;
    const from = Math.min(Math.max(range[0], bounds[0]), bounds[1]);
    const to = Math.max(Math.min(range[1], bounds[1]), from);
    return [from, to];
};

// `bounds` vem de fora quando ha mais do que uma lista com os mesmos filtros:
// o intervalo de anos e o de todas juntas.
export const filterProfileList = (items, filters, bounds = yearBounds(items)) => {
    const query = filters.search.trim().toLowerCase();
    const years = effectiveYearRange(filters.yearRange, bounds);
    const key = SORT_KEYS[filters.sort];
    return items
        .filter(({ book }) => {
            const haystack = `${book.title} ${(book.authors || []).join(' ')}`.toLowerCase();
            if (query && !haystack.includes(query)) return false;
            if (filters.genre && !(book.genres || []).includes(filters.genre)) return false;
            if (filters.chosenBy && !(book.chosenBy || []).includes(filters.chosenBy)) return false;
            if (years && book.year && (book.year < years[0] || book.year > years[1])) return false;
            return true;
        })
        .sort((a, b) => (key ? desc(key(a), key(b)) : 0) || a.book.title.localeCompare(b.book.title));
};

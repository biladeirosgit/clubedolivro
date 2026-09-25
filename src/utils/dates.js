export const parseDDMMYYYY = (str) => {
    const [day, month, year] = str.split('/').map(Number);
    return new Date(year, month - 1, day);
};

export const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const pad = (n) => String(n).padStart(2, '0');

export const formatDDMMYYYY = (date) =>
    `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

export const compareDatesDesc = (dateStrA, dateStrB) =>
    parseDDMMYYYY(dateStrB) - parseDDMMYYYY(dateStrA);

export const compareDatesAsc = (dateStrA, dateStrB) =>
    parseDDMMYYYY(dateStrA) - parseDDMMYYYY(dateStrB);

const startOfDay = (now) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

const isValidDate = (dateStr) => Boolean(dateStr) && !Number.isNaN(parseDDMMYYYY(dateStr).getTime());

// Um livro so "chegou" quando a sua data ja chegou. Os que tem data no futuro
// ficam no "On the way" e nao contam para nada no site.
export const hasArrived = (dateStr, now = new Date()) => {
    if (!isValidDate(dateStr)) return true; // sem data: conta
    return parseDDMMYYYY(dateStr) <= startOfDay(now);
};

// Periodo de leitura de cada livro. Nao ha duracao fixa: quando um livro acaba
// comeca o seguinte no dia a seguir, portanto cada livro vai desde a sua data
// ate a vespera da data do proximo. O ultimo livro da lista nao tem fim (`end`
// null) -- esta a ser lido ate sair outro.
//
// Recebe o JSON cru, com os livros futuros incluidos: o livro atual acaba na
// vespera do que esta "On the way", mesmo que esse ainda nao tenha chegado.
// Devolve { id: { start, end } } com as datas em DD/MM/YYYY.
export const readingPeriods = (data) => {
    const dated = Object.entries(data)
        .filter(([, book]) => isValidDate(book.date))
        .sort(([, a], [, b]) => compareDatesAsc(a.date, b.date));

    const periods = {};
    dated.forEach(([id, book], i) => {
        const next = dated.slice(i + 1).find(([, other]) => compareDatesAsc(other.date, book.date) > 0);
        periods[id] = {
            start: book.date,
            end: next ? formatDDMMYYYY(addDays(parseDDMMYYYY(next[1].date), -1)) : null,
        };
    });
    return periods;
};

// O periodo de um livro so esta fechado quando o seu ultimo dia ja passou.
// Enquanto isso nao acontece o livro ainda esta a ser lido, portanto nao deve
// penalizar o streak de quem ainda nao chegou a ele.
export const hasReadingEnded = (period, now = new Date()) => {
    if (!period) return true; // sem data: conta como fechado
    if (!period.end) return false;
    return parseDDMMYYYY(period.end) < startOfDay(now);
};

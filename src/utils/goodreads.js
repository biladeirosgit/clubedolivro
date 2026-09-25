// Livros que os membros avaliaram no Goodreads fora do clube
// (cdl/goodreadsShelves.json, gerado pelo pipeline). So a pagina de perfil os
// usa, e so com o toggle ligado: nao entram no catalogo, nas estatisticas do
// clube nem no jogo.

const norm = (text) => (text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// Livros de fora do clube que um membro tem nas estantes (0 sem Goodreads).
export const shelfCount = (shelves, name) => (Array.isArray(shelves[name]) ? shelves[name].length : 0);

// Junta ao bookData os livros das estantes de todos os membros, no mesmo
// formato, para as funcoes de stats.js funcionarem sem mudar nada. Um livro que
// dois membros leram em edicoes diferentes junta-se pelo titulo + autor, e fica
// com as notas dos dois (e o que alimenta os "gostos mais parecidos").
// Os livros de fora ficam marcados com `external: true` e trazem `cover` (URL
// do Goodreads) em vez de capa local.
export const mergeShelves = (bookData, shelves) => {
    const merged = { ...bookData };
    const idByKey = {};
    Object.entries(shelves).forEach(([member, books]) => {
        if (member.startsWith('_') || !Array.isArray(books)) return;
        books.forEach((b) => {
            const key = `${norm(b.title)}|${norm(b.author)}`;
            if (!idByKey[key]) {
                idByKey[key] = `gr-${b.bookId}`;
                merged[idByKey[key]] = {
                    title: b.title,
                    year: b.year,
                    pages: b.pages,
                    authors: b.author ? [b.author] : [],
                    genres: [],
                    chosenBy: [],
                    reviews: {},
                    comments: {},
                    date: b.readAt,
                    link: `https://www.goodreads.com/book/show/${b.bookId}`,
                    cover: b.cover,
                    external: true,
                };
            }
            const book = merged[idByKey[key]];
            if (book.reviews[member] == null) book.reviews[member] = b.rating;
        });
    });
    return merged;
};

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { DEFAULT_FILTERS, filterProfileList, effectiveYearRange, yearBounds } from './utils/profileList';
import UserStats from './cdl/UserStats';
import { bookData } from './cdl/books';

const item = (title, extra = {}, rating = 3, date = null) => ({
    slug: title,
    rating,
    date,
    book: { title, authors: ['Alguem'], genres: [], chosenBy: [], reviews: { Eu: rating }, ...extra },
});

const lista = [
    item('Duna', { year: 1965, pages: 600, genres: ['Sci-Fi'], authors: ['Frank Herbert'], chosenBy: ['Tu'] }, 5, '01/03/2024'),
    item('Hobbit', { year: 1937, pages: 300, genres: ['Fantasy'] }, 4, '01/01/2025'),
    item('Sem Nada', {}, 2),
];
const titulos = (items) => items.map((i) => i.book.title);
const com = (patch) => ({ ...DEFAULT_FILTERS, ...patch });

describe('filterProfileList', () => {
    test('por defeito ordena pela nota do dono do perfil', () => {
        expect(titulos(filterProfileList(lista, DEFAULT_FILTERS))).toEqual(['Duna', 'Hobbit', 'Sem Nada']);
    });

    test('o que nao tem valor vai sempre para o fim', () => {
        expect(titulos(filterProfileList(lista, com({ sort: 'date' })))).toEqual(['Hobbit', 'Duna', 'Sem Nada']);
        expect(titulos(filterProfileList(lista, com({ sort: 'pages' })))).toEqual(['Duna', 'Hobbit', 'Sem Nada']);
    });

    test('titulo por ordem alfabetica', () => {
        expect(titulos(filterProfileList(lista, com({ sort: 'title' })))).toEqual(['Duna', 'Hobbit', 'Sem Nada']);
    });

    test('procura no titulo e no autor', () => {
        expect(titulos(filterProfileList(lista, com({ search: 'herbert' })))).toEqual(['Duna']);
    });

    test('filtra por genero e por quem escolheu', () => {
        expect(titulos(filterProfileList(lista, com({ genre: 'Fantasy' })))).toEqual(['Hobbit']);
        expect(titulos(filterProfileList(lista, com({ chosenBy: 'Tu' })))).toEqual(['Duna']);
    });

    test('o intervalo de anos deixa passar os livros sem ano', () => {
        expect(titulos(filterProfileList(lista, com({ yearRange: [1950, 2000] })))).toEqual(['Duna', 'Sem Nada']);
    });
});

describe('effectiveYearRange', () => {
    test('sem escolha e a lista toda, e encaixa o escolhido nos limites', () => {
        expect(yearBounds(lista)).toEqual([1937, 1965]);
        expect(effectiveYearRange(null, [1937, 1965])).toEqual([1937, 1965]);
        expect(effectiveYearRange([1900, 2100], [1937, 1965])).toEqual([1937, 1965]);
        expect(effectiveYearRange([1950, 1940], [1937, 1965])).toEqual([1950, 1950]);
        expect(effectiveYearRange([1950, 1960], null)).toBeNull();
    });
});

describe('filtros no perfil', () => {
    const leitor = Object.keys(
        Object.values(bookData).reduce((acc, b) => Object.assign(acc, b.reviews), {})
    ).sort((a, b) => Object.values(bookData).filter((x) => b in x.reviews).length
        - Object.values(bookData).filter((x) => a in x.reviews).length)[0];

    test('procurar encolhe a lista de lidos', () => {
        render(
            <MemoryRouter initialEntries={[`/users/${leitor}`]}>
                <Routes>
                    <Route path="/users/:username" element={<UserStats />} />
                </Routes>
            </MemoryRouter>
        );
        const titulo = screen.getByText(/^Livros lidos \(/);
        const total = Number(titulo.textContent.match(/\((\d+)\)/)[1]);
        expect(total).toBeGreaterThan(1);

        const alvo = Object.values(bookData).find((b) => leitor in b.reviews).title;
        fireEvent.change(screen.getByLabelText('Procurar livro ou autor'), { target: { value: alvo } });
        expect(screen.getByText(/^Livros lidos \(/).textContent).toMatch(new RegExp(`de ${total}\\)`));

        fireEvent.change(screen.getByLabelText('Procurar livro ou autor'), { target: { value: 'zzz nada disto' } });
        expect(screen.getByText('Nenhum livro com estes filtros.')).toBeInTheDocument();
        expect(within(screen.getByLabelText('Ordenar')).getByText(`Nota de ${leitor}`)).toBeInTheDocument();
    });
});

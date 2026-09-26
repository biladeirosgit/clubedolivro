import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { mergeShelves, shelfCount } from './utils/goodreads';
import { mostSimilarTo } from './utils/stats';
import UserStats from './cdl/UserStats';
import BookRow from './components/BookRow';
import shelves from './cdl/goodreadsShelves.json';

const clube = {
    '1': { title: 'Do Clube', authors: ['A'], genres: ['Drama'], chosenBy: ['Eu'], reviews: { Eu: 4 }, comments: {}, date: '01/01/2024', pages: 100 },
};
const estantes = {
    _comment: 'ignorado',
    Eu: [
        { bookId: '10', title: 'Duna', author: 'Frank Herbert', year: 1965, pages: 600, rating: 5, readAt: null, cover: null },
    ],
    Tu: [
        // Outra edicao do mesmo livro: junta-se pelo titulo + autor.
        { bookId: '11', title: 'Duna', author: 'Frank Herbert', year: 1965, pages: 700, rating: 3, readAt: null, cover: null },
    ],
};

describe('mergeShelves', () => {
    const merged = mergeShelves(clube, estantes);

    test('junta os livros de fora ao clube, marcados como externos', () => {
        expect(Object.keys(merged).sort()).toEqual(['1', 'gr-10']);
        expect(merged['gr-10']).toMatchObject({ title: 'Duna', authors: ['Frank Herbert'], external: true, chosenBy: [] });
        expect(merged['1'].external).toBeUndefined();
    });

    test('o mesmo livro em edicoes diferentes fica um so, com as notas dos dois', () => {
        expect(merged['gr-10'].reviews).toEqual({ Eu: 5, Tu: 3 });
    });

    test('cada membro fica com o seu dia de leitura', () => {
        const lidos = { Eu: [{ ...estantes.Eu[0], readAt: '02/03/2024' }], Tu: estantes.Tu };
        expect(mergeShelves(clube, lidos)['gr-10'].readAt).toEqual({ Eu: '02/03/2024', Tu: null });
    });

    test('nao mexe no bookData original', () => {
        expect(Object.keys(clube)).toEqual(['1']);
    });

    test('abrir um livro de fora mostra o card com as notas de todos os membros', () => {
        render(
            <MemoryRouter>
                <BookRow slug="gr-10" book={merged['gr-10']} userRating={5} userLabel="Eu" />
            </MemoryRouter>
        );
        expect(screen.queryByText(/club avg|Goodreads/)).toBeNull(); // antes de abrir, so a nota dele
        fireEvent.click(screen.getByRole('button'));
        expect(screen.getByText('Fora do clube · Goodreads')).toBeInTheDocument();
        expect(screen.getByText('Ratings dos membros no Goodreads')).toBeInTheDocument();
        expect(screen.getByText('Tu')).toBeInTheDocument();
        expect(screen.queryByText('Escolhido por')).toBeNull();
    });

    test('shelfCount ignora quem nao tem Goodreads e a chave de comentario', () => {
        expect(shelfCount(estantes, 'Eu')).toBe(1);
        expect(shelfCount(estantes, 'Ninguem')).toBe(0);
        expect(shelfCount(estantes, '_comment')).toBe(0);
    });

    test('os livros de fora contam para os gostos parecidos', () => {
        const muitos = { ...estantes, Eu: [], Tu: [] };
        ['a', 'b', 'c', 'd', 'e'].forEach((t, i) => {
            muitos.Eu.push({ bookId: `e${i}`, title: t, author: 'X', rating: i + 1 });
            muitos.Tu.push({ bookId: `t${i}`, title: t, author: 'X', rating: i + 1 });
        });
        expect(mostSimilarTo(clube, 'Eu')).toEqual([]);
        expect(mostSimilarTo(mergeShelves(clube, muitos), 'Eu')[0]).toMatchObject({ name: 'Tu', shared: 5 });
    });
});

// Os livros do Goodreads so podem aparecer no perfil: nem catalogo, nem
// estatisticas do clube, nem jogo. Garante-se pelo import.
describe('estantes do Goodreads so no perfil', () => {
    const SRC = __dirname;
    const ficheiros = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return ficheiros(p);
        return /\.js$/.test(e.name) && !/\.test\.js$/.test(e.name) ? [p] : [];
    });

    test('so o UserStats.js importa as estantes ou o mergeShelves', () => {
        const quem = ficheiros(SRC)
            .map((f) => path.relative(SRC, f).replace(/\\/g, '/'))
            .filter((f) => f !== 'utils/goodreads.js') // o proprio helper
            .filter((f) => /import[^;]*(goodreadsShelves|utils\/goodreads)/.test(fs.readFileSync(path.join(SRC, f), 'utf8')));
        expect(quem).toEqual(['cdl/UserStats.js']);
    });
});

describe('toggle no perfil', () => {
    const membro = Object.keys(shelves).find((k) => !k.startsWith('_') && shelves[k].length > 0);

    const perfil = (name) => render(
        <MemoryRouter initialEntries={[`/users/${name}`]}>
            <Routes>
                <Route path="/users/:username" element={<UserStats />} />
            </Routes>
        </MemoryRouter>
    );

    beforeEach(() => localStorage.clear());

    (membro ? test : test.skip)('ligar mostra a lista de fora do clube', () => {
        perfil(membro);
        expect(screen.queryByText(/Fora do clube · Goodreads/)).toBeNull();
        fireEvent.click(screen.getByRole('checkbox'));
        expect(screen.getByText(/Fora do clube · Goodreads/)).toBeInTheDocument();
        expect(localStorage.getItem('cdl-profile-goodreads')).toBe('1');
    });

    test('sem Goodreads nao ha toggle', () => {
        perfil('Joana');
        expect(screen.queryByRole('checkbox')).toBeNull();
    });
});

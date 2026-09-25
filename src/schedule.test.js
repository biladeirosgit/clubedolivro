import React from 'react';
import { render } from '@testing-library/react';
import { hasArrived, readingPeriods, hasReadingEnded } from './utils/dates';
import { splitBySchedule } from './cdl/books';
import UpcomingBooks from './cdl/UpcomingBooks';

// Os livros sao sorteados com antecedencia, portanto o bookData pode ter livros
// com data no futuro. Esses nao podem aparecer no catalogo nem contar para
// estatistica nenhuma — so na faixa "On the way".

const book = (date, extra = {}) => ({
    title: 'Livro',
    year: 2000,
    link: 'https://www.goodreads.com/book/show/1',
    date,
    chosenBy: ['Geremias'],
    authors: ['Autor'],
    genres: ['Fiction'],
    pages: 300,
    reviews: {},
    comments: {},
    ...extra,
});

const HOJE = new Date(2026, 7, 2); // 02/08/2026

describe('hasArrived', () => {
    test('o livro que comeca hoje ja chegou', () => {
        expect(hasArrived('02/08/2026', HOJE)).toBe(true);
    });

    test('livros passados chegaram', () => {
        expect(hasArrived('01/07/2026', HOJE)).toBe(true);
    });

    test('livros com data futura ainda nao', () => {
        expect(hasArrived('03/08/2026', HOJE)).toBe(false);
    });

    // A comparacao e por dia, nao por instante: as horas do `new Date()` nao
    // podem fazer o livro de hoje contar so a partir da meia-noite seguinte.
    test('a hora do dia nao conta', () => {
        expect(hasArrived('02/08/2026', new Date(2026, 7, 2, 23, 59))).toBe(true);
        expect(hasArrived('02/08/2026', new Date(2026, 7, 2, 0, 0))).toBe(true);
    });

    // Defensivo: um livro sem data valida continua a contar. Nunca desaparece
    // do site por causa deste filtro.
    test('sem data valida, conta', () => {
        expect(hasArrived(undefined, HOJE)).toBe(true);
        expect(hasArrived('', HOJE)).toBe(true);
    });
});

describe('readingPeriods', () => {
    const data = {
        julho: book('01/07/2026'),
        agosto: book('28/07/2026'),
        setembro: book('03/09/2026'),
    };

    // Nao ha duracao fixa: quando um livro acaba comeca o outro no dia a seguir.
    test('cada livro acaba na vespera do seguinte', () => {
        const periods = readingPeriods(data);
        expect(periods.julho).toEqual({ start: '01/07/2026', end: '27/07/2026' });
        expect(periods.agosto).toEqual({ start: '28/07/2026', end: '02/09/2026' });
    });

    test('o ultimo livro nao tem fim', () => {
        expect(readingPeriods(data).setembro).toEqual({ start: '03/09/2026', end: null });
    });

    test('a ordem das chaves no JSON nao importa', () => {
        const baralhado = { setembro: data.setembro, julho: data.julho, agosto: data.agosto };
        expect(readingPeriods(baralhado)).toEqual(readingPeriods(data));
    });

    test('livro sem data fica de fora', () => {
        expect(readingPeriods({ semData: book('') })).toEqual({});
    });
});

describe('hasReadingEnded', () => {
    test('fechado so depois do ultimo dia', () => {
        const period = { start: '01/07/2026', end: '01/08/2026' };
        expect(hasReadingEnded(period, new Date(2026, 7, 1))).toBe(false);
        expect(hasReadingEnded(period, HOJE)).toBe(true);
    });

    // O livro atual (sem seguinte) esta sempre a ser lido: nao pode penalizar
    // o streak de quem ainda nao o acabou.
    test('sem fim, nunca fechou', () => {
        expect(hasReadingEnded({ start: '01/07/2026', end: null }, HOJE)).toBe(false);
    });
});

describe('splitBySchedule', () => {
    const data = {
        'ja-lido': book('01/07/2026', { reviews: { Geremias: 5 } }),
        'a-ler': book('02/08/2026'),
        'daqui-a-dois': book('01/10/2026'),
        'o-proximo': book('01/09/2026'),
    };

    test('so os livros que ja chegaram ficam no bookData', () => {
        const { arrived } = splitBySchedule(data, HOJE);
        expect(Object.keys(arrived).sort()).toEqual(['a-ler', 'ja-lido']);
    });

    test('os que faltam saem por ordem cronologica', () => {
        const { upcoming } = splitBySchedule(data, HOJE);
        expect(upcoming.map((u) => u.slug)).toEqual(['o-proximo', 'daqui-a-dois']);
    });

    // Se um livro por chegar entrasse no bookData, entrava com 0 reviews e
    // puxava para baixo medias e contagens de "livros lidos".
    test('nenhum livro por chegar escapa para as estatisticas', () => {
        const { arrived } = splitBySchedule(data, HOJE);
        Object.values(arrived).forEach((m) => {
            expect(hasArrived(m.date, HOJE)).toBe(true);
        });
    });
});

describe('faixa "On the way"', () => {
    test('mostra os livros por chegar com o titulo', () => {
        const { container } = render(
            <UpcomingBooks books={[{ slug: 'o-proximo', book: book('01/09/2026', { title: 'Duna' }) }]} />
        );
        expect(container.querySelector('.upcoming-name').textContent).toBe('Duna');
        expect(container.querySelector('.upcoming-week')).not.toBeNull();
    });

    // Sem nada sorteado nao pode ficar uma seccao vazia com um titulo pendurado.
    test('desaparece quando nao ha nada por chegar', () => {
        const { container } = render(<UpcomingBooks books={[]} />);
        expect(container.querySelector('.upcoming')).toBeNull();
    });
});

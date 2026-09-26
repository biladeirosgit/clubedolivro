import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import RankedBars from './components/RankedBars';

// 12 linhas ja pela ordem da media (como vem do creditRanking): a primeira
// tem a melhor media e a ultima e a que tem mais livros.
const linhas = Array.from({ length: 12 }, (_, i) => ({
    key: `g${i}`,
    label: `Genero ${i}`,
    count: i + 1,
    average: 5 - i * 0.1,
}));
const mostradas = () => screen.getAllByText(/^Genero \d+$/).map((el) => el.textContent);

describe('RankedBars', () => {
    test('mostra os 10 primeiros pela media', () => {
        render(<RankedBars rows={linhas} />);
        expect(mostradas()).toHaveLength(10);
        expect(mostradas()[0]).toBe('Genero 0');
        expect(screen.getByRole('button', { name: 'Média' })).toHaveAttribute('aria-pressed', 'true');
    });

    test('ordena por quantos livros', () => {
        render(<RankedBars rows={linhas} />);
        fireEvent.click(screen.getByRole('button', { name: 'Mais lidos' }));
        expect(mostradas()[0]).toBe('Genero 11');
        expect(screen.getByRole('button', { name: 'Mais lidos' })).toHaveAttribute('aria-pressed', 'true');
    });

    test('Ver todos abre a lista inteira e Ver menos volta aos 10', () => {
        render(<RankedBars rows={linhas} />);
        fireEvent.click(screen.getByRole('button', { name: 'Ver todos (12)' }));
        expect(mostradas()).toHaveLength(12);
        fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }));
        expect(mostradas()).toHaveLength(10);
    });

    test('sem mais de 10 nao ha Ver todos', () => {
        render(<RankedBars rows={linhas.slice(0, 10)} />);
        expect(screen.queryByRole('button', { name: /Ver todos/ })).toBeNull();
    });
});

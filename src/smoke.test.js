import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BookClubPage from './cdl/BookClubPage';
import BookClubStats from './cdl/BookClubStats';
import UserStats from './cdl/UserStats';
import GuessGame from './cdl/GuessGame';
import BookCard from './cdl/BookCard';
import { bookData } from './cdl/books';

// Renderiza cada pagina com o bookData.json verdadeiro. Livros sem generos, sem
// ano ou sem notas (o que acontece quando o Goodreads corta pedidos a meio)
// nao podem rebentar nenhuma pagina.

const at = (path, element, pattern = path) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path={pattern} element={element} />
            </Routes>
        </MemoryRouter>
    );

describe('paginas renderizam com os dados reais', () => {
    test('catalogo', () => {
        at('/', <BookClubPage />);
        expect(screen.getByPlaceholderText('Procurar livro ou autor…')).toBeInTheDocument();
    });

    test('stats', () => {
        at('/stats', <BookClubStats />);
        expect(screen.getByText('Estatísticas do Clube')).toBeInTheDocument();
    });

    test('perfil de um membro', () => {
        at('/users/Geremias', <UserStats />, '/users/:username');
        expect(screen.getByText('Perfil de Geremias')).toBeInTheDocument();
    });

    test('perfil de quem ainda nao avaliou nada', () => {
        at('/users/Joana', <UserStats />, '/users/:username');
        expect(screen.getByText('Perfil de Joana')).toBeInTheDocument();
    });

    test('guess', () => {
        at('/guess', <GuessGame />);
        expect(screen.getByText('Adivinha o livro do dia')).toBeInTheDocument();
    });

    test('card de cada livro', () => {
        Object.keys(bookData).forEach((id) => {
            const { unmount } = at('/', <BookCard slug={id} />);
            expect(screen.getByText('Ver no Goodreads ↗')).toBeInTheDocument();
            unmount();
        });
    });
});

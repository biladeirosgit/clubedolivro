import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavBar from './components/NavBar';

const renderNav = () => render(<MemoryRouter><NavBar /></MemoryRouter>);

describe('navbar', () => {
    describe('voltar ao hub', () => {
        test('aponta para o hub dos Biladeiros', () => {
            const { container } = renderNav();
            expect(container.querySelector('.hub-link')).toHaveAttribute(
                'href',
                'https://biladeirosgit.github.io/'
            );
        });

        // O hub e OUTRO site: um <Link> do router tentaria navegar dentro desta
        // app e nunca la chegava.
        test('e um <a> normal, nao um Link do router', () => {
            const { container } = renderNav();
            const a = container.querySelector('.hub-link');
            expect(a.tagName).toBe('A');
            expect(a.getAttribute('href')).toMatch(/^https:\/\//);
        });

        // Abaixo de 640px o .hub-link-text e escondido por CSS. Sem o
        // aria-label, o link ficaria com nome acessivel vazio -- a img e alt="".
        test('tem nome acessivel que sobrevive ao mobile', () => {
            const { container } = renderNav();
            const a = container.querySelector('.hub-link');
            expect(a.getAttribute('aria-label')).toBeTruthy();
            expect(a.querySelector('img').getAttribute('alt')).toBe('');
        });
    });

    test('as tabs estao em ingles', () => {
        const { container } = renderNav();
        const tabs = [...container.querySelectorAll('.navbar-link')].map((n) => n.textContent);
        expect(tabs).toEqual(['Catalog', 'Stats', 'Guess']);
    });

    test('a marca fica: Bilalivro e um nome proprio', () => {
        const { container } = renderNav();
        expect(container.querySelector('.navbar-brand').textContent).toBe('Bilalivro');
    });
});

// O utilizador queixou-se de a barra ficar estranha em ecras pequenos: os
// links nao cabiam ao lado da marca. Passou a burger + drawer, como nas
// olimpiadas.
describe('burger em ecras pequenos', () => {
    test('existe e comeca fechado', () => {
        const { container } = renderNav();
        const b = container.querySelector('.navbar-burger');
        expect(b).toBeInTheDocument();
        expect(b).toHaveAttribute('aria-expanded', 'false');
        expect(container.querySelector('.navbar-links')).not.toHaveClass('is-open');
    });

    test('abre e fecha ao clicar', () => {
        const { container } = renderNav();
        const b = container.querySelector('.navbar-burger');
        fireEvent.click(b);
        expect(b).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelector('.navbar-links')).toHaveClass('is-open');
        fireEvent.click(b);
        expect(b).toHaveAttribute('aria-expanded', 'false');
    });

    test('fecha com Escape', () => {
        const { container } = renderNav();
        fireEvent.click(container.querySelector('.navbar-burger'));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(container.querySelector('.navbar-burger')).toHaveAttribute('aria-expanded', 'false');
    });

    test('fecha ao clicar fora', () => {
        const { container } = renderNav();
        fireEvent.click(container.querySelector('.navbar-burger'));
        fireEvent.mouseDown(document.body);
        expect(container.querySelector('.navbar-burger')).toHaveAttribute('aria-expanded', 'false');
    });
});

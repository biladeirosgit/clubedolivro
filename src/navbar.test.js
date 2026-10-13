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

// Chegar ao perfil de um membro obrigava a encontrar o nome numa tabela ou
// num card. A navbar passou a ter a lista de membros.
describe('menu de membros', () => {
    const MEMBERS = ['Atlas', 'Mestre Gui', 'mWXYZ'];
    const renderAt = (path) =>
        render(
            <MemoryRouter initialEntries={[path]}>
                <NavBar members={MEMBERS} />
            </MemoryRouter>
        );

    test('sem membros nao aparece', () => {
        const { container } = renderNav();
        expect(container.querySelector('.navbar-members-toggle')).toBeNull();
    });

    test('abre com um link por membro, pela ordem dada', () => {
        const { container } = renderAt('/');
        const toggle = container.querySelector('.navbar-members-toggle');
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(container.querySelector('.navbar-members-panel')).toHaveClass('is-open');
        const links = [...container.querySelectorAll('.navbar-member')];
        expect(links.map((a) => a.textContent)).toEqual(MEMBERS);
        expect(links[1].getAttribute('href')).toBe('/users/Mestre Gui');
    });

    // O pathname chega codificado ("Mestre%20Gui"): sem o decode o membro com
    // espaco no nome nunca ficava marcado.
    test('num perfil, marca o membro e o botao', () => {
        const { container } = renderAt('/users/Mestre%20Gui');
        expect(container.querySelector('.navbar-members-toggle')).toHaveClass('active');
        const current = container.querySelector('.navbar-member[aria-current="page"]');
        expect(current.textContent).toBe('Mestre Gui');
    });

    test('fora de um perfil nada fica marcado', () => {
        const { container } = renderAt('/stats');
        expect(container.querySelector('.navbar-members-toggle')).not.toHaveClass('active');
        expect(container.querySelector('.navbar-member[aria-current]')).toBeNull();
    });

    test('fecha com Escape', () => {
        const { container } = renderAt('/');
        fireEvent.click(container.querySelector('.navbar-members-toggle'));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(container.querySelector('.navbar-members-panel')).not.toHaveClass('is-open');
    });
});

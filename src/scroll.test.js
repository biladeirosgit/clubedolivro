import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';

// Cada pagina nova abre no topo, venha o link de onde vier.
test('mudar de pagina volta ao topo', () => {
    const scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { getByText } = render(
        <MemoryRouter initialEntries={['/stats']}>
            <ScrollToTop />
            <Routes>
                <Route path="/stats" element={<Link to="/users/Atlas">Atlas</Link>} />
                <Route path="/users/:username" element={<p>perfil</p>} />
            </Routes>
        </MemoryRouter>
    );
    scrollTo.mockClear();
    fireEvent.click(getByText('Atlas'));
    expect(getByText('perfil')).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    scrollTo.mockRestore();
});

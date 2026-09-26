import React from 'react';
import { PROFILE_SORTS, effectiveYearRange } from '../utils/profileList';
import '../cdl/BookClubPage.css'; // os estilos .filters sao os do catalogo

const unique = (values) => Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
// A Iliada e de -750 no Goodreads.
const yearLabel = (year) => (year < 0 ? `${-year} a.C.` : year);

// Barra de filtros das listas de livros lidos do perfil. So mostra o que a
// lista tem: sem generos nao ha select de generos, e o de escolhas so aparece
// com livros do clube.
const ProfileListFilters = ({ items, bounds, filters, onChange, username }) => {
    const genres = unique(items.flatMap((item) => item.book.genres || []));
    const choosers = unique(items.flatMap((item) => item.book.chosenBy || []));
    const years = effectiveYearRange(filters.yearRange, bounds);
    const set = (patch) => onChange({ ...filters, ...patch });

    return (
        <div className="filters">
            <input
                type="text"
                className="filter-search"
                placeholder="Procurar livro ou autor…"
                aria-label="Procurar livro ou autor"
                value={filters.search}
                onChange={(e) => set({ search: e.target.value })}
            />
            {genres.length > 0 && (
                <select aria-label="Género" value={filters.genre} onChange={(e) => set({ genre: e.target.value })}>
                    <option value="">Todos os géneros</option>
                    {genres.map((genre) => (
                        <option key={genre} value={genre}>{genre}</option>
                    ))}
                </select>
            )}
            {choosers.length > 0 && (
                <select aria-label="Escolhido por" value={filters.chosenBy} onChange={(e) => set({ chosenBy: e.target.value })}>
                    <option value="">Todas as escolhas</option>
                    {choosers.map((person) => (
                        <option key={person} value={person}>{person}</option>
                    ))}
                </select>
            )}
            <select aria-label="Ordenar" value={filters.sort} onChange={(e) => set({ sort: e.target.value })}>
                {PROFILE_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.value === 'rating' ? `Nota de ${username}` : s.label}</option>
                ))}
            </select>
            {years && bounds[0] < bounds[1] && (
                <div className="filter-year">
                    <span className="filter-year-label">Ano {yearLabel(years[0])}–{yearLabel(years[1])}</span>
                    <div className="filter-year-sliders">
                        <input
                            type="range"
                            aria-label="Ano mínimo"
                            min={bounds[0]}
                            max={bounds[1]}
                            value={years[0]}
                            onChange={(e) => set({ yearRange: [Math.min(Number(e.target.value), years[1]), years[1]] })}
                        />
                        <input
                            type="range"
                            aria-label="Ano máximo"
                            min={bounds[0]}
                            max={bounds[1]}
                            value={years[1]}
                            onChange={(e) => set({ yearRange: [years[0], Math.max(Number(e.target.value), years[0])] })}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileListFilters;

import React, { useState } from 'react';
import './RankedBars.css';

// Quantas linhas um ranking mostra antes do "Ver todos".
const TOP = 10;

// Barras das distribuicoes: a barra e quantos livros, a direita vai
// `livros · media`. `rows` e [{ key, label, count, average }], e `label` pode
// ser texto ou uma ancora (ex: um HoverAnchor com os livros do autor). `max` e
// a contagem que enche a barra toda; por defeito, a maior das linhas.
export const CountAverageBars = ({ rows, max = Math.max(1, ...rows.map((r) => r.count)) }) => (
    <div className="rating-bars">
        {rows.map((r) => (
            <div className="rating-bar-row" key={r.key}>
                <span className="rating-bar-label">{r.label}</span>
                <div className="rating-bar-track">
                    <div className="rating-bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
                </div>
                <span className="rating-bar-count">{r.count} · {r.average != null ? r.average.toFixed(2) : '-'}</span>
            </div>
        ))}
    </div>
);

// Um ranking (generos, autores, ...) em barras. Mostra os primeiros TOP, deixa
// trocar a ordem entre a media e o numero de livros, e abrir a lista toda.
// `rows` chega ordenada pela media, que e a ordem do creditRanking.
const RankedBars = ({ rows }) => {
    const [byCount, setByCount] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const sorted = byCount ? [...rows].sort((a, b) => b.count - a.count || b.average - a.average) : rows;
    // A escala e a da lista toda, para as barras nao mudarem de tamanho ao abrir.
    const max = Math.max(1, ...rows.map((r) => r.count));

    return (
        <>
            <div className="bars-sort" role="group" aria-label="Ordem do ranking">
                <button type="button" aria-pressed={!byCount} onClick={() => setByCount(false)}>Média</button>
                <button type="button" aria-pressed={byCount} onClick={() => setByCount(true)}>Mais lidos</button>
            </div>
            <CountAverageBars rows={expanded ? sorted : sorted.slice(0, TOP)} max={max} />
            {rows.length > TOP && (
                <button type="button" className="bars-more" onClick={() => setExpanded(!expanded)}>
                    {expanded ? 'Ver menos' : `Ver todos (${rows.length})`}
                </button>
            )}
        </>
    );
};

export default RankedBars;

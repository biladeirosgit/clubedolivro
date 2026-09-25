import React from 'react';
import './HoverBubble.css';
import './InfoTip.css';

// Bolha de ajuda para metricas que precisam de explicacao mas nao a querem
// sempre a ocupar o card. Abre no hover e tambem no foco, para quem navega por
// teclado -- em toque, o foco do <button> chega para a abrir.
// `placement` combina 'below' (ancora colada ao topo, como os cabecalhos da
// tabela) e 'right' (ancora perto da margem direita da pagina): sem eles a
// bolha sai do ecra e o overflow-x do body corta-a.
const InfoTip = ({ label = 'Como e calculado', placement = 'above', children }) => {
    const sides = placement.split('-');
    const classes = ['hover-bubble']
        .concat(sides.includes('below') ? ['hover-bubble--below'] : [])
        .concat(sides.includes('right') ? ['hover-bubble--right'] : [])
        .join(' ');

    return (
        <span className="info-tip hover-anchor">
            <button type="button" className="info-tip-mark" aria-label={label}>i</button>
            <span className={classes} role="tooltip">{children}</span>
        </span>
    );
};

export default InfoTip;

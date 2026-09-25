import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { pfpSrc } from '../utils/images';

const SIZES = { sm: 32, md: 50, lg: 64 };

// Sem public/pfp/<nome>.png mostra um circulo com a inicial, para um membro
// novo nao aparecer com uma imagem partida ate alguem lhe por a foto.
const Avatar = ({ name, size = 'md', linkToUser = true, className = '' }) => {
    const [broken, setBroken] = useState(false);
    const px = SIZES[size] || size;
    const img = broken ? (
        <span
            role="img"
            aria-label={name}
            className={`avatar avatar--fallback ${className}`}
            style={{
                width: px,
                height: px,
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--color-accent)',
                color: 'var(--color-on-accent)',
                fontWeight: 700,
                fontSize: Math.round(px * 0.45),
                flexShrink: 0,
            }}
        >
            {name.charAt(0).toUpperCase()}
        </span>
    ) : (
        <img
            src={pfpSrc(name)}
            alt={name}
            className={`avatar ${className}`}
            style={{ width: px, height: px, borderRadius: '50%' }}
            onError={() => setBroken(true)}
        />
    );
    return linkToUser ? <Link to={`/users/${name}`}>{img}</Link> : img;
};

export default Avatar;

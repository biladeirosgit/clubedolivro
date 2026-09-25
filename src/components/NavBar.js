import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { hubIconSrc } from '../utils/images';
import './NavBar.css';

const HUB_URL = 'https://biladeirosgit.github.io/';

const LINKS = [
    { to: '/', label: 'Catalog' },
    { to: '/stats', label: 'Stats' },
    { to: '/guess', label: 'Guess' },
];

const NavBar = () => {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const navRef = useRef(null);

    // Fechar ao navegar: sem isto o menu fica aberto por cima da pagina nova.
    useEffect(() => setOpen(false), [location.pathname]);

    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && setOpen(false);
        const onClick = (e) => {
            if (navRef.current && !navRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onClick);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onClick);
        };
    }, []);

    return (
        <nav className="navbar" ref={navRef}>
            <div className="navbar-left">
                {/* O hub e outro site: <a href> normal, nao um <Link> do router.
                    O aria-label nao e decorativo -- em mobile o texto e
                    escondido e sem ele o link ficava sem nome acessivel. */}
                <a className="hub-link" href={HUB_URL} aria-label="Biladeiros — voltar ao hub">
                    <img src={hubIconSrc()} alt="" />
                    <span className="hub-link-text">Biladeiros</span>
                </a>
                <span className="navbar-sep" aria-hidden="true" />
                <Link to="/" className="navbar-brand">Bila<span className="brand-accent">livros</span></Link>
            </div>

            <button
                className="navbar-burger"
                aria-label="Menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
            >
                <span />
                <span />
                <span />
            </button>

            <div className={`navbar-links${open ? ' is-open' : ''}`}>
                {LINKS.map((link) => (
                    <Link
                        key={link.to}
                        to={link.to}
                        className={`navbar-link${location.pathname === link.to ? ' active' : ''}`}
                    >
                        {link.label}
                    </Link>
                ))}
            </div>
        </nav>
    );
};

export default NavBar;

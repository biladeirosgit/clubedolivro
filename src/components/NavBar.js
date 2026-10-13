import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { hubIconSrc } from '../utils/images';
import Avatar from './Avatar';
import './NavBar.css';

const HUB_URL = 'https://biladeirosgit.github.io/';

const LINKS = [
    { to: '/', label: 'Catalog' },
    { to: '/stats', label: 'Stats' },
    { to: '/guess', label: 'Guess' },
];

// Nome do perfil aberto, ou null fora de /users/:nome. O pathname vem
// codificado ("Mestre%20Gui"), dai o decode.
const currentMember = (pathname) => {
    const match = pathname.match(/^\/users\/([^/]+)/);
    if (!match) return null;
    try { return decodeURIComponent(match[1]); } catch { return match[1]; }
};

// `members`: nomes dos perfis, ja pela ordem a mostrar. Sem eles o menu de
// membros nao aparece.
const NavBar = ({ members = [] }) => {
    const location = useLocation();
    const [open, setOpen] = useState(false);
    const [membersOpen, setMembersOpen] = useState(false);
    const navRef = useRef(null);
    const active = currentMember(location.pathname);

    // Fechar ao navegar: sem isto o menu fica aberto por cima da pagina nova.
    useEffect(() => {
        setOpen(false);
        setMembersOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const close = () => {
            setOpen(false);
            setMembersOpen(false);
        };
        const onKey = (e) => e.key === 'Escape' && close();
        const onClick = (e) => {
            if (navRef.current && !navRef.current.contains(e.target)) close();
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
                <Link to="/" className="navbar-brand">Bila<span className="brand-accent">livro</span></Link>
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

                {/* Atalho para o perfil de cada membro. Antes so se la chegava
                    a partir de um nome numa tabela ou num card. */}
                {members.length > 0 && (
                    <div className="navbar-members">
                        <button
                            type="button"
                            className={`navbar-link navbar-members-toggle${active ? ' active' : ''}`}
                            aria-expanded={membersOpen}
                            aria-controls="navbar-members-panel"
                            onClick={() => setMembersOpen((o) => !o)}
                        >
                            Members
                            <span className="navbar-caret" aria-hidden="true" />
                        </button>
                        <ul
                            id="navbar-members-panel"
                            className={`navbar-members-panel${membersOpen ? ' is-open' : ''}`}
                        >
                            {members.map((name) => (
                                <li key={name}>
                                    <Link
                                        to={`/users/${name}`}
                                        className="navbar-member"
                                        aria-current={name === active ? 'page' : undefined}
                                    >
                                        <Avatar name={name} size={26} linkToUser={false} />
                                        <span className="navbar-member-name">{name}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </nav>
    );
};

export default NavBar;

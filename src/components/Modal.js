import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

// Renderiza o overlay no body (via portal), fora da grelha do catalogo, para
// escapar a qualquer stacking context dos cartoes e ficar sempre por cima.
//
// Atencao: num portal os eventos sobem pela arvore de componentes do React, nao
// pela do DOM. Sem o stopPropagation abaixo, um clique dentro do modal chegava
// ao onClick do elemento que o abriu (ex: o poster em Book.js, que e o pai
// deste Modal no JSX) e fechava-o outra vez — era o que impedia os botoes de
// prequela/sequela de funcionar.
const Modal = ({ onClose, children }) => {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return createPortal(
        <div
            className="modal"
            onClick={(e) => {
                e.stopPropagation();
                if (e.target.classList.contains('modal')) onClose();
            }}
        >
            <div className="modal-content">
                {children}
            </div>
        </div>,
        document.body
    );
};

export default Modal;

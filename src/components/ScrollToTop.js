import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// O router nao mexe no scroll: quem clicava num nome no fundo das estatisticas
// abria o perfil a meio. Cada pagina nova abre no topo. So o caminho conta, para
// um ?filtro ou um #ancora na mesma pagina nao a fazerem saltar.
const ScrollToTop = () => {
    const { pathname } = useLocation();
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);
    return null;
};

export default ScrollToTop;

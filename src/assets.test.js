import fs from 'fs';
import path from 'path';
import bookData from './cdl/bookData.json';

// As capas sao descarregadas pelo pipeline para public/covers/<id>.jpg. Se o
// download falhar, o erro e silencioso no site -- a imagem simplesmente nao
// aparece, porque o dev server responde index.html a qualquer 404. Aqui ve-se.
const COVERS = path.join(__dirname, '..', 'public', 'covers');
const ids = Object.keys(bookData);

describe('capas dos livros', () => {
    test('todos os livros tem capa', () => {
        const semCapa = ids
            .filter((id) => !fs.existsSync(path.join(COVERS, `${id}.jpg`)))
            .map((id) => `${id} (${bookData[id].title})`);
        expect(semCapa).toEqual([]);
    });

    // Uma capa a mais quer dizer que o livro saiu do bookMeta.json.
    test('nao ha capas orfas', () => {
        const esperadas = new Set(ids.map((id) => `${id}.jpg`));
        const orfas = fs.existsSync(COVERS)
            ? fs.readdirSync(COVERS).filter((f) => f.endsWith('.jpg') && !esperadas.has(f))
            : [];
        expect(orfas).toEqual([]);
    });
});

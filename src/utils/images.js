// Capas descarregadas do Goodreads pelo pipeline (scripts/build_book_data.py),
// com o ID do livro no Goodreads como nome do ficheiro.
export const coverSrc = (id) => `${process.env.PUBLIC_URL}/covers/${id}.jpg`;
export const pfpSrc = (displayName) => `${process.env.PUBLIC_URL}/pfp/${displayName}.png`;

// Icone do hub dos Biladeiros, na navbar. E o favicon do hub, extraido do .ico
// (170 kB) e reduzido a 64px -> 4 kB.
export const hubIconSrc = () => `${process.env.PUBLIC_URL}/hub.png`;

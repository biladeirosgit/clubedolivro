import { average } from './ratings';

// O clube le um livro por mes e tem poucos membros, portanto os minimos sao bem
// mais baixos que os do clube de cinema: com os de la, as listas ficavam vazias
// durante anos.
export const MIN_SHARED = 3; // minimo de livros em comum para a sintonia ser fiavel / entrar no top
export const AFFINITY_SHRINK = 5; // puxa para 0 a sintonia de pares com poucos livros em comum
export const MIN_RECOMMENDATIONS = 2; // minimo de escolhas avaliadas por outros para entrar no ranking de sugestoes
export const MIN_CROSS_RATED = 2; // minimo de livros de uma pessoa avaliados por outra para o par contar
export const MIN_GENRE_BOOKS = 2; // minimo de livros de um genero para a media dele ser fiavel
export const MIN_AUTHOR_BOOKS = 2; // um autor so entra no ranking com pelo menos dois livros lidos
export const MIN_OWN_CHOICES = 2; // diferenca entre a nota propria e a dos outros: pede menos escolhas que os rankings de sugestao, que comparam medias
export const MIN_OTHER_RATINGS = 2; // notas de gente que nao escolheu o livro, para a media "do clube" nesse livro valer alguma coisa
export const MIN_HARSHNESS_BOOKS = 4; // livros avaliados para o desvio de uma pessoa face ao clube ser um habito e nao um dia mau
export const MIN_SPREAD_RATINGS = 3; // com poucas notas o desacordo num livro e ruido, nao discussao

// Lista de nomes de exibicao que avaliaram pelo menos um livro.
export const allReviewers = (bookData) => {
    const set = new Set();
    Object.values(bookData).forEach((book) => {
        Object.keys(book.reviews || {}).forEach((name) => set.add(name));
    });
    return Array.from(set);
};

// Sintonia entre dois membros: correlacao de Pearson sobre os livros que ambos
// avaliaram. Mede se as notas sobem e descem juntas, nao se sao iguais -- quem
// avalia sempre meia estrela abaixo do outro nao esta a discordar de nada, e o
// Pearson desconta essa diferenca (e a de escala) de borla. Uma media de
// distancias nao conseguia isso, e um limiar binario ainda menos: com ele um
// desvio de 3 estrelas pesava o mesmo que um de 1.
//
// O `score` e o r encolhido para 0 por n/(n+AFFINITY_SHRINK). Sem isso um par
// com 12 livros e sorte batia um com 58, quando 58 livros sao evidencia muito
// mais forte. E o `score` que manda nos rankings; o `r` cru fica disponivel.
//
// Devolve tambem o que a correlacao ignora de proposito, para a UI poder
// mostrar: `bias` (quanto `a` da a mais que `b`, em media) e `agree` (livros a
// menos de meia estrela de distancia).
//
// null com menos de MIN_SHARED livros em comum, ou se um deles deu sempre a
// mesma nota — sem variacao nao ha correlacao que medir.
export const affinity = (bookData, a, b) => {
    const xs = [];
    const ys = [];
    Object.values(bookData).forEach((book) => {
        const ra = book.reviews?.[a];
        const rb = book.reviews?.[b];
        if (ra != null && rb != null) {
            xs.push(ra);
            ys.push(rb);
        }
    });

    const n = xs.length;
    if (n < MIN_SHARED) return null;

    const mx = xs.reduce((sum, v) => sum + v, 0) / n;
    const my = ys.reduce((sum, v) => sum + v, 0) / n;
    let cov = 0;
    let varX = 0;
    let varY = 0;
    let agree = 0;
    for (let i = 0; i < n; i += 1) {
        const dx = xs[i] - mx;
        const dy = ys[i] - my;
        cov += dx * dy;
        varX += dx * dx;
        varY += dy * dy;
        if (Math.abs(xs[i] - ys[i]) <= 0.5) agree += 1;
    }
    if (varX === 0 || varY === 0) return null;

    const r = cov / Math.sqrt(varX * varY);
    return { r, score: r * (n / (n + AFFINITY_SHRINK)), shared: n, agree, bias: mx - my };
};

// Todos os pares de membros ordenados por sintonia (desc). A cauda da lista
// sao os gostos mais opostos: com o Pearson, `score` negativo quer mesmo dizer
// que quando um sobe o outro desce.
export const affinityPairs = (bookData) => {
    const names = allReviewers(bookData);
    const pairs = [];
    for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
            const res = affinity(bookData, names[i], names[j]);
            if (res) pairs.push({ a: names[i], b: names[j], ...res });
        }
    }
    pairs.sort((x, y) => y.score - x.score);
    return pairs;
};

// Membros mais em sintonia com um dado membro (desc).
export const mostSimilarTo = (bookData, name) => {
    const names = allReviewers(bookData).filter((n) => n !== name);
    return names
        .map((other) => ({ name: other, ...(affinity(bookData, name, other) || {}) }))
        .filter((x) => x.score != null)
        .sort((x, y) => y.score - x.score);
};

// Quanto o clube discordou em cada livro: desvio-padrao das notas, do mais
// divisivo para o mais consensual. Quem quiser o lado do consenso le a lista
// ao contrario. Livros com poucas notas ficam de fora -- duas pessoas em
// desacordo nao sao o clube dividido.
export const ratingSpread = (bookData, minRatings = MIN_SPREAD_RATINGS) =>
    Object.entries(bookData)
        .map(([slug, book]) => {
            const ratings = Object.values(book.reviews || {});
            if (ratings.length < minRatings) return null;
            const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
            const variance = ratings.reduce((sum, r) => sum + (r - mean) ** 2, 0) / ratings.length;
            return { slug, book, spread: Math.sqrt(variance), average: mean, count: ratings.length };
        })
        .filter(Boolean)
        .sort((a, b) => b.spread - a.spread);

// Livros onde quem os trouxe e o resto do clube mais divergiram: nota de quem
// escolheu menos a media de todos os outros, do mais incompreendido para o
// menos. Positivo = gostou mais do que o clube gostou.
//
// E a versao por livro do ownChoiceBias, que faz a mesma conta mas por pessoa.
// Quando a escolha foi a meias, o lado "dele" e a media dos dois escolhedores
// e nenhum deles entra na media dos outros.
export const misunderstoodChoices = (bookData, minOthers = MIN_OTHER_RATINGS) =>
    Object.entries(bookData)
        .map(([slug, book]) => {
            const chosenBy = book.chosenBy || [];
            const own = chosenBy.map((name) => book.reviews?.[name]).filter((r) => r != null);
            if (own.length === 0) return null; // escolheu mas nao avaliou

            const others = Object.entries(book.reviews || {})
                .filter(([name]) => !chosenBy.includes(name))
                .map(([, rating]) => rating);
            if (others.length < minOthers) return null;

            const ownAvg = own.reduce((sum, r) => sum + r, 0) / own.length;
            const othersAvg = others.reduce((sum, r) => sum + r, 0) / others.length;
            return { slug, book, chosenBy, own: ownAvg, others: othersAvg, count: others.length, gap: ownAvg - othersAvg };
        })
        .filter(Boolean)
        .sort((a, b) => b.gap - a.gap);

// Quanta gente cada livro juntou, do mais visto para o menos. Leva tambem a
// media, que e o que a lista nao mostra: um livro muito visto pode ser muito
// visto e mau.
export const bookAudience = (bookData) =>
    Object.entries(bookData)
        .map(([slug, book]) => ({
            slug,
            book,
            count: Object.keys(book.reviews || {}).length,
            average: average(book.reviews),
        }))
        .sort((a, b) => b.count - a.count);

// Quem e odioso: nao quem da notas baixas, mas quem afunda um livro mesmo
// quando isso nao e habito dele.
//
// Primeiro tira-se o vies de cada um -- o quanto costuma dar acima ou abaixo do
// clube. E a mesma correcao que a `affinity` faz: quem da sempre meia estrela a
// menos nao esta a ser odioso com ninguem, e so a escala dele, e isso nao pode
// contar. Do que sobra olha-se so para o lado de baixo: a media de quanto ficou
// abaixo, nos livros em que ficou abaixo.
//
//   desvio      = (nota − media dos outros no livro) − vies da pessoa
//   odiosidade  = media dos desvios negativos
//
// Mais negativo = mais odioso. Leva o `worst`, o veredicto mais odioso de
// todos, que e o que torna o numero concreto.
export const ratingOdiousness = (bookData, minBooks = MIN_HARSHNESS_BOOKS, minOthers = MIN_OTHER_RATINGS) => {
    const acc = {}; // nome -> [{ slug, title, own, others, gap }]
    Object.entries(bookData).forEach(([slug, book]) => {
        const reviews = Object.entries(book.reviews || {});
        reviews.forEach(([name, rating]) => {
            const others = reviews.filter(([other]) => other !== name).map(([, r]) => r);
            if (others.length < minOthers) return;
            const othersAvg = others.reduce((sum, r) => sum + r, 0) / others.length;
            if (!acc[name]) acc[name] = [];
            acc[name].push({ slug, title: book.title, own: rating, others: othersAvg, gap: rating - othersAvg });
        });
    });

    return Object.entries(acc)
        .filter(([, seen]) => seen.length >= minBooks)
        .map(([name, seen]) => {
            const bias = seen.reduce((sum, m) => sum + m.gap, 0) / seen.length;
            const below = seen
                .map((m) => ({ ...m, deviation: m.gap - bias }))
                .filter((m) => m.deviation < 0)
                .sort((a, b) => a.deviation - b.deviation);
            if (below.length === 0) return null; // deu sempre exatamente o seu vies
            return {
                name,
                average: below.reduce((sum, m) => sum + m.deviation, 0) / below.length,
                count: below.length,
                rated: seen.length,
                bias,
                worst: below[0],
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.average - b.average);
};

// Em quantos livros cada um deixou comentario. Cada pessoa tem um comentario
// por livro (`comments[nome]` e uma string, quebras de linha incluidas), por
// isso isto e mesmo uma contagem de livros: ou comentou ou nao comentou.
// O `rate` e sobre os livros que essa pessoa viu, que e a medida justa -- em
// volume ganha sempre quem ca anda ha mais tempo.
export const commenterRanking = (bookData) => {
    const acc = {}; // nome -> { commented, watched }
    const entry = (name) => acc[name] || (acc[name] = { commented: 0, watched: 0 });
    Object.values(bookData).forEach((book) => {
        Object.keys(book.reviews || {}).forEach((name) => { entry(name).watched += 1; });
        Object.entries(book.comments || {}).forEach(([name, text]) => {
            if (text && text.trim()) entry(name).commented += 1;
        });
    });
    return Object.entries(acc)
        .map(([name, { commented, watched }]) => ({
            name,
            count: commented,
            watched,
            rate: watched ? commented / watched : 0,
        }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count || b.rate - a.rate);
};

// Escaloes de numero de paginas. `max` e exclusivo; o ultimo nao tem topo.
export const PAGE_BUCKETS = [
    { label: '< 200 pág.', max: 200 },
    { label: '200–300', max: 300 },
    { label: '300–400', max: 400 },
    { label: '400–500', max: 500 },
    { label: '500+ pág.', max: Infinity },
];

// A nota de um livro nas distribuicoes (decada, tamanho). Sem `name` e a media
// do clube; com `name` e a nota dessa pessoa, ou null se nao o leu.
const distributionRating = (book, name) => (name ? book.reviews?.[name] ?? null : average(book.reviews));

// O catalogo por tamanho, pela mesma receita das decadas: conta os livros de
// cada escalao e faz a media das medias. Pela ordem dos escaloes, nao por nota.
// Com `name` so conta os livros que essa pessoa leu, e a media e a das notas dela.
export const pageStats = (bookData, name = null) => {
    const acc = PAGE_BUCKETS.map(({ label }) => ({ label, count: 0, sum: 0, rated: 0 }));
    Object.values(bookData).forEach((book) => {
        if (!book.pages) return;
        const avg = distributionRating(book, name);
        if (name && avg == null) return;
        const i = PAGE_BUCKETS.findIndex((b) => book.pages < b.max);
        if (i < 0) return;
        acc[i].count += 1;
        if (avg != null) {
            acc[i].sum += avg;
            acc[i].rated += 1;
        }
    });
    return acc.map(({ label, count, sum, rated }) => ({
        label,
        count,
        average: rated ? sum / rated : null,
    }));
};

// O catalogo por decada de publicacao, da mais antiga para a mais recente --
// linha do tempo, nao ranking. `average` e null numa decada que ninguem
// avaliou ainda. Com `name` so conta os livros que essa pessoa leu, e a media
// e a das notas dela.
export const decadeStats = (bookData, name = null) => {
    const acc = {}; // decada -> { count, sum, rated }
    Object.values(bookData).forEach((book) => {
        if (!book.year) return;
        const avg = distributionRating(book, name);
        if (name && avg == null) return;
        const decade = Math.floor(book.year / 10) * 10;
        if (!acc[decade]) acc[decade] = { count: 0, sum: 0, rated: 0 };
        acc[decade].count += 1;
        if (avg != null) {
            acc[decade].sum += avg;
            acc[decade].rated += 1;
        }
    });
    return Object.entries(acc)
        .map(([decade, { count, sum, rated }]) => ({
            decade: Number(decade),
            count,
            average: rated ? sum / rated : null,
        }))
        .sort((a, b) => a.decade - b.decade);
};

// Livros que um membro ainda nao avaliou (slugs), dos mais bem avaliados pelo
// clube para os piores — assim a lista sugere primeiro o que vale a pena ver.
// Os que ainda ninguem avaliou vao para o fim.
export const unratedByUser = (bookData, name) =>
    Object.entries(bookData)
        .filter(([, book]) => !(name in (book.reviews || {})))
        .sort(([, a], [, b]) => (average(b.reviews) ?? -1) - (average(a.reviews) ?? -1))
        .map(([slug]) => slug);

// As notas sao meias estrelas (0.5 a 5), por isso a distribuicao e indexada
// pelo dobro da nota: 1 = meia estrela, 10 = cinco estrelas.
export const RATING_BUCKETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Quantas notas de cada valor foram dadas. Sem `name` conta as do clube todo,
// com `name` so as dessa pessoa.
export const ratingDistribution = (bookData, name = null) => {
    const counts = {};
    Object.values(bookData).forEach((book) => {
        const ratings = name
            ? [book.reviews?.[name]].filter((r) => r != null)
            : Object.values(book.reviews || {});
        ratings.forEach((rating) => {
            counts[rating * 2] = (counts[rating * 2] || 0) + 1;
        });
    });
    return counts;
};

// Quantos livros ha de cada valor de um campo-lista do livro (`genres`,
// `authors`), do mais comum para o menos. Sem `name` conta o
// catalogo todo; com `name` so os livros que essa pessoa escolheu. Um livro
// conta para todos os valores que tem.
export const creditCounts = (bookData, field, name = null) => {
    const counts = {};
    Object.values(bookData).forEach((book) => {
        if (name && !(book.chosenBy || []).includes(name)) return;
        (book[field] || []).forEach((value) => {
            counts[value] = (counts[value] || 0) + 1;
        });
    });
    return Object.entries(counts)
        .map(([value, count]) => ({ name: value, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

// Ranking dos valores de um campo-lista pela nota media. Sem `name` usa a media
// do clube em cada livro; com `name` usa so as notas dessa pessoa — ou seja, o
// counts fala do que a pessoa escolheu e o ranking do que ela viu. Valores com
// poucos livros ficam de fora porque um unico livro muito bom ou muito mau
// punha-os logo no topo.
export const creditRanking = (bookData, field, name = null, minBooks = MIN_GENRE_BOOKS) => {
    const acc = {}; // valor -> { sum, count, books }
    Object.entries(bookData).forEach(([slug, book]) => {
        const rating = name ? book.reviews?.[name] : average(book.reviews);
        if (rating == null) return;
        (book[field] || []).forEach((value) => {
            if (!acc[value]) acc[value] = { sum: 0, count: 0, books: [] };
            acc[value].sum += rating;
            acc[value].count += 1;
            // Que livros sustentam a media, do melhor para o pior. Quem tem
            // muitos (um genero) nao vai querer a lista toda; quem tem tres
            // (um autor) vive disto.
            acc[value].books.push({ slug, title: book.title, year: book.year, rating });
        });
    });
    return Object.entries(acc)
        .map(([value, { sum, count, books }]) => ({
            name: value,
            average: sum / count,
            count,
            books: books.sort((a, b) => b.rating - a.rating),
        }))
        .filter((x) => x.count >= minBooks)
        .sort((a, b) => b.average - a.average || b.count - a.count);
};

export const genreCounts = (bookData, name = null) => creditCounts(bookData, 'genres', name);

export const genreRanking = (bookData, name = null, minBooks = MIN_GENRE_BOOKS) =>
    creditRanking(bookData, 'genres', name, minBooks);

// Media das notas de um livro ignorando um conjunto de nomes (tipicamente quem
// o escolheu). Devolve null se nao sobrar nenhuma nota — o livro e ignorado,
// nunca conta como 0.
export const averageExcluding = (book, excluded = []) => {
    const skip = new Set(excluded);
    const reviews = Object.fromEntries(
        Object.entries(book.reviews || {}).filter(([name]) => !skip.has(name))
    );
    return average(reviews);
};

// Base dos rankings de sugeridores: percorre os livros e acumula, por cada
// nome do chosenBy, o valor devolvido por `valueOf`. Se `valueOf` devolver null
// o livro nao conta de todo — nem para a media nem para o minimo. Livros
// co-escolhidos contam para os dois nomes.
const rankSuggesters = (bookData, valueOf, minBooks) => {
    const acc = {}; // nome -> { sum, count }
    Object.values(bookData).forEach((book) => {
        const chosenBy = book.chosenBy || [];
        if (chosenBy.length === 0) return;
        const value = valueOf(book, chosenBy);
        if (value == null) return;
        chosenBy.forEach((name) => {
            if (!acc[name]) acc[name] = { sum: 0, count: 0 };
            acc[name].sum += value;
            acc[name].count += 1;
        });
    });
    return Object.entries(acc)
        .map(([name, { sum, count }]) => ({ name, average: sum / count, count }))
        .filter((x) => x.count >= minBooks)
        .sort((a, b) => b.average - a.average || b.count - a.count);
};

// Ranking de quem sugere os melhores livros: media das medias dos livros que
// escolheu, sem a nota do proprio (nem a do co-escolhedor). Livros que mais
// ninguem avaliou sao saltados por completo, senao quem sugeriu era penalizado.
export const suggesterRanking = (bookData, minBooks = MIN_RECOMMENDATIONS) =>
    rankSuggesters(bookData, (book, chosenBy) => averageExcluding(book, chosenBy), minBooks);

// Ranking de quem leva mais gente a ver: media de pessoas que avaliaram cada
// livro que escolheu. Aqui um livro que ninguem viu conta mesmo como 0 — e
// precisamente o que a metrica quer medir.
export const suggesterAudience = (bookData, minBooks = MIN_RECOMMENDATIONS) =>
    rankSuggesters(bookData, (book) => Object.keys(book.reviews || {}).length, minBooks);

// Ranking pela epoca dos livros que cada um traz: media do ano de publicacao das
// suas escolhas. Do mais antigo para o mais recente, porque as duas pontas da
// lista sao as interessantes -- quem desenterra classicos e quem so traz
// novidades. Um livro sem ano nao conta.
export const suggesterYears = (bookData, minBooks = MIN_RECOMMENDATIONS) =>
    rankSuggesters(bookData, (book) => book.year || null, minBooks)
        .sort((a, b) => a.average - b.average || b.count - a.count);

// O mesmo por nome e sem minimo, para a coluna da tabela de membros.
export const suggesterAverages = (bookData) =>
    Object.fromEntries(suggesterRanking(bookData, 0).map((s) => [s.name, s]));

// Quanto cada um gosta mais das proprias escolhas do que o resto do clube:
// media de (nota dele no livro que trouxe) menos (media dos outros no mesmo
// livro). Positivo quer dizer que gosta mais do que traz do que o clube gosta.
// A nota de quem co-escolheu tambem fica de fora da media dos outros, senao um
// livro trazido a meias comparava-se com metade de si proprio.
// E o complemento do suggesterRanking, que exclui a nota do proprio justamente
// para a media nao ser inflacionada por ela -- aqui mede-se essa inflacao.
export const ownChoiceBias = (bookData, minBooks = MIN_OWN_CHOICES) => {
    const acc = {}; // nome -> { sum, count }
    Object.values(bookData).forEach((book) => {
        const chosenBy = book.chosenBy || [];
        if (chosenBy.length === 0) return;
        const others = averageExcluding(book, chosenBy);
        if (others == null) return; // so o proprio avaliou: nada com que comparar
        chosenBy.forEach((name) => {
            const own = book.reviews?.[name];
            if (own == null) return; // escolheu mas nao avaliou
            if (!acc[name]) acc[name] = { sum: 0, count: 0 };
            acc[name].sum += own - others;
            acc[name].count += 1;
        });
    });
    return Object.entries(acc)
        .map(([name, { sum, count }]) => ({ name, average: sum / count, count }))
        .filter((x) => x.count >= minBooks)
        .sort((a, b) => b.average - a.average || b.count - a.count);
};

// Matriz (quem escolheu) x (quem avaliou): matrix[escolheu][avaliou] = { sum, count }.
// Livro co-escolhido entra nas duas linhas. Inclui a nota do proprio — quem a
// quiser de fora filtra-a.
export const suggesterRaterMatrix = (bookData) => {
    const matrix = {};
    Object.values(bookData).forEach((book) => {
        (book.chosenBy || []).forEach((suggester) => {
            const row = matrix[suggester] || (matrix[suggester] = {});
            Object.entries(book.reviews || {}).forEach(([rater, rating]) => {
                const cell = row[rater] || (row[rater] = { sum: 0, count: 0 });
                cell.sum += rating;
                cell.count += 1;
            });
        });
    });
    return matrix;
};

// Quem gosta (e quem odeia) das escolhas de `name`: media que cada um deu aos
// livros que ele escolheu, do maior fa ao maior hater. Exclui o proprio.
// Sem minimo de propositio — com um minimo alto a lista ficava vazia para
// quase toda a gente. Basta ter visto uma escolha para aparecer.
export const ratersOfSuggester = (bookData, name) =>
    Object.entries(suggesterRaterMatrix(bookData)[name] || {})
        .filter(([rater]) => rater !== name)
        .map(([rater, cell]) => ({ name: rater, average: cell.sum / cell.count, count: cell.count }))
        .sort((a, b) => b.average - a.average || b.count - a.count);

// De quem `name` mais gosta das escolhas: media que ele deu aos livros de cada
// sugeridor. Inclui as escolhas do proprio, de proposito.
export const suggestersRatedBy = (bookData, name, min = MIN_CROSS_RATED) =>
    Object.entries(suggesterRaterMatrix(bookData))
        .map(([suggester, row]) => ({ suggester, cell: row[name] }))
        .filter(({ cell }) => cell && cell.count >= min)
        .map(({ suggester, cell }) => ({
            name: suggester,
            average: cell.sum / cell.count,
            count: cell.count,
        }))
        .sort((a, b) => b.average - a.average || b.count - a.count);

export { average };

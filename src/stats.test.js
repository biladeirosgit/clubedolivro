import {
    affinity,
    affinityPairs,
    MIN_SHARED,
    AFFINITY_SHRINK,
    MIN_OTHER_RATINGS,
    ratingDistribution,
    genreRanking,
    genreCounts,
    creditCounts,
    creditRanking,
    unratedByUser,
    averageExcluding,
    suggesterRanking,
    suggesterAudience,
    suggesterYears,
    ratingSpread,
    misunderstoodChoices,
    ratingOdiousness,
    bookAudience,
    commenterRanking,
    decadeStats,
    pageStats,
    ownChoiceBias,
    MIN_OWN_CHOICES,
    ratersOfSuggester,
    suggestersRatedBy,
} from './utils/stats';

// As estatisticas novas cruzam quem escolheu o livro com quem lhe deu nota.
// O que se parte facil aqui e a regra de exclusao: a nota de quem escolhe nao
// conta para a media da escolha dele, mas um livro que so ele viu tambem nao
// pode contar como 0 e afundar-lhe a media.

const book = (chosenBy, reviews, genres = ['Drama']) => ({
    title: 'Livro',
    year: 2000,
    link: 'https://www.goodreads.com/book/show/1',
    date: '01/01/2020',
    chosenBy,
    genres,
    pages: 300,
    reviews,
    comments: {},
});

describe('affinity', () => {
    // Os cenarios usam 8 livros, acima do minimo, e o caso do minimo deriva
    // do proprio MIN_SHARED para o teste nao partir se ele mudar.
    const pairData = (as, bs) => Object.fromEntries(
        as.map((a, i) => [`f${i}`, book(['S'], { A: a, B: bs[i] })])
    );

    const subidas = [1, 2, 2.5, 3, 3.5, 4, 4.5, 5];

    test('quem avalia sempre 1 ponto abaixo esta em sintonia perfeita', () => {
        const criticos = pairData(subidas, subidas.map((r) => r - 1));
        const res = affinity(criticos, 'A', 'B');
        expect(res.r).toBeCloseTo(1, 10);
        expect(res.bias).toBeCloseTo(1, 10); // o A da 1 estrela a mais
        expect(res.agree).toBe(0);           // e nunca concordam a menos de meia
    });

    test('gosto invertido da correlacao negativa', () => {
        const res = affinity(pairData(subidas, subidas.slice().reverse()), 'A', 'B');
        expect(res.r).toBeLessThan(0);
    });

    test('desvios maiores pesam mais que desvios pequenos', () => {
        const perto = affinity(pairData(subidas, subidas.map((r, i) => r + (i % 2 ? 0.5 : -0.5))), 'A', 'B');
        const longe = affinity(pairData(subidas, subidas.map((r, i) => r + (i % 2 ? 2 : -2))), 'A', 'B');
        expect(perto.r).toBeGreaterThan(longe.r);
    });

    test('o score encolhe para 0 quanto menos livros houver', () => {
        const oito = affinity(pairData(subidas, subidas), 'A', 'B');
        const dezasseis = affinity(pairData([...subidas, ...subidas], [...subidas, ...subidas]), 'A', 'B');
        expect(oito.r).toBeCloseTo(1, 10);
        expect(dezasseis.r).toBeCloseTo(1, 10);
        expect(oito.score).toBeCloseTo(8 / (8 + AFFINITY_SHRINK), 10);
        expect(dezasseis.score).toBeCloseTo(16 / (16 + AFFINITY_SHRINK), 10);
        expect(dezasseis.score).toBeGreaterThan(oito.score);
    });

    test('null com poucos livros em comum ou sem variacao nas notas', () => {
        const poucos = pairData(subidas.slice(0, MIN_SHARED - 1), subidas.slice(0, MIN_SHARED - 1));
        expect(affinity(poucos, 'A', 'B')).toBeNull();
        const sempreIgual = pairData(subidas, subidas.map(() => 4));
        expect(affinity(sempreIgual, 'A', 'B')).toBeNull();
    });

    test('affinityPairs ordena do mais em sintonia para o mais oposto', () => {
        const data = {};
        subidas.forEach((r, i) => {
            data[`f${i}`] = book(['S'], { A: r, Igual: r, Oposto: 6 - r });
        });
        const pares = affinityPairs(data);
        expect(pares[0].score).toBeGreaterThan(0);
        expect(pares[pares.length - 1].score).toBeLessThan(0);
    });
});

describe('ratingDistribution', () => {
    const data = {
        a: book(['X'], { A: 5, B: 2.5 }),
        b: book(['X'], { A: 5, B: 1 }),
        c: book(['X'], {}),
    };

    // Indexado pelo dobro da nota para as meias estrelas caberem em chaves
    // inteiras: 2.5 estrelas -> 5.
    test('conta as notas do clube todo pelo dobro da nota', () => {
        expect(ratingDistribution(data)).toEqual({ 10: 2, 5: 1, 2: 1 });
    });

    test('com nome conta so as notas dessa pessoa', () => {
        expect(ratingDistribution(data, 'A')).toEqual({ 10: 2 });
        expect(ratingDistribution(data, 'B')).toEqual({ 5: 1, 2: 1 });
    });

    test('quem nao avaliou nada devolve objeto vazio', () => {
        expect(ratingDistribution(data, 'NaoExiste')).toEqual({});
    });
});

describe('creditCounts / creditRanking', () => {
    const livro = (chosenBy, reviews, extra) => ({ ...book(chosenBy, reviews), ...extra });

    const data = {
        a: livro(['A'], { X: 5, Y: 3 }, { authors: ['Gaiman', 'Pratchett'], genres: ['Fantasy'] }),
        b: livro(['A'], { X: 3 }, { authors: ['Gaiman'], genres: ['Fantasy', 'Horror'] }),
        c: livro(['B'], { X: 1 }, { authors: ['King'], genres: ['Fantasy'] }),
    };

    test('conta os valores de qualquer campo-lista', () => {
        expect(creditCounts(data, 'authors')).toEqual([
            { name: 'Gaiman', count: 2 },
            { name: 'King', count: 1 },
            { name: 'Pratchett', count: 1 },
        ]);
        expect(creditCounts(data, 'genres')[0]).toEqual({ name: 'Fantasy', count: 3 });
    });

    // Um livro escrito a meias tem de contar para os dois nomes, nao so para o
    // primeiro.
    test('todos os autores de um livro contam', () => {
        expect(creditCounts({ a: data.a }, 'authors').map((p) => p.name)).toEqual(['Gaiman', 'Pratchett']);
    });

    test('com nome, o counts filtra pelo que a pessoa escolheu', () => {
        expect(creditCounts(data, 'authors', 'B')).toEqual([{ name: 'King', count: 1 }]);
    });

    // Um livro sem o campo (ex: creditos ainda por preencher) nao pode rebentar.
    test('campo em falta e ignorado', () => {
        const semCampo = { a: book(['A'], { X: 4 }) };
        expect(creditCounts(semCampo, 'authors')).toEqual([]);
        expect(creditRanking(semCampo, 'authors', null, 1)).toEqual([]);
    });

    test('ranking usa a media do clube e respeita o minimo', () => {
        // Gaiman: livro a (media 4) e livro b (media 3) -> 3.5 em 2 livros.
        expect(creditRanking(data, 'authors', null, 2)).toMatchObject([
            { name: 'Gaiman', average: 3.5, count: 2 },
        ]);
    });

    // A lista de livros alimenta a bolha de hover dos autores.
    test('traz os livros que sustentam a media, do melhor para o pior', () => {
        const data = {
            bom: { ...book(['X'], { A: 5 }), title: 'Bom', authors: ['Gaiman'] },
            mau: { ...book(['X'], { A: 1 }), title: 'Mau', authors: ['Gaiman'] },
        };
        const [gaiman] = creditRanking(data, 'authors', null, 2);
        expect(gaiman.books.map((m) => [m.slug, m.title, m.rating])).toEqual([
            ['bom', 'Bom', 5],
            ['mau', 'Mau', 1],
        ]);
    });

    // O counts fala do que a pessoa escolheu, o ranking do que ela viu — o B
    // avaliou livros que nao escolheu e eles contam para a media dele.
    test('com nome, o ranking usa as notas dessa pessoa em tudo o que viu', () => {
        expect(creditRanking(data, 'genres', 'X', 3)).toMatchObject([
            { name: 'Fantasy', average: 3, count: 3 },
        ]);
    });
});

describe('genreCounts', () => {
    const data = {
        a: book(['A'], { X: 4 }, ['Terror', 'Comédia']),
        b: book(['A'], { X: 4 }, ['Terror']),
        c: book(['B'], { X: 4 }, ['Drama']),
    };

    test('sem nome conta o catalogo todo', () => {
        expect(genreCounts(data)).toEqual([
            { name: 'Terror', count: 2 },
            { name: 'Comédia', count: 1 },
            { name: 'Drama', count: 1 },
        ]);
    });

    // O card no perfil e sobre o que a pessoa traz ao clube, nao sobre o que ve.
    test('com nome conta so os livros que essa pessoa escolheu', () => {
        expect(genreCounts(data, 'A')).toEqual([
            { name: 'Terror', count: 2 },
            { name: 'Comédia', count: 1 },
        ]);
    });

    test('livro co-escolhido conta para os dois', () => {
        const juntos = { a: book(['A', 'B'], {}, ['Musical']) };
        expect(genreCounts(juntos, 'A')).toEqual([{ name: 'Musical', count: 1 }]);
        expect(genreCounts(juntos, 'B')).toEqual([{ name: 'Musical', count: 1 }]);
    });

    test('quem nunca escolheu nada devolve lista vazia', () => {
        expect(genreCounts(data, 'X')).toEqual([]);
    });
});

describe('genreRanking', () => {
    // Sem nome: media do clube em cada livro. Um livro com muita gente a votar
    // nao pode pesar mais do que um com pouca — cada livro conta uma vez.
    test('sem nome usa a media do clube, um voto por livro', () => {
        const data = {
            a: book(['X'], { A: 5, B: 5, C: 5 }, ['Terror']),
            b: book(['X'], { A: 1 }, ['Terror']),
            c: book(['X'], { A: 3 }, ['Terror']),
        };
        expect(genreRanking(data, null, 3)).toMatchObject([{ name: 'Terror', average: 3, count: 3 }]);
    });

    test('com nome usa so as notas dessa pessoa', () => {
        const data = {
            a: book(['X'], { A: 5, B: 1 }, ['Terror']),
            b: book(['X'], { A: 5, B: 1 }, ['Terror']),
            c: book(['X'], { A: 5, B: 1 }, ['Terror']),
        };
        expect(genreRanking(data, 'A', 3)[0].average).toBe(5);
        expect(genreRanking(data, 'B', 3)[0].average).toBe(1);
    });

    // Um livro com varios generos conta para todos eles.
    test('um livro conta para cada genero que tem', () => {
        const data = { a: book(['X'], { A: 4 }, ['Terror', 'Comédia']) };
        expect(genreRanking(data, null, 1).map((g) => g.name).sort()).toEqual(['Comédia', 'Terror']);
    });

    // Um unico livro de 5 estrelas nao pode pôr o genero no topo do ranking.
    test('generos com poucos livros ficam de fora', () => {
        const data = {
            raro: book(['X'], { A: 5 }, ['Musical']),
            d1: book(['X'], { A: 3 }),
            d2: book(['X'], { A: 3 }),
            d3: book(['X'], { A: 3 }),
        };
        expect(genreRanking(data, null, 3).map((g) => g.name)).toEqual(['Drama']);
    });

    // Livros que a pessoa nao viu (ou que ninguem viu) nao entram na contagem.
    test('salta os livros sem nota, sem NaN', () => {
        const data = {
            vazio: book(['X'], {}, ['Terror']),
            visto: book(['X'], { A: 4 }, ['Terror']),
        };
        const [terror] = genreRanking(data, null, 1);
        expect(terror).toMatchObject({ name: 'Terror', average: 4, count: 1 });
        expect(terror.books.map((m) => m.slug)).toEqual(['visto']); // o sem nota nao entra
    });
});

describe('unratedByUser', () => {
    // A lista no perfil e curta (10), portanto a ordem decide o que aparece:
    // primeiro os melhores do clube, para servir de recomendacao.
    test('ordena pela media do clube, do melhor para o pior', () => {
        const data = {
            mau: book(['X'], { B: 1 }),
            bom: book(['X'], { B: 5 }),
            medio: book(['X'], { B: 3 }),
        };
        expect(unratedByUser(data, 'A')).toEqual(['bom', 'medio', 'mau']);
    });

    // Sem notas nenhumas nao ha nada a recomendar — vai para o fim em vez de
    // aparecer no topo como se fosse 0.
    test('livros que ninguem avaliou ficam no fim', () => {
        const data = {
            vazio: book(['X'], {}),
            mau: book(['X'], { B: 1 }),
        };
        expect(unratedByUser(data, 'A')).toEqual(['mau', 'vazio']);
    });

    test('nao inclui os livros que o membro ja avaliou', () => {
        const data = { visto: book(['X'], { A: 4 }), porVer: book(['X'], { B: 4 }) };
        expect(unratedByUser(data, 'A')).toEqual(['porVer']);
    });
});

describe('averageExcluding', () => {
    test('sem notas nenhumas devolve null', () => {
        expect(averageExcluding(book(['A'], {}), ['A'])).toBeNull();
    });

    // Nao pode devolver 0 nem NaN: quem chama distingue "ninguem avaliou" de
    // "avaliaram mal" por este null.
    test('so com a nota do proprio devolve null', () => {
        expect(averageExcluding(book(['A'], { A: 5 }), ['A'])).toBeNull();
    });

    test('ignora os nomes excluidos e faz media do resto', () => {
        expect(averageExcluding(book(['A'], { A: 5, B: 3, C: 1 }), ['A'])).toBe(2);
    });
});

describe('suggesterRanking', () => {
    // minBooks = 0 na maioria dos testes para isolar as contas do minimo.
    test('um livro so auto-avaliado nao conta nem puxa a media para baixo', () => {
        const data = {
            'so-ele': book(['A'], { A: 5 }),
            outro: book(['A'], { A: 1, B: 4 }),
        };
        const [a] = suggesterRanking(data, 0);
        expect(a).toEqual({ name: 'A', average: 4, count: 1 });
    });

    test('livro sem reviews nenhumas e saltado, sem NaN', () => {
        const data = {
            vazio: book(['A'], {}),
            outro: book(['A'], { B: 3 }),
        };
        const [a] = suggesterRanking(data, 0);
        expect(a.count).toBe(1);
        expect(Number.isNaN(a.average)).toBe(false);
    });

    // Num livro co-escolhido tem de sair a nota dos dois, nao so a do primeiro.
    test('livro co-escolhido conta para os dois e exclui os dois', () => {
        const data = { juntos: book(['A', 'B'], { A: 5, B: 5, C: 3 }) };
        expect(suggesterRanking(data, 0)).toEqual([
            { name: 'A', average: 3, count: 1 },
            { name: 'B', average: 3, count: 1 },
        ]);
    });

    test('a fronteira do minimo: 4 fica de fora, 5 entra', () => {
        const four = {};
        for (let i = 0; i < 4; i += 1) four[`f${i}`] = book(['A'], { B: 4 });
        expect(suggesterRanking(four, 5)).toEqual([]);

        const five = { ...four, f4: book(['A'], { B: 4 }) };
        expect(suggesterRanking(five, 5).map((s) => s.name)).toEqual(['A']);
    });

    // Os livros saltados tambem nao contam para o minimo — quem escolheu 6 mas
    // so teve 4 vistos por outros nao chega ao ranking.
    test('livros saltados nao contam para o minimo', () => {
        const data = {};
        for (let i = 0; i < 4; i += 1) data[`visto${i}`] = book(['A'], { B: 4 });
        data.soEle1 = book(['A'], { A: 5 });
        data.soEle2 = book(['A'], { A: 5 });
        expect(suggesterRanking(data, 0)[0].count).toBe(4);
        expect(suggesterRanking(data, 5)).toEqual([]);
    });

    test('ordena da melhor media para a pior', () => {
        const data = {
            mau: book(['A'], { C: 1 }),
            bom: book(['B'], { C: 5 }),
        };
        expect(suggesterRanking(data, 0).map((s) => s.name)).toEqual(['B', 'A']);
    });
});

describe('suggesterAudience', () => {
    test('media de pessoas que viram cada escolha', () => {
        const data = {
            a: book(['A'], { X: 4, Y: 4, Z: 4 }),
            b: book(['A'], { X: 4 }),
        };
        expect(suggesterAudience(data, 0)).toEqual([{ name: 'A', average: 2, count: 2 }]);
    });

    // Ao contrario do ranking de notas, aqui "ninguem viu" e a propria medida —
    // tem de contar como 0 em vez de o livro desaparecer da conta.
    test('um livro que ninguem viu conta como 0', () => {
        const data = {
            a: book(['A'], { X: 4, Y: 4 }),
            b: book(['A'], {}),
        };
        expect(suggesterAudience(data, 0)).toEqual([{ name: 'A', average: 1, count: 2 }]);
    });

    test('livro co-escolhido conta para os dois', () => {
        const data = { a: book(['A', 'B'], { X: 4, Y: 4 }) };
        expect(suggesterAudience(data, 0)).toEqual([
            { name: 'A', average: 2, count: 1 },
            { name: 'B', average: 2, count: 1 },
        ]);
    });

    test('respeita o minimo de escolhas', () => {
        const data = { a: book(['A'], { X: 4 }), b: book(['A'], { X: 4 }) };
        expect(suggesterAudience(data, 3)).toEqual([]);
        expect(suggesterAudience(data, 2)).toHaveLength(1);
    });

    test('ordena de quem enche mais a sala para quem enche menos', () => {
        const data = {
            a: book(['A'], { X: 4 }),
            b: book(['B'], { X: 4, Y: 4, Z: 4 }),
        };
        expect(suggesterAudience(data, 0).map((s) => s.name)).toEqual(['B', 'A']);
    });
});

describe('suggesterYears', () => {
    const dated = (chosenBy, year) => ({ ...book(chosenBy, { X: 4 }), year });

    test('media do ano de estreia, do mais antigo para o mais recente', () => {
        const data = {
            a: dated(['Velho'], 1970),
            b: dated(['Velho'], 1990),
            c: dated(['Novo'], 2020),
        };
        expect(suggesterYears(data, 0)).toEqual([
            { name: 'Velho', average: 1980, count: 2 },
            { name: 'Novo', average: 2020, count: 1 },
        ]);
    });

    test('livro co-escolhido conta para os dois', () => {
        const data = { a: dated(['A', 'B'], 2000) };
        expect(suggesterYears(data, 0).map((s) => s.name).sort()).toEqual(['A', 'B']);
    });

    test('livro sem ano nao entra na media', () => {
        const data = { a: dated(['A'], 1980), b: dated(['A'], undefined) };
        expect(suggesterYears(data, 0)).toEqual([{ name: 'A', average: 1980, count: 1 }]);
    });

    test('respeita o minimo de escolhas', () => {
        const data = { a: dated(['A'], 1980), b: dated(['A'], 1990) };
        expect(suggesterYears(data, 3)).toEqual([]);
        expect(suggesterYears(data, 2).map((s) => s.name)).toEqual(['A']);
    });
});

describe('ratingSpread', () => {
    test('do mais divisivo para o mais consensual', () => {
        const data = {
            divisivo: book(['X'], { A: 1, B: 5, C: 1, D: 5, E: 3 }),
            consenso: book(['X'], { A: 3, B: 3, C: 3, D: 3, E: 3 }),
        };
        const [first, second] = ratingSpread(data, 5);
        expect(first.slug).toBe('divisivo');
        expect(second.slug).toBe('consenso');
        expect(second.spread).toBe(0);
        expect(first.average).toBe(3);
        expect(first.count).toBe(5);
    });

    test('livro com poucas notas nao entra', () => {
        const data = { a: book(['X'], { A: 1, B: 5 }) };
        expect(ratingSpread(data, 5)).toEqual([]);
        expect(ratingSpread(data, 2)).toHaveLength(1);
    });
});

describe('misunderstoodChoices', () => {
    const escolha = (chosenBy, reviews) => ({ ...book(chosenBy, reviews), title: 'Livro' });

    test('do mais incompreendido para o menos', () => {
        const data = {
            adorou: escolha(['Eu'], { Eu: 5, A: 1, B: 1, C: 1, D: 1 }),
            normal: escolha(['Eu'], { Eu: 3, A: 3, B: 3, C: 3, D: 3 }),
        };
        const [primeiro, segundo] = misunderstoodChoices(data);
        expect(primeiro.slug).toBe('adorou');
        expect(primeiro.gap).toBe(4);
        expect(primeiro.own).toBe(5);
        expect(primeiro.others).toBe(1);
        expect(primeiro.count).toBe(4);
        expect(segundo.gap).toBe(0);
    });

    // Escolha a meias: os dois donos formam um lado e nenhum deles polui o outro.
    test('escolha a meias junta os dois donos e tira-os dos outros', () => {
        const data = { a: escolha(['Eu', 'Tu'], { Eu: 5, Tu: 4, A: 1, B: 1, C: 1, D: 1 }) };
        const [res] = misunderstoodChoices(data);
        expect(res.own).toBe(4.5);
        expect(res.others).toBe(1);
        expect(res.count).toBe(4);
    });

    test('precisa de notas de quem nao escolheu, e de nota do proprio', () => {
        // Um a menos que o minimo de notas de outros.
        const outros = Object.fromEntries(Array.from({ length: MIN_OTHER_RATINGS - 1 }, (_, i) => [`O${i}`, 1]));
        const poucos = { a: escolha(['Eu'], { Eu: 5, ...outros }) };
        expect(misunderstoodChoices(poucos)).toEqual([]);
        expect(misunderstoodChoices(poucos, MIN_OTHER_RATINGS - 1)).toHaveLength(1);

        const semNotaDoDono = { a: escolha(['Eu'], { A: 1, B: 1, C: 1, D: 1 }) };
        expect(misunderstoodChoices(semNotaDoDono)).toEqual([]);
    });
});

describe('ratingOdiousness', () => {
    const livro = (notas) => book(['S'], notas);
    const oito = (fn) => Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`f${i}`, livro(fn(i))])
    );

    // O ponto da metrica: quem da sempre uma estrela abaixo nao e odioso, e so
    // a escala dele. Tirado o vies nao lhe sobra desvio nenhum, portanto nem
    // chega a entrar na lista.
    test('quem da sempre abaixo por igual nao e odioso', () => {
        const data = oito(() => ({ Duro: 2, A: 3, B: 3, C: 3, D: 3 }));
        expect(ratingOdiousness(data).map((o) => o.name)).not.toContain('Duro');
    });

    // O mesmo perfil de desvio em cima ou em baixo da a mesma odiosidade: e o
    // vies que os separa, e o vies sai da conta.
    test('o vies sai da conta: mesmo desvio, mesma odiosidade', () => {
        const duro = oito((i) => ({ Duro: i === 0 ? 1 : 2, A: 3, B: 3, C: 3, D: 3 }));
        const brando = oito((i) => ({ Brando: i === 0 ? 3 : 4, A: 3, B: 3, C: 3, D: 3 }));
        const [d] = ratingOdiousness(duro);
        const [b] = ratingOdiousness(brando);
        expect(d.bias).toBeLessThan(0);
        expect(b.bias).toBeGreaterThan(0);
        expect(d.average).toBeCloseTo(b.average, 10);
    });

    // E o inverso: quem costuma concordar mas afunda um livro fica no topo,
    // mesmo tendo media mais alta que o duro do teste anterior.
    test('afundar um livro fora do habitual e que conta', () => {
        const data = {
            ...oito(() => ({ Normal: 3, Duro: 2, A: 3, B: 3, C: 3, D: 3 })),
            nuke: livro({ Normal: 0.5, Duro: 2, A: 3, B: 3, C: 3, D: 3 }),
        };
        const res = ratingOdiousness(data);
        expect(res[0].name).toBe('Normal');
        expect(res[0].average).toBeLessThan(-1);
        const duro = res.find((o) => o.name === 'Duro');
        expect(duro.average).toBeGreaterThan(res[0].average); // menos odioso que o Normal
    });

    test('guarda o veredicto mais odioso e conta os livros abaixo', () => {
        const data = {
            ...oito(() => ({ X: 3, A: 3, B: 3, C: 3, D: 3 })),
            odiado: { ...livro({ X: 0.5, A: 5, B: 5, C: 5, D: 5 }), title: 'Odiado' },
        };
        const [x] = ratingOdiousness(data).filter((o) => o.name === 'X');
        expect(x.worst.title).toBe('Odiado');
        expect(x.worst.own).toBe(0.5);
        expect(x.worst.others).toBe(5);
        expect(x.rated).toBe(9);
    });

    test('respeita os minimos de livros e de outros avaliadores', () => {
        const poucosLivros = { a: livro({ X: 1, A: 3, B: 3, C: 3, D: 3 }) };
        expect(ratingOdiousness(poucosLivros)).toEqual([]);

        const poucosOutros = oito(() => ({ X: 1, A: 3, B: 3 })); // so 2 outros
        expect(ratingOdiousness(poucosOutros, 1)).toEqual([]);
    });
});

describe('bookAudience', () => {
    test('do mais visto para o menos, e zero conta', () => {
        const data = {
            cheio: book(['X'], { A: 4, B: 4, C: 4 }),
            vazio: book(['X'], {}),
            meio: book(['X'], { A: 4 }),
        };
        expect(bookAudience(data).map((m) => [m.slug, m.count])).toEqual([
            ['cheio', 3],
            ['meio', 1],
            ['vazio', 0],
        ]);
    });
});

describe('commenterRanking', () => {
    const comented = (reviews, comments) => ({ ...book(['X'], reviews), comments });

    // Um comentario por pessoa e por livro: varias linhas no mesmo texto
    // continuam a ser um livro comentado, nao dois.
    test('conta livros comentados e a fatia dos livros vistos', () => {
        const data = {
            a: comented({ A: 4, B: 4 }, { A: 'um\ndois', B: 'um' }),
            b: comented({ A: 4 }, { A: 'tres' }),
        };
        expect(commenterRanking(data)).toEqual([
            { name: 'A', count: 2, watched: 2, rate: 1 },
            { name: 'B', count: 1, watched: 1, rate: 1 }, // so viu o livro a
        ]);
    });

    test('comentario vazio ou so espacos nao conta', () => {
        const data = { a: comented({ A: 4, B: 4, C: 4 }, { A: 'ola', B: '', C: '   ' }) };
        expect(commenterRanking(data).map((c) => c.name)).toEqual(['A']);
    });

    test('quem nunca comentou fica de fora', () => {
        const data = { a: comented({ A: 4, Calado: 4 }, { A: 'ola' }) };
        expect(commenterRanking(data).map((c) => c.name)).toEqual(['A']);
    });
});

describe('decadeStats', () => {
    const fromYear = (year, reviews = { X: 4 }) => ({ ...book(['S'], reviews), year });

    test('agrupa por decada, da mais antiga para a mais recente', () => {
        const data = {
            a: fromYear(1994, { X: 5 }),
            b: fromYear(1999, { X: 3 }),
            c: fromYear(2001, { X: 4 }),
        };
        expect(decadeStats(data)).toEqual([
            { decade: 1990, count: 2, average: 4 },
            { decade: 2000, count: 1, average: 4 },
        ]);
    });

    test('decada sem nenhuma nota conta o livro mas fica sem media', () => {
        expect(decadeStats({ a: fromYear(1985, {}) })).toEqual([
            { decade: 1980, count: 1, average: null },
        ]);
    });
});

describe('pageStats', () => {
    const comPaginas = (pages, reviews = { X: 4 }) => ({ ...book(['S'], reviews), pages });

    test('agrupa por escalao, sempre pela ordem dos escaloes', () => {
        const data = {
            curto: comPaginas(199, { X: 5 }),
            medio: comPaginas(200, { X: 3 }),
            longo: comPaginas(900, { X: 1 }),
        };
        expect(pageStats(data)).toEqual([
            { label: '< 200 pág.', count: 1, average: 5 },
            { label: '200–300', count: 1, average: 3 },
            { label: '300–400', count: 0, average: null },
            { label: '400–500', count: 0, average: null },
            { label: '500+ pág.', count: 1, average: 1 },
        ]);
    });

    // O `max` e exclusivo: 200 paginas cai no escalao seguinte, nao no primeiro.
    test('a fronteira do escalao pertence ao escalao de cima', () => {
        const [primeiro, segundo] = pageStats({ a: comPaginas(200) });
        expect(primeiro.count).toBe(0);
        expect(segundo.count).toBe(1);
    });

    test('livro sem paginas nao entra em escalao nenhum', () => {
        const semPaginas = { ...book(['S'], { X: 4 }), pages: null };
        expect(pageStats({ a: semPaginas }).every((b) => b.count === 0)).toBe(true);
    });
});

describe('ownChoiceBias', () => {
    test('compara a nota do proprio com a media dos outros no mesmo livro', () => {
        // Da 5 onde os outros dao 3 -> +2, e 4 onde os outros dao 4 -> 0.
        const data = {
            a: book(['Eu'], { Eu: 5, A: 3, B: 3 }),
            b: book(['Eu'], { Eu: 4, A: 4, B: 4 }),
            c: book(['Eu'], { Eu: 2, A: 4, B: 4 }),
        };
        expect(ownChoiceBias(data, 3)).toEqual([{ name: 'Eu', average: 0, count: 3 }]);
    });

    test('a nota de quem co-escolheu fica de fora da media dos outros', () => {
        const data = {
            a: book(['Eu', 'Tu'], { Eu: 5, Tu: 5, Outro: 3 }),
            b: book(['Eu', 'Tu'], { Eu: 5, Tu: 5, Outro: 3 }),
            c: book(['Eu', 'Tu'], { Eu: 5, Tu: 5, Outro: 3 }),
        };
        // Se o Tu contasse como "outro", a diferenca do Eu era menor que 2.
        expect(ownChoiceBias(data, 3).map((x) => [x.name, x.average])).toEqual([
            ['Eu', 2],
            ['Tu', 2],
        ]);
    });

    test('o minimo por omissao e o MIN_OWN_CHOICES', () => {
        const uma = { a: book(['Eu'], { Eu: 5, A: 3 }) };
        expect(ownChoiceBias(uma)).toEqual([]); // 1 escolha nao chega
        expect(MIN_OWN_CHOICES).toBe(2);
    });

    test('escolha que so o proprio avaliou nao conta, e o minimo e respeitado', () => {
        const data = {
            a: book(['Eu'], { Eu: 5 }),           // ninguem mais avaliou
            b: book(['Eu'], { A: 3 }),            // escolheu mas nao avaliou
            c: book(['Eu'], { Eu: 5, A: 3 }),
        };
        expect(ownChoiceBias(data, 2)).toEqual([]);
        expect(ownChoiceBias(data, 1)).toEqual([{ name: 'Eu', average: 2, count: 1 }]);
    });
});

describe('ratersOfSuggester', () => {
    const data = {
        m1: book(['A'], { A: 5, B: 4, C: 1 }),
        m2: book(['A'], { A: 5, B: 4, C: 2 }),
        m3: book(['A'], { A: 5, B: 3, C: 3 }),
        m4: book(['A'], { B: 5 }),
    };

    // Quem escolhe nao pode aparecer como fa das proprias escolhas.
    test('exclui o proprio mesmo com notas que cheguem', () => {
        expect(ratersOfSuggester(data, 'A').map((r) => r.name)).not.toContain('A');
    });

    test('ordena do maior fa ao maior hater', () => {
        expect(ratersOfSuggester(data, 'A')).toEqual([
            { name: 'B', average: 4, count: 4 },
            { name: 'C', average: 2, count: 3 },
        ]);
    });

    // Sem minimo: com um corte a 3 a lista ficava vazia para quase todos os
    // membros, que e precisamente o que se quer evitar aqui.
    test('basta ter avaliado uma escolha para aparecer', () => {
        const poucos = { m1: book(['A'], { B: 4, D: 5 }), m2: book(['A'], { B: 4 }) };
        expect(ratersOfSuggester(poucos, 'A')).toEqual([
            { name: 'D', average: 5, count: 1 },
            { name: 'B', average: 4, count: 2 },
        ]);
    });

    test('quem nunca escolheu nada devolve lista vazia', () => {
        expect(ratersOfSuggester(data, 'C')).toEqual([]);
    });
});

describe('suggestersRatedBy', () => {
    const data = {
        m1: book(['A'], { A: 5, B: 2 }),
        m2: book(['A'], { A: 5, B: 2 }),
        m3: book(['A'], { A: 5, B: 2 }),
        m4: book(['B'], { B: 4 }),
    };

    // Decisao de produto: neste ranking a pessoa aparece a si propria, para se
    // ver como se avalia comparada com os outros. Nao "corrigir".
    test('inclui o proprio quando avaliou 3 ou mais escolhas dele', () => {
        expect(suggestersRatedBy(data, 'A')).toEqual([{ name: 'A', average: 5, count: 3 }]);
    });

    test('corta quem tem menos de 3 livros avaliados', () => {
        expect(suggestersRatedBy(data, 'B').map((s) => s.name)).toEqual(['A']);
    });

    test('ordena da melhor media para a pior', () => {
        const dois = {
            a1: book(['A'], { X: 5 }),
            a2: book(['A'], { X: 5 }),
            a3: book(['A'], { X: 5 }),
            b1: book(['B'], { X: 1 }),
            b2: book(['B'], { X: 1 }),
            b3: book(['B'], { X: 1 }),
        };
        expect(suggestersRatedBy(dois, 'X').map((s) => s.name)).toEqual(['A', 'B']);
    });
});

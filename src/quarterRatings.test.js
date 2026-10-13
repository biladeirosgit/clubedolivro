import { ratingDistribution, ratingBucket } from './utils/stats';
import { formatRating } from './utils/ratings';

// O Goodreads passou a deixar dar quartos de estrela (3.25, 3.75).
describe('quartos de estrela', () => {
    test('na distribuicao contam na meia estrela do meio', () => {
        expect(ratingBucket(3.25)).toBe(7);
        expect(ratingBucket(3.75)).toBe(7);
        expect(ratingBucket(0.25)).toBe(1);
        expect(ratingBucket(4.75)).toBe(9);
        expect(ratingBucket(4)).toBe(8);
        expect(ratingBucket(3.5)).toBe(7);
    });

    test('a distribuicao nao perde nenhuma nota', () => {
        const livros = { a: { reviews: { A: 3.25, B: 3.75, C: 3.5, D: 5 } } };
        expect(ratingDistribution(livros)).toEqual({ 7: 3, 10: 1 });
        expect(ratingDistribution(livros, 'B')).toEqual({ 7: 1 });
    });

    test('mostram-se com duas casas, as meias com uma', () => {
        expect(formatRating(3.75)).toBe('3.75');
        expect(formatRating(3.25)).toBe('3.25');
        expect(formatRating(3.5)).toBe('3.5');
        expect(formatRating(4)).toBe('4.0');
    });
});

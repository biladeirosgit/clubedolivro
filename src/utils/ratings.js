export const average = (reviews) => {
    const values = Object.values(reviews || {});
    if (values.length === 0) return null;
    return values.reduce((sum, rating) => sum + rating, 0) / values.length;
};

// A nota de uma pessoa, para mostrar: meias estrelas com uma casa (3.5) e
// quartos com duas (3.75), que o Goodreads passou a deixar dar.
export const formatRating = (rating) => {
    const value = Number(rating);
    return Number.isInteger(value * 2) ? value.toFixed(1) : value.toFixed(2);
};

export const averageFixed = (reviews, digits = 2) => {
    const avg = average(reviews);
    return avg === null ? '-' : avg.toFixed(digits);
};

export const variance = (reviews) => {
    const values = Object.values(reviews || {});
    if (values.length === 0) return null;
    const avg = average(reviews);
    return values.reduce((sum, r) => sum + (r - avg) ** 2, 0) / values.length;
};

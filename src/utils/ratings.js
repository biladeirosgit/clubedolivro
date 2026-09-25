export const average = (reviews) => {
    const values = Object.values(reviews || {});
    if (values.length === 0) return null;
    return values.reduce((sum, rating) => sum + rating, 0) / values.length;
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

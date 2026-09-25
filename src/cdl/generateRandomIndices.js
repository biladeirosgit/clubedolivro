const fs = require('fs');

const generateRandomValues = (numDays) => {
    const values = [];
    for (let i = 0; i < numDays; i++) {
        values.push(Math.random());
    }
    return values;
}

const numDays = 365; // Pode ser 366 para anos bissextos

const randomValues = generateRandomValues(numDays);

fs.writeFileSync('randomValues.json', JSON.stringify(randomValues, null, 2));

console.log('Arquivo randomValues.json gerado com sucesso!');

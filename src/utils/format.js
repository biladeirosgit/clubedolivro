let measureCanvas = null;

// Reduz o tamanho da fonte ate o texto caber em containerWidthPx, com um minimo de minFontSize.
export const fitFontSize = (text, containerWidthPx = 200, maxFontSize = 22, minFontSize = 5) => {
    if (!measureCanvas) measureCanvas = document.createElement('canvas');
    const context = measureCanvas.getContext('2d');
    let fontSize = maxFontSize;
    const measureWidth = (size) => {
        context.font = `${size}px Arial`;
        return context.measureText(text).width;
    };
    while (measureWidth(fontSize) > containerWidthPx && fontSize > minFontSize) {
        fontSize -= 0.5;
    }
    return Math.max(fontSize + 2, minFontSize);
};

export const joinWithAmpersand = (names) => (names && names.length ? names.join(' & ') : '');

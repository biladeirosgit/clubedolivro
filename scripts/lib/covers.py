"""Limpeza das capas descarregadas.

Algumas capas tem uma margem lisa (preta, branca, creme) a volta do desenho.
No catalogo, que e escuro, uma margem preta confunde-se com o fundo e a capa
parece mais pequena que o retangulo; uma branca parece um cartao a volta.
Aqui corta-se essa margem.

O corte so tira pixels da cor da margem, portanto nunca come conteudo. E so
acontece quando parece mesmo uma margem, e nao o fundo liso de uma capa (ex:
City on Fire, cinzenta):
- os quatro cantos tem a mesma cor;
- ha margem dessa cor nos QUATRO lados;
- nenhuma margem passa de MAX_MARGIN do lado respetivo.

Corre uma unica vez, logo a seguir ao download: correr outra vez sobre a capa
ja cortada podia comer molduras que fazem parte do desenho.
"""
from PIL import Image, ImageChops

CORNER_TOLERANCE = 30   # diferenca maxima entre cantos (0-255, por canal)
PIXEL_TOLERANCE = 40    # quanto um pixel se pode afastar da cor da margem
MIN_MARGIN = 0.005      # 0.5%: menos do que isto nao se ve
MAX_MARGIN = 0.07       # 7%: mais do que isto ja e o fundo da capa


def frame_box(image):
    """(left, top, right, bottom) da capa sem margem, ou None se nao houver
    margem para cortar."""
    rgb = image.convert("RGB")
    w, h = rgb.size
    corners = [rgb.getpixel(p) for p in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
    for channel in range(3):
        values = [c[channel] for c in corners]
        if max(values) - min(values) > CORNER_TOLERANCE:
            return None
    background = tuple(sorted(c[i] for c in corners)[1] for i in range(3))

    diff = ImageChops.difference(rgb, Image.new("RGB", rgb.size, background)).convert("L")
    mask = diff.point(lambda v: 255 if v > PIXEL_TOLERANCE else 0)
    box = mask.getbbox()
    if box is None:
        return None
    left, top, right, bottom = box
    margins = (left / w, top / h, (w - right) / w, (h - bottom) / h)
    if all(MIN_MARGIN <= m <= MAX_MARGIN for m in margins):
        return box
    return None


def trim_frame(path):
    """Corta a margem de uma capa em disco. True se cortou."""
    with Image.open(path) as image:
        box = frame_box(image)
        if box is None:
            return False
        trimmed = image.convert("RGB").crop(box)
    trimmed.save(path, quality=92)
    return True

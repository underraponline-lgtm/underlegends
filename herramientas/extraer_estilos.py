"""
EXTRAER EL ICONO DEL ROMBO — estilos de rap
============================================

Cada archivo es una tarjeta completa: numero arriba, rombo dorado con un
icono negro adentro, nombre y descripcion abajo. De todo eso solo sirve
**el icono negro de adentro del rombo**.

Por que no alcanza con "agarrar lo oscuro":
  el fondo de la tarjeta TAMBIEN es oscuro, y el texto tambien. Si se toma
  todo lo oscuro sale la tarjeta entera.

Como se resuelve:
  1. se detectan los pixeles DORADOS -> eso da el contorno del rombo, pero
     con agujeros donde esta el icono
  2. se rellenan los agujeros -> ahora el rombo es una figura maciza
  3. dentro de esa figura, lo OSCURO es el icono. Fuera, no se mira nada

Despues se normaliza igual que los logos de servidor: se recorta a la tinta
y el lienzo se calcula para que todos ocupen lo mismo dentro del circulo.
"""
import os as _osruta
RAIZ = _osruta.path.dirname(_osruta.path.abspath(__file__))
def _r(*p): return _osruta.path.join(RAIZ, *p)
import os
import numpy as np
from PIL import Image
from scipy import ndimage

TINTA_OBJETIVO = 0.30
MARGEN_MINIMO = 1.02
MARGEN_MAXIMO = 1.70


def _dorado(a):
    """Pixeles del rombo: dorados, o sea R alto, G medio, B bajo."""
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    return (r > 120) & (g > 80) & (b < 140) & (r > b + 55) & (r >= g)


def icono(ruta, salida):
    a = np.array(Image.open(ruta).convert('RGB')).astype(int)
    oro = _dorado(a)
    if oro.sum() < 500:
        raise ValueError('no encontre el rombo dorado en %s' % ruta)

    # el rombo puede venir en varios pedazos: se queda el mayor
    lab, n = ndimage.label(oro)
    if n > 1:
        tam = ndimage.sum(oro, lab, range(1, n + 1))
        oro = lab == (int(np.argmax(tam)) + 1)

    macizo = ndimage.binary_fill_holes(oro)          # el rombo entero
    lum = a.mean(axis=2)
    # El umbral NO puede ser fijo ni un porcentaje: hay tarjetas con el dorado
    # mas apagado (actitud tiene mediana 143 contra ~180 del resto) y cualquier
    # numero elegido a mano falla en alguna. Se usa Otsu SOLO sobre los pixeles
    # de adentro del rombo: ahi la distribucion es de dos jorobas, dorado e
    # icono, y Otsu encuentra el valle entre las dos.
    # NO se separa por brillo. Probe con umbral fijo, con porcentaje y con
    # Otsu, y ninguno anda en las 16: hay iconos macizos (el puño) y otros de
    # trazo fino (el brazo de actitud), y cada uno pide un corte distinto.
    # Lo que SI los separa siempre es el color: el rombo es dorado, o sea
    # cromatico, y el icono es negro o gris, o sea acromatico.
    # Entonces el icono es, literalmente, el rombo menos el dorado.
    r_, g_, b_ = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    crom = (r_.astype(float) - b_.astype(float)) > 30      # tiene color -> dorado
    ico = macizo & ~crom
    # el opening limpia puntitos, pero en las imagenes chicas se come los
    # trazos finos: 3x3 dejaba actitud en 148px de 206. Va de 2x2.
    ico = ndimage.binary_opening(ico, np.ones((2, 2)))

    if ico.sum() < 60:
        raise ValueError('el icono salio vacio en %s' % ruta)

    m = np.where(ico, 255.0, 0.0)
    ys, xs = np.where(m > 25)
    m = m[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    h, w = m.shape
    tinta = (m > 25).sum()
    lado = int(np.clip(np.sqrt(tinta / TINTA_OBJETIVO),
                       max(h, w) * MARGEN_MINIMO, max(h, w) * MARGEN_MAXIMO))
    L = np.zeros((lado, lado))
    oy, ox = (lado - h) // 2, (lado - w) // 2
    L[oy:oy + h, ox:ox + w] = m

    out = np.zeros((lado, lado, 4), dtype=np.uint8)
    out[:, :, :3] = 255
    out[:, :, 3] = L.astype(np.uint8)
    Image.fromarray(out, 'RGBA').resize((256, 256), Image.LANCZOS).save(salida)
    return 100.0 * (L > 25).mean(), w / max(h, 1)


if __name__ == '__main__':
    src = _r('estilos_src')
    # 🔴 ANTES ERA `_r('v2/estilos')`, O SEA `herramientas/v2/estilos`, QUE NO
    # EXISTE. Los 16 iconos los lee `02_Competitivo/v2/gencomp.py` de SU
    # carpeta (`_DIR/estilos`), asi que volver a extraerlos no llegaba a la
    # carta: el script decia que habia hecho su trabajo y los PNG quedaban en
    # una carpeta que no abre nadie.
    #
    # ⚠️ ES EL MISMO ERROR QUE `CLAUDE.md` YA DOCUMENTA DE `procesar_logos.py`
    # —«apuntaba a herramientas/logos_sv/, que no existe, asi que regenerar
    # las siluetas no llegaba a ninguna de las tres cartas»— en otro script de
    # la misma carpeta. No lo encontro nadie porque los 16 iconos YA estaban
    # en su lugar de una extraccion anterior: el bug solo se nota el dia que
    # se quiere cambiar uno.
    dst = os.path.join(os.path.dirname(RAIZ), '02_Competitivo', 'v2', 'estilos')
    print('%-14s %10s %8s' % ('estilo', 'proporcion', 'tinta'))
    print('-' * 36)
    for f in sorted(os.listdir(src)):
        if not f.endswith('.png'):
            continue
        nombre = f[:-4]
        try:
            t, p = icono(os.path.join(src, f), os.path.join(dst, nombre + '.png'))
            print('%-14s %10.2f %7.1f%%' % (nombre, p, t))
        except Exception as e:
            print('%-14s ERROR %s' % (nombre, e))

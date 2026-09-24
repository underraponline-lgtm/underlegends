"""Los logos de crew, listos para el circulo del pie de la Servidor.

⚠️ VAN CON SU COLOR, y esto corrige lo que yo habia hecho. Habia procesado
los ICONOS DE DISCORD —follombia_icon.png, blanco y negro— y salio una mano
blanca. Dlx: "esos son los logos correctos de follombia? que yo recuerde
tenia los colores de colombia". Tenia razon: el logo de verdad es la mano
rellena con la bandera —amarillo #FCD116, azul #003895, rojo #CE1126— y esos
archivos estaban en el repo, sin que nadie los leyera.

⚠️ Y EL DE KS TAMPOCO ERA EL COMPLETO: el icono suelto es la lechuza sola, y
la marca lleva ADEMAS DOS BARRAS, una de cada lado. Procesando el icono se
perdian y no habia como enterarse.

⚠️ SALEN SOLO CON TINTA, SIN FONDO, igual que los escudos de servidor. El
fondo lo pone la carta con el tono del servidor. Si el PNG trajera el suyo,
el circulo mostraria DOS colores: el del archivo adentro y el de la carta
afuera. Es la misma decision que ya esta escrita en CLAUDE.md para
comun/escudos_cuad/.

── LOS DOS MODOS ────────────────────────────────────────────────────────

⚠️ Y HACEN FALTA DOS PORQUE FOLLOMBIA NO SE PUEDE SEPARAR POR COLOR. Su
fondo es la bandera y la mano es LA MISMA BANDERA: amarillo contra amarillo,
azul contra azul. Lo unico que los separa es el DISCO NEGRO del medio.

    disco   la tinta vive ADENTRO de un disco oscuro. Se rellena el disco y
            se le resta lo oscuro; lo que queda es el dibujo.   (Follombia)
    claro   la tinta es lo que se despega de un fondo oscuro.   (KS)

⚠️ LAS MANCHITAS SE VAN, que en este proyecto ya costo caro: el archivo de
DRA traia una marca de agua en la esquina y, como el centrado es POR CAJA DE
TINTA, corria el dibujo entero 46 px sobre 512. Pero el umbral tiene que ser
BAJO: las barras de KS son el 8% de su tinta y son parte de la marca. A 2% se
salvan; subirlo a 15% las borraria y el logo quedaria incompleto sin avisar.

    python herramientas/logos_crew.py      ->  comun/logos_crew/*.png
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(BASE, 'herramientas', 'logos_originales')
SALIDA = os.path.join(BASE, 'comun', 'logos_crew')

# el nombre de la crew tal cual esta en datos/crews.json
FUENTES = {
    'Follombia': ('follombia_color.png', 'disco'),
    'KS': ('ks_color.png', 'claro'),
}

LADO = 512
OSCURO = 60         # debajo de esta luz se considera fondo o disco
MINIMO = .02        # un pedazo mas chico que esto es manchita, no dibujo
MARGEN = .05        # aire alrededor de la tinta, como fraccion del lado

# ⚠️ EL FILO OSCURO NO ES DECORACION: SIN EL, MEDIO LOGO DESAPARECE. El
# circulo de la crew se pinta con el tono del servidor, y ese tono no es
# oscuro en todos. Medido, el contraste de cada color del logo contra el
# fondo de su circulo:
#
#     rojo de la bandera   1.04 en URBF · 1.08 en TWR · 1.16 en EFA
#     azul de la bandera   1.12 en FTN  · 1.41 en TFC
#     gris de KS           1.27 en FRZ  · 1.45 en RZ
#
# Debajo de 1.5 el color se funde con el fondo. En TWR —que es carmesi— la
# franja roja de la mano se comia con el circulo y la mano quedaba sin su
# parte de abajo.
#
# Es exactamente lo que CLAUDE.md ya tiene anotado para las estrellas del
# Interserver: "llevan contorno y no solo sombra, porque el acento de DRA es
# blanco y contra blanco da 1.00:1". Misma causa, misma solucion.
#
# ⚠️ Y NO SE RESUELVE DEVOLVIENDOLE SU DISCO NEGRO, aunque el logo original
# lo tenga. Los otros cuatro circulos de la fila toman el tono de la carta;
# uno con fondo propio se leeria como un agujero. El filo separa sin romper
# la familia.
FILO = .030         # grosor del contorno, como fraccion del lado
FILO_COLOR = (10, 9, 14)


def tinta(p, modo):
    """(alfa booleano, rgb) del dibujo, sin fondo y sin manchitas."""
    im = Image.open(p).convert('RGB')
    a = np.array(im)
    luz = a.mean(axis=2)
    if modo == 'disco':
        # el disco es lo oscuro; rellenarlo da TODO su interior, dibujo
        # incluido, y restarle lo oscuro deja el dibujo solo
        disco = ndimage.binary_fill_holes(luz < OSCURO)
        m = disco & (luz >= OSCURO)
    else:
        m = luz >= OSCURO

    lab, n = ndimage.label(m)
    if n:
        tam = ndimage.sum(m, lab, range(1, n + 1))
        for k, t in enumerate(tam, 1):
            if t < tam.sum() * MINIMO:
                m[lab == k] = False
    return m, a


def normalizar(m, rgb):
    """Centra POR TINTA y no por caja: un dibujo con aire de un solo lado
    queda corrido si se centra la imagen entera."""
    ys, xs = np.where(m)
    if not len(ys):
        return None
    # ⚠️ SE RECORTA CON AIRE, no al ras: el filo se dibuja HACIA AFUERA y si
    # la caja termina justo en la tinta, el filo se corta contra el borde.
    g = int(LADO * FILO)
    y0 = max(0, ys.min() - g); y1 = min(m.shape[0], ys.max() + 1 + g)
    x0 = max(0, xs.min() - g); x1 = min(m.shape[1], xs.max() + 1 + g)
    col = rgb[y0:y1, x0:x1]
    alf = (m[y0:y1, x0:x1] * 255).astype(np.uint8)
    h, w = alf.shape
    util = LADO * (1 - 2 * MARGEN)
    f = util / max(h, w)
    nh, nw = max(1, int(h * f)), max(1, int(w * f))
    # el filo: se engorda la silueta y lo que sobra se pinta oscuro
    r = max(1, int(LADO * FILO * max(h, w) / util))
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]
    disco = (yy ** 2 + xx ** 2) <= r * r
    dent = alf > 128
    fuera = ndimage.binary_dilation(dent, disco) & ~dent
    col = col.copy()
    col[fuera] = FILO_COLOR
    alf = np.where(fuera, 255, alf).astype(np.uint8)
    ch = Image.fromarray(np.dstack([col, alf[:, :, None]]).astype(np.uint8),
                         'RGBA').resize((nw, nh), Image.LANCZOS)
    out = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    out.paste(ch, ((LADO - nw) // 2, (LADO - nh) // 2), ch)
    return out


def main():
    os.makedirs(SALIDA, exist_ok=True)
    for crew, (arch, modo) in FUENTES.items():
        p = os.path.join(ORIG, arch)
        if not os.path.exists(p):
            print('  falta %s' % arch)
            continue
        m, rgb = tinta(p, modo)
        im = normalizar(m, rgb)
        if im is None:
            print('  %s: no quedo tinta' % crew)
            continue
        im.save(os.path.join(SALIDA, crew + '.png'))
        lab, n = ndimage.label(m)
        ys, xs = np.where(m)
        print('  %-12s %-22s modo %-6s tinta %4.1f%% · %d pedazos · caja %dx%d'
              % (crew, arch, modo, 100 * m.mean(), n,
                 xs.max() - xs.min(), ys.max() - ys.min()))
    print()
    print('  ⚠️ Son 2 de 17 crews. El resto cae en las dos primeras letras,')
    print('     que es lo que hay hasta que existan los archivos.')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

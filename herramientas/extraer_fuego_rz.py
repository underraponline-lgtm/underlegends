"""Analizar el fuego DEL LOGO de RZ y extraerlo como textura.

Dlx: "analiza el logo mas, ahi puedes ver que hay como una estetica de
fuego". Tiene razon: el fuego que vale es el que ya trae la marca, no uno
generico. El simulado de generar_fuego.py da lenguas de fogata, y el del
logo es otra cosa —vetas, remolinos, humo encendido— asi que reproducirlo
por parecido no alcanza. Se extrae.

COMO SE SEPARA. El archivo tiene tres cosas y cada una se distingue por algo
distinto, no por umbral de brillo:

    fondo    casi negro         -> luminancia muy baja
    logo     lobo y letras      -> claro y DESATURADO (blanco)
    fuego    llamas azules      -> SATURADO y con el azul dominante

Asi que el fuego es lo cromatico: saturacion alta y b > r. El lobo, aunque
sea lo mas brillante, queda afuera por desaturado, y el fondo por oscuro.

⚠️ El alfa NO es la mascara binaria sino la INTENSIDAD del fuego. Si se usa
la mascara dura, el fuego pierde el degrade de su propio nucleo —que es lo
que lo hace ver caliente— y queda como una calcomania recortada.

    python herramientas/extraer_fuego_rz.py
        -> 03_Servidor/disenos/texturas/fuego_rz.png
"""
import os

import numpy as np
from PIL import Image, ImageFilter

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SRC = os.path.join(BASE, 'comun', 'logos_color', 'rz.png')
SAL = os.path.join(BASE, '03_Servidor', 'disenos', 'texturas', 'fuego_rz.png')

im = Image.open(SRC).convert('RGB')
a = np.array(im).astype(float)
r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
mx, mn = a.max(axis=2), a.min(axis=2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
lum = .2126 * r + .7152 * g + .0722 * b

fuego = (sat > .42) & (b > r + 18)
logo = (sat < .28) & (lum > 90)
fondo = lum < 12

# ⚠️ HAY QUE RESTAR EL LOGO DILATADO, no solo el logo. El lobo y las letras
# son blancos y quedan afuera por desaturados, pero su HALO azul si pasa el
# test de saturacion, asi que el contorno entero se colaba en la textura y
# el fuego salia con la silueta del logo dibujada adentro.
#
# ⚠️ Y ANTES DE DILATAR HAY QUE TIRAR LAS MANCHITAS. Dentro de las llamas
# hay chispas blancas sueltas que tambien son claras y desaturadas, o sea
# que entran a `logo`. Al dilatarlas, cada chispa de tres pixeles se vuelve
# un CUADRADO de 21x21 y el fuego queda agujereado. Solo el lobo y las
# letras son manchas grandes.
try:
    from scipy import ndimage
    et, n = ndimage.label(logo)
    if n:
        tam = ndimage.sum(logo, et, range(1, n + 1))
        grandes = [i + 1 for i, s in enumerate(tam) if s >= .02 * tam.max()]
        print('  (manchas en el logo: %d, quedan %d grandes)' % (n, len(grandes)))
        logo = np.isin(et, grandes)
except ImportError:
    pass

halo = np.array(Image.fromarray((logo * 255).astype(np.uint8))
                .filter(ImageFilter.MaxFilter(21))) > 127
fuego = fuego & ~halo
print('  (el halo del logo ocupa %.1f%% y se descuenta)' % (100 * halo.mean()))

print('DE QUE ESTA HECHO EL ARCHIVO')
for n, m in (('fondo casi negro', fondo), ('logo claro y desaturado', logo),
             ('fuego saturado azul', fuego)):
    print('  %-26s %5.1f%%' % (n, 100 * m.mean()))

print('\nLA RAMPA DEL FUEGO, de lo mas frio a lo mas caliente')
f = a[fuego]
fl = lum[fuego]
print('  %-14s %-9s %s' % ('percentil', 'color', 'luz'))
for p in (5, 25, 50, 75, 95, 99):
    u = np.percentile(fl, p)
    sel = f[(fl > u - 6) & (fl < u + 6)]
    if len(sel):
        c = sel.mean(axis=0).astype(int)
        print('  %-14s #%02X%02X%02X  %5.1f' % ('p%d' % p, *c, u))

print('\n  luz media del fuego   %.1f' % fl.mean())
print('  el fuego cubre        %.1f%% del cuadro' % (100 * fuego.mean()))

# ── la textura ──────────────────────────────────────────────────────────
# El alfa es la intensidad, no la mascara: conserva el degrade del nucleo.
inten = np.clip((lum - 10) / 145, 0, 1) * fuego
inten = np.array(Image.fromarray((inten * 255).astype(np.uint8))
                 .filter(ImageFilter.GaussianBlur(0.8))).astype(float) / 255

rgb = a.copy()
# donde el fuego es debil el color se va al azul profundo; donde es fuerte,
# al blanco. Es lo que hace el propio logo y hay que conservarlo.
rgb[inten < .04] = 0

out = np.dstack([rgb, (inten * 255)]).astype(np.uint8)
Image.fromarray(out, 'RGBA').save(SAL)
print('\n-> %s' % SAL)
print('   %dx%d  ·  %.1f%% con alfa util' % (*im.size, 100 * (inten > .04).mean()))

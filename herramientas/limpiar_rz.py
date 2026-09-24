"""Sacarle a rz.png la marca de agua del generador.

El archivo viene de KlingAI y trae "KlingAI 3.0" abajo a la derecha. Como el
escudo se arma de la caja de tinta, esa marca entra al cuadro y se ve en la
carta.

No se pinta de negro encima: en esa esquina hay fuego azul y taparlo dejaria
un rectangulo apagado. Se detectan los pixeles de la marca —claros y
DESATURADOS, contra un fondo que ahi es azul saturado o negro— y se
reemplazan por el promedio de su entorno, que reconstruye el fuego.

El original queda como rz_original.png. Si algun dia llega el logo sin marca,
se pisa rz.png y este script deja de hacer falta.
"""
import os

import numpy as np
from PIL import Image, ImageFilter

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SRC = os.path.join(BASE, 'comun', 'logos_color')
RZ = os.path.join(SRC, 'rz.png')
ORIG = os.path.join(SRC, 'rz_original.png')

im = Image.open(ORIG if os.path.exists(ORIG) else RZ).convert('RGBA')
if not os.path.exists(ORIG):
    im.save(ORIG)
    print('original guardado -> comun/logos_color/rz_original.png')

a = np.array(im).astype(float)
h, w = a.shape[:2]

# la esquina donde vive la marca, con aire de sobra
x0, y0 = int(w * 0.68), int(h * 0.86)
caja = a[y0:, x0:, :3]

mx = caja.max(axis=2)
mn = caja.min(axis=2)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
# la marca: clara y sin color. El fuego de ahi es azul y saturado.
marca = (mx > 90) & (sat < 0.34)

# se ensancha un poco para tomar el antialias del texto
m = Image.fromarray((marca * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))
marca = np.array(m) > 127

relleno = np.array(Image.fromarray(caja.astype(np.uint8))
                   .filter(ImageFilter.GaussianBlur(9))).astype(float)
caja[marca] = relleno[marca]
a[y0:, x0:, :3] = caja

print('pixeles de marca reemplazados: %d  (%.2f%% del archivo)'
      % (marca.sum(), 100 * marca.sum() / (h * w)))
Image.fromarray(a.astype(np.uint8)).save(RZ)
print('-> comun/logos_color/rz.png')

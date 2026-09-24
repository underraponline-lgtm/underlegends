"""Verificar el trazado de ref1 superponiendolo sobre la imagen original.

Trazar y quedarse con el numero no alcanza: si la tolerancia se come una
curva, el path igual "parece" bien en aislado. La unica forma de saberlo es
dibujarlo ENCIMA del original y mirar si se despega en algun lado.

Ademas mide el error: para cada fila, cuanto se separa el path del borde
real de la imagen. Ese numero decide la tolerancia, no el ojo.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
sys.path.insert(0, os.path.join(BASE, 'herramientas'))
from trazar_silueta import mascara, mayor_componente, envolvente, douglas_peucker

REF = os.path.join(BASE, '03_Servidor', 'referencia', 'ref1.png')
SAL = os.path.join(BASE, '03_Servidor', 'disenos', 'verificar_ref.png')

img = Image.open(REF)
m = mayor_componente(mascara(img)[0])
crudo = envolvente(m)

ys, xs = np.where(m)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
an, al = x1 - x0, y1 - y0

print('caja tinta : %dx%d   proporcion %.3f' % (an, al, an / al))
print()
print('%-6s %-8s %-9s %-9s' % ('tol', 'puntos', 'error med', 'error max'))

# El error se mide contra el contorno crudo: para cada punto del crudo,
# la distancia al segmento mas cercano del simplificado.
def error(simple, crudo):
    P = np.array(crudo)
    S = np.array(simple)
    A, B = S[:-1], S[1:]
    AB = B - A
    L2 = (AB ** 2).sum(1)
    L2[L2 == 0] = 1e-9
    d = np.empty(len(P))
    for i, p in enumerate(P):
        t = np.clip(((p - A) * AB).sum(1) / L2, 0, 1)
        proy = A + t[:, None] * AB
        d[i] = np.sqrt(((p - proy) ** 2).sum(1)).min()
    return d.mean(), d.max()

mejor = None
for tol in (3.0, 1.5, 0.8, 0.4, 0.2):
    s = douglas_peucker(crudo, tol)
    em, ex = error(s, crudo)
    print('%-6.1f %-8d %-9.2f %-9.2f' % (tol, len(s), em, ex))
    if tol == 0.8:
        mejor = s

# escala a 300 de ancho
esc = 300 / an
alto = round(al * esc)
d = 'M' + ' L'.join('%.1f,%.1f' % ((x - x0) * esc, (y - y0) * esc)
                    for x, y in mejor) + ' Z'
print()
print('viewBox 300 x %d  ·  %d puntos' % (alto, len(mejor)))
print(d)

# el overlay
vis = img.convert('RGB')
dr = ImageDraw.Draw(vis)
dr.line([tuple(p) for p in mejor] + [tuple(mejor[0])], fill=(255, 0, 128), width=3)
for p in mejor:
    dr.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=(0, 255, 200))
vis.save(SAL)
print('\n-> %s' % SAL)

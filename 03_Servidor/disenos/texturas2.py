"""Ocho texturas MAS, de familias distintas a la primera tanda.

La primera fue: concreto, spray, grietas, vetas, rayones, papel, trama, humo.
Esta suma materiales: tela, cuero, oxido, vidrio esmerilado, estatica,
craquelado, fibra y salpicadura.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

SCR = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(SCR, 'texturas')
os.makedirs(DST, exist_ok=True)
W, H = 600, 876
rng = np.random.default_rng(23)
yy, xx = np.mgrid[0:H, 0:W]


def ruido(escala, octavas=4, semilla=None):
    r = np.random.default_rng(semilla) if semilla is not None else rng
    out = np.zeros((H, W)); amp, s = 1.0, escala
    for _ in range(octavas):
        h, w = max(int(H/s), 2), max(int(W/s), 2)
        chico = r.random((h, w))
        capa = np.array(Image.fromarray((chico*255).astype(np.uint8))
                        .resize((W, H), Image.BICUBIC)) / 255.0
        out += capa*amp; amp *= 0.5; s /= 2
    return (out - out.min()) / (np.ptp(out) + 1e-9)


def guardar(n, a):
    Image.fromarray((np.clip(a, 0, 1)*255).astype(np.uint8), 'L') \
         .save(os.path.join(DST, n + '.png'))
    return n


print('generando la segunda tanda...')

# 9 · TELA: trama cruzada regular con irregularidad
urd = (np.sin(xx*1.35)*0.5+0.5)
tra = (np.sin(yy*1.35)*0.5+0.5)
guardar('tela', np.clip(urd*0.5 + tra*0.5 + ruido(24, 3)*0.18 - 0.1, 0, 1))

# 10 · CUERO: celdas irregulares tipo poro grande
cel = ruido(34, 2, 5)
cuero = np.abs(np.sin(cel*13.0)) ** 0.6
guardar('cuero', np.clip(cuero*0.8 + ruido(9, 3)*0.2, 0, 1))

# 11 · OXIDO: manchas comidas, bordes duros
ox = ruido(90, 5, 11)
oxido = np.clip((ox - 0.44)*3.4, 0, 1)
oxido = np.maximum(oxido, np.clip((ruido(26, 3, 12) - 0.62)*5, 0, 1)*0.7)
guardar('oxido', oxido)

# 12 · VIDRIO ESMERILADO: ruido muy fino y parejo
guardar('esmerilado', np.clip(ruido(5, 2, 21)*0.7 + 0.15, 0, 1))

# 13 · ESTATICA: ruido puro, sin suavizar
guardar('estatica', rng.random((H, W)))

# 14 · CRAQUELADO: celdas tipo voronoi, bordes marcados
pts = rng.random((46, 2)) * [W, H]
d1 = np.full((H, W), 1e9); d2 = np.full((H, W), 1e9)
for px, py in pts:
    d = (xx-px)**2 + (yy-py)**2
    nm = np.minimum(d1, d); d2 = np.minimum(d2, np.maximum(d1, d)); d1 = nm
borde = np.sqrt(d2) - np.sqrt(d1)
guardar('craquelado', np.clip(1 - borde/26.0, 0, 1))

# 15 · FIBRA DE CARBONO: tejido en diagonal
f = ((np.sin((xx+yy)*0.5) > 0).astype(float)*0.5 +
     (np.sin((xx-yy)*0.5) > 0).astype(float)*0.5)
guardar('fibra', np.clip(f*0.7 + ruido(7, 2, 31)*0.3, 0, 1))

# 16 · SALPICADURA: gotas de distinto tamano
sal = np.zeros((H, W))
for _ in range(150):
    cx, cy = rng.integers(0, W), rng.integers(0, H)
    r0 = rng.integers(2, 26)
    m = ((xx-cx)**2 + (yy-cy)**2) < r0*r0
    sal[m] = 1.0
sal = np.array(Image.fromarray((sal*255).astype(np.uint8))
               .filter(ImageFilter.GaussianBlur(1.4))) / 255.0
guardar('salpicadura', sal)

print('listo:', ', '.join(sorted(os.listdir(DST))))

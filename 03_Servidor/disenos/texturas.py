"""Texturas GENERADAS, no degrades de CSS.

El techo de todo lo anterior: eran gradientes. Geometria plana. Por eso todo
se sentia del mismo material, porque lo era.

Aca se generan texturas de verdad con numpy y se guardan como PNG para usar
de fondo. Concreto, spray, grietas, vetas, rayones, papel.
"""
import os
import numpy as np
from PIL import Image, ImageFilter

SCR = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(SCR, 'texturas')
os.makedirs(DST, exist_ok=True)
W, H = 600, 876          # el doble de la carta
rng = np.random.default_rng(7)


def ruido(escala, octavas=4):
    """Ruido tipo Perlin, sumando capas cada vez mas finas."""
    out = np.zeros((H, W))
    amp, s = 1.0, escala
    for _ in range(octavas):
        h, w = max(int(H/s), 2), max(int(W/s), 2)
        chico = rng.random((h, w))
        capa = np.array(Image.fromarray((chico*255).astype(np.uint8))
                        .resize((W, H), Image.BICUBIC)) / 255.0
        out += capa * amp
        amp *= 0.5; s /= 2
    # np.ptp(out) y no out.ptp(): el metodo se saco en numpy 2
    return (out - out.min()) / (np.ptp(out) + 1e-9)


def guardar(nombre, arr):
    a = np.clip(arr, 0, 1)
    im = Image.fromarray((a*255).astype(np.uint8), 'L')
    im.save(os.path.join(DST, nombre + '.png'))
    return nombre


print('generando texturas...')

# 1 · CONCRETO: ruido grueso + poros
c = ruido(60, 5)
poros = (rng.random((H, W)) > 0.9985).astype(float)
poros = np.array(Image.fromarray((poros*255).astype(np.uint8))
                 .filter(ImageFilter.GaussianBlur(1.2))) / 255.0
guardar('concreto', np.clip(c*0.8 + poros*0.9, 0, 1))

# 2 · SPRAY: puntos densos al centro de una diagonal, dispersos afuera
yy, xx = np.mgrid[0:H, 0:W]
d = np.abs((xx/W) - (yy/H) * 0.8 - 0.15)
prob = np.clip(1 - d*3.2, 0, 1) ** 2
sp = (rng.random((H, W)) < prob*0.16).astype(float)
sp = np.array(Image.fromarray((sp*255).astype(np.uint8))
              .filter(ImageFilter.GaussianBlur(0.7))) / 255.0
guardar('spray', np.clip(sp*2.2, 0, 1))

# 3 · GRIETAS: lineas quebradas que se ramifican
g = np.zeros((H, W))
for _ in range(9):
    x, y = rng.integers(0, W), rng.integers(0, H//3)
    ang = rng.uniform(1.1, 2.0)
    for _ in range(rng.integers(180, 420)):
        ang += rng.normal(0, 0.22)
        x += int(np.cos(ang)*3); y += int(np.sin(ang)*3)
        if not (0 <= x < W and 0 <= y < H): break
        g[max(y-1,0):y+2, max(x-1,0):x+2] = 1.0
g = np.array(Image.fromarray((g*255).astype(np.uint8))
             .filter(ImageFilter.GaussianBlur(0.6))) / 255.0
guardar('grietas', np.clip(g*1.6, 0, 1))

# 4 · VETAS DE MARMOL: ruido deformado en bandas
v = ruido(140, 5)
vetas = np.sin((xx*0.012 + v*9.0)) * 0.5 + 0.5
vetas = np.clip((vetas - 0.62) * 4.5, 0, 1)
guardar('vetas', vetas)

# 5 · RAYONES: trazos finos en una direccion
r = np.zeros((H, W))
for _ in range(260):
    x0, y0 = rng.integers(0, W), rng.integers(0, H)
    L = rng.integers(20, 190); a = rng.normal(-0.7, 0.16)
    for k in range(L):
        x = int(x0 + np.cos(a)*k); y = int(y0 + np.sin(a)*k)
        if 0 <= x < W and 0 <= y < H:
            r[y, x] = max(r[y, x], rng.uniform(.35, 1.0))
r = np.array(Image.fromarray((r*255).astype(np.uint8))
             .filter(ImageFilter.GaussianBlur(0.5))) / 255.0
guardar('rayones', r)

# 6 · PAPEL: fibra fina cruzada
p = ruido(18, 3)*0.5 + ruido(6, 2)*0.5
fibra = np.sin(yy*0.9 + ruido(30, 2)*7)*0.5 + 0.5
guardar('papel', np.clip(p*0.75 + fibra*0.25, 0, 1))

# 7 · TRAMA DE PUNTOS irregular
h = ((np.sin(xx*0.55)+1)*(np.sin(yy*0.55)+1))/4
h = np.clip((h - 0.45)*5 + ruido(40, 3)*0.4, 0, 1)
guardar('trama', h)

# 8 · NUBES / HUMO
guardar('humo', ruido(220, 6))

print('listo:', ', '.join(sorted(os.listdir(DST))))
print('-> texturas/  (mapas en escala de gris, para usar como capa)')

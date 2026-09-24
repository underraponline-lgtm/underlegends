"""Compara una silueta candidata contra las que ya tienen dueño.

⚠️ EXISTE PORQUE YO MIRE EN VEZ DE MEDIR. Dlx paso cuatro referencias de FIFA
para la carta de Pais y yo dije, mirandolas, que eran la misma forma que la
Competitiva. El dijo que no. Mirar dos siluetas parecidas y decidir si son "la
misma" es exactamente lo que este proyecto tiene prohibido: la regla que mas
tiempo ahorro fue medir, no mirar.

Asi que esto no opina. Rasteriza las dos al mismo alto y saca dos numeros:

    IoU          cuanto se solapan. 1.00 es identico.
    perfil       la diferencia de ANCHO fila por fila, en px sobre 300.

⚠️ EL IoU SOLO NO ALCANZA, y por eso van los dos. Dos escudos cualesquiera se
solapan mucho —son los dos un rectangulo con las esquinas comidas— asi que
IoU alto no quiere decir "iguales". El perfil dice DONDE difieren: si toda la
diferencia esta en las 40 filas de arriba, son la misma silueta con otro
remate; si esta repartida, son formas distintas.

    python 04_Pais/comparar_siluetas.py                 # todas las de referencia/
    python 04_Pais/comparar_siluetas.py --tol 1.5       # menos puntos en el path
"""
import argparse
import importlib.util as iu
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(BASE, '04_Pais', 'referencia')
sys.path.insert(0, BASE)

ALTO = 600          # a este alto se comparan todas
ANCHO = 460


def _mod(nombre, ruta):
    sp = iu.spec_from_file_location(nombre, ruta)
    m = iu.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


def rasterizar(d, w, h):
    """El path SVG a una mascara booleana de ALTO de alto, centrada."""
    import re
    pts = []
    for x, y in re.findall(r'(-?[\d.]+),(-?[\d.]+)', d):
        pts.append((float(x), float(y)))
    if not pts:
        return None
    f = ALTO / h
    im = Image.new('L', (ANCHO, ALTO), 0)
    ox = (ANCHO - w * f) / 2
    ImageDraw.Draw(im).polygon([(x * f + ox, y * f) for x, y in pts], fill=255)
    return np.array(im) > 127


def comparar(a, b):
    """(IoU, diferencia media de ancho, diferencia maxima, donde esta el peor)"""
    iou = (a & b).sum() / max(1, (a | b).sum())
    da, db = a.sum(axis=1), b.sum(axis=1)
    dif = np.abs(da - db) * 300.0 / ANCHO      # a px de una carta de 300
    peor = int(dif.argmax())
    return iou, dif.mean(), dif.max(), 100.0 * peor / ALTO


def _bisel(SIL):
    """El biselado esta escrito como polygon() en %, no como path en px."""
    import re
    w, h = SIL.BISELADO.w, SIL.BISELADO.h
    pts = re.findall(r'([\d.]+)%\s+([\d.]+)%', SIL.BISELADO.css)
    return 'M' + ' L'.join('%.1f,%.1f' % (float(x) * w / 100, float(y) * h / 100)
                           for x, y in pts) + ' Z'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tol', type=float, default=1.2)
    a = ap.parse_args()

    tz = _mod('tz', os.path.join(BASE, 'herramientas', 'trazar_silueta.py'))
    sh = _mod('sh', os.path.join(BASE, '02_Competitivo', 'v2', 'shield.py'))
    from comun import siluetas as SIL

    # ⚠️ EL BISELADO ENTRA A LA COMPARACION AUNQUE NO TENGA DUEÑO, porque es
    # el que estaba RESERVADO para Pais. Si la candidata se le parece mucho,
    # la pregunta deja de ser "cual elegimos" y pasa a ser "hace falta una
    # nueva o ya la teniamos".
    tienen = {'COMPETITIVA (escudo trazado)': (sh.OUT, 300, 485),
              'SERVIDOR (pico)': (SIL.PICO.d, 300, SIL.PICO.h),
              'BISELADO (reservado a Pais)': (_bisel(SIL), 300, 438)}

    arch = sorted(f for f in os.listdir(REF)
                  if f.lower().endswith(('.png', '.jpg', '.webp')))
    if not arch:
        print('  no hay imagenes en 04_Pais/referencia/ — ver su LEEME.md')
        return

    for f in arch:
        p = os.path.join(REF, f)
        img = Image.open(p)
        # ⚠️ mascara() devuelve (mascara, de_donde_salio). Quedarse con la
        # tupla entera revienta adentro de ndimage con un error que no dice
        # nada de esto.
        m, origen = tz.mascara(img)
        m = tz.mayor_componente(m)
        pts = tz.envolvente(m)
        ys, xs = np.where(m)
        w0, h0 = xs.max() - xs.min() + 1, ys.max() - ys.min() + 1
        sim = tz.douglas_peucker(pts, a.tol)
        alto = round(300 * h0 / w0)
        d = tz.a_path(sim, 300.0 / w0, xs.min(), ys.min())
        cand = rasterizar(d, 300, alto)
        print('  ── %s' % f)
        print('     %dx%d · %s · proporcion %.3f · viewBox 300x%d · %d puntos'
              % (w0, h0, origen, w0 / h0, alto, len(sim)))
        for nom, (dd, ww, hh) in tienen.items():
            otra = rasterizar(dd, ww, hh)
            iou, med, mx, donde = comparar(cand, otra)
            veredicto = ('MUY parecida' if iou > .96 else
                         'parecida' if iou > .90 else 'distinta')
            print('     vs %-28s IoU %.3f · ancho difiere %.1f px de media, '
                  '%.1f max (al %.0f%% del alto)  -> %s'
                  % (nom, iou, med, mx, donde, veredicto))
        # el path, para pegarlo en comun/siluetas.py
        salida = os.path.join(BASE, '04_Pais',
                              '_path_%s.txt' % os.path.splitext(f)[0])
        open(salida, 'w', encoding='utf-8').write(d)
        print('     path -> %s' % os.path.relpath(salida, BASE))
        print()


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

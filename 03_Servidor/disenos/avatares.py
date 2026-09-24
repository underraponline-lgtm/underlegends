"""Un avatar distinto por muestra, en vez del mismo en todas.

Dlx: "cada vez q muestres diferentes samples puedes tambien hacer para que
tenga diferentes imagenes el avatar". Tiene razon y no es cosmetico: con una
sola foto se juzga como queda LA CARTA CON ESA FOTO, no como queda el
diseño. Y las fotos de Discord varian muchisimo.

QUE HAY HOY
-----------
En disco hay UNA sola foto real: av_valen.png. El pool tiene 20 URLs, 15
distintas, y CLAUDE.md documenta que 6 de esas 20 ya dan 404 —Konan,
Jupiter, MCO, Provenza, Rayo y Vize— porque Discord invalida el hash cuando
la persona cambia su foto. Quedan unas 14 utiles, pero bajarlas es traer
archivos de afuera y eso lo decide Dlx, no yo.

Mientras tanto, esta rotacion mezcla la foto real con CASOS DE PRUEBA
generados. Y para elegir un diseño son incluso mejores que caras lindas,
porque aislan la variable:

    oscura     una foto casi negra hunde el numero si el velo no alcanza
    clara      una foto casi blanca se come el texto blanco
    contraste  mitad clara y mitad oscura parte el numero al medio
    ruidosa    una foto con mucho detalle pelea con las stats
    SIN FOTO   el caso de 118 de 138, que es el que mas importa

⚠️ El ultimo no es un caso de prueba: es LA MAYORIA. 118 de 138 no tienen
avatar, asi que cualquier hoja de muestras que no lo incluya esta mirando
la excepcion.
"""
import base64
import io
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCR = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(SCR, '_avatares')
LADO = 420


def _b64(im):
    b = io.BytesIO()
    im.convert('RGB').save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def _ruido(semilla, escala=6):
    r = np.random.default_rng(semilla)
    ch = r.random((LADO // escala + 2, LADO // escala + 2))
    im = Image.fromarray((ch * 255).astype(np.uint8)).resize(
        (LADO, LADO), Image.BICUBIC).filter(ImageFilter.GaussianBlur(2))
    return np.array(im).astype(float) / 255


def _prueba(clase, semilla):
    """Una imagen que estresa un caso concreto. No pretende ser una cara."""
    n = _ruido(semilla)
    if clase == 'oscura':
        v = n * 46 + 6
    elif clase == 'clara':
        v = n * 40 + 205
    elif clase == 'contraste':
        v = np.where(np.arange(LADO)[None, :] < LADO * .5, n * 40 + 12,
                     n * 40 + 200)
    else:                                   # ruidosa
        v = (_ruido(semilla, 2) * 210 + 22)
    a = np.dstack([v * 1.0, v * 0.97, v * 0.94]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(a)
    d = ImageDraw.Draw(im)
    d.ellipse([LADO*.30, LADO*.18, LADO*.70, LADO*.62],
              fill=(int(v.mean()*.7), int(v.mean()*.68), int(v.mean()*.66)))
    return im


def _reales():
    """Las fotos de verdad que haya en disco, con su nombre."""
    out = []
    if os.path.isdir(CACHE):
        for f in sorted(os.listdir(CACHE)):
            if f.lower().endswith(('.png', '.jpg', '.webp')):
                n = os.path.splitext(f)[0].replace('_', ' ').title()
                out.append((n, Image.open(os.path.join(CACHE, f))))
    # av_valen.png va AL FINAL de las reales y avisado: su URL ya da 404,
    # asi que este archivo es la unica copia que queda de esa foto. Sirve,
    # pero no representa a nadie que hoy se pueda volver a bajar.
    p = os.path.join(SCR, 'av_valen.png')
    if os.path.exists(p):
        out.append(('Valen (caído)', Image.open(p)))
    return out


_LISTA = None


def lista():
    """(etiqueta, dataURI o None). None significa SIN FOTO."""
    global _LISTA
    if _LISTA is None:
        L = [(e, _b64(im)) for e, im in _reales()]
        for clase, s in (('oscura', 3), ('clara', 11), ('contraste', 7),
                         ('ruidosa', 21)):
            L.append((clase, _b64(_prueba(clase, s))))
        L.append(('SIN FOTO', None))
        _LISTA = L
    return _LISTA


def para(i):
    """El avatar que le toca a la muestra i, rotando."""
    L = lista()
    return L[i % len(L)]


def cuantas():
    return len(lista())


if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    L = lista()
    n_real = len(_reales())
    print('AVATARES PARA LAS MUESTRAS')
    for e, d in L:
        print('   %-16s %s' % (e, 'sin imagen' if d is None
                               else '%d KB' % (len(d) // 1024)))
    print()
    print('   %d en rotacion  ·  %d reales, %d de prueba, 1 sin foto'
          % (cuantas(), n_real, cuantas() - n_real - 1))
    print()
    print('   Las reales van primero, asi que para(0..%d) son todas caras'
          % (n_real - 1))
    print('   de verdad. Despues vienen los casos que aislan una variable,')
    print('   y al final el SIN FOTO, que no es una prueba sino el caso')
    print('   de 118 de 138.')

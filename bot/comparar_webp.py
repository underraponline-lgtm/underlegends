"""¿ALGUNA CARTA PERDIO COLOR AL PASAR A WEBP? Las 1.793, una por una.

    python bot/comparar_webp.py            todas
    python bot/comparar_webp.py --muestra  una de cada diez

Dlx, 17/09/2026: «hay algunas tarjetas que se ven raras, o sea que les falta
algo de color».

⚠️ SE PUEDE CONTESTAR EXACTO PORQUE LOS DOS ARCHIVOS SIGUEN ARRIBA. Los PNG
viejos no se borraron todavia, asi que para cada carta hay un antes y un
despues del MISMO dibujo. No hay que adivinar si la conversion le hizo algo:
se resta.

QUE MIDE, Y POR QUE ESAS TRES COSAS
-----------------------------------
    dif        cuanto cambio cada pixel, de 0 a 255. Lo global.
    croma      la SATURACION media. Es literalmente «cuanto color tiene».
               Si una carta «perdio color», este numero baja.
    colores    cuantos tonos distintos hay. Un compresor con perdida los
               agrupa, y cuando agrupa de mas aparecen BANDAS en los degrades
               — que es como se ve «rara» una carta que estaba lisa.

⚠️ NINGUNO DE LOS TRES ALCANZA SOLO. Una carta oscura tiene poco croma y no le
falta nada; una carta plana tiene pocos colores y esta bien. Por eso lo que se
reporta es la CAIDA de cada uno contra su propio PNG, no el valor absoluto: la
carta se compara consigo misma.
"""
import concurrent.futures as cf
import io
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)


def medir(im):
    import numpy as np
    a = np.asarray(im.convert('RGBA'), dtype=np.int16)
    rgb, alfa = a[:, :, :3], a[:, :, 3]
    dentro = alfa > 128                      # sólo la carta, no el vacío
    if not dentro.any():
        return 0.0, 0
    p = rgb[dentro]
    croma = float((p.max(axis=1) - p.min(axis=1)).mean())
    colores = int(len(set(map(tuple, p[::37]))))   # muestreo: 1 de cada 37
    return croma, colores


def main():
    import numpy as np
    import requests
    from PIL import Image
    from subir_cartas import sesion, listar, PUBLICA

    s = sesion()
    claves = sorted(o['key'][:-5] for o in listar(s) if o['key'].endswith('.webp'))
    if '--muestra' in sys.argv:
        claves = claves[::10]
    print('\ncomparando %d carta(s): el PNG viejo contra la WEBP que se sirve\n'
          % len(claves))

    def una(k):
        try:
            a = requests.get('%s/%s.png' % (PUBLICA, k), timeout=60)
            b = requests.get('%s/%s.webp' % (PUBLICA, k), timeout=60)
            if a.status_code != 200 or b.status_code != 200:
                return k, None, 'HTTP %d/%d' % (a.status_code, b.status_code)
            p = Image.open(io.BytesIO(a.content)).convert('RGBA')
            w = Image.open(io.BytesIO(b.content)).convert('RGBA')
            if p.size != w.size:
                return k, None, 'tamaños %s vs %s' % (p.size, w.size)
            d = np.abs(np.asarray(p, dtype=np.int16)[:, :, :3]
                       - np.asarray(w, dtype=np.int16)[:, :, :3])
            cp, np_ = medir(p)
            cw, nw = medir(w)
            return k, (float(d.mean()), int(d.max()), cp, cw, np_, nw), None
        except Exception as e:
            return k, None, str(e)[:50]

    filas, rotas = [], []
    t0 = time.time()
    with cf.ThreadPoolExecutor(max_workers=12) as pool:
        for k, m, err in pool.map(una, claves):
            if err:
                rotas.append((k, err))
            else:
                filas.append((k,) + m)
            if (len(filas) + len(rotas)) % 200 == 0:
                print('   %d de %d...' % (len(filas) + len(rotas), len(claves)))

    print('\n  %d comparadas en %.1f min' % (len(filas), (time.time() - t0) / 60))
    if rotas:
        print('  ⚠️ %d no se pudieron comparar: %s' % (len(rotas), rotas[:3]))

    med = np.array([[f[1], f[2], f[3], f[4], f[5], f[6]] for f in filas], dtype=float)
    print('\n  diferencia media por pixel   %.2f de 255   (peor carta %.2f)'
          % (med[:, 0].mean(), med[:, 0].max()))
    caida = med[:, 2] - med[:, 3]                   # croma PNG - croma WEBP
    print('  caida de saturacion          %.3f de 255   (peor %.3f)'
          % (caida.mean(), caida.max()))
    perd = 100 * (1 - med[:, 5] / np.maximum(med[:, 4], 1))
    print('  tonos distintos que se van   %.1f%%   (peor %.1f%%)'
          % (perd.mean(), perd.max()))

    print('\n  LAS 12 QUE MAS CAMBIARON (por diferencia media):')
    print('     %-22s %6s %5s %8s %8s' % ('carta', 'dif', 'max', 'croma→', 'tonos'))
    for f in sorted(filas, key=lambda x: -x[1])[:12]:
        print('     %-22s %6.2f %5d  %5.1f→%-5.1f %5.1f%%'
              % (f[0], f[1], f[2], f[3], f[4],
                 100 * (1 - f[6] / max(f[5], 1))))

    print('\n  LAS 12 QUE MAS SATURACION PERDIERON:')
    for f in sorted(filas, key=lambda x: -(x[3] - x[4]))[:12]:
        print('     %-22s croma %5.1f -> %5.1f   (-%.2f)'
              % (f[0], f[3], f[4], f[3] - f[4]))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

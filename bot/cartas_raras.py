"""¿QUE CARTA SE SALE DE SU GRUPO? El outlier, no el absoluto.

    python bot/cartas_raras.py

Dlx: «hay algunas tarjetas que se ven raras, les falta algo de color».

⚠️ NO SE PUEDE BUSCAR «POCA SATURACION» A SECAS. Hay cartas oscuras que estan
bien y cartas planas que estan bien: un umbral fijo marcaria las de SR —que
lleva fondo negro a proposito— y dejaria pasar una de TFC que perdio su rojo.

Lo que si tiene sentido es comparar **cada carta contra sus hermanas**: las 138
de un mismo servidor comparten paleta por diseño, asi que la que se sale del
grupo es sospechosa. Es la misma idea que ya usa el proyecto para el umbral de
3 en los puestos — un numero solo no informa, informa contra su grupo.

Se mide sobre la webp que se sirve, que pesa 0,22 GB en total.
"""
import concurrent.futures as cf
import io
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)


def main():
    import numpy as np
    import requests
    from PIL import Image
    from subir_cartas import sesion, listar, PUBLICA

    s = sesion()
    claves = sorted(o['key'] for o in listar(s) if o['key'].endswith('.webp'))
    print('\nmidiendo %d cartas\n' % len(claves))

    def una(k):
        try:
            r = requests.get('%s/%s' % (PUBLICA, k), timeout=60)
            if r.status_code != 200:
                return k, None
            a = np.asarray(Image.open(io.BytesIO(r.content)).convert('RGBA'),
                           dtype=np.int16)
            dentro = a[:, :, 3] > 128
            if not dentro.any():
                return k, None
            p = a[:, :, :3][dentro]
            return k, (float((p.max(axis=1) - p.min(axis=1)).mean()),   # croma
                       float(p.mean()),                                 # brillo
                       float(p[:, 0].mean()), float(p[:, 1].mean()),
                       float(p[:, 2].mean()))
        except Exception:
            return k, None

    med = {}
    with cf.ThreadPoolExecutor(max_workers=12) as pool:
        for k, m in pool.map(una, claves):
            if m:
                med[k] = m
            if len(med) % 300 == 0:
                print('   %d...' % len(med))

    # agrupadas por tipo de carta: temporada, pais, sv-tfc, ...
    grupos = {}
    for k, m in med.items():
        quien, _, carta = k.rpartition('/')
        grupos.setdefault(carta[:-5], []).append((quien, m))

    print('\n  %-14s %4s %8s %8s   las que se salen' % ('grupo', 'n', 'croma', 'sd'))
    sospechosas = []
    for carta, filas in sorted(grupos.items()):
        cr = np.array([f[1][0] for f in filas])
        m, sd = cr.mean(), cr.std()
        # ⚠️ 3 desviaciones: se buscan las que ROMPEN el grupo, no las que
        # estan en un extremo. Con 138 por grupo, 2 sd marcaria ~6 por azar.
        fuera = [(q, c) for (q, (c, *_)) in filas if sd > 0.5 and abs(c - m) > 3 * sd]
        print('  %-14s %4d %8.1f %8.2f   %s'
              % (carta, len(filas), m, sd,
                 ', '.join('%s(%.0f)' % (q, c) for q, c in sorted(fuera)[:6]) or '—'))
        sospechosas += [('%s/%s' % (q, carta), c, m) for q, c in fuera]

    print('\n  %d carta(s) a mas de 3 desviaciones de su grupo' % len(sospechosas))
    for k, c, m in sorted(sospechosas, key=lambda x: -abs(x[1] - x[2]))[:15]:
        print('     %-26s croma %5.1f   su grupo %5.1f' % (k, c, m))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

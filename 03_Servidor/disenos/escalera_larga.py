"""CUANTOS ESCALONES DE TITULO SE PUEDEN LLENAR DE VERDAD.

Dlx quiere mas combinaciones en el TITULO —no en el TAG— acordandose de las
escaleras de roles con 20 y 40 escalones.

⚠️ Y ACA SI SE PUEDE, a diferencia del TAG, por una razon que conviene ver: el
titulo cuelga del OVR, que son PUNTOS en ese servidor. Los puntos son un
valor casi continuo. El TAG cuelga de logros —campeonatos, podios— que son
CONTADORES, y ahi 53 de 138 tienen cero: por eso una escalera larga de logros
se amontona en el primer escalon y una de puntos no.

Este script calcula el OVR real de las 138 con los puntos por servidor que ya
estan cacheados, y prueba escaleras de 5, 8, 10 y 12 escalones para ver
cuantos reciben gente.
"""
import json
import math
import os
import sys
from collections import Counter

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)

TOPE = 60.0         # el tope FIJO, ver ovr_que_mide.py
MIN_GENTE = 4       # un escalon con menos de esto no vale la pena


def ovr(pts):
    """La misma formula que la carta: 40 + raiz(pts/tope) * 59."""
    return round(40 + math.sqrt(min(pts / TOPE, 1)) * 59)


def cargar():
    p = os.path.join(SCR, '_pts_sv.json')
    if not os.path.exists(p):
        print('falta _pts_sv.json: correr ovr_que_mide.py primero')
        return None
    return json.load(open(p, encoding='utf-8'))


# ── las escaleras candidatas ─────────────────────────────────────────────
# ⚠️ LOS CORTES NO SON PAREJOS. Repartir el rango 48-99 en tramos iguales
# suena razonable y da mal: la gente NO esta repartida pareja, se amontona
# abajo. Los cortes salen de percentiles, asi que cada escalon agarra un
# pedazo parecido de gente.
ESCALERAS = {
    5: ['NOVATO', 'HABITUAL', 'VETERANO', 'MAESTRO', 'LEYENDA'],
    8: ['NOVATO', 'HABITUAL', 'CONSTANTE', 'VETERANO', 'REFERENTE',
        'MAESTRO', 'LEYENDA', 'MITO'],
    10: ['NOVATO', 'APRENDIZ', 'HABITUAL', 'CONSTANTE', 'VETERANO',
         'REFERENTE', 'MAESTRO', 'ELITE', 'LEYENDA', 'MITO'],
    12: ['NOVATO', 'APRENDIZ', 'HABITUAL', 'CONSTANTE', 'REGULAR',
         'VETERANO', 'REFERENTE', 'MAESTRO', 'ELITE', 'DOMINANTE',
         'LEYENDA', 'MITO'],
}


def cortes(vals, n):
    """Los umbrales de OVR que parten a la gente en n grupos parejos."""
    v = sorted(vals)
    out = []
    for i in range(1, n):
        out.append(v[int(len(v) * i / n)])
    return out


def main():
    d = cargar()
    if not d:
        return
    # el OVR de cada uno en SU servidor principal
    vals = [ovr(p['pts_sv'][p['sv']]) for p in d]
    vals = [v for v in vals]
    print('  el OVR real de las %d personas, con tope fijo %g:' % (len(vals), TOPE))
    sv = sorted(vals)
    for q in (0, 10, 25, 50, 75, 90, 100):
        print('     percentil %-3d %3d' % (q, sv[min(len(sv) - 1, q * len(sv) // 100)]))
    print()

    for n, nombres in ESCALERAS.items():
        cs = cortes(vals, n)
        # a que escalon cae cada uno
        def cual(v):
            for i, c in enumerate(cs):
                if v < c:
                    return i
            return n - 1
        cnt = Counter(cual(v) for v in vals)
        vacios = sum(1 for i in range(n) if cnt[i] < MIN_GENTE)
        print('  ── %d ESCALONES %s' % (n, '·' * (46 - len(str(n)))))
        ant = 0
        for i, nom in enumerate(nombres):
            desde = 0 if i == 0 else cs[i - 1]
            hasta = cs[i] - 1 if i < n - 1 else max(vals)
            g = cnt[i]
            marca = '  <- flaco' if g < MIN_GENTE else ''
            print('     %-10s OVR %2d-%2d  %3d personas (%2.0f%%)%s'
                  % (nom, desde, hasta, g, 100 * g / len(vals), marca))
        print('     escalones con menos de %d: %d de %d' % (MIN_GENTE, vacios, n))
        print()

    print("""  ⚠️ COMO LEER ESTO. Los cortes NO son parejos en OVR sino en GENTE:
     salen de percentiles. Repartir el rango 48-99 en tramos iguales suena
     razonable y da mal, porque la gente se amontona abajo — la mediana esta
     muy por debajo del medio del rango.

  ⚠️ Y HAY UN LIMITE QUE NO ES DE GENTE SINO DE OVR: cuando un escalon abarca
     UN SOLO valor de OVR, subir un punto te cambia el titulo. Eso se lee como
     inestable, no como progreso. Fijate en los tramos de arriba: con 12
     escalones ya hay varios de 1 o 2 puntos de ancho.""")


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

"""Dos preguntas de Dlx, contestadas con los datos y no con una opinion.

1. "Pon a la derecha el overall del tipo en el servidor... en que estamos
    midiendo? Tendriamos que crear un ranking separado por cada servidor no?"

2. "Que quizas la forma cambie dependiendo del rango... el SS creo que era
    color diamante no?"

La segunda parece decorativa y no lo es: si los ocho colores de rango se
distinguen bien entre si, la forma es adorno; si hay pares que se confunden,
la forma esta ARREGLANDO algo. Se mide, no se opina.
"""
import collections
import json
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
sys.path.insert(0, BASE)

# los 7 que tienen columna propia en el Sheet — sheet/construir_pool_temporada.py:38
CON_COLUMNA = ['TWR', 'TFC', 'SR', 'FTN', 'URBF', 'FRZ', 'DRA']
# los que la carta sabe dibujar
DIBUJABLES = ['TFC', 'SR', 'FFA', 'TWR', 'FTN', 'FRZ', 'URBF', 'DRA', 'EFA', 'RZ']

RANGO = {'SSS': '#C77DFF', 'SS': '#8FE8FF', 'S': '#FFD24A', 'A': '#FF6B7A',
         'B': '#5CE6A5', 'C': '#6B8FE8', 'D': '#D8DEE8', 'E': '#C98A4B'}
ORDEN = ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E']


def lab(hexc):
    """sRGB -> CIE Lab (D65). Sin dependencias: son veinte lineas."""
    h = hexc.lstrip('#')
    rgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    rgb = [(c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4)
           for c in rgb]
    r, g, b = rgb
    x = (.4124 * r + .3576 * g + .1805 * b) / .95047
    yy = (.2126 * r + .7152 * g + .0722 * b) / 1.0
    z = (.0193 * r + .1192 * g + .9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > .008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(yy), f(z)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def de(c1, c2):
    a, b = lab(c1), lab(c2)
    return sum((a[i] - b[i]) ** 2 for i in range(3)) ** .5


def main():
    pool = json.load(open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                          encoding='utf-8'))
    tmp = json.load(open(os.path.join(BASE, 'datos', 'temporada_pool.json'),
                         encoding='utf-8'))

    print('=' * 68)
    print('1. EL OVR EN EL SERVIDOR: QUE HAY Y QUE FALTA')
    print('=' * 68)
    print("""
El Sheet SI tiene un numero por servidor: son las 7 columnas de la hoja
Ranking Temporada. Pero construir_pool_temporada.py las lee SOLO para dos
cosas —de cual sos (el argmax) y en cuantos jugaste (el conteo)— y despues
TIRA LOS VALORES. Por eso ningun pool tiene los puntos por servidor.

   sheet/construir_pool_temporada.py:110   sv   = argmax de las 7
   sheet/construir_pool_temporada.py:120   srv  = cuantas > 0

O sea que el numero existe en la planilla y NO existe en datos/. Ponerlo en
la carta no es dibujar: es tocar el builder primero.
""")
    print('   servidores CON columna en el Sheet (%d): %s'
          % (len(CON_COLUMNA), ', '.join(CON_COLUMNA)))
    faltan = [s for s in DIBUJABLES if s not in CON_COLUMNA]
    print('   servidores que la carta DIBUJA        (%d): %s'
          % (len(DIBUJABLES), ', '.join(DIBUJABLES)))
    print()
    print('   ⚠️ SIN COLUMNA, o sea SIN NUMERO POSIBLE: %s' % ', '.join(faltan))

    d = collections.Counter(r['sv'] for r in pool)
    print('\n   gente por servidor en el pool de 138:')
    for s in DIBUJABLES:
        n = d.get(s, 0)
        marca = '   <- ni siquiera puede tener gente' if s in faltan else ''
        print('      %-5s %3d%s' % (s, n, marca))
    otros = {k: v for k, v in d.items() if k not in DIBUJABLES}
    if otros:
        print('      otros: %s' % otros)
    print("""
   ⚠️ Y no es solo que falte el numero: como `sv` sale del argmax de esas 7
   columnas, NADIE puede quedar asignado a los que no tienen columna. Esas
   cartas hoy no le tocan a ninguna persona.
""")
    print('   LAS TRES MANERAS DE DEFINIR EL OVR, y que rompe cada una:')
    print("""
   a) Renormalizar el SCORE dentro del servidor (el mejor del server = 100)
      · no toca el builder, sale del pool de hoy
      ⚠️ NO ES COMPARABLE ENTRE SERVIDORES: un 99 en un servidor de 5 y un
        99 en uno de 40 se dibujan igual y no valen lo mismo. Y choca con la
        regla del umbral de 3 que ya rige los circulos de abajo.

   b) Los PUNTOS DE ESE SERVIDOR, normalizados contra el maximo del pool
      · es de verdad "datos de ese servidor", que es lo que la carta dice
        que mide
      · comparable entre servidores
      ⚠️ hay que guardarlos en el builder, y quedan sin numero %s

   c) El Score global, sin mas
      ⚠️ ROMPE LA REGLA de que el numero de cada carta mide lo que esa carta
        mide: eso ya lo dice la Competitiva. Seria la misma carta dos veces.

   -> (b) es la unica que cumple la regla de la carta. Pero necesita el
      builder, asi que hoy va un valor de muestra y se marca como tal.
""" % ', '.join(faltan))

    print('=' * 68)
    print('2. LA FORMA POR RANGO: ¿ARREGLA ALGO O DECORA?')
    print('=' * 68)
    print("""
Si los ocho colores se distinguen entre si, la forma es adorno. Si hay pares
que se confunden, la forma esta arreglando algo real. Se mide con dE76 sobre
Lab. Referencia: dE < 10 = "parecidos"; dE < 5 = "cuesta separarlos".
""")
    pares = []
    for i, a in enumerate(ORDEN):
        for b in ORDEN[i + 1:]:
            pares.append((de(RANGO[a], RANGO[b]), a, b))
    pares.sort()
    print('   los 6 pares MAS PARECIDOS de los 28:')
    for v, a, b in pares[:6]:
        aviso = '  <- se confunden' if v < 20 else ''
        print('      %-4s vs %-4s   dE %5.1f%s' % (a, b, v, aviso))
    print('\n   el par mas lejano:  %s vs %s   dE %.1f'
          % (pares[-1][1], pares[-1][2], pares[-1][0]))
    n_cerca = sum(1 for v, _, _ in pares if v < 20)
    print('\n   pares por debajo de dE 20: %d de %d' % (n_cerca, len(pares)))

    # y en escala de grises, que es como se lee de lejos o en miniatura
    print('\n   ⚠️ Y EN CLARO/OSCURO, que es como se lee en miniatura:')
    ls = sorted((lab(RANGO[r])[0], r) for r in ORDEN)
    for L, r in ls:
        print('      %-4s  L* %5.1f' % (r, L))
    cerca_L = [(abs(ls[i][0] - ls[i + 1][0]), ls[i][1], ls[i + 1][1])
               for i in range(len(ls) - 1)]
    cerca_L.sort()
    print('\n   los tres pares mas juntos en luz:')
    for v, a, b in cerca_L[:3]:
        print('      %-4s vs %-4s   %.1f de L*' % (a, b, v))

    print("""
   -> Cuantos mas pares queden por debajo de dE 20, mas gana la forma. La
      forma se lee sin color: sobrevive al fondo de Discord, a la miniatura
      y al daltonismo. El color solo, no.
""")

    print('=' * 68)
    print('3. CUANTOS HAY DE CADA RANGO (Dlx: "hay menos y mas de E a A")')
    print('=' * 68)
    r = collections.Counter(x['rango'] for x in pool)
    tot = sum(r.values())
    print()
    for k in ORDEN:
        n = r.get(k, 0)
        print('   %-4s %3d  %5.1f%%  %s' % (k, n, 100 * n / tot, '█' * n))
    print("""
   ⚠️ La forma tiene que aguantar esa forma de campana: los rangos donde hay
   MUCHA gente son los que mas se van a ver, asi que sus figuras son las que
   tienen que distinguirse mejor entre si. Las de arriba se ven poco pero
   son las que tienen que verse ESPECIALES.
""")


if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    main()

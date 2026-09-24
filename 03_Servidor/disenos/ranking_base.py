"""¿En que se basaria un ranking por servidor: en el competitivo o en la temporada?

Dlx: "tendriamos que crear un ranking separado... en que se basaria? en el
competitivo? en la temporada?".

QUE MIDE CADA UNO, y no es lo mismo:

    TEMPORADA     ACUMULACION. PTS 36% y EVT 20%: premia CUANTO hiciste.
                  Mas eventos = mas puntos. Un numero que sube con el uso.
    COMPETITIVO   CALIDAD. Score = 5 dimensiones normalizadas por evento, y
                  encima multiplicado por la Confianza. Premia QUE TAN BIEN,
                  no cuanto.

Ya esta escrito en CLAUDE.md: el color dice "que hiciste esta temporada" y
la letra dice "quien sos".


⚠️ EL DATO QUE DECIDE ES EL TAMAÑO DE LA MUESTRA
------------------------------------------------
La Confianza del competitivo existe justamente porque un promedio con pocos
eventos no es confiable: arranca en 0.80 y recien llega a 1.00 a los 20
eventos. O sea que el propio sistema ya declara que POR DEBAJO DE 20 EVENTOS
LA CALIDAD NO SE PUEDE MEDIR BIEN.

Y un ranking POR SERVIDOR parte esos eventos entre los servidores donde cada
uno juega. Este script mide cuantos eventos le quedarian a cada uno EN SU
SERVIDOR, y cuantos llegarian a los umbrales.

⚠️ Es una ESTIMACION y hay que decirlo: se reparte `ev` entre los `srv`
servidores donde tiene puntos, porque el reparto real no esta en ningun
pool. Sirve para ver el ORDEN DE MAGNITUD, que es lo que decide esto. Si da
holgado, la estimacion no importa; si da justo, tampoco alcanzaria el dato
real.
"""
import collections
import json
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
sys.path.insert(0, BASE)

MIN_CARTA = 8        # el corte que desbloquea la carta
MIN_CONF = 20        # donde la Confianza llega a 1.00


def main():
    comp = json.load(open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                          encoding='utf-8'))
    temp = json.load(open(os.path.join(BASE, 'datos', 'temporada_pool.json'),
                          encoding='utf-8'))
    srv = {t['raw'].lower(): t.get('srv', 1) for t in temp}

    print('=' * 70)
    print('EN QUE SE BASARIA: LO QUE MIDE CADA UNO')
    print('=' * 70)
    print("""
   TEMPORADA     ACUMULACION.  PTS 36% · EVT 20% · WR 16% · POD 16% · CAZ 12%
                 Premia CUANTO hiciste. Sube con el uso.
   COMPETITIVO   CALIDAD.  5 dimensiones normalizadas por evento, por la
                 Confianza. Premia QUE TAN BIEN, no cuanto.
""")

    print('=' * 70)
    print('EL DATO QUE DECIDE: CUANTOS EVENTOS QUEDAN POR SERVIDOR')
    print('=' * 70)
    ev = sorted(p['ev'] for p in comp)
    n = len(ev)
    print('\n   eventos TOTALES de las %d personas del pool:' % n)
    for q, e in ((10, ev[n // 10]), (25, ev[n // 4]), (50, ev[n // 2]),
                 (75, ev[3 * n // 4]), (90, ev[9 * n // 10])):
        print('      percentil %-3d %4d eventos' % (q, e))
    print('      maximo       %4d' % ev[-1])

    d = collections.Counter(srv.get(p['raw'].lower(), 1) for p in comp)
    print('\n   en cuantos servidores juega cada uno:')
    for k in sorted(d):
        print('      %d servidor%-2s %3d personas  %s'
              % (k, 'es' if k > 1 else '', d[k], '#' * (d[k] // 2)))
    med = sum(srv.get(p['raw'].lower(), 1) for p in comp) / n
    print('      promedio %.2f servidores por persona' % med)

    est = sorted(p['ev'] / max(srv.get(p['raw'].lower(), 1), 1) for p in comp)
    print('\n   eventos ESTIMADOS por servidor (ev repartido entre sus srv):')
    for q, e in ((10, est[n // 10]), (25, est[n // 4]), (50, est[n // 2]),
                 (75, est[3 * n // 4]), (90, est[9 * n // 10])):
        print('      percentil %-3d %6.1f' % (q, e))
    print('      maximo       %6.1f' % est[-1])

    c8 = sum(1 for x in est if x >= MIN_CARTA)
    c20 = sum(1 for x in est if x >= MIN_CONF)
    print('\n   llegan a %d eventos EN SU SERVIDOR:  %3d de %d  (%.0f%%)'
          % (MIN_CARTA, c8, n, 100 * c8 / n))
    print('   llegan a %d eventos EN SU SERVIDOR:  %3d de %d  (%.0f%%)'
          % (MIN_CONF, c20, n, 100 * c20 / n))

    print("""
   ⚠️ ESE SEGUNDO NUMERO ES LA RESPUESTA. La Confianza del competitivo
   declara que por debajo de 20 eventos la CALIDAD no se puede medir bien.
   Si casi nadie llega a 20 dentro de su servidor, un ranking por servidor
   basado en calidad estaria midiendo ruido y presentandolo como nota.

   La ACUMULACION no tiene ese problema: sumar puntos y eventos es exacto
   con cualquier cantidad. Diez eventos son diez eventos.
""")

    print('=' * 70)
    print('LO QUE PROPONGO')
    print('=' * 70)
    print("""
   EL RANKING POR SERVIDOR SE BASA EN ACUMULACION, como la Temporada.
   No porque sea mejor, sino porque es lo unico que aguanta la muestra que
   hay adentro de un servidor.

   Y ademas encaja con lo que la carta ya dice:

     Temporada     acumulacion GLOBAL      "que hiciste esta temporada"
     Competitivo   calidad GLOBAL          "quien sos"
     Servidor      acumulacion EN UN SV    "que hiciste aca"

   Las tres cartas quedan cubriendo tres casillas distintas y ninguna repite
   a otra. Si la Servidor se basara en calidad, seria el Competitivo con
   menos datos: la misma pregunta, peor contestada.

   ⚠️ PERO EL RANKING DA PUESTO, NO NOTA. Un puesto —"3o de 24"— es honesto
   con cualquier muestra y ya tiene la regla del umbral de 3. Una nota
   normalizada contra el mejor del servidor le da 99 al mejor de DRA, que
   tiene Score 26.2. El puesto se puede calcular por servidor; la NOTA de la
   columna se sigue normalizando GLOBAL.

   ⚠️ Y HAY QUE DECIDIR ANTES DE CONSTRUIRLO: si los eventos de un servidor
   cuentan tambien para el ranking global. Si cuentan dos veces, el servidor
   que mas eventos organiza infla a los suyos en la Liga entera. Yo los
   contaria una sola vez —el global sigue siendo el global— y el ranking por
   servidor es una VISTA de los mismos eventos, filtrada por donde pasaron.
   Asi no hay dos verdades que puedan discrepar.
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

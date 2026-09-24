"""Que mide el OVR en cada carta, y que deberia medir en la Servidor.

Dlx: "que es lo que mide el overall en el numero, en cada tarjeta? y como lo
hace? ... estaba pensando en crear un ranking para cada servidor que tenga
nuestro bot metido".


LO QUE YA EXISTE, leido del codigo y no de memoria
--------------------------------------------------

TEMPORADA — se calcula aca, en sheet/construir_pool_temporada.py:126-132

    componentes   PTS 36% · EVT 20% · WR 16% · POD 16% · CAZ 12%
    normaliza     cada uno contra EL MAXIMO DEL POOL
    comprime      raiz cuadrada en PTS, EVT y POD; lineal en WR y CAZ
    escala        ovr = 40 + suma_ponderada * 59      -> queda en 40..99

    ⚠️ La raiz no es adorno: sin ella, el que tiene el doble de puntos saca
    el doble de nota, y en un pool donde el primero tiene 300K y la mediana
    30K eso aplasta a todos contra el piso. La raiz reparte el rango.

COMPETITIVO — NO se calcula: viene hecho del Sheet, columna Score, y ya
viene multiplicado por la Confianza, que sube de 0.80 a 1.00 recien a los 20
eventos.

    ⚠️ O sea que las dos cartas no comparten metodo. La Temporada normaliza
    contra su pool; el Competitivo trae un numero absoluto de afuera.


LA PREGUNTA DE LA SERVIDOR
--------------------------
La regla del proyecto dice que el numero de cada carta mide lo que esa carta
mide, y la Servidor mide "datos de ese servidor". Hay dos definiciones
posibles y NO son la misma pregunta:

    DENTRO   normalizar contra el mejor DE TU SERVIDOR
             -> dice cuanto valés entre tus compañeros
    GLOBAL   normalizar contra el mejor DE TODA LA LIGA
             -> dice cuanto valés comparado con cualquiera

⚠️ Y HAY UNA TENSION QUE NO SE PUEDE ESQUIVAR ELIGIENDO BIEN: son dos
preguntas distintas y la carta tiene un solo numero grande. Este script mide
cuanto se deforman los numeros con cada una, sobre la gente real.

⚠️ Se usa el SCORE como sustituto del dato verdadero, porque los puntos por
servidor no estan en ningun pool todavia. No es el numero final: es para ver
LA FORMA de cada normalizacion, que es lo que hay que decidir ahora.
"""
import collections
import json
import math
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
sys.path.insert(0, BASE)

PESOS = [0.36, 0.20, 0.16, 0.16, 0.12]      # PTS EVT WR POD CAZ
MIN_GRUPO = 3        # el umbral que ya rige los circulos de abajo


def escala(x, tope):
    """La misma forma que usa la Temporada: raiz, y despues 40..99."""
    return round(40 + math.sqrt(max(x, 0) / max(tope, 1e-9)) * 59)


def main():
    pool = json.load(open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                          encoding='utf-8'))
    por_sv = collections.defaultdict(list)
    for p in pool:
        por_sv[p['sv']].append(p)

    print('=' * 70)
    print('1. QUE MIDE EL OVR EN CADA CARTA, HOY')
    print('=' * 70)
    print("""
   TEMPORADA   se calcula en sheet/construir_pool_temporada.py:126

       PTS 36% · EVT 20% · WR 16% · POD 16% · CAZ 12%
       cada componente contra EL MAXIMO DEL POOL
       raiz cuadrada en PTS, EVT y POD (los que tienen cola larga)
       ovr = 40 + suma * 59   ->  queda entre 40 y 99

       La raiz no es adorno: el primero tiene 10x los puntos de la mediana,
       y sin comprimir todos quedan aplastados contra el piso.

   COMPETITIVO no se calcula: viene del Sheet, columna Score, ya
       multiplicado por la Confianza (0.80 a 1.00, llega a 1.00 a los 20
       eventos). Es un numero ABSOLUTO, no relativo al pool.

   ⚠️ Las dos cartas NO comparten metodo, y eso ya es una decision tomada:
   una normaliza contra su pool y la otra trae un absoluto de afuera.
""")

    print('=' * 70)
    print('2. LAS DOS DEFINICIONES POSIBLES, SOBRE LA GENTE REAL')
    print('=' * 70)
    tope_global = max(p['score'] for p in pool)
    print('\n   el mejor Score de las 138 es %.1f\n' % tope_global)
    print('   %-6s %3s %-10s %6s %8s %8s   %s'
          % ('sv', 'n', 'el mejor', 'score', 'DENTRO', 'GLOBAL', 'que pasa'))
    print('   ' + '-' * 76)
    for sv, gente in sorted(por_sv.items(), key=lambda kv: -len(kv[1])):
        gente = sorted(gente, key=lambda p: -p['score'])
        top = gente[0]
        tope_sv = top['score']
        dentro = escala(tope_sv, tope_sv)
        glob = escala(tope_sv, tope_global)
        if len(gente) < MIN_GRUPO:
            nota = 'MENOS DE %d: no hay ranking' % MIN_GRUPO
        elif dentro - glob > 15:
            nota = 'se infla %+d' % (dentro - glob)
        else:
            nota = ''
        print('   %-6s %3d %-10s %6.1f %8d %8d   %s'
              % (sv, len(gente), top['raw'][:10], tope_sv, dentro, glob, nota))

    print("""
   ⚠️ LA COLUMNA "DENTRO" LE DA 99 AL MEJOR DE CADA SERVIDOR, sea quien
   sea. El mejor de DRA y el mejor de TFC sacan el mismo numero, y no
   significan lo mismo. Es exactamente lo que el proyecto ya decidio que no
   vale, con el umbral de 3 de los circulos de abajo: ser "1 de 1" no dice
   nada.
""")

    # cuanta gente quedaria sin numero con cada regla
    chicos = [sv for sv, g in por_sv.items() if len(g) < MIN_GRUPO]
    n_chicos = sum(len(por_sv[s]) for s in chicos)
    print('   con el umbral de %d, quedan sin ranking %d servidores y %d '
          'personas' % (MIN_GRUPO, len(chicos), n_chicos))
    print('   (%s)' % ', '.join('%s %d' % (s, len(por_sv[s])) for s in chicos))

    print('\n' + '=' * 70)
    print('3. LA IDEA DEL RANKING POR SERVIDOR, Y QUE HABILITA')
    print('=' * 70)
    print("""
   Dlx: "estaba pensando en crear un ranking para cada servidor que tenga
   nuestro bot metido".

   ⚠️ ESO ARREGLA UN PROBLEMA QUE HOY NO TIENE ARREGLO. El Sheet solo tiene
   columna para 7 servidores; FFA, EFA y RZ no la tienen, y como `sv` sale
   del argmax de esas 7, HOY NADIE PUEDE QUEDAR ASIGNADO a esos tres. Sus
   cartas no le tocan a ninguna persona. Un ranking que lo arme el bot en
   cada servidor no depende de que la planilla tenga esa columna.

   ⚠️ PERO NO ES UNA FUNCION DEL BOT, ES UN PIPELINE NUEVO. Segun
   CLAUDE.bot.md, el Worker NO lee el Sheet y tiene 10 ms de CPU por
   request: lee datos ya masticados en KV o D1. Un ranking por servidor hay
   que CALCULARLO en algun lado y dejarlo escrito ahi. El bot lo muestra, no
   lo hace.

   ⚠️ Y ABRE UNA PREGUNTA QUE HOY NO EXISTE: si cada servidor tiene su
   ranking propio, ¿los eventos de ese servidor cuentan tambien para el
   ranking global? Si cuentan dos veces, un servidor con muchos eventos
   propios infla a los suyos en la Liga. Si no cuentan, el ranking global
   deja de ver la mitad de lo que pasa.
""")

    print('=' * 70)
    print('4. LO QUE PROPONGO')
    print('=' * 70)
    print("""
   DOS NUMEROS QUE YA TIENEN LUGAR, cada uno contestando una pregunta:

     la COLUMNA (derecha)   OVR del servidor, normalizado GLOBAL
                            "cuanto hiciste en este servidor", comparable
                            entre servidores
     la FIGURA (pie)        el rango competitivo, que YA es global y ya es
                            uno solo por persona en las tres cartas

   Asi la columna dice DONDE jugaste y cuanto rendiste ahi, y la figura dice
   QUIEN SOS en la Liga entera. No se pisan.

   ⚠️ Y por que GLOBAL y no DENTRO: porque la carta se manda a Discord y cae
   sola. Nadie la ve al lado de otra del mismo servidor —que es cuando
   "dentro" tendria sentido—; la ve alguien que tiene la suya de otro
   servidor al lado. Un 99 que significa cosas distintas segun de donde sea
   se rompe justo en el uso que le vamos a dar.

   ⚠️ Lo que SI se puede sumar sin romper nada es el PUESTO dentro del
   servidor, que ya existe (pos_sv, 135 de 138) y que ya respeta el umbral
   de 3. El puesto es explicitamente relativo —"3o de 24"— asi que nadie lo
   confunde con una nota.

   PRIMER PASO, y no es diseño: guardar los puntos por servidor en
   sheet/construir_pool_temporada.py. Hoy los lee y los tira (lineas 110 y
   120). Sin eso, cualquiera de las dos definiciones es teorica.
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

# -*- coding: utf-8 -*-
"""PONE EL `Config` DEL SHEET AL DIA CON LA T1.

    python sheet/config_t1.py            dice que cambiaria, NO escribe
    python sheet/config_t1.py --aplicar  lo escribe

QUE HACE, Y POR QUE CADA COSA
------------------------------
1. 🔴 **LOS RANGOS PASAN DE SEIS A OCHO.** `Config!T4:W11` tiene
   `S 65 · A 47 · B 36 · C 23 · D 17 · E`, que es la definicion vieja. Las
   cartas usan ocho desde `comun/rangos.py`, y sobre la pre-temporada eso
   daba **26 de 138 con una letra distinta en el Sheet que en su carta**.

   ⚠️ Los umbrales NO se escriben aca: se leen de `comun/rangos.py`. Es la
   regla que este repo se comio tres veces en un dia —la decision en un
   lugar y el codigo leyendo otra cosa— y un config que copia numeros es
   exactamente eso.

2. **Se agregan tres bloques que no estan y las tarjetas necesitan**: los
   pesos de las cinco dimensiones, los requisitos por carta y la rampa de
   confianza. Salen de `comun/requisitos.py` y de la guia, no de aca.

LO QUE NO TOCA, Y ES LO IMPORTANTE
-----------------------------------
🔴 **EL MOTOR LEE `Config` EN RANGOS FIJOS.** `leerTablaPuntos` toma
`A7:B14` y `C7:D12`; `leerModificadores` toma `G7`, `G8`, `G12`;
`procesarEvento` toma `B27`. **Pisar o correr cualquiera de esas celdas lo
rompe sin avisar** — no falla, calcula mal.

Por eso esto **no inserta ni borra filas**: mover una fila corre `G12` y el
walk-in pasa a leer otra cosa. Solo escribe en celdas de las columnas T-W,
que no las lee ningun codigo, y en filas vacias de abajo.

⚠️ **Y PARA QUE ENTREN OCHO DONDE HABIA SEIS, SE MUEVE EL BLOQUE DE LIGAS.**
Los ocho tramos mas la cabecera necesitan nueve filas (T5:W13) y ahi vive
`⚽ SISTEMA LIGAS`. Se lo copia a T22 —zona libre— antes de escribir. Es la
unica manera de no insertar filas.
"""
import os
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from explorar_operativo import id_operativo      # noqa: E402
from escribir import token, API                  # noqa: E402
from comun.rangos import UMBRAL, ORDEN           # noqa: E402
from comun.requisitos import REQUISITOS          # noqa: E402

HOJA = 'Config'

# ⚠️ CUALES LLEVAN SUBRANGO. CLAUDE.md: «cada tramo se parte en tercios:
# A−, A, A+. SSS, SS, S y E van sin signo». No es cosmetico — el signo
# cambia la pastilla y no el color, y con signo en los ocho harian falta 16
# paletas.
CON_SIGNO = ('A', 'B', 'C', 'D')


def rango(a1):
    r = requests.get('%s/%s/values/%s' % (API, id_operativo(),
                                          requests.utils.quote(a1)),
                     headers={'Authorization': 'Bearer ' + token()}, timeout=60)
    r.raise_for_status()
    return r.json().get('values', [])


# 🔴 SE ESCRIBE CON `poner()`, QUE COMPRUEBA LEYENDO. La primera version
# de esto confiaba en el 200 de la API, y una celda combinada —`T13:W13`,
# donde vivia el titulo del bloque de Ligas— **se trago tres de los cuatro
# valores de la fila de `E`** sin dar error: la API dijo «4 celdas
# actualizadas» y quedo la letra sola, sin su umbral.
from escribir import poner as escribir       # noqa: E402


def bloque_rangos():
    """La tabla de los ocho, sacada de comun/rangos.py."""
    filas = [['Rango', 'Score mín', 'Subrangos', 'Dónde se calcula']]
    umbral = dict(UMBRAL)
    for i, r in enumerate(ORDEN):
        if r in umbral:
            mini = '≥ %d' % umbral[r]
        else:
            # el ultimo tramo no tiene umbral propio: es «lo que queda»
            ult = UMBRAL[-1][1]
            mini = 'menos de %d' % ult
        sub = '%s− %s %s+' % (r, r, r) if r in CON_SIGNO else '—'
        filas.append([r, mini, sub,
                      'comun/rangos.py' if i == 0 else ''])
    return filas


def bloque_pesos():
    # 🔴 LEÍDOS DE `competitivo.PESOS`, no escritos acá: tenían los números
    # a mano, y el día que cambiaron los pesos (G1, 25/09/2026) esto habría
    # seguido mostrando los viejos. Es la regla del docstring de arriba.
    from competitivo import PESOS
    nombre = {'E': '⚡ Eficiencia', 'C': '🎯 Consistencia', 'Dm': '👑 Dominancia',
              'T': '🔥 Racha', 'V': '🌍 Diversidad'}
    return ([['⚙️ PESOS DEL SCORE', '', '', ''], ['Dimensión', 'Peso', '', '']] +
            [[nombre.get(k, k), int(round(p * 100)), '', ''] for k, p in PESOS] +
            [['', '', '', '']])


def bloque_requisitos():
    filas = [['🎴 REQUISITOS POR TARJETA', '', '', ''],
             ['Tarjeta', 'Hace falta', 'Qué', 'Dónde se calcula']]
    # ⚠️ UNA FILA POR CONDICION, no por carta. Desde el 22/09 Pais pide
    # tres cosas; listar solo la primera dejaria la hoja diciendo que
    # alcanza con los duelos nacionales.
    for i, (c, cs) in enumerate(sorted(REQUISITOS.items())):
        if not cs:
            filas.append([c.capitalize(), 'sin requisito', '', ''])
            continue
        for j, (n, _campo, que) in enumerate(cs):
            texto = (que[0 if n == 1 else 1]
                     if isinstance(que, (list, tuple)) else str(que))
            filas.append([c.capitalize() if j == 0 else '', n,
                          str(texto).lower(),
                          'comun/requisitos.py' if i == 0 and j == 0 else ''])
    filas.append(['', '', '', ''])
    filas.append(['⚠️ Además de esto, tener tarjeta pide IDENTIDAD:', '', '', ''])
    filas.append(['discord_id cargado + rol Miembro en DRA', '', '', ''])
    filas.append(['', '', '', ''])
    return filas


def bloque_confianza():
    return [
        ['📉 CONFIANZA', '', '', ''],
        ['El Score ya viene multiplicado por esto', '', '', ''],
        ['Eventos', 'Factor', '', ''],
        ['menos de 8', '—', 'sin tarjeta', ''],
        ['8', '0.80', '', ''],
        ['20 o más', '1.00', 'rampa lineal entre 8 y 20', ''],
        ['', '', '', ''],
    ]


def main():
    aplicar = '--aplicar' in sys.argv
    print('\n══ Config de %s ══\n' % ('LA T1' if aplicar else 'la T1  [SIMULACRO]'))

    # ── 1. los rangos ──
    viejo = rango('%s!T4:W11' % HOJA)
    nuevos = bloque_rangos()
    print('   LOS RANGOS (T4:W13)')
    print('     ahora:  %s' % ' · '.join(
        '%s %s' % (f[0], f[1]) for f in viejo[1:] if f and f[0]))
    print('     queda:  %s' % ' · '.join(
        '%s %s' % (f[0], f[1]) for f in nuevos[1:]))
    n_viejo = len([f for f in viejo[1:] if f and f[0]])
    print('     %d tramos -> %d' % (n_viejo, len(nuevos) - 1))

    # ── 2. mover Ligas para hacer lugar ──
    # 🔴 SOLO SI LIGAS SIGUE AHI, Y ESTO NO ES UN DETALLE. La primera
    # version preguntaba `if ligas:` a secas, o sea «¿hay algo en T13:W19?».
    # Despues de aplicar una vez, ahi vive la fila de `E` de los rangos —
    # asi que una segunda corrida la habria copiado **encima del bloque de
    # Ligas ya movido**, destruyendolo. Un script que arregla algo la
    # primera vez y lo rompe la segunda es peor que uno que no anda.
    ligas = rango('%s!T13:W19' % HOJA)
    hay_ligas = bool(ligas and ligas[0] and 'LIGAS' in str(ligas[0][0]).upper())
    print('\n   MOVER «SISTEMA LIGAS» (T13:W19 -> T22:W28)')
    if hay_ligas:
        print('     %d filas, empieza con: %s' % (len(ligas), ligas[0][0]))
    else:
        print('     ya estaba movido — no hago nada')

    # ── 3. los bloques nuevos, abajo ──
    abajo = bloque_pesos() + bloque_requisitos() + bloque_confianza()
    print('\n   BLOQUES NUEVOS (A38:D%d)' % (37 + len(abajo)))
    for f in abajo:
        if f[0].startswith(('⚙️', '🎴', '📉')):
            print('     %s' % f[0])

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    # ⚠️ EL ORDEN IMPORTA: primero se copia Ligas abajo, DESPUES se pisa su
    # lugar. Al reves, un error en el medio deja el bloque borrado y sin
    # copia.
    if hay_ligas:
        escribir('%s!T22:W%d' % (HOJA, 21 + len(ligas)), ligas)
        print('\n   ✅ Ligas copiado a T22')
        vacio = [[''] * 4 for _ in ligas]
        escribir('%s!T13:W19' % HOJA, vacio)
        print('   ✅ T13:W19 limpiado')
    escribir('%s!T5:W%d' % (HOJA, 4 + len(nuevos)), nuevos)
    print('   ✅ los ocho rangos en T5')
    escribir('%s!A38:D%d' % (HOJA, 37 + len(abajo)), abajo)
    print('   ✅ pesos, requisitos y confianza en A38')
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())

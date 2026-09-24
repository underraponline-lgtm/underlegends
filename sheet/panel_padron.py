# -*- coding: utf-8 -*-
"""EL PANEL DEL PADRON, EN FORMULAS. Para que no vuelva a envejecer.

    python sheet/panel_padron.py            dice que pondria, NO escribe
    python sheet/panel_padron.py --aplicar  lo escribe

🔴 EL PANEL DECIA NUMEROS DE OTRO DIA, Y NADIE PODIA NOTARLO.

`Lista de Raperos` tiene arriba a la derecha un recuadro `📊 Totales`.
Medido el 20/09/2026, decia:

    Total raperos      817      (son 875)
    ✅ Verificados     163      (son 339)
    Con Discord ID     192      (son 504)
    📈 Progreso       61.6%     (es 38.7 %)

⚠️ **Y NO ERAN FORMULAS ROTAS: ERAN VALORES PEGADOS.** Pedirle a la API el
render `FORMULA` devuelve los mismos numeros literales. Alguien los calculo
una vez, los pego, y desde entonces el panel dice con total seguridad algo
que dejo de ser cierto.

Es lo que `docs/sheet_t1.md` describe como el pecado del Sheet viejo: *«hoy
se pegan a mano — por eso `Axinu 🇨🇴 — 24 🥇` sigue diciendo eso aunque Axinu
deje de ser el que mas campeonatos tiene»*. Y es lo que «mantenerse solo»
significa en concreto.

DOS ERRORES QUE COMETI ESCRIBIENDOLO, Y LOS DOS DABAN UN NUMERO PLAUSIBLE
--------------------------------------------------------------------------
🔴 **1. `COUNTA` CUENTA LA CADENA VACIA.** Al escribir el padron se pusieron
`''` en las celdas sin dato, y para Sheets una celda con `""` **no esta
vacia**. `COUNTA(E10:E)` daba **874** donde hay **504** Discord ID, y para
pais y crew daba 875 —el total— en vez de 747 y 36. No fallaba: devolvia
un numero creible. `LEN(...)>0` es lo unico que distingue las dos cosas.

🔴 **2. EL BLOQUE NO SE PUEDE ESTIRAR HACIA ABAJO.** La primera version
escribia once filas seguidas desde la 11 y **piso `📖 Instrucciones` y su
primera linea**, que viven en L20:L25. En una hoja armada a mano siempre
hay algo debajo. Por eso ahora son dos bloques con su fila declarada.
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

from escribir import Hoja, id_operativo, API, token     # noqa: E402

HOJA = 'Lista de Raperos'
FILA_DATOS = 10            # la cabecera esta en la 9
COL_ETQ, COL_VAL = 'L', 'M'

# ⚠️ LAS COLUMNAS SE BUSCAN POR NOMBRE, no se escriben. Hoy mismo se
# insertaron tres columnas en esta hoja; cualquier letra escrita a mano aca
# quedaria apuntando a otra cosa la proxima vez que eso pase.
PANEL = (11, [
    ('Total raperos', 'LLENAS', 'Rapero', None),
    ('✅ Verificados', 'COUNTIF', 'Verificado', '✅'),
    ('❌ No está', 'COUNTIF', 'Verificado', '❌'),
    ('❓ Sin verificar', 'COUNTIF', 'Verificado', '❓'),
    (None, None, None, None),
    ('📈 Progreso', 'PCT', 'Verificado', '✅'),
    ('Con Discord ID', 'LLENAS', 'Discord ID', None),
    ('Sin Discord ID', 'RESTO', 'Discord ID', None),
])

# debajo de las instrucciones, que terminan en la 25
EXTRA = (27, [
    ('Con país', 'LLENAS', 'País', None),
    ('Con crew', 'LLENAS', 'Crew', None),
    # ⚠️ ESTE YA ESTABA, TAMBIEN PEGADO A MANO: decia 8 y son 7. Y es el
    # numero que mas importa de todos, porque es **a quien le falta un solo
    # paso para tener tarjeta**: ya se verifico y nadie le cargo el ID.
    ('✅ sin Discord ID', 'VERIF_SIN_ID', 'Discord ID', None),
])


def letra(i):
    return chr(ord('A') + i)


def formulas_de(bloque, col):
    etq, form = [], []
    for e, tipo, columna, valor in bloque:
        if e is None:
            etq.append([''])
            form.append([''])
            continue
        r = col(columna)
        todos = col('Rapero')
        if tipo == 'LLENAS':
            f = '=SUMPRODUCT(--(LEN(%s)>0))' % r
        elif tipo == 'COUNTIF':
            f = '=COUNTIF(%s,"%s")' % (r, valor)
        elif tipo == 'RESTO':
            f = '=SUMPRODUCT(--(LEN(%s)>0))-SUMPRODUCT(--(LEN(%s)>0))' % (todos, r)
        elif tipo == 'VERIF_SIN_ID':
            # ⚠️ `LEN(...)=0` Y NO `=""`: la comparacion con cadena vacia
            # da verdadero tambien para las celdas que tienen `""` puesto,
            # que es justo lo que rompio el conteo la primera vez.
            f = '=SUMPRODUCT((%s="✅")*(LEN(%s)=0))' % (col('Verificado'), r)
        else:   # PCT
            f = ('=IFERROR(TEXT(COUNTIF(%s,"%s")/SUMPRODUCT(--(LEN(%s)>0)),'
                 '"0.0%%"),"—")' % (r, valor, todos))
        etq.append([e])
        form.append([f])
    return etq, form


def main():
    aplicar = '--aplicar' in sys.argv
    h = Hoja(HOJA, ojo='Rapero')
    ix = {n: i for i, n in enumerate(h.cabecera)}
    pide = [c for _, _, c, _ in PANEL[1] + EXTRA[1] if c]
    faltan = sorted({c for c in pide if c not in ix})
    if faltan:
        sys.exit('faltan columnas en %s: %s' % (HOJA, ', '.join(faltan)))

    def col(n):
        # ⚠️ SIN TOPE DE FILA A PROPOSITO: `E10:E` sigue contando cuando el
        # padron crezca. Un `E10:E884` se queda corto el dia que entre
        # alguien y nadie lo nota.
        return '%s%d:%s' % (letra(ix[n]), FILA_DATOS, letra(ix[n]))

    print('\n══ EL PANEL DE %s ══\n' % HOJA)
    hh = {'Authorization': 'Bearer ' + token()}
    tandas = []
    for fila0, bloque in (PANEL, EXTRA):
        etq, form = formulas_de(bloque, col)
        tandas.append((fila0, etq, form))
        for e, f in zip(etq, form):
            if e[0]:
                print('   %-18s %s' % (e[0], f[0][:76]))

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    for fila0, etq, form in tandas:
        for c, vals, modo in ((COL_ETQ, etq, 'RAW'),
                              (COL_VAL, form, 'USER_ENTERED')):
            # ⚠️ `USER_ENTERED` PARA LAS FORMULAS. Con `RAW`, el
            # `=SUMPRODUCT(...)` entra como TEXTO: la celda muestra la
            # formula en vez de contar, y no da error.
            rng = '%s!%s%d:%s%d' % (HOJA, c, fila0, c, fila0 + len(vals) - 1)
            r = requests.put('%s/%s/values/%s?valueInputOption=%s'
                             % (API, id_operativo(), requests.utils.quote(rng), modo),
                             headers=hh, json={'values': vals}, timeout=60)
            if r.status_code >= 300:
                raise RuntimeError('%s: %s' % (r.status_code, r.text[:200]))

    # ⚠️ SE COMPRUEBA QUE CALCULEN, no que se hayan escrito. Una formula
    # puede entrar bien y dar #REF! o #NAME?; leer el valor renderizado es
    # lo unico que distingue «entro» de «funciona».
    print('\n   lo que calculan ahora:')
    malas = 0
    for fila0, etq, _ in tandas:
        rng = '%s!%s%d:%s%d' % (HOJA, COL_VAL, fila0, COL_VAL,
                                fila0 + len(etq) - 1)
        out = requests.get('%s/%s/values/%s'
                           % (API, id_operativo(), requests.utils.quote(rng)),
                           headers=hh, timeout=60).json().get('values', [])
        out += [[]] * (len(etq) - len(out))
        for e, v in zip(etq, out):
            if not e[0]:
                continue
            val = v[0] if v else '(vacío)'
            if str(val).startswith('#') or val == '(vacío)':
                malas += 1
            print('      %-18s %s' % (e[0], val))
    if malas:
        raise RuntimeError('%d fórmula(s) no calcularon' % malas)
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())

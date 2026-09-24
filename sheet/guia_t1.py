# -*- coding: utf-8 -*-
"""LA GUIA PUBLICA, AL DIA CON LA T1.

    python sheet/guia_t1.py            dice que cambiaria, NO escribe
    python sheet/guia_t1.py --aplicar  lo escribe

🔴 LA GUIA ES PUBLICA Y DICE DOS COSAS QUE NO SON CIERTAS.

**1 · La tabla de rangos tiene SEIS tramos** (`Guía!L7:O13`), con
`S ≥ 65 · A ≥ 47 · B ≥ 36 · C ≥ 23 · D ≥ 17 · E`. Las tarjetas usan ocho.
Alguien lee la Guia, se calcula su rango, tira `/card` y le sale otro.

**2 · Dice que el rango NO se reinicia**, en `Guía!N34`, bajo la columna
`❌ NO se reinicia`. Dlx lo corrigio el 16/09/2026: **se reinicia**.
`docs/sheet_t1.md` lo marca como lo que no puede quedar asi: *«es publica,
y prometeria algo que el sistema no hace»*.

Tambien decia «Para TODOS con 8+ eventos»: el requisito de la Competitiva
—de donde sale el rango— es **10**.

COMO ENTRAN OCHO DONDE HABIA SEIS
----------------------------------
⚠️ **SIN INSERTAR FILAS.** Debajo de la tabla arranca `🚀 ¿CÓMO
PARTICIPAR?` y de ahi para abajo la columna L tiene **43 celdas
combinadas**. Insertar filas las corre todas.

La tabla ocupa cuatro columnas: `Rango · Score · Raperos · Eventos`. Las
dos ultimas se pueden soltar y no se pierde nada:

  · `Raperos` son los conteos de la pre-temporada (12/32/26/41/19/8), que
    **se borran con la T1** y ya estan viejos.
  · `Eventos` decia `8+` en las seis filas: es un solo dato repetido seis
    veces, y ademas el numero cambio a 10.

Con dos columnas libres, los ocho entran como **dos bloques de cuatro uno
al lado del otro**, y el minimo pasa a una linea sola debajo. Cinco filas
en vez de siete, y sobra lugar.
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

from escribir import token, API                          # noqa: E402
from comun.rangos import UMBRAL, ORDEN                   # noqa: E402
from comun.requisitos import REQUISITOS, minimo                  # noqa: E402

# ⚠️ el ID vive en `planillas.py`: la T1 estrena planilla y una
# copia suelta lee la vieja sin fallar. Ver el encabezado de ese modulo.
from planillas import OFICIAL  # noqa: E402
HOJA = 'Guía'
# ⚠️ `minimo()` y no `[0]`: ese indice se rompio el 22/09 cuando las
# condiciones pasaron a ser una lista. Aca no habia fallado todavia
# porque nadie corrio este script. Ver comun/requisitos.minimo().
MIN_EV = minimo('competitivo', 'ev')


def _u(r):
    d = dict(UMBRAL)
    return '≥ %d' % d[r] if r in d else 'menos de %d' % UMBRAL[-1][1]


def tabla():
    """Los ocho en dos bloques de cuatro: L/M y N/O."""
    izq, der = ORDEN[:4], ORDEN[4:]
    filas = [['Rango', 'Score', 'Rango', 'Score']]
    for a, b in zip(izq, der):
        filas.append([a, _u(a), b, _u(b)])
    filas.append(['', '', '', ''])
    filas.append(['Mínimo %d eventos para tener rango.' % MIN_EV, '', '', ''])
    return filas


def leer(rng):
    r = requests.get('%s/%s/values/%s'
                     % (API, OFICIAL, requests.utils.quote(rng)),
                     headers={'Authorization': 'Bearer ' + token()}, timeout=60)
    r.raise_for_status()
    return r.json().get('values', [])


def poner(rng, filas):
    """Escribe y comprueba leyendo. Ver sheet/escribir.poner()."""
    r = requests.put('%s/%s/values/%s?valueInputOption=RAW'
                     % (API, OFICIAL, requests.utils.quote(rng)),
                     headers={'Authorization': 'Bearer ' + token()},
                     json={'values': filas}, timeout=60)
    if r.status_code >= 300:
        raise RuntimeError('%s: %s' % (r.status_code, r.text[:200]))
    leido = leer(rng)
    for i, esp in enumerate(filas):
        real = leido[i] if i < len(leido) else []
        for j, val in enumerate(esp):
            if str(val).strip() and (j >= len(real) or str(real[j]) != str(val)):
                raise RuntimeError(
                    '%s: la fila %d columna %d no quedó (¿celda combinada?): '
                    'mandé %r' % (rng, i + 1, j + 1, val))


def main():
    aplicar = '--aplicar' in sys.argv
    print('\n══ LA GUÍA PÚBLICA ══\n')

    act = leer('%s!L6:O13' % HOJA)
    print('   la tabla, como está:')
    for f in act:
        s = ' | '.join('%-16s' % str(c)[:16] for c in f)
        if s.strip(' |'):
            print('      %s' % s.rstrip())

    nueva = tabla()
    print('\n   como queda:')
    for f in nueva:
        s = ' | '.join('%-16s' % str(c)[:16] for c in f)
        if s.strip(' |'):
            print('      %s' % s.rstrip())

    # ⚠️ SE EDITA LA DESCRIPCION, NO SE REESCRIBE. La original explica bien
    # de que se compone el Score —«eficiencia, constancia, dominancia,
    # techo y diversidad»— y reemplazarla entera por una frase mia perdia
    # eso. Lo que esta mal son dos cosas puntuales: el `8+` y que no dice
    # que el rango se reinicia.
    desc = (act[0][0] if act and act[0] else '')
    nueva_desc = desc.replace('8+ eventos', '%d+ eventos' % MIN_EV)
    if 'reinicia' not in nueva_desc:
        nueva_desc = nueva_desc.rstrip(' .') + '. Se reinicia cada temporada.'
    print('\n   la descripción:')
    print('      antes: %s' % desc[:96])
    print('      queda: %s' % nueva_desc[:96])

    reinicia = leer('%s!L34:O35' % HOJA)
    print('\n   «¿qué se reinicia?»:')
    print('      hoy N34 dice %r bajo «❌ NO se reinicia»'
          % (reinicia[0][2] if reinicia and len(reinicia[0]) > 2 else ''))
    print('      pasa a L35, bajo «✅ Se reinicia», con los ocho')

    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    poner('%s!L6' % HOJA, [[nueva_desc]])
    print('\n   ✅ la descripción')
    poner('%s!L7:O%d' % (HOJA, 6 + len(nueva)), nueva)
    print('   ✅ los ocho rangos')
    # ⚠️ PRIMERO SE ESCRIBE DONDE VA, DESPUES SE BORRA DE DONDE ESTABA. Al
    # reves, un error en el medio deja la linea en ningun lado.
    poner('%s!L35' % HOJA, [['Rangos (SSS → E)']])
    print('   ✅ «Rangos» pasa a «se reinicia»')
    requests.put('%s/%s/values/%s?valueInputOption=RAW'
                 % (API, OFICIAL, requests.utils.quote('%s!N34' % HOJA)),
                 headers={'Authorization': 'Bearer ' + token()},
                 json={'values': [['']]}, timeout=60)
    print('   ✅ N34 limpiado')
    print('')
    return 0


if __name__ == '__main__':
    sys.exit(main())

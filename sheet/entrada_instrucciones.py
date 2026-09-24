# -*- coding: utf-8 -*-
"""LAS INSTRUCCIONES DE LA HOJA `Entrada`, AL DIA CON COMO SE PROCESA HOY.

    python sheet/entrada_instrucciones.py            que cambiaria, NO escribe
    python sheet/entrada_instrucciones.py --aplicar  lo escribe

🔴 LA HOJA LE DICE A LA PERSONA QUE HAGA CLICK EN UN BOTON QUE NO HACE NADA.

`Entrada!A2:A7` es el instructivo que lee quien carga una llave, y su
paso 5 es **«Click Procesar»** — el menu del Apps Script. Ese menu
`nunca se ejecuto`: el `Log` del Operativo dice `Total entradas 0` y por
eso `Resultados` y `1v1` estan vacias despues de 348 eventos.

⚠️ **Y ESO IMPORTA MAS QUE ANTES.** Dlx, 20/09/2026: *«mayormente los
usuarios pondran las llaves y anunciaran los eventos manualmente»*. Si
el camino es manual, **el instructivo ES el sistema**: una persona que
sigue los cinco pasos al pie de la letra hoy pega la tabla y despues no
pasa nada, sin un error que mirar.

LAS SIETE NOTAS, Y CUALES HACEN ALGO
-------------------------------------
La hoja documenta siete notas validas. **Dos cambian los puntos**:

    Revivido            x50 %      (`Config!G12`)
    Walk-in X rondas    x50/25/0 % (`Config!G7:G9`)

Las otras cinco **no las mira nadie**, ni el Apps Script original ni
`sheet/motor.py`. No es que esten rotas: nunca se implementaron. Se
dejan en la hoja —describen algo real que paso en el evento y sirven de
registro— pero ahora dicen que no mueven el numero, para que nadie
escriba `WO` esperando que descuente.

⚠️ **Una es la excepcion y vale la pena: `NUEVO`.** Significa «rapero no
registrado», o sea **exactamente** el caso que `procesar_entrada.py`
frena desde hoy. La convencion ya estaba acordada en la hoja antes de
que existiera el freno, asi que el motor la honra: con `NUEVO` en las
notas, el nombre desconocido pasa sin discutir.

⚠️ SE ESCRIBEN DOS BLOQUES SUELTOS, NO UN RANGO CORRIDO. `A2:A8` y
`B15:B21`, con la fila 9 (`🎯 Acciones`) y la 14 en el medio sin tocar.
Escribir de A2 a B21 de una pisaria las dos. Es lo que ya paso el
20/09/2026 con `📖 Instrucciones` de `Config`.
"""
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

from escribir import poner, _pedir                      # noqa: E402
import requests                                          # noqa: E402

# ⚠️ LOS PASOS 1 A 4 VAN TAL CUAL ESTABAN. Son correctos y el texto es de
# Dlx; reescribirlos «mejor» es cambiar la voz de algo que la gente ya lee
# sin que nadie lo haya pedido. Lo unico falso es el 5.
PASOS = [
    ['1. Procesa bracket con IA'],
    ['   (usa el prompt oficial)'],
    ['2. Copia la tabla resultante'],
    ['3. Selecciona C2 y pega'],
    ['4. Verifica los nombres'],
    ['5. Avisa que está cargada'],
    ['⚠️ el botón viejo NO procesa'],
]
NOTAS = [
    ['Eliminado y vuelto · ×50%'],
    ['Saltó X rondas · ×50/25/0%'],
    ['Rival no se presentó · no cambia puntos'],
    ['Directo a rondas · no cambia puntos'],
    ['Reemplazó a alguien · no cambia puntos'],
    ['Drafteado a equipo · poné coma en el lado'],
    ['Rapero no registrado · deja pasar el nombre'],
]


def leer(rng):
    d = _pedir('GET', '/values/%s' % requests.utils.quote(rng))
    return d.get('values', [])


def main():
    aplicar = '--aplicar' in sys.argv
    print('\n══ LAS INSTRUCCIONES DE `Entrada` ══\n')

    for rng, nuevo, etq in (('Entrada!A2:A8', PASOS, 'los pasos'),
                            ('Entrada!B15:B21', NOTAS, 'las notas')):
        act = leer(rng)
        print('   %s (%s)\n' % (etq, rng))
        for i, fila in enumerate(nuevo):
            viejo = (act[i][0] if i < len(act) and act[i] else '')
            igual = str(viejo).strip() == fila[0].strip()
            print('      %s %-44s %s'
                  % ('  ' if igual else '->', fila[0],
                     '' if igual else '(antes: %r)' % str(viejo)[:34]))
        print('')

    if not aplicar:
        print('   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    poner('Entrada!A2:A8', PASOS)
    print('   ✅ los pasos')
    poner('Entrada!B15:B21', NOTAS)
    print('   ✅ las notas\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())

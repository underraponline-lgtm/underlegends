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

⚠️ SE ESCRIBEN DOS BLOQUES SUELTOS, NO UN RANGO CORRIDO. `A1:A9` y
`A14:B21`, sin tocar nada de la columna C para la derecha —ahí está la
tabla—. Escribir de A1 a B21 de una, con celdas vacías, pisaría lo que
haya en medio. Es lo que ya pasó el 20/09/2026 con `📖 Instrucciones`
de `Config`.

🔴 DESDE EL 24/09/2026 LOS PASOS NO SON LOS DE DLX, Y NO POR ESTILO.
Los cuatro primeros se habían dejado tal cual —«es la voz de Dlx»— y
describían el camino manual: procesar la llave con una IA y pegarla en
C2. Ese camino ya no existe: `bot/llaves_a_entrada.py` llena esta hoja
desde Discord y `procesar_entrada.py --limpiar` la vacía, cada media
hora. Quien siguiera los pasos pegaría una tabla que el ciclo borra.
Dlx, el mismo día: *«el sheet es más que todo información raw que
cualquiera puede ver»* — o sea que la hoja tiene que decir qué es, no
cómo se usaba.

⚠️ Y LAS NOTAS SON LAS QUE EL CICLO ESCRIBE HOY, con lo que cada una
hace de verdad en el motor. Las de antes (`WO`, `Suplente`…) no las
escribe ni las lee nadie.
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

QUE_ES = [
    ['📖 Qué es esta hoja'],
    ['🤖 La llena el ciclo solo:'],
    ['   lee las llaves de Discord,'],
    ['   las procesa y la vacía,'],
    ['   cada media hora.'],
    ['No hace falta pegar nada.'],
    ['¿Una llave no entró o'],
    ['entró mal? → ✅ Decidir'],
    [''],
]
NOTAS = [
    ['📝 Las notas que escribe el ciclo', ''],
    ['Revivido: X', 'perdió y volvió · 1ª derrota entera + 50 % del puesto final'],
    ['Walk-in N: X', 'entró salteando N rondas · cobra 50 / 25 / 0 %'],
    ['Pokemon: X', 'aparece sin pelear · esa aparición no paga ni da puesto'],
    ['Drafteado: X', 'eliminado y sumado a un equipo · cobra las dos cosas'],
    ['triple', 'batalla de 3 o más · paga el puesto, no cuenta como duelo'],
    ['podio', 'tercero sacado del podio · paga el puesto, no es duelo'],
    ['NUEVO', 'rapero que no está en la lista · deja pasar el nombre'],
]


def leer(rng):
    d = _pedir('GET', '/values/%s' % requests.utils.quote(rng))
    return d.get('values', [])


def main():
    aplicar = '--aplicar' in sys.argv
    print('\n══ LAS INSTRUCCIONES DE `Entrada` ══\n')

    for rng, nuevo, etq in (('Entrada!A1:A9', QUE_ES, 'qué es'),
                            ('Entrada!A14:B21', NOTAS, 'las notas')):
        act = leer(rng)
        print('   %s (%s)\n' % (etq, rng))
        for i, fila in enumerate(nuevo):
            viejo = ' · '.join(str(x) for x in (act[i] if i < len(act) else [])
                               if str(x).strip())
            texto = ' · '.join(x for x in fila if x)
            igual = viejo.strip() == texto.strip()
            print('      %s %-58s %s'
                  % ('  ' if igual else '->', texto[:58],
                     '' if igual else '(antes: %r)' % viejo[:34]))
        print('')

    if not aplicar:
        print('   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0

    poner('Entrada!A1:A9', QUE_ES)
    print('   ✅ qué es')
    poner('Entrada!A14:B21', NOTAS)
    print('   ✅ las notas\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())

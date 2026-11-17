# -*- coding: utf-8 -*-
"""🎭 LOS ESTILOS DE JUEGO QUE ELIGIÓ CADA UNO, del objeto a las cartas (paso 2f3 del ciclo).

    python bot/juegos.py              muestra lo que escribiría (no escribe)
    python bot/juegos.py --aplicar    trae lo elegido y escribe `datos/estilos.json`
    python bot/juegos.py --auto       el self-check (no pide nada a nadie)

Cada uno elige su estilo en el Inventario de la página (Dlx, 16/11/2026: el 1.º lugar «lo puedes elegir desde la
página»; una vez por temporada). Lo guarda el objeto de avisos (`juegoElige()` en `bot/avisos.js`) y esto lo trae con la
clave del ciclo (`/avisos/juegos-ciclo`), como los TAGs (`bot/tags_inventario.py`), y lo deja donde la Competitiva lo
lee: `datos/estilos.json`, `{clave: [[estilo, nivel], …]}` en el orden de los lugares (ver
`02_Competitivo/v2/estilos_juego.py`).

HOY ESCRIBE SÓLO EL 1.º LUGAR. El 2.º (los eventos de estilo de DRA) y el 3.º (Competencias) todavía no existen, y los
niveles tampoco: van en `datos/estilos_niveles.json` (`{clave: {estilo: nivel}}`) cuando lleguen. Sin ese archivo, todo
en nivel 0 —el elegido sin nada más—. ⚠️ Los que dejaste (`viejos`) quedan desbloqueados en el objeto y en la página,
pero no van en la carta: la carta lleva el elegido.

⚠️ SIN RESPUESTA DEL OBJETO NO SE TOCA EL ARCHIVO. Una caída de red escribiendo `{}` le borraría el estilo a todos y
redibujaría sus cartas sin él. Tampoco con el Worker todavía sin desplegar (la ruta da 404): queda lo de antes.
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (BASE, os.path.join(BASE, 'bot'), os.path.join(BASE, '02_Competitivo', 'v2')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

ARCH = os.path.join(BASE, 'datos', 'estilos.json')
NIVELES = os.path.join(BASE, 'datos', 'estilos_niveles.json')
LEEME = ('🎭 Los estilos de juego de la Competitiva, por clave: [[estilo, nivel], …] en el orden de los lugares (1 el elegido '
         'en la página · 2 eventos de estilo de DRA · 3 Competencias). Lo escribe bot/juegos.py; lo lee '
         '02_Competitivo/v2/estilos_juego.py')


def traer():
    """`{clave: {juego, viejos}}` del objeto, o `None` si no contestó."""
    import requests
    import fotos as F
    import clave_ciclo as CC
    import pase as PA
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return None
    try:
        r = requests.post(PA.WORKER + '/avisos/juegos-ciclo', data=b'{}',
                          headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=30)
        d = r.json() if r.ok else None
    except (OSError, ValueError):
        return None
    return d.get('elegidos') if isinstance(d, dict) and isinstance(d.get('elegidos'), dict) else None


def _niveles():
    try:
        with io.open(NIVELES, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def armar(elegidos, niveles, catalogo):
    """`{clave: [[estilo, nivel]]}` de lo elegido. Lo que no está en el catálogo o una clave rara, afuera; el nivel, de
    `niveles` (0 a 3), y si no hay, 0."""
    out = {}
    for k, x in sorted((elegidos or {}).items()):
        juego = (x or {}).get('juego') if isinstance(x, dict) else None
        if not isinstance(k, str) or not k or k.startswith('_') or juego not in catalogo:
            continue
        n = ((niveles.get(k) or {}) if isinstance(niveles.get(k), dict) else {}).get(juego, 0)
        out[k] = [[juego, n if n in (0, 1, 2, 3) else 0]]
    return out


def escribir(gente):
    d = dict({'_leeme': LEEME}, **gente)
    with io.open(ARCH, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=False)
        f.write('\n')


def correr(aplicar):
    import estilos_juego as EJ
    el = traer()
    if el is None:
        print('      🎭 el objeto no contestó lo elegido (¿el Worker sin desplegar?): queda lo de antes')
        return 0
    gente = armar(el, _niveles(), EJ.CATALOGO)
    antes = {k: v for k, v in EJ.todos().items() if not k.startswith('_')}
    cambian = sorted(k for k in set(antes) | set(gente) if antes.get(k) != gente.get(k))
    print('      🎭 %d con estilo de juego%s' % (len(gente), (' · cambian: ' + ', '.join(cambian[:12]) +
                                                         ('…' if len(cambian) > 12 else '')) if cambian else ' · nada cambió'))
    if aplicar and (cambian or not os.path.exists(ARCH)):
        escribir(gente)
    return 0


def _self_check():
    import estilos_juego as EJ
    mal = 0

    def ok(c, que):
        nonlocal mal
        print('   %s %s' % ('✅' if c else '❌', que))
        mal += 0 if c else 1

    el = {'ana': {'juego': 'punchline', 'viejos': ['flow']}, 'bea': {'juego': 'inventado'}, '': {'juego': 'flow'},
          'cami': 'roto', 'dani': {'juego': 'frio'}, 'eze': {'juego': 'flow'}}
    g = armar(el, {'ana': {'punchline': 2}, 'dani': {'frio': 7}, 'eze': 'roto'}, EJ.CATALOGO)
    ok(g == {'ana': [['punchline', 2]], 'dani': [['frio', 0]], 'eze': [['flow', 0]]},
       'sólo lo del catálogo, con su nivel (0 a 3; raro o sin nivel, 0); lo roto afuera')
    EJ._cache = g
    ok(EJ.de('ana') == [('punchline', 2)] and EJ.de('dani') == [('frio', 0)], 'y lo que escribe, la carta lo entiende')
    EJ._cache = None
    print('   %s' % ('todo bien' if not mal else '%d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(correr('--aplicar' in sys.argv))

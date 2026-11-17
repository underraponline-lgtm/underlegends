# -*- coding: utf-8 -*-
"""🏷️ EL INVENTARIO DE TAGS Y EL TAG QUE CADA UNO ELIGIÓ PARA CADA CARTA (Dlx, 25/10/2026: «que los tags de abajo sean
personalizables en cada tarjeta, si uno desbloquea uno claro… que pueda elegir el que desee desde el inventario», y a los
cuatro grupos, «sí, sirve así»).

    python bot/tags_inventario.py            qué haría, sin escribir
    python bot/tags_inventario.py --aplicar  el paso 2f2 del ciclo: suma al inventario y deja lo elegido para las cartas
    python bot/tags_inventario.py --auto     el self-check

Dos cosas, en este orden, justo antes de «qué cambió» (así la carta sale con lo elegido en la misma corrida):

1. 🎒 EL INVENTARIO (`datos/tags_ganados.json`, `{clave: {carta: {tag: [texto, temporada, ms]}}}`). Cada corrida suma lo
   que hoy muestra cada carta (`catalogo_tags.de_cada_uno()`), sólo de los grupos que se guardan: ♾️ para siempre y 📅 de
   temporada. Nunca se borra nada. ⚠️ Lo de antes de hoy no se sabe: el inventario empieza el 25/10/2026.
2. 🎯 LO ELEGIDO (`datos/tags_elegidos.json`, `{clave: {carta: [texto, nivel]}}`, lo leen las cartas por
   `comun/tag_elegido.py`). Lo que cada uno eligió en la página lo guarda el objeto de avisos; el ciclo le manda el
   inventario (`/avisos/tags-ciclo`, con su clave: la página lo necesita para mostrar lo tuyo) y de vuelta trae lo
   elegido, que acá se revisa CONTRA EL INVENTARIO: uno que no tiene, o uno de
   temporada de una temporada que ya terminó, no pasa y la carta vuelve a su cascada. Los ✨ títulos del Pase los revisa el
   objeto, que sabe el nivel de cada uno.

👑 El dueño de UL tiene todo desbloqueado (Dlx, 25/10/2026): todos los que se guardan, de las cuatro cartas.
"""
import io
import json
import os
import sys
import time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (BASE, os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

GANADOS = os.path.join(BASE, 'datos', 'tags_ganados.json')
ELEGIDOS = os.path.join(BASE, 'datos', 'tags_elegidos.json')
CARTAS = ('temporada', 'competitivo', 'servidor', 'pais')
#: 👑 el perfil del dueño (como `DUENO_K` de bot/avisos.js)
DUENO_K = 'dlx'
#: ✨ cómo se escribe un título del Pase abajo de la carta, y su nivel: Legendario, porque es edición limitada
PASE_PRE, PASE_NIVEL = '✨ ', 't1'


def _leer(p):
    try:
        with io.open(p, encoding='utf-8') as f:
            d = json.load(f)
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}


def _escribir(p, d):
    nuevo = json.dumps(d, ensure_ascii=False, indent=1, sort_keys=True) + '\n'
    try:
        with io.open(p, encoding='utf-8') as f:
            if f.read() == nuevo:
                return False
    except OSError:
        pass
    with io.open(p, 'w', encoding='utf-8', newline='\n') as f:
        f.write(nuevo)
    return True


def sumar(ganados, textos, temp, ahora_ms):
    """Suma a `ganados` lo que hoy cumple cada uno en cada carta (`textos`: `{clave: [t, c, s, p]}`, donde cada uno es un
    texto o una lista de textos), sólo lo que se guarda. Devuelve cuántos nuevos.

    🎒 TODOS LOS QUE CUMPLE, NO SÓLO EL QUE SE VE (26/10/2026): antes se sumaba el TAG que mostraba cada carta —la
    cascada corta en el primero—, así que quien cumplía cinco tenía uno para elegir. Ahora llegan todos
    (`catalogo_tags.todos()`)."""
    import catalogo_tags as CAT
    nuevos = 0
    for k, ts in textos.items():
        for carta, lista in zip(CARTAS, ts):
          for t in (lista if isinstance(lista, list) else [lista]):
            if not t:
                continue
            tag = CAT.clave_tag(t)
            if CAT.GRUPO.get(tag) not in CAT.GUARDA:
                continue
            mio = ganados.setdefault(k, {}).setdefault(carta, {})
            x = mio.get(tag)
            if not x or (x[1] != temp and CAT.GRUPO.get(tag) == 'temporada'):
                mio[tag] = [t, temp, ahora_ms]
                nuevos += 1
            elif x[0] != t:
                mio[tag] = [t, x[1], x[2]]  # el número de ahora («CAMPEÓN x3»), la fecha en que lo ganó
    return nuevos


def nivel_de(carta, tag):
    import catalogo_tags as CAT
    for t, n, _p in CAT.CATALOGO.get(carta, []):
        if t == tag:
            return n
    return ''


def del_dueno(carta):
    """👑 Lo que tiene el dueño en `carta`: todos los que se guardan, `{tag: texto}` (los de número, sin el número)."""
    import catalogo_tags as CAT
    return {t: t.replace(' x%d', '').replace(' DE %d', '') for t, _n, _p in CAT.CATALOGO.get(carta, [])
            if CAT.GRUPO.get(t) in CAT.GUARDA}


def _titulo_carta():
    import pase
    return pase.TITULO_CARTA


def revisar(elegidos_obj, ganados, temp):
    """`{clave: {carta: [texto, nivel]}}`: lo elegido que vale. `elegidos_obj`: `{clave: {carta: tag}}` del objeto (`tag`
    es la clave del catálogo, o `pase:<título>` ya revisado por el objeto)."""
    import catalogo_tags as CAT
    out = {}
    for k, cs in (elegidos_obj or {}).items():
        if not isinstance(cs, dict):
            continue
        for carta, tag in cs.items():
            if carta not in CARTAS or not isinstance(tag, str) or not tag or tag == 'auto':
                continue
            if tag.startswith('pase:'):
                tit = tag[5:].strip()
                # ✨ cada título del Pase va en su carta (`pase.TITULO_CARTA`, Dlx 26/10/2026)
                if tit and len(tit) <= 40 and _titulo_carta().get(tit, carta) == carta:
                    out.setdefault(k, {})[carta] = [PASE_PRE + tit.upper(), PASE_NIVEL]
                continue
            grupo = CAT.GRUPO.get(tag)
            if grupo not in CAT.GUARDA:
                continue
            if k == DUENO_K:
                texto = del_dueno(carta).get(tag)
            else:
                x = ((ganados.get(k) or {}).get(carta) or {}).get(tag)
                texto = x[0] if x and (grupo == 'siempre' or x[1] == temp) else None
            n = nivel_de(carta, tag)
            if texto and n:
                out.setdefault(k, {})[carta] = [texto, n]
    return out


def traer(ganados, temp):
    """Le manda el inventario al objeto y trae lo elegido: `{clave: {carta: tag}}` (`/avisos/tags-ciclo`, con la clave
    del ciclo), o `None`."""
    import requests
    import fotos as F
    import clave_ciclo as CC
    import pase as PA
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return None
    try:
        r = requests.post(PA.WORKER + '/avisos/tags-ciclo', data=json.dumps({'temp': temp, 'ganados': ganados}, ensure_ascii=False).encode('utf-8'),
                          headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=30)
        d = r.json() if r.ok else None
    except (OSError, ValueError):
        return None
    return d.get('elegidos') if isinstance(d, dict) and isinstance(d.get('elegidos'), dict) else None


def clave_de_hoy():
    """`f(clave) -> la clave de esa persona hoy`: la de su nombre de la Liga si `clave` es la de un nombre viejo o un
    alias (`datos/akas.json`, por `rankings.canon()`); si no, la misma.

    ⚠️ SÓLO LAS CLAVES DE UN ALIAS DECLARADO: una clave que no es «letras y números» (`volk-co`, la de `_choques()` de
    `subir_web.py`) o que no está en el mapa se queda como está. Sin el mapa, todas como están."""
    try:
        import rankings as _RK
        _RK.canon('')
        al = _RK._ALIAS or {}
        return lambda k: _RK._kk(_RK.canon(k)) or k if isinstance(k, str) and k in al and _RK._kk(k) == k else k
    except Exception:                                    # noqa: BLE001
        return lambda k: k


def juntar(ganados, hoy):
    """El inventario con UNA entrada por persona: la de su clave de hoy (`hoy`, de `clave_de_hoy()`).

    🔴 EL INVENTARIO ES POR CLAVE, Y LA CLAVE SALE DEL NOMBRE (17/11/2026, «Mr Still Ballin» pasó a ser Over: de
    `mrstillballin` a `over`). Lo ganado con la clave vieja quedaba colgado de ella —la página busca por la de hoy y no
    lo mostraba— y la corrida siguiente se lo volvía a sumar como nuevo, con la fecha de ese día. Medido ese día: 16 de
    369 claves eran de un alias (Over, Mito, Oasis, Six, Makmah, YOUNG VLAD…).

    ⚠️ LO QUE LA PERSONA YA TIENE CON SU CLAVE MANDA, como en `insignias.juntar()`: la vieja sólo agrega lo que le
    falta, con su fecha (entre dos viejas, la más vieja)."""
    out, de_vieja = {}, set()
    for k in sorted(ganados or {}):
        if hoy(k) == k:
            out.setdefault(k, {})
            for carta, tags in (ganados[k] or {}).items():
                out[k].setdefault(carta, {}).update(tags or {})
    for k in sorted(ganados or {}):
        r = hoy(k)
        if r == k:
            continue
        for carta, tags in (ganados[k] or {}).items():
            dest = out.setdefault(r, {}).setdefault(carta, {})
            for tag, x in (tags or {}).items():
                if tag not in dest or ((r, carta, tag) in de_vieja and (x[2] or 0) < (dest[tag][2] or 0)):
                    dest[tag] = x
                    de_vieja.add((r, carta, tag))
    return out


def correr(aplicar):
    import catalogo_tags as CAT
    from comun import temporada as TM
    temp = TM.ACTUAL
    # 🪪 por persona y no por la clave de su nombre de ese día (ver `juntar()`)
    ganados = juntar(_leer(GANADOS), clave_de_hoy())
    textos, todos = {}, {}
    CAT.de_cada_uno(textos, todos)
    nuevos = sumar(ganados, todos or textos, temp, int(time.time() * 1000))
    print('   🎒 inventario: %d personas · %d TAG(s) nuevos' % (len(ganados), nuevos))
    obj = traer(ganados, temp) if aplicar else None
    if obj is None:
        print('   ⚠️ no pude leer lo elegido del objeto: queda lo de la corrida anterior')
        el = _leer(ELEGIDOS)
    else:
        el = revisar(obj, ganados, temp)
        print('   🎯 elegidos: %d personas con un TAG elegido' % len(el))
    if aplicar:
        a = _escribir(GANADOS, ganados)
        b = _escribir(ELEGIDOS, el)
        print('   %s' % ('✅ escrito' if a or b else 'sin cambios'))
    return 0


def _self_check():
    import catalogo_tags as CAT
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    g = {}
    n = sumar(g, {'ana': ['💀 REGICIDA', '', '👑 DUEÑO DE CASA', ''], 'bea': ['👑 CAMPEÓN x2', '', '🏛️ PILAR', '']}, 't1', 1)
    ok(n == 3 and '👑 DUEÑO DE CASA' not in g['ana'].get('servidor', {}) and g['bea']['temporada']['👑 CAMPEÓN x%d'][0] == '👑 CAMPEÓN x2',
       'al inventario van los para siempre y los de temporada, con su número; los de estado no')
    h = {}
    ok(sumar(h, {'ana': [['💀 REGICIDA', '👑 CAMPEÓN x2'], [], ['👑 DUEÑO DE CASA', '🏛️ PILAR'], []]}, 't1', 1) == 3,
       'con todos los que cumple llegan todos (menos los de estado)')
    sumar(g, {'bea': ['👑 CAMPEÓN x3', '', '', '']}, 't1', 2)
    ok(g['bea']['temporada']['👑 CAMPEÓN x%d'] == ['👑 CAMPEÓN x3', 't1', 1], 'el número se pone al día y la fecha queda')
    el = revisar({'ana': {'temporada': '💀 REGICIDA', 'servidor': '👑 DUEÑO DE CASA'},
                  'bea': {'servidor': '🏛️ PILAR', 'temporada': 'pase:Pilar de UL', 'pais': 'auto'},
                  'cata': {'temporada': '💀 REGICIDA'}}, g, 't1')
    ok(el.get('ana') == {'temporada': ['💀 REGICIDA', 't2']} and 'cata' not in el
       and el['bea'] == {'servidor': ['🏛️ PILAR', 't2'], 'temporada': ['✨ PILAR DE UL', 't1']},
       'lo elegido: el que tiene pasa, uno de estado o que no tiene no, y el título del Pase como edición limitada')
    ok(revisar({'bea': {'temporada': 'pase:Del Pase', 'competitivo': 'pase:Del Pase'}}, g, 't1').get('bea')
       == {'competitivo': ['✨ DEL PASE', 't1']}, 'un título del Pase va sólo en su carta (✨ edición limitada por carta)')
    ok('servidor' not in revisar({'bea': {'servidor': '🏛️ PILAR'}}, g, 't2').get('bea', {}),
       'uno de temporada de una temporada que terminó ya no se pone')
    d = revisar({DUENO_K: {'temporada': '👑 CAMPEÓN x%d', 'servidor': '👑 DUEÑO DE CASA'}}, {}, 't1')
    ok(d.get(DUENO_K) == {'temporada': ['👑 CAMPEÓN', 't3']}, 'el dueño tiene todos los que se guardan (y los de estado tampoco)')
    ok(all(t in CAT.GRUPO for xs in CAT.CATALOGO.values() for t, _n, _p in xs), 'cada TAG del catálogo tiene su grupo')
    # 🪪 la clave de un nombre viejo se junta con la de hoy: lo suyo manda, la vieja sólo completa
    jj = juntar({'over': {'temporada': {'A': ['A', 't1', 5]}},
                 'mrviejo': {'temporada': {'A': ['A', 't1', 1], 'B': ['B', 't1', 3]}, 'pais': {'C': ['C', 't1', 4]}},
                 'mrviejo2': {'temporada': {'B': ['B', 't1', 2]}}, 'volk-co': {'pais': {'D': ['D', 't1', 1]}}},
                lambda k: 'over' if k in ('mrviejo', 'mrviejo2') else k)
    ok(set(jj) == {'over', 'volk-co'} and jj['over']['temporada']['A'][2] == 5 and jj['over']['temporada']['B'][2] == 2
       and jj['over']['pais']['C'][2] == 4,
       'una clave vieja se junta con la de hoy: no pisa lo que ya tiene, y entre dos viejas va la fecha más vieja')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    sys.exit(correr('--aplicar' in sys.argv))

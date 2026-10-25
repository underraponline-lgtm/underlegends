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
    """Suma a `ganados` lo que hoy muestra cada carta (`textos`: `{clave: [t, c, s, p]}`), sólo lo que se guarda.
    Devuelve cuántos nuevos."""
    import catalogo_tags as CAT
    nuevos = 0
    for k, ts in textos.items():
        for carta, t in zip(CARTAS, ts):
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
                if tit and len(tit) <= 40:
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


def correr(aplicar):
    import catalogo_tags as CAT
    from comun import temporada as TM
    temp = TM.ACTUAL
    ganados = _leer(GANADOS)
    textos = {}
    CAT.de_cada_uno(textos)
    nuevos = sumar(ganados, textos, temp, int(time.time() * 1000))
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
    sumar(g, {'bea': ['👑 CAMPEÓN x3', '', '', '']}, 't1', 2)
    ok(g['bea']['temporada']['👑 CAMPEÓN x%d'] == ['👑 CAMPEÓN x3', 't1', 1], 'el número se pone al día y la fecha queda')
    el = revisar({'ana': {'temporada': '💀 REGICIDA', 'servidor': '👑 DUEÑO DE CASA'},
                  'bea': {'servidor': '🏛️ PILAR', 'temporada': 'pase:Pilar de UL', 'pais': 'auto'},
                  'cata': {'temporada': '💀 REGICIDA'}}, g, 't1')
    ok(el.get('ana') == {'temporada': ['💀 REGICIDA', 't1']} and 'cata' not in el
       and el['bea'] == {'servidor': ['🏛️ PILAR', 't2'], 'temporada': ['✨ PILAR DE UL', 't1']},
       'lo elegido: el que tiene pasa, uno de estado o que no tiene no, y el título del Pase como edición limitada')
    ok('servidor' not in revisar({'bea': {'servidor': '🏛️ PILAR'}}, g, 't2').get('bea', {}),
       'uno de temporada de una temporada que terminó ya no se pone')
    d = revisar({DUENO_K: {'temporada': '👑 CAMPEÓN x%d', 'servidor': '👑 DUEÑO DE CASA'}}, {}, 't1')
    ok(d.get(DUENO_K) == {'temporada': ['👑 CAMPEÓN', 't3']}, 'el dueño tiene todos los que se guardan (y los de estado tampoco)')
    ok(all(t in CAT.GRUPO for xs in CAT.CATALOGO.values() for t, _n, _p in xs), 'cada TAG del catálogo tiene su grupo')
    print('\n   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    sys.exit(correr('--aplicar' in sys.argv))

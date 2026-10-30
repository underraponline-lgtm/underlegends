# -*- coding: utf-8 -*-
"""👥 LAS CREWS QUE ARMA LA GENTE, PARA EL CICLO (Dlx, 19/10/2026; la lógica vive en bot/crews.js).

    python bot/crews_vivas.py             baja las crews del objeto y arma datos/crews.json (sólo si cambió)
    python bot/crews_vivas.py --sembrar   manda las 34 de datos/crews.json al objeto, UNA vez (con la clave del ciclo)
    python bot/crews_vivas.py --auto      el self-check, sin red

🔑 POR QUÉ SE ARMA `datos/crews.json` Y NO SE LEE EL OBJETO DESDE CADA LADO: las cuatro cartas, el payload de la página
(`subir_web._crews()`), los MES AWARDS (`mes_otros.py`) y el sello de las cartas (`que_cambio.huellas()`) leen las crews
de `comun/crews.py`, que lee ese archivo. Escribiéndolo con la misma forma, todo sigue andando sin tocar ninguno: es el
mismo camino que «tu servidor» (`comun/servidor_elegido.py`).

⚠️ Y CORRE ANTES DE TODO LO QUE DIBUJA (paso 0a2 de `bot/pipeline.py`): `comun/crews.py` lee el archivo AL IMPORTARSE.

🔴 SIN SEMBRAR, NO SE TOCA NADA. Hasta que las 34 de antes no estén en el objeto (`--sembrar`), el objeto contesta cero
crews, y escribir eso borraría todas las de la Liga de las cartas. Por eso: si el objeto no tiene ninguna y el archivo
sí, se avisa y se deja el archivo como está.

Los roles, los representantes y cómo se entra van aparte, en `datos/crews_vivas.json` (lo público del objeto, tal
cual: sin ningún Discord ID), para la página.
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'bot'))

RUTA = os.path.join(BASE, 'datos', 'crews.json')
VIVAS = os.path.join(BASE, 'datos', 'crews_vivas.json')
URL = 'https://underlegends.pages.dev/api/avisos/crews'
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
ORDEN_ROL = {'lider': 0, 'colider': 1, 'veterano': 2, 'miembro': 3}


def _json(ruta, defecto=None):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _escribir(ruta, d):
    """Escribe sólo si cambió: el ciclo commitea `datos/` y un commit por nada es ruido."""
    nuevo = json.dumps(d, ensure_ascii=False, indent=1) + '\n'
    try:
        with io.open(ruta, encoding='utf-8') as f:
            if f.read() == nuevo:
                return False
    except OSError:
        pass
    with io.open(ruta, 'w', encoding='utf-8', newline='\n') as f:
        f.write(nuevo)
    return True


def nombres_por_clave():
    """`{clave de perfil: nombre como lo escribe la Liga}`, del pool y del padrón (la clave de `comun/claves.py`)."""
    from comun.claves import clave
    out = {}
    for ruta in ('padron.json', 'competitivo_pool.json', 'temporada_pool.json'):
        for p in _json(os.path.join(BASE, 'datos', ruta), []) or []:
            raw = (p or {}).get('raw')
            if raw:
                out[clave(raw)] = raw
    return out


def puntos(pts, modo, n, reps):
    """Los puntos de una crew según el modo del Dashboard. ⚠️ El mismo que `puntosCrew()` de bot/crews.js."""
    vals = [float(v or 0) for v in (pts or {}).values()]
    if modo == 'todos':
        return sum(vals)
    if modo == 'reps' and reps:
        return sum(float((pts or {}).get(k) or 0) for k in list(reps)[:n])
    return sum(sorted(vals, reverse=True)[:n])


def armar(pub, viejo, nombres):
    """El `datos/crews.json` nuevo desde lo público del objeto: cada crew con su gente (por nombre), el líder primero.
    Lo que empieza con `_` (las notas, las bajas) se conserva; `_nombres` se rehace con los nombres del objeto."""
    out = {k: v for k, v in (viejo or {}).items() if k.startswith('_') and k != '_nombres'}
    crews, noms = {}, {}
    for c in (pub or {}).get('crews') or []:
        # 🪪 quien está sin verificarse (el cuarto lugar: hasta cuándo, `crewVerificar()` de bot/crews.js) no cuenta para
        # el ranking mientras tanto, y las cartas son de los verificados: afuera. Una crew sin nadie verificado, también
        gente = sorted((g for g in c.get('gente') or [] if not (len(g) > 3 and g[3])),
                       key=lambda g: (ORDEN_ROL.get(g[1], 9), g[2] if len(g) > 2 else 0))
        if not gente:
            continue
        # sin nombre conocido, la clave: `comun/crews.py` compara por clave, así que igual se encuentra
        crews[c['id']] = [nombres.get(g[0], g[0]) for g in gente]
        if c.get('nombre') and c['nombre'] != c['id']:
            noms[c['id']] = c['nombre']
    out['_nombres'] = noms
    out['crews'] = crews
    return out


def bajar(timeout=15):
    """Trae las crews del objeto y escribe los dos archivos si cambiaron. Devuelve lo público, o `None`."""
    try:
        import requests
        r = requests.get(URL, headers={'accept': 'application/json'}, timeout=timeout)
        r.raise_for_status()
        pub = r.json()  # ⚠️ `r.json()` y no `json.loads(r.text)`: sin charset, `requests` adivina (CLAUDE.md)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude leer las crews (%s): quedan las de antes' % str(e)[:80])
        return None
    viejo = _json(RUTA, {}) or {}
    if not (pub.get('crews') or []) and (viejo.get('crews') or {}):
        print('   ⚠️ el objeto todavía no tiene crews y datos/crews.json sí: falta `python bot/crews_vivas.py --sembrar`. '
              'No toco nada')
        return pub
    c1 = _escribir(RUTA, armar(pub, viejo, nombres_por_clave()))
    c2 = _escribir(VIVAS, dict({'_leeme': 'Lo público de las crews (bot/crews.js `crewsPublico()`): gente [clave, rol, '
                                          'desde], representantes, cómo se entra y el ranking del Dashboard. Sin ningún '
                                          'Discord ID. Lo escribe bot/crews_vivas.py'}, **{k: v for k, v in pub.items() if k != 't'}))
    print('   👥 %d crews, %d personas%s' % (len(pub.get('crews') or []), sum(len(c.get('gente') or []) for c in pub.get('crews') or []),
                                          ' · datos/crews.json cambió' if c1 else '') + (' · crews_vivas.json cambió' if c2 else ''))
    return pub


def para_sembrar(viejo):
    """Las crews de `datos/crews.json` como las toma `sembrar()` del objeto: `[{id, nombre, gente: [claves]}]`."""
    from comun.claves import clave
    noms = (viejo or {}).get('_nombres') or {}
    out = []
    for cid, gente in ((viejo or {}).get('crews') or {}).items():
        ks = []
        for n in gente:
            k = clave(n)
            if k and k not in ks:
                ks.append(k)
        out.append({'id': cid, 'nombre': noms.get(cid, cid), 'sigla': cid if 2 <= len(cid) <= 4 and cid.isalnum() else '',
                    'gente': ks})
    return out


def sembrar():
    import requests
    import clave_ciclo as CC
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('sin DISCORD_TOKEN: no puedo sembrar')
        return 1
    crews = para_sembrar(_json(RUTA, {}))
    r = requests.post(WORKER + '/avisos/crews-sembrar', data=json.dumps({'crews': crews}, ensure_ascii=False).encode('utf-8'),
                      headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=30)
    print(r.status_code, r.json() if r.headers.get('content-type', '').startswith('application/json') else r.text[:200])
    return 0 if r.ok else 1


# 🆕 EL RELANZAMIENTO (Dlx, 29/10/2026: «Dale con todo»). Las 27 sembradas el 19/10 las armó Dlx de un evento de crews
# viejo y casi nadie las usa: se quedan las tres que viven —Follombia, Knowledge Sombrío y Los ULEYES, la única fundada
# por la gente— y el resto se cierra, con un aviso a su gente para que funde o se sume a otra sin esperar.
QUEDAN = ('follombia', 'knowledge sombrio', 'los uleyes')
AVISO_CIERRE = ['🆕 Las crews se relanzan',
                '{nombre} se cerró con el relanzamiento de las crews. Ya puedes fundar la tuya en un toque o sumarte a otra, sin esperar.']


def _sin_tildes(x):
    import unicodedata
    return ''.join(ch for ch in unicodedata.normalize('NFKD', str(x or '').lower()) if not unicodedata.combining(ch)).strip()


def cerrar(si=False):
    """Sin `--si`, sólo dice cuáles se cerrarían. Con `--si`, las cierra (`/avisos/crews-cerrar`)."""
    import requests
    pub = requests.get(WORKER + '/avisos/crews', timeout=30).json()
    todas = pub.get('crews') or []
    quedan = [c for c in todas if _sin_tildes(c.get('nombre')) in QUEDAN]
    van = [c for c in todas if c not in quedan]
    print('se quedan (%d): %s' % (len(quedan), ', '.join(c['nombre'] for c in quedan)))
    print('se cierran (%d): %s' % (len(van), ', '.join('%s (%d)' % (c['nombre'], len(c.get('gente') or [])) for c in van)))
    if len(quedan) != len(QUEDAN):
        print('🔴 no encontré las %d que se quedan: no cierro nada' % len(QUEDAN))
        return 1
    if not si or not van:
        return 0
    import clave_ciclo as CC
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('sin DISCORD_TOKEN: no puedo cerrar')
        return 1
    r = requests.post(WORKER + '/avisos/crews-cerrar', data=json.dumps({'ids': [c['id'] for c in van], 'aviso': AVISO_CIERRE},
                                                                      ensure_ascii=False).encode('utf-8'),
                      headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=60)
    j = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
    print(r.status_code, 'cerradas:', len(j.get('cerradas') or []), '· no estaban:', j.get('no'))
    return 0 if r.ok and j.get('ok') else 1


def _auto():
    mal = []

    def ok(c, t):
        print(('   ✅ ' if c else '   🔴 ') + t)
        if not c:
            mal.append(t)
    pts = {'a': 100, 'b': 50, 'c': 30, 'd': 10}
    ok(puntos(pts, 'todos', 5, []) == 190 and puntos(pts, 'mejores', 2, []) == 150 and puntos(pts, 'reps', 2, ['c', 'd']) == 40
       and puntos(pts, 'reps', 2, []) == 150, 'el ranking, igual que puntosCrew() de bot/crews.js')
    viejo = {'_nota': 'x', '_nombres': {'KS': 'Knowledge Sombrío'}, 'crews': {'KS': ['Zignos']}}
    pub = {'crews': [{'id': 'KS', 'nombre': 'Knowledge Sombrío', 'gente': [['zig', 'miembro', 2], ['abyssus', 'lider', 1]]},
                     {'id': 'Los del Barrio', 'nombre': 'Los del Barrio', 'gente': [['dora', 'lider', 1]]}]}
    a = armar(pub, viejo, {'abyssus': 'Abyssus', 'dora': 'Dora'})
    ok(a['_nota'] == 'x' and a['crews']['KS'] == ['Abyssus', 'zig'] and a['_nombres'] == {'KS': 'Knowledge Sombrío'}
       and a['crews']['Los del Barrio'] == ['Dora'], 'armar: el líder primero, sin nombre la clave, las notas quedan')
    a = armar({'crews': [{'id': 'KS', 'nombre': 'KS', 'gente': [['abyssus', 'lider', 1], ['zig', 'miembro', 2, 99]]},
                         {'id': 'Sola', 'nombre': 'Sola', 'gente': [['x', 'lider', 1, 99]]}]}, {}, {})
    ok(a['crews'] == {'KS': ['abyssus']}, 'armar: sin quien está sin verificar, ni la crew sin nadie verificado')
    s = para_sembrar({'_nombres': {'KS': 'Knowledge Sombrío'}, 'crews': {'KS': ['Zignos', 'Abyssus', 'zignos'],
                                                                          'Follombia': ['Lázaro']}})
    ok(s[0] == {'id': 'KS', 'nombre': 'Knowledge Sombrío', 'sigla': 'KS', 'gente': ['zignos', 'abyssus']}
       and s[1]['gente'] == ['lazaro'] and s[1]['sigla'] == '', 'sembrar: por clave, sin repetidos, la sigla si el id es una')
    # el seguro: un objeto vacío no borra las crews del archivo
    print('   %s' % ('🔴 %d mal' % len(mal) if mal else 'todo bien'))
    return 1 if mal else 0


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(_auto())
    if '--sembrar' in sys.argv:
        sys.exit(sembrar())
    if '--cerrar' in sys.argv:
        sys.exit(cerrar('--si' in sys.argv))
    bajar()

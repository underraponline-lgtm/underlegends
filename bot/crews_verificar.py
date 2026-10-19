# -*- coding: utf-8 -*-
"""🪪 LOS DE LAS CREWS QUE NO ESTÁN VERIFICADOS (Dlx, 19/10/2026: «darles 7 días pero mencionarles en el sv más activo q están»).

    python bot/crews_verificar.py          manda la lista al objeto (lo corre el ciclo, paso 0a2, antes de crews_vivas)
    python bot/crews_verificar.py --ver    cuántos y de qué crews, sin mandar nada
    python bot/crews_verificar.py --auto   el self-check, sin red

Las 34 crews de antes se sembraron con la lista de Dlx, y 41 de sus 101 personas no son Miembros de DRA. Crear una crew
y entrar a una ya lo piden; éstas entraron antes de la regla. Lo que pasa con ellas vive en `crewVerificar()` de
bot/crews.js: 7 días, el Líder sin verificar le pasa la crew al primero que sí, y una mención en el chat general de su
servidor, una sola vez. Acá se decide QUIÉN y DÓNDE:

- 🔑 QUIÉN, CON LA REGLA DEL PORTÓN (`verificados.pasa()`): Discord ID, país y el rol Miembro. Es la misma que decide
  quién tiene carta y quién entra a la tabla `persona` del objeto, que es lo que miran crear, entrar e invitar.
- DÓNDE, el servidor donde más jugó (`sv` del pool de la Temporada) si sigue ahí; si no, uno donde está
  (`datos/servidores_de.json`); sin ninguno, el objeto lo menciona en DRA, que es donde se verifica.

⚠️ EL LOG DEL CICLO ES PÚBLICO: acá se imprimen cuántos y de qué crews, nunca un Discord ID.

🔴 DOS SEGUROS, los dos para el mismo error: un padrón o unos verificados a medias marcarían a todos. Si
`datos/verificados.json` trae menos de `MIN_VERIF` IDs, no se manda nada; y si la lista trae a más de `TOPE` de
todos, tampoco (el objeto tiene el suyo, `PEND_TOPE`).
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'bot'))

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
MIN_VERIF = 1000
TOPE = 0.6


def _json(nombre, defecto=None):
    try:
        with io.open(os.path.join(BASE, 'datos', nombre), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def donde(sv_pool, svs):
    """El servidor más activo de alguien: donde más jugó si sigue ahí; si no, uno donde está; `''` sin ninguno."""
    svs = [s for s in (svs or []) if s]
    if sv_pool and (not svs or sv_pool in svs):
        return sv_pool
    return svs[0] if svs else ''


def lista(vivas, padron, verif, pool, servidores_de):
    """`[{k, id, sv, n}]`: los de las crews que no pasan el portón. Pura."""
    import verificados as VERIF
    from comun.claves import clave
    por_clave = {}
    for p in padron or []:
        if p.get('raw'):
            por_clave.setdefault(clave(p['raw']), p)
    sv_de = {clave(p['raw']): p.get('sv') or '' for p in pool or [] if p.get('raw')}
    out = []
    for c in (vivas or {}).get('crews') or []:
        for g in c.get('gente') or []:
            k = g[0]
            p = por_clave.get(k)
            if p and VERIF.pasa(p, verif):
                continue
            did = str((p or {}).get('discord_id') or '')
            out.append({'k': k, 'id': did, 'n': (p or {}).get('raw') or k, 'crew': c.get('id') or '',
                        'sv': donde(sv_de.get(k, ''), (servidores_de or {}).get(did) if did else [])})
    return out


def correr(mandar=True):
    import verificados as VERIF
    vivas = _json('crews_vivas.json')
    if not vivas:
        print('   ⚠️ sin datos/crews_vivas.json: no hay crews que mirar')
        return 0
    verif, _ = VERIF.cargar()
    if verif is None or len(verif) < MIN_VERIF:
        print('   🔴 datos/verificados.json trae %s IDs (menos de %d): no marco a nadie'
              % ('—' if verif is None else len(verif), MIN_VERIF))
        return 0
    sin = lista(vivas, _json('padron.json', []), verif, _json('temporada_pool.json', []), _json('servidores_de.json', {}))
    total = sum(len(c.get('gente') or []) for c in vivas.get('crews') or [])
    crews = {}
    for x in sin:
        crews[x['crew']] = crews.get(x['crew'], 0) + 1
    con_id = sum(1 for x in sin if x['id'])
    print('   🪪 %d de %d sin verificar (%d con cuenta de Discord) en %d crews' % (len(sin), total, con_id, len(crews)))
    if total and len(sin) > total * TOPE:
        print('   🔴 son más del %d %%: algo anda mal con el padrón o los verificados. No mando nada' % int(TOPE * 100))
        return 0
    if not mandar:
        for c, n in sorted(crews.items(), key=lambda x: -x[1]):
            print('      %-28s %d' % (c[:28], n))
        return 0
    import requests
    import clave_ciclo as CC
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: no mando nada')
        return 0
    cuerpo = {'sin': [{k: x[k] for k in ('k', 'id', 'sv', 'n')} for x in sin]}
    try:
        r = requests.post(WORKER + '/avisos/crews-verificar', data=json.dumps(cuerpo, ensure_ascii=False).encode('utf-8'),
                          headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=60)
        j = r.json()  # ⚠️ `r.json()` y no `json.loads(r.text)`: sin charset, `requests` adivina (CLAUDE.md)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ no pude mandarlo (%s): queda para la corrida siguiente' % str(e)[:80])
        return 0
    if not r.ok:
        print('   ⚠️ el objeto dijo %s: %s' % (r.status_code, json.dumps(j, ensure_ascii=False)[:160]))
        return 0
    print('   ✅ %d marcados ahora · %d se verificaron · %d líderes cambiados · mencionados: %s'
          % (j.get('marcados', 0), j.get('verificados', 0), j.get('lideres', 0),
             ', '.join('%s %s' % (k, v) for k, v in (j.get('anunciados') or {}).items()) or 'nadie nuevo'))
    return 0


def _auto():
    mal = []

    def ok(c, t):
        print(('   ✅ ' if c else '   🔴 ') + t)
        if not c:
            mal.append(t)
    ok(donde('FFA', ['DRA', 'FFA']) == 'FFA' and donde('FFA', ['DRA']) == 'DRA' and donde('FFA', []) == 'FFA'
       and donde('', ['SR']) == 'SR' and donde('', []) == '', 'donde: donde juega si sigue ahí, si no donde está')
    vivas ={'crews': [{'id': 'KS', 'gente': [['abyssus', 'lider', 1], ['zig', 'miembro', 2], ['nadie', 'miembro', 3]]}]}
    padron = [{'raw': 'Abyssus', 'discord_id': '11111', 'pais': 'Chile'},
              {'raw': 'Zig', 'discord_id': '22222', 'pais': 'Chile'}]
    l = lista(vivas, padron, {'11111'}, [{'raw': 'Zig', 'sv': 'FFA'}], {'22222': ['FFA', 'DRA']})
    ok([x['k'] for x in l] == ['zig', 'nadie'], 'quien no pasa el portón, y quien no está en la Lista')
    ok(l[0]['id'] == '22222' and l[0]['sv'] == 'FFA' and l[0]['crew'] == 'KS' and l[0]['n'] == 'Zig',
       'con su cuenta, su servidor y su crew')
    ok(l[1]['id'] == '' and l[1]['sv'] == '' and l[1]['n'] == 'nadie', 'sin padrón: sin cuenta, por su clave')
    print('   %s' % ('🔴 %d mal' % len(mal) if mal else 'todo bien'))
    return 1 if mal else 0


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(_auto())
    sys.exit(correr(mandar='--ver' not in sys.argv))

# -*- coding: utf-8 -*-
"""🏷️ LOS ROLES DE CADA UNO EN LA PÁGINA: los que salen solos, por persona, para el objeto.

    python bot/roles.py            cuántos de cada uno (no escribe nada)
    python bot/roles.py --aplicar  se los pasa al objeto (con la clave del ciclo)
    python bot/roles.py --auto     self-check, sin red

🔑 Dlx, 13/10/2026: *«en cada perfil aparezca el rol de cada uno. O sea si alguien es competidor, organizador, staff, o
roles superiores ÚNICAMENTE decididos por mí: Moderador de la página web, asistente, Admin y owner únicamente yo»*, y
*«agrega el título de socio para los owners de los servidores asociados»*. A la pregunta de dónde salen, *«Solos, de
Discord»*, y a si dan permisos, *«Sólo insignia por ahora»*.

LOS QUE SALEN SOLOS
-------------------
· COMPETIDOR: jugó en la temporada (está en `datos/temporada_pool.json`).
· ORGANIZADOR, JURADO, HOST y STAFF: el rol que le da cada servidor de la Liga, por el nombre del rol
  (`herramientas/servidores_de.tipo_de_rol()`, en `datos/roles_discord.json`). Con el servidor donde lo es.
· SOCIO: el dueño de un servidor de la Liga, según Discord.
· OWNER: Dlx (`verificados.DUENO`), y nadie más.

Los que pone Dlx —Moderador, Asistente, Admin— y lo que corrige de los de arriba viven en el objeto (`roles_manual`), y
el objeto junta las dos cosas para la página (`/avisos/roles`). Esto le manda el DIRECTORIO: cada persona de la Lista con
Discord ID, su clave de perfil, su nombre y sus roles solos. Con eso el Dashboard la encuentra por el nombre.

⚠️ LOS IDS VAN AL OBJETO, NO AL REPO NI AL LOG: el log dice cuántos.
"""
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
#: los que salen solos, en el orden en que se muestran (los de Dlx van antes: ver `ORDEN` en bot/avisos.js)
AUTO = ('owner', 'socio', 'staff', 'organizador', 'jurado', 'host', 'competidor')


def _json(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def armar(padron, pool, discord_roles, clave, dueno):
    """`[{k, n, id, a: {rol: [servidores]}}]`: cada persona de la Lista con Discord ID. Pura."""
    por_id = {str(p.get('discord_id')): p for p in pool or [] if p.get('discord_id')}
    por_raw = {str(p.get('raw') or ''): p for p in pool or [] if p.get('raw')}
    out = []
    for x in padron or []:
        did = str(x.get('discord_id') or '')
        raw = str(x.get('raw') or '').strip()
        if not did or not raw:
            continue
        fila = por_id.get(did) or por_raw.get(raw)
        k = clave({'raw': (fila or {}).get('raw') or raw, 'cc': (fila or {}).get('cc') or ''})
        a = {}
        if did == str(dueno):
            a['owner'] = []
        for t in AUTO:
            if t in ('owner', 'competidor'):
                continue
            svs = (discord_roles.get(t) or {}).get(did)
            if svs:
                a[t] = list(svs)
        if fila and (fila.get('ev') or 0) >= 1:
            a['competidor'] = []
        out.append({'k': k, 'n': x.get('full') or raw, 'id': did, 'a': a})
    return out


def correr(aplicar=False):
    import subir_web as SW
    import verificados as V
    padron = _json('datos', 'padron.json') or []
    pool = _json('datos', 'temporada_pool.json') or []
    dr = _json('datos', 'roles_discord.json') or {}
    if not dr:
        print('   ⚠️ no está datos/roles_discord.json: salen sólo Competidor y Owner')
    d = armar(padron, pool, dr, SW._clave, V.DUENO)
    from collections import Counter
    c = Counter(t for x in d for t in x['a'])
    print('   %d personas de la Lista con Discord · %s' % (len(d), ' · '.join('%d %s' % (c[t], t) for t in AUTO if c[t])))
    if not aplicar:
        print('\n   (simulacro: no mandé nada — corré con --aplicar)\n')
        return 0
    import requests
    import fotos as F
    import clave_ciclo as CC
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: no lo mando')
        return 0
    try:
        r = requests.post(WORKER + '/avisos/roles-estados', data=json.dumps({'dir': d}, ensure_ascii=False).encode('utf-8'),
                          headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=40)
        print('   %s' % ('✅ al objeto' if r.ok else '⚠️ el objeto contestó %s' % r.status_code))
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ el objeto no contestó (%s)' % str(e)[:60])
    return 0


def _self_check():
    print('\n  roles.py — self-check\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))

    pad = [{'raw': 'Konan', 'full': 'Konan 🇦🇷', 'discord_id': '1'}, {'raw': 'Org', 'full': 'Org 🇨🇱', 'discord_id': '2'},
           {'raw': 'Dlx', 'full': 'DLX 🇺🇸', 'discord_id': '9'}, {'raw': 'SinId', 'full': 'SinId'}]
    pool = [{'raw': 'Konan', 'cc': 'ar', 'discord_id': '1', 'ev': 4}, {'raw': 'Org', 'cc': 'cl', 'ev': 0}]
    dr = {'organizador': {'2': ['FFA', 'DDF']}, 'staff': {'2': ['FFA']}, 'socio': {'9': ['DRA']}, 'jurado': {}}
    d = armar(pad, pool, dr, lambda p: p['raw'].lower(), '9')
    by = {x['n']: x for x in d}
    ok(len(d) == 3 and 'SinId' not in by, 'sólo la gente de la Lista con Discord ID')
    ok(by['Konan 🇦🇷']['a'] == {'competidor': []} and by['Konan 🇦🇷']['k'] == 'konan', 'jugó: Competidor, con su clave')
    ok(by['Org 🇨🇱']['a'] == {'organizador': ['FFA', 'DDF'], 'staff': ['FFA']}, 'el rol de cada servidor, con el servidor')
    ok(set(by['DLX 🇺🇸']['a']) == {'owner', 'socio'}, 'Owner sólo Dlx, y Socio por ser dueño')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    print('\n══ 🏷️ LOS ROLES DE LA PÁGINA ══\n')
    return correr(aplicar='--aplicar' in sys.argv)


if __name__ == '__main__':
    sys.exit(main())

# -*- coding: utf-8 -*-
"""🧰 EL KIT DE CADA SERVIDOR: SU PÁGINA PRIVADA, A LA QUE SÓLO SE ENTRA CON EL LINK.

    python bot/kits.py              arma y muestra, sin subir nada
    python bot/kits.py --aplicar    sube a R2 lo que cambió (lo hace el ciclo, paso 2b11)
    python bot/kits.py --links      los links de cada servidor y el índice de Dlx (sólo en una máquina con .env)
    python bot/kits.py --auto       self-check

Dlx, 17/11/2026: *«crea un apartado específico en la página donde solamente el que tenga el link puede entrar, y yo
obviamente, donde ahí estarían todos los beneficios, tutoriales, y finalmente el link con permiso de admin en su rol
propio para evitar problemas así. Su tier y otras cosas»*. «Problemas así»: el informe de los lunes (`salud_lector.py`)
decía que al bot le faltaban permisos en seis servidores —en CH y DDS el #N del apodo prendido y el bot sin «Gestionar
apodos» (271 apodos sin poner en cada corrida), en FVS ni siquiera leer el historial—, porque el kit invitaba con
`permissions=66561` (ver canales, historial, invitaciones).

🔑 CÓMO ES PRIVADO SIN LOGIN Y SIN TOCAR EL WORKER. Cada servidor tiene un código que sale de un HMAC de su guild con
`FOTOS_SAL` (`codigo()`): no se puede adivinar ni está en el repo, que es público. El kit va a R2 como
`kits/<código>.json` y la página (`web/src/kit.jsx`, ruta `/freestyle-rap/kit/<código>`) lo pide de ahí; R2 no lista sus
archivos, así que sin el código no se encuentra. Dlx tiene un índice con todos (`kits/<código del índice>.json`).
⚠️ Si `FOTOS_SAL` se rota (al final, con los demás tokens), todos los links cambian: `--links` da los nuevos.

Lo que lleva cada kit: el servidor y su tier, los beneficios que tiene prendidos (`datos/niveles.json`, los nombres de
`tiers.BENEFICIOS`), cómo está el bot ahí (adentro o no, administrador, qué permiso falta, cuántos roles tiene por encima
—un apodo no se puede cambiar a quien tiene un rol más alto que el del bot—), el link para agregarlo con
Administrador y su rol propio, y los links de su dashboard y de la invitación de su servidor. Los tutoriales viven en la
página: son iguales para todos.
"""
import hashlib
import hmac
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

APP = '1550026808404217926'
WEB = 'https://underlegends.pages.dev'
#: Administrador (8): el bot entra con su rol propio, el que Discord crea con el nombre del bot. Con los comandos
INVITAR = ('https://discord.com/oauth2/authorize?client_id=%s&permissions=8&integration_type=0'
           '&scope=bot+applications.commands' % APP)
PREFIJO = 'kits/'


def _j(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _sal():
    """`FOTOS_SAL` del entorno o de `.env`; `None` si no está (sin ella no hay links: no se inventa otra)."""
    v = os.environ.get('FOTOS_SAL')
    if v:
        return v
    try:
        for linea in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
            if linea.strip().startswith('FOTOS_SAL='):
                return linea.split('=', 1)[1].strip().strip('"\'') or None
    except OSError:
        pass
    return None


def codigo(que, sal):
    """El código de un kit: 20 caracteres de un HMAC. `que` es el guild, o «indice» para el de Dlx."""
    return hmac.new(sal.encode('utf-8'), ('kit:' + str(que)).encode('utf-8'), hashlib.sha256).hexdigest()[:20]


def link(cod):
    return '%s/freestyle-rap/kit/%s' % (WEB, cod)


def estado_bot(gid, tok=None):
    """`{'en': bool, 'admin': bool, 'faltan': [...], 'arriba': n}` del bot en ese servidor, o `None` si no se pudo
    preguntar. `arriba`: los roles por encima del más alto del bot (a esa gente no le puede cambiar el apodo)."""
    import requests
    import salud_lector as SL
    if tok is None:
        try:
            import avisar
            tok = avisar._token()
        except Exception:                                # noqa: BLE001
            tok = None
    if not tok:
        return None
    cab = {'Authorization': 'Bot ' + tok}
    try:
        m = requests.get('https://discord.com/api/v10/guilds/%s/members/%s' % (gid, APP), headers=cab, timeout=20)
        if m.status_code == 404:
            return {'en': False, 'admin': False, 'faltan': [], 'arriba': 0}
        rs = requests.get('https://discord.com/api/v10/guilds/%s/roles' % gid, headers=cab, timeout=20)
        if m.status_code != 200 or rs.status_code != 200:
            return None
        mios = set(m.json().get('roles') or []) | {str(gid)}
        roles = rs.json()
        p, alto = 0, 0
        for r in roles:
            if r.get('id') in mios:
                p |= int(r.get('permissions') or 0)
                alto = max(alto, int(r.get('position') or 0))
        admin = bool(p & 8)
        faltan = [] if admin else [q for b, q in SL.PERMISOS if not p & b]
        arriba = sum(1 for r in roles if int(r.get('position') or 0) > alto)
        return {'en': True, 'admin': admin, 'faltan': faltan, 'arriba': arriba}
    except Exception:                                    # noqa: BLE001
        return None


def armar(sal, servidores=None, niveles=None, estado=estado_bot):
    """`({código: kit}, {código del índice: índice})`. Puro salvo `estado` (Discord)."""
    import siglas
    import tiers as TI
    svs = (servidores if servidores is not None else (_j('datos', 'servidores.json') or {}).get('servidores')) or {}
    nv = niveles if niveles is not None else (_j('datos', 'niveles.json') or {})
    tier_de, ben_de = nv.get('niveles') or {}, nv.get('beneficios') or {}
    kits, filas = {}, []
    for sv, x in sorted(svs.items()):
        if not isinstance(x, dict) or not x.get('confirmado') or not x.get('guild_id') or sv not in tier_de:
            continue
        gid = str(x['guild_id'])
        cod = codigo(gid, sal)
        bn = ben_de.get(sv) or {}
        logo = os.path.join(BASE, 'bot', 'paginas', 'logos', sv.lower() + '.webp')
        k = {'v': 1, 'sv': sv, 'sigla': siglas.sigla(sv), 'nombre': x.get('nombre') or sv,
             'logo': '/logos/%s.webp' % sv.lower() if os.path.exists(logo) else '',
             'tier': tier_de.get(sv), 'beneficios': [[b, q, bool(bn.get(b))] for b, q in TI.BENEFICIOS],
             'bot': estado(gid) if estado else None,
             'invitar': INVITAR + '&guild_id=%s&disable_guild_select=true' % gid,
             'invitacion': x.get('invitacion') or '', 'dashboard': WEB + '/freestyle-rap/socio'}
        kits[cod] = k
        filas.append([k['sigla'], k['nombre'], k['tier'], link(cod), (k['bot'] or {}).get('admin')])
    ind = {'v': 1, 'indice': filas}
    return kits, {codigo('indice', sal): ind}


def subir(archivos):
    """Sube a R2 los `{código: json}` que cambiaron (el etag de R2 es el md5) y borra los kits que ya no están.
    `(subidos, borrados)`, o `None` si no se pudo leer R2."""
    import subir_cartas as SC
    try:
        s = SC.sesion()
        arriba, cursor = {}, None
        while True:
            q = {'per_page': 1000, 'prefix': PREFIJO}
            if cursor:
                q['cursor'] = cursor
            d = s.get(SC.API + '/objects', params=q, timeout=60).json()
            if not d.get('success'):
                return None
            for o in d.get('result') or []:
                arriba[o['key']] = (o.get('etag') or '').strip('"')
            cursor = (d.get('result_info') or {}).get('cursor')
            if not cursor:
                break
    except Exception:                                    # noqa: BLE001
        return None
    sub = bor = 0
    for cod, obj in archivos.items():
        b = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        clave = '%s%s.json' % (PREFIJO, cod)
        if arriba.get(clave) == hashlib.md5(b).hexdigest():
            continue
        r = s.put('%s/objects/%s' % (SC.API, clave), data=b, timeout=60, headers={'Content-Type': 'application/json; charset=utf-8'})
        sub += 1 if SC._ok(r, clave) is not None else 0
    for clave in arriba:
        if clave[len(PREFIJO):-5] not in archivos:
            if SC._ok(s.delete('%s/objects/%s' % (SC.API, clave), timeout=60), clave) is not None:
                bor += 1
    return sub, bor


def _self_check():
    mal = [0]

    def ok(c, t):
        mal[0] += not c
        print('   %s %s' % ('✅' if c else '🔴', t))

    print('\n══ EL KIT DE CADA SERVIDOR ══\n')
    svs = {'FFA': {'nombre': 'Freestyle For All', 'guild_id': '111', 'confirmado': True, 'invitacion': 'https://discord.gg/x'},
           'XX': {'nombre': 'Sin confirmar', 'guild_id': '222'},
           'CEU': {'nombre': 'Ceuta', 'guild_id': '333', 'confirmado': True}}
    nv = {'niveles': {'FFA': 1, 'CEU': 3}, 'beneficios': {'FFA': {'pagina': True, 'suma': True, 'competitivo': True},
                                                          'CEU': {'pagina': True, 'suma': True}}}
    est = {'111': {'en': True, 'admin': False, 'faltan': ['Gestionar apodos (el puesto en el apodo)'], 'arriba': 3},
           '333': {'en': False, 'admin': False, 'faltan': [], 'arriba': 0}}
    kits, ind = armar('sal-de-prueba', svs, nv, estado=lambda g: est.get(g))
    c_ffa, c_ceu = codigo('111', 'sal-de-prueba'), codigo('333', 'sal-de-prueba')
    ok(set(kits) == {c_ffa, c_ceu} and len(c_ffa) == 20 and c_ffa != codigo('111', 'otra-sal'),
       'un kit por servidor confirmado y en la Liga, con un código de 20 que depende de la sal')
    k = kits[c_ffa]
    ok(k['tier'] == 1 and ['competitivo', 'Sus llaves cuentan para el Competitivo y los duelos', True] in k['beneficios']
       and ['ligas', 'Sus ligas en Ligas', False] in k['beneficios'], 'su tier y cada beneficio, prendido o no')
    ok('permissions=8' in k['invitar'] and 'guild_id=111' in k['invitar'] and 'disable_guild_select=true' in k['invitar'],
       'el link del bot: Administrador, con su rol propio, y ya elegido su servidor')
    ok(k['bot']['faltan'] and kits[c_ceu]['bot']['en'] is False, 'cómo está el bot: lo que falta, o que no está')
    ix = list(ind.values())[0]['indice']
    ok(len(ix) == 2 and all(f[3].endswith('/kit/' + c) for f, c in zip(sorted(ix), sorted([c_ceu, c_ffa], key=lambda c: kits[c]['sigla']))) is not None
       and '111' not in json.dumps(ix) and list(ind)[0] == codigo('indice', 'sal-de-prueba'),
       'el índice de Dlx: los links de todos, sin guilds')
    print('\n   %s' % ('todo bien' if not mal[0] else '🔴 %d mal' % mal[0]))
    return 1 if mal[0] else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass
    if '--auto' in sys.argv:
        return _self_check()
    sal = _sal()
    if not sal:
        print('🧰 sin FOTOS_SAL no hay kits (no se inventa otra sal): no hago nada')
        return 0
    kits, ind = armar(sal)
    if '--links' in sys.argv:
        for cod, k in sorted(kits.items(), key=lambda x: x[1]['sigla']):
            print('   %-5s Tier %s  %s' % (k['sigla'], k['tier'], link(cod)))
        print('\n   el índice (Dlx): %s' % link(list(ind)[0]))
        return 0
    sin = [k['sigla'] for k in kits.values() if (k['bot'] or {}).get('en') and not (k['bot'] or {}).get('admin')]
    fuera = [k['sigla'] for k in kits.values() if k['bot'] and not k['bot'].get('en')]
    print('🧰 %d kit(s) · el bot sin Administrador en: %s · sin el bot: %s'
          % (len(kits), ', '.join(sorted(sin)) or 'ninguno', ', '.join(sorted(fuera)) or 'ninguno'))
    if '--aplicar' in sys.argv:
        r = subir(dict(kits, **ind))
        print('   %s' % ('🟡 no pude leer R2' if r is None else '✓ iguales' if r == (0, 0) else '✅ %d subido(s), %d borrado(s)' % r))
    return 0


if __name__ == '__main__':
    sys.exit(main())

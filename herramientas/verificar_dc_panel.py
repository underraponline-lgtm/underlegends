# -*- coding: utf-8 -*-
"""✅ EL PANEL DE VERIFICACIÓN DE DRA, CON NUESTRO BOT (28/11/2026).

    python herramientas/verificar_dc_panel.py             qué haría, sin tocar nada (sólo lee Discord)
    python herramientas/verificar_dc_panel.py --publicar  sube el banner a R2 (si cambió) y publica el panel UNA vez,
                                                          o pone al día el que ya está
    python herramientas/verificar_dc_panel.py --sembrar   los AKA de los Miembros de DRA («X | AKA») al objeto, para
                                                          que nadie nuevo tome el de alguien que ya está
    python herramientas/verificar_dc_panel.py --auto      el self-check, sin red

Por qué: el de YAGPDB (•「✅」verificate-aqui) dejó de verificar. Su último «✅ Nuevo verificado en Liga Global» en el hilo
LIGA GLOBAL ID es del 07/10/2026, y en el registro de auditoría de DRA (45 días, del 14/10 al 28/11) YAGPDB sólo puso
el 🆕 Invitado al entrar: ni un rol de país ni un Miembro. El flujo entero vive en `bot/verificar_dc.js`.

QUÉ MIRA SIN FLAGS
------------------
· el canal que termina en «verificate-aqui» (y que no esté en el ARCHIVO), el panel de YAGPDB y si ya hay uno nuestro
· que los 21 países del menú (`PAISES` de bot/verificar_dc.js) tengan su rol en DRA y sean los de `sheet/pais_por_rol.py`,
  y que el Miembro y el Invitado sean los de `bot/verificados.py` y `datos/servidores.json`
· que el rol más alto del bot esté ARRIBA del Miembro, del Invitado y de todos los países, y que pueda gestionar roles
· los hilos de los avisos y el canal de la bienvenida
· cuántos AKA sembraría `--sembrar`

⚠️ EL MENSAJE LO ARMA EL WORKER (`panelMsg()`), no esta herramienta: se lee de bot/verificar_dc.js con Node para no
tener una segunda copia de la lista de países.
⚠️ Sin flags sólo LEE. Lo que escribe (R2, el mensaje, el objeto) es sólo con `--publicar` o `--sembrar`.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

GUILD = '841017460341604382'
API = 'https://discord.com/api/v10'
UA = 'DiscordBot (https://underlegends.pages.dev, 1)'
FIN = 'verificate-aqui'
IMG = os.path.join(BASE, 'bot', 'paneles_img', 'verificate.png')
ID_YAGPDB = 'templates-verification_country_select'
ADMIN, GESTIONAR_ROLES = 1 << 3, 1 << 28


def nfkd(s):
    return unicodedata.normalize('NFKD', s or '')


def desde_js():
    """Lo que dice bot/verificar_dc.js: países, roles, canales y el panel (sin imagen). Con Node, una sola fuente."""
    cod = ("import * as V from './verificar_dc.js'; console.log(JSON.stringify({paises: V.PAISES, miembro: V.ROL_MIEMBRO,"
           " invitado: V.ROL_INVITADO, brasil: V.ROL_BRASIL, hilos: [V.HILO_INVITES, V.HILO_VERIF], bienvenida: V.CANAL_BIENVENIDA,"
           " nuevos: V.CANAL_NUEVOS, empieza: V.CANAL_EMPIEZA, r2: V.R2_PANELES, panel: V.panelMsg()}))")
    r = subprocess.run(['node', '--input-type=module', '-e', cod], cwd=os.path.join(BASE, 'bot'), capture_output=True,
                       timeout=60)
    if r.returncode:
        raise SystemExit('🔴 no pude leer bot/verificar_dc.js con Node: ' + r.stderr.decode('utf-8', 'replace')[:300])
    return json.loads(r.stdout.decode('utf-8'))


def elegir(canales, fin):
    """El canal de texto que termina en `fin`, sin los del ARCHIVO si hay otro. `(canal, motivo)`."""
    cats = {c['id']: c.get('name') or '' for c in canales if c.get('type') == 4}
    cand = [c for c in canales if c.get('type') in (0, 5) and nfkd(c.get('name')).endswith(fin)]
    if len(cand) > 1:
        cand = [c for c in cand if 'ARCHIVO' not in nfkd(cats.get(c.get('parent_id') or '', '')).upper()] or cand
    if not cand:
        return None, 'no hay ningún canal que termine en «%s»' % fin
    if len(cand) > 1:
        return None, 'hay %d canales que terminan en «%s»' % (len(cand), fin)
    return cand[0], ''


def jerarquia(roles, bot_roles, necesarios):
    """`(alto, faltan, puede)`: la posición más alta del bot, los roles necesarios que NO quedan por debajo, y si sus roles
    le dan Administrador o Gestionar roles. Discord sólo deja tocar roles estrictamente por debajo del más alto del bot."""
    pos = {r['id']: r for r in roles}
    alto = max([pos[r]['position'] for r in bot_roles if r in pos] or [0])
    faltan = [r for r in necesarios if r not in pos or pos[r]['position'] >= alto]
    perm = 0
    for r in bot_roles:
        if r in pos:
            perm |= int(pos[r]['permissions'])
    return alto, faltan, bool(perm & (ADMIN | GESTIONAR_ROLES))


def akas_de(miembros, rol_miembro, aka_de):
    """`[[aka, id], …]` de los Miembros cuyo apodo es «X | AKA» (sin bots, sin repetir: gana el primero)."""
    out, vistos = [], set()
    for m in miembros:
        u = m.get('user') or {}
        if u.get('bot') or rol_miembro not in (m.get('roles') or []):
            continue
        a = aka_de(m.get('nick') or '')
        if a and a not in vistos:
            vistos.add(a)
            out.append([a, u.get('id')])
    return out


def aka_de_apodo(nick):
    """La misma regla que `akaDeApodo()` de bot/verificar_dc.js: lo que va después de la última « | », normalizado."""
    p = str(nick or '').split(' | ')
    if len(p) < 2:
        return ''
    a = re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', p[-1]).lower()).strip()
    return a if a and len(a) <= 32 else ''


def _token():
    tok = os.environ.get('DISCORD_TOKEN')
    if tok:
        return tok
    import fotos as F
    return F.env('DISCORD_TOKEN')


def subir_banner():
    """El banner a R2, con su huella en el nombre (Discord guarda lo que bajó de una URL). Si ya está, no se sube."""
    import requests
    import subir_cartas as SC
    with open(IMG, 'rb') as f:
        png = f.read()
    clave = 'paneles/verificate-%s.png' % hashlib.sha1(png).hexdigest()[:10]
    url = '%s/%s' % (SC.PUBLICA, clave)
    if requests.head(url, timeout=20).status_code == 200:
        print('   🖼️ el banner ya está en R2: %s' % url)
        return url
    r = SC.sesion().put('%s/objects/%s' % (SC.API, clave), data=png, headers={'Content-Type': 'image/png'}, timeout=60)
    if SC._ok(r, clave) is None:
        raise SystemExit('🔴 el banner no subió a R2')
    print('   🖼️ banner subido: %s' % url)
    return url


def main(publicar, sembrar):
    import requests
    js = desde_js()
    tok = _token()
    H = {'Authorization': 'Bot ' + tok, 'User-Agent': UA}

    def get(ruta):
        r = requests.get(API + ruta, headers=H, timeout=30)
        return r.json() if r.status_code == 200 else None
    canales, roles = get('/guilds/%s/channels' % GUILD), get('/guilds/%s/roles' % GUILD)
    yo = get('/users/@me') or {}
    bm = get('/guilds/%s/members/%s' % (GUILD, yo.get('id'))) or {}
    if not canales or not roles or not bm:
        print('🔴 Discord no me dio los canales, los roles o el bot en DRA')
        return 1
    fallas = 0
    canal, mot = elegir(canales, FIN)
    if not canal:
        print('🔴 ' + mot)
        return 1
    print('✅ el panel va en #%s (%s)' % (nfkd(canal['name']), canal['id']))
    por_id = {r['id']: r for r in roles}
    # los países
    import pais_por_rol as PR
    import verificados as VE
    with open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        inv_py = ((json.load(f).get('canales') or {}).get('DRA') or {}).get('rol_invitado')
    print('\n🌎 los %d países del menú → su rol en DRA' % len(js['paises']))
    for cc, k, n, rol in js['paises']:
        r = por_id.get(rol)
        mal = [] if r else ['NO EXISTE EN DRA']
        if PR.ROLES.get(rol) != cc:
            mal.append('pais_por_rol dice %r' % PR.ROLES.get(rol))
        fallas += bool(mal)
        print('   %s %-2s %-21s %-15s %s %s' % ('✅' if not mal else '❌', cc, n, k, nfkd(r['name']) if r else rol, ' · '.join(mal)))
    sobra = sorted(set(PR.ROLES) - {p[3] for p in js['paises']} - {js['brasil']})
    if sobra:
        print('   ⚠️ roles de país de pais_por_rol que el menú no ofrece: %s' % ', '.join(PR.ROLES[x] for x in sobra))
    for que, a, b in (('Miembro', js['miembro'], VE.ROL_MIEMBRO), ('Invitado', js['invitado'], inv_py)):
        ok = a == b and a in por_id
        fallas += not ok
        print('%s %s: %s (%s)%s' % ('✅' if ok else '❌', que, nfkd(por_id[a]['name']) if a in por_id else '¿?', a,
                                    '' if a == b else ' ≠ %s' % b))
    # la jerarquía: el bot tiene que estar ARRIBA de todo lo que toca
    nec = [js['miembro'], js['invitado'], js['brasil']] + [p[3] for p in js['paises']]
    alto, faltan, puede = jerarquia(roles, bm.get('roles') or [], nec)
    ok = not faltan and puede
    fallas += not ok
    print('%s el bot (%s): su rol más alto está en la posición %d; Miembro %d, Invitado %d, países %d–%d; %s' % (
        '✅' if ok else '❌', yo.get('username'), alto, por_id[js['miembro']]['position'], por_id[js['invitado']]['position'],
        min(por_id[p[3]]['position'] for p in js['paises'] if p[3] in por_id),
        max(por_id[p[3]]['position'] for p in js['paises'] if p[3] in por_id),
        'puede gestionar roles' if puede else 'NO PUEDE GESTIONAR ROLES'))
    for r in faltan:
        print('   ❌ no queda por debajo del bot: %s' % (nfkd(por_id[r]['name']) if r in por_id else r))
    # los canales e hilos
    for que, cid in (('hilo INVITADOS', js['hilos'][0]), ('hilo LIGA GLOBAL ID', js['hilos'][1]),
                     ('la bienvenida', js['bienvenida']), ('Evento de Nuevos', js['nuevos']), ('empieza-aqui', js['empieza'])):
        c = get('/channels/%s' % cid)
        ok = bool(c and c.get('guild_id') == GUILD)
        fallas += not ok
        print('%s %s: %s' % ('✅' if ok else '❌', que, nfkd((c or {}).get('name')) or cid))
    # el panel de YAGPDB y el nuestro
    msgs = get('/channels/%s/messages?limit=50' % canal['id']) or []
    nuestro, yag = None, False
    for m in msgs:
        ids = json.dumps(m.get('components') or [])
        if ID_YAGPDB in ids:
            yag = True
            opts = [o.get('value') for f in m['components'] for c in f.get('components', []) for o in c.get('options', [])]
            igual = opts == [p[1] for p in js['paises']]
            print('%s el panel de YAGPDB (mensaje %s): %d países%s' % ('✅' if igual else '⚠️', m['id'], len(opts),
                                                                       ', los mismos y en el mismo orden' if igual else ', DISTINTOS'))
        if m.get('author', {}).get('id') == yo.get('id') and 'vdc:pais' in ids:
            nuestro = m['id']
    if not yag:
        print('ⓘ el panel de YAGPDB ya no está en el canal (%d mensajes)' % len(msgs))
    print('   %s' % ('ya hay un panel nuestro (mensaje %s): se EDITA' % nuestro if nuestro else 'no hay panel nuestro: se publica UNO'))
    # los AKA a sembrar
    todos, despues = [], '0'
    while True:
        p = get('/guilds/%s/members?limit=1000&after=%s' % (GUILD, despues)) or []
        todos += p
        if len(p) < 1000:
            break
        despues = p[-1]['user']['id']
    ak = akas_de(todos, js['miembro'], aka_de_apodo)
    print('🌱 --sembrar mandaría %d AKA (de %d miembros de DRA con apodo «X | AKA» y el rol Miembro)' % (len(ak), len(todos)))
    if fallas:
        print('\n🔴 %d cosa(s) mal: no publico nada' % fallas)
        return 1
    if not publicar and not sembrar:
        print('\n(sin --publicar ni --sembrar no toco nada)')
        return 0
    import clave_ciclo as CC
    from alertar import WORKER
    cab = {'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}
    if sembrar:
        r = requests.post(WORKER + '/verificar-dc', headers=cab, data=json.dumps({'accion': 'sembrar', 'akas': ak}), timeout=60)
        print(('✅ sembrados: %s' if r.status_code == 200 else '🔴 no se pudo sembrar (%s)') % (r.json() if r.status_code == 200 else r.status_code))
    if publicar:
        url = subir_banner()
        cuerpo = {'accion': 'panel', 'canal': canal['id'], 'img': url}
        if nuestro:
            cuerpo['msg'] = nuestro
        r = requests.post(WORKER + '/verificar-dc', headers=cab, data=json.dumps(cuerpo), timeout=60)
        j = r.json() if r.headers.get('content-type', '').startswith('application/json') else {}
        if r.status_code != 200 or not j.get('ok'):
            print('🔴 no se pudo (%s): %s' % (r.status_code, j))
            return 1
        print('✅ %s · https://discord.com/channels/%s/%s/%s' % ('publicado' if j.get('nuevo') else 'puesto al día', GUILD,
                                                                canal['id'], j.get('msg')))
    return 0


def _self_check():
    fallas = 0

    def ok(c, que):
        nonlocal fallas
        print(('  ✅ ' if c else '  ❌ ') + que)
        fallas += 0 if c else 1
    cs = [{'id': '1', 'type': 4, 'name': '📦 ╣ ARCHIVO ═════'}, {'id': '10', 'type': 0, 'name': 'verificate-aqui', 'parent_id': '1'},
          {'id': '11', 'type': 0, 'name': '•「✅」verificate-aqui', 'parent_id': '2'}, {'id': '12', 'type': 2, 'name': 'verificate-aqui'}]
    c, _ = elegir(cs, FIN)
    ok(c and c['id'] == '11', 'el del ARCHIVO no cuenta si hay otro, y sólo canales de texto')
    roles = [{'id': 'bot', 'position': 130, 'permissions': str(ADMIN)}, {'id': 'mi', 'position': 90, 'permissions': '0'},
             {'id': 'alto', 'position': 131, 'permissions': '0'}]
    a, f, p = jerarquia(roles, ['bot'], ['mi'])
    ok(a == 130 and not f and p, 'el bot arriba del Miembro y con Administrador: puede')
    a, f, p = jerarquia(roles, ['bot'], ['mi', 'alto'])
    ok(f == ['alto'], 'un rol por encima del bot: no lo puede tocar')
    a, f, p = jerarquia([{'id': 'bot', 'position': 5, 'permissions': '0'}], ['bot'], [])
    ok(not p, 'sin Administrador ni Gestionar roles: no puede')
    ok(aka_de_apodo('🐉 | Nyl') == 'nyl' and aka_de_apodo('#4 | CREW | 𝐍𝐲𝐥') == 'nyl' and aka_de_apodo('Nyl') == '',
       'el AKA es lo de después de la última « | », sin mayúsculas y con la negrita como letra común')
    ms = [{'user': {'id': '1'}, 'nick': '🐉 | Nyl', 'roles': ['mi']}, {'user': {'id': '2'}, 'nick': '🐉 | nyl', 'roles': ['mi']},
          {'user': {'id': '3'}, 'nick': '🐉 | Otro', 'roles': []}, {'user': {'id': '4', 'bot': True}, 'nick': 'x | Bot', 'roles': ['mi']}]
    ok(akas_de(ms, 'mi', aka_de_apodo) == [['nyl', '1']], 'se siembran sólo Miembros, sin bots, y el primero gana')
    print('todo ok' if not fallas else '%d fallas' % fallas)
    return 1 if fallas else 0


if __name__ == '__main__':
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    sys.exit(main('--publicar' in sys.argv, '--sembrar' in sys.argv))

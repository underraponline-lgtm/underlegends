# -*- coding: utf-8 -*-
"""🤝 El rol Recibidor de DRA (Dlx, 28/11/2026: «Sí, créalo»). Lo crea si no existe —sin permisos propios y sin
dárselo a nadie: a quién se lo da es de Dlx— y le abre •「🚪」recibidor (ver, escribir, leer el historial, reaccionar y
escribir en hilos). El canal sigue privado para todos los demás.

    python herramientas/dra_recibidor.py            qué haría
    python herramientas/dra_recibidor.py --aplicar  lo hace
"""
import os
import sys
import time
import unicodedata

import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'bot'))
import fotos as F  # noqa: E402

G = '841017460341604382'
API = 'https://discord.com/api/v10'
H = {'Authorization': 'Bot ' + F.env('DISCORD_TOKEN'), 'Content-Type': 'application/json',
     'X-Audit-Log-Reason': 'Rol Recibidor (Dlx)'}
APLICAR = '--aplicar' in sys.argv
NOMBRE = 'Recibidor'
COLOR = 0x5BC8AF
# ver · escribir · leer el historial · reaccionar · escribir en hilos
PERMISOS = (1 << 10) | (1 << 11) | (1 << 16) | (1 << 6) | (1 << 38)


def n(s):
    s = unicodedata.normalize('NFKD', str(s or '')).lower()
    return ''.join(c for c in s if c.isalnum())


def pedir(m, url, **kw):
    for _ in range(5):
        r = requests.request(m, API + url, headers=H, timeout=30, **kw)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1.5)) + 0.3)
            continue
        if r.status_code >= 400:
            print('   ❌', m, url, r.status_code, r.text[:200])
        return r
    return r


roles = pedir('GET', '/guilds/%s/roles' % G).json()
rol = next((r for r in roles if n(r['name']) == n(NOMBRE)), None)
if rol:
    print('✅ el rol ya existe:', rol['name'], rol['id'])
elif APLICAR:
    rol = pedir('POST', '/guilds/%s/roles' % G, json={'name': NOMBRE, 'permissions': '0', 'color': COLOR,
                                                     'hoist': False, 'mentionable': False}).json()
    print('➕ rol creado:', rol.get('name'), rol.get('id'))
else:
    print('➕ crearía el rol', NOMBRE)

cs = pedir('GET', '/guilds/%s/channels' % G).json()
canal = next((c for c in cs if c['type'] != 4 and 'recibidor' in n(c['name'])), None)
if not canal:
    sys.exit('❌ no encontré el canal recibidores')
print('📍', canal['name'])
if rol and rol.get('id'):
    ya = next((o for o in canal['permission_overwrites'] if o['id'] == rol['id']), None)
    if ya and int(ya['allow']) & PERMISOS == PERMISOS:
        print('✅ el rol ya ve el canal')
    elif APLICAR:
        r = pedir('PUT', '/channels/%s/permissions/%s' % (canal['id'], rol['id']),
                  json={'type': 0, 'allow': str(PERMISOS), 'deny': '0'})
        print('🔓 el rol ve el canal' if r.status_code < 300 else '❌ no pude abrirle el canal')
    else:
        print('🔓 le abriría el canal al rol')

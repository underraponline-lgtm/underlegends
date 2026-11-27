# -*- coding: utf-8 -*-
"""🔒 Los canales nuevos de DRA, privados hasta que tengan su panel (Dlx, 27/11/2026: «de momento hace esos canales todos
privados, pero ordena todo, también los canales de archivo»). Toman los permisos de 〢🪽〉chat-staff (sólo el staff
los ve). Y el ARCHIVO, en orden alfabético. Para abrirlos, cada uno vuelve a los permisos de su categoría.

    python herramientas/dra_privados.py            qué haría
    python herramientas/dra_privados.py --aplicar  lo hace
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
     'X-Audit-Log-Reason': 'Canales nuevos privados hasta tener su panel (Dlx)'}
APLICAR = '--aplicar' in sys.argv
NUEVOS = ('empiezaaqui', 'presentate', 'preguntas', 'ligas', 'mesawards', 'videos', 'publicaciones', 'crews', 'tienda',
          'comandos', 'cypherprimerospasos', 'cypheravanzado', 'estilosdejuego', 'recibidores')


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


cs = pedir('GET', '/guilds/%s/channels' % G).json()
staff = next(c for c in cs if 'chatstaff' in n(c['name']))
PRIVADO = [{'id': o['id'], 'type': o['type'], 'allow': o['allow'], 'deny': o['deny']} for o in staff['permission_overwrites']]
for c in cs:
    if c['type'] != 4 and any(n(c['name']).endswith(k) for k in NUEVOS):
        print('🔒', c['name'])
        if APLICAR:
            pedir('PATCH', '/channels/%s' % c['id'], json={'permission_overwrites': PRIVADO})
arch = next(c for c in cs if c['type'] == 4 and 'archivo' in n(c['name']))
hijos = sorted((c for c in cs if c.get('parent_id') == arch['id']), key=lambda c: n(c['name']))
print('📦 archivo:', ' · '.join(c['name'] for c in hijos))
if APLICAR:
    pedir('PATCH', '/guilds/%s/channels' % G, json=[{'id': c['id'], 'position': i} for i, c in enumerate(hijos)])
    print('✅ hecho')

# -*- coding: utf-8 -*-
"""🔧 Los permisos de @everyone en cada canal de DRA, declarados en un solo lugar (Dlx, 28/11/2026: «configura cada
canal como se debe»).

🔴 POR QUÉ EXISTE: el 27/11 los chats quedaron «para el rol Crew UL», creyendo que Crew UL era la gente que chatea.
Crew UL son 8 personas (el equipo de UL): #conversacion, crews, buscar-batalla y contenido-rap quedaron de sólo
lectura para las otras ~2.900, y el último mensaje de alguien en #conversacion fue el 25/11. Verificarse desbloquea lo
que se guarda, NUNCA chatear ni jugar (objetivos de DRA): los chats son de todos.

Cada perfil dice qué bits se PRENDEN y cuáles se APAGAN en el permiso de @everyone de ese canal; los demás bits y los
permisos de los roles (staff, tiers, Recibidor…) no se tocan.

    python herramientas/dra_permisos.py            qué cambiaría
    python herramientas/dra_permisos.py --aplicar  lo hace
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
     'X-Audit-Log-Reason': 'Permisos de cada canal (Dlx)'}
APLICAR = '--aplicar' in sys.argv

V, S, R, H_, T, HIST = 1 << 10, 1 << 11, 1 << 6, 1 << 14, 1 << 38, 1 << 16  # ver · escribir · reaccionar · links · hilos · historial
CREAR_HILOS = (1 << 35) | (1 << 36)

# perfil: (prender, apagar, modo lento en segundos o None = no tocar)
CHAT = (V | S | R | HIST | H_, 0, None)                 # se habla
CHAT_LENTO = (V | S | R | HIST | H_, 0, 30)             # se habla, de a poco
PANEL = (V | R | HIST, S | CREAR_HILOS, None)            # se lee y se reacciona; escribe el bot
FORO_COMENTAR = (V | R | HIST | T, 0, None)             # foro: se comenta adentro de cada publicación
SOLO_PASE = (0, V | S, None)                             # @everyone no lo ve (los roles del Pase, aparte)

CANALES = {
    # 💬 los chats: de todos
    'conversacion': CHAT,
    'crews': CHAT,
    'buscarbatalla': CHAT_LENTO,
    'contenidorap': CHAT_LENTO,
    # 📋 los paneles: sólo lectura (el bot publica)
    # 🔴 los eventos completos, sólo para el Pase (Dlx, 28/11: «se llama PASE T, ese es el rol del pase rapero»):
    # @everyone no lo ve; «Pase T» y «Pase Premium» (bot/pase.py ROLES_PREMIUM) lo ven y comentan, sin abrir publicaciones
    'eventosgrabados': SOLO_PASE,
    # 🧠 entrenamientos y dinámicas: también para los nuevos (Dlx, 28/11), y se comenta en cada una
    'entrenamientos': FORO_COMENTAR,
    'dinamicasretos': FORO_COMENTAR,
}


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
for c in cs:
    if c['type'] == 4:
        continue
    k = next((k for k in CANALES if n(c['name']).endswith(k)), None)
    if not k:
        continue
    prender, apagar, lento = CANALES[k]
    o = next((o for o in c['permission_overwrites'] if o['id'] == G), {'allow': '0', 'deny': '0'})
    a0, d0 = int(o['allow']), int(o['deny'])
    a1, d1 = (a0 | prender) & ~apagar, (d0 & ~prender) | apagar
    cambia = (a1, d1) != (a0, d0)
    lento_cambia = lento is not None and c.get('rate_limit_per_user', 0) != lento
    if not cambia and not lento_cambia:
        print('✅', c['name'])
        continue
    print('🔧', c['name'], '· @everyone', ('cambia' if cambia else ''), ('· modo lento %ss' % lento if lento_cambia else ''))
    if APLICAR:
        if cambia:
            pedir('PUT', '/channels/%s/permissions/%s' % (c['id'], G), json={'type': 0, 'allow': str(a1), 'deny': str(d1)})
        if lento_cambia:
            pedir('PATCH', '/channels/%s' % c['id'], json={'rate_limit_per_user': lento})
if not APLICAR:
    print('\n(sin --aplicar no toco nada)')

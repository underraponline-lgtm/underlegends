# -*- coding: utf-8 -*-
"""🏗️ DRA ORDENADO POR LOS OBJETIVOS (27/11/2026, Dlx: «crea los canales y ordénalos como tú has dicho… luego yo veré si
sigo eso o no»). Idempotente: busca cada canal por su ID o por su nombre normalizado, y sólo crea lo que falta.

    python herramientas/dra_orden.py            qué haría (no toca nada)
    python herramientas/dra_orden.py --aplicar  lo hace

⚠️ NO BORRA NADA y no cambia los permisos de lo que ya existe (salvo lo que vuelve del ARCHIVO, que toma los de su
categoría nueva, porque en el archivo estaba oculto). Lo nuevo copia los permisos de un canal parecido:
  · paneles del bot (sólo lectura): los de 〢🏆〉rankings · charlas: los de 💬 chat-general · privado: los de 〢🪽〉chat-staff
Respaldo de antes: docs/respaldo_dra/canales_2026-11-27.json.
"""
import json
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
     'X-Audit-Log-Reason': 'Orden de DRA por objetivos (Dlx)'}
APLICAR = '--aplicar' in sys.argv


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
por_nombre = {}
for c in cs:
    por_nombre.setdefault(n(c['name']), c)


def buscar(*claves):
    for k in claves:
        for c in cs:
            if k in n(c['name']):
                return c
    return None


def ow(c):
    return [{'id': o['id'], 'type': o['type'], 'allow': o['allow'], 'deny': o['deny']} for o in (c or {}).get('permission_overwrites') or []]


PANEL = ow(buscar('rankings'))
CHARLA = ow(buscar('chatgeneral'))
PRIVADO = ow(buscar('chatstaff'))
cat_comunidad = buscar('comunidad')

# (categoría, [(nombre a buscar, nombre nuevo o None, tipo para crear, permisos para crear/revivir)])
# tipo: 0 texto · 2 voz · None = existe (no se crea)
PLAN = [
    ('👋 ╣ BIENVENIDA ════════', 'informacion', [
        ('bienvenidoleeesto', None, None, None),
        ('empiezaaqui', '〢🧭〉empieza-aquí', 0, PANEL),
        ('quienessomos', None, None, None),
        ('presentacion', '〢🙋〉preséntate', 'revivir', CHARLA),
        ('preguntas', '〢❔〉preguntas', 0, CHARLA),
        ('verificateaqui', None, None, None),
        ('eresnuevo', None, None, None),
    ]),
    ('🏆 ╣ LIGA GLOBAL ═════════', 'ligaglobal', [
        ('diasrestantes', None, None, None),
        ('ligaglobal', None, None, None),
        ('eventoshoy', None, None, None),
        ('estasemana', None, None, None),
        ('rankings', None, None, None),
        ('mostwanted', None, None, None),
        ('paserapero', None, None, None),
        ('tutarjeta', None, None, None),
        ('socios', None, None, None),
        ('ligas', '〢🏟️〉ligas', 0, PANEL),
        ('mesawards', '〢🏅〉mes-awards', 0, PANEL),
    ]),
    ('🎬 ╣ CONTENIDO ══════════', None, [
        ('mejoresrimas', '〢🎬〉videos', 'revivir', PANEL),
        ('publicaciones', '〢📰〉publicaciones', 0, PANEL),
        ('contenidorap', None, None, None),
        ('promocionate', None, None, None),
    ]),
    ('🏙️ ╣ COMUNIDAD ══════════', 'comunidad', [
        ('chatgeneral', None, None, None),
        ('charla', None, None, None),
        ('crews', '〢👥〉crews', 0, CHARLA),
        ('tienda', '〢🛍️〉tienda', 'revivir', PANEL),
        ('comandos', '〢🤖〉comandos', 0, CHARLA),
        ('servidoresrap', None, None, None),
        ('nuestrootroservidor', None, None, None),
    ]),
    ('🎤 ╣ CYPHERS Y ENTRENAMIENTO ═', 'entrenamiento', [
        ('cypher1', '🎤˚┊cypher general', None, None),
        ('primerospasos', '🌱˚┊cypher primeros pasos', 2, None),
        ('cypher2', '🎤˚┊cypher intermedio', None, None),
        ('cypheravanzado', '🔥˚┊cypher avanzado', 2, None),
        ('1v11', None, None, None),
        ('1v12', None, None, None),
        ('reydelapista', None, None, None),
        ('reydelapista', None, None, None),
        ('ponbeats', None, None, None),
        ('entrenamientos', None, None, None),
        ('dinamicasretos', None, None, None),
        ('estilosdejuego', '〢🎭〉estilos-de-juego', 0, PANEL),
    ]),
    ('🎪 ╣ EVENTOS DRA ═════════', 'eventosdra', []),
    ('🛟 ╣ AYUDA ══════════════', None, [
        ('ticketsoporte', None, None, None),
        ('postulaciones', None, None, None),
        ('recibidores', '〢🤝〉recibidores', 0, PRIVADO),
    ]),
]

orden_cats, orden_canales = [], []
for cat_nombre, cat_busca, canales in PLAN:
    cat = buscar(cat_busca) if cat_busca else None
    cat = cat if cat and cat['type'] == 4 else None
    if not cat:
        cat = next((c for c in cs if c['type'] == 4 and n(c['name']) == n(cat_nombre)), None)
    if not cat:
        print('➕ categoría', cat_nombre)
        if APLICAR:
            cat = pedir('POST', '/guilds/%s/channels' % G, json={'name': cat_nombre, 'type': 4,
                        'permission_overwrites': ow(cat_comunidad)}).json()
            cs.append(cat)
    elif n(cat['name']) != n(cat_nombre) and cat_busca == 'informacion':
        print('✏️ categoría', cat['name'], '→', cat_nombre)
        if APLICAR:
            pedir('PATCH', '/channels/%s' % cat['id'], json={'name': cat_nombre})
    elif n(cat['name']) != n(cat_nombre) and cat_busca == 'entrenamiento':
        print('✏️ categoría', cat['name'], '→', cat_nombre)
        if APLICAR:
            pedir('PATCH', '/channels/%s' % cat['id'], json={'name': cat_nombre})
    if cat:
        orden_cats.append(cat['id'])
    usados = set()
    for clave, nuevo, tipo, perms in canales:
        c = next((x for x in cs if x['type'] != 4 and clave in n(x['name']) and x['id'] not in usados), None)
        if c and tipo == 'revivir':
            print('↩️ revivo', c['name'], '→', nuevo)
            if APLICAR and cat:
                pedir('PATCH', '/channels/%s' % c['id'], json={'name': nuevo, 'parent_id': cat['id'], 'permission_overwrites': perms})
        elif c:
            cambios = {}
            if cat and c.get('parent_id') != cat['id']:
                cambios['parent_id'] = cat['id']
            if nuevo and n(c['name']) != n(nuevo):
                cambios['name'] = nuevo
            if cambios:
                print('➡️ ', c['name'], cambios)
                if APLICAR:
                    pedir('PATCH', '/channels/%s' % c['id'], json=cambios)
        elif tipo in (0, 2):
            print('➕', nuevo, '(voz)' if tipo == 2 else '')
            if APLICAR and cat:
                body = {'name': nuevo, 'type': tipo, 'parent_id': cat['id']}
                if perms is not None:
                    body['permission_overwrites'] = perms
                c = pedir('POST', '/guilds/%s/channels' % G, json=body).json()
                cs.append(c)
        else:
            print('   · no encontré', clave)
        if c and c.get('id'):
            usados.add(c['id'])
            orden_canales.append(c['id'])

# el orden: las categorías del plan arriba, en ese orden (SALÓN, CENTRAL y ARCHIVO quedan después); los canales del plan,
# en su orden dentro de cada una
if APLICAR:
    cs = pedir('GET', '/guilds/%s/channels' % G).json()
    resto = [c['id'] for c in sorted((c for c in cs if c['type'] == 4 and c['id'] not in orden_cats), key=lambda c: c['position'])]
    pos = [{'id': cid, 'position': i} for i, cid in enumerate(orden_cats + resto)]
    pedir('PATCH', '/guilds/%s/channels' % G, json=pos)
    pos = [{'id': cid, 'position': i} for i, cid in enumerate(orden_canales)]
    pedir('PATCH', '/guilds/%s/channels' % G, json=pos)
    print('✅ hecho')
else:
    print('\n(simulacro: --aplicar para hacerlo)')

# -*- coding: utf-8 -*-
"""🧹 DRA CON UN SOLO ESTILO DE NOMBRE (27/11/2026, Dlx: «las categorías y canales organiza todo y prepara, para que yo
haga lo mío. Tienes mi permiso»). Había tres estilos mezclados (〢🏆〉 · ☑️˚┊ · •「👋」): queda «〢emoji〉nombre» en las
categorías públicas. CENTRAL y ARCHIVO no se tocan. Y una descripción en cada canal nuevo, para saber qué va ahí.

    python herramientas/dra_estilo.py            qué haría
    python herramientas/dra_estilo.py --aplicar  lo hace
Respaldo de antes: docs/respaldo_dra/canales_2026-11-27.json (y el de este paso, al aplicar).
"""
import json
import os
import re
import sys
import time
import unicodedata

import requests

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'bot'))
import fotos as F  # noqa: E402

G = '841017460341604382'
API = 'https://discord.com/api/v10'
H = {'Authorization': 'Bot ' + F.env('DISCORD_TOKEN'), 'Content-Type': 'application/json',
     'X-Audit-Log-Reason': 'DRA: un solo estilo de nombre (Dlx)'}
APLICAR = '--aplicar' in sys.argv
FUERA = ()
TEMAS = {
    'comofunciona': 'Cómo funciona la Liga Global: puntos, rangos, tarjetas, el Pase y la Tienda.',
    'presentate': 'Preséntate: quién eres, de dónde rapeas y desde cuándo. ¡Bienvenido!',
    'preguntas': '¿Tienes una duda? Pregunta acá: te contestan el bot y los recibidores.',
    'ligas': 'Una publicación por liga: su tabla, sus fechas y lo que se dice de ella.',
    'mesawards': 'Los premios del mes de cada servidor y la gala de la temporada.',
    'videos': 'Los shorts de cada evento y las mejores rimas de la semana.',
    'publicaciones': 'Lo que pasa en la Liga: campeones, debuts, récords y más.',
    'crews': 'Las crews de la Liga: busca la tuya o arma una.',
    'tienda': 'La Tienda: la vitrina que rota, las ofertas y tus Puntos de Tienda.',
    'comandos': 'Usa acá los comandos del bot: /card, /apodo, /dashboard y los demás.',
    'estilosdejuego': 'Los estilos de juego: cuáles hay y los eventos de DRA que los dan.',
    'recibidores': 'Para los que reciben a los nuevos: quién llegó y quién necesita una mano.',
}


def n(s):
    s = unicodedata.normalize('NFKD', str(s or '')).lower()
    return ''.join(c for c in s if c.isalnum() and c != '〢')


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


#: 🎨 CADA CATEGORÍA SU ESTILO, Y PAREJO ADENTRO (Dlx, 27/11/2026: «la idea es que toda categoría tenga diferente
#: estilo pero consecutivo», y «archivo toca»). (lo que abre, lo que cierra) alrededor del emoji
ESTILOS = {
    'bienvenida': ('•「', '」'), 'ligaglobal': ('〢', '〉'), 'contenido': ('『', '』'), 'comunidad': ('', '˚┊'),
    'cyphers': ('【', '】'), 'eventosdra': ('✦', '・'), 'ayuda': ('┊', '┊'), 'salon': ('〘', '〙'),
    'central': ('╏', '╏'), 'archivo': ('▫️', '・'),
}
DECOS = '〢〉•「」˚┊『』【】⟪⟫〘〙⌜⌟⌁✦・╏▫'


def estilo(nombre, voz, deco):
    """El nombre con el estilo `deco` de su categoría: «emoji» + «nombre». Sin emoji (los viejos del archivo), 📁."""
    s = nombre.replace('̊', '')
    s = ''.join(' ' if ch in DECOS else ch for ch in s).strip()
    m = re.match(r'^([^\w\s-]+?)\s+(.+)$', s) or re.match(r'^([^\w\s-]+)(.+)$', s)
    emoji, resto = (m.group(1).strip(), m.group(2).strip()) if m else ('📁', s)
    if not resto:
        return None
    if not voz:
        resto = re.sub(r'\s+', '-', resto)
    return '%s%s%s%s' % (deco[0], emoji, deco[1], resto)


cs = pedir('GET', '/guilds/%s/channels' % G).json()
cats = {c['id']: c for c in cs if c['type'] == 4}
cambios = 0
for c in sorted(cs, key=lambda c: (cats.get(c.get('parent_id'), {}).get('position', 99), c['position'])):
    if c['type'] == 4:
        continue
    cat = cats.get(c.get('parent_id'))
    if not cat or any(f in n(cat['name']) for f in FUERA):
        continue
    voz = c['type'] in (2, 13)
    deco = next((v for k, v in ESTILOS.items() if k in n(cat['name'])), None)
    nuevo = estilo(c['name'], voz, deco) if deco else None
    body = {}
    if nuevo and nuevo != c['name']:
        body['name'] = nuevo
    tema = next((t for k, t in TEMAS.items() if n(c['name']).endswith(k)), None)
    if tema and c['type'] in (0, 5, 15) and (c.get('topic') or '') != tema:
        body['topic'] = tema
    if body:
        cambios += 1
        print('✏️ ', c['name'], '→', body.get('name', '(igual)'), '· con descripción' if 'topic' in body else '')
        if APLICAR:
            pedir('PATCH', '/channels/%s' % c['id'], json=body)
if APLICAR:
    print('✅ hecho:', cambios)
else:
    print('\n%d cambios (simulacro: --aplicar para hacerlo)' % cambios)

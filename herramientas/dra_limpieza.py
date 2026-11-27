# -*- coding: utf-8 -*-
"""🧽 DRA: MENOS CANALES, CADA UNO CON SU PROPÓSITO (27/11/2026, Dlx: «¿quizás hay muchos canales? Cuáles quitarías… el
propósito de cada canal, añade la descripción, si ves que es lo mismo fusiónalos, y emojis de varios colores»).

Fusionar = el que sobra va al ARCHIVO (oculto, con su historial), NUNCA se borra. Ninguno de los archivados lo lee el bot
(medido: competencias MIX sí, y por eso se queda y pasa a llamarse «competencias»).

    python herramientas/dra_limpieza.py            qué haría
    python herramientas/dra_limpieza.py --aplicar  lo hace
"""
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
     'X-Audit-Log-Reason': 'DRA: menos canales, cada uno con su propósito (Dlx)'}
APLICAR = '--aplicar' in sys.argv

#: lo que sobra → al ARCHIVO, y en qué canal vive ahora lo suyo
ARCHIVAR = {
    'tutorialguia': 'cómo-funciona', 'eresnuevo': 'preguntas', 'eventosgrabados': 'videos', 'noticias': 'publicaciones',
    'dinamicasretos': 'entrenamientos', # (las competencias por tier volvieron: Dlx, 27/11, «regresa los canales de eventos dra»)
}
#: clave del nombre → (emoji nuevo, nombre nuevo o None, descripción). Emojis de colores y sin repetir
CANALES = {
    'bienvenidoleeesto': ('👋', None, 'Empieza acá: las reglas y tus primeros pasos en la Liga.'),
    'quienessomos': ('💜', None, 'Quiénes somos: Under Legends, la Liga Global y lo que nos importa.'),
    'presentate': ('🙋', None, 'Preséntate: quién eres, de dónde rapeas y desde cuándo. ¡Bienvenido!'),
    'preguntas': ('💡', None, '¿Tienes una duda? Pregunta acá: te contestan el bot y los recibidores.'),
    'verificateaqui': ('✅', None, 'Verifícate para guardar tu tarjeta, tus drops y tu lugar en los rankings.'),
    'comofunciona': ('📖', None, 'Cómo funciona la Liga Global: puntos, rangos, tarjetas, el Pase y la Tienda.'),
    'ligaglobal': ('📣', None, 'Los anuncios de la Liga Global.'),
    'eventoshoy': ('🔥', None, 'Los eventos de hoy en todos los servidores de la Liga, con el botón para anotarte.'),
    'estasemana': ('📅', None, 'El calendario de la semana en todos los servidores.'),
    'rankings': ('🏆', None, 'Los rankings de la temporada, al día.'),
    'mostwanted': ('💀', None, 'Los más buscados de la semana: gánales y cobra su precio.'),
    'paserapero': ('🎫', None, 'El Pase de la temporada: tus Tareas, tu nivel y tus premios.'),
    'tutarjeta': ('🃏', None, 'Tu tarjeta de la Liga: cómo conseguirla y mostrarla.'),
    'socios': ('🌐', None, 'Los servidores socios de la Liga y sus eventos.'),
    'mesawards': ('🏅', None, 'Los premios del mes de cada servidor y la gala de la temporada.'),
    'videos': ('🍿', None, 'Los shorts de cada evento y las mejores rimas de la semana.'),
    'publicaciones': ('🌟', None, 'Lo que pasa en la Liga: campeones, debuts, récords y más.'),
    'contenidorap': ('🎸', None, 'Comparte rap: temas, videos y lo que te guste de la escena.'),
    'promocionate': ('🚀', None, 'Promociona lo tuyo: tus temas, tus redes y tus eventos.'),
    'chatgeneral': ('💬', None, 'El chat de todos. Recibe bien al que llega.'),
    'crews': ('🛡️', None, 'Las crews de la Liga: busca la tuya o arma una.'),
    'tienda': ('🛍️', None, 'La Tienda: la vitrina que rota, las ofertas y tus Puntos de Tienda.'),
    'comandos': ('🤖', None, 'Usa acá los comandos del bot: /card, /apodo, /dashboard y los demás.'),
    'servidoresrap': ('🌎', None, 'Otros servidores de rap: preséntalos y encuéntralos.'),
    'nuestrootroservidor': ('👾', None, 'Nuestro otro servidor.'),
    'buscarbatalla': ('🎯', None, '¿Buscas con quién rapear? Pide rival o compañero de cypher acá.'),
    'cyphergeneral': ('🎙️', None, None),
    'cypherprimerospasos': ('🌱', None, None),
    'cypherintermedio': ('🎧', None, None),
    'cypheravanzado': ('🔥', None, None),
    'ponbeats': ('💿', None, 'Pon beats para los cyphers: deja el link y el bot de música lo toca.'),
    'entrenamientos': ('🧠', None, 'Entrenamientos y retos para mejorar tu freestyle.'),
    'estilosdejuego': ('🎭', None, 'Los estilos de juego: cuáles hay y los eventos de DRA que los dan.'),
    'eventonuevos': ('🐣', None, 'El evento para los que empiezan: sólo para quien jugó 2 eventos o menos.'),
    'eloranked1v1': ('⚔️', None, 'El ranked 1v1 de DRA: sube tu ELO.'),
    # competencias MIX: Dlx, 27/11, «déjalo»: no se toca
    'ticketsoporte': ('🎟️', None, 'Abre un ticket si algo no anda o necesitas ayuda del staff.'),
    'postulaciones': ('💼', None, 'Postúlate al staff, como host o como jurado.'),
    'recibidores': ('🤝', None, 'Para los que reciben a los nuevos: quién llegó y quién necesita una mano.'),
    'arenalegendaria': ('👑', None, None),
    'arenaepica': ('⚡', None, None),
    'beats': ('🎹', None, None),
    'quejas': ('🚨', None, None),
    'grabaciones': ('📹', None, None),
    'participantes': ('🧾', None, None),
    'ularchivos': ('🗂️', None, None),
    'archivos': ('🗂️', None, None),
}
DECOS = '〢〉•「」˚┊『』【】⟪⟫〘〙⌜⌟⌁✦・╏▫'


def n(s):
    s = unicodedata.normalize('NFKD', str(s or '')).lower()
    return ''.join(c for c in s if c.isalnum() and c not in '〢')


def partes(nombre):
    """(lo que abre, emoji, lo que cierra, nombre) de un canal con el estilo de su categoría."""
    m = re.match(r'^([%s]*)([^\w\s%s-]+?)([%s]+)(.+)$' % (re.escape(DECOS), re.escape(DECOS), re.escape(DECOS)), nombre)
    return (m.group(1), m.group(2), m.group(3), m.group(4)) if m else None


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
arch = next(c for c in cs if c['type'] == 4 and 'archivo' in n(c['name']))
oculto = [{'id': o['id'], 'type': o['type'], 'allow': o['allow'], 'deny': o['deny']} for o in arch['permission_overwrites']]
usados = set()
for c in cs:
    if c['type'] == 4:
        continue
    k = n(c['name'])
    a = next((v for kk, v in ARCHIVAR.items() if k.endswith(kk)), None)
    if a:
        p = partes(c['name'])
        nuevo = '▫️・' + (p[3] if p else c['name'])
        print('📦 archivo', c['name'], '→ lo suyo va a', a)
        if APLICAR:
            pedir('PATCH', '/channels/%s' % c['id'], json={'parent_id': arch['id'], 'name': nuevo, 'permission_overwrites': oculto})
        continue
    if c.get('parent_id') == arch['id']:
        continue
    clave = next((kk for kk in sorted(CANALES, key=len, reverse=True) if k.endswith(kk)), None)
    if not clave:
        continue
    emoji, nombre, tema = CANALES[clave]
    p = partes(c['name'])
    body = {}
    if p:
        nuevo = p[0] + emoji + p[2] + (nombre or p[3])
        if nuevo != c['name']:
            body['name'] = nuevo
    if tema and c['type'] in (0, 5, 15) and (c.get('topic') or '') != tema:
        body['topic'] = tema
    if body:
        print('✏️ ', c['name'], '→', body.get('name', '(igual)'), '· descripción' if 'topic' in body else '')
        if APLICAR:
            pedir('PATCH', '/channels/%s' % c['id'], json=body)
print('✅ hecho' if APLICAR else '\n(simulacro: --aplicar para hacerlo)')

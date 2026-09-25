# -*- coding: utf-8 -*-
"""UN ANUNCIO DEL BOT EN EL CANAL DE LA LIGA, EN DRA.

    python herramientas/anunciar.py MENSAJE.json               muestra lo que mandaría
    python herramientas/anunciar.py MENSAJE.json --publicar    lo publica
    python herramientas/anunciar.py MENSAJE.json --editar ID   reemplaza ese mensaje

🔑 Dlx, 25/09/2026: *«quiero que anuncies en DRA con el bot un mensaje así
decorado… en ranking global de DRA, sólo en ese servidor»*. El canal es
〢🌍〉rankings-liga-global (`canales.DRA.novedades` de
`datos/servidores.json`), el MISMO que lee «Novedades de la Liga» en la
página: lo que se publica acá aparece ahí solo, en la corrida siguiente
(`subir_web._novedades()`, que también lee los embeds).

⚠️ SIN PUBLICAR NADA POR DEFECTO: sin `--publicar` sólo muestra el mensaje.
Publicar en un servidor de 1.700 personas no se deshace: se puede editar, y
por eso existe `--editar` —Discord no vuelve a notificar un mensaje editado—.

⚠️ SIN MENCIONES, NUNCA: `allowed_mentions` va vacío aunque el JSON diga
otra cosa. Un @everyone lo decide Dlx, y se agrega a mano si lo pide.
"""
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(BASE, 'bot'))
API = 'https://discord.com/api/v10'


def canal():
    with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        d = json.load(f)
    return ((d.get('canales') or {}).get('DRA') or {}).get('novedades')


def textos_v2(cs):
    """El texto de los componentes V2 (Text Display, tipo 10), en orden."""
    out = []
    for c in cs or []:
        if c.get('type') == 10:
            out.append(c.get('content') or '')
        out += textos_v2(c.get('components'))
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__)
        return 2
    with io.open(args[0], encoding='utf-8') as f:
        msg = json.load(f)
    # los campos con `_` son notas nuestras (`_leeme`, `_publicado`): no van a Discord
    for k in [k for k in msg if k.startswith('_')]:
        msg.pop(k)
    msg['allowed_mentions'] = {'parse': []}
    ch = canal()
    print('canal: %s (canales.DRA.novedades)\n' % ch)
    for e in msg.get('embeds') or []:
        print('  ' + (e.get('title') or ''))
        for l in (e.get('description') or '').split('\n'):
            print('    ' + l)
        for c in e.get('fields') or []:
            print('  · %s: %s' % (c.get('name'), c.get('value')))
    if msg.get('content'):
        print('  texto: ' + msg['content'])
    # 🔑 COMPONENTES V2 (flags 32768): títulos con #, listas y citas, que es
    # lo que pidió Dlx para los anuncios (25/09/2026)
    for t in textos_v2(msg.get('components')):
        for l in t.split('\n'):
            print('    ' + l)
        print('')
    if '--publicar' not in sys.argv and '--editar' not in sys.argv:
        print('\n  (sin publicar: agregá --publicar, o --editar <id>)')
        return 0
    import requests
    import fotos as F
    h = {'Authorization': 'Bot ' + F.env('DISCORD_TOKEN'), 'Content-Type': 'application/json'}
    if '--editar' in sys.argv:
        mid = sys.argv[sys.argv.index('--editar') + 1]
        r = requests.patch('%s/channels/%s/messages/%s' % (API, ch, mid), headers=h,
                           data=json.dumps(msg), timeout=30)
    else:
        r = requests.post('%s/channels/%s/messages' % (API, ch), headers=h,
                          data=json.dumps(msg), timeout=30)
    if r.status_code not in (200, 201):
        print('\n  🔴 Discord contestó %s: %s' % (r.status_code, r.content.decode('utf-8', 'replace')[:300]))
        return 1
    m = r.json()
    with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        guild = ((json.load(f).get('servidores') or {}).get('DRA') or {}).get('guild_id')
    print('\n  ✅ %s: https://discord.com/channels/%s/%s/%s'
          % ('editado' if '--editar' in sys.argv else 'publicado', guild, ch, m.get('id')))
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    sys.exit(main())

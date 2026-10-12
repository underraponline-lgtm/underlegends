# -*- coding: utf-8 -*-
"""BORRAR UN MENSAJE CON EL BOT. Lo corre Dlx; Claude le pasa el comando armado.

    python herramientas/borrar_mensaje.py <link del mensaje>
    python herramientas/borrar_mensaje.py <canal> <mensaje>

El link es el de «Copiar enlace del mensaje» en Discord. Muestra de quién es y qué dice, y lo borra con el bot: puede
borrar los suyos siempre, y los de otros sólo donde tiene permiso.

Dlx, 12/10/2026: la respuesta de un `/card` suyo quedó en el chat de FVS y él no tenía permiso para sacarla. Claude no
borra mensajes él mismo (ver «Borrar un mensaje» en `CLAUDE.md`), así que esto existe para que sea una sola línea.
"""
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'bot'))
import avisar  # noqa: E402

API = 'https://discord.com/api/v10/channels/%s/messages/%s'


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    a = sys.argv[1:]
    m = re.search(r'channels/\d+/(\d+)/(\d+)', ' '.join(a))
    if m:
        canal, mid = m.groups()
    elif len(a) == 2 and all(x.isdigit() for x in a):
        canal, mid = a
    else:
        print(__doc__)
        return 2
    import requests
    t = avisar._token()
    if not t:
        print('no hay DISCORD_TOKEN en .env')
        return 1
    cab = {'Authorization': 'Bot ' + t}
    r = requests.get(API % (canal, mid), headers=cab, timeout=20)
    if r.status_code != 200:
        print('no lo encuentro en ese canal (%s)' % r.status_code)
        return 1
    msg = r.json()
    texto = (msg.get('content') or '').strip().replace('\n', ' ') or '(sin texto: imagen, embed o carta)'
    print('de %s: %s' % ((msg.get('author') or {}).get('username', '?'), texto[:200]))
    r = requests.delete(API % (canal, mid), headers=cab, timeout=20)
    if r.status_code == 204:
        print('borrado')
        return 0
    print('no se pudo (%s): %s' % (r.status_code, r.content.decode('utf-8')[:200]))
    return 1


if __name__ == '__main__':
    sys.exit(main())

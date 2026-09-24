# -*- coding: utf-8 -*-
"""EL PERFIL DEL BOT: la descripción que se ve al hacerle click.

    python bot/perfil.py              muestra lo que tiene hoy
    python bot/perfil.py --aplicar    lo escribe

🔴 EL «JUGANDO A…» VERDE NO SE PUEDE, Y NO ES UN OLVIDO. La presencia de un bot
—el estado y la actividad— **sólo se manda por el gateway**, o sea por una
conexión abierta permanente. No hay endpoint REST: probado, `PATCH /users/@me`
con `activities` devuelve **200 y descarta el campo**, que es la peor manera de
que algo no funcione. Y un gateway es exactamente lo que este bot no tiene: sin
proceso prendido 24/7 no hay servidor que pagar, que es lo que lo hace gratis.

O sea que el estado verde cuesta **una arquitectura entera**, no una línea.

⚠️ LO QUE SÍ SE VE SIN GATEWAY es la **descripción de la aplicación**, que
Discord muestra en «Información» cuando alguien le hace click al bot. No es lo
mismo que un estado, pero es el único texto del perfil que se puede escribir
desde acá, y es el que lee quien se pregunta qué hace esta cosa.

⚠️ Y LOS TAGS SON PARA EL DIRECTORIO. Hasta cinco, y sólo sirven si la app se
publica en App Directory. Se ponen igual porque no cuestan nada y el día que se
publique ya están.
"""
import io
import json
import os
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
API = 'https://discord.com/api/v10'

# ⚠️ 400 CARACTERES ES EL TOPE y Discord no avisa bien si te pasás. Lo que hay
# que decir en ese espacio: qué es, cómo se usa, y qué hace falta para tener
# carta — que es la pregunta que llega por mensaje directo.
DESCRIPCION = (
    'Las tarjetas de la Liga Global.\n\n'
    '**/card** — la tuya, o la de quien elijas. Cuatro caras: Temporada, '
    'Competitiva, Servidor y País. La de Servidor cambia según dónde estés.\n'
    '**/numeral** — mostrá u ocultá tu #N en tu apodo.\n'
    '**/settings** — ajustes del servidor (admins).\n\n'
    'Hace falta estar en DRA y verificarte ahí. Si todavía no competiste, '
    'tu tarjeta te dice cuánto te falta.'
)
assert len(DESCRIPCION) <= 400, 'la descripción se pasa de 400: %d' % len(DESCRIPCION)

TAGS = ['freestyle', 'rap', 'ranking', 'tarjetas', 'competencia']


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def main():
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    a = s.get('%s/applications/@me' % API, timeout=30).json()
    print('\nHOY')
    print('  nombre       %s' % a.get('name'))
    print('  descripción  %s' % (repr(a.get('description'))[:120] or '(vacía)'))
    print('  tags         %s' % (a.get('tags') or '(ninguno)'))

    print('\nLO QUE QUEDARÍA  (%d de 400 caracteres)' % len(DESCRIPCION))
    for l in DESCRIPCION.split('\n'):
        print('  | %s' % l)
    print('  tags: %s' % ', '.join(TAGS))

    if '--aplicar' not in sys.argv:
        print('\n  (no toqué nada — corré con --aplicar)\n')
        return

    r = s.patch('%s/applications/@me' % API,
                json={'description': DESCRIPCION, 'tags': TAGS}, timeout=30)
    if not r.ok:
        print('\n  ❌ %d %s\n' % (r.status_code, r.text[:200]))
        return
    # ⚠️ SE RELEE, no se confía en el 200. `PATCH /users/@me` con `activities`
    # devuelve 200 y descarta el campo: acá un 200 no prueba que se haya
    # escrito nada.
    b = s.get('%s/applications/@me' % API, timeout=30).json()
    ok = (b.get('description') or '') == DESCRIPCION
    print('\n  %s descripción: %d caracteres en el perfil'
          % ('✅' if ok else '⚠️ no coincide —', len(b.get('description') or '')))
    print('  %s tags: %s\n' % ('✅' if b.get('tags') else '⚠️',
                               b.get('tags') or '(ninguno)'))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

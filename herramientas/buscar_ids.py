"""BUSCAR EN DISCORD LOS DISCORD ID QUE FALTAN EN EL SHEET.

    python herramientas/buscar_ids.py            los del pool sin ID
    python herramientas/buscar_ids.py --todos    los 876 del padron
    python herramientas/buscar_ids.py Dlx Zaza   nombres sueltos

⚠️ **NO ESCRIBE NADA, NI EN EL SHEET NI EN NINGUN LADO.** Propone, con el
nombre de Discord al lado para que se pueda decidir. Poner un ID equivocado es
peor que no tenerlo: el bot le muestra a alguien la carta de otro.

POR QUE HACE FALTA
------------------
El `Discord ID` del Operativo es lo unico que deja que `/card` sin argumentos
sepa quien sos. Al 17/09/2026 lo tienen **101 de los 138** que tienen carta.

⚠️ **Y NUEVE ESTAN MARCADOS `✅ Verificado` SIN ID**, entre ellos DLX. O sea que
la verificacion y el ID se cargan por separado y pueden discrepar: alguien
recuerda haberse verificado y el bot no lo reconoce. No es que falte el paso;
es que el paso no deja el dato.

COMO LO CONSIGUE, Y POR QUE NO CUESTA PERMISOS
----------------------------------------------
`GET /guilds/{id}/members/search?query=` **anda con el token del bot y sin
ningun intent privilegiado**. Probado el 17/09/2026: con Server Members
apagado devolvio 200 y encontro a `itsdlx`.

    GET /guilds/{id}/members          403 Missing Access   <- eso si pide intent
    GET /guilds/{id}/members/search   200                  <- esto no

⚠️ **Y ESA DIFERENCIA IMPORTA MAS DE LO QUE PARECE.** `CLAUDE.bot.md` cuenta
como argumento de venta que el bot no pide **ningun** intent: un servidor
aliado lo agrega con `permissions=0` y no puede leer mensajes, ni ver la lista
de miembros, ni quien esta conectado. Listar miembros romperia eso. Buscar por
nombre, no.

⚠️ **SOLO ENCUENTRA A QUIEN ESTE EN UN SERVIDOR DONDE ESTE EL BOT.** Hoy es
FFA. Cuantos mas servidores, mas cubre.

⚠️ **EL NOMBRE DE LA LIGA Y EL DE DISCORD NO SON EL MISMO.** «DLX» en el Sheet
es `itsdlx` en Discord. Por eso esto marca cuanta confianza tiene cada
coincidencia y nunca decide solo.
"""
import io
import json
import os
import re
import sys
import time
import unicodedata

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

API = 'https://discord.com/api/v10'


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def norm(s):
    s = re.sub(r'[\U0001F1E6-\U0001F1FF]', '', str(s)).replace('❓', '')
    s = unicodedata.normalize('NFD', s.strip().lower())
    return ''.join(c for c in s if c.isalnum())


def guilds():
    """Los servidores donde el bot esta, de datos/servidores.json."""
    p = os.path.join(BASE, 'datos', 'servidores.json')
    with io.open(p, encoding='utf-8') as f:
        tab = json.load(f)['servidores']
    return [(k, v['guild_id']) for k, v in tab.items() if v.get('guild_id')]


def buscar(s, gid, texto):
    """Los miembros de ese servidor cuyo nombre empieza con `texto`."""
    for intento in range(4):
        r = s.get('%s/guilds/%s/members/search' % (API, gid),
                  params={'query': texto[:32], 'limit': 10}, timeout=25)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 2)) + 0.3)
            continue
        if not r.ok:
            return None
        return r.json()
    return None


def nombres(m):
    """Todas las formas en que esa persona se puede llamar."""
    u = m.get('user') or {}
    return [x for x in (m.get('nick'), u.get('global_name'), u.get('username'))
            if x]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    gs = guilds()
    print('SERVIDORES DONDE EL BOT PUEDE BUSCAR: %s\n'
          % ', '.join('%s' % k for k, _ in gs))
    vivos = []
    for k, gid in gs:
        r = s.get('%s/guilds/%s' % (API, gid), timeout=25)
        print('   %-6s %s' % (k, r.json().get('name') if r.ok
                              else '⚠️ %d — el bot no esta adentro' % r.status_code))
        if r.ok:
            vivos.append((k, gid))
    if not vivos:
        sys.exit('\nel bot no esta en ningun servidor de la tabla')

    import construir_padron as PAD
    pad = PAD.cargar()
    idx = {norm(x['raw']): x for x in pad}

    if args:
        faltan = [{'raw': a} for a in args]
    else:
        with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                     encoding='utf-8') as f:
            pool = json.load(f)
        quienes = ([x['raw'] for x in pad] if '--todos' in sys.argv
                   else [x['raw'] for x in pool])
        faltan = [{'raw': q} for q in quienes
                  if not (idx.get(norm(q)) or {}).get('discord_id')]

    print('\nBUSCANDO %d nombre(s)\n' % len(faltan))
    exactas, parciales, nada = [], [], []
    for p in faltan:
        q = p['raw']
        halladas = []
        for k, gid in vivos:
            for m in (buscar(s, gid, q) or []):
                halladas.append((k, m))
            time.sleep(0.35)          # el bucket de search es chico
        if not halladas:
            nada.append(q)
            continue
        # ⚠️ EXACTA = alguna de sus formas normaliza igual que el nombre de la
        # Liga. Es la unica que se puede dar por buena sin mirar.
        ex = [(k, m) for k, m in halladas
              if any(norm(n) == norm(q) for n in nombres(m))]
        (exactas if ex else parciales).append((q, ex or halladas))

    def mostrar(titulo, lista, nota):
        print('\n%s (%d) — %s' % (titulo, len(lista), nota))
        for q, hs in lista:
            for k, m in hs[:3]:
                u = m['user']
                print('   %-14s %-19s %s  [%s]  %s'
                      % (q, u['id'], (' · '.join(nombres(m)))[:38], k,
                         '' if m.get('avatar') or u.get('avatar') else '(sin foto)'))

    mostrar('COINCIDEN EXACTO', exactas, 'el nombre de Discord es el de la Liga')
    mostrar('PARECIDAS', parciales, '⚠️ HAY QUE MIRARLAS: el nombre no es igual')
    print('\nSIN NINGUNA COINCIDENCIA (%d) — no estan en esos servidores'
          % len(nada))
    print('   %s' % ', '.join(nada))
    print('\n⚠️ Esto NO escribio nada. Los ID van a mano a la columna '
          '`Discord ID` del Operativo.')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

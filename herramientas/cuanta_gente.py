# -*- coding: utf-8 -*-
"""CUANTA GENTE HAY, CUANTOS ID TENEMOS Y CUANTOS ESTAN VERIFICADOS.

    python herramientas/cuanta_gente.py

Dlx, 19/09/2026: *«¿1.444 usuarios en este servidor y solo 11 nuevos? Suma los
3 servidores cuantos usuarios y cuantos ids o verificaciones tenemos»*.

⚠️ LA PREGUNTA «CUANTA GENTE HAY» TIENE TRES RESPUESTAS DISTINTAS y conviene
no mezclarlas:

    cuentas de Discord   lo que se ve en la lista de miembros. Incluye bots,
                         gente que entro una vez, y la MISMA persona contada
                         tres veces si esta en los tres servidores.
    personas UNICAS      las cuentas distintas, sin repetir.
    gente de la LIGA     las del padron. Es la unica que importa para las
                         tarjetas, y es mucho mas chica.

El «solo 11» se explica solo cuando los tres numeros estan al lado.
"""
import io
import json
import os
import sys
import time

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

API = 'https://discord.com/api/v10'
ROL_MIEMBRO = '1101257512273055745'      # el «Verificado» de DRA
CACHE = os.path.join(os.environ.get('TEMP', '/tmp'), 'miembros_cache.json')


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def servidores():
    with io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8') as f:
        d = json.load(f)
    out = [(k, v['guild_id'], 'carta') for k, v in (d.get('servidores') or {}).items()
           if v.get('guild_id')]
    out += [(k, v['guild_id'], 'identidad')
            for k, v in (d.get('solo_identidad') or {}).items() if v.get('guild_id')]
    return out


def bajar(s, gid):
    out, after = [], '0'
    while True:
        r = s.get('%s/guilds/%s/members' % (API, gid),
                  params={'limit': 1000, 'after': after}, timeout=40)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code != 200:
            return None
        lote = r.json()
        if not lote:
            break
        out += lote
        # 🔴 `key=int` NO ES COSMETICO. Los snowflakes tienen 17, 18 y 19
        # digitos, y `max()` sobre cadenas compara alfabeticamente: asi
        # '999999999999999999' le gana a '1000000000000000000', que es
        # mayor de verdad, y el cursor RETROCEDE. Medido en DRA: 4 paginas
        # y 3.069 filas para 2.707 personas — 362 pedidas dos veces. El
        # conjunto salia bien de casualidad (los `set` deduplican), pero
        # combinado con `break` en una pagina corta puede cortar antes de
        # llegar al final.
        after = max(((m.get('user') or {}).get('id', '0') for m in lote), key=int)
        if len(lote) < 1000:
            break
        time.sleep(0.25)
    return out


def main():
    import construir_padron as PAD

    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')
    mios = {g['id'] for g in s.get('%s/users/@me/guilds' % API, timeout=30).json()}

    print('\n══ LOS SERVIDORES ══\n')
    gente = {}          # sv -> {discord_id: miembro}
    for sv, gid, clase in servidores():
        if gid not in mios:
            print('  %-8s %-10s el bot NO esta adentro' % (sv, clase))
            continue
        ms = bajar(s, gid) or []
        gente[sv] = {(m.get('user') or {}).get('id'): m for m in ms
                     if (m.get('user') or {}).get('id')}
        bots = sum(1 for m in ms if (m.get('user') or {}).get('bot'))
        print('  %-8s %-10s %5d cuentas   (%d bots)' % (sv, clase, len(ms), bots))

    if not gente:
        sys.exit('\nel bot no esta en ningun servidor conocido')

    # ⚠️ LA SUMA NO ES LA SUMA. Quien esta en los tres se cuenta tres veces.
    suma = sum(len(v) for v in gente.values())
    todos = set()
    for v in gente.values():
        todos |= set(v)
    humanos = {d for sv in gente for d, m in gente[sv].items()
               if not (m.get('user') or {}).get('bot')}
    print('\n  sumando            %5d  ← la misma persona contada por servidor' % suma)
    print('  personas UNICAS    %5d  ← %d menos: gente que esta en varios'
          % (len(todos), suma - len(todos)))
    print('  sin contar bots    %5d' % len(humanos))

    print('\n══ LA LIGA (el padron) ══\n')
    pad = PAD.cargar()
    con_id = [p for p in pad if p.get('discord_id')]
    ids = {p['discord_id'] for p in con_id}
    print('  gente en la Liga             %5d' % len(pad))
    print('  con Discord ID cargado       %5d   %.0f %%'
          % (len(con_id), 100 * len(con_id) / max(1, len(pad))))
    print('  sin Discord ID               %5d   ← a estos no se les puede emitir carta'
          % (len(pad) - len(con_id)))

    ubicados = ids & todos
    print('\n  de los que tienen ID, el bot los ve en algun servidor: %d' % len(ubicados))
    print('  con ID pero fuera de los tres:                          %d'
          % (len(ids) - len(ubicados)))

    # ⚠️ EL NUMERO QUE CONTESTA «¿SOLO 11?»: cuanta gente de cada servidor es
    # de la Liga. Un servidor de 1.444 con 30 de la Liga no tiene 1.400 IDs
    # escondidos — tiene 1.400 personas que no compiten.
    print('\n══ CUANTOS DE CADA SERVIDOR SON DE LA LIGA ══\n')
    for sv in gente:
        dela = ids & set(gente[sv])
        print('  %-8s %5d cuentas   ·   %4d son de la Liga  (%.1f %%)'
              % (sv, len(gente[sv]), len(dela), 100 * len(dela) / max(1, len(gente[sv]))))

    # lo que aporta cada uno que los otros NO
    print('\n  lo que aporta cada servidor que los OTROS no tienen:')
    for sv in gente:
        otros = set()
        for o in gente:
            if o != sv:
                otros |= set(gente[o])
        solo = (ids & set(gente[sv])) - otros
        print('     %-8s %4d persona(s) de la Liga que sólo están ahí' % (sv, len(solo)))

    print('\n══ VERIFICADOS EN DRA ══\n')
    if 'DRA' in gente:
        dra = gente['DRA']
        conrol = {d for d, m in dra.items() if ROL_MIEMBRO in (m.get('roles') or [])}
        dela_dra = ids & set(dra)
        print('  miembros de DRA                    %5d' % len(dra))
        print('  con el rol Miembro                 %5d' % len(conrol))
        print('  de la Liga Y en DRA                %5d' % len(dela_dra))
        print('  de la Liga, en DRA y verificados   %5d   ← los que pueden tener carta'
              % len(dela_dra & conrol))
        print('  de la Liga, en DRA y SIN verificar %5d' % len(dela_dra - conrol))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

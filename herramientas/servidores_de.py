# -*- coding: utf-8 -*-
"""EN QUE SERVIDORES ESTA CADA PERSONA, preguntandoselo a DISCORD.

    python herramientas/servidores_de.py          muestra el resumen
    python herramientas/servidores_de.py --json   ademas escribe datos/

🔴 EL `sv` DEL POOL NO ES «TU SERVIDOR», ES EL ARGMAX DE SIETE COLUMNAS DE
PUNTOS. Dlx, 19/09/2026: *«yo soy de DRA»* — y su carta le mostraba **TWR**,
porque en la pre-temporada sumo mas puntos ahi. El Sheet no tiene una columna
«servidor»: la `Sv` esta vacia en 134 de 138, asi que el builder la deduce. Y
deducirla de los puntos es adivinar: estar en un servidor es un HECHO que
Discord sabe.

Es la misma forma que ya se documento con Lil Drako, a quien le aparecia
Fontana habiendo jugado solo en DRA.

⚠️ NO ES LO MISMO QUE «QUE SERVIDOR REPRESENTA». Dlx: *«eventualmente en la T1
dejare q todos tengan la opcion de representar un servidor pero ahora no»*. O
sea que hoy no hay eleccion, hay hecho — y cuando exista la eleccion, va a
tener que ganarle a esto, no reemplazarlo: seguira haciendo falta saber donde
esta cada uno para saber que puede elegir.

⚠️ EL ORDEN IMPORTA Y NO ES ALFABETICO. Es el de PRIORIDAD: en un mensaje
directo no hay servidor en el payload, asi que el bot tiene que elegir uno, y
elige el primero de esta lista donde la persona este. DRA va primero porque es
donde vive la Liga y donde se verifica.

⚠️ PIDE EL INTENT DE MIEMBROS, que ya esta activado. Sin el,
`GET /guilds/{id}/members` da 403 y esto no se puede hacer de a uno: seria una
llamada por persona por servidor.
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
# ⚠️ EL ORDEN ES LA PRIORIDAD PARA LOS MENSAJES DIRECTOS. Ver arriba.
#
# 🔴 ACA VAN SOLO SERVIDORES **DE CARTA**, y desde el 19/09/2026 eso hay que
# decirlo porque el bot ya esta en uno que no lo es. Dlx agrego **LIVONIA
# RAP** «solo para hacer reconocimiento de usuarios, no para cartas»: vive en
# `datos/servidores.json` bajo `solo_identidad` y lo lee
# `herramientas/cruzar_miembros.py`, que es el que saca Discord ID.
#
# Lo que sale de aca alimenta `meta.bot_en` y `p:<n>.svs`, o sea **el menu de
# /card**. Agregar uno de identidad pondria «LIVONIA · 🔒 BLOQUEADA» en la
# carta de 472 personas y pediria dibujar 472 cartas de un servidor que no
# compite en la Liga.
GUILDS = (('DRA', '841017460341604382'), ('FFA', '1468472442925092958'))
SALIDA = os.path.join(BASE, 'datos', 'servidores_de.json')


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def miembros(s, gid):
    out, after = set(), '0'
    while True:
        r = s.get('%s/guilds/%s/members' % (API, gid),
                  params={'limit': 1000, 'after': after}, timeout=40)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code != 200:
            sys.exit('no pude listar %s: %s %s' % (gid, r.status_code, r.text[:120]))
        lote = r.json()
        if not lote:
            break
        for m in lote:
            did = (m.get('user') or {}).get('id')
            if did:
                out.add(did)
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

    dentro = {}
    for sv, gid in GUILDS:
        print('bajando miembros de %s...' % sv)
        dentro[sv] = miembros(s, gid)
        print('   %d miembros' % len(dentro[sv]))

    # {discord_id -> [servidores, en orden de prioridad]}
    mapa = {}
    for sv, _ in GUILDS:
        for did in dentro[sv]:
            mapa.setdefault(did, []).append(sv)

    pad = PAD.cargar()
    con_id = [p for p in pad if p.get('discord_id')]
    ubicados = [p for p in con_id if p['discord_id'] in mapa]
    print('\npadron: %d · con Discord ID: %d · ubicados en algun servidor: %d'
          % (len(pad), len(con_id), len(ubicados)))

    from collections import Counter
    c = Counter(tuple(mapa[p['discord_id']]) for p in ubicados)
    for k, n in sorted(c.items(), key=lambda x: -x[1]):
        print('   %-14s %d' % (' + '.join(k), n))

    # ⚠️ LOS QUE TIENEN ID Y NO ESTAN EN NINGUNO NO SON UN ERROR: se fueron, o
    # su ID quedo de cuando estaban. Se cuentan aparte porque su carta no se
    # puede emitir contra ningun servidor.
    huerfanos = [p for p in con_id if p['discord_id'] not in mapa]
    print('   %-14s %d   (con ID pero fuera de los dos)' % ('en ninguno', len(huerfanos)))
    if huerfanos[:6]:
        print('      %s' % ', '.join(p['raw'] for p in huerfanos[:6]))

    # ⚠️ EN QUÉ SERVIDORES ESTÁ EL BOT, que NO es lo mismo que la tabla de los
    # nueve. `SERVIDORES` lista los nueve del catálogo; el bot hoy es miembro
    # de dos. Sin esta distinción el menú le dice «no estás en TWR» a alguien
    # que SÍ está —Drako lo está— cuando la verdad es que el bot no puede
    # saberlo. Se pregunta a Discord en vez de escribirlo a mano, porque el día
    # que entre a un servidor nuevo nadie se va a acordar de tocar una lista.
    r = s.get('%s/users/@me/guilds' % API, timeout=30)
    todos = {g['id']: g.get('name', '') for g in r.json()} if r.status_code == 200 else {}
    bot_en = [sv for sv, gid in GUILDS if gid in todos]
    print('\nel bot es miembro de: %s' % (', '.join(bot_en) or 'ninguno'))

    # ⚠️ SE AVISA DE LOS QUE NO SON DE CARTA, en vez de ignorarlos en silencio.
    # El bot puede estar en servidores que no compiten —LIVONIA entro el
    # 19/09 sólo para sacar Discord ID— y eso está bien; lo que NO puede pasar
    # es que uno entre sin que nadie decida de qué lado va. Si aparece acá y no
    # está en `datos/servidores.json`, alguien lo invitó y no lo anotó.
    conocidos = {gid for _, gid in GUILDS}
    try:
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'),
                     encoding='utf-8') as f:
            conocidos |= {v['guild_id'] for v in
                          (json.load(f).get('solo_identidad') or {}).values()
                          if v.get('guild_id')}
    except Exception:
        pass
    ajenos = [(gid, n) for gid, n in todos.items() if gid not in conocidos]
    if ajenos:
        print('\n⚠️ el bot está en %d servidor(es) que no están anotados:' % len(ajenos))
        for gid, n in ajenos:
            print('     %-20s %s' % (gid, n))
        print('   -> si es de carta va en `servidores`; si es sólo para sacar')
        print('      IDs va en `solo_identidad`. Los dos en datos/servidores.json.')

    if '--json' in sys.argv:
        json.dump(mapa, io.open(SALIDA, 'w', encoding='utf-8', newline='\n'),
                  ensure_ascii=False, indent=0, sort_keys=True)
        p2 = os.path.join(BASE, 'datos', 'bot_en.json')
        json.dump(bot_en, io.open(p2, 'w', encoding='utf-8', newline='\n'),
                  ensure_ascii=False)
        print('-> %s   (%d ids)' % (os.path.relpath(SALIDA, BASE), len(mapa)))
        print('-> %s   %s' % (os.path.relpath(p2, BASE), bot_en))
    else:
        print('\n  (no escribi nada — corré con --json)')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

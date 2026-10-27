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
import re
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
GUILDS = (('DRA', '841017460341604382'), ('FFA', '1468472442925092958'),
          ('SR', '492346406976356374'), ('URBF', '1467763447117778989'),
          ('FFS', '1367688812892913774'), ('DDF', '1469009547971526659'),
          ('ACAD', '765045834647339038'), ('FVS', '1283205153624952975'),
          ('FRZ', '838593179187544064'), ('FDS', '1489848581203689535'), ('LKR', '1558611504046153750'))
# 🔴 SNAKE RAP ENTRÓ EL 24/09/2026 Y ES DE CARTA, NO DE IDENTIDAD. Es un
# servidor de la Liga —está en `datos/servidores.json`, sus eventos cuentan
# y su camiseta es una de las nueve—, así que va acá y no en
# `solo_identidad`. Tercero y no primero: el orden es la prioridad de los
# mensajes directos, y DRA sigue siendo donde vive la Liga.
#
# ⚠️ DE LOS QUE ESTÁN EN `SOLO_PADRON` SE GUARDAN SÓLO LOS DEL PADRÓN. Son
# 7.337 miembros y este archivo va al repo PÚBLICO: la lista de miembros de
# otro servidor no es nuestra, y el menú de /card sólo la necesita para
# quien puede tener carta. Ver el mismo criterio en `bot/verificados.py`.
# 🟠 URBAN FREESTYLE, DESDE EL 25/09/2026: de carta como Snake Rap, y por
# el mismo motivo sólo se guardan los del padrón. Último en la lista: es el
# más nuevo, y el orden es la prioridad de los mensajes directos.
SOLO_PADRON = {'SR', 'URBF', 'FFS', 'DDF', 'ACAD', 'FVS', 'FRZ', 'FDS', 'LKR'}
SALIDA = os.path.join(BASE, 'datos', 'servidores_de.json')
#: 🔑 LOS NOMBRES DE CADA CUENTA —apodo del servidor, nombre visible y
#: usuario—, para las Pistas de ✅ Decidir: «¿Quién es KULRW?» se contesta
#: solo si KULRW es el apodo de la cuenta que en la Lista es Jult. Medido el
#: 28/09/2026: 24 de 53 nombres desconocidos coinciden con alguien.
#:
#: ⚠️ EN `.cache/` Y NO EN `datos/`: está en `.gitignore` y el ciclo no lo
#: commitea. Son los nombres de ~12.000 personas de cuatro servidores, y la
#: regla de arriba vale igual: las listas no son nuestras. Vive lo que dura
#: el runner —lo escribe el paso 1b y lo lee el 2d, en el mismo trabajo—.
APODOS = os.path.join(BASE, '.cache', 'apodos_discord.json')
_NOMBRES = {}                # discord_id -> [nombres]
_ROLES_DE = {}               # guild_id -> {discord_id: [ids de rol]}

# 🏷️ LOS ROLES DE LA PÁGINA (Dlx, 13/10/2026: «en cada perfil aparezca el rol de cada uno… competidor, organizador,
# staff», y «agrega el título de socio para los owners de los servidores asociados»). STAFF es quien tiene, en un
# servidor de la Liga, un rol con permiso de staff (administrar, gestionar el servidor o gestionar mensajes) o que lo
# diga en el nombre: la MISMA regla que `esStaff()` de `bot/worker.js` usa para /agendar, para que el bot y la página
# digan lo mismo. SOCIO es el dueño del servidor. Lo escribe `datos/roles_discord.json` (sólo gente de la Lista: el
# repo es público y las listas de otro servidor no son nuestras) y lo junta `bot/roles.py`.
ROLES_STAFF = re.compile(r'staff|organiz|moderad|\bmods?\b|admin|host|jurad|evento', re.I)
#: administrar · gestionar el servidor · gestionar mensajes (lo mismo que `esStaff()`)
PERM_STAFF = 8 | 32 | 8192
SALIDA_ROLES = os.path.join(BASE, 'datos', 'roles_discord.json')


#: 🔎 MEDIDO EL 13/10/2026 sobre los 8: «staff» con la regla de /agendar daba 102 personas sólo en FFA y la ACADEMIA,
#: porque mete a los jurados y a los hosts. Los servidores ya los separan con su propio rol, así que se separan acá
#: también, por el NOMBRE del rol (sin el adorno: NFKD), en este orden.
TIPOS_ROL = (('organizador', re.compile(r'organiz', re.I)),
             ('jurado', re.compile(r'jurad', re.I)),
             ('host', re.compile(r'\bhost', re.I)),
             ('staff', re.compile(r'staff|moderad|\bmods?\b|admin|supervis|manager|directiva|l[ií]deres|co-?(owner|due[ñn]o|fund)', re.I)))


def tipo_de_rol(nombre, perm, de_bot=False):
    """Qué rol de la página da un rol de Discord: 'organizador', 'jurado', 'host', 'staff' o None. Un rol de bot, nada;
    uno con permiso de administración, staff aunque el nombre no lo diga."""
    import unicodedata
    if de_bot:
        return None
    n = unicodedata.normalize('NFKD', str(nombre or ''))
    for t, rx in TIPOS_ROL:
        if rx.search(n):
            return t
    return 'staff' if perm & PERM_STAFF else None


#: 🏷️ LOS ROLES DE DRA QUE DICEN QUÉ ES CADA UNO (la tanda 2 del perfil, 27/10/2026: «el rol de DRA en el perfil»): los que
#: se eligen al entrar —«🎤﹒Freestyler», «💞﹒ Fanatico»…—, en el orden en que se prefieren si tiene varios. «Competidor» no:
#: eso ya lo dice la página (jugó en la temporada). La misma lista que `ROLES_DRA` de bot/avisos.js
ROLES_DRA = ('Freestyler', 'M.C', 'Rapero', 'Artista', 'Productor', 'Fanático')
_DRA_RX = (('Freestyler', r'freestyler'), ('M.C', r'm\.?\s?c'), ('Rapero', r'rapero'), ('Artista', r'artista'),
           ('Productor', r'productor'), ('Fanático', r'fanatic[oa]'))


def rol_dra(nombre):
    """El rol de DRA que dice qué es alguien (`ROLES_DRA`), por el nombre del rol sin el adorno, o None."""
    import unicodedata
    n = ''.join(c for c in unicodedata.normalize('NFKD', str(nombre or '')) if not unicodedata.combining(c)).lower()
    n = re.sub(r'^[^a-z0-9]*', '', n).strip()
    for nombre_rol, rx in _DRA_RX:
        if re.fullmatch(r'(?:%s)\W*' % rx, n):
            return nombre_rol
    return None


def roles_por_servidor(s):
    """`{tipo: {did: [svs]}}` con 'organizador', 'jurado', 'host', 'staff' y 'socio' (el dueño), de los servidores de
    `GUILDS`. Un servidor que no contesta queda afuera (no frena nada)."""
    out = {t: {} for t in ('organizador', 'jurado', 'host', 'staff', 'socio', 'dra')}
    for sv, gid in GUILDS:
        try:
            g = s.get('%s/guilds/%s' % (API, gid), timeout=30)
            roles = s.get('%s/guilds/%s/roles' % (API, gid), timeout=30)
        except requests.RequestException:
            continue
        if g.status_code == 200 and g.json().get('owner_id'):
            out['socio'].setdefault(str(g.json()['owner_id']), []).append(sv)
        if roles.status_code != 200:
            continue
        tipo, dra = {}, {}
        for r in roles.json() or []:
            if str(r.get('id')) == gid:                  # @everyone
                continue
            try:
                perm = int(r.get('permissions') or 0)
            except ValueError:
                perm = 0
            t = tipo_de_rol(r.get('name'), perm, de_bot=bool(r.get('managed') or (r.get('tags') or {}).get('bot_id')))
            if t:
                tipo[str(r.get('id'))] = t
            # 🏷️ y en DRA, el rol que eligió cada uno al entrar (Freestyler, Rapero…): va a su perfil (`rol_dra()`)
            rd = rol_dra(r.get('name')) if sv == 'DRA' else None
            if rd:
                dra[str(r.get('id'))] = rd
        for did, rs in (_ROLES_DE.get(gid) or {}).items():
            ds = sorted({dra[x] for x in map(str, rs) if x in dra}, key=ROLES_DRA.index)
            if ds:
                out['dra'][did] = ds
            for t in {tipo[x] for x in map(str, rs) if x in tipo}:
                lst = out[t].setdefault(did, [])
                if sv not in lst:
                    lst.append(sv)
        time.sleep(0.2)
    return out


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
            u = m.get('user') or {}
            # los bots no son gente: ni tienen carta ni cuentan en la comunidad
            if u.get('id') and not u.get('bot'):
                out.add(u['id'])
                # 🏷️ y sus roles, para saber quién es staff (ver `staff_y_socios()`)
                _ROLES_DE.setdefault(gid, {})[u['id']] = list(m.get('roles') or [])
                ns = _NOMBRES.setdefault(u['id'], [])
                for x in (m.get('nick'), u.get('global_name')):
                    if x and x.strip() and x.strip() not in ns:
                        ns.append(x.strip())
                # 🔴 EL USUARIO, SIEMPRE ÚLTIMO (pasada del 19/10/2026): `nombres.Reconocer` toma el último como el usuario
                # —el único único en Discord, que vale siempre— y una cuenta en dos servidores quedaba con el apodo del
                # segundo DETRÁS del usuario, así que un apodo corto («Max») contaba como si fuera único
                un = (u.get('username') or '').strip()
                if un:
                    if un in ns:
                        ns.remove(un)
                    ns.append(un)
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

    pad = PAD.cargar()
    ids_padron = {str(p['discord_id']) for p in pad if p.get('discord_id')}

    # {discord_id -> [servidores, en orden de prioridad]}
    mapa = {}
    for sv, _ in GUILDS:
        for did in dentro[sv]:
            if sv in SOLO_PADRON and did not in ids_padron:
                continue
            mapa.setdefault(did, []).append(sv)

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
    print('   %-14s %d   (con ID pero fuera de los %d)'
          % ('en ninguno', len(huerfanos), len(GUILDS)))
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

    # 🔑 CUÁNTAS PERSONAS DISTINTAS HAY EN LA LIGA. Dlx, 25/09/2026: «¿cuántas
    # personas diferentes tenemos…? Quizás ese dato podríamos agregarlo a La
    # Liga hoy». Sumar los servidores cuenta dos veces a quien está en dos
    # —medido ese día: 12.036 sumando, 10.004 personas—, y las listas enteras
    # ya están acá, así que la cuenta de verdad no cuesta ni un pedido más.
    #
    # ⚠️ SÓLO EL NÚMERO VA AL REPO, que es público: las listas no son nuestras.
    todas = set().union(*dentro.values()) if dentro else set()
    print('\npersonas distintas en los %d: %d (sumando serían %d)'
          % (len(GUILDS), len(todas), sum(len(v) for v in dentro.values())))

    if '--json' in sys.argv:
        with io.open(os.path.join(BASE, 'datos', 'comunidad.json'), 'w',
                     encoding='utf-8', newline='\n') as f:
            json.dump({'_leeme': 'Cuántas personas distintas hay en los servidores de la '
                                 'Liga (sin bots). Lo escribe herramientas/servidores_de.py '
                                 'en cada corrida; lo muestra «La Liga hoy».',
                       'personas': len(todas),
                       'servidores': [sv for sv, _ in GUILDS]},
                      f, ensure_ascii=False, indent=1)
        json.dump(mapa, io.open(SALIDA, 'w', encoding='utf-8', newline='\n'),
                  ensure_ascii=False, indent=0, sort_keys=True)
        p2 = os.path.join(BASE, 'datos', 'bot_en.json')
        json.dump(bot_en, io.open(p2, 'w', encoding='utf-8', newline='\n'),
                  ensure_ascii=False)
        print('-> %s   (%d ids)' % (os.path.relpath(SALIDA, BASE), len(mapa)))
        # 🏷️ staff y socios (ver `staff_y_socios()`): de la Lista, el staff; los socios, todos (son los dueños)
        try:
            rp = roles_por_servidor(s)
            dump = {'_leeme': 'Los roles de Discord que da cada servidor de la Liga, por el nombre del rol '
                              '(organizador, jurado, host, staff; ver tipo_de_rol()) y socio = el dueño. Lo escribe '
                              'herramientas/servidores_de.py; lo junta bot/roles.py. Sólo gente de la Lista, salvo los '
                              'socios (son los dueños de los servidores).'}
            for t, m in rp.items():
                dump[t] = {d: v for d, v in sorted(m.items()) if t == 'socio' or d in ids_padron}
            json.dump(dump, io.open(SALIDA_ROLES, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=0)
            print('-> %s   (%s)' % (os.path.relpath(SALIDA_ROLES, BASE),
                                    ' · '.join('%d %s' % (len(dump[t]), t) for t in rp)))
        except Exception as e:                           # noqa: BLE001
            print('⚠️ no pude sacar los roles de los servidores (%s)' % str(e)[:80])
        print('-> %s   %s' % (os.path.relpath(p2, BASE), bot_en))
        # los nombres, fuera de git: ver `APODOS`
        try:
            os.makedirs(os.path.dirname(APODOS), exist_ok=True)
            # 🔑 Y EN QUÉ SERVIDORES ESTÁ CADA CUENTA, SIN EL FILTRO DEL PADRÓN.
            # `servidores_de.json` guarda de Snake Rap y Urban Freestyle sólo a
            # quien ya está en la Lista (va al repo público), y «¿quién es X?»
            # es justo de alguien que todavía no está: `decidir.por_discord()`
            # lo daba por ido de la Liga. Medido el 28/09/2026: 10 de 50
            # nombres desconocidos, seis de ellos anotados con ese nombre en
            # inscripciones. Acá sí van todos: esto no sale del runner.
            with io.open(APODOS, 'w', encoding='utf-8') as f:
                json.dump({'_leeme': 'Los nombres de Discord de cada cuenta de los servidores '
                                     'de la Liga, y en cuáles está, para ✅ Decidir. NO SE COMMITEA.',
                           'nombres': _NOMBRES,
                           'servidores': {did: [sv for sv, _ in GUILDS if did in dentro[sv]]
                                          for did in todas}}, f, ensure_ascii=False)
            print('-> %s   (%d cuentas, fuera de git)'
                  % (os.path.relpath(APODOS, BASE), len(_NOMBRES)))
        except OSError as e:
            print('⚠️ no pude dejar los apodos para ✅ Decidir (%s)' % str(e)[:60])
    else:
        print('\n  (no escribi nada — corré con --json)')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

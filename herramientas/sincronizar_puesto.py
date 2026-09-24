# -*- coding: utf-8 -*-
"""PONER EL «#PUESTO» DEL RANKING COMPETITIVO EN EL APODO, EN DRA Y EN FFA.

    python herramientas/sincronizar_puesto.py             muestra el plan
    python herramientas/sincronizar_puesto.py --aplicar   cambia los apodos
    python herramientas/sincronizar_puesto.py --revertir  deshace la ultima tanda

Dlx, 19/09/2026: el `#` del apodo pasa de salir del **Ranking Temporada (top
30)** a salir del **Ranking Competitivo (los 138)**. Son rankings distintos, asi
que los numeros cambian: Konan era #7 por Temporada y es **#1** por Competitivo.

⚠️ EL NUMERO NO SE CALCULA: SE LEE. La hoja «Ranking Competitivo» del Oficial
ya trae su columna `#` (y al lado una «Posición # Temporada», que es de donde
salian los apodos viejos). Ordenar por Score a mano daria casi lo mismo y
«casi» es el problema: si el Sheet desempata distinto, los apodos dejan de
coincidir con lo que la gente ve en el ranking.

⚠️ EL NOMBRE SALE DE DRA, EN LOS DOS SERVIDORES. Dlx, 19/09/2026: *«los nombres
se basan tmb en DRA, o sea Bloody en DRA, Bloody; entonces en FFA ## | Bloody»*.
Los apodos de DRA son «<marca> | <nombre>» —«🐉 | Vandu», «#7 | Konan»—: se
toma ese nombre y se le cambia la marca por «#N».

La primera version conservaba el apodo DE CADA SERVIDOR, y eso partia la
identidad en dos: Bloody quedaba «#22 | Bloody» en DRA y «#22 | Slenderman» en
FFA, que es el nombre que el se habia puesto alla. DRA es la referencia, asi
que el mismo nombre va a los dos lados.

Si no esta en DRA o no tiene apodo ahi, se usa el nombre del ranking.

⚠️ QUIEN TIENE «#N» Y YA NO ESTA EN EL RANKING SE REPORTA, NO SE TOCA. Su
numero quedo viejo, pero elegirle una marca nueva (🐉? 👤?) seria inventar la
convencion del servidor.

⚠️ GUARDA EL APODO ANTERIOR de cada uno en `docs/apodos_<fecha>.json`, y
`--revertir` los devuelve. Cambiar el nombre que ve todo un servidor tiene que
poder deshacerse.

⚠️ TRES COSAS QUE DISCORD NO DEJA, y no son errores: el apodo tope son 32
caracteres (se recorta), al DUEÑO del servidor no se le puede cambiar nunca, y
a quien tenga un rol mas alto que el del bot tampoco. Se reportan y se saltean.

🔴 QUIEN LLEVA EL «#N» SE DECIDE ENTRE DOS, Y SON TRES ESTADOS.
Dlx, 19/09/2026: *«si un usuario estaba en on y después yo lo apago, gana el
usuario y conserva su apodo, porque eso es algo suyo. Si no lo usaron, siguen
lo que deciden los admins»*.

    la persona eligio con /puesto   ->  manda ella, siempre
    la persona no eligio            ->  manda el servidor (/settings)
    el servidor tampoco             ->  prendido, como venia andando

⚠️ POR ESO LA CLAVE GUARDA `on: true|false` Y NO ALCANZA CON QUE EXISTA. La
primera version usaba la PRESENCIA de `poff:<guild>:<id>` como «apagado», y eso
no distingue «lo prendió a proposito» de «nunca lo toco» — sin esa distincion
la regla de arriba no se puede escribir. Hoy la clave es `pnick:<guild>:<id>` y
NO EXISTIR es el tercer estado.

⚠️ Y ES POR SERVIDOR: se puede llevar en DRA y no en FFA.

Las dos decisiones viven en el KV del Worker (`pnick:` y `cfg:`), que es donde
las escriben `/puesto` y `/settings`; este script las lee antes de armar el
plan y las aplica, porque cambiar un apodo se hace con el token.

⚠️ NO ALCANZA CON SALTEARLO: hay que SACARLE el «#N» si lo tiene. Si sólo se
lo dejara afuera del plan, quien pidió que se lo saquen se quedaría con el
número viejo puesto para siempre, que es justo lo contrario de lo que pidió.
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
# el KV del Worker, donde `/puesto` guarda quien no quiere su numero
CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
KV = 'a87399a3a0b647b0803aa90509ccce56'
KV_API = ('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s'
          % (CUENTA, KV))
GUILDS = (('DRA', '841017460341604382'), ('FFA', '1468472442925092958'))
# ⚠️ EL ID VIVE EN `sheet/planillas.py`, NO ACA. Estaba copiado en
# cinco archivos: hoy coinciden y por eso no se nota, pero **la T1
# estrena planilla nueva** y ese dia el que se olvide de actualizar su
# copia lee la planilla vieja y devuelve datos validos de la temporada
# equivocada. No falla: miente.
from planillas import OFICIAL  # noqa: E402
HOJA = 'Ranking Competitivo'
TOPE = 32
MARCA = re.compile(r'^\s*#\s*\d+\s*(\||$)')


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def sin_bandera(s):
    return re.sub(r'[\U0001F1E6-\U0001F1FF‍️]', '', s).strip()


def ranking():
    """[(puesto, nombre)] leido de la hoja, sin calcular nada."""
    import gspread
    from google.oauth2.service_account import Credentials
    gc = gspread.authorize(Credentials.from_service_account_file(
        os.path.join(BASE, 'creds.json'),
        scopes=['https://www.googleapis.com/auth/spreadsheets.readonly']))
    v = gc.open_by_key(OFICIAL).worksheet(HOJA).get_all_values()
    cab = next(i for i, f in enumerate(v) if '#' in [x.strip() for x in f]
               and 'Rapero' in [x.strip() for x in f])
    H = [x.strip() for x in v[cab]]
    iN, iR = H.index('#'), H.index('Rapero')
    out = []
    for f in v[cab + 1:]:
        if len(f) <= iR:
            continue
        n, r = f[iN].strip(), f[iR].strip()
        if n.isdigit() and r:
            out.append((int(n), sin_bandera(r)))
    return out


def bajar(s, gid):
    out, after = {}, '0'
    while True:
        r = s.get('%s/guilds/%s/members' % (API, gid),
                  params={'limit': 1000, 'after': after}, timeout=40)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code != 200:
            sys.exit('no pude listar %s: %s' % (gid, r.status_code))
        lote = r.json()
        if not lote:
            break
        for m in lote:
            did = (m.get('user') or {}).get('id')
            if did:
                out[did] = m
        # 🔴 `key=int` NO ES COSMETICO. Los snowflakes tienen 17, 18 y 19
        # digitos, y `max()` sobre cadenas compara alfabeticamente: asi
        # '999999999999999999' le gana a '1000000000000000000', que es
        # mayor de verdad, y el cursor RETROCEDE. Medido en DRA: 4 paginas
        # y 3.069 filas para 2.707 personas — 362 pedidas dos veces. El
        # conjunto salia bien de casualidad (los `set` deduplican), pero
        # combinado con `break` en una pagina corta puede cortar antes de
        # llegar al final.
        after = max(((m.get('user') or {}).get('id', '0') for m in lote), key=int)
        time.sleep(0.25)
    return out


def poner_apodo(s, gid, did, apodo):
    for _ in range(5):
        r = s.patch('%s/guilds/%s/members/%s' % (API, gid, did),
                    headers={'Content-Type': 'application/json',
                             'X-Audit-Log-Reason': 'Liga Global: puesto del Competitivo'},
                    data=json.dumps({'nick': apodo}), timeout=20)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code in (200, 204):
            return True, ''
        try:
            return False, '%s %s' % (r.status_code, r.json().get('message', ''))
        except Exception:
            return False, str(r.status_code)
    return False, 'rate limit'


def _leer_kv(prefijo, tok):
    """{clave: valor} de todo lo que empiece con ese prefijo."""
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + tok
    claves, cursor = [], None
    while True:
        p = {'prefix': prefijo, 'limit': 1000}
        if cursor:
            p['cursor'] = cursor
        j = s.get(KV_API + '/keys', params=p, timeout=30).json()
        if not j.get('success'):
            raise RuntimeError(str(j.get('errors'))[:120])
        claves += [k['name'] for k in j.get('result', [])]
        cursor = (j.get('result_info') or {}).get('cursor')
        if not cursor:
            break
    out = {}
    # ⚠️ POR `bulk/get` Y NO DE A UNA. El endpoint de a una sirve una copia
    # CACHEADA —ya hizo perder media hora en subir_datos.py— y ademas serian
    # cientos de llamadas.
    for i in range(0, len(claves), 100):
        r = s.post(KV_API + '/bulk/get', json={'keys': claves[i:i + 100]}, timeout=30)
        if r.ok:
            out.update(((r.json().get('result') or {}).get('values') or {}))
    return out


def quien_lleva_numero():
    """{(guild, discord_id) -> True/False}, cruzando persona y servidor.

    🔴 SON TRES ESTADOS Y NO DOS. Dlx, 19/09/2026: *«si un usuario estaba en on
    y después yo lo apago, gana el usuario y conserva su apodo, porque eso es
    algo suyo. Si no lo usaron, siguen lo que deciden los admins»*.

        la persona eligio  ->  manda ella, siempre
        la persona no      ->  manda el servidor (`cfg:<guild>.nick`)
        el servidor tampoco ->  prendido, que es como venia andando

    Devuelve SOLO lo que difiere del default, para no tener que enumerar a los
    4.000 miembros: la clave existe cuando alguien —persona o servidor— dijo
    algo distinto de «prendido».

    ⚠️ SI KV NO CONTESTA, SE SIGUE SIN LAS PREFERENCIAS Y SE AVISA. Frenar la
    sincronizacion entera porque una API de terceros esta caida seria peor: lo
    unico que se pierde es que un puñado de apodos vuelva a llevar el numero,
    y la proxima corrida lo corrige. Lo que NO se hace es callarlo.
    """
    # ⚠️ NO SE USA env() ACA: hace sys.exit si falta la clave, y SystemExit no
    # lo atrapa `except Exception`. Faltar el token de Cloudflare no puede
    # tumbar una sincronizacion de apodos que no lo necesita.
    tok = ''
    try:
        for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
            if l.strip().startswith('CLOUDFLARE_API_TOKEN='):
                tok = l.split('=', 1)[1].strip().strip('"\'')
    except Exception:
        pass
    if not tok:
        print('   ⚠️ sin CLOUDFLARE_API_TOKEN en .env — sigo sin las preferencias')
        return {}, {}
    try:
        personas = {}
        for k, v in _leer_kv('pnick:', tok).items():
            partes = k.split(':')
            if len(partes) != 3:
                continue
            try:
                personas[(partes[1], partes[2])] = bool(json.loads(v).get('on'))
            except Exception:
                pass
        servidores = {}
        for k, v in _leer_kv('cfg:', tok).items():
            gid = k.split(':', 1)[1]
            try:
                servidores[gid] = json.loads(v).get('nick', True) is not False
            except Exception:
                pass
        return personas, servidores
    except Exception as e:
        print('   ⚠️ no pude leer las preferencias de KV (%s) — sigo sin ellas' % str(e)[:60])
        return {}, {}


def solo_el_nombre(apodo):
    """«🐉 | Vandu» -> «Vandu» · «#7 | Konan» -> «Konan» · «» -> «»."""
    if not apodo:
        return ''
    return (apodo.split('|', 1)[1] if '|' in apodo else apodo).strip()


def destino(puesto, nombre):
    return ('#%d | %s' % (puesto, nombre))[:TOPE]


def main():
    import requests
    import construir_padron as PAD

    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    if '--revertir' in sys.argv:
        resp = sorted(f for f in os.listdir(os.path.join(BASE, 'docs'))
                      if f.startswith('apodos_'))
        if not resp:
            sys.exit('no hay respaldo de apodos que revertir')
        datos = json.load(io.open(os.path.join(BASE, 'docs', resp[-1]), encoding='utf-8'))
        print('\nrevirtiendo %d apodo(s) desde %s\n' % (len(datos['cambios']), resp[-1]))
        n = 0
        for c in datos['cambios']:
            ok, _ = poner_apodo(s, c['guild'], c['id'], c['antes'] or None)
            n += 1 if ok else 0
            time.sleep(0.4)
        print('  revertidos: %d de %d\n' % (n, len(datos['cambios'])))
        return

    print('\nleyendo el Ranking Competitivo...')
    rank = ranking()
    print('   %d puestos (del #%d al #%d)' % (len(rank), rank[0][0], rank[-1][0]))

    pad = PAD.cargar()
    idx = {PAD.norm(x['raw']): x for x in pad}
    puesto_de = {}          # discord_id -> (puesto, nombre)
    sin_id = []
    for n, nombre in rank:
        did = (idx.get(PAD.norm(nombre)) or {}).get('discord_id')
        if did:
            puesto_de[did] = (n, nombre)
        else:
            sin_id.append('#%d %s' % (n, nombre))
    print('   con Discord ID: %d   ·   sin ID (no se les puede tocar): %d'
          % (len(puesto_de), len(sin_id)))

    miembros = {}
    for sv, gid in GUILDS:
        print('\nbajando miembros de %s...' % sv)
        miembros[sv] = bajar(s, gid)
        print('   %d miembros' % len(miembros[sv]))

    # ⚠️ EL NOMBRE ES EL DE DRA, PARA LOS DOS SERVIDORES. Sin esto la misma
    # persona queda con dos nombres distintos: «#22 | Bloody» en DRA y
    # «#22 | Slenderman» en FFA.
    def nombre_de(did, del_ranking):
        return solo_el_nombre((miembros.get('DRA', {}).get(did) or {}).get('nick')
                              or '') or del_ranking

    print('\nleyendo las preferencias de /puesto y /settings...')
    eleccion, por_servidor = quien_lleva_numero()
    print('   %d personas eligieron a mano   ·   %d servidor(es) configurado(s)'
          % (len(eleccion), len(por_servidor)))
    for gid, on in sorted(por_servidor.items()):
        nom = next((s for s, g in GUILDS if g == gid), gid)
        print('      %-5s el #N está %s por decisión del servidor'
              % (nom, 'ACTIVADO' if on else 'APAGADO'))

    plan, viejos, ocultos = [], [], 0
    for sv, gid in GUILDS:
        for did, m in miembros[sv].items():
            actual = m.get('nick') or ''
            if did in puesto_de:
                n, del_ranking = puesto_de[did]
                # 🔴 LA PRECEDENCIA, EN UN SOLO LUGAR: lo que eligió la persona
                # gana; si no eligió, manda el servidor; si el servidor tampoco
                # dijo nada, prendido.
                lleva = eleccion.get((gid, did))
                if lleva is None:
                    lleva = por_servidor.get(gid, True)
                # ⚠️ AL QUE NO LO LLEVA HAY QUE SACÁRSELO, no saltearlo. Si
                # sólo se lo dejara afuera del plan, el número viejo le queda
                # puesto para siempre — lo contrario de lo que pidió.
                if not lleva:
                    ocultos += 1
                    nuevo = solo_el_nombre(actual) or nombre_de(did, del_ranking)
                else:
                    nuevo = destino(n, nombre_de(did, del_ranking))
                if nuevo != actual:
                    plan.append({'guild': gid, 'sv': sv, 'id': did, 'antes': actual,
                                 'nuevo': nuevo, 'oculto': not lleva,
                                 'user': (m.get('user') or {}).get('username')})
            elif MARCA.match(actual):
                # tiene un #N viejo y ya no esta en el ranking
                viejos.append((sv, actual, (m.get('user') or {}).get('username')))

    print('\n  ✅ apodos a cambiar: %d   ·   con el puesto oculto por pedido: %d'
          % (len(plan), ocultos))
    for c in plan[:45]:
        print('     [%s] %-24s -> %-24s%s'
              % (c['sv'], (c['antes'] or '(sin apodo)')[:24], c['nuevo'][:24],
                 '  🙈 /puesto off' if c.get('oculto') else ''))
    if len(plan) > 45:
        print('     … y %d mas' % (len(plan) - 45))
    print('  🔎 tienen #N viejo y NO estan en el Competitivo (no se tocan): %d' % len(viejos))
    for sv, ap, u in viejos:
        print('     [%s] %-24s @%s' % (sv, ap[:24], u))
    if sin_id:
        print('  ❔ en el ranking pero sin Discord ID: %d' % len(sin_id))
        print('     %s' % ', '.join(sin_id[:18]))

    if '--aplicar' not in sys.argv:
        print('\n  (nada cambiado — corré con --aplicar)\n')
        return

    p = os.path.join(BASE, 'docs', 'apodos_%s.json' % time.strftime('%Y%m%d_%H%M'))
    json.dump({'cuando': time.strftime('%Y-%m-%d %H:%M'), 'cambios': plan},
              io.open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('\n  respaldo -> %s' % os.path.relpath(p, BASE))

    ok, fallos = 0, []
    for c in plan:
        bien, err = poner_apodo(s, c['guild'], c['id'], c['nuevo'])
        if bien:
            ok += 1
            if ok % 25 == 0:
                print('   %d de %d...' % (ok, len(plan)))
        else:
            fallos.append((c['sv'], c['user'], err))
        time.sleep(0.4)
    print('\n  ✅ apodos puestos: %d de %d' % (ok, len(plan)))
    for sv, u, e in fallos:
        print('     ⚠️ [%s] %-20s %s' % (sv, u, e))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

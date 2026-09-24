# -*- coding: utf-8 -*-
"""EN QUE ESTADO ESTA CADA PERSONA DE LA LIGA: ID y VERIFICACION.

    python herramientas/estado_verificacion.py           el padron entero
    python herramientas/estado_verificacion.py --pool    solo los que tienen carta

Las tres preguntas de Dlx, contestadas con datos frescos:
  1. cuantas estan VERIFICADAS        -> tienen ID, estan en DRA y tienen Miembro
  2. cuantas tienen ID y NO verificadas
  3. cuantas NO tienen ID y NO verificadas

⚠️ LOS ROLES SE BAJAN FRESCOS. El cache de `cruzar_miembros.py` es de antes de
las ultimas asignaciones, asi que contar con el deja afuera lo recien hecho.

⚠️ SE CUENTAN PERSONAS, NO FILAS. El padron trae la misma persona dos veces
cuando hay un alias con fila propia (Oasis/Fullylo4ded, Lzz/Luzzano, KRT/
Krtman...). Se colapsan por el par de AKAs y, si comparten Discord ID, por el
ID. Si no, «870 personas» cuenta de mas y el porcentaje miente.

⚠️ EL ID PUEDE ESTAR EN LA FILA DEL ALIAS, y por eso se busca tambien ahi:
`Luzzano` figura sin ID y lo tiene cargado en `Lzz`.
"""
import io
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

API = 'https://discord.com/api/v10'
DRA = '841017460341604382'


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def _rol():
    d = json.load(io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8'))
    return ((d.get('canales') or {}).get('DRA') or {}).get('verificacion_rol') or ''


def miembros_dra(s):
    out, after = {}, '0'
    while True:
        r = s.get('%s/guilds/%s/members' % (API, DRA),
                  params={'limit': 1000, 'after': after}, timeout=40)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        if r.status_code != 200:
            sys.exit('no pude listar DRA: %s' % r.status_code)
        lote = r.json()
        if not lote:
            break
        for m in lote:
            did = (m.get('user') or {}).get('id')
            if did:
                out[did] = m.get('roles') or []
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


def main():
    import requests
    import construir_padron as PAD
    try:
        import construir_akas as AK
        akd = AK.cargar()
    except Exception:
        akd = {}

    rol = _rol()
    pad = PAD.cargar()
    idx = {PAD.norm(x['raw']): x for x in pad}

    # el id puede estar en la fila del alias
    porreal = {}
    for a, r in (akd.get('pares') or []):
        porreal.setdefault(PAD.norm(r), []).append(PAD.norm(a))
    def id_de(nombre):
        n = PAD.norm(nombre)
        d = (idx.get(n) or {}).get('discord_id')
        if d:
            return d
        for al in porreal.get(n, []):
            d = (idx.get(al) or {}).get('discord_id')
            if d:
                return d
        return ''

    if '--pool' in sys.argv:
        with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'), encoding='utf-8') as f:
            nombres = [x['raw'] for x in json.load(f)]
        de = 'los que HOY tienen carta'
    else:
        nombres = [x['raw'] for x in pad]
        de = 'toda la Liga (padron)'

    # ── colapsar la misma persona: por par de AKAs y por ID compartido ─────
    canon = {}
    for a, r in (akd.get('pares') or []):
        na, nr = PAD.norm(a), PAD.norm(r)
        if na in idx and nr in idx:
            canon[na] = nr          # el alias apunta al nombre real
    vistos, gente = {}, []
    for n in nombres:
        clave = canon.get(PAD.norm(n), PAD.norm(n))
        did = id_de(n)
        if did and did in vistos:
            continue                # misma persona por ID compartido
        if clave in vistos:
            continue
        vistos[clave] = True
        if did:
            vistos[did] = True
        gente.append((n, did))

    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')
    print('\nbajando roles frescos de DRA...')
    roles = miembros_dra(s)
    print('   %d miembros en DRA\n' % len(roles))

    verif, id_sin_ver_dentro, id_sin_ver_fuera, sin_id = [], [], [], []
    for n, did in gente:
        if not did:
            sin_id.append(n)
        elif did not in roles:
            id_sin_ver_fuera.append(n)
        elif rol in roles[did]:
            verif.append(n)
        else:
            id_sin_ver_dentro.append(n)

    t = len(gente)
    pc = lambda x: 100.0 * len(x) / max(t, 1)
    print('%d personas — %s   (filas del padron: %d)' % (t, de, len(nombres)))
    print('=' * 62)
    print('  ✅ VERIFICADAS (ID + en DRA + rol Miembro)   %4d   %5.1f%%' % (len(verif), pc(verif)))
    print('  ⏳ CON ID, NO verificadas                    %4d   %5.1f%%'
          % (len(id_sin_ver_dentro) + len(id_sin_ver_fuera),
             pc(id_sin_ver_dentro + id_sin_ver_fuera)))
    print('       · en DRA, les falta el rol              %4d' % len(id_sin_ver_dentro))
    print('       · ni siquiera estan en DRA              %4d' % len(id_sin_ver_fuera))
    print('  ❔ SIN ID y no verificadas                   %4d   %5.1f%%' % (len(sin_id), pc(sin_id)))
    print('=' * 62)
    if id_sin_ver_dentro:
        print('\n  EN DRA SIN EL ROL (%d) — estos se pueden verificar ya:\n     %s'
              % (len(id_sin_ver_dentro), ', '.join(sorted(id_sin_ver_dentro))))
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

# -*- coding: utf-8 -*-
"""🔁 LOS QUE VUELVEN: EL ROL «INACTIVO» DE DRA, CON NUESTRA REGLA (28/11/2026).

    python bot/inactivos.py              cuántos, sin tocar nada (lo mismo que `--ver`)
    python bot/inactivos.py --ver        idem, con los números contra el rol de hoy
    python bot/inactivos.py --aplicar    pone y saca el rol en DRA (hasta `TOPE` cambios por vuelta) y anota el estado
    python bot/inactivos.py --aplicar --tope 3000   la primera vez, todo de una (con la pausa: ~1 cambio por segundo)
    python bot/inactivos.py --ciclo      lo que corre el ciclo (paso 2b8g2): anota el estado y, sólo con `ENCENDIDO`,
                                         pone y saca el rol
    python bot/inactivos.py --auto       el self-check, sin red (CI)

LO QUE DECIDIÓ DLX (28/11/2026)
  · INACTIVO ES: jugó al menos un evento en la temporada (los resultados de la T1) y hace 45 días o más (`DIAS`) que no
    juega en NINGÚN servidor socio. Quien nunca jugó NO es inactivo: es nuevo (lo suyo es «🐣 Para los nuevos»).
  · LA PERSONA ES LA DE TODO EL SISTEMA: las filas salen de `retencion.filas()` (`espejo_t1.fuente('Resultados')`, los
    renombres por `rankings.canon()` y sin los troll), no de una cuenta aparte.
  · EL ROL ES EL QUE YA EXISTE EN DRA («Inactivo», hoy lo pone Utili «Inactive Role» mirando el chat; Dlx lo apaga). Se
    busca por nombre normalizado (NFKD: los nombres de DRA van en letras decoradas). Se toca ESE rol y ningún otro:
      - se le da a los miembros de DRA que son inactivos por nuestra regla;
      - se le saca a quien lo tiene y no lo es, también a los que marcó Utili y juegan (o nunca jugaron: son nuevos).
  · CUANDO UN INACTIVO VUELVE A JUGAR: se le saca el rol y se anota «volvió» con el día (`datos/inactivos.json`,
    `volvieron`), para celebrarlo y medirlo.
  · ⏸️ APAGADO HASTA EL OK DE DLX (`ENCENDIDO`): el ciclo anota y cuenta, y no toca roles. A mano, `--aplicar`.

POR DÓNDE VIAJA
  · al objeto, con la lista de primerizos (`bot/primerizos.py` → `/avisos/primerizos-ciclo`, campo `inact`): los
    Discord ID de los inactivos y sus días. El objeto los guarda en `regreso_inact` (bot/nuevos.js) y con eso decide
    quién puede anotarse en el panel «🔁 De regreso» y a quién avisarle UNA vez, en la campana, el día que cruza los 45
    (la campana es la que lee el buzón de hilos privados, bot/buzon.js: nunca por DM).
  · `nuevos_de_hoy()`: los que cruzaron los 45 en esta vuelta, por si otra pieza los quiere (el buzón ya los recibe por
    la campana).

⚠️ LOS DISCORD ID VAN AL REPO (`datos/inactivos.json`), sin nombres: decidido, como en el resto del sistema.
⚠️ Lo que se escribe en Discord: sólo ese rol, con la razón del registro de auditoría `RAZON`, de a `TOPE` por vuelta
y con pausa (`PAUSA`), respetando el 429.
"""
import datetime as dt
import io
import json
import os
import sys
import time
import unicodedata
from urllib.parse import quote

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# ═══ ✏️ LO QUE SE PRENDE Y LOS NÚMEROS ══════════════════════════════════════════════════════════════════════════════
#: el ciclo pone y saca el rol sólo con esto en True (el OK de Dlx). A mano, `--aplicar` siempre escribe
ENCENDIDO = False
#: días sin jugar para ser inactivo
DIAS = 45
#: cuántos días después de cruzar los 45 todavía se avisa (el ciclo puede saltear una vuelta o un día)
AVISO_DIAS = 3
#: cambios de rol por vuelta (el ciclo corre cada media hora: 40 son 80 por hora sin tocar el límite de Discord)
TOPE = 40
#: segundos entre un cambio y otro
PAUSA = 1.0
RAZON = 'Liga Global: inactivo (45 días sin jugar)'
#: cuánto se guardan los «volvió»
VOLVIERON_DIAS = 400

GUILD = '841017460341604382'
API = 'https://discord.com/api/v10'
UA = 'DiscordBot (https://underlegends.pages.dev, 1)'
ARCHIVO = os.path.join(BASE, 'datos', 'inactivos.json')


def _et():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        return dt.timezone(dt.timedelta(hours=-4))


def norm(s):
    """Para los nombres de los roles: letras decoradas → letras, sin espacios ni signos, en minúsculas."""
    s = unicodedata.normalize('NFKD', str(s or '')).lower()
    return ''.join(c for c in s if c.isalnum())


# ── la regla ─────────────────────────────────────────────────────────────────────────────────────────────────────────

def ultimas(fs):
    """`{persona: instante UTC de su último evento}` de las filas de `retencion.filas()`. Pura."""
    out = {}
    for _num, _sv, t, q in fs:
        if q not in out or t > out[q]:
            out[q] = t
    return out


def inactivos(ult, ahora, dias=DIAS):
    """`{persona: días sin jugar}` de los que llevan `dias` o más. Quien no está en `ult` nunca jugó: no entra. Pura."""
    out = {}
    for q, t in ult.items():
        d = (ahora - t).days
        if d >= dias:
            out[q] = d
    return out


def mapa_ids(padron, canon=None):
    """`f(persona) -> discord_id | None`, del padrón: por el nombre tal cual, si no por el normalizado (y si dos filas
    con Discord distinto se normalizan igual, ninguna: no se adivina). `canon` lleva el nombre de la fila al de siempre."""
    import construir_padron as PAD
    canon = canon or (lambda n: n)
    exacto, por_norm, choca = {}, {}, set()
    for x in padron or []:
        did = str(x.get('discord_id') or '').strip()
        raw = x.get('raw') or ''
        if not raw or not did.isdigit():
            continue
        for nombre in {raw, canon(raw)}:
            exacto.setdefault(nombre, did)
            k = PAD.norm(nombre)
            if k in por_norm and por_norm[k] != did:
                choca.add(k)
            por_norm.setdefault(k, did)

    def f(persona):
        if persona in exacto:
            return exacto[persona]
        k = PAD.norm(persona)
        return None if k in choca else por_norm.get(k)
    return f


def por_id(inact, ult, ids, fuera=()):
    """`{discord_id: [días sin jugar, 'YYYY-MM-DD' del último evento (ET)]}` de los inactivos con Discord, sin `fuera`
    (Dlx, los que pidieron olvidarse). Si dos personas dan el mismo ID (un renombre sin unir), gana la que jugó más
    tarde: con un evento reciente en cualquiera de sus nombres, no es inactiva. Pura."""
    et = _et()
    por = {}
    for q, t in ult.items():
        did = ids(q)
        if did and (did not in por or t > por[did][0]):
            por[did] = (t, q)
    out = {}
    for did, (t, q) in por.items():
        if did in fuera or q not in inact:
            continue
        out[did] = [inact[q], t.astimezone(et).date().isoformat()]
    return out


def plan(inact_ids, miembros, rol):
    """`(dar, sacar)`: a quién ponerle el rol (inactivo y miembro de DRA, sin el rol) y a quién sacárselo (lo tiene y no
    es inactivo por nuestra regla). `miembros` es `{discord_id: [roles]}`. Pura."""
    tienen = {m for m, rs in miembros.items() if rol in (rs or [])}
    dar = sorted((set(inact_ids) & set(miembros)) - tienen, key=int)
    sacar = sorted(tienen - set(inact_ids), key=int)
    return dar, sacar


def volvieron(antes, ahora_ids, ult_ids, hoy):
    """🎉 Los que estaban inactivos en la vuelta anterior (`antes`: `{did: [días, último]}`) y volvieron a jugar: su último
    evento es posterior al que tenían. `[[did, 'YYYY-MM-DD' de la vuelta, días que estuvo afuera]]`. Quien salió de la
    lista sin jugar (una corrección de resultados) no volvió. Pura."""
    out = []
    for did, (_d, ult0) in (antes or {}).items():
        if did in ahora_ids:
            continue
        u = ult_ids.get(did)
        if u and u > ult0:
            out.append([did, u, (dt.date.fromisoformat(u) - dt.date.fromisoformat(ult0)).days])
    return sorted(out, key=lambda x: (x[1], x[0]))


def nuevos_de_hoy(antes, ahora_ids, dias=DIAS, margen=AVISO_DIAS):
    """📬 Los que cruzaron los 45 días en esta vuelta: inactivos ahora, no en la anterior, y con a lo sumo `margen` días
    de más (así la primera vuelta no le avisa a los de hace meses). `[discord_id]`. Pura."""
    return sorted((d for d, (n, _u) in ahora_ids.items() if d not in (antes or {}) and n <= dias + margen), key=int)


def para_objeto(estado):
    """Lo que viaja al objeto con los primerizos (`inact`): `[[discord_id, días sin jugar, 'YYYY-MM-DD' del último
    evento]]` (el día y no los días: así el objeto escribe sólo cuando alguien entra o sale, no cada vez que pasa un día).
    `None` si no se pudo medir (sin filas): el objeto no borra su tabla por un dato que falta."""
    if not estado or not estado.get('jugadores'):
        return None
    return [[d, v[0], v[1]] for d, v in sorted(estado['inactivos'].items(), key=lambda x: int(x[0]))]


# ── los datos de hoy ─────────────────────────────────────────────────────────────────────────────────────────────────

def _json(ruta, defecto):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _fuera():
    import verificados as V
    fuera = {V.DUENO}
    fuera |= set((_json(os.path.join(BASE, 'datos', 'olvidados.json'), {}) or {}).get('gente') or {})
    return fuera


def medir(ahora=None, fs=None):
    """Sin red: `{dia, jugadores, inactivos: {did: [días, último]}, ult: {did: último}, sin_id, n_inact}`."""
    import retencion as RT
    import rankings as R
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    fs = RT.filas() if fs is None else fs
    ult = ultimas(fs)
    inact = inactivos(ult, ahora)
    ids = mapa_ids(_json(os.path.join(BASE, 'datos', 'padron.json'), []), R.canon)
    fuera = _fuera()
    ina = por_id(inact, ult, ids, fuera)
    et = _et()
    ult_ids = {}
    for q, t in ult.items():
        d = ids(q)
        if d:
            s = t.astimezone(et).date().isoformat()
            ult_ids[d] = max(s, ult_ids.get(d, ''))
    return {'dia': ahora.astimezone(et).date().isoformat(), 'jugadores': len(ult), 'n_inact': len(inact),
            'sin_id': sum(1 for q in inact if not ids(q)), 'inactivos': ina, 'ult': ult_ids}


def _sesion(tok):
    import requests
    s = requests.Session()
    s.headers.update({'Authorization': 'Bot ' + tok, 'User-Agent': UA})
    return s


def _pedir(s, metodo, ruta, **kw):
    r = None
    for _ in range(6):
        r = s.request(metodo, API + ruta, timeout=30, **kw)
        if r.status_code == 429:
            try:
                espera = float(r.json().get('retry_after', 2))
            except ValueError:
                espera = 2.0
            time.sleep(espera + 0.3)
            continue
        return r
    return r


def rol_inactivo(roles):
    """El rol de DRA cuyo nombre (normalizado) dice «inactivo». `(rol, motivo)`: rol None si no hay o hay más de uno."""
    cand = [r for r in roles or [] if 'inactiv' in norm(r.get('name'))]
    if not cand:
        return None, 'no hay ningún rol con «Inactivo» en el nombre'
    if len(cand) > 1:
        exactos = [r for r in cand if norm(r.get('name')) in ('inactivo', 'inactiva', 'inactivos')]
        if len(exactos) == 1:
            return exactos[0], ''
        return None, 'hay %d roles con «Inactivo»: %s' % (len(cand), ', '.join(r['name'] for r in cand))
    return cand[0], ''


def discord(tok):
    """`(rol, miembros {did: [roles]}, bots, puede, motivo)` de DRA. Sólo lee."""
    import verificados as V
    s = _sesion(tok)
    r = _pedir(s, 'GET', '/guilds/%s/roles' % GUILD)
    if r is None or r.status_code != 200:
        return None, {}, set(), False, 'Discord no me dio los roles de DRA (%s)' % (r.status_code if r is not None else '—')
    roles = r.json()
    rol, motivo = rol_inactivo(roles)
    if not rol:
        return None, {}, set(), False, motivo
    V.BOTS.clear()
    miembros = V._miembros(s)
    # ¿el bot está más arriba que ese rol? Si no, Discord no lo deja ponerlo
    puede = False
    try:
        yo = _pedir(s, 'GET', '/users/@me').json().get('id')
        mio = _pedir(s, 'GET', '/guilds/%s/members/%s' % (GUILD, yo)).json().get('roles') or []
        pos = {x['id']: x.get('position', 0) for x in roles}
        perm = 0
        for x in roles:
            if x['id'] in mio or x['id'] == GUILD:
                perm |= int(x.get('permissions') or 0)
        admin = bool(perm & 8)
        puede = (admin or bool(perm & (1 << 28))) and max([pos.get(x, 0) for x in mio] or [0]) > pos.get(rol['id'], 0)
    except Exception:                                    # noqa: BLE001
        puede = False
    return rol, miembros, set(V.BOTS), puede, ''


def aplicar(tok, rol, dar, sacar, tope=TOPE, pausa=PAUSA):
    """Pone y saca el rol: primero saca (a quien juega no se lo deja marcado), después pone. Hasta `tope` cambios.
    `(puestos, sacados, fallas)`."""
    s = _sesion(tok)
    s.headers['X-Audit-Log-Reason'] = quote(RAZON)
    hechos = {'PUT': 0, 'DELETE': 0}
    fallas = 0
    cola = [('DELETE', d) for d in sacar] + [('PUT', d) for d in dar]
    for k, (m, did) in enumerate(cola[:tope]):
        if k:
            time.sleep(pausa)
        r = _pedir(s, m, '/guilds/%s/members/%s/roles/%s' % (GUILD, did, rol['id']))
        if r is not None and r.status_code in (200, 204):
            hechos[m] += 1
        elif r is not None and r.status_code == 404:
            pass                                         # ya no está en DRA: la vuelta siguiente no lo ve
        else:
            fallas += 1
    return hechos['PUT'], hechos['DELETE'], fallas


# ── el estado ────────────────────────────────────────────────────────────────────────────────────────────────────────

def leer_estado():
    return _json(ARCHIVO, {}) or {}


def nuevo_estado(antes, M, hoy=None):
    """El archivo de esta vuelta: los inactivos de hoy, los que volvieron (sumados a los de antes) y los que cruzaron hoy."""
    hoy = hoy or M['dia']
    vol = volvieron((antes or {}).get('inactivos'), M['inactivos'], M['ult'], hoy)
    desde = (dt.date.fromisoformat(hoy) - dt.timedelta(days=VOLVIERON_DIAS)).isoformat()
    viejos = [v for v in (antes or {}).get('volvieron') or [] if v[1] >= desde]
    ya = {(v[0], v[1]) for v in viejos}
    todos = viejos + [v for v in vol if (v[0], v[1]) not in ya]
    out = {'v': 1, 'dia': hoy, 'dias': DIAS, 'jugadores': M['jugadores'], 'sin_id': M['sin_id'],
           'inactivos': M['inactivos'], 'volvieron': todos, 'hoy': nuevos_de_hoy((antes or {}).get('inactivos'), M['inactivos'])}
    if (antes or {}).get('rol'):
        out['rol'] = antes['rol']
    return out, vol


def guardar_estado(e):
    with io.open(ARCHIVO, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(e, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write('\n')


# ── todo junto ───────────────────────────────────────────────────────────────────────────────────────────────────────

def correr(modo):
    """`modo`: 'ver' (sin escribir nada), 'aplicar' (roles + estado) o 'ciclo' (estado, y roles sólo con ENCENDIDO)."""
    M = medir()
    antes = leer_estado()
    est, vol = nuevo_estado(antes, M)
    ina = M['inactivos']
    print('   🔁 inactivos (jugaron en la temporada y hace %d días o más que no): %d de %d jugadores · %d con Discord en '
          'el padrón · %d sin Discord' % (DIAS, M['n_inact'], M['jugadores'], len(ina), M['sin_id']))
    if vol:
        print('   🔁 🎉 volvieron a jugar: %d (desde la vuelta anterior)' % len(vol))
    if est['hoy']:
        print('   🔁 📬 cruzaron los %d días en esta vuelta: %d (se les avisa una vez, en la campana)' % (DIAS, len(est['hoy'])))
    import fotos as F
    tok = os.environ.get('DISCORD_TOKEN') or F.env('DISCORD_TOKEN', obligatorio=False)
    escribir_roles = modo == 'aplicar' or (modo == 'ciclo' and ENCENDIDO)
    if tok:
        rol, miembros, bots, puede, motivo = discord(tok)
        if not rol:
            print('   ⚠️ %s: no toco ningún rol' % motivo)
        else:
            for b in bots:
                miembros.pop(b, None)
            dar, sacar = plan(ina, miembros, rol['id'])
            tienen = {m for m, rs in miembros.items() if rol['id'] in rs}
            en_dra = set(ina) & set(miembros)
            print('   🔁 el rol «%s» (%s): lo tienen hoy %d · inactivos que son miembros de DRA: %d · de ellos ya lo tienen %d'
                  % (rol['name'], rol['id'], len(tienen), len(en_dra), len(en_dra & tienen)))
            jugaron = {d for d in tienen if d in M['ult']}
            print('   🔁 de los %d que lo tienen: %d jugaron en la temporada y NO son inactivos (juegan) · %d nunca jugaron '
                  '(nuevos, o sin Discord en el padrón)' % (len(tienen), len(jugaron - set(ina)), len(tienen - set(M['ult']))))
            print('   🔁 el plan: se les da a %d · se les saca a %d%s' % (
                len(dar), len(sacar), ('' if puede else ' · ⚠️ el bot no puede ponerlo (le falta «Gestionar roles» o está más abajo)')))
            if escribir_roles and puede and (dar or sacar):
                tope = TOPE
                if '--tope' in sys.argv:
                    try:
                        tope = max(1, int(sys.argv[sys.argv.index('--tope') + 1]))
                    except (IndexError, ValueError):
                        tope = TOPE
                p, s_, fallas = aplicar(tok, rol, dar, sacar, tope=tope)
                print('   🔁 ✅ hecho: %d puestos · %d sacados%s%s' % (p, s_, (' · %d fallaron' % fallas) if fallas else '',
                      (' · faltan %d para la vuelta siguiente' % (len(dar) + len(sacar) - p - s_ - fallas))
                      if len(dar) + len(sacar) > p + s_ + fallas else ''))
                est['rol'] = {'id': rol['id'], 'dia': est['dia'], 'puestos': p, 'sacados': s_, 'fallas': fallas}
            elif not escribir_roles:
                print('   (simulacro: no toqué ningún rol%s)' % (' — `ENCENDIDO` está apagado' if modo == 'ciclo' else ' — `--aplicar`'))
    else:
        print('   ⚠️ sin DISCORD_TOKEN: no miro ni toco el rol')
    if modo in ('aplicar', 'ciclo'):
        guardar_estado(est)
    return est


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────

def _self_check():
    print('\n  inactivos.py — self-check\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '❌', que))

    U = dt.timezone.utc
    t = lambda d: dt.datetime(2026, 9, 25, 20, tzinfo=U) + dt.timedelta(days=d)  # noqa: E731
    ahora = t(100)
    fs = [(1, 'FFA', t(0), 'Ana'), (2, 'DDF', t(10), 'Ana'),           # último hace 90 días: inactiva
          (3, 'FFA', t(56), 'Beto'),                                    # hace 44: todavía no
          (4, 'FFA', t(55), 'Caro'),                                    # hace 45 justos: sí
          (5, 'URBF', t(5), 'Dani'), (6, 'FFA', t(99), 'Dani'),         # jugó ayer en otro servidor: no
          (7, 'FFA', t(1), 'Eli')]                                      # sin Discord
    ult = ultimas(fs)
    ina = inactivos(ult, ahora)
    ok(set(ina) == {'Ana', 'Caro', 'Eli'} and ina['Caro'] == 45, '45 días o más sin jugar en NINGÚN servidor: Ana, Caro (justo 45) y Eli')
    ok('Beto' not in ina and 'Dani' not in ina, 'a los 44 todavía no; quien jugó ayer en otro servidor, tampoco')
    ok('Fede' not in ina, 'quien nunca jugó no es inactivo: es nuevo')
    pad = {'Ana': '100000000000000001', 'Caro': '100000000000000003', 'Dani': '100000000000000004', 'Dlx': '739338101603696681'}
    ids = lambda q: pad.get(q)  # noqa: E731
    pi = por_id(ina, ult, ids, fuera={'739338101603696681'})
    ok(set(pi) == {'100000000000000001', '100000000000000003'} and pi['100000000000000001'][0] == 90,
       'por Discord ID: los que tienen Discord en el padrón, con sus días')
    # dos nombres, un ID (un renombre sin unir): con uno reciente, no es inactivo
    dos = {'Ana': '100000000000000001', 'Ana Vieja': '100000000000000001'}
    ult2 = dict(ult, **{'Ana Vieja': t(99)})
    ok(por_id(inactivos(ult2, ahora), ult2, dos.get) == {}, 'un ID con dos nombres: manda el evento más reciente')
    ok(por_id(ina, ult, ids, fuera={'100000000000000001'}).keys() == {'100000000000000003'}, '«olvidarme» y Dlx quedan afuera')
    # el plan contra el rol de hoy
    R_ = '999'
    miem = {'100000000000000001': [], '100000000000000003': [R_], '100000000000000004': [R_], '100000000000000009': [R_, '5']}
    dar, sacar = plan(pi, miem, R_)
    ok(dar == ['100000000000000001'], 'se le da a la inactiva que es de DRA y no lo tiene')
    ok(sacar == ['100000000000000004', '100000000000000009'],
       'se le saca a quien juega (Dani) y a quien nunca jugó (lo marcó Utili mirando el chat)')
    ok(plan({'100000000000000077': [50, '2026-10-01']}, miem, R_) == ([], ['100000000000000003', '100000000000000004', '100000000000000009']),
       'un inactivo que no está en DRA no recibe nada (no se puede)')
    # volvió
    antes = {'100000000000000001': [80, '2026-10-05'], '100000000000000003': [50, '2026-11-01'], '100000000000000008': [60, '2026-10-01']}
    hoy_ids = {'100000000000000003': [51, '2026-11-01']}
    ult_ids = {'100000000000000001': '2026-12-20', '100000000000000003': '2026-11-01', '100000000000000008': '2026-10-01'}
    v = volvieron(antes, hoy_ids, ult_ids, '2026-12-21')
    ok(v == [['100000000000000001', '2026-12-20', 76]], 'volvió: salió de la lista porque jugó, con el día y cuánto estuvo afuera')
    ok(all(x[0] != '100000000000000008' for x in v), 'salir de la lista sin jugar (una corrección) no es volver')
    # los que cruzan hoy
    ahora_ids = {'1': [45, 'x'], '2': [46, 'x'], '3': [120, 'x'], '4': [45, 'x']}
    ok(nuevos_de_hoy({'4': [44, 'x']}, ahora_ids) == ['1', '2'], 'cruzaron hoy: los nuevos en la lista con 45–48 días')
    ok(nuevos_de_hoy({}, ahora_ids) == ['1', '2', '4'] and '3' not in nuevos_de_hoy({}, ahora_ids),
       'la primera vuelta no le avisa a los de hace meses')
    # el estado
    M = {'dia': '2026-12-21', 'jugadores': 9, 'sin_id': 1, 'inactivos': hoy_ids, 'ult': ult_ids}
    e, _v = nuevo_estado({'inactivos': antes, 'volvieron': [['100000000000000001', '2026-12-20', 76]]}, M)
    ok(len(e['volvieron']) == 1, 'el mismo «volvió» no se anota dos veces')
    ok(para_objeto(e) == [['100000000000000003', 51, '2026-11-01']] and para_objeto({'jugadores': 0, 'inactivos': {}}) is None,
       'al objeto: ID y días; sin filas no viaja nada (el objeto no borra por un dato que falta)')
    # el rol, por nombre decorado
    rs = [{'id': '1', 'name': '𝐈𝐧𝐚𝐜𝐭𝐢𝐯𝐨'}, {'id': '2', 'name': '・Miembro'}, {'id': '3', 'name': 'Rango SSS'}]
    ok(rol_inactivo(rs)[0]['id'] == '1', 'el rol se encuentra con su nombre en letras decoradas (NFKD)')
    ok(rol_inactivo(rs[1:])[0] is None and rol_inactivo(rs + [{'id': '4', 'name': 'ex-inactivos 2025'}])[0]['id'] == '1',
       'sin rol, ninguno; con dos, el que se llama justo así')
    ok(quote(RAZON).isascii() and 'd%C3%ADas' in quote(RAZON), 'la razón del registro va codificada (Discord pide ASCII en el header)')
    ok(not ENCENDIDO, 'apagado hasta el OK de Dlx')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal == 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 0 if _self_check() else 1
    modo = 'aplicar' if '--aplicar' in sys.argv else 'ciclo' if '--ciclo' in sys.argv else 'ver'
    correr(modo)
    return 0


if __name__ == '__main__':
    sys.exit(main())

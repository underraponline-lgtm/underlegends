# -*- coding: utf-8 -*-
"""EL PAÍS Y EL MIEMBRO DE DRA, SOLOS, EN CADA CICLO — #8 y #9 de Dlx.

    python bot/autoverificar.py              qué haría: lee Discord, no escribe
    python bot/autoverificar.py --aplicar    lo hace, con topes
    python bot/autoverificar.py --auto       el self-check, sin red

Dlx, 25/09/2026, a las preguntas guardadas:

    #8  el escritor de la columna País con los roles de país  «si dale»
    #9  autoverificar: automático en el ciclo, y a mano       «podríamos
                                          hacer ambos para ahorrar el trabajo»
    #11 verificado sólo si está en DRA          «necesitamos que todas las
                                   personas que se verifiquen estén en DRA»

LO QUE HACE, EN ESTE ORDEN
--------------------------
1. EL PAÍS (#8). Quien tiene Discord ID en la Lista y no tiene país recibe
   el de sus roles, con la regla que ya estaba escrita
   (`sheet/pais_por_rol.decidir()`): gana USA, después el rol de país de
   DRA, después el de los otros servidores —FFA, Snake Rap, LIVONIA, La
   Confederación— y al final la bandera del nombre. `pais_fijado` de
   `datos/identidades.json` gana sobre todo eso.
   Se escriben las DOS columnas, `Bandera` (el nombre, como ya lo escribe
   la hoja) y `País` (el código): el portón lee una y la carta la otra.
2. EL MIEMBRO DE DRA (#9). Quien tiene ID, está en DRA, no tiene el
   Miembro y tiene país recibe el Miembro, y se le saca el Invitado.

⚠️ EL PAÍS VA PRIMERO PORQUE VERIFICAR SIN PAÍS NO DA NADA: el portón pide
las tres cosas (`verificados.pasa()`). Medido el 25/09/2026: de 32 con ID y
sin país, **12 ya tenían el Miembro de DRA**. Lo único que les faltaba para
tener carta era la columna que nadie escribía.

CÓMO MIRA DISCORD: DE A UNO
---------------------------
El ciclo ya sabe quién está en DRA (`datos/servidores_de.json`) y quién
tiene el Miembro (`datos/verificados.json`), así que los candidatos salen
de ahí sin bajar nada, y a Discord se le pregunta por cada candidato
(`GET /guilds/{g}/members/{id}`). Bajar las 15.000 personas de cinco
servidores cada media hora para mirar a 32 sería pagar el barrido entero
por nada.

⚠️ QUIEN NO TIENE PAÍS EN NINGÚN LADO SE VUELVE A MIRAR AL OTRO DÍA, no a
la media hora: `datos/autoverificar.json`, que el ciclo guarda. Sin esa
memoria, los 20 que no están en ningún servidor costarían 100 pedidos por
corrida para contestar lo mismo.

⚠️ LOS IDS POR NOMBRE SIGUEN A MANO (`herramientas/cruzar_miembros.py`).
Acá no se escribe ningún ID: el que llega solo es el de `/card`, que es
seguro porque lo firma Discord (`sheet/registrar_ids.py`, #11). Emparejar
un nombre con una cuenta es el paso que ya costó sangre dos veces.

GUARDAS
-------
· VERIFICADO ES SÓLO EL MIEMBRO DE DRA (Dlx, 24/09). Si `servidores.json`
  dice otro rol que `verificados.ROL_MIEMBRO`, no se verifica a nadie.
· TOPES. Por corrida se aplican hasta 15 países y 5 verificaciones; el
  resto queda para la siguiente. Pero si los candidatos pasan de 60 y de
  10, NO se aplica ninguno y le llega un DM a Dlx: eso no es el goteo de
  todos los días, es algo que se rompió —un padrón vacío, un rol que
  cambió de ID—.
· SE SALTEA a `no_verificar`, a los olvidados y a los trolls (`no_rankear`).
· EL PAÍS SE ESCRIBE SÓLO SI `Bandera` Y `País` SIGUEN VACÍAS EN LA HOJA
  VIVA, releída antes de escribir: el padrón local es de hace media hora.
  Y la fila se busca por su Discord ID; si dos filas lo tienen, ninguna.
· DE LOS OTROS SERVIDORES SÓLO VALEN LOS ROLES CON BANDERA EN EL NOMBRE.
  El texto solo engaña: «usa» está adentro de «Pausa», y USA gana todo.
· DOS PAÍSES Y NINGUNO ES USA: NO SE TOCA. Elegir sería adivinar.
· NUNCA TOCA `Rapero`, NUNCA ESCRIBE UN ID Y NUNCA TUMBA EL CICLO.
· Lo que hace lo cuenta en el canal de Logs (`alertar.normal`).
"""
import datetime
import io
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
for _d in ('sheet', 'herramientas'):
    if os.path.join(BASE, _d) not in sys.path:
        sys.path.append(os.path.join(BASE, _d))

API = 'https://discord.com/api/v10'
MEMORIA = os.path.join(BASE, 'datos', 'autoverificar.json')

#: por corrida: lo que se aplica, y el resto queda para la siguiente
TOPE_PAISES, TOPE_VERIFICAR = 15, 5
#: más candidatos que esto no es el goteo normal: no se aplica nada
RARO_PAISES, RARO_VERIFICAR = 60, 10
#: quien no tiene país en ningún servidor se vuelve a mirar pasado esto
REMIRAR_H = 20


def _ahora():
    return datetime.datetime.now(datetime.timezone.utc)


def _json(*partes):
    try:
        with io.open(os.path.join(BASE, *partes), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def cc_bandera(texto):
    """El código de la primera bandera del texto (`🇨🇱` -> `cl`), o `''`."""
    t = str(texto or '')
    for i in range(len(t) - 1):
        a, b = ord(t[i]), ord(t[i + 1])
        if 0x1F1E6 <= a <= 0x1F1FF and 0x1F1E6 <= b <= 0x1F1FF:
            return chr(a - 0x1F1E6 + 97) + chr(b - 0x1F1E6 + 97)
    return ''


def _iso_de_nombre():
    """{'Argentina': 'ar', …}, de `sheet/padron_t1.PAIS_ISO`: no se copia."""
    try:
        from padron_t1 import PAIS_ISO
        return dict(PAIS_ISO)
    except Exception:                                    # noqa: BLE001
        return {}


def norm(s):
    import construir_padron as PAD
    return PAD.norm(s)


# ── la decisión, pura ──────────────────────────────────────────────────
def pais_de(p, suyos, fijado, iso_de):
    """(código, por qué) para esa fila, o ('', por qué) si no se puede.

    `suyos` es `{servidor: [códigos]}` de sus roles de país; `fijado`, el
    nombre de `pais_fijado` si lo tiene; `iso_de`, nombre -> código.
    """
    import pais_por_rol as PR
    if fijado:
        cc = iso_de.get(fijado) or ''
        return (cc, 'pais_fijado') if cc else ('', 'pais_fijado sin código: %s' % fijado)
    columna = iso_de.get((p.get('pais') or '').strip()) or ''
    emoji = cc_bandera(p.get('full'))
    cc, por = PR.decidir(columna, emoji, suyos.get('DRA', []),
                         {k: v for k, v in suyos.items() if k != 'DRA' and v})
    if not cc and emoji:
        return emoji, 'bandera del nombre'
    return cc or '', por


def candidatos(pad, en_dra, con_miembro, saltear, memoria, ahora):
    """(para_pais, para_verificar): filas del padrón, sin tocar la red.

    · país: tiene ID, no tiene país, no se salta, y no se miró hace poco
    · verificar: tiene ID, está en DRA, no tiene el Miembro, no se salta
    """
    vistos = (memoria or {}).get('sin_pais') or {}
    pp, pv = [], []
    for p in pad:
        did = str(p.get('discord_id') or '').strip()
        if not did or did in saltear or norm(p.get('raw')) in saltear:
            continue
        if not (p.get('pais') or '').strip():
            t = vistos.get(did)
            try:
                viejo = (ahora - datetime.datetime.fromisoformat(t)).total_seconds() \
                    > REMIRAR_H * 3600 if t else True
            except ValueError:
                viejo = True
            if viejo:
                pp.append(p)
        if did in en_dra and did not in con_miembro:
            pv.append(p)
    return pp, pv


# ── Discord ────────────────────────────────────────────────────────────
def _sesion():
    import requests
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        return None
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + tok
    return s


def _pedir(s, metodo, url, **kw):
    for _ in range(5):
        r = s.request(metodo, url, timeout=25, **kw)
        if r.status_code == 429:
            try:
                espera = float(r.json().get('retry_after', 1))
            except ValueError:
                espera = 1.0
            time.sleep(espera + .3)
            continue
        return r
    return r


def miembro(s, gid, did):
    """Sus roles en ese servidor, `None` si no está. Levanta si Discord falla."""
    r = _pedir(s, 'GET', '%s/guilds/%s/members/%s' % (API, gid, did))
    if r.status_code == 404:
        return None
    if r.status_code != 200:
        raise RuntimeError('%s: %s' % (gid, r.status_code))
    return r.json().get('roles') or []


def mapas_de_roles(s, guilds):
    """{servidor: {rol_id: código}}. DRA por la tabla de IDs; el resto,
    sólo roles con bandera en el nombre."""
    import pais_por_rol as PR
    out = {}
    for sv, gid in guilds:
        if sv == 'DRA':
            out[sv] = dict(PR.ROLES)
            continue
        r = _pedir(s, 'GET', '%s/guilds/%s/roles' % (API, gid))
        if r.status_code != 200:
            print('   ⚠️ %s: no pude leer los roles (%s)' % (sv, r.status_code))
            continue
        out[sv] = {x['id']: PR._iso_del_nombre(x['name']) for x in r.json()
                   if cc_bandera(x['name']) and PR._iso_del_nombre(x['name'])}
    return out


def roles_de_pais(s, guilds, mapas, did, dra_roles=None):
    """{servidor: [códigos]} de esa persona, en DRA y en los otros."""
    suyos = {}
    if dra_roles is None and 'DRA' in mapas:
        dra_roles = miembro(s, dict(guilds)['DRA'], did)
    if dra_roles:
        cs = sorted({mapas['DRA'][x] for x in dra_roles if x in mapas['DRA']})
        if cs:
            suyos['DRA'] = cs
    # ⚠️ LOS OTROS SE MIRAN AUNQUE DRA YA DIGA UN PAÍS: «si una de las dos
    # es USA, gana USA», y ese USA puede estar en otro servidor.
    for sv, gid in guilds:
        if sv == 'DRA' or sv not in mapas:
            continue
        rs = miembro(s, gid, did)
        cs = sorted({mapas[sv][x] for x in (rs or []) if x in mapas[sv]})
        if cs:
            suyos[sv] = cs
    return suyos


# ── la hoja ────────────────────────────────────────────────────────────
#: lo que en `Bandera` o `País` quiere decir «no se sabe». `❓` es lo que la
#: hoja pone a quien no tiene país, y el padrón ya lo lee como vacío.
VACIO = ('', '❓', '?')


def plan_hoja(v, i, col, poner, rango):
    """(celdas, van, ya): qué escribir, a quién, y a quién no y por qué.

    Pura, para poder probarla sin la hoja. `v` son las filas de la Lista,
    `i` la de la cabecera, `col` {columna: índice} y `rango(a1)` arma el
    rango con el nombre de la hoja.

    🔴 `❓` CUENTA COMO VACÍO. La primera corrida en la nube (25/09/2026,
    2:22 AM) encontró los 15 países y escribió **cero**: la `Bandera` de
    esas filas decía `❓`, el padrón lo lee como «sin país» —por eso eran
    candidatos— y esta guarda pedía la celda vacía de verdad. Y lo salteaba
    **callada**, así que la corrida dijo «hecho: 0» sin decir por qué.
    """
    fila_de = {}
    for k, f in enumerate(v):
        if k > i:
            d = _celda(f, col['Discord ID'])
            if d:
                fila_de.setdefault(d, []).append(k + 1)
    letra = lambda j: chr(ord('A') + j)
    celdas, van, ya = [], [], []
    for did, cc, nombre in poner:
        fs = fila_de.get(did) or []
        if len(fs) != 1:
            ya.append((did, 'está en %d filas' % len(fs)))
            continue
        f = v[fs[0] - 1]
        ban, pa = _celda(f, col['Bandera']), _celda(f, col['País'])
        if ban not in VACIO or pa not in VACIO:
            # alguien lo puso en la última media hora: no se pisa
            ya.append((did, 'la hoja ya dice %s' % (ban if ban not in VACIO else pa)))
            continue
        celdas += [{'range': rango('%s%d' % (letra(col['Bandera']), fs[0])),
                    'values': [[nombre]]},
                   {'range': rango('%s%d' % (letra(col['País']), fs[0])),
                    'values': [[cc]]}]
        van.append((did, cc, nombre, _celda(f, col['Rapero'])))
    return celdas, van, ya


def _celda(fila, j):
    return (fila[j] if j is not None and j < len(fila) else '').strip()


def escribir_paises(poner, aplicar):
    """`poner` = [(did, código, nombre del país)]. Devuelve los que quedaron
    —o, sin `aplicar`, los que quedarían: la prueba en seco cuenta lo mismo
    que la corrida, no lo que quiso escribir—.

    Relee la hoja viva, busca cada fila por su Discord ID y escribe sólo si
    `Bandera` y `País` siguen sin país. Después relee y cuenta lo que quedó.
    """
    import lista_raperos as LR
    v = LR.leer()
    i, col = LR.mapa(v)
    if not all(c in col for c in ('Discord ID', 'Bandera', 'País')):
        print('   🔴 la Lista no tiene Discord ID / Bandera / País: no escribo')
        return []
    celdas, van, ya = plan_hoja(v, i, col, poner, lambda a1: LR._rango(LR.HOJA, a1))
    for did, por in ya:
        print('   ⚠️ %s: no escribo su país (%s)' % (did, por))
    if not aplicar or not celdas:
        return van
    LR._E()._pedir('POST', '/values:batchUpdate',
                   json={'valueInputOption': 'RAW', 'data': celdas})
    v2 = LR.leer()
    quedo = {_celda(f, col['Discord ID']): (_celda(f, col['Bandera']),
                                           _celda(f, col['País']))
             for k, f in enumerate(v2) if k > i}
    bien = [x for x in van if quedo.get(x[0]) == (x[2], x[1])]
    if len(bien) != len(van):
        print('   🔴 escribí %d país(es) y al releer quedaron %d' % (len(van), len(bien)))
    return bien


def dar_miembro(s, did, rol, invitado):
    import verificados as VER
    base = '%s/guilds/%s/members/%s/roles/' % (API, VER.GUILD_DRA, did)
    h = {'X-Audit-Log-Reason': 'Liga Global: autoverificar (ID + país)'}
    r = _pedir(s, 'PUT', base + rol, headers=h)
    ok = r.status_code in (200, 204)
    if ok and invitado:
        _pedir(s, 'DELETE', base + invitado, headers=h)
    return ok


# ── la corrida ─────────────────────────────────────────────────────────
def _saltear():
    """IDs y nombres que no se tocan: no_verificar, olvidados, trolls."""
    import verificados as VER
    out = set()
    ident = _json('datos', 'identidades.json') or {}
    out |= {norm(k) for k in (ident.get('no_verificar') or {})}
    out |= {str(k) for k in (VER._olvidados() or {})}
    try:
        import decidir as DEC
        out |= {norm(x) for x in DEC.no_rankear()}
    except Exception:                                    # noqa: BLE001
        pass
    return out


def correr(aplicar):
    import verificados as VER
    import cruzar_miembros as CM
    ahora = _ahora()
    pad = _json('datos', 'padron.json') or []
    sd = _json('datos', 'servidores_de.json') or {}
    ver = _json('datos', 'verificados.json') or {}
    if not pad or not sd or not ver.get('ids'):
        print('   ⚠️ falta el padrón, servidores_de o verificados: no hago nada')
        return 0
    en_dra = {k for k, v in sd.items() if 'DRA' in (v or [])}
    con_miembro = set(ver['ids'])
    memoria = _json('datos', 'autoverificar.json') or {}
    saltear = _saltear()
    pp, pv = candidatos(pad, en_dra, con_miembro, saltear, memoria, ahora)
    print('   candidatos: %d sin país · %d en DRA sin el Miembro' % (len(pp), len(pv)))

    rol, invitado = CM._roles_dra()
    if rol != VER.ROL_MIEMBRO:
        # ⚠️ el rol que se da es el de `servidores.json`; si no es EL
        # Miembro, algo cambió y verificar sería dar otro rol a la gente
        print('   🔴 servidores.json dice verificar con %r y el Miembro es %s: '
              'no verifico a nadie' % (rol, VER.ROL_MIEMBRO))
        pv = []
    raros = []
    if len(pp) > RARO_PAISES:
        raros.append('%d filas con ID y sin país' % len(pp))
        pp = []
    if len(pv) > RARO_VERIFICAR:
        raros.append('%d en DRA sin el Miembro' % len(pv))
        pv = []
    if raros:
        import alertar
        alertar.alertar('autoverificar', 'Autoverificar no aplicó nada: %s. '
                        'Eso no es el goteo normal; mirá antes de correrlo a mano '
                        '(`python bot/autoverificar.py`).' % ' y '.join(raros))
    if not pp and not pv:
        print('   nada que hacer')
        return 0

    s = _sesion()
    if s is None:
        print('   ⚠️ sin DISCORD_TOKEN: no puedo mirar los roles')
        return 0
    guilds = list(CM.GUILDS)
    mapas = mapas_de_roles(s, guilds)
    if 'DRA' not in mapas:
        print('   🔴 sin la tabla de roles de DRA: no hago nada')
        return 0
    ident = _json('datos', 'identidades.json') or {}
    fij = {norm(k): v for k, v in (ident.get('pais_fijado') or {}).items()}
    iso_de = _iso_de_nombre()
    nombre_de = {}
    for n, c in iso_de.items():
        nombre_de.setdefault(c, n)
    if not iso_de:
        print('   🔴 sin PAIS_ISO no sé cómo escribir el nombre del país: no hago nada')
        return 0

    poner, sin, dudas = [], [], []
    ya = set()
    # 1 · el país. PRIMERO QUIEN YA TIENE EL MIEMBRO DE DRA: el país es lo
    # único que le falta para tener carta (el 25/09 eran 12 de 32), y con el
    # tope de 15 por corrida el orden del padrón los dejaba para después.
    # Después los que se van a verificar, y al final el resto.
    def _urge(p):
        d = str(p['discord_id'])
        return 0 if d in con_miembro else 1 if d in en_dra else 2
    orden = sorted(pv + [p for p in pp if p not in pv], key=_urge)
    for p in orden:
        did = str(p['discord_id'])
        if (p.get('pais') or '').strip() or did in ya:
            continue
        if len(poner) >= TOPE_PAISES:
            break
        ya.add(did)
        try:
            suyos = roles_de_pais(s, guilds, mapas, did)
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ %s: Discord no contestó (%s); sigo' % (p['raw'], str(e)[:40]))
            continue
        cc, por = pais_de(p, suyos, fij.get(norm(p['raw'])), iso_de)
        if not cc:
            (dudas if 'países' in por or 'roles de país' in por else sin).append((p, por))
            continue
        if cc not in nombre_de:
            dudas.append((p, '%s no está en PAIS_ISO' % cc))
            continue
        poner.append((did, cc, nombre_de[cc]))
        print('   🏳️ %-18s %s · %s  (%s)' % (p['raw'][:18], cc, nombre_de[cc], por))
    for p, por in dudas:
        print('   ⚠️ %-18s no lo toco: %s' % (p['raw'][:18], por))

    escritos = escribir_paises(poner, aplicar)
    con_pais = {d for d, _, _, _ in escritos}

    # 2 · el Miembro de DRA
    verificados, sin_pais_v = [], []
    for p in pv[:TOPE_VERIFICAR]:
        did = str(p['discord_id'])
        tiene = bool((p.get('pais') or '').strip()) or did in con_pais
        if not tiene:
            sin_pais_v.append(p['raw'])
            continue
        try:
            rs = miembro(s, VER.GUILD_DRA, did)
        except Exception as e:                           # noqa: BLE001
            print('   ⚠️ %s: DRA no contestó (%s)' % (p['raw'], str(e)[:40]))
            continue
        if rs is None or rol in rs:
            continue                     # se fue de DRA, o ya lo tiene
        if aplicar and not dar_miembro(s, did, rol, invitado):
            print('   🔴 %s: Discord no aceptó el rol' % p['raw'])
            continue
        verificados.append(p['raw'])
        print('   ✅ %s %s en DRA' % (p['raw'], 'verificado' if aplicar else 'se verificaría'))

    # 3 · la memoria de quién no tiene país en ningún lado, y el aviso
    if aplicar:
        m = {k: v for k, v in (memoria.get('sin_pais') or {}).items()
             if k not in con_pais}
        for p, _ in sin + dudas:
            m[str(p['discord_id'])] = ahora.isoformat(timespec='seconds')
        _guardar({'sin_pais': m})
    print('   %s: %d país(es) · %d verificado(s) · %d sin país en ningún lado'
          % ('hecho' if aplicar else 'haría', len(escritos),
             len(verificados), len(sin)))
    if aplicar and (escritos or verificados):
        import alertar
        partes = []
        if escritos:
            partes.append('país puesto a %d: %s' % (
                len(escritos), ', '.join('%s %s' % (r or d, c) for d, c, _, r in escritos)))
        if verificados:
            partes.append('verificado(s) en DRA: %s' % ', '.join(verificados))
        alertar.normal('🤖 Autoverificar · ' + ' · '.join(partes))
    return 0


def _guardar(d):
    with io.open(MEMORIA, 'w', encoding='utf-8', newline='') as f:
        json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write(chr(10))


# ── self-check ─────────────────────────────────────────────────────────
def _self_check():
    print('')
    print('  autoverificar.py — self-check')
    print('')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    iso = {'Argentina': 'ar', 'Chile': 'cl', 'Estados Unidos': 'us',
           'Venezuela': 've', 'Colombia': 'co'}
    ok(cc_bandera('Konan 🇦🇷') == 'ar' and cc_bandera('Kevo ❓') == '',
       'lee la bandera del nombre, y ❓ no es una')
    ok(pais_de({'full': 'X ❓', 'pais': ''}, {'DRA': ['cl']}, None, iso) == ('cl', 'rol de DRA'),
       'sin país: el rol de DRA')
    ok(pais_de({'full': 'X ❓', 'pais': ''}, {'SR': ['co']}, None, iso)[0] == 'co',
       'sin DRA: el rol de Snake Rap')
    ok(pais_de({'full': 'X ❓', 'pais': ''}, {'DRA': ['ve'], 'FFA': ['us']}, None, iso)[0] == 'us',
       'USA gana, venga de donde venga')
    ok(pais_de({'full': 'X ❓', 'pais': ''}, {'SR': ['co'], 'FFA': ['ar']}, None, iso)[0] == '',
       'dos países que no son USA: no se toca')
    ok(pais_de({'full': 'X 🇨🇱', 'pais': ''}, {}, None, iso) == ('cl', 'bandera del nombre'),
       'sin roles: la bandera del nombre')
    ok(pais_de({'full': 'X ❓', 'pais': ''}, {}, None, iso)[0] == '',
       'sin nada: sin país (no se inventa)')
    ok(pais_de({'full': 'X ❓', 'pais': ''}, {'DRA': ['co']}, 'Venezuela', iso)[0] == 've',
       'pais_fijado gana sobre el rol')

    ahora = datetime.datetime(2026, 9, 25, 7, 0, tzinfo=datetime.timezone.utc)
    pad = [{'raw': 'Ana', 'full': 'Ana ❓', 'pais': '', 'discord_id': '1'},
           {'raw': 'Bea', 'full': 'Bea 🇨🇱', 'pais': 'Chile', 'discord_id': '2'},
           {'raw': 'Ceci', 'full': 'Ceci ❓', 'pais': '', 'discord_id': '3'},
           {'raw': 'Dani', 'full': 'Dani', 'pais': '', 'discord_id': ''},
           {'raw': 'Troll', 'full': 'Troll', 'pais': '', 'discord_id': '5'},
           {'raw': 'Eva', 'full': 'Eva ❓', 'pais': '', 'discord_id': '6'}]
    mem = {'sin_pais': {'3': '2026-09-25T01:00:00+00:00',
                        '6': '2026-09-24T01:00:00+00:00'}}
    pp, pv = candidatos(pad, {'1', '2'}, {'1'}, {'troll'}, mem, ahora)
    ok([p['raw'] for p in pp] == ['Ana', 'Eva'],
       'país: con ID y sin país; Ceci se miró hace 6 h, Eva hace 30  %s'
       % [p['raw'] for p in pp])
    ok([p['raw'] for p in pv] == ['Bea'], 'verificar: en DRA y sin el Miembro  %s'
       % [p['raw'] for p in pv])
    ok('Dani' not in [p['raw'] for p in pp + pv], 'sin ID no entra a nada')
    ok('Troll' not in [p['raw'] for p in pp + pv], 'los que se saltean no entran')

    cab = ['Rapero', 'Bandera', 'SV', 'Verificado', 'Discord ID', 'Avatar',
           'Notas', 'Nombre', 'País', 'Crew']
    hoja = [['x'], cab,
            ['Meidei ❓', '❓', '', '', '11', '', '', '', ''],
            ['Bea', 'Chile', '', '', '22', '', '', '', 'cl'],
            ['Doble', '', '', '', '33'], ['Doble2', '', '', '', '33'],
            ['Ceci', '', '', '', '44', '', '', '', '']]
    col = {c: cab.index(c) for c in cab}
    celdas, van, ya = plan_hoja(hoja, 1, col, [('11', 'cl', 'Chile'), ('22', 'ar', 'Argentina'),
                                               ('33', 'co', 'Colombia'), ('44', 've', 'Venezuela')],
                                lambda a1: a1)
    ok([x[0] for x in van] == ['11', '44'],
       'escribe donde dice ❓ o está vacío  %s' % [x[0] for x in van])
    ok({'range': 'B3', 'values': [['Chile']]} in celdas and {'range': 'I3', 'values': [['cl']]} in celdas,
       'las dos columnas: Bandera con el nombre y País con el código')
    ok([d for d, _ in ya] == ['22', '33'],
       'no pisa un país que ya está, ni escribe un ID que está en dos filas  %s' % ya)

    import verificados as VER
    import cruzar_miembros as CM
    ok(CM.GUILDS[0] == ('DRA', VER.GUILD_DRA), 'DRA es el primero: ahí se dan los roles')
    ok(CM._roles_dra()[0] == VER.ROL_MIEMBRO,
       'el rol que se da es el Miembro de DRA, el mismo del portón')
    ok(set(_iso_de_nombre().values()) >= {'ar', 'cl', 'us', 've', 'co'},
       'PAIS_ISO sabe escribir los países')
    print('')
    print('   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return _self_check()
    aplicar = '--aplicar' in sys.argv
    print('')
    print('══ EL PAÍS Y EL MIEMBRO DE DRA, SOLOS ══')
    print('')
    try:
        return correr(aplicar)
    except Exception as e:                               # noqa: BLE001
        # ⚠️ nunca tumba al ciclo: lo peor que pasa es que espera otra vuelta
        print('   ⚠️ autoverificar: %s' % str(e)[:160])
        return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)

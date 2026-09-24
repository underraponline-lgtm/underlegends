# -*- coding: utf-8 -*-
"""BAJAR TODOS LOS MIEMBROS DE DRA Y FFA Y CRUZARLOS CONTRA EL PADRON.

    python herramientas/cruzar_miembros.py             muestra el plan
    python herramientas/cruzar_miembros.py --aplicar   escribe: rol + ID
    python herramientas/cruzar_miembros.py --refrescar vuelve a bajar la lista
    python herramientas/cruzar_miembros.py --aplicar --solo-ids
                                        escribe los ID y NO toca roles de DRA

⚠️ ESTO REEMPLAZA A BUSCAR POR NOMBRE, Y POR ESO ENCUENTRA MUCHO MAS. Con el
Members Intent apagado la unica via era `members/search`, que **esta capada**:
pedirle `query=a&limit=1000` en FFA devolvia 177 cuentas, no 1600. O sea que
solo veia coincidencias sueltas de los nombres que preguntaba. Con el intent
prendido (Dlx, 19/09/2026) `GET /guilds/{id}/members` pagina la lista ENTERA,
y el cruce se puede hacer al reves: para cada persona del padron se mira a
TODOS los miembros, no solo a los que el buscador quiso devolver.

LAS GUARDAS SON LAS MISMAS QUE YA COSTARON SANGRE
-------------------------------------------------
  · EXACTA o nombre+numeros (`saito6947`), nada de parecidos.
  · UNICA: una sola cuenta para ese nombre.
  · SIN COLISION: esa cuenta no matchea tambien a otro del padron.
  · NUNCA un ID que ya es de otro (asi se colo «Lord» con el ID de
    «Lord Viruzz» el 19/09, y por eso existe esta guarda).
  · Respeta `datos/identidades.json`: baneados/joke no se tocan, y los pares
    declarados distintos van a revision si la cuenta matchea a los dos.

⚠️ EN DRA verifica (rol Miembro + saca Invitado) Y escribe el ID.
   En FFA, si no esta en DRA, SOLO escribe el ID: verificarse en DRA es cosa
   del usuario (Dlx, 19/09/2026).
"""
import io
import json
import os
import re
import sys
import time
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

API = 'https://discord.com/api/v10'
def _guilds():
    """Todos los servidores donde el bot puede LEER MIEMBROS, no los de carta.

    🔴 SON DOS PREGUNTAS DISTINTAS. Los servidores de carta son los 9 del
    catalogo; donde el bot esta es otra cosa, y desde el 19/09/2026 incluye
    **LIVONIA RAP**, que Dlx agrego «solo para hacer reconocimiento de
    usuarios, no para cartas». Para sacar IDs sirve igual que DRA o FFA.

    ⚠️ DRA VA PRIMERO Y ESO NO ES ORDEN ALFABETICO: `GUILDS[0]` es el guild
    donde se dan los roles, y mas abajo se usa asi. Si DRA deja de ser el
    primero, la verificacion se aplica en el servidor equivocado.

    ⚠️ Y DE LOS QUE NO SON DRA SOLO SE CAPTURA EL ID. Lo decide
    `(verificar if sv == 'DRA' else capturar)` mas abajo, que ya era la regla
    para FFA y vale igual para Livonia.
    """
    g = [('DRA', '841017460341604382'), ('FFA', '1468472442925092958'),
         # 🔴 SNAKE RAP, DESDE EL 24/09/2026: 7.337 miembros. Dlx: «es una
         # gran oportunidad para obtener IDs». De acá, como de FFA, sólo se
         # CAPTURA el ID —lo decide `sv == 'DRA'` más abajo—: su propia
         # verificación la cuenta `bot/verificados.py`, sin tocar roles.
         ('SR', '492346406976356374')]
    try:
        with io.open(os.path.join(BASE, 'datos', 'servidores.json'),
                     encoding='utf-8') as f:
            extra = (json.load(f).get('solo_identidad') or {})
        g += [(k, v['guild_id']) for k, v in sorted(extra.items())
              if v.get('guild_id')]
    except Exception as e:
        print('  ⚠️ no pude leer los servidores de identidad (%s)' % str(e)[:50])
    return tuple(g)


GUILDS = _guilds()
CACHE = os.path.join(os.environ.get('TEMP', '/tmp'), '_miembros_cache.json')


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def norm(s):
    s = re.sub(r'[\U0001F1E6-\U0001F1FF]', '', str(s)).replace('❓', '')
    s = unicodedata.normalize('NFD', s.strip().lower())
    return ''.join(c for c in s if c.isalnum())


#: los servidores donde un nombre único NO alcanza. Ver `main()`.
GRANDES = {'SR'}
_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')


def cc_bandera(texto):
    """El código de país de la primera bandera del texto, o `''`."""
    m = _BANDERA.search(str(texto or ''))
    return ''.join(chr(ord(c) - 0x1F1E6 + 97) for c in m.group(0)) if m else ''


def paises_por_rol(s, gid):
    """`{rol_id: código}` de los roles de ese servidor que traen bandera."""
    r = s.get('%s/guilds/%s/roles' % (API, gid), timeout=30)
    if r.status_code != 200:
        return {}
    return {x['id']: cc_bandera(x['name']) for x in r.json()
            if cc_bandera(x['name'])}


def cc_padron(p):
    """Los códigos de país que dice el padrón: su columna y la bandera del
    nombre. Pueden ser dos — el de Makmah dice 🇦🇷 y Venezuela —, y
    cualquiera de los dos sirve de señal."""
    out = set()
    if cc_bandera(p.get('full')):
        out.add(cc_bandera(p.get('full')))
    try:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        import subir_datos as _SD
        cc = _SD._cc_de(p.get('pais'))
        if cc:
            out.add(cc)
    except Exception:                                    # noqa: BLE001
        pass
    return out


def formas(m):
    u = m.get('user') or {}
    return [x for x in (m.get('nick'), u.get('global_name'), u.get('username')) if x]


def _roles_dra():
    d = json.load(io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8'))
    dra = (d.get('canales') or {}).get('DRA') or {}
    return dra.get('verificacion_rol') or '', dra.get('rol_invitado') or ''


def bajar_todos(s, gid, nombre):
    """La lista ENTERA, paginada por `after`. Necesita el Members Intent."""
    out, after = [], '0'
    while True:
        for _ in range(5):
            r = s.get('%s/guilds/%s/members' % (API, gid),
                      params={'limit': 1000, 'after': after}, timeout=40)
            if r.status_code == 429:
                time.sleep(float(r.json().get('retry_after', 1)) + .3)
                continue
            break
        if r.status_code != 200:
            sys.exit('no pude listar %s: %s %s' % (nombre, r.status_code, r.text[:120]))
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
        print('   %s: %d...' % (nombre, len(out)))
        time.sleep(0.25)
    return out


def _rol_op(s, metodo, gid, did, rol):
    for _ in range(5):
        r = metodo('%s/guilds/%s/members/%s/roles/%s' % (API, gid, did, rol),
                   headers={'X-Audit-Log-Reason': 'Liga Global: identidad confirmada'},
                   timeout=20)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        return r.status_code in (200, 204)
    return False


def letra(i):
    s, i = '', i + 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def main():
    import requests
    import construir_padron as PAD
    try:
        import construir_akas as AK
        akd = AK.cargar()
    except Exception:
        akd = {}

    aplicar = '--aplicar' in sys.argv
    rol, invitado = _roles_dra()
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    # ── la lista entera de los dos servidores ──────────────────────────────
    if os.path.exists(CACHE) and '--refrescar' not in sys.argv:
        cache = json.load(io.open(CACHE, encoding='utf-8'))
        print('\nusando la lista cacheada — --refrescar para volver a bajarla')
    else:
        print('\nbajando la lista completa de miembros...')
        cache = {sv: bajar_todos(s, gid, sv) for sv, gid in GUILDS}
        json.dump(cache, io.open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
    for sv in cache:
        print('   %s: %d miembros' % (sv, len(cache[sv])))

    # ── el padron, sus alias y las reglas de identidad ─────────────────────
    pad = PAD.cargar()
    idx = {PAD.norm(x['raw']): x for x in pad}
    ids_usados = {p['discord_id'] for p in pad if p.get('discord_id')}

    alt = {}
    for a, r in (akd.get('pares') or []):
        alt.setdefault(PAD.norm(r), set()).add(a)
        alt.setdefault(PAD.norm(a), set()).add(r)

    ident = {}
    try:
        ident = json.load(io.open(os.path.join(BASE, 'datos', 'identidades.json'),
                                  encoding='utf-8'))
    except Exception:
        print('  ⚠️ sin datos/identidades.json: corro sin las reglas de identidad')
    nunca = {PAD.norm(k) for k in (ident.get('no_verificar') or {})}
    pareja = {}
    for a, b in (ident.get('no_fusionar') or []):
        pareja.setdefault(PAD.norm(a), set()).add(PAD.norm(b))
        pareja.setdefault(PAD.norm(b), set()).add(PAD.norm(a))

    faltan = [x['raw'] for x in pad if not (idx.get(PAD.norm(x['raw'])) or {}).get('discord_id')]
    Q_de = {q: {PAD.norm(q)} | {PAD.norm(a) for a in alt.get(PAD.norm(q), set())} for q in faltan}
    todos_norm = {PAD.norm(x['raw']) for x in pad}

    # ── indice: forma normalizada -> cuentas, y prefijos ───────────────────
    cuentas = {}                      # did -> (sv, member)
    por_forma = {}                    # norm(forma) -> set(did)
    for sv, ms in cache.items():
        for m in ms:
            did = (m.get('user') or {}).get('id')
            if not did or did in ids_usados:
                continue
            # DRA gana si esta en los dos (ahi se puede verificar)
            if did not in cuentas or sv == 'DRA':
                cuentas[did] = (sv, m)
            for x in formas(m):
                por_forma.setdefault(norm(x), set()).add(did)

    # 🔴 EN SNAKE RAP UN NOMBRE ÚNICO NO ALCANZA. Las guardas de arriba se
    # pensaron para DRA y FFA, que son de la Liga; Snake Rap son 7.337
    # personas de toda la escena, y ahí un «Ivan», un «Victor» o un «Cesar»
    # únicos pueden ser otra persona. Medido el 24/09/2026 al entrar: de 56
    # IDs que daba, la mayoría eran nombres de pila. Allá se pide una
    # SEGUNDA señal: que el país del padrón coincida con su rol de bandera.
    cc_rol = {}
    for sv_, gid_ in GUILDS:
        if sv_ not in GRANDES:
            continue
        band = paises_por_rol(s, gid_)
        for m_ in cache.get(sv_, []):
            did_ = (m_.get('user') or {}).get('id')
            ccs = {band[x] for x in (m_.get('roles') or []) if x in band}
            if did_ and ccs:
                cc_rol[did_] = ccs
    alias_de = {k: v for k, v in (akd.get('alias') or {}).items()}

    # nick/usuario por cuenta, para el tier nombre+numeros
    nick_user = {did: [x for x in ((m.get('nick')),
                                   ((m.get('user') or {}).get('username'))) if x]
                 for did, (sv, m) in cuentas.items()}

    # ── matchear ───────────────────────────────────────────────────────────
    exacto_de, prefijo_de = {}, {}
    for q in faltan:
        for t in Q_de[q]:
            for did in por_forma.get(t, ()):
                exacto_de.setdefault(did, set()).add(q)
        nq = PAD.norm(q)
        if len(nq) >= 4:
            for did, (sv_, m_) in cuentas.items():
                u_ = m_.get('user') or {}
                nick_, glob_ = m_.get('nick'), u_.get('global_name')
                # ⚠️ EL SUFIJO NUMERICO PUEDE ESTAR EN EL USUARIO, PERO EL
                # NOMBRE TIENE QUE ASOMAR EN EL APODO O EL GLOBAL. Si esos dos
                # dicen otra persona, no es: «Ivan» matcheaba a `iv_an1.`
                # («ivan»+«1») cuyo apodo Y global son «ZiarKI».
                visibles = [x for x in (nick_, glob_) if x]
                if visibles and not any(norm(x).startswith(nq) for x in visibles):
                    continue
                for x in [y for y in (nick_, u_.get('username')) if y]:
                    nx = norm(x)
                    if nx.startswith(nq) and nx != nq and re.fullmatch(r'[0-9._-]*', nx[len(nq):]):
                        prefijo_de.setdefault(did, set()).add(q)
                        break

    verificar, capturar, revisar = [], [], []
    for q in faltan:
        if PAD.norm(q) in nunca:
            revisar.append((q, 'NO VERIFICAR: %s'
                            % (ident.get('no_verificar') or {}).get(q, 'regla de identidad')))
            continue
        ex = [d for d, ns in exacto_de.items() if q in ns]
        pf = [d for d, ns in prefijo_de.items() if q in ns]
        if len(ex) == 1 and len(exacto_de[ex[0]]) == 1:
            did, tipo = ex[0], 'exacto'
        elif not ex and len(pf) == 1 and len(prefijo_de[pf[0]]) == 1 and pf[0] not in exacto_de:
            did, tipo = pf[0], 'nombre+numeros'
        else:
            if len(ex) > 1:
                revisar.append((q, 'ambiguo: %d cuentas exactas' % len(ex)))
            elif ex and len(exacto_de[ex[0]]) > 1:
                revisar.append((q, 'esa cuenta tambien es %s'
                                % ', '.join(sorted(exacto_de[ex[0]] - {q}))))
            elif len(pf) > 1:
                revisar.append((q, 'ambiguo: %d por nombre+sufijo' % len(pf)))
            continue
        sv, m = cuentas[did]
        et_ = m.get('nick') or ((m.get('user') or {}).get('username'))
        # ⚠️ UNA FILA QUE ES ALIAS DE OTRA NO LLEVA ID PROPIO: la persona es
        # la otra fila. «Erician» se llevaba una cuenta distinta de la de
        # «Erian», que los AKAs dicen que es la misma persona.
        real = alias_de.get(PAD.norm(q)) or alias_de.get(q.lower())
        if real and PAD.norm(real) != PAD.norm(q) and PAD.norm(real) in idx:
            revisar.append((q, 'es alias de %s según AKAs: su ID va en esa '
                               'fila' % real))
            continue
        if sv in GRANDES:
            ccp = cc_padron(idx.get(PAD.norm(q)) or {})
            cca = cc_rol.get(did, set())
            if not ccp or not cca:
                revisar.append((q, '%s: @%s se llama igual, sin país para '
                                   'confirmarlo' % (sv, et_)))
                continue
            if not ccp & cca:
                revisar.append((q, '%s: @%s se llama igual pero es %s, y el '
                                   'padrón dice %s'
                                % (sv, et_, '/'.join(sorted(cca)),
                                   '/'.join(sorted(ccp)))))
                continue
        choca = [p for p in pareja.get(PAD.norm(q), ())
                 if any(PAD.norm(x) == p for x in formas(m))]
        if choca:
            revisar.append((q, 'la cuenta tambien se llama como %s — el doc dice '
                               'que son distintos' % ', '.join(sorted(choca))))
            continue
        et = m.get('nick') or ((m.get('user') or {}).get('username'))
        fila = (q, did, '%s · %s' % (et, tipo), sv)
        (verificar if sv == 'DRA' else capturar).append(fila)

    print('\n  ✅ VERIFICAR en DRA (rol + ID): %d' % len(verificar))
    for f in verificar[:60]:
        print('       %-18s %-20s %-30s' % f[:3])
    if len(verificar) > 60:
        print('       … y %d mas' % (len(verificar) - 60))
    # ⚠️ YA NO ES «SOLO FFA». Desde el 19/09/2026 el bot esta tambien en
    # LIVONIA, que Dlx agrego solo para reconocer usuarios. El rotulo viejo
    # habria hecho creer que un ID de Livonia salio de FFA — y de donde salio
    # es justo lo que decide si se verifica o no.
    from collections import Counter as _C
    _de = _C(f[3] for f in capturar)
    print('  🆔 CAPTURAR ID (fuera de DRA, no se verifica): %d   %s'
          % (len(capturar), ' · '.join('%s %d' % x for x in sorted(_de.items()))))
    for f in capturar[:40]:
        print('       %-18s %-20s %-30s %s' % (f[0], f[1], f[2], f[3]))
    if len(capturar) > 40:
        print('       … y %d mas' % (len(capturar) - 40))
    print('  🔎 PARA QUE MIRES: %d' % len(revisar))
    if '--detalle' in sys.argv:
        for q, por in revisar:
            print('       %-18s %s' % (q, por))
    print('  — sin ninguna coincidencia: %d'
          % (len(faltan) - len(verificar) - len(capturar) - len(revisar)))

    if not aplicar:
        print('\n  (nada escrito — corré con --aplicar)\n')
        return

    import gspread
    from google.oauth2.service_account import Credentials
    gc = gspread.authorize(Credentials.from_service_account_file(
        os.path.join(BASE, 'creds.json'),
        scopes=['https://www.googleapis.com/auth/spreadsheets']))
    ws = gc.open_by_key(PAD.OPERATIVO).worksheet(PAD.HOJA)
    val = ws.get_all_values()
    cab = PAD._cabecera(val)
    H = [x.strip() for x in val[cab]]
    iR, iID = H.index('Rapero'), H.index('Discord ID')
    fila_de = {}
    for f in range(cab + 1, len(val)):
        raw = (val[f][iR] if len(val[f]) > iR else '').strip()
        if raw:
            fila_de[PAD.norm(raw)] = f + 1

    resp = os.path.join(BASE, 'docs', 'respaldo_ids_%s.json' % time.strftime('%Y%m%d_%H%M'))
    json.dump({'cuando': time.strftime('%Y-%m-%d %H:%M'),
               'ids': [(val[f][iR], val[f][iID] if len(val[f]) > iID else '')
                       for f in range(cab + 1, len(val))
                       if len(val[f]) > iR and val[f][iR].strip()]},
              io.open(resp, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('\n  respaldo -> %s' % os.path.relpath(resp, BASE))

    celdas = []
    for q, did, et, sv in (verificar + capturar):
        f = fila_de.get(PAD.norm(q))
        if f:
            celdas.append({'range': '%s%d' % (letra(iID), f), 'values': [[str(did)]]})
    if celdas:
        ws.batch_update(celdas, value_input_option='RAW')
    print('  🆔 %d ID escritos (un batch, RAW para no perder digitos)' % len(celdas))

    # ⚠️ `--solo-ids`: EL ROL DE DRA ES UNA ACCIÓN SOBRE PERSONAS EN OTRO
    # SERVIDOR, y no siempre es lo que se pidió. El 24/09/2026 se pidió
    # sacar IDs de Snake Rap; dar el rol Miembro en DRA a quien matchee es
    # otra decisión, y quedaba pegada a esta.
    if '--solo-ids' in sys.argv:
        print('  --solo-ids: no toco roles de DRA (%d quedan sin el rol)'
              % len(verificar))
        print('\n  después:  python sheet/construir_padron.py\n')
        return
    ok = 0
    for q, did, et, sv in verificar:
        a = _rol_op(s, s.put, GUILDS[0][1], did, rol)
        if invitado:
            _rol_op(s, s.delete, GUILDS[0][1], did, invitado)
        if a:
            ok += 1
            if ok % 25 == 0:
                print('   verificados %d de %d...' % (ok, len(verificar)))
        time.sleep(0.4)
    print('  ✅ verificados en DRA: %d de %d' % (ok, len(verificar)))
    print('  🆔 capturados fuera de DRA (ID, sin verificar): %d' % len(capturar))
    print('\n  después:  python sheet/construir_padron.py\n')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

# -*- coding: utf-8 -*-
"""DESCUBRIR EL ID DE LA GENTE DE LA LIGA Y —SI ESTA EN DRA— VERIFICARLA.

    python herramientas/verificar_liga.py            busca y muestra el plan
    python herramientas/verificar_liga.py --aplicar  escribe: rol + ID

Dlx, 19/09/2026: a la gente que esta en DRA, es de la Liga, no esta verificada
y no tenemos su ID -> descubrirla y verificarla. A la que esta solo en FFA ->
sacarle el ID pero NO verificarla (tiene que pasar por la verificacion de DRA).

COMO, Y POR QUE ES SEGURO
-------------------------
Se busca cada nombre de la Liga (los que no tienen ID) con
`GET /guilds/{id}/members/search` —anda sin intent privilegiado— en DRA y FFA.

⚠️ SOLO ACTUA SOBRE UNA COINCIDENCIA **EXACTA, UNICA Y SIN COLISION**:
  · EXACTA  = alguna forma de la cuenta (apodo/usuario/global) normaliza IGUAL
              al nombre de la Liga. Un parecido no alcanza.
  · UNICA   = una sola cuenta cumple eso para ese nombre. Si hay dos (paso con
              «Eze»: una `🐉 | Zekki` y otra `👤 | Eze`), es ambiguo -> se deja.
  · SIN COLISION = esa cuenta no matchea TAMBIEN otro nombre de la Liga. Paso
              con `sombrax1725`, que salia por «Sombra» y por «VR» -> se deja.

Todo lo que no pasa ese triple filtro va a un informe para que Dlx decida. Es
la leccion de toda esta etapa: poner el ID/rol equivocado es peor que no
ponerlo — el bot le muestra a alguien la carta de otro.

⚠️ EN DRA verifica (da el rol Miembro) Y escribe el ID. En FFA (si no esta en
DRA) SOLO escribe el ID: verificarse en DRA es cosa del usuario.

⚠️ GATEADO Y CON RESPALDO, como los otros escritores del Sheet. Dry-run por
defecto; cachea la busqueda en el scratchpad para que --aplicar no la repita.
Freno entre llamadas por los rate limits.
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
DRA = '841017460341604382'
CACHE = os.path.join(os.environ.get('TEMP', '/tmp'), '_verificar_liga_cache.json')


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def norm(s):
    s = re.sub(r'[\U0001F1E6-\U0001F1FF]', '', str(s)).replace('❓', '')
    s = unicodedata.normalize('NFD', s.strip().lower())
    return ''.join(c for c in s if c.isalnum())


def formas(m):
    """Los nombres de una cuenta: apodo, global y usuario."""
    u = m.get('user') or {}
    return [x for x in (m.get('nick'), u.get('global_name'), u.get('username')) if x]


def _roles_dra():
    """(rol Miembro, rol Invitado). El primero se da, el segundo se saca."""
    p = os.path.join(BASE, 'datos', 'servidores.json')
    d = json.load(io.open(p, encoding='utf-8'))
    dra = (d.get('canales') or {}).get('DRA') or {}
    return dra.get('verificacion_rol') or '', dra.get('rol_invitado') or ''


def buscar(s, gid, q):
    for _ in range(5):
        r = s.get('%s/guilds/%s/members/search' % (API, gid),
                  params={'query': q, 'limit': 10}, timeout=25)
        if r.status_code == 429:
            time.sleep(float(r.json().get('retry_after', 1)) + .3)
            continue
        return r.json() if r.status_code == 200 else []
    return []


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


def dar_rol(s, gid, did, rol):
    return _rol_op(s, s.put, gid, did, rol)


def quitar_rol(s, gid, did, rol):
    # 404 = ya no lo tenia; cuenta como exito (el objetivo es que no lo tenga).
    return _rol_op(s, s.delete, gid, did, rol)


def letra(i):
    s, i = '', i + 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def descubrir(s, objetivos):
    """objetivos: [(primario, [terminos])]. Busca cada termino en DRA y FFA y
    guarda los resultados bajo el nombre primario, sin repetir cuenta."""
    hall = {}
    tot = len(objetivos)
    for n, (prim, terminos) in enumerate(objetivos):
        vistos, res = set(), []
        for q in terminos:
            for sv, gid in (('DRA', DRA), ('FFA', '1468472442925092958')):
                for m in (buscar(s, gid, q) or []):
                    did = (m.get('user') or {}).get('id')
                    if did and (sv, did) not in vistos:
                        vistos.add((sv, did))
                        res.append((sv, m))
                time.sleep(0.35)
        hall[prim] = res
        if (n + 1) % 25 == 0:
            print('   buscadas %d de %d...' % (n + 1, tot))
    return hall


def _match(nq, forma):
    """'exacto' | 'numprefijo' | None — como la forma matchea al nombre.

    numprefijo = nombre + sufijo SOLO de digitos/puntuacion (el clasico handle
    `saito6947`). Pide nombre de 4+ para que uno corto no matchee de mas.
    """
    nf = norm(forma)
    if not nq or not nf:
        return None
    if nf == nq:
        return 'exacto'
    if len(nq) >= 4 and nf.startswith(nq) and re.fullmatch(r'[0-9._-]*', nf[len(nq):]):
        return 'numprefijo'
    return None


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

    pad = PAD.cargar()
    idx = {PAD.norm(x['raw']): x for x in pad}

    # ⚠️ SE BUSCA TAMBIEN POR ALIAS. Mucha gente usa en Discord un nombre
    # distinto al de la Liga; la hoja AKAs tiene esos alternativos.
    alt = {}
    for a, r in (akd.get('pares') or []):
        alt.setdefault(PAD.norm(r), set()).add(a)
        alt.setdefault(PAD.norm(a), set()).add(r)

    objetivos = []
    for x in pad:
        if (idx.get(PAD.norm(x['raw'])) or {}).get('discord_id'):
            continue
        objetivos.append((x['raw'], [x['raw']] + sorted(alt.get(PAD.norm(x['raw']), set()))))

    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    # ── busqueda (cacheada) ────────────────────────────────────────────────
    # Usa el cache si existe; --refrescar fuerza volver a buscar en Discord.
    if os.path.exists(CACHE) and '--refrescar' not in sys.argv:
        hall = json.load(io.open(CACHE, encoding='utf-8'))
        print('\nusando la busqueda cacheada (%d nombres) — --refrescar para rebuscar' % len(hall))
    else:
        print('\nbuscando %d nombre(s) sin ID (con alias) en DRA y FFA...\n' % len(objetivos))
        hall = descubrir(s, objetivos)
        json.dump(hall, io.open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)

    # formas a comparar por persona: su nombre + sus alias, normalizados
    formas_de = {x['raw']: {PAD.norm(x['raw'])}
                 | {PAD.norm(a) for a in alt.get(PAD.norm(x['raw']), set())} for x in pad}

    # ⚠️ IDS YA ASIGNADOS: nunca se le da a alguien un ID que ya es de otro.
    # Sin esto, «Polenta» agarraba la cuenta que en la tanda anterior quedo como
    # «Mate» (un mismo Discord con nick Mate y usuario polenta902). Cross-run.
    ids_usados = {p['discord_id'] for p in pad if p.get('discord_id')}

    # ⚠️ LAS REGLAS DE IDENTIDAD, QUE NO SON DEDUCIBLES DE LOS DATOS. Salen de
    # `Identidades_Ranking_v2.md` via datos/identidades.json. Sin esto el
    # 19/09/2026 se le escribio a «Lord» el ID de «Lord Viruzz» —esa cuenta
    # tiene global_name «Lord»— y el MD ya decia que son personas distintas.
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

    # ── quien matchea a quien, por tier (para detectar colisiones) ─────────
    exacto_de, prefijo_de, detalle = {}, {}, {}
    for q, res in hall.items():
        Q = formas_de.get(q, {norm(q)})
        nprim = norm(q)
        for sv, m in res:
            did = (m.get('user') or {}).get('id')
            if not did or did in ids_usados:      # sin id, o ya es de alguien
                continue
            u = m.get('user') or {}
            # ⚠️ EL numprefijo (nombre+numeros) SOLO cuenta contra el APODO o el
            # USUARIO, y SOLO con el nombre primario —no via un alias estirado—.
            # Asi mueren los falsos «Lucky->deepshadow», «Estwn->Molt»: matcheaban
            # por un alias contra un handle que no tiene nada que ver.
            if any(norm(x) == nq for nq in Q for x in formas(m)):
                exacto_de.setdefault(did, set()).add(q)
                detalle[(q, did)] = (sv, m)
            elif any(_match(nprim, x) == 'numprefijo'
                     for x in (m.get('nick'), u.get('username')) if x):
                prefijo_de.setdefault(did, set()).add(q)
                detalle.setdefault((q, did), (sv, m))

    # ── clasificar cada nombre ─────────────────────────────────────────────
    verificar, capturar, revisar = [], [], []   # DRA / FFA-only / dudoso
    for q, terms in objetivos:
        # 🔴 baneados y joke names: no se tocan nunca
        if PAD.norm(q) in nunca:
            revisar.append((q, 'NO VERIFICAR: %s'
                            % (ident.get('no_verificar') or {}).get(q, 'regla de identidad')))
            continue
        ex = [d for d, ns in exacto_de.items() if q in ns]
        pf = [d for d, ns in prefijo_de.items() if q in ns]
        did, tipo = None, None
        if len(ex) == 1 and len(exacto_de[ex[0]]) == 1:
            did, tipo = ex[0], 'exacto'
        elif (not ex and len(pf) == 1 and len(prefijo_de[pf[0]]) == 1
              and pf[0] not in exacto_de):
            # nombre+numeros, unico, y esa cuenta no es el match exacto de otro
            did, tipo = pf[0], 'nombre+numeros'
        else:
            if ex:
                revisar.append((q, 'ambiguo: %d cuentas exactas' % len(ex)))
            elif len(pf) > 1:
                revisar.append((q, 'ambiguo: %d por nombre+sufijo' % len(pf)))
            continue
        sv, m = detalle[(q, did)]
        # 🔴 PARES QUE NO SE FUSIONAN. Si la cuenta tambien se llama como la
        # pareja declarada distinta, no es de ninguno de los dos: a revision.
        # Es el caso «Lord» / «Lord Viruzz», que ya costo un ID mal escrito.
        choca = [p for p in pareja.get(PAD.norm(q), ())
                 if any(PAD.norm(x) == p for x in formas(m))]
        if choca:
            revisar.append((q, 'la cuenta tambien se llama como %s, y el doc dice '
                               'que son distintos' % ', '.join(sorted(choca))))
            continue
        svs = sorted({sv2 for (nn, dd), (sv2, mm) in detalle.items() if dd == did})
        et = '%s · %s' % ((m.get('nick') or ((m.get('user') or {}).get('username'))), tipo)
        fila = (q, did, et, '+'.join(svs))
        (verificar if 'DRA' in svs else capturar).append(fila)

    print('\n  ✅ VERIFICAR en DRA (ID + rol), match unico y sin colision: %d' % len(verificar))
    for q, did, et, svs in verificar[:50]:
        print('       %-16s %-20s %-16s [%s]' % (q, did, et, svs))
    print('  🆔 CAPTURAR ID (solo FFA — se verifican solos en DRA): %d' % len(capturar))
    for q, did, et, svs in capturar[:50]:
        print('       %-16s %-20s %-16s [%s]' % (q, did, et, svs))
    print('  🔎 PARA QUE MIRES (ambiguo o colision): %d' % len(revisar))
    for q, motivo in revisar[:40]:
        print('       %-16s %s' % (q, motivo))

    if not aplicar:
        print('\n  (nada escrito — corré con --aplicar)\n')
        return

    # ── escribir: rol en DRA + ID en el Sheet ──────────────────────────────
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
                       for f in range(cab + 1, len(val)) if len(val[f]) > iR and val[f][iR].strip()]},
              io.open(resp, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('\n  respaldo -> %s' % os.path.relpath(resp, BASE))

    # ── los IDs, en UN SOLO batch (119 celdas de a una revienta la cuota) ──
    celdas = []
    for q, did, et, svs in (verificar + capturar):   # las dos son 4-tuplas
        f = fila_de.get(PAD.norm(q))
        if f:
            celdas.append({'range': '%s%d' % (letra(iID), f), 'values': [[str(did)]]})
    if celdas:
        ws.batch_update(celdas, value_input_option='RAW')   # RAW: no pierde digitos
    print('  🆔 %d ID escritos en el Sheet (un batch)' % len(celdas))

    # ── el rol en DRA: dar Miembro + sacar Invitado, con freno ─────────────
    ver_ok = 0
    for q, did, et, svs in verificar:
        r1 = dar_rol(s, DRA, did, rol)
        r2 = quitar_rol(s, DRA, did, invitado) if invitado else True
        if r1 and r2:
            ver_ok += 1
        if ver_ok and ver_ok % 20 == 0:
            print('   verificados %d de %d...' % (ver_ok, len(verificar)))
        time.sleep(0.4)

    print('  ✅ verificados en DRA (Miembro + fuera Invitado): %d de %d' % (ver_ok, len(verificar)))
    print('  🆔 capturados solo en FFA (sin rol): %d' % len(capturar))
    print('  🔎 sin tocar (para Dlx): %d' % len(revisar))
    print('\n  después:  python sheet/construir_padron.py\n')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

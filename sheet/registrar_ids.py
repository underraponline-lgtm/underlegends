# -*- coding: utf-8 -*-
"""VOLCAR AL OPERATIVO LOS IDS QUE EL BOT ANOTO.

    python sheet/registrar_ids.py             muestra que haria (no toca nada)
    python sheet/registrar_ids.py --aplicar   escribe

Cuando alguien corre /card y el bot no lo tiene, el Worker le deja el Discord
ID en la cola `reg:<id>` de KV (ver `anotar()` en bot/worker.js). Este script
la vacia hacia el Sheet Operativo. Es el segundo escritor del Sheet, junto con
`arreglar_operativo.py`, y por eso pide lo mismo: `--aplicar`, y guarda
respaldo antes de tocar.

⚠️ POR QUE NO LO HACE EL WORKER. Escribir el Sheet pide la clave de la cuenta
de servicio, que es privada; meterla en el Worker pondria una llave con acceso
al Sheet en el borde y tira abajo el «cero secretos» del bot. El Worker escribe
en su propio KV y este script —local, con creds— lo pasa al Sheet.

QUE HACE CON CADA ANOTADO
-------------------------
1. **Calza exacto y unico con alguien SIN id** -> le rellena el Discord ID en
   «Lista de Raperos». Es el unico caso que se escribe solo.
2. **Calza con alguien que YA tiene id**:
   - el mismo id  -> ya estaba; se saca de la cola y listo.
   - otro id      -> CONFLICTO; va a «Pendientes», no se pisa.
3. **Ese id ya esta en otra fila** -> CONFLICTO; a «Pendientes».
4. **No calza, o calza con varios** -> a «Pendientes» para que Dlx resuelva.

⚠️ NUNCA ESCRIBE UN ID ENCIMA DE OTRO NI ADIVINA UN MATCH AMBIGUO. Es la
leccion de toda esta etapa: el nombre de Discord coincide con el de OTRO
competidor mas seguido de lo que parece (9 sospechas, 6 falsas). Lo dudoso va a
Pendientes, con un humano decidiendo.

⚠️ EL ID SE ESCRIBE COMO TEXTO (raw=True). Un snowflake tiene 19 digitos y una
celda de numero lo redondea a 16 —el bug de `aze gian`—. RAW lo guarda tal cual
sin que Sheets lo interprete.
"""
import io
import json
import os
import sys
import time

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
KV = 'a87399a3a0b647b0803aa90509ccce56'
KV_API = ('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s'
          % (CUENTA, KV))
PENDIENTES = 'Pendientes'
SEP = None  # se compila abajo


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def letra(i):
    """Indice de columna (0-based) a letra de columna A1."""
    s = ''
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def cola_kv(s):
    """Lee todas las claves `reg:` de KV con su valor. No borra."""
    claves, cursor = [], None
    while True:
        pars = {'limit': 1000, 'prefix': 'reg:'}
        if cursor:
            pars['cursor'] = cursor
        j = s.get(KV_API + '/keys', params=pars).json()
        if not j.get('success'):
            sys.exit('no pude listar KV: %s' % j.get('errors'))
        claves += [k['name'] for k in j.get('result') or []]
        cursor = (j.get('result_info') or {}).get('cursor')
        if not cursor:
            break
    out = []
    for k in claves:
        r = s.get('%s/values/%s' % (KV_API, k), timeout=30)
        if r.status_code == 200:
            try:
                # 🔴 `r.content` EN UTF-8, NUNCA `r.text`. KV contesta sin
                # `charset` y requests ADIVINA: con un nombre corto y un
                # emoji adivinó Windows-1250 y «King🇦🇷» llegó a
                # `Pendientes` como «Kingđź‡¦đź‡·» (24/09/2026). El
                # «!馃挆Valen…» de antes era lo mismo, adivinado como GBK.
                out.append((k, json.loads(r.content.decode('utf-8'))))
            except Exception:
                pass
    return out


def borrar_kv(s, clave):
    """Saca un anotado de la cola. `True` si KV dijo que sí.

    ⚠️ SE MIRA LA RESPUESTA: un DELETE que falla deja el `reg:` en la cola,
    y la corrida siguiente lo volvía a anotar en Pendientes (auditoría del
    25/09/2026).
    """
    try:
        r = s.delete('%s/values/%s' % (KV_API, clave), timeout=30)
        return r.status_code in (200, 204, 404)
    except Exception:                                    # noqa: BLE001
        return False


def candidatos(reg, norm):
    """Las formas normalizadas con las que intentar el match, de mejor a peor.

    El apodo del servidor es el que mas sirve —lo pone el staff— pero suele
    venir decorado («🐉 | Lil Drako», «#5 | Gus»), asi que se parte por los
    separadores que la gente usa, ademas del apodo entero. El username y el
    global_name van al final.
    """
    import re
    piezas = []
    for txt in (reg.get('nick'), reg.get('glob'), reg.get('user')):
        if not txt:
            continue
        piezas.append(norm(txt))
        for t in re.split(r'[|/·,#-]+', txt):
            n = norm(t)
            if n:
                piezas.append(n)
    # sin repetir, conservando el orden
    visto, out = set(), []
    for p in piezas:
        if p and p not in visto:
            visto.add(p)
            out.append(p)
    return out


def AV_GUILDS():
    """Los servidores donde el bot lee miembros: la lista de
    `herramientas/cruzar_miembros.py`, no una copia."""
    sys.path.insert(0, os.path.join(BASE, 'herramientas'))
    import cruzar_miembros as CM
    return list(CM.GUILDS)


#: cuántos entran solos por corrida; el resto espera en la cola a la siguiente
TOPE_ALTAS = 5


def nombre_de(reg):
    """El nombre con el que alguien se anotó: el apodo del servidor sin la
    decoración (`#5 | Gus` -> `Gus`, `🐉 | Lil Drako` -> `Lil Drako`) y sin
    banderas; si no sirve, el nombre global; al final, el usuario."""
    import unicodedata
    for txt in (reg.get('nick'), reg.get('glob'), reg.get('user')):
        # 🔴 LA LETRA DECORADA, COMO LETRA: `𝐋𝐢𝐥 𝐃𝐫𝐚𝐤𝐨` es «Lil Drako», que es
        # como se busca y como tiene que quedar en la Lista (auditoría del
        # 25/09/2026)
        t = unicodedata.normalize('NFKC', str(txt or ''))
        t = ''.join(c for c in t if not 0x1F1E6 <= ord(c) <= 0x1F1FF)
        t = t.replace('❓', '')
        piezas = [x.strip() for x in t.split('|') if x.strip()]
        t = piezas[-1] if piezas else ''
        if 2 <= len(t) <= 32 and any(c.isalpha() for c in t):
            return t
    return ''


def apodo_con_dos_nombres(reg):
    """¿El apodo trae dos piezas con letras? «Juan | Crew X»: no se sabe
    cuál es el nombre. «#5 | Gus» o «🐉 | Lil Drako», sí: la otra pieza no
    tiene letras."""
    piezas = [x for x in str(reg.get('nick') or '').split('|')
              if any(c.isalpha() for c in x)]
    return len(piezas) >= 2


def alta_sola(reg, nombres, alias, saltear, norm, pais):
    """(nombre, código, '') si entra solo; ('', '', motivo) si no.

    🔑 #11 DE DLX (25/09/2026): *«quien usa /card y no está en la Lista, se
    agrega con su ID y país»*. Sólo quien se anotó a sí mismo (`por: yo`,
    que pone el Worker): buscar a otro no es pedir entrar.

    ⚠️ LO DUDOSO SIGUE YENDO A PENDIENTES, como siempre: sin país, un
    nombre que se parece al de alguien que ya está —puede ser esa persona
    con otra cuenta—, un alias, o alguien que pidió salir. `pais` es una
    función `(reg) -> código`, para poder probar esto sin red.
    """
    import difflib
    did = str(reg.get('id') or '')
    if did in saltear:
        return '', '', 'pidió salir o no se verifica'
    nombre = nombre_de(reg)
    if not nombre:
        return '', '', 'sin un nombre que sirva'
    if apodo_con_dos_nombres(reg):
        return '', '', 'el apodo trae dos nombres: ¿cuál es?'
    # ⚠️ Una letra que no es latina ni después de normalizar —«ᏵᏫᎠᏃ»— la
    # mira un humano: no se sabe cómo la escribe la llave.
    if any(ord(c) > 0xFF for c in nombre):
        return '', '', 'el nombre tiene letras que no son latinas'
    k = norm(nombre)
    if k in saltear:
        return '', '', 'troll o no se verifica'
    if k in alias:
        return '', '', 'es alias de %s' % alias[k]
    cerca = difflib.get_close_matches(k, list(nombres), n=1, cutoff=0.8)
    if cerca:
        return '', '', '¿es %s?' % nombres[cerca[0]]
    cc = pais(reg)
    if not cc:
        return '', '', 'sin país (ni bandera en el apodo ni rol de país)'
    return nombre, cc, ''


def _self_check():
    print('')
    print('  registrar_ids.py — las altas solas (#11), sin red')
    print('')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    ok(nombre_de({'nick': '#5 | Gus 🇦🇷'}) == 'Gus', 'el apodo sin «#5 |» ni bandera')
    ok(nombre_de({'nick': '🐉 | Lil Drako'}) == 'Lil Drako', 'sin el dragón')
    ok(nombre_de({'nick': '', 'glob': 'Drako', 'user': 'lildrako'}) == 'Drako',
       'sin apodo, el nombre global')
    ok(nombre_de({'nick': '🇨🇱', 'glob': '', 'user': 'x_y'}) == 'x_y',
       'un apodo que es sólo una bandera no sirve: el usuario')
    ok(nombre_de({'nick': '𝐋𝐢𝐥 𝐃𝐫𝐚𝐤𝐨 🇪🇨'}) == 'Lil Drako',
       'la letra decorada, como letra  (%r)' % nombre_de({'nick': '𝐋𝐢𝐥 𝐃𝐫𝐚𝐤𝐨 🇪🇨'}))
    norm = lambda x: ''.join(c for c in str(x).lower() if c.isalnum())
    nombres = {'konan': 'Konan', 'masino': 'Masino'}
    alias = {'carr': 'Provenza'}
    con = lambda reg: 'cl'
    sin = lambda reg: ''
    ok(alta_sola({'id': '1', 'nick': 'Nuevo 🇨🇱'}, nombres, alias, set(), norm, con)
       == ('Nuevo', 'cl', ''), 'alguien nuevo, con país: entra')
    ok(alta_sola({'id': '1', 'nick': 'Nuevo'}, nombres, alias, set(), norm, sin)[2]
       .startswith('sin país'), 'sin país: a Pendientes')
    ok('¿es Konan?' in alta_sola({'id': '1', 'nick': 'Konann'}, nombres, alias,
                                 set(), norm, con)[2],
       'un nombre que se parece al de alguien que ya está: a Pendientes')
    ok(alta_sola({'id': '1', 'nick': 'Carr'}, nombres, alias, set(), norm, con)[2]
       == 'es alias de Provenza', 'un alias: a Pendientes')
    ok(alta_sola({'id': '9', 'nick': 'Nuevo'}, nombres, alias, {'9'}, norm, con)[2]
       .startswith('pidió salir'), 'quien pidió salir no entra')
    ok(alta_sola({'id': '1', 'nick': 'money maker'}, nombres, alias, {'moneymaker'},
                 norm, con)[2].startswith('troll'), 'un troll no entra')
    ok(alta_sola({'id': '1', 'nick': 'Juan | Crew X'}, nombres, alias, set(), norm, con)[2]
       .startswith('el apodo trae dos'), '«Juan | Crew X»: no se sabe cuál es el nombre')
    ok(alta_sola({'id': '1', 'nick': '#5 | Gus'}, nombres, alias, set(), norm, con)[0] == 'Gus',
       '«#5 | Gus» sí: el #5 no es un nombre')
    ok(alta_sola({'id': '1', 'nick': 'ᏵᏫᎠᏃ'}, nombres, alias, set(), norm, con)[2]
       .startswith('el nombre tiene letras'), 'letras que no son latinas: a Pendientes')
    print('')
    print('   %s' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    import gspread
    from google.oauth2.service_account import Credentials
    import construir_padron as PAD
    try:
        import construir_akas as AK
        akas = AK.cargar()
    except Exception:
        akas = {}

    aplicar = '--aplicar' in sys.argv

    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')
    anotados = cola_kv(s)
    print('\n%d ID en la cola del bot (`reg:`)' % len(anotados))
    if not anotados:
        print('  nada que volcar\n')
        return

    cred = os.path.join(BASE, 'creds.json')
    if not os.path.exists(cred):
        sys.exit('falta creds.json en la raiz del proyecto')
    scope = (['https://www.googleapis.com/auth/spreadsheets'] if aplicar
             else ['https://www.googleapis.com/auth/spreadsheets.readonly'])
    gc = gspread.authorize(Credentials.from_service_account_file(cred, scopes=scope))
    # 🔴 ESTE PASO CORRE EN EL CICLO (el 1a) Y NO AGUANTABA UN 429: abrir la
    # planilla, abrir la hoja y leerla eran tres pedidos sin reintento. Es el
    # mismo agujero que tumbó el ciclo de las 6:52 AM ET del 24/09/2026 desde
    # `construir_pool_competitivo.py` — la cuota es por minuto y esperar
    # sirve. Ver `sheet/reintentar.py`.
    from reintentar import leer as _leer_reint
    ws = _leer_reint(lambda: gc.open_by_key(PAD.OPERATIVO).worksheet(PAD.HOJA))
    val = _leer_reint(ws.get_all_values)
    cab = PAD._cabecera(val)
    H = [x.strip() for x in val[cab]]
    iR = H.index('Rapero')
    iID = H.index('Discord ID')

    # nombre normalizado -> (fila 1-based, id actual). Con alias resueltos.
    porn, id_en_uso = {}, {}
    alias = (akas.get('alias') or {})
    for f in range(cab + 1, len(val)):
        fila = val[f]
        raw = (fila[iR] if len(fila) > iR else '').strip()
        if not raw:
            continue
        did = (fila[iID] if len(fila) > iID else '').strip()
        clave = PAD.norm(alias.get(PAD.norm(raw), raw))
        porn[clave] = (f + 1, did)
        if did:
            id_en_uso[did] = raw

    rellenar = []     # (fila, id, nombre, reg_key)
    pendientes = []   # (tipo, detalle, match, reg_key)
    ya_estaba = []    # reg_key (mismo id, nada que hacer)
    altas = []        # (reg, reg_key, etiqueta, id): se anotó él mismo

    for k, reg in anotados:
        did = str(reg.get('id') or '').strip()
        if not did:
            continue
        etiqueta = reg.get('nick') or reg.get('glob') or reg.get('user') or did
        # ¿ese id ya está puesto en alguna fila?
        if did in id_en_uso:
            ya_estaba.append(k)
            continue
        matches = []
        for c in candidatos(reg, PAD.norm):
            if c in porn and porn[c] not in [m[1] for m in matches]:
                matches.append((c, porn[c]))
        if len(matches) == 1:
            fila, id_actual = matches[0][1]
            if id_actual and id_actual != did:
                pendientes.append(('conflicto', '%s = %s' % (etiqueta, did),
                                   'la fila ya tiene %s' % id_actual, k))
            elif id_actual == did:
                ya_estaba.append(k)
            else:
                nombre = val[fila - 1][iR].strip()
                rellenar.append((fila, did, nombre, k))
        elif len(matches) > 1:
            quienes = ', '.join(val[m[1][0] - 1][iR].strip() for m in matches)
            pendientes.append(('ambiguo', '%s = %s' % (etiqueta, did),
                               'calza con: %s' % quienes, k))
        elif reg.get('por') == 'yo':
            altas.append((reg, k, etiqueta, did))
        else:
            pendientes.append(('alta', '%s = %s' % (etiqueta, did),
                               'sv %s' % (reg.get('sv') or '?'), k))

    # 🔑 LAS ALTAS SOLAS (#11). Ver `alta_sola()`.
    nuevos = []       # (nombre, código, id, nota, reg_key)
    if altas:
        sys.path.insert(0, os.path.join(BASE, 'bot'))
        import autoverificar as AV
        import verificados as VER
        import lista_raperos as LR
        try:
            import decidir as DEC
            trolls = {PAD.norm(x) for x in DEC.no_rankear()}
        except Exception:                                # noqa: BLE001
            trolls = set()
        try:
            ident = json.load(io.open(os.path.join(BASE, 'datos', 'identidades.json'),
                                      encoding='utf-8'))
        except (OSError, ValueError):
            ident = {}
        saltear = (set(VER._olvidados() or {}) | trolls
                   | {PAD.norm(x) for x in (ident.get('no_verificar') or {})})
        nombres = {}
        for f in range(cab + 1, len(val)):
            raw = (val[f][iR] if len(val[f]) > iR else '').strip()
            if raw:
                nombres.setdefault(PAD.norm(PAD.limpio(raw)), PAD.limpio(raw))
        alias_n = {PAD.norm(a): r for a, r in alias.items()}
        iso_ok = set(AV._iso_de_nombre().values())
        ses, mapas = [None], [None]

        def pais(reg):
            # 🔴 LA REGLA DE SIEMPRE, CON LA BANDERA DEL APODO AL FINAL: gana
            # USA, después el rol de DRA, después los otros servidores, y
            # recién ahí la bandera (`autoverificar.pais_de`). Antes la
            # bandera del apodo iba primero (auditoría del 25/09/2026).
            apodo = ' '.join(str(reg.get(k) or '') for k in ('nick', 'glob'))
            suyos = {}
            try:
                if ses[0] is None:
                    ses[0] = AV._sesion() or False
                    if ses[0]:
                        mapas[0] = AV.mapas_de_roles(ses[0], AV_GUILDS())
                if ses[0] and mapas[0]:
                    suyos = AV.roles_de_pais(ses[0], AV_GUILDS(), mapas[0],
                                             str(reg.get('id')))[0]
            except Exception as e:                       # noqa: BLE001
                print('  ⚠️ no pude mirar los roles de %s (%s)'
                      % (reg.get('id'), str(e)[:40]))
            cc = AV.pais_de({'full': apodo, 'pais': ''}, suyos, None, {})[0]
            return cc if cc in iso_ok else ''

        for reg, k, etiqueta, did in altas:
            nombre, cc, motivo = alta_sola(reg, nombres, alias_n, saltear,
                                           PAD.norm, pais)
            if motivo:
                pendientes.append(('alta', '%s = %s' % (etiqueta, did),
                                   'sv %s · %s' % (reg.get('sv') or '?', motivo), k))
            elif len(nuevos) < TOPE_ALTAS:
                nuevos.append((nombre, cc, did, 'alta automática · /card en %s · %s'
                               % (reg.get('sv') or '?', LR._ahora_et()), k))
                nombres[PAD.norm(nombre)] = nombre
            # ⚠️ pasado el tope, se queda en la cola: entra en la próxima vuelta

    print('  %d entran solos a la Lista (se anotaron ellos, con país)' % len(nuevos))
    for nombre, cc, did, _, _ in nuevos:
        print('     %-20s %s  %s' % (nombre, cc, did))
    print('  %d se rellenan solos (match exacto, sin id)' % len(rellenar))
    for _, did, nombre, _ in rellenar:
        print('     %-20s <- %s' % (nombre, did))
    print('  %d ya estaban (mismo id) — se sacan de la cola' % len(ya_estaba))
    print('  %d van a «Pendientes» para que decidas' % len(pendientes))
    for tipo, det, match, _ in pendientes:
        print('     [%-9s] %-28s %s' % (tipo, det, match))

    if not aplicar:
        print('\n  (nada escrito — corré con --aplicar)\n')
        return

    # ── respaldo de la columna de IDs antes de tocar ──────────────────────
    resp = {'cuando': time.strftime('%Y-%m-%d %H:%M'), 'hoja': PAD.HOJA,
            'ids': [(val[f][iR], val[f][iID] if len(val[f]) > iID else '')
                    for f in range(cab + 1, len(val)) if len(val[f]) > iR and val[f][iR].strip()]}
    rp = os.path.join(BASE, 'docs', 'respaldo_ids_%s.json' % time.strftime('%Y%m%d_%H%M'))
    with io.open(rp, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(resp, f, ensure_ascii=False, indent=1)
    print('\n  respaldo -> %s' % os.path.relpath(rp, BASE))

    # ── 1. rellenar ids (RAW: como texto, para no perder digitos) ─────────
    for fila, did, nombre, k in rellenar:
        ws.update([[str(did)]], '%s%d' % (letra(iID), fila), raw=True)
        borrar_kv(s, k)
        print('  escrito %s en %s' % (did, nombre))

    # ── 1b. las altas solas (#11): una fila nueva cada una ────────────────
    entraron = []
    if nuevos:
        import lista_raperos as LR
        for nombre, cc, did, nota, k in nuevos:
            try:
                n = LR.agregar(nombre, cc, did, nota, aplicar=True)
            except Exception as e:                       # noqa: BLE001
                print('  ⚠️ no pude agregar a %s (%s)' % (nombre, str(e)[:60]))
                n = None
            if n:
                borrar_kv(s, k)
                entraron.append('%s %s' % (nombre, LR._bandera(cc)))
            else:
                pendientes.append(('alta', '%s = %s' % (nombre, did),
                                   'no se pudo agregar solo', k))
        if entraron:
            try:
                sys.path.insert(0, os.path.join(BASE, 'bot'))
                import alertar
                alertar.normal('🆕 Entraron solos a la Lista (se anotaron con /card): '
                               + ', '.join(entraron))
            except Exception:                            # noqa: BLE001
                pass

    # ── 2. los que ya estaban: fuera de la cola ───────────────────────────
    for k in ya_estaba:
        borrar_kv(s, k)

    # ── 3. pendientes: una fila por cada uno, sin pisar nada ──────────────
    if pendientes:
        # 🔴 CON `anotar_varios`, QUE NO REPITE: antes era un `append_row`
        # por duda, y si el borrado de KV fallaba la misma fila volvía a
        # entrar cada media hora. Ver `sheet/pendientes.py`.
        try:
            from pendientes import anotar_varios
            k = anotar_varios([(tipo, 'bot /card', det, match)
                               for tipo, det, match, _ in pendientes])
            print('  %d fila(s) nuevas en «%s» (%d ya estaban)'
                  % (k, PENDIENTES, len(pendientes) - k))
            quedan = [c for _, _, _, c in pendientes if not borrar_kv(s, c)]
            if quedan:
                print('  ⚠️ %d `reg:` no se pudieron sacar de la cola: vuelven '
                      'la próxima vez (sin repetirse en Pendientes)' % len(quedan))
        except Exception as e:
            print('  ⚠️ no pude escribir en «%s»: %s' % (PENDIENTES, e))
            print('     (los `reg:` de esos quedan en la cola para el próximo intento)')

    print('\n  listo. Después conviene:  python sheet/construir_padron.py\n')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

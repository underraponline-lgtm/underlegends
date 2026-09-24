# -*- coding: utf-8 -*-
"""SACAR EL PAIS DEL ROL DE DRA Y ESCRIBIRLO EN EL SHEET.

    python herramientas/pais_desde_rol.py             muestra el plan
    python herramientas/pais_desde_rol.py --aplicar   lo escribe

Dlx, 19/09/2026: *«si alguien q sabes quien es tiene el rol llamado PERU y no
tiene país en el Google sheet se le asigna y ya»*. El dato ya existe —lo puso
la persona al verificarse por YAGPDB— y el Sheet no lo tiene.

⚠️ SIN PAIS NO HAY CARTA DE PAIS, y eso es correcto, no un bug: es la regla
«sin dato no hay pieza». Por eso llenar esta columna desbloquea cartas.

⚠️ LOS DOS SERVIDORES TIENEN ROLES DE PAIS, Y ESCRIBEN EL NOMBRE DISTINTO.
DRA usa texto normal («🔵﹒Costa R.») y FFA usa **letras matematicas en
negrita** («🇻🇪 ⬌ 𝐕𝐄𝐍𝐄𝐙𝐔𝐄𝐋𝐀»), que NO tienen ni una letra ASCII adentro. Por
eso la primera pasada dijo «FFA: 0 roles de pais» y era mentira: hay que
normalizar con **NFKD** —la compatible— y no con NFD. Con NFD, «𝐕» sigue
siendo «𝐕»; con NFKD se vuelve «V».

⚠️ «OTRO PAIS» Y «LATINOAMERICA» NO SON PAISES. Son roles de FFA y hay que
saltearlos a mano: si entraran, media gente terminaria con el pais
«Latinoamerica» en la columna.

⚠️ GANA EL ROL, NO EL SHEET. Dlx, 19/09/2026: *«el rol gana, porque el sheet lo
asignan usualmente los bots, mientras que el rol ellos mismos se lo ponen»*. Si
la columna dice una cosa y el rol otra, se escribe el rol.

🔴 CON UNA EXCEPCION: `pais_fijado` de `datos/identidades.json`. Son las
decisiones de pais tomadas A MANO en Identidades_Ranking_v2 §5 —varias de doble
nacionalidad, donde el rol es tan cierto como el otro— y ganan sobre el rol.
Respawn es el caso que lo obliga: su rol dice Honduras y el MD dice Venezuela.

⚠️ DRA MANDA SOBRE FFA. Dlx, 19/09/2026. FFA solo decide si DRA no dice nada.
Un choque entre los dos no frena la escritura, pero SE REPORTA.

⚠️ DOBLE NACIONALIDAD CON USA -> GANA USA. Dlx: «si hay 2 nacionalidades pero
1 de ellas es USA solo usa la de USA». No es una regla nueva: el MD ya la habia
aplicado a mano en Christo («también 🇲🇽; se usa 🇺🇸»); ahora es una sola.

⚠️ VARIOS PAISES Y NINGUNO ES USA = NO SE TOCA. Ahi elegir seria adivinar, y va
al informe para que lo decida Dlx.

⚠️ EL NOMBRE SE ESCRIBE COMO YA LO ESCRIBE EL SHEET, no como lo dice el rol.
El rol dice «🔵﹒U.S.» y la columna usa «Estados Unidos»; «⚪﹒Republica D.» es
«República Dominicana». Inventar una variante nueva parte el mismo pais en dos
valores y rompe los conteos por pais.
"""
import io
import json
import os
import re
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

API = 'https://discord.com/api/v10'
DRA = '841017460341604382'
GUILDS = (('DRA', DRA), ('FFA', '1468472442925092958'))

# Roles que PARECEN pais y no lo son. Sin esto, «Latinoamerica» entra como pais.
NO_ES_PAIS = {'otropais', 'latinoamerica', 'latino'}

# Doble nacionalidad con Estados Unidos: gana Estados Unidos (Dlx, 19/09/2026)
USA = 'Estados Unidos'

# rol de DRA (ya limpio de emoji) -> como lo escribe la columna del Sheet
COMO_LO_ESCRIBE_EL_SHEET = {
    'peru': 'Perú', 'argentina': 'Argentina', 'espana': 'España',
    'colombia': 'Colombia', 'ecuador': 'Ecuador', 'venezuela': 'Venezuela',
    'panama': 'Panamá', 'mexico': 'México', 'chile': 'Chile',
    'bolivia': 'Bolivia', 'us': 'Estados Unidos', 'honduras': 'Honduras',
    'guatemala': 'Guatemala', 'nicaragua': 'Nicaragua', 'costar': 'Costa Rica',
    'republicad': 'República Dominicana', 'cuba': 'Cuba', 'uruguay': 'Uruguay',
    'paraguay': 'Paraguay', 'salvador': 'El Salvador', 'puertor': 'Puerto Rico',
    'brasil': 'Brasil',
    # como los escribe FFA (en negrita matematica, ya normalizados por NFKD)
    'estadosunidos': 'Estados Unidos', 'elsalvador': 'El Salvador',
    'costarica': 'Costa Rica', 'republicadominicana': 'República Dominicana',
    'puertorico': 'Puerto Rico',
}


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def clave(nombre_rol):
    """«🔵﹒Costa R.» -> «costar» · «🇻🇪 ⬌ 𝐕𝐄𝐍𝐄𝐙𝐔𝐄𝐋𝐀» -> «venezuela».

    ⚠️ NFKD Y NO NFD. FFA escribe los paises con letras matematicas en
    negrita (U+1D400…), que NFD deja igual porque no son una «e con acento»
    sino otro caracter. NFKD —la compatible— sí las lleva a ASCII. Con NFD
    este script juraba que FFA no tenia ningun rol de pais.
    """
    import unicodedata
    s = unicodedata.normalize('NFKD', nombre_rol).lower()
    return ''.join(c for c in s if c.isalnum())


def letra(i):
    s, i = '', i + 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def main():
    import requests
    import gspread
    from google.oauth2.service_account import Credentials
    import construir_padron as PAD

    aplicar = '--aplicar' in sys.argv
    s = requests.Session()
    s.headers['Authorization'] = 'Bot ' + env('DISCORD_TOKEN')

    # los roles de pais de LOS DOS servidores (los ids son unicos por guild)
    rol_pais, ignorados = {}, []
    for sv, gid in GUILDS:
        roles = s.get('%s/guilds/%s/roles' % (API, gid), timeout=30).json()
        n = 0
        for r in roles:
            k = clave(r['name'])
            if k in NO_ES_PAIS:
                ignorados.append('%s: %s' % (sv, r['name']))
            elif k in COMO_LO_ESCRIBE_EL_SHEET:
                rol_pais[r['id']] = COMO_LO_ESCRIBE_EL_SHEET[k]
                n += 1
        print('\n%s: %d roles de pais' % (sv, n))
    if ignorados:
        print('  (no son paises, se saltean: %s)' % ' · '.join(ignorados))

    # los roles de cada persona, UNIENDO los dos servidores
    miembros = {}
    for sv, gid in GUILDS:
        after = '0'
        while True:
            r = s.get('%s/guilds/%s/members' % (API, gid),
                      params={'limit': 1000, 'after': after}, timeout=40)
            if r.status_code == 429:
                time.sleep(float(r.json().get('retry_after', 1)) + .3)
                continue
            lote = r.json()
            if not lote:
                break
            for m in lote:
                did = (m.get('user') or {}).get('id')
                if did:
                    # ⚠️ POR SERVIDOR, NO UNIDOS. Si alguien tiene Perú en DRA
                    # y Colombia en FFA hay que poder DECIR cuál dijo qué;
                    # uniendo los roles el choque se ve pero no de dónde sale.
                    miembros.setdefault(did, {}).setdefault(sv, set()).update(
                        m.get('roles') or [])
        # 🔴 `key=int` NO ES COSMETICO. Los snowflakes tienen 17, 18 y 19
        # digitos, y `max()` sobre cadenas compara alfabeticamente: asi
        # '999999999999999999' le gana a '1000000000000000000', que es
        # mayor de verdad, y el cursor RETROCEDE. Medido en DRA: 4 paginas
        # y 3.069 filas para 2.707 personas — 362 pedidas dos veces. El
        # conjunto salia bien de casualidad (los `set` deduplican), pero
        # combinado con `break` en una pagina corta puede cortar antes de
        # llegar al final.
            after = max(((m.get('user') or {}).get('id', '0') for m in lote), key=int)
            time.sleep(0.2)
    print('%d personas vistas entre DRA y FFA\n' % len(miembros))

    # las decisiones tomadas a mano ganan sobre el rol
    fijado = {}
    try:
        ident = json.load(io.open(os.path.join(BASE, 'datos', 'identidades.json'),
                                  encoding='utf-8'))
        fijado = {PAD.norm(k): v for k, v in (ident.get('pais_fijado') or {}).items()}
    except Exception:
        print('  ⚠️ sin datos/identidades.json: corro sin los paises fijados a mano')

    pad = PAD.cargar()
    poner, corregir, varios, protegidos = [], [], [], []
    for p in pad:
        actual = (p.get('pais') or '').strip()
        did = (p.get('discord_id') or '').strip()
        por_sv = {}
        if did and did in miembros:
            por_sv = {sv: sorted({rol_pais[r] for r in rs if r in rol_pais})
                      for sv, rs in miembros[did].items()}
            por_sv = {sv: v for sv, v in por_sv.items() if v}

        # 🔴 EL MD SE MIRA PRIMERO, y ahi estaba el bug: los que tenian VARIOS
        # roles caian en el `continue` de la ambiguedad antes de llegar aca, y
        # su decision fijada a mano no se aplicaba nunca. El MD manda: no se
        # mira el rol siquiera.
        pin = fijado.get(PAD.norm(p['raw']))
        if pin:
            if actual != pin:
                corregir.append((p['raw'], actual or '(vacío)', pin))
            ps_pin = sorted({x for v in por_sv.values() for x in v})
            if ps_pin and ps_pin != [pin]:
                protegidos.append((p['raw'], actual, '/'.join(ps_pin), pin))
            continue

        ps = sorted({x for v in por_sv.values() for x in v})
        if not ps:
            continue

        # ⚠️ DRA MANDA SOBRE FFA. Dlx, 19/09/2026. FFA solo decide si DRA no
        # dice nada. Un choque entre los dos NO frena la escritura —gana DRA—
        # pero igual se reporta, que es lo que Dlx pidio saber.
        entre_sv = len(por_sv) > 1 and len({tuple(v) for v in por_sv.values()}) > 1
        if entre_sv:
            varios.append((p['raw'], actual, por_sv, True))
        dra, ffa = por_sv.get('DRA', []), por_sv.get('FFA', [])
        if len(dra) == 1:
            quiere = dra[0]
        elif not dra and len(ffa) == 1:
            quiere = ffa[0]
        elif USA in ps:
            # ⚠️ DOBLE NACIONALIDAD CON USA -> GANA USA. Dlx, 19/09/2026: «si
            # hay 2 nacionalidades pero 1 de ellas es USA solo usa la de USA».
            # Coincide con lo que el MD ya habia decidido a mano para Christo
            # («también 🇲🇽; se usa 🇺🇸»), asi que la regla no es nueva: estaba
            # aplicada caso por caso y ahora es una sola.
            quiere = USA
        else:
            # varios paises y ninguno es USA: adivinar seria peor
            if not entre_sv:
                varios.append((p['raw'], actual, por_sv, False))
            continue
        # (el `pais_fijado` ya se resolvio arriba, antes de mirar los roles)
        if not actual:
            poner.append((p['raw'], quiere))
        elif actual != quiere:
            corregir.append((p['raw'], actual, quiere))

    print('  ✅ SIN pais en el Sheet, se lo pone el rol: %d' % len(poner))
    for n, pa in poner:
        print('       %-22s -> %s' % (n, pa))
    print('  🔁 el Sheet dice otra cosa — GANA EL ROL, se corrige: %d' % len(corregir))
    for n, a, b in corregir:
        print('       %-22s %-22s -> %s' % (n, a, b))
    print('  🔒 fijados a mano en el MD (el rol NO los pisa): %d' % len(protegidos))
    for n, a, b, pin in protegidos:
        print('       %-22s queda %-16s (el rol decia %s)' % (n, pin, b))
    entre = [v for v in varios if v[3]]
    mismo = [v for v in varios if not v[3]]
    print('  🔴 CHOQUE ENTRE SERVIDORES (un pais en DRA y otro en FFA): %d' % len(entre))
    for n, actual, por_sv, _ in entre:
        detalle = ' · '.join('%s dice %s' % (sv, '/'.join(v)) for sv, v in sorted(por_sv.items()))
        print('       %-22s Sheet=%-16s %s' % (n, actual or '(vacío)', detalle))
    print('  🔎 con varios roles de pais en el MISMO servidor: %d' % len(mismo))
    for n, actual, por_sv, _ in mismo:
        detalle = ' · '.join('%s: %s' % (sv, '/'.join(v)) for sv, v in sorted(por_sv.items()))
        print('       %-22s Sheet=%-16s %s' % (n, actual or '(vacío)', detalle))
    poner = poner + [(n, b) for n, a, b in corregir]

    if not aplicar:
        print('\n  (nada escrito — corré con --aplicar)\n')
        return
    if not poner:
        print('\n  nada que escribir\n')
        return

    gc = gspread.authorize(Credentials.from_service_account_file(
        os.path.join(BASE, 'creds.json'),
        scopes=['https://www.googleapis.com/auth/spreadsheets']))
    ws = gc.open_by_key(PAD.OPERATIVO).worksheet(PAD.HOJA)
    val = ws.get_all_values()
    cab = PAD._cabecera(val)
    H = [x.strip() for x in val[cab]]
    iR, iB = H.index('Rapero'), H.index('Bandera')
    fila_de = {}
    for f in range(cab + 1, len(val)):
        raw = (val[f][iR] if len(val[f]) > iR else '').strip()
        if raw:
            fila_de[PAD.norm(raw)] = f + 1

    # ⚠️ EL RESPALDO GUARDA EL VALOR ANTERIOR, no solo el nuevo. Desde que el
    # rol gana, esto SOBRESCRIBE paises que ya estaban; sin el valor viejo no
    # hay forma de volver atras.
    antes_de = {PAD.norm(x['raw']): (x.get('pais') or '') for x in pad}
    p = os.path.join(BASE, 'docs', 'respaldo_paises_%s.json' % time.strftime('%Y%m%d_%H%M'))
    json.dump({'cuando': time.strftime('%Y-%m-%d %H:%M'),
               'cambios': [{'rapero': n, 'antes': antes_de.get(PAD.norm(n), ''),
                            'ahora': pa} for n, pa in poner]},
              io.open(p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=1)
    print('\n  respaldo -> %s' % os.path.relpath(p, BASE))

    celdas = []
    for n, pa in poner:
        f = fila_de.get(PAD.norm(n))
        if f:
            celdas.append({'range': '%s%d' % (letra(iB), f), 'values': [[pa]]})
    ws.batch_update(celdas, value_input_option='RAW')
    print('  ✅ %d pais(es) escritos en el Sheet' % len(celdas))
    print('\n  después:  python sheet/construir_padron.py\n')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

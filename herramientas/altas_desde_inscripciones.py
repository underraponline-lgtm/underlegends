# -*- coding: utf-8 -*-
"""DAR DE ALTA EN `Lista de Raperos` A QUIEN COMPITE Y NO ESTA, POR SU ID.

    python herramientas/altas_desde_inscripciones.py            el plan
    python herramientas/altas_desde_inscripciones.py --aplicar  lo escribe

🔴 POR QUE EXISTE. Dlx, 24/09/2026: *«te dije que te bases en el ID de los
autores en el canal de inscripciones… las personas tienen que mostrarse con
el AKA»*. Medido ese día: **27 de las 71 personas que salen en la web no
están en el padrón**. Compiten, tienen puntos, y sin fila no pueden tener
carta —el portón de identidad pide Discord ID— ni país, ni AKA.

Y el dato para darlas de alta ya existía y no lo usaba nadie:
`bot/inscripciones.py` lee el canal de inscripciones y saca **40 nombres con
sus 40 Discord IDs**, porque un mensaje de inscripción lo escribió la propia
persona: el `author.id` viene firmado por Discord.

🔑 **UNA INSCRIPCION VALE MAS QUE CUALQUIER ALGORITMO DE NOMBRES**, y está
medido en el encabezado de ese archivo: cruzar los 371 del padrón sin ID
contra los 2.705 miembros de DRA daba **11 aciertos, el 3 %**. Por el canal
es el 100 % y sin margen de error, porque no es un parecido — es la cuenta
que escribió. El caso que lo muestra: `tnor` se inscribe desde la cuenta
`tenor_25499`, y ningún algoritmo une eso.

LO QUE **NO** HACE, Y ES LA MITAD DEL DISEÑO
--------------------------------------------
⚠️ **No inventa una fila cuando el match es dudoso.** Si un competidor se
parece a dos inscripciones, o a ninguna, va a una lista para mirar. Escribir
una fila con el ID de otro es peor que no escribirla: ese ID abre `/card`,
y la persona recibiría la tarjeta de alguien más.

⚠️ **No toca a nadie que YA esté en el padrón.** Esto da de alta; corregir
lo que ya está es otra pregunta y la contesta `sheet/registrar_ids.py`.

⚠️ **No acepta una bandera que no sea de la Liga.** El mismo Hassan se
escribe con 🇪🇬, 🇮🇶 y 🇦🇴, y hay 🇬🇦, 🇦🇿 y 🇳🇴 en los nombres: son chistes.
Una fila nueva entra **sin país** antes que con uno inventado — el país
después lo pone el rol de Discord, que es el que la persona eligió de verdad
(`herramientas/pais_desde_rol.py`).
"""
import difflib
import io
import json
import os
import re
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'sheet'))
sys.path.insert(0, BASE)

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: cuánto parecido pide un match automático. Por debajo, va a revisión.
CORTE = 0.86


def norm(s):
    s = unicodedata.normalize('NFKD', str(s or ''))
    s = ''.join(c for c in s if not unicodedata.combining(c))
    return ''.join(c for c in s.lower() if c.isalnum())


def _j(*p):
    try:
        with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def bandera(s):
    """El ISO de la bandera del nombre, **sólo si es un país de la Liga**."""
    try:
        from padron_t1 import PAIS_ISO
        liga = {v for v in PAIS_ISO.values()} - {'br', 'ae'}
    except ImportError:
        liga = set()
    m = re.findall(r'[\U0001F1E6-\U0001F1FF]{2}', str(s or ''))
    if not m:
        return ''
    cc = ''.join(chr(ord(c) - 0x1F1E6 + ord('a')) for c in m[0])
    return cc if (not liga or cc in liga) else ''


def limpio(s):
    """El nombre sin banderas ni adornos, como se escribiría en el padrón."""
    s = re.sub(r'[\U0001F1E6-\U0001F1FF]{2}', '', str(s or ''))
    s = re.sub(r'[\U0001F300-\U0001FAFF☀-➿]', '', s)
    return re.sub(r'\s+', ' ', s).strip(' .-_·|')


def main():
    aplicar = '--aplicar' in sys.argv
    pool = _j('datos', 'temporada_pool.json') or []
    pool = pool.get('pool', pool) if isinstance(pool, dict) else pool
    pad = _j('datos', 'padron.json') or []
    ins = (_j('datos', 'anuncios.json') or {}).get('inscripciones') or []

    en_padron = {norm(x.get('raw')) for x in pad}
    # los alias también cuentan como «ya está»
    al = (_j('datos', 'akas.json') or {}).get('alias') or {}

    faltan = [x for x in pool
              if norm(x.get('raw')) not in en_padron
              and norm(al.get(norm(x.get('raw')), '')) not in en_padron
              and (x.get('ev') or 0) > 0]

    # las inscripciones, por nombre declarado
    cands = []
    for i in ins:
        n = limpio(i.get('texto'))
        if n and i.get('discord_id'):
            cands.append((norm(n), n, i))

    print('\n══ ALTAS DESDE EL CANAL DE INSCRIPCIONES ══\n')
    print('   compiten y no están en el padrón:  %d' % len(faltan))
    print('   inscripciones con Discord ID:      %d\n' % len(cands))

    altas, dudosos, sin_match = [], [], []
    ya = {c[0] for c in cands}
    for x in sorted(faltan, key=lambda y: -(y.get('pts') or 0)):
        k = norm(x.get('raw'))
        exactos = [c for c in cands if c[0] == k]
        if len(exactos) == 1:
            altas.append((x, exactos[0], 1.0))
            continue
        if len(exactos) > 1:
            dudosos.append((x, 'hay %d inscripciones con ese nombre'
                            % len(exactos)))
            continue
        cerca = difflib.get_close_matches(k, list(ya), n=2, cutoff=CORTE)
        if len(cerca) == 1:
            c = next(c for c in cands if c[0] == cerca[0])
            altas.append((x, c, difflib.SequenceMatcher(None, k,
                                                        cerca[0]).ratio()))
        elif len(cerca) > 1:
            dudosos.append((x, 'se parece a %s' % ' y a '.join(cerca)))
        else:
            sin_match.append(x)

    print('   ✅ ALTAS CLARAS: %d' % len(altas))
    for x, c, r in altas:
        cc = bandera(c[2].get('texto'))
        print('      %-20s -> %-20s id=%-20s %s  (%.0f%%)'
              % (str(x.get('raw'))[:20], c[1][:20], c[2]['discord_id'],
                 cc or '—', r * 100))

    print('\n   ⚠️ A REVISAR, NO SE ESCRIBEN: %d' % len(dudosos))
    for x, por in dudosos[:12]:
        print('      %-20s %s' % (str(x.get('raw'))[:20], por))

    print('\n   ·  SIN NINGUNA INSCRIPCION QUE SE LE PAREZCA: %d'
          % len(sin_match))
    for x in sin_match[:14]:
        print('      %-22s %6s pts  %s ev' % (str(x.get('raw'))[:22],
                                              x.get('pts'), x.get('ev')))
    if sin_match:
        print('      -> compitieron sin inscribirse por el canal, o el')
        print('         lector de llaves les puso un nombre que nadie usa.')

    if not aplicar:
        print('\n   (nada escrito — corré con --aplicar)\n')
        return 0
    if not altas:
        print('\n   nada que dar de alta\n')
        return 0

    import gspread
    from google.oauth2.service_account import Credentials
    # ⚠️ EL ID DEL OPERATIVO Y EL BUSCADOR DE CABECERA VIVEN EN
    # `construir_padron`, no en `padron`: el segundo lee por `escribir.Hoja`
    # y no expone ninguno de los dos. Importar del que los tiene evita
    # escribir el id de la planilla una segunda vez.
    import construir_padron as CP
    gc = gspread.authorize(Credentials.from_service_account_file(
        os.path.join(BASE, 'creds.json'),
        scopes=['https://www.googleapis.com/auth/spreadsheets']))
    ws = gc.open_by_key(CP.OPERATIVO).worksheet(CP.HOJA)
    val = ws.get_all_values()
    cab = CP._cabecera(val)
    H = [x.strip() for x in val[cab]]

    # ⚠️ SE ESCRIBE POR NOMBRE DE COLUMNA, no por posición. `Lista de
    # Raperos` tiene diez columnas y ya cambió de orden una vez; una fila
    # armada por índice entra corrida y no falla.
    filas = []
    for x, c, _r in altas:
        f = [''] * len(H)
        def pon(col, v):
            if col in H:
                f[H.index(col)] = v
        pon('Rapero', c[1])
        pon('Nombre', c[1])
        pon('Discord ID', str(c[2]['discord_id']))
        pon('País', bandera(c[2].get('texto')))
        pon('SV', c[2].get('servidor') or '')
        pon('Notas', 'alta automática desde #inscripciones')
        filas.append(f)
    ws.append_rows(filas, value_input_option='RAW')
    print('\n   ✅ %d fila(s) agregadas a `%s`' % (len(filas), CP.HOJA))
    print('      después:  python sheet/construir_padron.py')
    print('                python herramientas/pais_desde_rol.py --aplicar\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

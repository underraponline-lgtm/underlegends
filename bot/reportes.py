# -*- coding: utf-8 -*-
"""📣 LO QUE LA GENTE AVISA QUE ESTÁ MAL EN UNA LLAVE, A ✅ DECIDIR.

    python bot/reportes.py             qué pasaría (no escribe nada)
    python bot/reportes.py --aplicar   lo anota en `Pendientes`
    python bot/reportes.py --auto      self-check, sin red

🔑 Dlx, 28/09/2026, a «"Reportar un error" en cada llave: quien ve mal su
batalla la marca desde la página y va a ✅ Decidir, nunca por DM»: *«ok»*.
La página lo manda al Worker (`/api/avisos/reportar`) con la sesión de Mi
cuenta —quién es lo dice Discord—, el objeto lo guarda y deja los últimos en
KV (`reportes`), y esto los anota en `Pendientes` como «Reporte». ✅ Decidir
los muestra en la sección de su evento, con «Ya lo revisé».

⚠️ SIN MEMORIA PROPIA, A PROPÓSITO: `pendientes.anotar_varios()` no repite una
fila con el mismo detalle, y el detalle lleva el número del reporte (`#<id>`).
Leer la misma cola en cada corrida no duplica nada.

⚠️ NUNCA POR DM, y el Discord ID de quien reportó no se escribe en la hoja:
va su nombre de la Lista, o «una cuenta de Discord».
"""
import datetime as dt
import io
import json
import os
import re
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, SCR, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: la clave de KV que escribe el objeto (`colaReportes()` en `bot/avisos.js`)
COLA = 'reportes'
#: qué se puede reportar: las mismas claves que `QUE_REPORTE` del Worker
QUE = {'ganador': 'El ganador está mal', 'gente': 'Falta o sobra alguien',
       'nombre': 'Un nombre está mal', 'otro': 'Otra cosa'}


def leer():
    """La cola de KV, o `None` si no se pudo leer (no es lo mismo que vacía)."""
    import requests
    import subir_datos as SD
    import fotos as F
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + F.env('CLOUDFLARE_API_TOKEN')
    try:
        # ⚠️ POR `bulk/get`, como `avisos_personales.encolar()`: el de a una da
        # el valor viejo un rato después de escribir
        r = s.post('%s/bulk/get' % SD.API, json={'keys': [COLA]}, timeout=30)
        v = ((r.json().get('result') or {}).get('values') or {}).get(COLA)
        v = v.get('value') if isinstance(v, dict) else v
        return json.loads(v) if isinstance(v, str) else (v or [])
    except (ValueError, OSError):
        return None


def _nombres():
    """`{discord_id: nombre}` de la Lista."""
    try:
        with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
            return {str(r.get('discord_id')): (r.get('raw') or r.get('full'))
                    for r in json.load(f) or [] if r.get('discord_id')}
    except (OSError, ValueError):
        return {}


def _et(ms):
    try:
        from zoneinfo import ZoneInfo
        t = dt.datetime.fromtimestamp(int(ms) / 1000, ZoneInfo('America/New_York'))
    except Exception:                                    # noqa: BLE001
        return ''
    return t.strftime('%d/%m ') + t.strftime('%I:%M %p').lstrip('0') + ' ET'


def filas(cola, nombres):
    """`[(tipo, origen, detalle, match)]` para `pendientes.anotar_varios()`.

    📣 Sólo los ABIERTOS: lo que Dlx ya decidió desde el Dashboard (`estado`, 13/10/2026) no se pregunta otra vez en
    ✅ Decidir, y `pendientes.barrer()` cierra la fila si ya estaba (`cerrados()`)."""
    out = []
    for r in cola or []:
        if not isinstance(r, dict) or not r.get('id') or r.get('estado'):
            continue
        llave = str(r.get('llave') or '')
        origen = 'evento #%s' % llave if llave.isdigit() else 'llave en vivo'
        texto = str(r.get('texto') or '').strip()
        bat = str(r.get('batalla') or '').strip()
        det = '%s%s%s · #%s' % (QUE.get(r.get('que'), QUE['otro']), (': ' + texto) if texto else '',
                                (' · ' + bat) if bat else '', r['id'])
        quien = nombres.get(str(r.get('quien') or '')) or 'una cuenta de Discord'
        out.append(('Reporte', origen, det[:400], ('Lo mandó %s, %s' % (quien, _et(r.get('t')))).strip(', ')))
    return out


def cerrados(cola=None):
    """Los números de los reportes que Dlx ya decidió desde el Dashboard (`{'4', '7'}`): su fila de ✅ Decidir se
    cierra sola (`pendientes._resuelto_ya()`). Vacío si la cola no se pudo leer."""
    cola = leer() if cola is None else cola
    return {str(r.get('id')) for r in cola or [] if isinstance(r, dict) and r.get('id') and r.get('estado')}


# ══ 📣 CORREGIR DESDE EL DASHBOARD ══════════════════════════════════════════════════════════════════════════════════
# 🔑 Dlx, 13/10/2026, a la lista de reportes del Dashboard: *«me llegaron los reportes pero ¿qué acciones puedo hacer
# acá?»*, y a la propuesta de botones, *«Sí, todas»*. Hasta acá un reporte sólo se podía marcar «Ya lo revisé» en
# ✅ Decidir, y lo que pedían cuatro de los siete no tenía arreglo en ningún lado: «Agus» es un nombre común, el lector
# une por nombre, y todo «Agus» iba a Agus 🇦🇷 —la #464 era AGUSTÍN51K y la #423 y la #429 un Agustin 🇺🇾—.
#
# Lo que Dlx elige viaja con el reporte (`estado` = `corregir`, `fix`) y esto lo aplica:
#   · NOMBRE: la regla para ESE evento en `datos/decisiones.json` (`quien`), que el lector respeta cada vez que relee
#     la llave (`llaves_a_entrada.otro_en_evento()`); y como el ciclo relee sólo los últimos 25 mensajes de cada
#     canal, las filas ya escritas se corrigen en su lugar (`resultados.renombrar()`) y la llave de la página también.
#   · GANADOR: la regla (`ganador`), que el lector aplica aunque la llave diga otro (`ganador_forzado()`). Se da por
#     aplicada cuando la llave de la página lo muestra; si no aparece en `ESPERA_GANADOR_MIN`, la llave es vieja y
#     el ciclo ya no la relee: vuelve como «no pude», para recalcularla a mano (`herramientas/recalcular_t1.py`).
# Y le avisa al objeto (`/avisos/reportes-estados`), que le deja el aviso en la campana a quien reportó.

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
LLAVES = os.path.join(BASE, 'datos', 'llaves_t1.json')
#: cuánto se espera a que el lector aplique un ganador corregido: dos corridas del ciclo y algo
ESPERA_GANADOR_MIN = 75
_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
_SEP = re.compile(r'(\s*[,+&]\s*)')


def _norm(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', _BANDERA.sub('', str(s or '')))
    return ''.join(c for c in s if c.isalnum()).lower()


def _cc_de(s):
    """La bandera de un nombre, como código ISO en minúscula («Agustin 🇺🇾» -> 'uy'), o ''."""
    m = _BANDERA.search(str(s or ''))
    return ''.join(chr(ord(c) - 0x1F1E6 + ord('a')) for c in m.group(0)) if m else ''


def _sin_bandera(s):
    return re.sub(r'\s+', ' ', _BANDERA.sub('', str(s or ''))).strip()


def _fix(r):
    f = r.get('fix')
    if isinstance(f, str):
        try:
            f = json.loads(f) if f else None
        except ValueError:
            f = None
    return f if isinstance(f, dict) else None


def _nombres_de_llave(L):
    """Cada nombre que aparece en una llave de la página, una vez: los de la tabla y cada parte de cada lado."""
    vistos = []
    for r in L.get('tabla') or []:
        vistos.append(str(r[0]))
    for ro in L.get('rondas') or []:
        for b in ro.get('b') or []:
            for lado in list(b[0] or []) + [b[1] or '']:
                vistos += [p for i, p in enumerate(_SEP.split(str(lado))) if not i % 2 and p.strip()]
    out = []
    for x in vistos:
        if x.strip() and x not in out:
            out.append(x.strip())
    return out


def renombrar_llave(L, variantes, nuevo):
    """La llave de la página con `nuevo` donde decía alguna de `variantes` (normalizadas). Cuántos cambió."""
    n = [0]

    def cambia(x):
        partes = _SEP.split(str(x or ''))
        out = []
        for i, p in enumerate(partes):
            if not i % 2 and _norm(p) in variantes:
                n[0] += 1
                p = nuevo
            out.append(p)
        return ''.join(out)
    for r in L.get('tabla') or []:
        r[0] = cambia(r[0])
    for ro in L.get('rondas') or []:
        for b in ro.get('b') or []:
            b[0] = [cambia(x) for x in b[0] or []]
            b[1] = cambia(b[1])
    return n[0]


def destino(fix, quien, porclave, padron):
    """`(nombre, cc)` de a quién le corresponde el nombre: el de la Lista tal como lo resuelve el motor. `ValueError`
    con el porqué si no se puede. Alguien que no está en la Lista se queda con un nombre que no choque con nadie:
    «Agustin 🇺🇾» es «agustin», que es alias de Agus, así que queda «Agustin UY»."""
    from comun.claves import clave
    if fix.get('reporta'):
        fila = next((x for x in padron if str(x.get('discord_id') or '') == str(quien or '')), None)
        nom = porclave.get(clave((fila or {}).get('raw') or (fila or {}).get('full') or ''))
        if not nom:
            raise ValueError('quien lo reportó no está en la Lista de Raperos')
        return nom, None
    if fix.get('es'):
        nom = porclave.get(clave(fix['es']))
        if not nom:
            raise ValueError('«%s» no está en la Lista de Raperos' % fix['es'])
        return nom, None
    base, cc = _sin_bandera(fix.get('nuevo')), _cc_de(fix.get('nuevo'))
    if not clave(base):
        raise ValueError('falta el nombre de la persona nueva')
    cands = [base] + (['%s %s' % (base, cc.upper())] if cc else []) + ['%s %d' % (base, i) for i in range(2, 9)]
    for c in cands:
        if clave(c) not in porclave:
            return c, cc
    raise ValueError('no encontré un nombre libre para «%s»' % base)


def corregir_nombre(r, fix, L, decis, resolver, padron, aplicar):
    """Un nombre de una llave era otra persona. `(estado, qué)`; levanta `ValueError` si no se puede."""
    import resultados as RES
    from comun.claves import clave
    viejo_txt = str(fix.get('nombre') or '').strip()
    viejo = resolver(viejo_txt)
    porclave = resolver.padron
    # todas las formas en que esa persona aparece escrita en la llave: «Agus», «agus🇦🇷», «agustin»…
    variantes = {_norm(x): x for x in _nombres_de_llave(L) if clave(resolver(x)) == clave(viejo) or _norm(x) == _norm(viejo_txt)}
    if not variantes:
        # ⚠️ IDEMPOTENTE: si ya se aplicó en una corrida anterior (y el objeto no se enteró), la llave ya no lo tiene
        hecho = next((v for k, v in (decis.get('quien') or {}).items() if isinstance(v, dict)
                      and str(v.get('reporte')) == str(r.get('id')) and k.startswith('%s · %s · %s · ' % (L['nombre'], L['sv'], L['fecha']))), None)
        if hecho:
            return 'aplicado', '«%s» en la #%s ahora es %s' % (_sin_bandera(viejo_txt), fix['n'], hecho.get('es'))
        raise ValueError('«%s» no está en la llave #%s' % (viejo_txt, fix['n']))
    nuevo, cc = destino(fix, r.get('quien'), porclave, padron)
    if clave(nuevo) == clave(viejo):
        raise ValueError('en la #%s ya es %s' % (fix['n'], nuevo))
    if cc is None:
        paises, _cl = RES._pais_de()
        cc = paises.get(clave(nuevo), '')
    q = decis.setdefault('quien', {})
    q.setdefault('_leeme', 'Quién era de verdad un nombre de UNA llave: «evento · servidor · fecha · nombre» -> '
                 '{"es": persona}. Lo decide Dlx desde un reporte en el Dashboard (13/10/2026) y lo lee '
                 'llaves_a_entrada.otro_en_evento(); bot/reportes.py corrige además las filas ya escritas.')
    for txt in variantes.values():
        q['%s · %s · %s · %s' % (L['nombre'], L['sv'], L['fecha'], txt)] = {
            'es': nuevo, 'antes': viejo, 'cuando': _et(int(time.time() * 1000)), 'por': 'Dlx (Dashboard)',
            'reporte': r.get('id'), 'nota': str(r.get('texto') or '')[:200]}
    celdas = RES.renombrar(fix['n'], viejo, nuevo, cc, dry=not aplicar)
    en_llave = renombrar_llave(L, set(variantes), nuevo)
    print('      #%s «%s» → %s · Resultados %d · 1v1 %d · llave %d'
          % (fix['n'], viejo, nuevo, celdas.get('Resultados', 0), celdas.get('1v1', 0), en_llave))
    return 'aplicado', '«%s» en la #%s ahora es %s' % (_sin_bandera(viejo_txt), fix['n'], nuevo)


def _batalla(L, ronda, lados):
    """La batalla de la llave de la página con esa ronda y esos lados, o None."""
    ks = sorted(_norm(x) for x in lados)
    for ro in L.get('rondas') or []:
        if _norm(ro.get('r')) != _norm(ronda):
            continue
        for b in ro.get('b') or []:
            if sorted(_norm(x) for x in b[0] or []) == ks:
                return b
    return None


def corregir_ganador(r, fix, L, decis, ahora_ms):
    """El ganador de una batalla estaba mal. `(estado, qué)` o `(None, '')` si hay que esperar al lector."""
    b = _batalla(L, fix['ronda'], fix['lados'])
    if b is None:
        raise ValueError('no encontré esa batalla en la llave #%s' % fix['n'])
    qué = 'en la #%s, %s la ganó %s' % (fix['n'], fix['ronda'].lower(), _sin_bandera(fix['ganador']))
    if _norm(b[1]) == _norm(fix['ganador']):
        return 'aplicado', qué
    g = decis.setdefault('ganador', {})
    g.setdefault('_leeme', 'El ganador que Dlx corrigió desde un reporte (13/10/2026), aunque la llave diga otro: '
                 '«evento · servidor · fecha · ronda» -> [{"lados", "ganador"}]. Lo lee llaves_a_entrada.ganador_forzado().')
    k = '%s · %s · %s · %s' % (L['nombre'], L['sv'], L['fecha'], fix['ronda'].lower())
    ks = sorted(_norm(x) for x in fix['lados'])
    lista = [x for x in g.get(k) or [] if sorted(_norm(y) for y in x.get('lados') or []) != ks]
    previo = next((x for x in g.get(k) or [] if sorted(_norm(y) for y in x.get('lados') or []) == ks), None)
    desde = (previo or {}).get('desde_ms') or ahora_ms
    lista.append({'lados': fix['lados'], 'ganador': fix['ganador'], 'cuando': (previo or {}).get('cuando') or _et(ahora_ms),
                  'desde_ms': desde, 'por': 'Dlx (Dashboard)', 'reporte': r.get('id')})
    g[k] = lista
    if ahora_ms - desde > ESPERA_GANADOR_MIN * 60000:
        return 'no_pude', ('la llave #%s ya no la relee el ciclo: hay que recalcularla '
                           '(herramientas/recalcular_t1.py)' % fix['n'])
    print('      #%s %s: la regla está, la aplica el lector en la próxima corrida' % (fix['n'], qué))
    return None, ''


def _al_objeto(estados):
    """Lo aplicado, al objeto (con la clave del ciclo): marca el reporte y avisa en la campana de quien lo mandó."""
    import requests
    import fotos as F
    import clave_ciclo as CC
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok or not estados:
        return False
    r = requests.post(WORKER + '/avisos/reportes-estados',
                      data=json.dumps({'estados': estados}, ensure_ascii=False).encode('utf-8'),
                      headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=30)
    return r.ok


def corregir(cola, aplicar=False):
    """Lo que Dlx eligió corregir desde el Dashboard (`estado` = `corregir`). Cuántos se aplicaron."""
    pend = [(r, _fix(r)) for r in cola or [] if isinstance(r, dict) and r.get('estado') == 'corregir']
    pend = [(r, f) for r, f in pend if f and str(f.get('n') or '').isdigit()]
    print('   %d corrección(es) esperando' % len(pend))
    if not pend:
        return 0
    import motor
    import decidir as DEC
    import llaves_web as LW
    resolver, _n = motor._resolvedor()
    try:
        with io.open(os.path.join(BASE, 'datos', 'padron.json'), encoding='utf-8') as f:
            padron = json.load(f) or []
    except (OSError, ValueError):
        padron = []
    llaves = LW.leer(LLAVES)
    antes_ll = json.dumps(llaves, ensure_ascii=False, sort_keys=True)
    decis = DEC._decisiones()
    antes_de = json.dumps(decis, ensure_ascii=False, sort_keys=True)
    ahora = int(time.time() * 1000)
    estados = {}
    for r, fix in pend:
        L = llaves.get(str(fix['n']))
        try:
            if not L:
                raise ValueError('la llave #%s no está en la página' % fix['n'])
            if fix.get('tipo') == 'nombre':
                est, que = corregir_nombre(r, fix, L, decis, resolver, padron, aplicar)
            elif fix.get('tipo') == 'ganador':
                est, que = corregir_ganador(r, fix, L, decis, ahora)
            else:
                raise ValueError('no sé corregir «%s»' % fix.get('tipo'))
        except ValueError as e:
            est, que = 'no_pude', str(e)
        print('   #%s  %s: %s' % (r.get('id'), est or 'esperando', que))
        if est:
            estados[str(r['id'])] = [est, que]
    if not aplicar:
        print('\n   (simulacro: no escribí nada — corré con --corregir --aplicar)\n')
        return 0
    if json.dumps(decis, ensure_ascii=False, sort_keys=True) != antes_de:
        with io.open(DEC.DECISIONES, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(decis, f, ensure_ascii=False, indent=1)
            f.write('\n')
    if json.dumps(llaves, ensure_ascii=False, sort_keys=True) != antes_ll:
        with io.open(LLAVES, 'w', encoding='utf-8', newline='') as f:
            json.dump(llaves, f, ensure_ascii=False, indent=1, sort_keys=True)
    if estados and not _al_objeto(estados):
        print('   ⚠️ el objeto no contestó: se lo vuelvo a decir en la próxima corrida')
    return sum(1 for x in estados.values() if x[0] == 'aplicado')


def _self_check():
    print('\n  reportes.py — self-check\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))

    cola = [{'id': 7, 'quien': '111', 'llave': '370', 'que': 'ganador', 'texto': 'la final la ganó Paria',
             'batalla': '', 't': 1759118400000},
            {'id': 8, 'quien': '222', 'llave': 'v:1554310239942213663', 'que': 'otro', 'texto': 'x' * 500,
             'batalla': 'octavos', 't': 1759118400000},
            {'quien': '333', 'llave': '1', 'que': 'otro'}]
    fs = filas(cola, {'111': 'Hassan'})
    ok(len(fs) == 2, 'un reporte sin número no entra')
    ok(fs[0][:3] == ('Reporte', 'evento #370', 'El ganador está mal: la final la ganó Paria · #7'),
       'el de un evento, con su número y lo que dijo  %s' % (fs[0][:3],))
    ok(fs[0][3].startswith('Lo mandó Hassan, ') and 'ET' in fs[0][3], 'con quién lo mandó, por su nombre')
    ok(fs[1][1] == 'llave en vivo' and fs[1][3].startswith('Lo mandó una cuenta de Discord')
       and len(fs[1][2]) <= 400, 'el de una llave en vivo, sin el ID de quien lo mandó, y corto')
    ok(filas(cola, {}) == filas(cola, {}), 'la misma cola da las mismas filas: `anotar_varios` no repite')
    # 📣 lo decidido desde el Dashboard (13/10/2026)
    cola2 = cola + [{'id': 9, 'quien': '444', 'llave': '464', 'que': 'nombre', 'texto': 'soy yo', 't': 1759118400000,
                     'estado': 'corregir', 'fix': '{"tipo": "nombre", "n": "464", "nombre": "Agus", "reporta": true}'}]
    ok(len(filas(cola2, {})) == 2 and cerrados(cola2) == {'9'} and _fix(cola2[-1])['reporta'] is True,
       'lo que Dlx ya decidió no va a ✅ Decidir, y su fila se cierra')
    L = {'nombre': 'IDS V.2', 'sv': 'URBF', 'fecha': '12/10',
         'tabla': [['NC', 'Campeón', 3000], ['Agus', 'Campeón', 2500]],
         'rondas': [{'r': 'Cuartos', 'b': [[['Agus', 'Korey'], 'Agus', '']]},
                    {'r': 'Final', 'b': [[['Presagio, NC, Agus', 'Guess, Nemi'], 'Presagio, NC, Agus', '']]}]}
    ok(_nombres_de_llave(L)[:3] == ['NC', 'Agus', 'Korey'] and 'Presagio' in _nombres_de_llave(L),
       'los nombres de una llave: la tabla y cada parte de cada lado, una vez')
    n_ll = renombrar_llave(L, {'agus'}, 'AGUSTÍN51K')
    ok(n_ll == 5 and L['tabla'][1][0] == 'AGUSTÍN51K' and L['rondas'][1]['b'][0][0][0] == 'Presagio, NC, AGUSTÍN51K'
       and L['rondas'][0]['b'][0][1] == 'AGUSTÍN51K' and L['tabla'][0][0] == 'NC',
       'la llave de la página cambia el nombre en la tabla, en los lados (también en un equipo) y en el ganador')
    pc = {'agus': 'Agus', 'agustin': 'Agus', 'agustin51k': 'AGUSTÍN51K'}
    pad = [{'raw': 'AGUSTÍN51K', 'discord_id': '444'}]
    ok(destino({'reporta': True}, '444', pc, pad) == ('AGUSTÍN51K', None)
       and destino({'es': 'agustín51k'}, '1', pc, pad) == ('AGUSTÍN51K', None)
       and destino({'nuevo': 'Agustin 🇺🇾'}, '1', pc, pad) == ('Agustin UY', 'uy')
       and destino({'nuevo': 'Zeta'}, '1', pc, pad) == ('Zeta', ''),
       'a quién va: quien lo reportó o uno de la Lista, por su nombre de la Lista; uno nuevo, con un nombre que no '
       'sea el alias de otro («Agustin 🇺🇾» → «Agustin UY»)')
    try:
        destino({'reporta': True}, '999', pc, pad)
        ok(False, 'quien reportó sin estar en la Lista tiene que fallar')
    except ValueError:
        ok(True, 'quien reportó sin estar en la Lista: no se inventa')
    dec = {}
    Lg = {'nombre': 'COPA', 'sv': 'ACAD', 'fecha': '03/10',
          'rondas': [{'r': 'Final', 'b': [[['Zetryko', 'Abyssus'], 'Zetryko', '']]}]}
    g1 = corregir_ganador({'id': 3}, {'n': '401', 'ronda': 'Final', 'lados': ['Zetryko', 'Abyssus'], 'ganador': 'Zetryko'},
                          Lg, dec, 1000)
    g2 = corregir_ganador({'id': 5}, {'n': '401', 'ronda': 'Final', 'lados': ['Abyssus', 'Zetryko'], 'ganador': 'Abyssus'},
                          Lg, dec, 1000)
    g3 = corregir_ganador({'id': 5}, {'n': '401', 'ronda': 'Final', 'lados': ['Abyssus', 'Zetryko'], 'ganador': 'Abyssus'},
                          Lg, dec, 1000 + (ESPERA_GANADOR_MIN + 1) * 60000)
    ok(g1[0] == 'aplicado' and g2 == (None, '') and len(dec['ganador']['COPA · ACAD · 03/10 · final']) == 1
       and dec['ganador']['COPA · ACAD · 03/10 · final'][0]['ganador'] == 'Abyssus' and g3[0] == 'no_pude',
       'el ganador: si la llave ya lo dice, está; si no, queda la regla para el lector, y si no aparece a tiempo, la '
       'llave es vieja y se dice  %s' % ([g1, g2, g3],))
    try:
        import pendientes as P
        ok('Reporte' in P.TIPOS, '«Reporte» es un tipo de `Pendientes`')
    except Exception as e:                               # noqa: BLE001
        ok(False, 'no pude leer pendientes.TIPOS (%s)' % str(e)[:40])
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    if '--corregir' in sys.argv:
        print('\n══ 📣 LO QUE DLX CORRIGIÓ DESDE EL DASHBOARD ══\n')
        cola = leer()
        if cola is None:
            print('   ⚠️ no pude leer la cola de KV: nada que corregir')
            return 0
        k = corregir(cola, aplicar='--aplicar' in sys.argv)
        if k:
            print('   ✅ %d aplicada(s)' % k)
        return 0
    print('\n══ 📣 LOS REPORTES DE LA PÁGINA, A ✅ DECIDIR ══\n')
    cola = leer()
    if cola is None:
        print('   ⚠️ no pude leer la cola de KV: sigo sin reportes')
        return 0
    fs = filas(cola, _nombres())
    print('   %d reporte(s) en la cola' % len(fs))
    for _t, o, d, m in fs[-8:]:
        print('      %-14s %s  (%s)' % (o[:14], d[:90], m[:40]))
    if '--aplicar' not in sys.argv or not fs:
        if fs:
            print('\n   (simulacro: no escribí nada — corré con --aplicar)\n')
        return 0
    import pendientes as P
    k = P.anotar_varios(fs)
    print('   ✅ %d nuevo(s) en `Pendientes` (%d ya estaban)' % (k, len(fs) - k))
    return 0


if __name__ == '__main__':
    sys.exit(main())

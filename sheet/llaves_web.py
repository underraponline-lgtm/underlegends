# -*- coding: utf-8 -*-
"""LAS LLAVES, GUARDADAS PARA EL HUB: el botón «Ver llaves» de «Lo que pasó».

    python sheet/llaves_web.py          las que hay guardadas
    python sheet/llaves_web.py --auto   el self-check

Dlx, 25/09/2026: *«en lo que pasó quizás tener un registro de las llaves
en el website también? … un botón de ver llaves de evento y vemos ahí la
info y las llaves de forma detallada»*.

🔴 LA LLAVE NO QUEDABA GUARDADA EN NINGÚN LADO. `procesar_entrada` la lee
de `Entrada`, la reparte en `Resultados` y `1v1`, y `--limpiar` vacía la
hoja. Lo único que sobrevivía era la copia cruda del día
(`datos/entrada_*.json`), que no dice qué número le tocó a cada evento ni
dónde se publicó. Por eso se guarda acá, **después** de que la escritura
quedó, y con los nombres que ya resolvió el motor: los mismos de la tabla.

⚠️ SE FUSIONA POR NÚMERO, NO SE REESCRIBE. El ciclo relee las llaves que
Discord sigue mostrando. El día que una vieja se caiga de esa ventana, su
registro no puede irse con ella.

⚠️ EL ANUNCIO Y LA LLAVE NO COMPARTEN NINGUNA CLAVE. «Lo que pasó» sale
de los anuncios (`datos/anuncios.json`) y la llave es otro mensaje, en
otro canal, publicado horas después y a veces con otro nombre: el mismo
evento se anunció como «CARABOBO NUNCA SE RINDE VOL.1» y su llave dice
«CARABOBO NO SE RINDE VOL.1». `cruzar()` los junta por servidor, fecha y
nombre, y **los números del nombre tienen que coincidir**: «TOKYO VOL 11»
y «TOKYO VOL 12» se parecen un 95 %, y son dos eventos distintos.

⚠️ SI NO ESTÁ SEGURO, NO CUELGA NADA. Un botón que abre la llave de otro
evento es peor que no tener botón: *sin dato no hay pieza*.

⚠️ VIAJA DENTRO DEL LOBBY Y NO EN UNA CLAVE PROPIA DE KV. Son las llaves
de «Lo que pasó» —seis como mucho, ~12 KB— y el lobby ya se escribe sólo
cuando cambia. Una clave aparte gastaría escrituras de una cuota de 1.000
por día que se agotó el 24/09/2026, y pediría otra ruta en el Worker.
"""
import datetime
import difflib
import io
import json
import os
import sys
import unicodedata

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)

ARCHIVO = os.path.join(BASE, 'datos', 'llaves_t1.json')
LINKS = os.path.join(BASE, 'datos', 'llaves_links.json')

#: de la primera ronda a la final. Lo que no está acá va antes, en el
#: orden en que llegó (una clasificatoria, una preliminar).
ORDEN = ['r64', 'r32', 'octavos', 'cuartos', 'semifinal', 'tercer puesto',
         'final']

#: cómo se lee cada ronda en la página, sea como sea que la escribió la llave
ETIQUETA = {
    'filtros': 'Filtros', 'dieciseisavos': 'Dieciseisavos',
    'r32': 'Dieciseisavos', 'octavos': 'Octavos', 'cuartos': 'Cuartos',
    'cuartos de final': 'Cuartos', 'semifinal': 'Semifinales',
    'semifinales': 'Semifinales', 'tercer puesto': 'Tercer puesto',
    'tercer lugar': 'Tercer puesto', 'final': 'Final', 'gran final': 'Final',
}

#: cuánto tiene que parecerse el nombre del anuncio al de la llave, cuando
#: no son iguales. CARABOBO NUNCA/NO da 0.889.
PARECIDO = 0.8

#: la llave se publica el mismo día del anuncio o hasta dos después
#: (un evento de las 11 PM termina pasada la medianoche)
DIAS = (-1, 2)


def limpio(nombre):
    """El nombre sin el subrayado de Discord: `__ TOKYO __` es `TOKYO`."""
    return str(nombre or '').strip().strip('_*~ ').strip()


def clave_nombre(s):
    """Para comparar: minúsculas, sin tildes y sólo letras y números."""
    s = unicodedata.normalize('NFKD', str(s or '').lower())
    return ''.join(c for c in s if c.isalnum() and not unicodedata.combining(c))


def _digitos(s):
    return ''.join(c for c in s if c.isdigit())


def fecha_iso(fecha):
    """`'24/09'` -> `'2026-09-24'`. La llave no trae año: sale del
    arranque de la temporada, como en `rankings._orden_fecha()`."""
    try:
        dia, mes = [int(x) for x in str(fecha).strip().split('/')[:2]]
        from comun.temporada import INICIO
        anio0, mes0 = int(INICIO[:4]), int(INICIO[5:7])
        return datetime.date(anio0 + (1 if mes < mes0 else 0), mes, dia).isoformat()
    except (ValueError, ImportError):
        return ''


def _dia_este(cuando):
    """La fecha, en hora del este, de un instante ISO en UTC."""
    try:
        t = datetime.datetime.fromisoformat(str(cuando).replace('Z', '+00:00'))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    try:
        import zoneinfo
        et = zoneinfo.ZoneInfo('America/New_York')
    except Exception:                                    # noqa: BLE001
        et = datetime.timezone(datetime.timedelta(hours=-4))
    return t.astimezone(et).date()


def _bandas(nota):
    """`'triple (4 bandas, pasan 2)'` -> `(4, 2)`; sin bandas, `(0, 0)`."""
    s = str(nota or '').lower()
    if 'banda' not in s:
        return 0, 0
    nums, act = [], ''
    for c in s + ' ':
        if c.isdigit():
            act += c
        elif act:
            nums.append(int(act))
            act = ''
    n = nums[0] if nums else 0
    m = nums[1] if len(nums) > 1 and 'pasan' in s else 1
    return n, m


def armar(ev, links=()):
    """El registro de un evento ya procesado por el motor.

    Cada batalla es `[lados, ganador, nota]`.

    ⚠️ UNA BATALLA DE TRES O CUATRO BANDAS VUELVE A SER UNA. `Entrada`
    tiene dos lados, así que el lector la parte en una fila por cada uno
    que cae —con `triple (N bandas)` en la nota— y la llave la mostraba
    como tres duelos que nunca existieron. Se juntan las filas seguidas
    de esa ronda con el mismo que pasó y la misma nota, hasta completar
    las bandas que la nota dice.

    ⚠️ CUANDO PASAN DOS, AL SEGUNDO NO LO TRAE NINGUNA FILA: el lector
    anota sólo a quienes caen, contra uno de los que pasó (ver
    `llaves_a_entrada`). La línea sale con un lado menos y la nota dice
    cuántas bandas eran y cuántas pasaron: incompleta, pero no inventa.
    """
    import motor
    rondas, donde, orden = [], {}, {}
    for i, d in enumerate(ev.get('duelos') or ()):
        crudo = str(d.get('ronda') or '').strip()
        canon = motor.ronda_de(crudo)
        etq = ETIQUETA.get(motor.norm(crudo)) or crudo.capitalize() or '—'
        if etq not in donde:
            donde[etq] = len(rondas)
            rondas.append({'r': etq, 'b': []})
            orden[etq] = (ORDEN.index(canon) if canon in ORDEN else -1, i)
        a, b = d.get('a') or '', d.get('b') or ''
        g, nota = d.get('ganador') or '', str(d.get('notas') or '').strip()
        bs = rondas[donde[etq]]['b']
        n, m = _bandas(nota)
        ult = bs[-1] if bs else None
        if (n > 2 and ult and ult[0][0] == a and ult[1] == g and ult[2] == nota
                and len(ult[0]) < n - m + 1):
            ult[0].append(b)
            continue
        bs.append([[a, b], g, nota])
    rondas.sort(key=lambda r: orden[r['r']])
    res = sorted(ev.get('resultados') or (),
                 key=lambda r: (-int(r.get('puntos') or 0), str(r.get('rapero'))))
    return {
        'n': int(ev['num']),
        'nombre': limpio(ev.get('nombre')),
        'sv': ev.get('servidor') or '',
        'fecha': ev.get('fecha') or '',
        'dia': fecha_iso(ev.get('fecha')),
        'escala': ev.get('escala') or '',
        'participantes': int(ev.get('participantes') or 0),
        'rondas': rondas,
        'tabla': [[r.get('rapero') or '', r.get('posicion') or '',
                   int(r.get('puntos') or 0)] for r in res],
        'links': list(links or ()),
    }


def leer(archivo=ARCHIVO):
    try:
        with io.open(archivo, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def guardar(planes, archivo=ARCHIVO, links_archivo=LINKS):
    """Fusiona los eventos de esta corrida en `datos/llaves_t1.json`.

    Devuelve cuántos registros cambiaron. Si nada cambió no toca el
    archivo, así el ciclo no commitea lo mismo cada media hora.
    """
    links = leer(links_archivo)
    d = leer(archivo)
    antes = json.dumps(d, ensure_ascii=False, sort_keys=True)
    cambiaron = 0
    for ev in planes:
        k = '|'.join(str(ev.get(c) or '').strip()
                     for c in ('nombre', 'servidor', 'fecha'))
        viejo = d.get(str(ev['num'])) or {}
        # ⚠️ SI ESTA CORRIDA NO TRAJO LINKS SE CONSERVAN LOS DE ANTES: el
        # archivo de links lo deja el lector con `--aplicar`, y un
        # reproceso a mano sin él no puede borrarle el link a nadie.
        nuevo = armar(ev, links.get(k) or viejo.get('links') or ())
        if nuevo != viejo:
            cambiaron += 1
        d[str(ev['num'])] = nuevo
    if json.dumps(d, ensure_ascii=False, sort_keys=True) != antes:
        with io.open(archivo, 'w', encoding='utf-8', newline='') as f:
            json.dump(d, f, ensure_ascii=False, indent=1, sort_keys=True)
            f.write(chr(10))
    return cambiaron


def cruzar(pasados, regs):
    """Cuelga `llave: n` de cada anuncio de «Lo que pasó» que tenga su
    llave, y devuelve `{n: registro}` con las que colgó.

    Ver el encabezado: mismo servidor, la llave entre un día antes y dos
    después del anuncio, y el nombre igual —o parecido y con los mismos
    números—. Con un empate no se elige.
    """
    out = {}
    for p in pasados:
        p.pop('llave', None)
        dia = _dia_este(p.get('cuando'))
        a = clave_nombre(p.get('nombre'))
        if not dia or not a:
            continue
        cands = []
        for n, r in (regs or {}).items():
            if (r.get('sv') or '') != (p.get('sv') or ''):
                continue
            try:
                rd = datetime.date.fromisoformat(r.get('dia') or '')
            except ValueError:
                continue
            dd = (rd - dia).days
            if not DIAS[0] <= dd <= DIAS[1]:
                continue
            b = clave_nombre(r.get('nombre'))
            if not b:
                continue
            if a == b:
                puntaje = 2.0
            elif _digitos(a) != _digitos(b):
                continue
            else:
                puntaje = difflib.SequenceMatcher(None, a, b).ratio()
            if puntaje >= PARECIDO:
                cands.append((puntaje, -abs(dd), str(n)))
        if not cands:
            continue
        cands.sort(reverse=True)
        if len(cands) > 1 and cands[0][:2] == cands[1][:2]:
            continue
        n = cands[0][2]
        p['llave'] = int(n)
        out[n] = regs[n]
    return out


def _self_check():
    import tempfile
    print('')
    print('  llaves_web.py — self-check')
    print('')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    ev = {'num': 360, 'nombre': '__ PRUEBA VOL.2 __', 'servidor': 'FFA',
          'fecha': '24/09', 'escala': '8-15', 'participantes': 9,
          'duelos': [
              {'ronda': 'FINAL', 'a': 'Ana', 'b': 'Bea', 'ganador': 'Ana', 'notas': ''},
              {'ronda': 'octavos', 'a': 'Ana', 'b': 'Ceci', 'ganador': 'Ana', 'notas': ''},
              {'ronda': 'SEMIFINALES', 'a': 'Ana', 'b': 'Dani', 'ganador': 'Ana', 'notas': ''},
              {'ronda': 'filtros', 'a': 'Eva', 'b': 'Fede', 'ganador': 'Eva',
               'notas': 'triple (3 bandas)'},
              {'ronda': 'filtros', 'a': 'Eva', 'b': 'Gus', 'ganador': 'Eva',
               'notas': 'triple (3 bandas)'},
              {'ronda': 'filtros', 'a': 'Eva', 'b': 'Kim', 'ganador': 'Eva',
               'notas': 'triple (3 bandas)'},
              {'ronda': 'octavos', 'a': 'Hugo', 'b': 'Ivan', 'ganador': 'Hugo',
               'notas': 'triple (4 bandas, pasan 2)'},
              {'ronda': 'octavos', 'a': 'Hugo', 'b': 'Juan', 'ganador': 'Hugo',
               'notas': 'triple (4 bandas, pasan 2)'},
              {'ronda': 'semifinales', 'a': 'Bea', 'b': 'Eva', 'ganador': 'Bea', 'notas': ''},
          ],
          'resultados': [
              {'rapero': 'Bea', 'puntos': 7000, 'posicion': 'Subcampeón'},
              {'rapero': 'Ana', 'puntos': 10000, 'posicion': 'Campeón'},
          ]}
    r = armar(ev, ['https://discord.com/channels/1/2/3'])
    ok([x['r'] for x in r['rondas']] == ['Filtros', 'Octavos', 'Semifinales', 'Final'],
       'las rondas, de la primera a la final  %s' % [x['r'] for x in r['rondas']])
    ok(len(r['rondas'][2]['b']) == 2,
       'las dos semis juntas aunque una diga SEMIFINALES y otra semifinales')
    ok(r['rondas'][0]['b'][0][2] == 'triple (3 bandas)', 'la nota de la batalla viaja')
    ok(r['rondas'][0]['b'][0][0] == ['Eva', 'Fede', 'Gus'] and len(r['rondas'][0]['b']) == 2,
       'la de 3 bandas vuelve a ser una batalla  %s' % r['rondas'][0]['b'])
    ok(r['rondas'][1]['b'][1][0] == ['Hugo', 'Ivan', 'Juan'],
       'la de 4 donde pasan 2: el que pasó y los dos que cayeron  %s'
       % r['rondas'][1]['b'][1][0])
    ok(_bandas('triple (4 bandas, pasan 2)') == (4, 2) and _bandas('') == (0, 0),
       'lee las bandas de la nota')
    ok(r['nombre'] == 'PRUEBA VOL.2', 'el nombre sin el subrayado de Discord')
    ok(r['tabla'][0][:2] == ['Ana', 'Campeón'], 'la tabla, de más puntos a menos')
    ok(r['dia'] == '2026-09-24', 'la fecha con año  (%s)' % r['dia'])

    tmp = tempfile.mkdtemp()
    arch = os.path.join(tmp, 'llaves.json')
    lks = os.path.join(tmp, 'links.json')
    with io.open(arch, 'w', encoding='utf-8') as f:
        json.dump({'100': {'n': 100, 'nombre': 'VIEJA', 'links': ['x']}}, f)
    with io.open(lks, 'w', encoding='utf-8') as f:
        json.dump({'__ PRUEBA VOL.2 __|FFA|24/09': ['https://discord.com/channels/1/2/9']}, f)
    ok(guardar([ev], arch, lks) == 1, 'guarda el evento nuevo')
    g = leer(arch)
    ok('100' in g, 'y no se lleva puesta la vieja: se fusiona por número')
    ok(g['360']['links'] == ['https://discord.com/channels/1/2/9'],
       'el link sale del archivo del lector, por nombre|servidor|fecha')
    t0 = os.path.getmtime(arch)
    os.remove(lks)
    ok(guardar([ev], arch, lks) == 0 and os.path.getmtime(arch) == t0,
       'sin cambios no reescribe, y sin archivo de links conserva el que había')
    ok(leer(arch)['360']['links'] == ['https://discord.com/channels/1/2/9'],
       'el link sigue ahí')

    regs = {
        '351': {'n': 351, 'nombre': 'DESGRACIAS EN TOKYO VOL 11', 'sv': 'FFA', 'dia': '2026-09-23'},
        '355': {'n': 355, 'nombre': 'DESGRACIAS EN TOKYO VOL.12', 'sv': 'FFA', 'dia': '2026-09-23'},
        '354': {'n': 354, 'nombre': 'CARABOBO NO SE RINDE VOL.1', 'sv': 'FFA', 'dia': '2026-09-24'},
        '353': {'n': 353, 'nombre': 'ELRAP FECHA 6', 'sv': 'FFA', 'dia': '2026-09-24'},
        '352': {'n': 352, 'nombre': 'DESGRACIAS CON TöKĪØ V.1', 'sv': 'FFA', 'dia': '2026-09-23'},
    }
    pas = [
        {'nombre': 'ELRAP FECHA 6', 'sv': 'FFA', 'cuando': '2026-09-24T04:11:39'},
        {'nombre': 'CARABOBO NUNCA SE RINDE VOL.1', 'sv': 'FFA', 'cuando': '2026-09-24T02:20:21'},
        {'nombre': 'DESGRACIAS CON TöKĪØ V.1', 'sv': 'FFA', 'cuando': '2026-09-23T22:44:12'},
        {'nombre': 'DESGRACIAS EN TOKYO VOL 12', 'sv': 'FFA', 'cuando': '2026-09-23T21:28:50'},
        {'nombre': 'DESGRACIAS EN TOKYO VOL 11', 'sv': 'FFA', 'cuando': '2026-09-23T19:29:54'},
        {'nombre': 'el que diga 7 parrafos', 'sv': 'FFA', 'cuando': '2026-09-23T03:13:45'},
        {'nombre': 'ELRAP FECHA 6', 'sv': 'SR', 'cuando': '2026-09-24T04:11:39'},
        {'nombre': 'DESGRACIAS EN TOKYO VOL 12', 'sv': 'FFA', 'cuando': '2026-09-28T21:28:50'},
    ]
    col = cruzar(pas, regs)
    ok([p.get('llave') for p in pas] == [353, 354, 352, 355, 351, None, None, None],
       'los anuncios del 23 y 24/09, cada uno con su llave  %s'
       % [p.get('llave') for p in pas])
    ok(sorted(col) == ['351', '352', '353', '354', '355'], 'y devuelve esas cinco')
    ok(pas[1]['llave'] == 354, 'CARABOBO NUNCA ↔ CARABOBO NO: parecido y mismos números')
    ok(pas[4]['llave'] == 351, 'TOKYO VOL 11 no se lleva la VOL 12 (se parecen un 95 %)')
    ok(pas[6].get('llave') is None, 'otro servidor no engancha')
    ok(pas[7].get('llave') is None, 'cinco días después no engancha')
    dos = {'1': {'nombre': 'FLEIVA FREE', 'sv': 'SR', 'dia': '2026-09-24'},
           '2': {'nombre': 'FLEIVA FREE', 'sv': 'SR', 'dia': '2026-09-24'}}
    q = [{'nombre': 'FLEIVA FREE', 'sv': 'SR', 'cuando': '2026-09-24T20:00:00'}]
    cruzar(q, dos)
    ok(q[0].get('llave') is None, 'con un empate no elige')

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
    d = leer()
    print('')
    print('   %d llave(s) guardada(s) en datos/llaves_t1.json' % len(d))
    for n in sorted(d, key=int):
        r = d[n]
        print('   #%-4s %-34s %-4s %-6s %2d ronda(s) · %d link(s)'
              % (n, r.get('nombre', '')[:34], r.get('sv', ''), r.get('fecha', ''),
                 len(r.get('rondas') or ()), len(r.get('links') or ())))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)

# -*- coding: utf-8 -*-
"""EL AVISO DE CADA EVENTO, PARA LA LIGA: un embed con su nivel de intensidad.

    python bot/aviso_evento.py --al-dia     edita los avisos de las últimas horas con lo que cambió
    python bot/aviso_evento.py --ver <n> [poco|normal|todo]   imprime el embed de ese evento, sin mandar nada
    python bot/aviso_evento.py --auto       el self-check, sin red

🔑 Dlx, 07/10/2026: *«los mensajes del bot cuando hay un evento pueden ser mejores… un embed mostrando la tarjeta
diciendo que se actualizará en breve… un resumen… un ranking al finalizar con los cambios»*, y a las ideas, *«dale, me
gusta, pero eso de los botones todavía no»*, *«para la liga global, pero añade nivel de intensidad»*.

Va al canal de siempre (`avisar.CANAL`, «LIGA GLOBAL» en DRA) y cuánto dice lo elige Dlx en el Dashboard
(`avisos_nivel` en los ajustes del objeto, como el bot en vivo):

    poco    «Lo justo»   el evento, el campeón y cuántos jugaron
    normal  «Normal»     además el podio con sus puntos y la tarjeta del campeón
    todo    «Todo»       además lo que cambió: quién subió en el ranking, quién debutó, las insignias, los rangos
                         y la sorpresa de la noche

⚠️ SE MANDA UNA VEZ Y DESPUÉS SE EDITA (`avisar.mandar(editar=…)`): Discord no notifica una edición. El aviso sale en
cuanto se carga el evento, cuando el ranking todavía no se rehízo; en la misma corrida, después del ranking, las
insignias y Publicaciones, `al_dia()` le agrega lo que cambió; y cuando el ciclo redibuja la tarjeta del campeón, la
imagen nueva (su sello va en la URL, así Discord no muestra la vieja de su caché).

⚠️ «ANTES» SE GUARDA AL CARGAR: el puesto de cada uno en el ranking de Temporada en ese momento. Después del rearmado
ya no hay forma de saberlo, y «subió 5 puestos» necesita los dos.

⚠️ SIN LO TÉCNICO: las filas del Sheet y lo que espera en `Pendientes` son para Dlx, y ya están en ✅ Decidir. Este
mensaje es para la Liga.
"""
import datetime as dt
import hashlib
import io
import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet'), BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

WEB = 'https://underlegends.pages.dev'
#: los niveles, en el orden en que suman cosas. El nombre es el que ve Dlx en el Dashboard (`NIVELES_AVISO` de avisos.js)
NIVELES = {'poco': 'Lo justo', 'normal': 'Normal', 'todo': 'Todo'}
NIVEL_DEFECTO = 'normal'
#: cuántas horas después de cargado un evento se sigue poniendo al día su aviso
HORAS_AL_DIA = 18
#: cuántos renglones como mucho en cada parte de «lo que cambió»
TOPE = 5
#: la sorpresa: el que ganó estaba al menos estos puestos más abajo que el que perdió
SORPRESA_MIN = 5
MEDALLA = {'Campeón': '🥇', 'Subcampeón': '🥈', 'Tercero': '🥉'}
MESES = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre',
         'noviembre', 'diciembre')


def _json(*ruta):
    try:
        with io.open(os.path.join(BASE, *ruta), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def limpio(s):
    """`__ TOKYO __` -> `TOKYO`: como lo muestra la página (`llaves_web.limpio()`)."""
    return str(s or '').strip().strip('_*~ ').strip()


def miles(n):
    try:
        return '{:,}'.format(int(round(float(n)))).replace(',', '.')
    except (TypeError, ValueError):
        return str(n)


def _fecha(f):
    """`07/10` -> `7 de octubre`."""
    m = re.match(r'^(\d{1,2})/(\d{1,2})', str(f or ''))
    if not m or not 1 <= int(m.group(2)) <= 12:
        return str(f or '')
    return '%d de %s' % (int(m.group(1)), MESES[int(m.group(2)) - 1])


def _color(sv):
    col = ((_json('datos', 'colores_sv_marca.json') or {}).get('usar') or {}).get(sv) or '#E41373'
    try:
        return int(col.lstrip('#')[:6], 16)
    except ValueError:
        return 0xE41373


def _servidor(sv):
    """`(nombre, logo)` de un servidor: el nombre de `datos/servidores.json` y el logo que sirve la página."""
    x = ((_json('datos', 'servidores.json') or {}).get('servidores') or {}).get(sv) or {}
    logo = ''
    if os.path.exists(os.path.join(BASE, 'bot', 'paginas', 'logos', sv.lower() + '.webp')):
        logo = '%s/logos/%s.webp' % (WEB, sv.lower())
    return x.get('nombre') or sv, logo


def nivel():
    """El nivel que eligió Dlx en el Dashboard (`avisos_nivel`), o `NIVEL_DEFECTO` si no eligió o no se pudo leer."""
    try:
        import multiplicadores as MU
        aj = MU.ajustes_dueno() or {}
    except Exception:                                    # noqa: BLE001
        aj = {}
    v = aj.get('avisos_nivel')
    return v if v in NIVELES else NIVEL_DEFECTO


# ── lo que se guarda al cargar ──────────────────────────────────────────

def _pool():
    return {p['raw']: p for p in (_json('datos', 'temporada_pool.json') or []) if p.get('raw')}


def _sellos():
    return (_json('datos', 'cartas_selladas.json') or {}).get('cartas') or {}


def registro(ev, ahora=None):
    """Lo que el aviso necesita de un plan de `procesar_entrada` (`num`, `nombre`, `servidor`, `fecha`,
    `participantes`, `resultados`, `duelos`), más el ANTES: el puesto de cada uno en el ranking y el sello de la
    tarjeta del campeón en este momento. Se guarda en `datos/avisados.json`."""
    pool, sellos = _pool(), _sellos()
    res = ev.get('resultados') or []
    gente = sorted({r['rapero'] for r in res if r.get('rapero')})
    camp = [r['rapero'] for r in res if r.get('posicion') == 'Campeón']
    return {
        'v': 2, 't': (ahora or dt.datetime.now(dt.timezone.utc)).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'num': ev.get('num'), 'nombre': ev.get('nombre') or '', 'sv': ev.get('servidor') or '',
        'fecha': ev.get('fecha') or '', 'participantes': ev.get('participantes') or len(gente),
        'tabla': [[r['rapero'], r.get('posicion') or '', r.get('puntos') or 0] for r in res],
        'duelos': [[d.get('a') or '', d.get('b') or '', d.get('ganador') or ''] for d in ev.get('duelos') or []
                   if d.get('a') and d.get('b')],
        # el puesto oficial (`pos`, sólo de los miembros), el orden por mérito entre todos (`o`) y si está fuera de
        # concurso (`fc`): ver `_puesto()`
        'antes': {q: [pool[q].get('pos'), pool[q].get('o'), bool(pool[q].get('fc'))] for q in gente if q in pool},
        'ev_antes': {q: pool[q].get('ev') or 0 for q in gente if q in pool},
        'sello': {q: (sellos.get(q) or {}).get('temporada') or '' for q in camp},
    }


# ── el embed ────────────────────────────────────────────────────────────

def _puesto(x):
    """`(pos, o)` de lo guardado en `antes` o de una fila del pool. ⚠️ `pos` ES EL PUESTO OFICIAL Y SÓLO DE LOS
    MIEMBROS (`construir_pool_temporada`, «fuera de concurso»): quien no es miembro lleva uno después de todos que la
    página muestra como «—». Para él no hay «subió 5 puestos»; para la sorpresa vale `o`, el orden entre todos."""
    if isinstance(x, list):
        return (None if x[2] else x[0]), x[1]
    x = x or {}
    return (None if x.get('fc') else x.get('pos')), x.get('o')


def _cambios(reg, pool, insignias, muro):
    """Lo que cambió para la gente de este evento: `{ranking, debut, insignias, rangos, sorpresa}`, listas de
    renglones. Sólo lo que pasó DESPUÉS de cargar el evento (`reg['t']`)."""
    gente = [x[0] for x in reg.get('tabla') or []]
    antes = reg.get('antes') or {}
    out = {'ranking': [], 'debut': [], 'insignias': [], 'rangos': [], 'sorpresa': []}
    sube = []
    for q in gente:
        a = _puesto(antes.get(q))[0] if q in antes else None
        d = _puesto(pool.get(q))[0]
        if not d:
            continue
        if a and a > d:
            sube.append((a - d, d, '**%s** #%d → **#%d** (▲%d)' % (q, a, d, a - d)))
        elif not a:
            sube.append((0, d, '**%s** entra en el **#%d**' % (q, d)))
    out['ranking'] = [x[2] for x in sorted(sube, key=lambda x: (-x[0], x[1]))[:TOPE]]
    ev0 = reg.get('ev_antes') or {}
    out['debut'] = [q for q in gente if not ev0.get(q) and (pool.get(q) or {}).get('ev') == 1]
    try:
        import insignias as INS
        cat = {c[0]: (c[1], c[2]) for c in INS.CATALOGO}
    except Exception:                                    # noqa: BLE001
        cat = {}
    t0 = reg.get('t') or ''
    for q in gente:
        for b, v in sorted(((insignias or {}).get(q) or {}).items()):
            if v and str(v[0]) >= t0 and b != 'debut' and b in cat:
                out['insignias'].append('%s **%s** · %s' % (cat[b][0], q, cat[b][1]))
    for x in muro or []:
        if x.get('tipo') == 'rango' and str(x.get('t') or '') >= t0 and x.get('rg'):
            for q in x.get('quien') or []:
                if q in gente:
                    out['rangos'].append('**%s** sube a **%s**' % (q, x['rg']))
    mejor = None
    for a, b, g in reg.get('duelos') or []:
        if g not in (a, b):
            continue
        p = b if g == a else a
        pg, pp = (_puesto(antes[g])[1] if g in antes else None), (_puesto(antes[p])[1] if p in antes else None)
        if pg and pp and pg - pp >= SORPRESA_MIN and (mejor is None or pg - pp > mejor[0]):
            # se compara por mérito, pero se MUESTRA el puesto oficial —el mismo que el renglón del ranking—, y nada
            # a quien no lo tiene: dos números distintos para la misma persona en el mismo mensaje no se entienden
            def _q(x):
                n = _puesto(antes[x])[0]
                return '**%s** (#%d)' % (x, n) if n else '**%s**' % x
            mejor = (pg - pp, '%s le ganó a %s' % (_q(g), _q(p)))
    if mejor:
        out['sorpresa'] = [mejor[1]]
    out['insignias'] = out['insignias'][:TOPE]
    return out


def armar(reg, niv, pool=None, insignias=None, muro=None, sellos=None, cartas=None):
    """El embed de un evento con ese nivel. Sin red: todo lo que necesita se le pasa (o sale de `datos/`)."""
    niv = niv if niv in NIVELES else NIVEL_DEFECTO
    pool = _pool() if pool is None else pool
    sellos = _sellos() if sellos is None else sellos
    sv = reg.get('sv') or ''
    nom_sv, logo = _servidor(sv)
    nombre = limpio(reg.get('nombre')) or 'Evento'
    tabla = reg.get('tabla') or []
    camp = [x for x in tabla if x[1] == 'Campeón']
    cuantos = reg.get('participantes') or len(tabla)
    pie = '%s · %s · %s raperos' % (nom_sv, _fecha(reg.get('fecha')), cuantos)
    if camp:
        # el nombre del evento ya es el título: acá, sólo quién ganó
        desc = ['🏆 %s: **%s**' % ('Campeones' if len(camp) > 1 else 'Campeón', '** y **'.join(x[0] for x in camp))]
    else:
        desc = ['🎤 Terminó sin campeón en la llave']
    if niv != 'poco':
        desc.append('')
        for puesto in ('Campeón', 'Subcampeón', 'Tercero'):
            xs = [x for x in tabla if x[1] == puesto]
            if xs:
                desc.append('%s %s · %s pts' % (MEDALLA[puesto], ', '.join('**%s**' % x[0] if puesto == 'Campeón'
                                                                            else x[0] for x in xs), miles(xs[0][2])))
    desc += ['', pie]
    e = {'title': nombre[:256], 'url': '%s/freestyle-rap/llave/%s' % (WEB, reg.get('num')),
         'description': '\n'.join(desc)[:4000], 'color': _color(sv),
         'author': {'name': ('%s · Liga Global' % nom_sv)[:256]},
         'footer': {'text': 'Evento #%s' % reg.get('num')}}
    if reg.get('t'):
        e['timestamp'] = reg['t']
    if logo:
        e['author']['icon_url'] = logo
        if niv == 'poco':
            e['thumbnail'] = {'url': logo}
    # la tarjeta del campeón: la de Temporada, con su sello en la URL para que Discord no muestre la de su caché
    if niv != 'poco' and len(camp) == 1:
        q = camp[0][0]
        cartas = (_json('datos', 'cartas_r2.json') or {}) if cartas is None else cartas
        from comun.claves import clave
        url = ((cartas.get(clave(q)) or {}).get('temporada') or '')
        if url:
            s = (sellos.get(q) or {}).get('temporada') or ''
            e['image'] = {'url': url + ('?v=' + hashlib.sha256(s.encode('utf-8')).hexdigest()[:10] if s else '')}
            if s and s == (reg.get('sello') or {}).get(q):
                e['footer']['text'] += ' · la tarjeta de %s se actualiza en unos minutos' % q
    if niv == 'todo':
        c = _cambios(reg, pool, insignias if insignias is not None else
                     ((_json('datos', 'insignias.json') or {}).get('insignias') or {}),
                     muro if muro is not None else ((_json('datos', 'muro.json') or {}).get('cambios') or []))
        campos = [('📈 En el ranking de Temporada', c['ranking']), ('⭐ Rangos', c['rangos']),
                  ('🎖️ Insignias nuevas', c['insignias']), ('💥 La sorpresa', c['sorpresa'])]
        if c['debut']:
            campos.insert(1, ('🎤 Debut', [', '.join('**%s**' % q for q in c['debut'][:8])
                                          + (' y %d más' % (len(c['debut']) - 8) if len(c['debut']) > 8 else '')]))
        e['fields'] = [{'name': n, 'value': '\n'.join(v)[:1024], 'inline': False} for n, v in campos if v]
        if not e['fields'] and not reg.get('al_dia'):
            e['footer']['text'] += ' · lo que cambió llega en unos minutos'
    return e


def firma(e):
    return hashlib.sha256(json.dumps(e, sort_keys=True, ensure_ascii=False).encode('utf-8')).hexdigest()[:16]


# ── poner al día los de las últimas horas ───────────────────────────────

def al_dia(aplicar=False, ahora=None):
    """Edita el aviso de cada evento de las últimas `HORAS_AL_DIA` horas si lo que diría cambió. Devuelve cuántos."""
    import avisar as AV
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    ya = AV._avisados()
    recientes = {}
    for n, x in ya.items():
        try:
            t = dt.datetime.strptime(x.get('t') or '', '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt.timezone.utc)
        except ValueError:
            continue
        if x.get('v') == 2 and x.get('msg') and (ahora - t).total_seconds() < HORAS_AL_DIA * 3600:
            recientes[n] = x
    if not recientes:
        print('   nada que poner al día')
        return 0
    niv = nivel()
    pool, sellos = _pool(), _sellos()
    hechos = 0
    for n, x in sorted(recientes.items()):
        x['al_dia'] = True
        e = armar(x, niv, pool=pool, sellos=sellos)
        f = firma(e)
        if f == x.get('firma'):
            continue
        print('   #%s %s: %s' % (n, limpio(x.get('nombre')), 'se edita' if aplicar else 'se editaría'))
        if not aplicar:
            continue
        if AV.mandar(None, None, embed=e, editar=x['msg']):
            x['firma'] = f
            hechos += 1
    if aplicar and hechos:
        AV._guardar(ya)
    return hechos


# ── self-check ──────────────────────────────────────────────────────────

def _self_check():
    print('\n  aviso_evento.py — self-check\n')
    mal = [0]

    def ok(c, que, extra=''):
        print('   %s %s%s' % ('✅' if c else '🔴', que, ('  ' + extra) if extra and not c else ''))
        mal[0] += not c

    reg = {'v': 2, 't': '2026-10-07T11:40:00Z', 'num': 419, 'nombre': '__ MAÑANA DE LLUVIA VOL 1 __', 'sv': 'FFA',
           'fecha': '07/10', 'participantes': 8,
           'tabla': [['Provenza', 'Campeón', 7500], ['Jupiter', 'Subcampeón', 5000], ['Rayo', 'Tercero', 4000],
                     ['Aldre', 'Cuarto', 3000], ['Fuera', 'Cuartos', 2000]],
           'duelos': [['Jupiter', 'Majiztral', 'Jupiter'], ['Rayo', 'Jupiter', 'Rayo'], ['Provenza', 'Jupiter', 'Provenza']],
           'antes': {'Provenza': [20, 20, False], 'Jupiter': [12, 12, False], 'Rayo': [40, 40, False],
                     'Fuera': [150, 30, True]}, 'ev_antes': {'Provenza': 16, 'Jupiter': 4, 'Rayo': 1},
           'sello': {'Provenza': 'aaa'}}
    pool = {'Fuera': {'pos': 140, 'o': 20, 'fc': True, 'ev': 3}, 'Provenza': {'pos': 9, 'ev': 17}, 'Jupiter': {'pos': 11, 'ev': 5}, 'Rayo': {'pos': 30, 'ev': 2},
            'Aldre': {'pos': 200, 'ev': 1}}
    ins = {'Rayo': {'podio': ['2026-10-07T12:00:00Z', 'prueba'], 'debut': ['2026-10-07T12:00:00Z', 'prueba']},
           'Jupiter': {'podio': ['2026-10-01T00:00:00Z', 'prueba']}}
    muro = [{'tipo': 'rango', 't': '2026-10-07T12:00:00Z', 'quien': ['Provenza'], 'rg': 'C'},
            {'tipo': 'rango', 't': '2026-10-06T12:00:00Z', 'quien': ['Jupiter'], 'rg': 'D'}]
    cartas = {'provenza': {'temporada': 'https://r2/provenza/temporada.webp'}}
    e = {n: armar(reg, n, pool=pool, insignias=ins, muro=muro, sellos={'Provenza': {'temporada': 'aaa'}},
                  cartas=cartas) for n in NIVELES}
    ok(e['poco']['title'] == 'MAÑANA DE LLUVIA VOL 1', 'el título sin los __ de Discord', e['poco']['title'])
    ok('Provenza' in e['poco']['description'] and '🥈' not in e['poco']['description'] and 'image' not in e['poco'],
       '«lo justo»: el campeón, sin podio ni tarjeta')
    ok('🥈 Jupiter · 5.000 pts' in e['normal']['description'] and e['normal'].get('image'),
       '«normal»: el podio con sus puntos y la tarjeta del campeón')
    ok('se actualiza en unos minutos' in e['normal']['footer']['text'],
       'con el mismo sello que al cargar, dice que la tarjeta se actualiza')
    e2 = armar(reg, 'normal', pool=pool, sellos={'Provenza': {'temporada': 'bbb'}}, cartas=cartas)
    ok('se actualiza' not in e2['footer']['text'] and e2['image']['url'] != e['normal']['image']['url'],
       'redibujada, la URL cambia (Discord no muestra la vieja) y el pie ya no lo dice')
    f = {x['name']: x['value'] for x in e['todo'].get('fields') or []}
    ok('**Provenza** #20 → **#9** (▲11)' in f.get('📈 En el ranking de Temporada', ''), '«todo»: quién subió y cuánto',
       json.dumps(f, ensure_ascii=False))
    ok('**Aldre** entra en el **#200**' in f.get('📈 En el ranking de Temporada', ''), 'y quien entra al ranking')
    ok('Fuera' not in f.get('📈 En el ranking de Temporada', ''),
       'quien está fuera de concurso no «sube puestos»: su número no es oficial')
    ok(f.get('🎤 Debut') == '**Aldre**', 'el debut: quien no tenía eventos y ahora tiene uno', f.get('🎤 Debut'))
    ok('Al podio' in f.get('🎖️ Insignias nuevas', '') and 'Jupiter' not in f.get('🎖️ Insignias nuevas', '')
       and 'Debut' not in f.get('🎖️ Insignias nuevas', ''),
       'sólo las insignias ganadas después de cargar, y sin la de debut (ya tiene su renglón)')
    ok(f.get('⭐ Rangos') == '**Provenza** sube a **C**', 'los rangos de después, no los de antes')
    ok(f.get('💥 La sorpresa') == '**Rayo** (#40) le ganó a **Jupiter** (#12)',
       'la sorpresa: el de más abajo que le ganó al de más arriba', f.get('💥 La sorpresa'))
    ok(firma(e['todo']) == firma(armar(reg, 'todo', pool=pool, insignias=ins, muro=muro,
                                       sellos={'Provenza': {'temporada': 'aaa'}}, cartas=cartas)),
       'la misma cosa da la misma firma: no se edita de gusto')
    ok(armar(reg, 'xx', pool=pool, cartas=cartas)['description'] == e['normal']['description'],
       'un nivel que no existe es «normal»')
    print('\n  %s\n' % ('todo ok' if not mal[0] else '🔴 %d problema(s)' % mal[0]))
    return 1 if mal[0] else 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass
    if '--auto' in sys.argv:
        return _self_check()
    if '--al-dia' in sys.argv:
        print('\n══ los avisos de los eventos, al día ══\n')
        n = al_dia(aplicar='--aplicar' in sys.argv)
        print('   %d editado(s)' % n)
        return 0
    if '--ver' in sys.argv:
        i = sys.argv.index('--ver')
        n = sys.argv[i + 1]
        niv = sys.argv[i + 2] if len(sys.argv) > i + 2 else NIVEL_DEFECTO
        import avisar as AV
        x = AV._avisados().get(n)
        if not x or x.get('v') != 2:
            print('el #%s no tiene un aviso nuevo guardado' % n)
            return 1
        print(json.dumps(armar(x, niv), ensure_ascii=False, indent=1))
        return 0
    print(__doc__.strip().splitlines()[0])
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)

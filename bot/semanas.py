# -*- coding: utf-8 -*-
"""📊 LAS SEMANAS DE LA LIGA, PARA COMPARARLAS (Dashboard → Números → «Comparar semanas»).

    python bot/semanas.py            cómo van las semanas, sin escribir nada
    python bot/semanas.py --aplicar  y lo deja en datos/semanas.json (el ciclo, paso 2b8e)
    python bot/semanas.py --auto     el self-check, sin red ni archivos

Dlx, 18/10/2026: *«mejoremos la página de dashboard números, para tener la opción de comparar actividad, gente y
mejoras de gente o peores, para comparar con otras semanas»*.

QUÉ GUARDA, POR SEMANA (de lunes a domingo, en hora del este, desde la de la T1)
  · LA ACTIVIDAD: eventos jugados, participaciones, batallas y raperos distintos, por servidor y día por día —el día
    a día es lo que deja comparar «a igual día» una semana que va por la mitad—.
  · LA GENTE: quién debutó, quién volvió después de faltar una semana o más, y quién jugó la anterior y ésta no.
  · EL RANKING DE TEMPORADA AL EMPEZAR la semana (`fotos`: `{nombre: [puesto, puntos]}`) y el de ahora: con dos fotos
    seguidas sale quién subió, quién bajó y quién sumó más en esa semana. La foto de una semana nueva es la ÚLTIMA de la
    anterior (`ultima`), no la primera corrida del lunes: esa ya trae lo que se jugó el lunes.

⚠️ NO VA EL USO DE LA PÁGINA NI DEL BOT: eso lo cuenta el objeto (`usoSemanas()` en bot/avisos.js) y sólo lo ve el
Dashboard. Este archivo va al repo público, y todo lo que trae ya es público: las llaves y el ranking.

De dónde sale: `datos/llaves_t1.json` (los eventos jugados) y `datos/temporada_pool.json` (el ranking).
"""
import datetime as dt
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
SALIDA = os.path.join(BASE, 'datos', 'semanas.json')
#: el lunes de la semana en que arrancó la T1 (22/09/2026)
INICIO = '2026-09-21'


def lunes_de(dia):
    d = dt.date.fromisoformat(str(dia)[:10])
    return str(d - dt.timedelta(days=d.weekday()))


def hoy_et(ahora=None):
    import zoneinfo
    return (ahora or dt.datetime.now(dt.timezone.utc)).astimezone(zoneinfo.ZoneInfo('America/New_York')).date()


def foto_de(pool):
    """`{nombre: [puesto, puntos]}` del ranking de Temporada (quien juega fuera de concurso no tiene puesto: va 0)."""
    out = {}
    for p in pool or []:
        if p.get('raw'):
            pos = p.get('pos')
            out[p['raw']] = [int(pos) if str(pos or '').isdigit() else 0, int(p.get('pts') or 0)]
    return out


def semanas(llaves, hasta):
    """Las semanas desde `INICIO` hasta la de `hasta` (una fecha): `[{lunes, completa, eventos, part, batallas,
    raperos, sv: {sigla: [eventos, raperos]}, dias: [[día, eventos, part, [nombres]]], debut, regreso, fuera,
    volvieron}]`. `fuera` son los que jugaron la semana anterior y ésta no (de una semana que va por la mitad, todavía
    no se sabe: va vacío)."""
    por_semana = {}
    for v in (llaves or {}).values():
        dia = v.get('dia')
        if not dia or dia < INICIO:
            continue
        por_semana.setdefault(lunes_de(dia), []).append(v)
    out, vistos, antes = [], set(), set()
    lun = dt.date.fromisoformat(INICIO)
    fin = dt.date.fromisoformat(lunes_de(hasta))
    while lun <= fin:
        ls = str(lun)
        evs = por_semana.get(ls) or []
        dias, sv, gente, part, bat = {}, {}, set(), 0, 0
        for v in sorted(evs, key=lambda x: (x.get('dia') or '', str(x.get('n') or ''))):
            nombres = {f[0] for f in v.get('tabla') or [] if f and f[0]}
            d = dias.setdefault(v['dia'], [0, 0, set()])
            d[0] += 1
            d[1] += len(nombres)
            d[2] |= nombres
            s = sv.setdefault(v.get('sv') or '?', [0, set()])
            s[0] += 1
            s[1] |= nombres
            gente |= nombres
            part += len(nombres)
            bat += sum(len(r.get('b') or []) for r in v.get('rondas') or [])
        completa = lun + dt.timedelta(days=7) <= hasta
        volvieron = gente & vistos
        out.append({
            'lunes': ls, 'completa': completa, 'eventos': len(evs), 'part': part, 'batallas': bat, 'raperos': len(gente),
            'sv': {k: [x[0], len(x[1])] for k, x in sorted(sv.items())},
            'dias': [[k, x[0], x[1], sorted(x[2])] for k, x in sorted(dias.items())],
            'debut': sorted(gente - vistos), 'volvieron': len(volvieron),
            # 🔁 los que vuelven después de faltar: jugaron alguna vez, pero no la semana anterior
            'regreso': sorted(volvieron - antes),
            'fuera': sorted(antes - gente) if completa else [],
        })
        vistos |= gente
        antes = gente
        lun += dt.timedelta(days=7)
    return out


def fotos_al_dia(viejas, ultima, pool, lunes_hoy):
    """Las fotos del ranking: la de cada lunes y la de ahora. La de un lunes nuevo es la última foto de la semana
    anterior (`ultima`), si la hay; si no, la de ahora."""
    fotos = dict(viejas or {})
    ahora = foto_de(pool)
    if lunes_hoy not in fotos and lunes_hoy > INICIO:
        u = ultima or {}
        fotos[lunes_hoy] = u['foto'] if u.get('foto') and str(u.get('lunes') or '') < lunes_hoy else ahora
    return fotos, {'lunes': lunes_hoy, 'foto': ahora}


def correr(aplicar=False, ahora=None):
    def j(*p):
        try:
            with io.open(os.path.join(BASE, *p), encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return None
    hoy = hoy_et(ahora)
    viejo = j('datos', 'semanas.json') or {}
    pool = j('datos', 'temporada_pool.json') or []
    fotos, ultima = fotos_al_dia(viejo.get('fotos'), viejo.get('ultima'), pool, lunes_de(hoy))
    out = {
        '_leeme': 'Las semanas de la Liga, para compararlas en el Dashboard (Números → Comparar semanas): la actividad, '
                  'la gente y el ranking de Temporada al empezar cada semana (`fotos`, {nombre: [puesto, puntos]}) y '
                  'ahora (`ultima`). Lo escribe bot/semanas.py (paso 2b8e) desde llaves_t1.json y temporada_pool.json.',
        't': (ahora or dt.datetime.now(dt.timezone.utc)).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'semanas': semanas(j('datos', 'llaves_t1.json') or {}, hoy),
        'fotos': fotos, 'ultima': ultima,
    }
    if aplicar:
        with io.open(SALIDA, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
    return out


# ── self-check ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _self_check():
    print('\n══ LAS SEMANAS ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + extra) if extra and not c else ''))

    tabla = lambda *ns: [[n, 'x', 1] for n in ns]  # noqa: E731
    ll = {
        '1': {'dia': '2026-09-22', 'sv': 'FFA', 'tabla': tabla('Ana', 'Bea'), 'rondas': [{'b': [1, 2]}]},
        '2': {'dia': '2026-09-24', 'sv': 'SR', 'tabla': tabla('Ana', 'Cid'), 'rondas': [{'b': [1]}]},
        '3': {'dia': '2026-09-29', 'sv': 'FFA', 'tabla': tabla('Bea', 'Dan'), 'rondas': [{'b': [1]}]},
        '4': {'dia': '2026-10-07', 'sv': 'FFA', 'tabla': tabla('Ana', 'Eva'), 'rondas': []},
        '0': {'dia': '2026-09-10', 'sv': 'FFA', 'tabla': tabla('Viejo'), 'rondas': []},
    }
    ss = semanas(ll, dt.date(2026, 10, 8))
    ok([s['lunes'] for s in ss] == ['2026-09-21', '2026-09-28', '2026-10-05'], 'una por lunes desde la T1 (lo de antes, no)')
    a, b, c = ss
    ok((a['eventos'], a['part'], a['raperos'], a['batallas'], a['sv']) == (2, 4, 3, 3, {'FFA': [1, 2], 'SR': [1, 2]}),
       'la actividad: eventos, participaciones, raperos distintos, batallas y por servidor', str(a))
    ok(a['debut'] == ['Ana', 'Bea', 'Cid'] and b['debut'] == ['Dan'] and b['volvieron'] == 1 and b['fuera'] == ['Ana', 'Cid'],
       'la gente: quién debutó, cuántos ya habían jugado, y quién jugó la anterior y ésta no', str(b))
    ok(c['regreso'] == ['Ana'] and not c['completa'] and c['fuera'] == [],
       'vuelve quien faltó una semana (Ana); de una semana sin terminar, «se fueron» todavía no se sabe', str(c))
    ok(a['dias'][0] == ['2026-09-22', 1, 2, ['Ana', 'Bea']], 'el día a día, para comparar a igual día', str(a['dias']))
    pool = [{'raw': 'Ana', 'pos': '1', 'pts': 900}, {'raw': 'Fu', 'pos': '', 'pts': 50}]
    f, u = fotos_al_dia({}, {'lunes': '2026-09-28', 'foto': {'Ana': [2, 400]}}, pool, '2026-10-05')
    ok(f == {'2026-10-05': {'Ana': [2, 400]}} and u == {'lunes': '2026-10-05', 'foto': {'Ana': [1, 900], 'Fu': [0, 50]}},
       'la foto de un lunes nuevo es la última de la semana anterior, no la de ahora (que ya trae el lunes)', str((f, u)))
    f2, _ = fotos_al_dia(f, u, pool, '2026-10-05')
    ok(f2 == f, 'en la misma semana, la foto del lunes no se toca')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal == 0


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 0 if _self_check() else 1
    r = correr(aplicar='--aplicar' in sys.argv)
    print('\n══ LAS SEMANAS ══\n')
    for s in r['semanas']:
        print('   %s%s  %3d eventos · %3d raperos · %3d debutan · %3d se fueron' % (
            s['lunes'], '' if s['completa'] else ' (en curso)', s['eventos'], s['raperos'], len(s['debut']), len(s['fuera'])))
    print('   fotos del ranking: %s' % ', '.join(sorted(r['fotos'])))
    print('   %s' % ('-> datos/semanas.json' if '--aplicar' in sys.argv else '(simulacro: no escribí nada — `--aplicar`)'))
    return 0


if __name__ == '__main__':
    sys.exit(main())

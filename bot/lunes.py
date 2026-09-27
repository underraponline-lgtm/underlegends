# -*- coding: utf-8 -*-
"""EL LUNES DE LA LIGA: un solo mensaje en DRA con todo lo de la semana, que se edita.

    python bot/lunes.py --ver            el mensaje de ahora, sin mandar nada
    python bot/lunes.py --ver --lunes    el del lunes que viene (simula su sorteo)
    python bot/lunes.py --publicar       lo manda o lo edita (necesita `CANAL`)
    python bot/lunes.py --auto           el self-check

Dlx, 27/09/2026, a las ideas para enganchar: *«me gustan todas»* — entre
ellas, *«Lunes de la Liga: un solo mensaje en DRA que el bot edita toda la
semana, con el MW, los multiplicadores, la guerra y la meta; el domingo se
completa con los premios»*.

⚠️ UN MENSAJE POR SEMANA, Y SE EDITA: Discord no notifica una edición, así
que el Most Wanted de cada día, la barra de la meta y el dorado que se jugó
lo ponen al día sin volver a sonar (la regla de `bot/avisar.py`).

🔴 NO SE PUBLICA SOLO HASTA QUE DLX DIGA EL CANAL: mandar a un canal de DRA
es hablar en nombre de la Liga. `CANAL` está en `None` a propósito.
"""
import datetime as dt
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

#: el canal de DRA donde va. ⚠️ Lo elige Dlx: hasta entonces, no se manda
CANAL = None
#: dónde queda anotado qué mensaje es el de esta semana
ESTADO = os.path.join(BASE, 'datos', 'lunes.json')
PAGINA = 'https://underlegends.pages.dev'
AMBAR = 0xF0B232


def _x(v):
    return ('×%g' % v).replace('.', ',')


def _mil(n):
    return '{:,}'.format(int(n)).replace(',', '.')


def armar(d=None, ahora=None, mw=None):
    """`(título, [renglones])` del mensaje de la semana que contiene a `ahora`."""
    import multiplicadores as MU
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    d = MU.leer() if d is None else d
    s = MU.actual(d, ahora)
    if not s:
        return None, []
    et = MU._et()
    ini, fin = MU._de_iso(s['inicio']).astimezone(et), MU._de_iso(s['fin']).astimezone(et)
    nombre_dia = ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')
    ls = []
    pr = s.get('premios') or {}
    ls.append('**⚡ Multiplicadores** — ' + ' · '.join(
        '%s %s%s' % (sv, _x(x), ' (%s)' % ' + '.join(pr[sv]) if pr.get(sv) else '')
        for sv, x in sorted(s['sv'].items(), key=lambda kv: -kv[1])))
    if s.get('dorado'):
        dd = s['dorado']
        if dd.get('n'):
            ls.append('**🌟 Evento dorado** — fue **%s** (%s): valió ×3' % (dd.get('nombre') or '#%s' % dd['n'],
                                                                           dd['sv']))
        else:
            dia = MU._de_iso(dd['desde']).astimezone(et)
            ls.append('**🌟 Evento dorado** — el primer evento de **%s** desde el %s %d vale ×3'
                      % (dd['sv'], nombre_dia[dia.weekday()], dia.day))
    if s.get('guerra'):
        ls.append('**⚔️ Guerra de servidores** — %s · gana el que más puntos hace por persona y lleva ×1,5 '
                  'la semana que viene' % ' · '.join('%s vs %s' % tuple(p) for p in s['guerra']['pares']))
    if s.get('copa'):
        c = s['copa']
        ls.append('**🏆 Copa de la Liga** — ' + ('fue **%s**, de %s' % (c.get('nombre') or '#%s' % c['n'], c['org'])
                                                if c.get('n') else 'el próximo evento que organice **%s** vale ×2'
                                                % c['org']))
    if s.get('metas'):
        va = s.get('meta_va') or {}
        ls.append('**🎯 Meta de comunidad** — ' + ' · '.join(
            '%s %d/%d%s' % (sv, va.get(sv, 0), m, ' ✅' if va.get(sv, 0) >= m else '')
            for sv, m in sorted(s['metas'].items(), key=lambda kv: -kv[1]))
            + ' · si la juntan, +10 % para todos los que jugaron')
    try:
        import most_wanted as MW
        m = mw if mw is not None else MW.leer()
        bs = ((m.get('actual') or {}).get('buscados') or [])
        if bs:
            ls.append('**💀 Most Wanted de hoy** — ' + ' · '.join(
                '%s (%s, %s)' % (b['n'], b.get('cn') or '', _mil(b.get('valor') or 0)) for b in bs))
    except Exception:                                    # noqa: BLE001
        pass
    ids = [x.get('id') for x in d.get('semanas') or []]
    if s['id'] in ids and ids.index(s['id']) > 0:
        ps = (d['semanas'][ids.index(s['id']) - 1].get('premios_semana') or {})
        pp = []
        if ps.get('figura'):
            pp.append('figura **%s** (%s pts)' % (ps['figura'][0], _mil(ps['figura'][1])))
        if ps.get('revelacion'):
            pp.append('revelación **%s**' % ps['revelacion'][0])
        if ps.get('cazador'):
            pp.append('cazador **%s**' % ps['cazador'][0])
        if ps.get('servidor'):
            pp.append('servidor **%s** (%d raperos)' % tuple(ps['servidor']))
        if pp:
            ls.append('**🏅 La semana pasada** — ' + ' · '.join(pp))
    h = fin.hour
    hora = 'la medianoche' if h == 0 else 'las %d %s' % (h if h <= 12 else h - 12, 'AM' if h < 12 else 'PM')
    ls.append('Todo vale para la Temporada; el Competitivo no cambia. Hasta el %s %d a %s (hora del este).'
              % (nombre_dia[fin.weekday()], fin.day, hora))
    ls.append('👉 ' + PAGINA)
    return '🗓️ Lunes de la Liga · semana del %d/%d' % (ini.day, ini.month), ls


def publicar(ahora=None):
    """Lo manda (una vez por semana) o edita el de la semana. `True` si salió."""
    if not CANAL:
        print('   🔴 falta el canal: lo elige Dlx (ver `CANAL`)')
        return False
    import avisar as AV
    import multiplicadores as MU
    titulo, ls = armar(ahora=ahora)
    if not titulo:
        return False
    s = MU.actual()
    try:
        with io.open(ESTADO, encoding='utf-8') as f:
            est = json.load(f) or {}
    except (OSError, ValueError):
        est = {}
    editar = est.get('msg_id') if est.get('semana') == s['id'] else None
    r = AV.mandar(titulo, ls, color=AMBAR, canal=CANAL, editar=editar)
    if r and r is not True:
        est = {'semana': s['id'], 'msg_id': r}
        with io.open(ESTADO, 'w', encoding='utf-8') as f:
            json.dump(est, f, ensure_ascii=False, indent=1)
    return bool(r)


def _self_check():
    print('\n══ LUNES DE LA LIGA ══\n')
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', que))

    import multiplicadores as MU
    et = MU._et()
    en = lambda m, dd, h: dt.datetime(2026, m, dd, h, tzinfo=et)
    d = {'semanas': [
        {'id': 'a', 'inicio': MU._iso(en(10, 5, 0)), 'fin': MU._iso(en(10, 12, 11)), 'sv': {'FFA': 1},
         'premios_semana': {'figura': ['Ana', 12000], 'servidor': ['FFA', 40]}},
        {'id': 'b', 'inicio': MU._iso(en(10, 12, 11)), 'fin': MU._iso(en(10, 19, 11)),
         'sv': {'FFA': 1.5, 'SR': 5, 'URBF': 0.5}, 'premios': {'SR': ['guerra']},
         'dorado': {'sv': 'SR', 'desde': MU._iso(en(10, 15, 0))},
         'guerra': {'pares': [['FFA', 'SR']]}, 'copa': {'org': 'nachonc_', 'clave': 'nachonc'},
         'metas': {'FFA': 40, 'SR': 20}, 'meta_va': {'FFA': 41, 'SR': 3}}]}
    t, ls = armar(d, en(10, 13, 12), mw={'actual': {'buscados': [{'n': 'Zeta', 'cn': 'El Rey', 'valor': 12000}]}})
    todo = '\n'.join(ls)
    ok(t == '🗓️ Lunes de la Liga · semana del 12/10', 'el título, con la semana  %s' % t)
    ok('SR ×5 (guerra) · FFA ×1,5 · URBF ×0,5' in todo, 'los multiplicadores, del más alto al más bajo, con el premio')
    ok('el primer evento de **SR** desde el jueves 15 vale ×3' in todo and 'FFA vs SR' in todo
       and 'organice **nachonc_**' in todo, 'el dorado con su día, la guerra y la Copa')
    ok('FFA 41/40 ✅ · SR 3/20' in todo and 'Zeta (El Rey, 12.000)' in todo,
       'la meta con su marca y el Most Wanted del día')
    ok('figura **Ana** (12.000 pts)' in todo and 'Hasta el lunes 19 a las 11 AM' in todo,
       'los premios de la semana pasada y hasta cuándo')
    _t, ls2 = armar({'semanas': [dict(d['semanas'][1], fin=MU._iso(en(10, 19, 0)))]}, en(10, 13, 12), mw={})
    ok('Hasta el lunes 19 a la medianoche' in '\n'.join(ls2), 'una semana que termina a las 00:00 dice «medianoche»')
    ok(len(todo) < 4000, 'entra en un embed (%d caracteres)' % len(todo))
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    if '--publicar' in a:
        return 0 if publicar() else 1
    import multiplicadores as MU
    d, ahora = None, None
    if '--lunes' in a:
        # el del lunes que viene: se simula su sorteo, sin escribir nada
        ahora = MU._lunes(dt.datetime.now(dt.timezone.utc)) + dt.timedelta(days=7, minutes=22)
        d = MU.correr(ahora=ahora, d=json.loads(json.dumps(MU.leer())), eventos=MU.eventos_de(),
                      vistos=MU.leer_vistos(), rivales=MU.leer_rivales())
    t, ls = armar(d, ahora)
    print('\n' + (t or '(no hay semana sorteada)'))
    for l in ls:
        print('   ' + l)
    print()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

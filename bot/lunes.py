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

🔑 EL CANAL LO ELIGIÓ DLX, 27/09/2026: *«en el canal ranking global en
DRA»* — «〢🌍〉rankings-liga-global», en la categoría LIGA GLOBAL. Mandar a
un canal de DRA es hablar en nombre de la Liga: no se cambia sin preguntar.

⚠️ SÓLO DESDE LA PRIMERA SEMANA CON REGLAS (`multiplicadores.DESDE`): la
semana de un día del domingo 27 no tiene dorado, guerra ni metas.

⚠️ Y SE EDITA SÓLO SI CAMBIÓ: el ciclo corre cada media hora, y editar lo
mismo 48 veces por día no dice nada nuevo.
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

#: «〢🌍〉rankings-liga-global» de DRA (Dlx, 27/09/2026). El bot es admin ahí.
CANAL = '1498326749748924416'
#: dónde queda anotado qué mensaje es el de esta semana
ESTADO = os.path.join(BASE, 'datos', 'lunes.json')
PAGINA = 'https://underlegends.pages.dev'
AMBAR = 0xF0B232


def _x(v):
    return ('×%g' % v).replace('.', ',')


def _mil(n):
    return '{:,}'.format(int(n)).replace(',', '.')


def debutantes(semana, vistos=None, pool=None):
    """Quién jugó por primera vez en su vida en esa semana, con su nombre.

    La primera vez sale de `datos/vistos.json` (la misma que el Semillero) y
    el nombre, del pool de Temporada; si no está, la clave.
    """
    import multiplicadores as MU
    vistos = MU.leer_vistos() if vistos is None else vistos
    if pool is None:
        try:
            with io.open(os.path.join(BASE, 'datos', 'temporada_pool.json'), encoding='utf-8') as f:
                pool = json.load(f) or []
        except (OSError, ValueError):
            pool = []
    nombre = {}
    for x in pool:
        k = MU._clave_persona(x.get('raw') or '')
        if k:
            nombre.setdefault(k, x.get('raw'))
    ini, fin = MU._de_iso(semana['inicio']), MU._de_iso(semana['fin'])
    # ⚠️ POR LOS ALIAS DE HOY: «nacioenmilan» debutó como nombre, pero es
    # Deuxs, que ya había jugado. Vale la primera vez de la PERSONA.
    primera = {}
    for k, (iso, _sv) in vistos.items():
        if not iso:
            continue
        c = MU._clave_persona(k) or k
        if c not in primera or iso < primera[c]:
            primera[c] = iso
    return sorted((nombre.get(c) or c for c, iso in primera.items()
                   if ini <= MU._de_iso(iso) < fin), key=lambda s: s.lower())


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
    if s.get('votado'):
        v = s['votado']
        ls.append('**🗳️ Lo votó la gente** — %s sale con ×2 como mínimo (%d de %d votos)'
                  % (v['sv'], v['votos'], v['de']))
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
        # 🌱 LOS DEBUTANTES DE LA SEMANA PASADA. Dlx, 28/09/2026, a «los
        # debutantes de la semana en el Lunes de la Liga»: *«B»* (de «B y C»).
        # El 42 % de la Liga jugó una sola vez: nombrar a quien se estrena es
        # lo más barato que hay para que vuelva. «Debutar» es lo mismo que
        # cuenta el Semillero: jugar por primera vez en la vida en la Liga
        # (`datos/vistos.json`), no «nuevo en la temporada».
        deb = debutantes(d['semanas'][ids.index(s['id']) - 1])
        if deb:
            ls.append('**🌱 Debutaron la semana pasada** — %s%s. ¡Bienvenidos!' % (
                ', '.join('**%s**' % x for x in deb[:12]),
                ' y %d más' % (len(deb) - 12) if len(deb) > 12 else ''))
    # 🔑 LAS ENCUESTAS DE LA PÁGINA (bot/encuestas.py): el ×2 de la que viene se
    # vota toda la semana, y El Elegido de cada Most Wanted antes de que salga
    ls.append('**🗳️ Votá en la página** — qué servidor se lleva el ×2 la semana que viene y quién es '
              'El Elegido del Most Wanted')
    h = fin.hour
    hora = 'la medianoche' if h == 0 else 'las %d %s' % (h if h <= 12 else h - 12, 'AM' if h < 12 else 'PM')
    ls.append('Todo vale para la Temporada; el Competitivo no cambia. Hasta el %s %d a %s (hora del este).'
              % (nombre_dia[fin.weekday()], fin.day, hora))
    ls.append('👉 ' + PAGINA)
    return '🗓️ Lunes de la Liga · semana del %d/%d' % (ini.day, ini.month), ls


def publicar(ahora=None, d=None, mw=None, estado=None, mandar=None):
    """Lo manda (una vez por semana) o edita el de la semana, si cambió.

    Devuelve `'nuevo'`, `'editado'`, `'igual'`, `'todavia'` (semana sin
    reglas) o `None` si no salió. Los parámetros son para el self-check.
    """
    import hashlib
    import multiplicadores as MU
    if not CANAL:
        print('   🔴 falta el canal (ver `CANAL`)')
        return None
    ahora = ahora or dt.datetime.now(dt.timezone.utc)
    d = MU.leer() if d is None else d
    s = MU.actual(d, ahora)
    if not s or MU._de_iso(s['inicio']) < MU._desde('semana'):
        return 'todavia'
    titulo, ls = armar(d, ahora, mw)
    if not titulo:
        return None
    firma = hashlib.sha1(('\n'.join([titulo] + ls)).encode('utf-8')).hexdigest()[:12]
    ruta = estado or ESTADO
    try:
        with io.open(ruta, encoding='utf-8') as f:
            est = json.load(f) or {}
    except (OSError, ValueError):
        est = {}
    misma = est.get('semana') == s['id'] and est.get('msg_id')
    if misma and est.get('firma') == firma:
        return 'igual'
    if mandar is None:
        import avisar as AV
        mandar = AV.mandar
    r = mandar(titulo, ls, color=AMBAR, canal=CANAL, editar=est.get('msg_id') if misma else None)
    if not r:
        return None
    # ⚠️ si el mensaje de la semana ya no estaba, `mandar` manda uno nuevo y
    # devuelve su id: se guarda el nuevo
    nuevo = r is not True
    est = {'semana': s['id'], 'msg_id': r if nuevo else est.get('msg_id'), 'firma': firma}
    with io.open(ruta, 'w', encoding='utf-8') as f:
        json.dump(est, f, ensure_ascii=False, indent=1)
    return 'nuevo' if nuevo and not misma else 'editado'


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
    # 🔑 las encuestas: lo que votó la gente, y la invitación a votar
    _t, ls3 = armar({'semanas': [dict(d['semanas'][1], votado={'sv': 'SR', 'votos': 12, 'de': 30})]},
                    en(10, 13, 12), mw={})
    ok('SR sale con ×2 como mínimo (12 de 30 votos)' in '\n'.join(ls3) and 'Votá en la página' in todo,
       'el ×2 que votó la gente, y la invitación a votar')
    # publicar: una vez por semana, y se edita sólo si cambió
    import tempfile
    ruta = os.path.join(tempfile.mkdtemp(), 'lunes.json')
    llamadas = []

    def falso(titulo, ls, color=None, canal=None, editar=None):
        llamadas.append(editar)
        return True if editar else 'msg1'
    mw1 = {'actual': {'buscados': [{'n': 'Zeta', 'cn': 'El Rey', 'valor': 12000}]}}
    mw2 = {'actual': {'buscados': [{'n': 'Hassan', 'cn': 'El Rey', 'valor': 12000}]}}
    r1 = publicar(en(10, 13, 12), d, mw1, ruta, falso)
    r2 = publicar(en(10, 13, 13), d, mw1, ruta, falso)
    r3 = publicar(en(10, 14, 12), d, mw2, ruta, falso)
    ok((r1, r2, r3) == ('nuevo', 'igual', 'editado') and llamadas == [None, 'msg1'],
       'la primera vez lo manda; igual, no lo toca; cuando cambia el Most Wanted, lo edita')
    dv = {'semanas': [{'id': 'v', 'inicio': MU._iso(en(9, 27, 12)), 'fin': MU._iso(en(9, 28, 11)), 'sv': {'FFA': 1}}]}
    ok(publicar(en(9, 27, 13), dv, {}, ruta, falso) == 'todavia',
       'la semana de un día del 27/09, antes de las reglas, no se publica')
    print('\n   %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    a = sys.argv[1:]
    if '--auto' in a:
        return 1 if _self_check() else 0
    if '--publicar' in a:
        r = publicar()
        print('\n   Lunes de la Liga: %s\n' % {'nuevo': '✅ mandado', 'editado': '✅ editado',
                                              'igual': '✓ igual, no lo toqué',
                                              'todavia': '· todavía no (arranca con la semana del lunes 28)',
                                              None: '🔴 no salió'}.get(r, r))
        return 0 if r else 1
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

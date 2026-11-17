# -*- coding: utf-8 -*-
"""🥚 LOS DRAGÓN DROPS POR GANAR: la tanda 1 del rework (17/11/2026).

    python bot/drops_merito.py          qué se daría hoy, sin mandar nada
    python bot/drops_merito.py --auto   self-check

Dlx, a los 12 lugares nuevos de dónde salen los drops, «Todas»; a la versión ajustada del informe «Economía de los
Puntos de Tienda», en tandas, «Sí, la tanda 1». La tanda 1 es lo que se GANA compitiendo:

    campeón de un evento        un Nido el primer título de la semana; un Dragón Drop los siguientes
    2.º y 3.º de un evento      un Dragón Drop
    campeón de una liga         la Funda del Campeón (cofre 3)
    invicto en una liga (5–0)   un Nido
    batacazo                    un Star Dragon (ganar con menos de `BATACAZO` de chance según el ELO)
    cazar a un Most Wanted      un Nido si lo cazaste solo; un Star a cada uno si lo cazaron en equipo
    sobrevivir siendo buscado   el Baúl de los objetos (cofre 2)

Medido sobre las 4 últimas semanas de la T1 (sólo gente de DRA): ~166.000 Puntos por semana con todas las tandas a
techo; ésta es la de mérito. Lo que se gana compitiendo no pasa por el tope suave de la semana (`esMerito()` en
bot/avisos.js). 🏆 Y los MES AWARDS de cada servidor (17/11/2026, «4: A»): un Nido al Rapero del mes y un Star a los demás,
desde noviembre (`de_mes_awards()`; el primer reparto, al cerrar el 4/12), y los de la gala de la temporada
(`de_gala()`: Tesoro, Funda y Baúl). ⏳ Falta: el Tesoro de la Superliga y la Clausura (al cierre de la T1).

🔑 SÓLO DESDE `DESDE`: lo de antes no se paga para atrás. Cada premio lleva su origen (`o`) como llave: el objeto no da
dos veces el mismo (`dropDar()`), así que mandar todo en cada vuelta es seguro.
🔑 SÓLO MIEMBROS DE DRA, como el Pase y el drop del día: el nombre de la llave se lleva a la cuenta por la Lista (y sus
AKAs) y la cuenta tiene que estar en `datos/verificados.json`.
Lo manda `pase.armar()` dentro del paquete del Pase (`drops`), y lo reparte `paseCiclo()` del objeto.
"""
import datetime as dt
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

#: desde qué día (hora del este) se paga
DESDE = dt.date(2026, 11, 17)
#: un batacazo: ganar con menos de esta chance según el ELO (medido: ~1,8 por semana en la T1)
BATACAZO = 0.30
#: cuántos días para atrás se mandan en cada vuelta (lo de antes ya se dio)
VENTANA_DIAS = 14


def _json(nombre, defecto=None):
    try:
        with io.open(os.path.join(BASE, 'datos', nombre), encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return defecto


def _dia(s):
    """'dd/mm' de las hojas → fecha. La temporada va de septiembre a enero."""
    d, m = str(s).split('/')[:2]
    m = int(m)
    return dt.date(2026 if m >= 9 else 2027, m, int(d))


def _iso(s):
    """'2026-11-17T…' → fecha, o None."""
    try:
        return dt.date.fromisoformat(str(s)[:10])
    except ValueError:
        return None


def _llave(x):
    """Un pedazo de origen: letras, números y _ (el objeto sólo acepta [\\w.:-])."""
    return re.sub(r'[^0-9A-Za-z_]', '', str(x))[:16] or 'x'


def quienes():
    """`nombre -> Discord ID` de los miembros de DRA: la Lista (por su nombre) y sus AKAs."""
    dra = set(str(x) for x in ((_json('verificados.json', {}) or {}).get('ids') or []))
    por_raw = {p.get('raw'): str(p.get('discord_id') or '') for p in (_json('padron.json', []) or []) if p.get('raw')}
    out = {n: i for n, i in por_raw.items() if i in dra}
    for alias, raw in ((_json('akas.json', {}) or {}).items()):
        if isinstance(raw, str) and raw in out and alias not in out:
            out[alias] = out[raw]
    return out


def _cabecera(filas, campo):
    for i, f in enumerate(filas[:30]):
        if campo in [str(c) for c in f]:
            return i, [str(c) for c in f]
    return None, []


def de_resultados(filas, Q, desde=DESDE):
    """Campeones y podios de los eventos desde `desde`. `filas`: la hoja Resultados (con cabecera)."""
    i, cab = _cabecera(filas, 'Rapero')
    if i is None:
        return []
    c = {k: cab.index(k) for k in ('Evento #', 'Fecha', 'Rapero', 'Posición') if k in cab}
    if len(c) < 4:
        return []
    filas = [f for f in filas[i + 1:] if len(f) > max(c.values()) and str(f[c['Fecha']]).count('/') >= 1]
    filas.sort(key=lambda f: (_dia(f[c['Fecha']]), int(str(f[c['Evento #']]) or 0)))
    out, ya = [], set()
    for f in filas:
        d, ev, n, pos = _dia(f[c['Fecha']]), str(f[c['Evento #']]), str(f[c['Rapero']]), str(f[c['Posición']])
        q = Q.get(n)
        if d < desde or not q:
            continue
        if pos == 'Campeón':
            semana = (q, d - dt.timedelta(days=d.weekday()))
            out.append({'q': q, 'o': 'camp:' + _llave(ev), 'k': 'drop' if semana in ya else 'nido', 'd': d.isoformat()})
            ya.add(semana)
        elif pos in ('Subcampeón', 'Tercero'):
            out.append({'q': q, 'o': 'pod:' + _llave(ev), 'k': 'drop', 'd': d.isoformat()})
    return out


def de_duelos(filas, Q, desde=DESDE, umbral=BATACAZO):
    """Los batacazos desde `desde`: el ELO se arma con TODOS los 1v1 en orden, y cuenta la chance de antes del cruce."""
    i, cab = _cabecera(filas, 'Ganador')
    if i is None:
        return []
    c = {k: cab.index(k) for k in ('Evento #', 'Fecha', 'Ganador', 'Perdedor') if k in cab}
    if len(c) < 4:
        return []
    filas = [f for f in filas[i + 1:] if len(f) > max(c.values()) and f[c['Ganador']] and f[c['Perdedor']]]
    filas.sort(key=lambda f: (int(str(f[c['Evento #']]) or 0)))
    elo, out = {}, []
    for f in filas:
        g, p = str(f[c['Ganador']]), str(f[c['Perdedor']])
        eg, ep = elo.get(g, 1000.0), elo.get(p, 1000.0)
        esp = 1 / (1 + 10 ** ((ep - eg) / 400))
        try:
            d = _dia(f[c['Fecha']])
        except (ValueError, IndexError):
            d = None
        if d and d >= desde and esp < umbral and Q.get(g):
            out.append({'q': Q[g], 'o': 'bat:%s:%s' % (_llave(f[c['Evento #']]), _llave(p)), 'k': 'star', 'd': d.isoformat()})
        k = 32 * (1 - esp)
        elo[g], elo[p] = eg + k, ep - k
    return out


def de_mw(mw, Q, desde=DESDE):
    """Most Wanted: cazar (solo un Nido; en equipo un Star a cada uno) y sobrevivir (el Baúl)."""
    out = []
    semanas = [h for h in (mw or {}).get('historial') or [] if h.get('tipo') == 'semana']
    if isinstance((mw or {}).get('actual'), dict) and mw['actual'].get('tipo') == 'semana':
        semanas.append(mw['actual'])
    for h in semanas:
        sid = _llave(h.get('id'))
        for b in h.get('buscados') or []:
            caza = b.get('caza') or {}
            if b.get('estado') == 'cazado' and (_iso(caza.get('t')) or dt.date.min) >= desde:
                por = [x.get('n') for x in caza.get('por') or [] if x.get('n')]
                for n in por:
                    if Q.get(n):
                        out.append({'q': Q[n], 'o': 'mw:%s:%s' % (sid, _llave(b.get('n'))), 'k': 'nido' if len(por) == 1 else 'star',
                                    'd': str(caza.get('t'))[:10]})
            if b.get('estado') in ('sobrevivio', 'sobrevivió') and (_iso(h.get('fin')) or dt.date.min) >= desde and Q.get(b.get('n')):
                out.append({'q': Q[b['n']], 'o': 'mwsob:' + sid, 'k': 'cofre:2', 'd': str(h.get('fin'))[:10]})
    return out


def de_ligas(salon, insignias, Q, desde=DESDE):
    """Ligas: cada título del Salón desde `desde` (la Funda) y el primer invicto desde `desde` (un Nido)."""
    out = []
    for x in salon or []:
        ult = _iso(x.get('ult'))
        if ult and ult >= desde and Q.get(x.get('c')):
            out.append({'q': Q[x['c']], 'o': 'liga:%s:%s' % (_llave(x.get('id')), ult.strftime('%Y%m%d')), 'k': 'cofre:3', 'd': ult.isoformat()})
    for n, v in (insignias or {}).items():
        inv = (v or {}).get('invicto') if isinstance(v, dict) else None
        d = _iso(inv[0]) if isinstance(inv, list) and inv else None
        if d and d >= desde and Q.get(n):
            out.append({'q': Q[n], 'o': 'inv:' + d.strftime('%Y%m%d'), 'k': 'nido', 'd': d.isoformat()})
    return out


def de_mes_awards(d, Q, desde_mes='2026-11'):
    """🏆 Los MES AWARDS de cada servidor (Dlx, 17/11/2026, a «¿los premios pasan a Dragón Drops?»: «A»): al cierre de cada
    mes, el Rapero del mes un Nido; la Revelación, la Batalla (a cada lado) y el Staff, un Star Dragon. En vez de sus Puntos
    de Tienda (`mes_awards._paga()` da 0 desde `SOLO_SV_DESDE`). Quién cobra sale de lo congelado al cierre (`premio`)."""
    out = []
    for mes, m in sorted(((d or {}).get('meses') or {}).items()):
        cerrado = _iso(m.get('cerrado'))
        if mes < desde_mes or not cerrado:
            continue
        for sv, x in sorted((m.get('sv') or {}).items()):
            for cat, c in sorted((x.get('cats') or {}).items()):
                for p in c.get('premio') or []:
                    q = p[0] if p else ''
                    if Q.get(q):
                        out.append({'q': Q[q], 'o': 'mes:%s:%s:%s' % (mes, sv, cat), 'k': 'nido' if cat == 'rapero' else 'star',
                                    'd': cerrado.isoformat()})
    return out


def de_gala(d, Q):
    """🏆 La gala de cada temporada (Dlx, 17/11/2026, «4: A»): el Rapero de la temporada, el Tesoro del Dragón (cofre 4); la
    Revelación y la Batalla (a cada lado), la Funda del Campeón (cofre 3); las de personas (Organizador, Duelista, Hincha…),
    el Baúl de los objetos (cofre 2). El Servidor y los grupos no cobran: no son personas, y su `premio` va vacío."""
    out = []
    for temp, g in sorted(((d or {}).get('galas') or {}).items()):
        cerrado = _iso(g.get('cerrado'))
        if not cerrado:
            continue
        for cat, c in sorted((g.get('cats') or {}).items()):
            k = 'cofre:4' if cat == 'rapero' else 'cofre:3' if cat in ('revelacion', 'batalla') else 'cofre:2'
            for p in c.get('premio') or []:
                q = p[0] if p else ''
                if Q.get(q):
                    out.append({'q': Q[q], 'o': 'gala:%s:%s' % (temp, cat), 'k': k, 'd': cerrado.isoformat()})
    return out


def _hoja(ES, hoja):
    """Las filas de `hoja` con su cabecera arriba: `fuente()` da sólo los datos, y la cabecera vive en su archivo (se busca,
    no se clava)."""
    doc = ES.leer(hoja) or {}
    return [list(doc.get('cabecera') or [])] + list(ES.fuente(hoja, lector='drops por ganar'))


def premios():
    """Todo lo que se ganó desde `DESDE`: `[{q, o, k}]`, sin repetidos y en orden. Nunca frena el Pase: si una fuente falla,
    esa vuelta no la manda (y la próxima, sí: nada se pierde)."""
    Q = quienes()
    out = []
    try:
        import espejo_t1 as ES
        out += de_resultados(_hoja(ES, 'Resultados'), Q)
        out += de_duelos(_hoja(ES, '1v1'), Q)
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ drops por ganar: los resultados no salen en esta vuelta: %s' % str(e)[:120])
    out += de_mw(_json('mw.json', {}), Q)
    try:
        import ligas as LG
        sl = LG.salon()
    except Exception as e:                               # noqa: BLE001
        print('   ⚠️ drops por ganar: el Salón de las ligas no sale en esta vuelta: %s' % str(e)[:120])
        sl = []
    out += de_ligas(sl, (_json('insignias.json', {}) or {}).get('insignias') or {}, Q)
    out += de_mes_awards(_json('mes_awards.json', {}) or {}, Q)
    out += de_gala(_json('mes_awards.json', {}) or {}, Q)
    # 📦 sólo lo de las últimas `VENTANA_DIAS`: lo de antes ya lo dio una vuelta anterior (el objeto no repite), y así el
    # paquete del Pase no crece con la temporada
    import zoneinfo
    hoy = dt.datetime.now(zoneinfo.ZoneInfo('America/New_York')).date()
    out = [x for x in out if str(x.get('d') or '') >= (hoy - dt.timedelta(days=VENTANA_DIAS)).isoformat()]
    vistos, limpio = set(), []
    for x in out:
        k = (x['q'], x['o'])
        if k not in vistos:
            vistos.add(k)
            limpio.append({'q': x['q'], 'o': x['o'], 'k': x['k']})
    return sorted(limpio, key=lambda x: (x['o'], x['q']))


def _self_check():
    print('\n══ LOS DRAGÓN DROPS POR GANAR ══\n')
    mal = 0

    def ok(c, q):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('✅' if c else '🔴', q))
    Q = {'Ana': '111111111111111111', 'Beto': '222222222222222222', 'Cami': '333333333333333333'}
    d0 = dt.date(2026, 11, 17)
    cab = ['Evento #', 'Fecha', 'Servidor', 'Escala', 'Rapero', 'País', 'Posición', 'Puntos']
    R = [['banner'], cab,
         [600, '16/11', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 3333],      # antes de DESDE: nada
         [601, '17/11', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 3333],
         [602, '18/11', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 3333],
         [603, '18/11', 'FFA', '16+', 'Beto', 'cl', 'Subcampeón', 2000],
         [604, '24/11', 'FFA', '16+', 'Ana', 'ar', 'Campeón', 3333],      # otra semana: otro Nido
         [605, '24/11', 'FFA', '16+', 'Zed', 'pe', 'Campeón', 3333]]      # no es de DRA
    r = de_resultados(R, Q, d0)
    ok([(x['o'], x['k']) for x in r if x['q'] == Q['Ana']] == [('camp:601', 'nido'), ('camp:602', 'drop'), ('camp:604', 'nido')]
       and [(x['o'], x['k']) for x in r if x['q'] == Q['Beto']] == [('pod:603', 'drop')] and len(r) == 4,
       'eventos: Nido el primer título de la semana, Drop los siguientes y el podio; nada antes de DESDE ni de quien no es de DRA')
    cab1 = ['Evento #', 'Fecha', 'Servidor', 'Ronda', 'Rapero A', 'Rapero B', 'Ganador', 'Perdedor']
    V = [cab1] + [[500 + i, '10/11', 'FFA', 'r', 'Cami', 'Beto', 'Cami', 'Beto'] for i in range(12)] + [[620, '19/11', 'FFA', 'f', 'Beto', 'Cami', 'Beto', 'Cami']]
    b = de_duelos(V, Q, d0)
    ok(len(b) == 1 and b[0]['q'] == Q['Beto'] and b[0]['k'] == 'star' and b[0]['o'] == 'bat:620:Cami',
       'batacazo: el que venía perdiendo siempre le gana al que venía ganando, y sólo cuenta desde DESDE')
    mw = {'historial': [{'id': '2026-11-16', 'tipo': 'semana', 'fin': '2026-11-23T16:00:00Z', 'buscados': [
        {'n': 'Cami', 'estado': 'cazado', 'caza': {'t': '2026-11-18T01:00:00Z', 'por': [{'n': 'Ana'}]}},
        {'n': 'Zed', 'estado': 'cazado', 'caza': {'t': '2026-11-19T01:00:00Z', 'por': [{'n': 'Ana'}, {'n': 'Beto'}]}},
        {'n': 'Beto', 'estado': 'sobrevivio'},
        {'n': 'Ana', 'estado': 'cazado', 'caza': {'t': '2026-11-10T01:00:00Z', 'por': [{'n': 'Cami'}]}}]}]}
    m = de_mw(mw, Q, d0)
    ok(sorted((x['q'][0], x['k']) for x in m) == [('1', 'nido'), ('1', 'star'), ('2', 'cofre:2'), ('2', 'star')],
       'Most Wanted: solo un Nido, en equipo un Star a cada uno, sobrevivir el Baúl, y lo de antes de DESDE no')
    sl = [{'id': 'fmh-es', 'c': 'Ana', 'ult': '2026-11-20'}, {'id': 'vieja', 'c': 'Beto', 'ult': '2026-11-01'}]
    ins = {'Cami': {'invicto': ['2026-11-21T00:00:00Z', 't1']}, 'Beto': {'invicto': ['2026-11-01T00:00:00Z', 't1']}}
    lg = de_ligas(sl, ins, Q, d0)
    ok(sorted((x['q'][0], x['k'], x['o']) for x in lg) == [('1', 'cofre:3', 'liga:fmhes:20261120'), ('3', 'nido', 'inv:20261121')],
       'ligas: la Funda por cada título y un Nido al invicto, desde DESDE')
    ma = de_mes_awards({'meses': {
        '2026-10': {'cerrado': '2026-11-05T00:00:00Z', 'sv': {'FFA': {'cats': {'rapero': {'premio': [['Ana', '', 1000]]}}}}},
        '2026-11': {'cerrado': '2026-12-05T00:00:00Z', 'sv': {'FFA': {'cats': {
            'rapero': {'premio': [['Ana', '', 0]]}, 'batalla': {'premio': [['Beto', '', 0], ['Nadie', '', 0]]}}}}},
        '2026-12': {'sv': {'FFA': {'cats': {'rapero': {'premio': [['Ana', '', 0]]}}}}}}}, Q)
    ok(sorted((x['q'][0], x['k'], x['o']) for x in ma) == [('1', 'nido', 'mes:2026-11:FFA:rapero'), ('2', 'star', 'mes:2026-11:FFA:batalla')],
       'MES AWARDS: un Nido al Rapero del mes de cada servidor y un Star a los demás (a cada lado de la batalla), desde '
       'noviembre, al cierre y sólo a los de DRA')
    ga = de_gala({'galas': {'t1': {'cerrado': '2027-01-05T00:00:00Z', 'cats': {
        'rapero': {'premio': [['Ana', '', 0]]}, 'batalla': {'premio': [['Beto', '', 0], ['Cami', '', 0]]},
        'duelista': {'premio': [['Beto', '', 0]]}, 'crew': {'premio': []}}}}}, Q)
    ok(sorted((x['q'][0], x['k'], x['o']) for x in ga) == [('1', 'cofre:4', 'gala:t1:rapero'), ('2', 'cofre:2', 'gala:t1:duelista'),
                                                           ('2', 'cofre:3', 'gala:t1:batalla'), ('3', 'cofre:3', 'gala:t1:batalla')],
       'la gala: el Tesoro al Rapero de la temporada, la Funda a la Batalla (a cada lado) y el Baúl a las de personas; '
       'los grupos, nada')
    todos = r + b + m + lg + ma + ga
    ok(all(re.match(r'^[\w.:-]{3,60}$', x['o']) and x['k'] in ('drop', 'star', 'nido', 'cofre:2', 'cofre:3', 'cofre:4') for x in todos),
       'cada origen pasa el filtro del objeto y cada tipo existe en `MERITO_TIPOS`')
    print('\n  %s' % ('todo ok' if not mal else '%d mal' % mal))
    return mal


def main():
    if '--auto' in sys.argv:
        sys.exit(1 if _self_check() else 0)
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ps = premios()
    print('%d premios por ganar desde %s' % (len(ps), DESDE))
    for x in ps[:40]:
        print('  ', x['k'], x['o'], x['q'][-4:])


if __name__ == '__main__':
    main()

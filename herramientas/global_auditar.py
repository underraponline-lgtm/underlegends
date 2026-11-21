# -*- coding: utf-8 -*-
"""🔎 AUDITAR EL RANKING GLOBAL: ¿hay alguien arriba de quien le ganó? ¿alguna batalla contada dos veces?

    python herramientas/global_auditar.py              audita la tabla publicada (bot/paginas/global.json) con sus batallas
    python herramientas/global_auditar.py --recalcular recalcula antes con lo guardado y el plantel de fms.tv (red)
    python herramientas/global_auditar.py --auto       self-check

Dlx, 21/11/2026: *«asegúrate que la fórmula esté bien, luego no quiero quejas como "ese malísimo está encima de X
jugador"»*. Esto busca exactamente eso antes de que lo encuentre la gente:

  1. CARA A CARA AL REVÉS: A le ganó a B en la T1 y B está arriba de A. Puede ser justo (B hizo más en otros eventos),
     pero cada caso tiene que poder explicarse.
  2. LA MISMA BATALLA DOS VECES: el mismo par, en la misma familia de evento, a menos de 30 días, en dos eventos
     distintos que no se juntaron (dos fuentes que no se reconocieron).
  3. EL MISMO NOMBRE, DOS PERSONAS: para revisar a mano que de verdad sean dos.
  4. EVENTOS RAROS: más de una final en el mismo evento (dos ediciones juntas). Cada final da su título, pero
     conviene mirar que no sea la misma final con el nombre mal escrito.
  5. LOS GRUPOS: cuántos de plaza y de la Liga hay arriba, y de dónde sacan sus puntos.

No cambia nada: dice qué mirar.
"""
import collections
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (BASE, os.path.join(BASE, 'bot')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from comun import claves  # noqa: E402


def _leer(ruta, si_no=None):
    try:
        with io.open(ruta, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return si_no


def auditar(out, batallas, de_id=None):
    """El informe, como una lista de líneas. `out` es la salida de `global_ranking.armar()`."""
    import global_ranking as G
    gente = out['g']
    puesto = {g['k']: i + 1 for i, g in enumerate(gente)}
    por_k = {g['k']: g for g in gente}
    if de_id is None:
        de_id, _ = G.identidades(G.deduplicar(batallas), [])
    bs = G.deduplicar(G.deduplicar(batallas), de_id)
    lineas = []

    # 1. cara a cara
    h2h = collections.defaultdict(lambda: [0, 0])
    for b in bs:
        if b.get('gana') not in ('a', 'b'):
            continue
        ka, kb = de_id.get(b['a']['id']), de_id.get(b['b']['id'])
        if not ka or not kb or ka == kb:
            continue
        g, p = (ka, kb) if b['gana'] == 'a' else (kb, ka)
        h2h[(g, p)][0] += 1
        h2h[(p, g)][1] += 1
    reves = []
    for (a, b), (gano, perdio) in h2h.items():
        if gano > perdio and a in puesto and b in puesto and puesto[b] < puesto[a]:
            reves.append((puesto[a] - puesto[b], a, b, gano, perdio))
    reves.sort(reverse=True)
    arriba = [r for r in reves if puesto[r[2]] <= 100]
    lineas.append('1. CARA A CARA AL REVÉS: %d casos (%d con el de arriba en el top 100)' % (len(reves), len(arriba)))
    for gap, a, b, gano, perdio in arriba[:25]:
        A, B = por_k[a], por_k[b]
        lineas.append('   #%-4d %-20s %-5s le ganó %d-%d a  #%-4d %-20s %-5s  (%.0f vs %.0f pts)'
                      % (puesto[a], A['n'][:20], A['esc'], gano, perdio, puesto[b], B['n'][:20], B['esc'], A['p'], B['p']))

    # 2. la misma batalla dos veces
    dobles = []
    por_par = collections.defaultdict(list)
    for b in bs:
        por_par[G._par(b, de_id)].append(b)
    for par, lista in por_par.items():
        for i, x in enumerate(lista):
            for y in lista[i + 1:]:
                dx, dy = G._dia(x['evento'].get('fecha')), G._dia(y['evento'].get('fecha'))
                if not (dx and dy) or x['evento']['id'] == y['evento']['id']:
                    continue
                if abs((dx - dy).days) <= 30 and G._familia(x['evento'].get('tipo')) == G._familia(y['evento'].get('tipo')) \
                        and (x.get('ronda') == y.get('ronda') or not x.get('ronda') or not y.get('ronda')) \
                        and x['fuente'] != y['fuente']:
                    dobles.append((x, y))
    lineas.append('2. LA MISMA BATALLA DOS VECES (posible): %d' % len(dobles))
    for x, y in dobles[:20]:
        lineas.append('   %s vs %s · %s · %s (%s) / %s (%s)' % (x['a']['nombre'], x['b']['nombre'], x.get('ronda'),
                                                             x['evento']['nombre'], x['fuente'],
                                                             y['evento']['nombre'], y['fuente']))

    # 3. el mismo nombre, dos personas
    por_nombre = collections.defaultdict(list)
    for g in gente:
        por_nombre[claves.clave(g['n'])].append(g)
    mismos = [(n, l) for n, l in por_nombre.items() if len(l) > 1 and any(x['p'] > 0 for x in l)]
    lineas.append('3. EL MISMO NOMBRE, DOS PERSONAS (revisar): %d' % len(mismos))
    for n, l in sorted(mismos, key=lambda t: -max(x['p'] for x in t[1]))[:20]:
        lineas.append('   %s: %s' % (n, ' · '.join('#%d %s %s %s %.0f' % (puesto[x['k']], x['n'], x['cc'] or '—', x['esc'],
                                                                         x['p']) for x in l)))

    # 4. eventos raros
    finales = collections.Counter(b['evento']['id'] for b in bs if b.get('ronda') == 'final')
    nombres = {b['evento']['id']: b['evento']['nombre'] for b in bs}
    raros = [(e, n) for e, n in finales.items() if n > 1]
    lineas.append('4. EVENTOS CON MÁS DE UNA FINAL (cada una da su título): %d' % len(raros))
    for e, n in sorted(raros, key=lambda t: -t[1])[:15]:
        lineas.append('   %d finales · %s' % (n, nombres.get(e, e)))

    # 5. los grupos
    tope = gente[:50]
    c = collections.Counter(g['esc'] for g in tope)
    lineas.append('5. EL TOP 50 POR GRUPO: pro %d · plaza %d · liga %d' % (c['pro'], c['plaza'], c['liga']))
    for g in tope:
        if g['esc'] != 'pro':
            tit = g['pt'] / g['p'] if g['p'] else 0
            lineas.append('   #%-3d %-20s %-5s %6.1f  (%d%% de títulos, %d batallas)' % (puesto[g['k']], g['n'][:20], g['esc'],
                                                                                  g['p'], round(100 * tit), g['jb']))
    return lineas


def _self_check():
    import datetime as dt
    import global_ranking as G
    bs = [G._b('fms', 'f1', 'fms_jornada', '2026-10-01', 'jornada', 'Alto', 'Bajo', 'b'),
          G._b('liga', 'l1', 'liga', '2026-10-02', 'final', 'Bajo', 'Nadie', 'a')]
    bs += [G._b('fms', 'f2', 'fms_jornada', '2026-10-0%d' % i, 'jornada', 'Alto', 'R%d' % i, 'a') for i in range(3, 8)]
    out = G.armar(bs, [], {}, {}, cuando=dt.datetime(2026, 11, 23, tzinfo=G.ET))
    lin = auditar(out, bs)
    ok = any('CARA A CARA' in l for l in lin) and any('Bajo' in l and 'le ganó' in l for l in lin)
    print('✅ global_auditar: bien' if ok else '🔴 global_auditar: no vio que Bajo le ganó a Alto y está abajo:\n' +
          '\n'.join(lin))
    return 0 if ok else 1


def main():
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    import global_ranking as G
    previo = _leer(G.BATALLAS, {}) or {}
    plantel = previo.get('plantel') or []
    if '--recalcular' in sys.argv:
        import global_fuente_fms as F
        plantel = F.leer(red=True).get('plantel') or plantel
    pros = G.pros_de(plantel, _leer(G.PROS, {}))
    bat, mvp, alias = previo.get('batallas') or [], previo.get('mvp') or [], _leer(G.ALIAS, {})
    if '--recalcular' in sys.argv:
        out = G.armar(bat, mvp, previo.get('semillas') or {}, previo.get('fu') or {}, alias, _leer(G.SEMILLAS, {}),
                      pros=pros)
    else:
        out = _leer(G.SALIDA, {})
    # Quién es quién igual que en la tabla (con los pros y los alias), o las claves no coinciden con las de `out`.
    de_id, _ = G.identidades(G.deduplicar(bat), mvp, alias, extra=pros)
    print('\n'.join(auditar(out, bat, de_id)))


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()

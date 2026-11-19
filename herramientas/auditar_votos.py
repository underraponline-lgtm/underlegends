# -*- coding: utf-8 -*-
"""⚖️ LOS VOTOS DEL JURADO, UNO POR UNO: CÓMO SE ESCRIBIÓ CADA NOMBRE, QUIÉN ES, Y A QUÉ BATALLA DE QUÉ LLAVE FUE.

    python herramientas/auditar_votos.py              el resumen y lo que hay que mirar
    python herramientas/auditar_votos.py --llave 660  esa llave, batalla por batalla
    python herramientas/auditar_votos.py --dias 7     sólo los votos de los últimos 7 días

Dlx, 18/11/2026: *«verify more that the votes are being saved correctly with the name and the real person name»*. Lee
lo mismo que la página (`datos/jurados.json` con `gente_evento.jurado()`) y no escribe nada. Mira cuatro cosas:

  1. CADA NOMBRE ESCRITO EN #veredictos → la persona (`competencias.de_hoy()`, los alias de `datos/akas.json`) → si
     esa persona está en la Lista. Un nombre que no es nadie no se puede unir a ninguna llave.
  2. CADA VOTO → la batalla de la llave a la que fue, o ninguna.
  3. EL MÁS VOTADO contra el que pasó en la llave: si no coinciden, o el voto está mal unido o la llave dice otra cosa
     que el jurado.
  4. EN LAS DE 3 A 5, QUIÉN ESTÁ EN LA LLAVE Y NO EN EL VOTO: un apodo que todavía no es alias de nadie (Erian escribió
     «TOMMY» donde la llave dice crakero). Son candidatos para ✅ Decidir; no se tocan solos.

⚠️ Los jurados se nombran como en la página: por la Lista si su cuenta está ahí, si no con su nombre de Discord.
"""
import collections
import datetime as dt
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (os.path.join(BASE, 'bot'), os.path.join(BASE, 'sheet'), BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import competencias as CO  # noqa: E402
import gente_evento as G  # noqa: E402


def _dia(v):
    try:
        return (dt.datetime.fromtimestamp(int(v['pub']) / 1000, dt.timezone.utc) - dt.timedelta(hours=4)).date()
    except (KeyError, TypeError, ValueError, OSError):
        return None


def auditar(F, dias=None, solo=None):
    """Lo que se mide (ver arriba), en un dict."""
    hoy = dt.date.today()
    reciente = lambda v: _dia(v) and (dias is None or (hoy - _dia(v)).days <= dias)   # noqa: E731
    votos = [(i, v) for i, v in enumerate(F.votos) if reciente(v)]
    # 1 · cada nombre escrito → la persona → ¿está en la Lista?
    nombres, nadie = collections.Counter(), collections.Counter()
    for _i, v in votos:
        for x in v.get('lados') or [v.get('a') or '', v.get('b') or '']:
            p = CO.de_hoy(x)
            if G._norm(p) in F.en_lista:
                nombres['alias' if G._norm(p) != G._norm(x) else 'igual'] += 1
            else:
                nombres['nadie'] += 1
                nadie[x] += 1
    # 2 y 3 · cada voto → su batalla, y el más votado contra el que pasó
    unidos, usados, contra, apodos = {}, set(), [], []
    for n, L in sorted(F.llaves.items(), key=lambda kv: str(kv[0])):
        if solo and str(n) != str(solo):
            continue
        L = dict(L, n=n)
        pasa = {}
        for R in L.get('rondas') or []:
            for b in R.get('b') or []:
                pasa[(R.get('r') or '', tuple(b[0] or []))] = str(b[1] or '')
        for b in G.jurado(L, F, con_voto=True):
            if not reciente(b['_voto']):
                continue
            usados.add(b['_voto']['i'])
            cuenta = [sum(1 for v in b['v'] if v[1] == li) for li in range(len(b['l']))]
            top = [b['l'][li] for li, c in enumerate(cuenta) if c == max(cuenta)]
            g = pasa.get((b['r'], tuple(b['l'])), '')
            # el que pasó puede ser uno («Valen»), dos que pasan («PRAISERIZA, rodrilp») o un equipo entero («A, B»)
            pasan = {F.clave(x) for x in g.split(',') if x.strip()} | ({F.clave(g)} if g else set())
            bien = len(top) == 1 and F.clave(top[0]) in pasan
            unidos.setdefault(str(n), []).append((b, bien, len(top) > 1))
            if not bien and len(top) == 1 and pasan:
                contra.append((n, L.get('nombre'), b, g))
            # 4 · de 3 a 5: quién está en la llave y no en el voto
            if len(b['l']) > 2:
                del_voto = {F.clave(x) for x in b['_voto']['lados']}
                faltan = [x for x in b['l'] if F.clave(x) not in del_voto]
                sobran = [x for x in b['_voto']['lados'] if F.clave(x) not in {F.clave(y) for y in b['l']}]
                if faltan or sobran:
                    apodos.append((n, b, faltan, sobran))
    # los votos que no fueron a ninguna llave: ¿había una llave en la ventana con esa gente? Si había, es para mirar
    sueltos = [(i, v) for i, v in votos if i not in usados]
    gente_dia = collections.defaultdict(set)
    for n, L in F.llaves.items():
        try:
            d0 = dt.date.fromisoformat(L.get('dia'))
        except (TypeError, ValueError):
            continue
        for R in L.get('rondas') or []:
            for bb in R.get('b') or []:
                for x in bb[0] or []:
                    for k in range(-G.VOTO_DESPUES, G.VOTO_ANTES + 1):
                        gente_dia[d0 + dt.timedelta(days=-k)].add((F.clave(x), str(n)))
    con_gente = []
    for i, v in sueltos:
        ks = {F.clave(x) for x in _lados(v)}
        llaves = collections.Counter(n for k, n in gente_dia.get(_dia(v), ()) if k in ks)
        if llaves and llaves.most_common(1)[0][1] >= 2:
            con_gente.append((v, llaves.most_common(1)[0][0]))
    jueces = collections.Counter()
    for _i, v in votos:
        for jid in (v.get('v') or {}):
            jueces['lista' if str(jid) in F.por_id else 'discord' if str(jid) in F.jnombre else 'sin nombre'] += 1
    return {'votos': votos, 'nombres': nombres, 'nadie': nadie, 'unidos': unidos, 'usados': usados,
            'contra': contra, 'apodos': apodos, 'sueltos': sueltos, 'con_gente': con_gente, 'jueces': jueces}


def _lados(v):
    return v.get('lados') or [v.get('a') or '', v.get('b') or '']


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass
    dias = int(sys.argv[sys.argv.index('--dias') + 1]) if '--dias' in sys.argv else None
    solo = sys.argv[sys.argv.index('--llave') + 1] if '--llave' in sys.argv else None
    F = G.Fuentes()
    A = auditar(F, dias, solo)
    if solo:
        print('\n⚖️ La llave #%s, batalla por batalla (✍️ entre «» cómo se escribió en #veredictos)\n' % solo)
        for b, bien, empate in A['unidos'].get(str(solo), []):
            e = b.get('e') or [''] * len(b['l'])
            lados = ' vs '.join('%s%s' % (x, ' «%s»' % e[li] if e[li] else '') for li, x in enumerate(b['l']))
            votos = ', '.join('%s → %s' % (j, b['l'][li]) for j, li in b['v'])
            print('  %s %-12s %s\n                  %s  · el voto: %s' % ('✅' if bien else '🟡' if empate else '🔴', b['r'], lados,
                                                                  votos, ' vs '.join(b['_voto']['lados'])))
        return 0
    n = A['nombres']
    tot = sum(n.values()) or 1
    print('\n⚖️ LOS VOTOS DEL JURADO%s\n' % ('' if dias is None else ', últimos %d días' % dias))
    print('  %d batallas votadas en #veredictos' % len(A['votos']))
    print('  nombres escritos: %d · %d igual que en la Lista · %d por un alias · %d no son nadie de la Lista (%.0f %%)'
          % (tot, n['igual'], n['alias'], n['nadie'], 100.0 * n['nadie'] / tot))
    print('  votos de jueces: %d de la Lista · %d con su nombre de Discord · %d sin nombre'
          % (A['jueces']['lista'], A['jueces']['discord'], A['jueces']['sin nombre']))
    bien = sum(1 for xs in A['unidos'].values() for _b, ok, _e in xs if ok)
    emp = sum(1 for xs in A['unidos'].values() for _b, _ok, e in xs if e)
    nb = sum(len(xs) for xs in A['unidos'].values())
    print('  unidos a una batalla de llave: %d votos en %d batallas de %d llaves' % (len(A['usados']), nb, len(A['unidos'])))
    print('     el más votado es el que pasó en %d · empate en %d · otro en %d' % (bien, emp, len(A['contra'])))
    print('  sin llave: %d · de ésos, %d con dos o más de sus MCs en una misma llave de esos días (para mirar abajo)'
          % (len(A['sueltos']), len(A['con_gente'])))
    if A['contra']:
        print('\n  🔴 EL JURADO DICE UNO Y LA LLAVE OTRO')
        for n_, nom, b, g in A['contra'][:30]:
            print('     #%s %s · %s: %s · votos %s · pasó %s' % (n_, nom, b['r'], ' vs '.join(b['l']),
                                                             ', '.join('%s→%s' % (j, b['l'][li]) for j, li in b['v']), g))
    if A['apodos']:
        print('\n  🟡 DE 3 A 5: EN LA LLAVE Y NO EN EL VOTO (¿un apodo que todavía no es alias de nadie?)')
        for n_, b, faltan, sobran in A['apodos'][:30]:
            print('     #%s %s: la llave dice %s · el voto dice %s' % (n_, b['r'], ', '.join(faltan) or '—', ', '.join(sobran) or '—'))
    if A['con_gente']:
        print('\n  🟡 SIN LLAVE, PERO SU GENTE JUGÓ UNA LLAVE ESOS DÍAS (¿otra batalla, otro evento, o no se pudo unir?)')
        for v, n_ in A['con_gente'][:30]:
            L = F.llaves.get(n_) or {}
            print('     %s · %s · llave #%s %s' % (_dia(v), ' vs '.join(_lados(v)), n_, L.get('nombre') or ''))
    if A['nadie']:
        print('\n  🟡 LOS NOMBRES ESCRITOS QUE NO SON NADIE DE LA LISTA (los más repetidos)')
        print('     ' + ' · '.join('%s ×%d' % (x, c) for x, c in A['nadie'].most_common(30)))
    return 0


if __name__ == '__main__':
    sys.exit(main())

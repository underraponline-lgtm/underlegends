# -*- coding: utf-8 -*-
"""🔁 LOS PRIMERIZOS Y LOS ENFRIADOS, AL DASHBOARD (25/10/2026).

El research del Dashboard (`reports/Dashboard del dueño de la Liga.md`, en el repo privado) y Dlx: *«arranco con todo lo
demás»*. El número de la vuelta al segundo evento dice cuántos; esto dice QUIÉNES: los que jugaron una sola vez y los que
jugaron dos o más y hace 3 semanas que no vuelven (`rankings.ENFRIA_DIAS`). La lista la arma el paso 1c
(`rankings.primerizos()`, con las mismas filas que la retención) en `.cache/primerizos.json`; acá se le pone a cada uno
su clave de perfil (`comun/claves.clave()`, la misma de R2 y del Worker) y se manda al objeto (`/avisos/primerizos-ciclo`,
con la clave del ciclo), como el puntaje de los tiers.

⚠️ CON NOMBRES: NUNCA AL REPO, que es público. `.cache/` no se commitea y el objeto sólo lo muestra en el Dashboard.
⚠️ Lo que se haga con esa lista va por la página (la campana de cada uno), nunca por DM.

    python bot/primerizos.py            # cuántos y los primeros, sin mandar nada
    python bot/primerizos.py --aplicar  # al Dashboard
    python bot/primerizos.py --auto     # self-check, sin red
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

ARCHIVO = os.path.join(BASE, '.cache', 'primerizos.json')


def con_claves(x):
    """La lista con la clave de perfil de cada uno al final de su fila (para enlazar el perfil y avisarle)."""
    from comun.claves import clave
    y = dict(x)
    y['una'] = [f + [clave(f[0])] for f in x.get('una') or []]
    y['frio'] = [f + [clave(f[0])] for f in x.get('frio') or []]
    return y


def _mandar(x):
    """Al objeto, con la clave del ciclo. Devuelve si llegó."""
    import requests
    import fotos as F
    import clave_ciclo as CC
    from alertar import WORKER
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('   ⚠️ sin DISCORD_TOKEN: la lista no va al Dashboard')
        return False
    r = requests.post(WORKER + '/avisos/primerizos-ciclo', headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'},
                      data=json.dumps(x, ensure_ascii=False).encode('utf-8'), timeout=25)
    if r.status_code != 200:
        print('   ⚠️ la lista no llegó al Dashboard (%s)' % r.status_code)
    return r.status_code == 200


def _self_check():
    import rankings as R
    t = lambda d, h=22: dt.datetime(2026, 10, d, h, tzinfo=dt.timezone.utc)
    filas = [(1, 'FFA', t(1), 'Ana', 10), (2, 'DDF', t(2), 'Ana', 10),           # Ana: 2 eventos, hace más de 21 días
             (3, 'FFA', t(20), 'Beto', 5),                                        # Beto: uno solo
             (4, 'URBF', t(24), 'Caro', 5), (4, 'URBF', t(24, 23), 'Caro', 5),    # Caro: el mismo evento dos veces = uno
             (5, 'FFA', t(10), 'Dani', 1), (6, 'FFA', t(23), 'Dani', 1)]          # Dani: jugó hace poco, no está fría
    x = con_claves(R.primerizos(filas, ahora=t(25)))
    ok = True
    def ver(c, que):
        nonlocal ok
        print(('   ✅ ' if c else '   ❌ ') + que)
        ok = ok and c
    ver([f[0] for f in x['una']] == ['Caro', 'Beto'], 'los de un solo evento, el más nuevo primero (un evento dos veces cuenta uno)')
    ver([f[0] for f in x['frio']] == ['Ana'] and x['frio'][0][4] == 2, 'enfriado: dos o más eventos y 21 días sin volver')
    ver(x['hist'] == {'1': 2, '2': 2} and x['n_una'] == 2 and x['jugadores'] == 4, 'cuántos jugaron cuántos eventos')
    ver(x['una'][0][-1] == 'caro' and x['frio'][0][-1] == 'ana', 'cada uno lleva su clave de perfil al final')
    return ok


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 0 if _self_check() else 1
    try:
        with io.open(ARCHIVO, encoding='utf-8') as f:
            x = json.load(f)
    except (OSError, ValueError):
        print('   ⚠️ no está %s: lo deja el paso 1c (las vitrinas)' % os.path.relpath(ARCHIVO, BASE))
        return 0
    x = con_claves(x)
    print('   🔁 %d jugaron una sola vez · %d se enfriaron (de %d)' % (x.get('n_una', 0), x.get('n_frio', 0), x.get('jugadores', 0)))
    if '--aplicar' in sys.argv:
        if _mandar(x):
            print('   🔁 la lista llegó al Dashboard')
    else:
        print('   (simulacro: no mandé nada — `--aplicar`)')
    return 0


if __name__ == '__main__':
    sys.exit(main())

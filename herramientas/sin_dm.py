# -*- coding: utf-8 -*-
"""EL BOT NO LE MANDA DMs A NADIE MÁS QUE A DLX.

    python herramientas/sin_dm.py          dónde se abre un DM y a quién
    python herramientas/sin_dm.py --auto   lo mismo, y sale con 1 si hay uno a otra persona

🔑 Dlx, 25/09/2026: *«el bot no hace ningún DM en Discord, ¿no? Sólo a mí.
Eso de notificaciones sólo queremos que sea por la website y la
notificación. No quiero que haya riesgo de que nos baneen el bot»*.

Los DMs no pedidos son lo que Discord castiga como spam, y un bot baneado
se lleva puestos `/card`, el vigía de avisos y el ciclo entero. Por eso lo
de cada persona —«desbloqueaste tu tarjeta», «subiste de rango», el evento
que arranca— sale **sólo** como notificación de la página (Web Push, ver
`bot/avisos.js`), nunca por Discord.

⚠️ HOY SON DOS, Y LOS DOS SON A DLX:

- `bot/alertar.py` `dm()`: las alertas del ciclo, a `dueno()`, que lee la
  constante `DUENO` de `bot/worker.js`.
- `bot/avisos.js` `avisarDueno()`: el resultado de SU «probando», a
  `this.dueno`, que es la misma `DUENO` pasada por el cron del vigía.

🔴 ES UNA REGLA, NO UNA LISTA: se busca en todo el código cada lugar que abre
un DM —`users/@me/channels`, el único endpoint de Discord que lo hace— y el
destinatario tiene que ser el dueño. Un DM nuevo a cualquier otra persona
pone rojo a CI (`.github/workflows/chequeos.yml`) antes de llegar al bot.
"""
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALTAR = ('.git', 'node_modules', '__pycache__', 'docs', 'salida', 'disenos')
#: lo único que puede ir como destinatario de un DM: el dueño
DUENO_OK = re.compile(r"recipient_id['\"]?\s*[:=]\s*(dueno\(\)|this\.dueno\b|DUENO\b)")
YO = os.path.abspath(__file__)


def lugares():
    """`[(ruta, línea, texto, ok)]` de cada DM que el código abre."""
    out = []
    for raiz, dirs, arcs in os.walk(BASE):
        dirs[:] = [d for d in dirs if d not in SALTAR]
        for a in arcs:
            if not a.endswith(('.py', '.js', '.mjs')):
                continue
            p = os.path.join(raiz, a)
            if os.path.abspath(p) == YO:
                continue
            try:
                with open(p, encoding='utf-8') as f:
                    ls = f.read().split('\n')
            except (OSError, UnicodeDecodeError):
                continue
            for i, l in enumerate(ls):
                if 'users/@me/channels' not in l:
                    continue
                # el destinatario va en esa línea o en las dos de abajo
                cerca = ' '.join(ls[i:i + 3])
                out.append((os.path.relpath(p, BASE).replace('\\', '/'), i + 1,
                            l.strip()[:90], bool(DUENO_OK.search(cerca))))
    return out


def _self_check():
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('✅' if cond else '🔴', que))

    print('\n  sin_dm.py — el bot no le manda DMs a nadie más que a Dlx\n')
    # la regla, sobre casos armados
    ok(DUENO_OK.search("data=json.dumps({'recipient_id': dueno()}))"), 'a `dueno()` vale')
    ok(DUENO_OK.search('body: JSON.stringify({ recipient_id: this.dueno }) });'), 'a `this.dueno` vale')
    ok(not DUENO_OK.search("json={'recipient_id': did}"), 'a cualquier otro ID, no')
    ok(not DUENO_OK.search('recipient_id: a.quien'), 'tampoco al de un aviso personal')
    # y sobre el código de verdad
    ls = lugares()
    for ruta, n, _t, bien in ls:
        ok(bien, '%s:%d abre un DM %s' % (ruta, n, 'al dueño' if bien else 'A OTRA PERSONA'))
    ok(len(ls) >= 2, 'encontró los dos de hoy (alertar.py y avisos.js): %d' % len(ls))
    print('\n  %s\n' % ('todo bien' if not mal else '🔴 %d mal' % mal))
    return mal


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    for ruta, n, t, bien in lugares():
        print('%s %s:%d  %s' % ('✅' if bien else '🔴', ruta, n, t))
    return 0


if __name__ == '__main__':
    sys.exit(main())

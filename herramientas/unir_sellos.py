# -*- coding: utf-8 -*-
"""UNE DOS SELLOS EN VEZ DE ELEGIR UNO.

    python herramientas/unir_sellos.py <mio.json> <del_remoto.json> <salida> [<base.json>]
    python herramientas/unir_sellos.py --auto      self-check

🔴 EXISTE PORQUE EL CICLO PERDIO UN SELLO EL 22/09/2026. El paso
«guardar el sello» commitea y despues hace `git pull --rebase`; si
alguien empujo los mismos archivos mientras el ciclo dibujaba, el rebase
conflictua, el repo queda con archivos sin resolver y **los tres
reintentos mueren todos en eso** — «Pulling is not possible because you
have unmerged files», tres veces. El sello se perdio despues de haber
subido las cartas, que es el unico estado que no se puede reconstruir.

⚠️ Y PARA CASI TODOS LOS ARCHIVOS «GANA EL MIO» ES CORRECTO: los pools,
el padron y el inventario de R2 son **mediciones**, y la mia es la de
recien. El sello NO: el mio sale del checkout, que puede ser mas VIEJO
que el de origin —fue exactamente el caso, checkout de las 18:57 contra
un sello commiteado a las 19:35—. Quedarme con el mio tira los sellos de
la corrida anterior y la siguiente redibuja todo: el bucle de 120
minutos por hora que `always()` existia para cortar.

⚠️ SE UNE POR PERSONA Y GANA EL MIO **EN LOS QUE TENGO**. Un sello es
`<datos>:<codigo>` de lo que se dibujo: si yo acabo de dibujar a alguien,
mi valor es el que describe el PNG que esta en R2. De los que no toque no
se nada, y el de origin es la mejor respuesta que hay.

🔴 Y «LOS QUE TENGO» ERAN TODOS, NO LOS QUE TOQUE. Sin la base, cada
sello de mi archivo pisaba al de origin — también los que yo no toqué y
que traía del checkout. Los dos trabajos del ciclo corren a la vez
(`concurrency` por trabajo), así que `dibujar`, al terminar, devolvía a
su valor viejo los sellos que `escuchar` había renovado mientras tanto,
y la corrida siguiente los redibujaba. Nunca deja una carta vieja —un
sello viejo sólo pide redibujar— pero es trabajo tirado. Con la BASE (el
archivo como estaba en el checkout) gana lo mío **sólo donde cambió**.

⚠️ DOS FORMAS DE SELLO. El de las cartas es `{cartas: {...}, cuando}`;
el de las Bloqueadas, `datos/bloqueadas_selladas.json`, es plano. Se
une igual y se escribe en la forma en que vino.
"""
import io
import json
import os
import sys


def leer(p):
    try:
        with io.open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _sellos(d):
    """`(los sellos, si vienen dentro de «cartas»)`. Ver las dos formas."""
    if isinstance(d, dict) and isinstance(d.get('cartas'), dict):
        return d['cartas'], True
    return (d if isinstance(d, dict) else {}), False


def unir(mio, remoto, base=None):
    """`(unido, cuantos valores vinieron del remoto)`.

    Se parte del remoto y se pisa con lo mío **que cambió respecto de la
    base**. Sin base, con todo lo mío: es lo que hacía antes y lo que
    sigue siendo correcto si no se sabe de dónde partí.
    """
    a, en_cartas_a = _sellos(mio)
    b, en_cartas_b = _sellos(remoto)
    c, _ = _sellos(base)
    junto = dict(b)
    for k, v in a.items():
        if base is None or k not in b or c.get(k) != v:
            junto[k] = v
    del_remoto = len([k for k in junto if junto[k] != a.get(k)])
    if en_cartas_a or en_cartas_b:
        cuando = max((mio or {}).get('cuando') or '',
                     (remoto or {}).get('cuando') or '')
        return {'cartas': junto, 'cuando': cuando}, del_remoto
    return junto, del_remoto


def _self_check():
    mal = 0

    def ver(que, ok):
        nonlocal mal
        mal += not ok
        print('   %s %s' % ('✅' if ok else '🔴', que))

    print('\n══ UNIR SELLOS ══\n')
    base = {'x': '1', 'y': '1', 'z': '1'}
    mio = {'x': '2', 'y': '1', 'z': '1', 'n': '9'}      # dibujé x y n
    remoto = {'x': '1', 'y': '3', 'z': '1', 'r': '7'}   # el otro, y e r
    j, dr = unir(mio, remoto, base)
    ver('lo que dibujé gana (x)', j['x'] == '2')
    ver('lo que renovó el otro NO se pisa con mi copia vieja (y)',
        j['y'] == '3')
    ver('lo nuevo de los dos entra (n, r)', j['n'] == '9' and j['r'] == '7')
    ver('cuenta lo que vino del remoto (y, r)', dr == 2)
    j2, _ = unir(mio, remoto)
    ver('sin base, gana todo lo mío, como antes (y)', j2['y'] == '1')
    c, _ = unir({'cartas': mio, 'cuando': 'b'},
                {'cartas': remoto, 'cuando': 'a'}, {'cartas': base})
    ver('la forma de las cartas se conserva',
        c['cartas']['y'] == '3' and c['cuando'] == 'b')
    ver('la plana también', 'cartas' not in j)
    ver('nada más que una carta: el remoto vacío no rompe',
        unir(mio, None, base)[0]['x'] == '2')
    return mal


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        return 1 if _self_check() else 0
    if len(sys.argv) < 4:
        return print(__doc__.strip().splitlines()[2])
    mio, remoto, salida = sys.argv[1], sys.argv[2], sys.argv[3]
    m, r = leer(mio), leer(remoto)
    # ⚠️ LA BASE ES OPCIONAL: si no se pasa o no se puede leer, se une
    # como antes. Un archivo que falta no puede frenar el guardado.
    b = leer(sys.argv[4]) if len(sys.argv) > 4 else None
    if m is None and r is None:
        print('  ni uno de los dos se pudo leer: no escribo nada')
        return 1
    junto, del_remoto = unir(m, r, b)
    with io.open(salida, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(junto, f, ensure_ascii=False, indent=1, sort_keys=True)
    print('  %s: %d sello(s) · %d valor(es) de origin%s'
          % (os.path.basename(salida), len(_sellos(junto)[0]), del_remoto,
             '' if b is not None else ' (sin base)'))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)

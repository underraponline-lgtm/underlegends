# -*- coding: utf-8 -*-
"""UNE DOS SELLOS EN VEZ DE ELEGIR UNO.

    python herramientas/unir_sellos.py <mio.json> <del_remoto.json> <salida>

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
"""
import io
import json
import sys


def leer(p):
    try:
        with io.open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def unir(mio, remoto):
    """`(dict unido, cuantos vinieron del remoto)`"""
    a = (mio or {}).get('cartas') or {}
    b = (remoto or {}).get('cartas') or {}
    # el orden importa: se parte del remoto y se pisa con el mio
    junto = dict(b)
    junto.update(a)
    solo_remoto = len([k for k in b if k not in a])
    cuando = max((mio or {}).get('cuando') or '',
                 (remoto or {}).get('cuando') or '')
    return {'cartas': junto, 'cuando': cuando}, solo_remoto


def main():
    if len(sys.argv) < 4:
        return print(__doc__.strip().splitlines()[2])
    mio, remoto, salida = sys.argv[1], sys.argv[2], sys.argv[3]
    m, r = leer(mio), leer(remoto)
    if m is None and r is None:
        print('  ni uno de los dos se pudo leer: no escribo nada')
        return 1
    junto, del_remoto = unir(m, r)
    with io.open(salida, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(junto, f, ensure_ascii=False, indent=1, sort_keys=True)
    print('  sellos: %d míos + %d que sólo tenía origin = %d'
          % (len(((m or {}).get('cartas') or {})), del_remoto,
             len(junto['cartas'])))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)

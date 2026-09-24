"""El puesto competitivo DENTRO DEL SERVIDOR, y con que no puede convivir.

Dlx lo aclaro: "entre todos los que estan en el competitivo dentro del
servidor, en que posicion esta esa persona? es parecido con el de PAISES que
esta dentro de la tarjeta competitiva".

⚠️ ESO YA EXISTE Y YA TIENE REGLA ESCRITA. Es pos_sv, 135 de 138, y CLAUDE.md
lo dice: "Los numeros de los circulos de abajo se calculan POR SCORE. Pais,
servidor y crew, los tres. Si alguna vez se quiere medir por un combinado de
temporada y competitivo, hay que cambiarlo EN LOS TRES A LA VEZ, o los tres
numeros dejan de ser comparables entre si."

Y trae el umbral de 3: pos_sv queda vacio cuando el grupo no llega a tres,
porque ser "1 de 1" no dice nada.


⚠️ PERO ESTO CHOCA CON ALGO QUE YO HABIA PROPUESTO HACE DOS TANDAS
------------------------------------------------------------------
Yo habia puesto "puesto en el sv" en la COLUMNA, dentro del bloque del
servidor, y ese bloque iba a calcularse por ACUMULACION. Si ademas el pie
lleva el puesto competitivo dentro del servidor, la carta muestra DOS
PUESTOS DEL MISMO SERVIDOR medidos con criterios distintos.

No es que quede recargado: es que pueden CONTRADECIRSE a la vista. Este
script mide cuanto se contradicen de verdad, con la gente real.

Se comparan dos ordenes dentro de cada servidor:

    por SCORE       lo que ya usa pos_sv y los circulos de la Competitiva
    por ACUMULACION el OVR de temporada, que premia cuanto jugaste

⚠️ Si el desacuerdo es grande, no se pueden mostrar los dos y hay que elegir
uno. Si es chico, el segundo no aporta nada y tampoco vale la pena.
"""
import collections
import json
import os
import sys

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
sys.path.insert(0, BASE)
MIN_GRUPO = 3


def main():
    comp = json.load(open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                          encoding='utf-8'))
    temp = {t['raw'].lower(): t for t in
            json.load(open(os.path.join(BASE, 'datos', 'temporada_pool.json'),
                           encoding='utf-8'))}

    por_sv = collections.defaultdict(list)
    for p in comp:
        t = temp.get(p['raw'].lower())
        if t:
            por_sv[p['sv']].append((p, t))

    print('=' * 72)
    print('LOS DOS ORDENES DENTRO DE CADA SERVIDOR, Y CUANTO SE CONTRADICEN')
    print('=' * 72)
    print("""
   por SCORE        lo que ya usa pos_sv y los circulos de la Competitiva
   por ACUMULACION  el OVR de temporada, que premia cuanto jugaste
""")
    print('  %-6s %3s %8s   %s' % ('sv', 'n', 'desacuerdo', 'el caso peor'))
    print('  ' + '-' * 68)
    todos = []
    for sv, g in sorted(por_sv.items(), key=lambda kv: -len(kv[1])):
        if len(g) < MIN_GRUPO:
            print('  %-6s %3d      —        menos de %d, sin ranking'
                  % (sv, len(g), MIN_GRUPO))
            continue
        ps = sorted(g, key=lambda x: -x[0]['score'])
        pa = sorted(g, key=lambda x: -x[1]['ovr'])
        rs = {id(x[0]): i + 1 for i, x in enumerate(ps)}
        ra = {id(x[0]): i + 1 for i, x in enumerate(pa)}
        difs = [(abs(rs[id(p)] - ra[id(p)]), p['raw'], rs[id(p)], ra[id(p)])
                for p, _t in g]
        med = sum(d for d, *_ in difs) / len(difs)
        peor = max(difs)
        todos += [d for d, *_ in difs]
        print('  %-6s %3d %6.1f pos   %s: %dº por score, %dº por acumulación'
              % (sv, len(g), med, peor[1][:12], peor[2], peor[3]))

    if todos:
        n = len(todos)
        print('\n  sobre las %d personas de servidores con 3 o más:' % n)
        print('     desacuerdo medio        %.1f puestos' % (sum(todos) / n))
        print('     cambian de puesto       %d de %d  (%.0f%%)'
              % (sum(1 for d in todos if d), n,
                 100 * sum(1 for d in todos if d) / n))
        print('     se mueven 3 o más       %d  (%.0f%%)'
              % (sum(1 for d in todos if d >= 3),
                 100 * sum(1 for d in todos if d >= 3) / n))
        print('     se mueven 5 o más       %d  (%.0f%%)'
              % (sum(1 for d in todos if d >= 5),
                 100 * sum(1 for d in todos if d >= 5) / n))

    print("""
  ⚠️ LO QUE ESTO DECIDE. Si la carta lleva un puesto en la columna calculado
  por acumulacion Y otro en el pie calculado por score, la gente que aparece
  arriba lee dos numeros del MISMO servidor que no coinciden, sin ninguna
  pista de por que. No hay forma de explicarlo dentro de la carta.

  Y hay una regla que ya lo resuelve: CLAUDE.md dice que pais, servidor y
  crew se calculan POR SCORE, los tres, y que si se cambia hay que cambiar
  los tres a la vez. El puesto dentro del servidor YA ESTA DEFINIDO, y
  cambiarlo solo en esta carta romperia la comparabilidad con los circulos
  de la Competitiva.

  ENTONCES:
    · el PUESTO dentro del servidor va POR SCORE  ->  pos_sv, ya existe
    · va UNA SOLA VEZ, en el pie, junto al rango y al pais
    · la COLUMNA se queda con el OVR del servidor, los campeonatos y la
      racha, que son ACUMULACION y no compiten con un puesto

  Asi cada zona tiene un solo criterio: el pie mide CALIDAD (score) y la
  columna mide CUANTO (acumulacion). Que es la misma division que ya existe
  entre la Competitiva y la Temporada.
""")


if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    main()

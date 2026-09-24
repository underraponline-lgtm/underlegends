"""QUE PUEDE MEDIR EL OVR DE LA SERVIDOR. Medido contra el Sheet.

Dlx: "no todo tiene que estar relacionado a campeonatos... quizas por
overall? pero necesitamos decidir tambien que va a medir el overall".

Tiene razon en las dos cosas, y la segunda es la que bloquea: hoy el numero
grande de la carta ESTA INVENTADO (ESTADO.md lo dice). Antes de colgarle una
escalera hay que decir que mide.

⚠️ ESTE SCRIPT LEE EL SHEET porque el dato NO ESTA EN NINGUN POOL. Las 7
columnas por servidor las lee construir_pool_temporada.py en la linea 110
—para sacar el argmax— y en la 120 —para contar en cuantos servidores
estuviste—, Y DESPUES LAS TIRA. El numero que necesitamos pasa por ahi y no
queda guardado.

Solo lectura, como los tres de sheet/. Necesita creds.json, que no va al repo.
"""
import collections
import json
import math
import os
import sys

import gspread
from google.oauth2.service_account import Credentials

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHEET = '1sDo89FTvnI6FOtz6KSK0jAtDBtJHsB7N54wNLLae62U'
SERVIDORES = ['TWR', 'TFC', 'SR', 'FTN', 'URBF', 'FRZ', 'DRA']
MIN_EVENTOS = 8
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_pts_sv.json')


def num(x):
    try:
        return float(str(x).replace(',', '.').replace('%', '').strip() or 0)
    except ValueError:
        return 0.0


def leer():
    """Los puntos de cada persona en cada servidor. Cachea: el Sheet tarda."""
    if os.path.exists(CACHE):
        return json.load(open(CACHE, encoding='utf-8'))
    sc = ['https://www.googleapis.com/auth/spreadsheets.readonly']
    gc = gspread.authorize(Credentials.from_service_account_file(
        os.path.join(RAIZ, 'creds.json'), scopes=sc))
    v = gc.open_by_key(SHEET).worksheet('Ranking Temporada').get_all_values()
    H = [x.strip() for x in v[15]]
    col = lambda n: H.index(n)
    out = []
    for r in v[16:]:
        if not r or not r[0].strip() or num(r[col('Ev')]) < MIN_EVENTOS:
            continue
        pts_sv = {s: num(r[col(s)]) for s in SERVIDORES if num(r[col(s)]) > 0}
        if not pts_sv:
            continue
        out.append({'raw': r[col('Rapero')].strip(),
                    'pts': num(r[col('Puntos')]), 'ev': num(r[col('Ev')]),
                    'sv': max(pts_sv, key=pts_sv.get), 'pts_sv': pts_sv})
    json.dump(out, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False)
    return out


def main():
    d = leer()
    n = len(d)
    print('=' * 72)
    print('LO QUE EL SHEET TIENE PARTIDO POR SERVIDOR, Y LO QUE NO')
    print('=' * 72)
    print("""
   El OVR de temporada se arma con CINCO cosas
   (construir_pool_temporada.py:41):

        PTS 36%  ·  EVT 20%  ·  WR 16%  ·  POD 16%  ·  CAZ 12%

   ⚠️ PARTIDAS POR SERVIDOR, EL SHEET TIENE UNA SOLA: los puntos. Las otras
   cuatro son totales de la persona, no de la persona EN ese servidor. O sea
   que copiar la formula de la Temporada es imposible: tendria 36% de sus
   ingredientes y el 64% restante seria el MISMO valor en las diez cartas de
   esa persona.

   Eso no es un detalle de implementacion. Es lo que decide la respuesta.
""")
    # cuanta gente y cuantos puntos hay por servidor
    gente = collections.Counter()
    topes = {}
    for p in d:
        for s, v in p['pts_sv'].items():
            gente[s] += 1
            topes[s] = max(topes.get(s, 0), v)
    print('   %-6s %6s %10s %10s' % ('sv', 'gente', 'tope pts', '% del tope global'))
    print('   ' + '-' * 46)
    glob = max(topes.values())
    for s, g in gente.most_common():
        print('   %-6s %6d %10.0f %9.0f%%' % (s, g, topes[s], 100 * topes[s] / glob))
    print('''
   ⚠️ ACA ESTA LA DECISION, Y NO TIENE UNA RESPUESTA OBVIA. Para pasar los
   puntos a un numero de 40 a 99 hay que dividir por un tope, y hay dos:

     RELATIVO   el tope de TU servidor    -> el 1º de cada servidor saca 99,
                                             tambien el 1º de uno de 3
     ABSOLUTO   el tope de todos          -> comparables entre servidores,
                                             pero los servidores chicos sacan
                                             todos numeros bajos
''')
    # simular las dos
    for modo in ('RELATIVO', 'ABSOLUTO'):
        vals = collections.defaultdict(list)
        for p in d:
            for s, v in p['pts_sv'].items():
                tope = topes[s] if modo == 'RELATIVO' else glob
                vals[s].append(round(40 + math.sqrt(v / tope) * 59))
        print('   %s' % modo)
        for s, _g in gente.most_common():
            xs = sorted(vals[s])
            print('      %-6s  min %2d  mediana %2d  max %2d' %
                  (s, xs[0], xs[len(xs) // 2], xs[-1]))
        print()

    print('=' * 72)
    print('Y LO QUE RESUELVE LA CONTRA DE LA ESCALERA')
    print('=' * 72)
    print("""
   ⚠️ ESTO ES LO IMPORTANTE Y NO LO VI ANTES. La contra que le puse a la
   escalera por puesto era que SE PIERDE: entra alguien mejor y te corre.

   Los PUNTOS NO SE PIERDEN. Solo suben. Una escalera colgada de un OVR
   hecho de puntos NO SE PUEDE PERDER —igual que las escaleras de Discord
   que paso Dlx, que es justamente lo que el noto que tenian en comun—.

   ⚠️ PERO NO ALCANZA CON QUE SEAN PUNTOS: DEPENDE DEL TOPE POR EL QUE SE
   DIVIDE, y ahi me equivoque yo primero. Habia simulado el modo ABSOLUTO
   dejando el tope quieto, asi que me dio que no baja nadie —claro, yo mismo
   lo habia clavado—. El tope global SALE DEL POOL: es el mejor de todos, y
   si ese mejora, el divisor sube y BAJAN TODOS igual.

   Lo unico que no se mueve es un tope que NO salga del pool: una constante.
""")
    # ⚠️ los tres topes, y el de verdad importa: si sale del pool, se mueve
    modos = [('RELATIVO', 'tope del servidor, sacado del pool'),
             ('GLOBAL', 'tope del mejor de todos, sacado del pool'),
             ('FIJO 60', 'una constante que no sale del pool')]
    for modo, que in modos:
        mov = peor = 0
        for p in d:
            s = p['sv']
            v = p['pts_sv'][s]
            if modo == 'RELATIVO':
                t0, t1 = topes[s], topes[s] * 1.20
            elif modo == 'GLOBAL':
                t0, t1 = glob, glob * 1.20
            else:
                t0 = t1 = 60.0
            a = round(40 + math.sqrt(v / t0) * 59)
            b = round(40 + math.sqrt(v / t1) * 59)
            if a != b:
                mov += 1
                peor = max(peor, a - b)
        print('   %-9s %-38s BAJAN %3d de %d (%3.0f%%), hasta -%d'
              % (modo, que, mov, n, 100 * mov / n, peor))
    print("""
   ⚠️ Y ESTO YA PASA EN UNA CARTA TERMINADA. El OVR de temporada se
   normaliza igual —construir_pool_temporada.py:127, `tope = max(...)` del
   pool—, asi que el OVR de las 138 baja cuando el puntero mejora. No lo
   toco: es de la Temporada y no me lo pidieron. Pero si la Servidor va a
   colgar una escalera del numero, aca SI importa, porque un escalon que se
   cae es un reclamo.
""")


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

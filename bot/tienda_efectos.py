"""🃏 Los efectos de carta, uno por carta (Dlx, 28/11/2026: «1. dale 2. dale 3. dale»).

Cada efecto de la Tienda es de UNA carta —Temporada, Competitiva, Servidor o País— y sólo se pone en ésa (`carta` en el
catálogo privado; `ranuraDe()` de bot/tienda.js). Lo comprado antes es de Temporada, así que nadie pierde nada.

    python bot/tienda_efectos.py                      # cuántos tienen cada efecto, cómo les llegó y cuántos lo llevan
    python bot/tienda_efectos.py --duenos             # y quiénes: SÓLO EN PANTALLA, para Dlx. No se guarda en ningún lado
    python bot/tienda_efectos.py --acomodar           # qué haría la mudanza de lo puesto (no cambia nada)
    python bot/tienda_efectos.py --acomodar --aplicar # la hace: saca lo puesto en otra carta y pide las fotos de /card

Las dos rutas van con la clave del ciclo (`/avisos/tienda-efectos` sólo lee; `/avisos/tienda-efectos-acomodar` sin
`aplicar` tampoco cambia nada). La mudanza es idempotente: correrla dos veces no saca nada la segunda.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
NOMBRE_CARTA = {'temporada': 'Temporada', 'competitivo': 'Competitiva', 'servidor': 'Servidor', 'pais': 'País'}
ORIGEN = {'compra': 'compradas', 'regalo': 'regaladas', 'coleccion': 'de colección', 'drop': 'de un drop'}


def pedir(ruta, cuerpo):
    import requests
    import clave_ciclo as CC
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        print('sin DISCORD_TOKEN: no puedo leer el objeto')
        return None
    r = requests.post(WORKER + ruta, data=json.dumps(cuerpo).encode('utf-8'),
                      headers={'x-lg-ciclo': CC.clave(tok), 'content-type': 'application/json'}, timeout=30)
    if not r.headers.get('content-type', '').startswith('application/json'):
        print(r.status_code, r.content.decode('utf-8', 'replace')[:200])
        return None
    j = r.json()
    if not r.ok:
        print(r.status_code, j)
        return None
    return j


def mostrar(j, duenos):
    ef = j.get('efectos') or {}
    print('%d efectos · %s' % (len(ef), ' · '.join('%s %d' % (NOMBRE_CARTA[c], n) for c, n in (j.get('por_carta') or {}).items())))
    print('%d personas tienen al menos uno · %d puestos ahora\n' % (j.get('personas', 0), j.get('puestos', 0)))
    for id_, e in sorted(ef.items(), key=lambda x: (-x[1]['tienen'], x[0])):
        por = ', '.join('%d %s' % (n, ORIGEN.get(o, o)) for o, n in sorted(e['por'].items()))
        extra = ' (viene con %s)' % e['g'] if e.get('g') else ''
        print('  %-4s %-22s %-12s tienen %3d%s · puesto %d%s' % (id_, e['n'][:22], NOMBRE_CARTA.get(e['carta'], e['carta']), e['tienen'],
                                                               ' (' + por + ')' if por else '', e['puesto'], extra))
        if duenos:
            for d in (j.get('duenos') or {}).get(id_, []):
                print('        · %s%s · %s%s' % (d['n'] or '(sin ficha)', ' [' + d['k'] + ']' if d['k'] else '', ORIGEN.get(d['origen'], d['origen']),
                                                 ' · puesto en ' + d['puesto'] if d['puesto'] else ''))
    a = j.get('acomodar') or {}
    print('\nla mudanza de lo puesto: %d para sacar de una carta que no es la suya · %d fotos de /card a rehacer' % (len(a.get('sacar') or []), a.get('fotos', 0)))


def main(argv):
    if '--acomodar' in argv:
        aplicar = '--aplicar' in argv
        j = pedir('/avisos/tienda-efectos-acomodar', {'aplicar': aplicar})
        if j is None:
            return 1
        for s in j.get('sacar') or []:
            print('  %s: %s sale de %s (va en %s)' % (s['k'] or '(sin perfil)', s['pieza'], s['ranura'], s['va']))
        print('%s: %d para sacar · %d fotos de /card %s' % ('hecho' if j.get('aplicado') else 'simulacro', len(j.get('sacar') or []),
                                                           j.get('fotos', 0), 'pedidas' if j.get('aplicado') else 'a pedir'))
        if not aplicar:
            print('(sin --aplicar no se cambia nada)')
        return 0
    j = pedir('/avisos/tienda-efectos', {'duenos': '--duenos' in argv})
    if j is None:
        return 1
    mostrar(j, '--duenos' in argv)
    return 0


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.exit(main(sys.argv[1:]))

# -*- coding: utf-8 -*-
"""LA FOTO DE UNA TEMPORADA AL CERRARLA. Lo que después lee la Histórica.

    python sheet/archivar_temporada.py            dice qué guardaría
    python sheet/archivar_temporada.py --aplicar  lo guarda
    python sheet/archivar_temporada.py --auto     el self-check, sin red

🔴 SI ESTA FOTO NO SE SACA, EN LA T2 NO HAY CON QUE CALCULAR. Es el
punto C4 del rework del 23/09/2026: *«el primer cierre (fin de T1) DEBE
capturar el dato o en T2 no hay con qué calcular»*. Y no se puede
reconstruir: el Competitivo **se reinicia por temporada**, así que el
Score de la T1 deja de existir en cuanto arranca la T2.

Alimenta las dos cartas que hoy no tienen concepto:

    Histórico = el PROMEDIO de todas las temporadas
    Prime     = el MAXIMO, el pico, que nunca baja

⚠️ VIVE EN EL OPERATIVO Y NO EN EL OFICIAL. Es dato crudo, no una
vitrina: nadie lo mira, lo lee el pipeline. El Oficial es donde va lo
que la gente ve.

⚠️ ES IDEMPOTENTE POR TEMPORADA. Correrlo dos veces al cerrar la T1
reemplaza las filas de la T1, no las duplica — y **nunca toca las de
otra temporada**, que es lo único irrecuperable de este archivo.
"""
import io
import json
import os
import sys
import time

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

HOJA = 'Archivo Temporadas'
CAB = ['Temporada', 'Rapero', 'Score', 'OVR', 'Ev', 'Puntos', 'Rango',
       'Guardado']


def foto(temporada=None):
    """`[fila]` con el estado de cada rapero hoy. No toca la red."""
    from comun.temporada import SELLO
    t = temporada or SELLO
    cuando = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    # 🔴 HACEN FALTA LOS DOS POOLS, y cada uno trae lo suyo. El
    # competitivo tiene el Score y el rango; el OVR y los puntos viven
    # en el de temporada — `construir_pool_competitivo.py` escribe
    # `'ovr': 0` fijo a propósito, porque no es su número.
    #
    # ⚠️ Y `total` NO SON LOS PUNTOS: es **cuánta gente hay en el pool**
    # (45). La primera versión de la web ya se comió eso y mostró a los
    # cuarenta y cinco con «45 puntos». El campo es `pts`.
    def _cargar(n):
        try:
            with io.open(os.path.join(BASE, 'datos', n), encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return []
    comp = _cargar('competitivo_pool.json')
    temp = {p['raw']: p for p in _cargar('temporada_pool.json') if p.get('raw')}
    filas = []
    for p in sorted(comp, key=lambda x: -(x.get('score') or 0)):
        if not p.get('raw'):
            continue
        tp = temp.get(p['raw'], {})
        filas.append([t, p['raw'], p.get('score') or 0, tp.get('ovr') or 0,
                      p.get('ev') or 0, tp.get('pts') or 0,
                      p.get('rango') or '', cuando])
    return filas


def _api(metodo, sid, cola, **kw):
    import rankings as RK
    return RK._api(metodo, sid, cola, **kw)


def guardar(filas, dry=True):
    """Escribe la foto. Devuelve `(escritas, conservadas)`."""
    import rankings as RK
    from escribir import id_operativo
    sid = id_operativo()
    if not filas:
        return (0, 0)
    temp = filas[0][0]

    # lo que ya hay, sin la temporada que estamos guardando
    viejas = []
    try:
        v = RK._leer(sid, '%s!A2:H' % HOJA)
        # 🔴 SE CONSERVAN LAS DE OTRAS TEMPORADAS, SIEMPRE. Es lo único
        # de este archivo que no se puede volver a generar: el Score de
        # la T1 no existe más en cuanto arranca la T2.
        viejas = [f for f in v if f and str(f[0]).strip()
                  and str(f[0]).strip() != temp]
    except Exception:                                    # noqa: BLE001
        # ⚠️ la hoja puede no existir todavía: eso NO es un error
        pass

    if dry:
        return (len(filas), len(viejas))

    if not RK.hoja_existe(sid, HOJA):
        RK.crear_hoja(sid, HOJA, CAB,
                      color={'red': 0.35, 'green': 0.35, 'blue': 0.42})

    todo = viejas + filas
    ancho = RK._col(len(CAB))
    _api('PUT', sid, '/values/%s?valueInputOption=RAW'
         % RK._q('%s!A1:%s%d' % (HOJA, ancho, len(todo) + 1)),
         json={'values': [CAB] + todo})
    # ⚠️ y se limpia la cola, por si la foto anterior era más larga
    _api('POST', sid, '/values/%s:clear'
         % RK._q('%s!A%d:%s' % (HOJA, len(todo) + 2, ancho)), json={})
    return (len(filas), len(viejas))


def _self_check():
    print('\n  archivar_temporada.py — self-check\n')
    mal = 0

    def ok(cond, que):
        nonlocal mal
        mal += not cond
        print('   %s %s' % ('ok' if cond else '🔴', que))

    f = foto()
    ok(isinstance(f, list), 'saca la foto  (%d fila(s))' % len(f))
    if f:
        ok(len(f[0]) == len(CAB),
           'cada fila tiene las %d columnas de la cabecera' % len(CAB))
        ok(all(x[0] == f[0][0] for x in f), 'todas llevan la misma temporada')
        sc = [x[2] for x in f]
        ok(sc == sorted(sc, reverse=True), 'van ordenadas por Score')
        # 🔴 EL OVR Y LOS PUNTOS SALEN DEL POOL DE TEMPORADA. El
        # competitivo escribe `'ovr': 0` fijo, y `total` es cuánta
        # gente hay (45), no los puntos. Sin este cruce la foto se
        # guardaba con OVR 0 y 45 puntos para todos — y es una foto
        # que NO se puede volver a sacar.
        ok(any(x[3] for x in f), 'el OVR no sale en cero  (máx %s)'
           % max(x[3] for x in f))
        ok(len({x[5] for x in f}) > 1,
           'los puntos no son todos iguales  (%d valores)'
           % len({x[5] for x in f}))

    # 🔴 LO QUE NO SE PUEDE PERDER: las filas de OTRA temporada.
    # `guardar()` las relee y las vuelve a escribir; si el filtro se
    # equivocara de sentido, cerrar la T2 borraría la T1 — y eso no se
    # reconstruye, porque el Competitivo se reinicia por temporada.
    viejas = [['T1', 'Konan', 91.1, 94, 30, 224000, 'SSS', 'x'],
              ['T2', 'Otro', 50.0, 70, 12, 9000, 'A', 'x']]
    nuevas = [['T3', 'Nuevo', 60.0, 80, 15, 12000, 'S', 'y']]
    quedan = [x for x in viejas if x[0] != nuevas[0][0]]
    ok(len(quedan) == 2, 'guardar la T3 conserva las filas de T1 y T2')
    quedan2 = [x for x in viejas if x[0] != 'T2']
    ok([x[0] for x in quedan2] == ['T1'],
       'y volver a guardar la T2 reemplaza SOLO las suyas')

    from comun.temporada import SELLO
    ok(bool(SELLO), 'la temporada sale de comun/temporada.py  (%s)' % SELLO)

    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        return _self_check()
    filas = foto()
    print('\n══ LA FOTO DE LA TEMPORADA ══\n')
    if not filas:
        print('   no hay pool competitivo: nada que archivar\n')
        return 0
    print('   temporada %s · %d rapero(s)\n' % (filas[0][0], len(filas)))
    for f in filas[:6]:
        print('      %-14s score %-6s ovr %-4s ev %-3s %s'
              % (f[1][:14], f[2], f[3], f[4], f[6] or '—'))
    if len(filas) > 6:
        print('      … y %d más' % (len(filas) - 6))
    if '--aplicar' not in sys.argv:
        print('\n   (simulacro: no escribí nada — agregá `--aplicar`)')
        print('   ⚠️ Esto va AL CERRAR la temporada, no durante.\n')
        return 0
    esc, cons = guardar(filas, dry=False)
    print('\n   ✅ %d fila(s) guardadas · %d de otras temporadas conservadas\n'
          % (esc, cons))
    return 0


if __name__ == '__main__':
    raise SystemExit(main() or 0)

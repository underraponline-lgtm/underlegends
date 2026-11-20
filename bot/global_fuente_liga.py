# -*- coding: utf-8 -*-
"""🌍 LA LIGA COMO FUENTE DEL RANKING GLOBAL: cada 1v1 de la temporada, con el mismo formato que FMS y Freestylestats.

    python bot/global_fuente_liga.py --ver     cuántas batallas y eventos salen, y unas de muestra
    python bot/global_fuente_liga.py --auto    self-check

Sale de los archivos que ya escribe el ciclo (`datos/t1_1v1.json`, `t1_eventos.json`, `t1_resultados.json`), así que
no pide red. Los nombres pasan por `rankings.canon()` —el mismo embudo de los AKAs que usan las vitrinas—, o la misma
persona escrita de dos maneras sería dos filas del ranking global.

⚠️ LA LIGA NO TIENE RÉPLICAS NI VOTOS: `replica` y `votos` van en None. Por eso quien pierde en la Liga no suma nada (la
fórmula sólo le da algo a quien pierde CON réplica).
"""
import datetime as dt
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE, os.path.join(BASE, 'sheet')):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from comun import claves  # noqa: E402
from comun import temporada  # noqa: E402

# Las rondas de la Liga, a las del ranking global. Lo que no es una ronda de eliminación vale como una ronda temprana.
RONDAS = {'final': 'final', 'semifinales': 'semifinal', 'semifinal': 'semifinal', 'cuartos': 'cuartos',
          'octavos': 'octavos', 'dieciseisavos': '16avos', '16avos': '16avos', 'tercer lugar': 'tercer',
          'filtros': 'filtro', 'filtro': 'filtro', '5 vidas': 'grupos', 'llave de perdedores': 'repechaje',
          'llave de ganadores': 'octavos'}

# Un evento de menos de 8 es «lo demás» (Dlx, 20/11/2026: la Liga 0,3 y lo que no pasa el mínimo, lo más bajo).
MIN_PARTICIPANTES = 8


def _leer(nombre):
    try:
        with io.open(os.path.join(BASE, 'datos', nombre), encoding='utf-8') as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def _fecha(ddmm, anio):
    m = re.match(r'^\s*(\d{1,2})/(\d{1,2})', str(ddmm or ''))
    if not m:
        return None
    try:
        return dt.date(anio, int(m.group(2)), int(m.group(1))).isoformat()
    except ValueError:
        return None


def _canon():
    try:
        import rankings
        return rankings.canon
    except Exception:  # sin el módulo se sigue con los nombres crudos: es peor no tener la Liga que no fusionar
        return lambda s: s


def leer(desde=None, hasta=None, red=False, filas_1v1=None, filas_eventos=None, filas_resultados=None):
    """{'batallas': [...], 'mvp': [], 'avisos': [...], 'semillas': {id: elo}} con los 1v1 de la Liga en la ventana."""
    d0, d1 = temporada.FECHAS[temporada.ACTUAL]
    desde, hasta = desde or d0, hasta or d1
    anio = int(d0[:4])
    canon = _canon()
    v = filas_1v1 if filas_1v1 is not None else (_leer('t1_1v1.json').get('filas') or [])
    ev = filas_eventos if filas_eventos is not None else (_leer('t1_eventos.json').get('filas') or [])
    res = filas_resultados if filas_resultados is not None else (_leer('t1_resultados.json').get('filas') or [])
    avisos = []

    eventos = {}
    for f in ev:
        if not f:
            continue
        try:
            n = int(f[0])
        except (TypeError, ValueError):
            continue
        try:
            part = int(f[4] or 0)
        except (TypeError, ValueError):
            part = 0
        eventos[n] = {'nombre': str(f[1] or '#%d' % n).strip(), 'sv': str(f[2] or '').strip(), 'part': part,
                      'fecha': _fecha(f[3], anio)}

    pais = {}
    for f in res:
        if len(f) > 5 and f[4] and f[5]:
            pais[canon(str(f[4]).strip())] = str(f[5]).strip().lower()[:2]

    def persona(nombre):
        n = canon(str(nombre or '').strip())
        return {'nombre': n, 'id': 'liga:' + claves.clave(n), 'pais': pais.get(n)}

    batallas, vistos = [], {}
    for f in v:
        if len(f) < 7:
            continue
        try:
            n = int(f[0])
        except (TypeError, ValueError):
            continue
        e = eventos.get(n) or {}
        fecha = e.get('fecha') or _fecha(f[1], anio)
        if not fecha or not (desde <= fecha <= hasta):
            continue
        a, b = persona(f[4]), persona(f[5])
        if not a['nombre'] or not b['nombre'] or a['id'] == b['id']:
            avisos.append('#%s: batalla sin dos raperos distintos (%s contra %s), no cuenta' % (n, f[4], f[5]))
            continue
        g = canon(str(f[6] or '').strip())
        gana = 'a' if g == a['nombre'] else 'b' if g == b['nombre'] else None
        ronda_cruda = str(f[3] or '').strip().lower()
        ronda = RONDAS.get(ronda_cruda, 'octavos')
        base = 'liga:%d:%s:%s|%s' % (n, ronda, a['id'][5:], b['id'][5:])
        vistos[base] = vistos.get(base, 0) + 1
        part = e.get('part') or 0
        batallas.append({
            'id': base if vistos[base] == 1 else '%s#%d' % (base, vistos[base]),
            'fuente': 'liga', 'url': None,
            'evento': {'id': 'liga-%d' % n, 'nombre': e.get('nombre') or '#%d' % n,
                       'tipo': 'liga' if part >= MIN_PARTICIPANTES else 'liga_chica', 'pais': None, 'fecha': fecha,
                       'sv': e.get('sv') or str(f[2] or ''), 'n': n},
            'ronda': ronda, 'a': a, 'b': b, 'gana': gana, 'replica': None, 'votos': None, 'pts': None})

    semillas = {}
    try:
        import elo as EL
        import competencias as CO
        tabla = EL.calcular(_leer('llaves_t1.json'))
        por_norm = {k: x.get('elo') for k, x in (tabla or {}).items()}
        for btl in batallas:
            for lado in ('a', 'b'):
                p = btl[lado]
                e = por_norm.get(CO.norm(p['nombre']))
                if e is not None:
                    semillas[p['id']] = e
    except Exception as e:  # sin ELO la fuerza del rival sale sólo de los resultados
        avisos.append('no pude calcular el ELO de la Liga (%s): la fuerza sale sólo de los resultados' % type(e).__name__)
    return {'batallas': batallas, 'mvp': [], 'avisos': avisos, 'semillas': semillas}


def _self_check():
    mal = []
    v = [[900, '01/10', 'FFA', 'final', 'Ana', 'Bea', 'Ana', 'Bea'],
         [900, '01/10', 'FFA', 'semifinales', 'Ana', 'Cami', 'Ana', 'Cami'],
         [901, '02/10', 'FFA', '5 vidas', 'Bea', 'Bea', 'Bea', 'Bea'],
         [902, '01/08', 'FFA', 'final', 'Ana', 'Dora', 'Ana', 'Dora']]
    ev = [[900, 'COPA PRUEBA', 'FFA', '01/10', 12, '8+'], [901, 'CHICA', 'FFA', '02/10', 4, '4+']]
    r = leer('2026-09-22', '2026-12-31', filas_1v1=v, filas_eventos=ev,
             filas_resultados=[[900, '01/10', 'FFA', '8+', 'Ana', 'ar', 'Campeón', 100]])
    b = r['batallas']
    if len(b) != 2:
        mal.append('esperaba 2 batallas (la de agosto queda afuera y la de Bea contra Bea no cuenta), hay %d' % len(b))
    if b and (b[0]['gana'] != 'a' or b[0]['ronda'] != 'final' or b[0]['evento']['tipo'] != 'liga'):
        mal.append('la final de Ana: %r' % b[0])
    if b and b[0]['a']['pais'] != 'ar':
        mal.append('el país de Ana sale de Resultados: %r' % b[0]['a'])
    if not any('no cuenta' in a for a in r['avisos']):
        mal.append('la batalla de una persona contra sí misma tiene que avisar')
    for m in mal:
        print('🔴', m)
    print('✅ global_fuente_liga: bien' if not mal else '🔴 global_fuente_liga: %d problemas' % len(mal))
    return 1 if mal else 0


def main():
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    r = leer()
    evs = {}
    for b in r['batallas']:
        evs.setdefault(b['evento']['id'], 0)
        evs[b['evento']['id']] += 1
    print('%d batallas en %d eventos; %d con ELO; %d avisos' % (len(r['batallas']), len(evs), len(r['semillas']),
                                                              len(r['avisos'])))
    for b in r['batallas'][-5:]:
        print('  ', b['evento']['fecha'], b['evento']['nombre'], b['ronda'], b['a']['nombre'], 'vs', b['b']['nombre'],
              '→', b['gana'])
    for a in r['avisos'][:10]:
        print('  ⚠️', a)


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()

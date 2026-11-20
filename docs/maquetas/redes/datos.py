# -*- coding: utf-8 -*-
"""Los datos reales de una semana de un servidor, para la maqueta de las imágenes para redes.

    python datos.py <repo> CH FFA      -> datos_CH.json, datos_FFA.json (al lado de este archivo)
"""
import base64
import io
import json
import os
import sys

R = os.path.abspath(sys.argv[1])
sys.path[:0] = [os.path.join(R, 'bot'), os.path.join(R, 'sheet'), R]
os.chdir(R)
import noche as NO          # noqa: E402
import kit as K             # noqa: E402
from comun import banderas as BA   # noqa: E402

AQUI = os.path.dirname(os.path.abspath(__file__))
INI, FIN = '2026-11-16', '2026-11-22'
ORDEN = NO.ORDEN_PUESTO


def b64f(p, tipo):
    return 'data:%s;base64,%s' % (tipo, base64.b64encode(open(p, 'rb').read()).decode())


def bandera(cc):
    try:
        return BA.src(cc) if cc and len(cc) == 2 else ''
    except Exception:                                    # noqa: BLE001
        return ''


def semana(sv):
    D = NO.cargar()
    LL = D['LL']
    notas = NO._j('notas_eventos.json', {})
    evs = sorted((v for v in LL.values() if v.get('sv') == sv and INI <= str(v.get('dia', '')) <= FIN),
                 key=lambda v: (v['dia'], int(v['n'])))
    gente, out_ev, batallas = {}, [], {}
    for e in evs:
        n = str(e['n'])
        ccs = {NO.clave(r['n']): r['cc'] for r in D['RES'].get(n, [])}
        nt = (notas.get(n) or {}).get('notas') or {}
        ntk = {NO.clave(k): v for k, v in nt.items()}
        tabla = e.get('tabla') or []
        camp = next((f for f in tabla if str(f[1]).startswith('Campe')), None)
        sub = next((f for f in tabla if str(f[1]).startswith('Subcampe')), None)
        mvp = (notas.get(n) or {}).get('mvp') or ''
        out_ev.append({'n': n, 'nombre': e.get('nombre') or '', 'dia': e['dia'], 'fecha': e.get('fecha') or '',
                       'jug': int(e.get('participantes') or len(tabla)),
                       'camp': NO.limpio(camp[0]) if camp else '', 'sub': NO.limpio(sub[0]) if sub else '',
                       'mvp': NO.limpio(mvp), 'nota_camp': ntk.get(NO.clave(camp[0])) if camp else None,
                       'nota_mvp': ntk.get(NO.clave(mvp)) if mvp else None})
        # ⚔️ las batallas de la llave: [[a, b], ganador, …] por ronda
        for ro in e.get('rondas') or []:
            for bt in (ro.get('b') if isinstance(ro, dict) else []) or []:
                if not (isinstance(bt, list) and len(bt) >= 2 and isinstance(bt[0], list)):
                    continue
                gan = NO.clave(bt[1]) if bt[1] else ''
                for x in bt[0]:
                    kx = NO.clave(x)
                    if kx:
                        bat = batallas.setdefault(kx, [0, 0])
                        bat[1] += 1
                        bat[0] += kx == gan
        for f in tabla:
            k = NO.clave(f[0])
            g = gente.setdefault(k, {'n': NO.limpio(f[0]), 'k': k, 'cc': ccs.get(k, ''), 'pts': 0, 'ev': 0, 'tit': 0,
                                     'fin': 0, 'mejor': 9, 'nota': 0.0, 'notas': []})
            try:
                g['pts'] += int(float(f[2] or 0))
            except (TypeError, ValueError):
                pass
            g['ev'] += 1
            p = ORDEN.get(str(f[1]), 8)
            g['mejor'] = min(g['mejor'], p)
            g['tit'] += p == 0
            g['fin'] += p <= 1
            if ntk.get(k) is not None:
                g['notas'].append(ntk[k])
                g['nota'] = max(g['nota'], ntk[k])
            if not g['cc'] and ccs.get(k):
                g['cc'] = ccs[k]
    top = sorted(gente.values(), key=lambda g: (-g['pts'], -g['tit'], -g['nota']))
    vit = NO._j('t1_vitrina_temporada.json', {})
    cab = vit.get('cabecera') or []
    iR = cab.index('Rapero') if 'Rapero' in cab else 1
    oficial = {NO.clave(f[iR]): NO.limpio(f[iR]) for f in vit.get('filas') or [] if len(f) > iR}
    for g in top:
        g['n'] = oficial.get(g['k'], g['n'])
    nom = lambda x: oficial.get(NO.clave(x), x) if x else x   # noqa: E731
    for e in out_ev:
        for c in ('camp', 'sub', 'mvp'):
            e[c] = nom(e[c])
    for i, g in enumerate(top[:5]):
        g['pos'] = i + 1
        g['fl'] = bandera(g['cc'])
        g['carta'] = NO.carta(g['n'], sv)
        g['sil'] = '' if g['carta'] else K._sil_vs(g['n'])
        g['prom'] = round(sum(g['notas']) / len(g['notas']), 1) if g['notas'] else None
        g['bg'], g['bj'] = batallas.get(g['k'], [0, 0])
    sd = K._sv_datos(sv)
    camp = max(top, key=lambda g: (g['tit'], g['pts'])) if top else None
    return {'sv': sv, 'nombre': sd['nombre'], 'color': sd['color'], 'logo': sd['logo'],
            'ul': b64f(os.path.join(R, 'bot', 'paginas', 'ul-blanco.png'), 'image/png'),
            'ini': INI, 'fin': FIN, 'eventos': out_ev, 'top': top[:5], 'jugaron': len(gente),
            'camp': camp['k'] if camp else '', 'campeones': sorted({e['camp'] for e in out_ev if e['camp']})}


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass
    for sv in sys.argv[2:]:
        d = semana(sv)
        io.open(os.path.join(AQUI, 'datos_%s.json' % sv), 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False))
        print(sv, d['nombre'], d['color'], len(d['eventos']), 'eventos', d['jugaron'], 'jugaron', 'campeones', d['campeones'])
        for g in d['top']:
            print('  #%d %s %s pts=%d ev=%d tit=%d nota=%s carta=%s' % (g['pos'], g['n'], g['cc'], g['pts'], g['ev'], g['tit'],
                                                                         g['nota'], 'sí' if g['carta'] else 'no'))
        for e in d['eventos']:
            print('  ev', e['n'], e['nombre'], e['fecha'], e['jug'], e['camp'], e['nota_camp'], 'mvp', e['mvp'], e['nota_mvp'])

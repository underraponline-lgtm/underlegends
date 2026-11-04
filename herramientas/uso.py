# -*- coding: utf-8 -*-
"""CUANTA GENTE USA LA PAGINA Y EL BOT, y que consulta lee mas.

    python herramientas/uso.py          todo lo que se puede leer: visitas, personas y filas
    python herramientas/uso.py --json   lo del objeto, crudo, para armar un informe
    python herramientas/uso.py --auto   el self-check, sin red

Dlx, 04/11/2026: *«traeme un informe acerca de cuanta gente esta usando la pagina en estos momentos vs antes»*.

⚠️ SON TRES FUENTES Y CUENTAN COSAS DISTINTAS. Medido ese dia: 47 visitas, 225 paginas vistas y 34 a 44 navegadores por dia.
   `medidas.pedidos` NO sirve para contar visitas: guarda solo lo que mas se pide, y por eso primero dio 11.

    Cloudflare Web Analytics   visitas (cada vez que alguien entra) y paginas vistas. Prendido desde el 14/10/2026, sin
                               cookies. Hasta el 29/10 cuenta 1 de cada 10 y multiplica. Se lee con el token de Cloudflare
    el objeto (`/avisos/uso-ciclo`)
        personas   cuentas de Discord distintas que usaron el bot o hicieron algo en la pagina con su cuenta. La semana
                   entera, sin repetir: por eso no es la suma de bot y web. Se guardan 35 dias (`USO_DIAS`)
        visitas    OTRA COSA QUE LAS DE ARRIBA: una por navegador y por dia. La misma persona en el celular y en la compu
                   son dos, y quien entra diez veces es una. Se guardan 90 dias
        k          lo mismo, pero solo los primeros dias de esa semana: para comparar una semana que va por la mitad
    Cloudflare, analitica del objeto   las filas leidas por dia, contra el tope de 5 millones

⚠️ Las «llamadas» de Pages (`pagesFunctionsInvocationsAdaptiveGroups`) NO miden gente: una pestana abierta suma ~30 por hora
aunque nadie la mire, y el numero cambia si la pagina empieza a pedir mas cosas.
"""
import datetime as dt
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'bot'))

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
#: lo que el objeto puede leer por dia de Cloudflare (`cuotas.LIM`)
TOPE_FILAS = 5_000_000
#: desde cuando hay Web Analytics
ANALITICA_DESDE = dt.date(2026, 10, 14)
#: cada direccion, a que pagina pertenece
GRUPOS = [(r'^/freestyle-rap/?$', 'Inicio'), (r'^/freestyle-rap/ranking', 'Ranking'), (r'^/freestyle-rap/r/', 'Perfiles'),
          (r'^/freestyle-rap/competencias', 'Competencias'), (r'^/freestyle-rap/pase', 'Pase'), (r'^/freestyle-rap/ligas?', 'Ligas'),
          (r'^/freestyle-rap/eventos', 'Eventos'), (r'^/freestyle-rap/llave', 'Llaves'), (r'^/freestyle-rap/inventario', 'Inventario'),
          (r'^/freestyle-rap/sv/', 'Servidores'), (r'^/freestyle-rap/crews?', 'Crews'), (r'^/freestyle-rap/tarjetas', 'Tarjetas'),
          (r'^/freestyle-rap/publicaciones', 'Publicaciones'), (r'^/freestyle-rap/tienda', 'Tienda'), (r'^/freestyle-rap/salon', 'Salon'),
          (r'^/freestyle-rap/socios', 'Socios'), (r'^/freestyle-rap/guia', 'Guia'), (r'^/freestyle-rap/pais', 'Paises'),
          (r'^/(cuenta|ajustes)', 'Tu cuenta'), (r'^/dashboard', 'Dashboard'), (r'^/socio', 'Panel del socio'), (r'^/cambios', 'Cambios')]


def semanas_txt(semanas):
    """Las filas de la tabla por semana, de la mas vieja a la de ahora."""
    out = []
    for w in semanas:
        k = w.get('k') or {}
        n = lambda v: '—' if v is None else str(v)
        out.append('%s   personas %4s (bot %4s · web %4s)   navegadores %4s   a igual dia: personas %4s, navegadores %4s' % (
            w.get('lunes'), n(w.get('personas')), n(w.get('bot')), n(w.get('web')), n(w.get('visitas')),
            n(k.get('personas')), n(k.get('visitas'))))
    return out


def filas_txt(medida, cuantas=15):
    """Lo que mas leyo el objeto ese dia, con su parte de lo medido."""
    filas = (medida or {}).get('filas') or {}
    tot = sum(filas.values())
    if not tot:
        return ['(todavia no hay nada medido)']
    # el día de Cloudflare es UTC: después de las 7 PM ET (8 PM en verano), «hoy» ya trae la fecha de mañana
    out = ['%s (día de Cloudflare): %s filas medidas, %d %% del tope' % (medida.get('dia'), format(tot, ','), round(100 * tot / TOPE_FILAS))]
    for q, n in sorted(filas.items(), key=lambda x: -x[1])[:cuantas]:
        out.append('  %9s  %3d %%  %s' % (format(n, ','), round(100 * n / tot), q[:90]))
    return out


def agrupar_paginas(filas):
    """`[(direccion, vistas)]` -> `[(pagina, vistas)]`, de la mas vista a la menos. Lo que no es de ninguna, afuera."""
    g = {}
    for p, n in filas:
        for pat, nom in GRUPOS:
            if re.match(pat, p or ''):
                g[nom] = g.get(nom, 0) + n
                break
    return sorted(g.items(), key=lambda t: -t[1])


def por_semana(dias, hoy):
    """`{fecha: [paginas, visitas]}` -> las semanas, de lunes a domingo, sin el dia de hoy que todavia no termino."""
    sem = {}
    for d, (n, v) in dias.items():
        if d >= hoy:
            continue
        x = sem.setdefault(d - dt.timedelta(days=d.weekday()), [0, 0, 0])
        x[0] += n
        x[1] += v
        x[2] += 1
    return [(l, round(x[1] / x[2]), round(x[0] / x[2]), x[2]) for l, x in sorted(sem.items())]


def _auto():
    s = semanas_txt([{'lunes': '2026-11-02', 'personas': 3, 'bot': 2, 'web': 2, 'visitas': 9, 'k': {'personas': 1, 'visitas': 4}},
                     {'lunes': '2026-08-03', 'personas': None, 'bot': None, 'web': None, 'visitas': 5, 'k': {}}])
    assert '2026-11-02' in s[0] and 'personas    3' in s[0] and 'navegadores    9' in s[0], s[0]
    assert 'personas    —' in s[1], s[1]
    f = filas_txt({'dia': '2026-11-04', 'filas': {'SELECT a': 300, 'SELECT b': 100}})
    assert '400 filas' in f[0] and 'SELECT a' in f[1] and '75 %' in f[1], f
    assert filas_txt(None) == ['(todavia no hay nada medido)']
    g = agrupar_paginas([('/freestyle-rap/', 5), ('/freestyle-rap/r/a', 2), ('/freestyle-rap/r/b', 4), ('/raro', 9)])
    assert g == [('Perfiles', 6), ('Inicio', 5)], g
    w = por_semana({dt.date(2026, 11, 2): [10, 2], dt.date(2026, 11, 3): [20, 4], dt.date(2026, 11, 4): [99, 99]}, dt.date(2026, 11, 4))
    assert w == [(dt.date(2026, 11, 2), 3, 15, 2)], w
    print('✅ uso: las tablas se arman bien')


def cloudflare(tok):
    """Lo de Cloudflare: no necesita el Worker nuevo ni la clave del ciclo."""
    import requests
    from zoneinfo import ZoneInfo
    import cuotas as C
    et = ZoneInfo('America/New_York')
    h = {'Authorization': 'Bearer ' + tok}
    sitio = requests.get('https://api.cloudflare.com/client/v4/accounts/%s/rum/site_info/list' % C.CUENTA, headers=h, timeout=30).json()
    tag = ((sitio.get('result') or [{}])[0]).get('site_tag')

    def pedir(dim, ini, fin, limite=500):
        q = ('query($a:String!,$f:AccountRumPageloadEventsAdaptiveGroupsFilter_InputObject!){viewer{accounts(filter:{accountTag:$a}){'
             'rumPageloadEventsAdaptiveGroups(limit:%d,filter:$f){count sum{visits} dimensions{%s}}}}}' % (limite, dim))
        j = requests.post('https://api.cloudflare.com/client/v4/graphql', headers=h, timeout=40, json={'query': q, 'variables': {
            'a': C.CUENTA, 'f': {'datetime_geq': ini.isoformat().replace('+00:00', 'Z'), 'datetime_leq': fin.isoformat().replace('+00:00', 'Z'),
                                 'siteTag': tag, 'bot': 0}}}).json()
        return j['data']['viewer']['accounts'][0]['rumPageloadEventsAdaptiveGroups']

    if tag:
        ahora = dt.datetime.now(dt.timezone.utc)
        dias = {}
        c = dt.datetime.combine(ANALITICA_DESDE, dt.time(4), dt.timezone.utc)
        # de a 4 dias: por hora son 96 filas y asi no se corta, y la hora dice a que dia del este pertenece
        while c < ahora:
            f = min(c + dt.timedelta(days=4), ahora)
            for x in pedir('datetimeHour', c, f, 200):
                d = dt.datetime.fromisoformat(x['dimensions']['datetimeHour'].replace('Z', '+00:00')).astimezone(et).date()
                y = dias.setdefault(d, [0, 0])
                y[0] += x['count']
                y[1] += x['sum']['visits']
            c = f
        print('\nVISITAS Y PAGINAS VISTAS POR DIA (Web Analytics, promedio de cada semana)')
        for l, v, n, k in por_semana(dias, ahora.astimezone(et).date()):
            print('%s   visitas %4d   paginas %4d   (%d dias)' % (l, v, n, k))
        print('\nLO MAS VISTO, ULTIMOS 7 DIAS')
        top = agrupar_paginas([(x['dimensions']['requestPath'], x['count']) for x in pedir('requestPath', ahora - dt.timedelta(days=7), ahora, 2000)])
        print('  ' + ' · '.join('%s %d' % t for t in top))
    # las filas del objeto
    q = ('{ viewer { accounts(filter:{accountTag:"%s"}) { durableObjectsPeriodicGroups(limit:20, orderBy:[date_ASC], filter:{date_geq:"%s"}) '
         '{ dimensions { date } sum { rowsRead } } } } }' % (C.CUENTA, (dt.date.today() - dt.timedelta(days=9)).isoformat()))
    j = requests.post('https://api.cloudflare.com/client/v4/graphql', headers=h, json={'query': q}, timeout=40).json()
    print('\nFILAS QUE LEYO EL OBJETO POR DIA (tope: 5 millones; el dia de Cloudflare es UTC)')
    for x in j['data']['viewer']['accounts'][0]['durableObjectsPeriodicGroups']:
        print('%s   %9s   %3d %%' % (x['dimensions']['date'], format(x['sum']['rowsRead'], ','), round(100 * x['sum']['rowsRead'] / TOPE_FILAS)))


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        return _auto()
    import requests
    import clave_ciclo as CC
    import fotos as F
    if '--json' not in sys.argv:
        tok = F.env('CLOUDFLARE_API_TOKEN', obligatorio=False)
        if tok:
            cloudflare(tok)
        else:
            print('falta CLOUDFLARE_API_TOKEN en .env: sin visitas ni filas')
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        sys.exit('falta DISCORD_TOKEN en .env')
    r = requests.get(WORKER + '/avisos/uso-ciclo', headers={'x-lg-ciclo': CC.clave(tok)}, timeout=30)
    if r.status_code == 404:
        sys.exit('\nLAS PERSONAS: el Worker desplegado todavia no tiene esta ruta. Corre `python bot/desplegar.py`')
    r.raise_for_status()
    j = r.json()
    if '--json' in sys.argv:
        print(json.dumps(j, ensure_ascii=False, indent=1))
        return
    print('\nPERSONAS POR SEMANA (de lunes a domingo, hora del este)')
    print('\n'.join(semanas_txt(j.get('semanas') or [])))
    print('\nLOS ULTIMOS 14 DIAS')
    for d in (j.get('dias') or [])[-14:]:
        print('%s   bot %4d   web %4d   navegadores %4d' % (d['dia'], d['bot'], d['web'], d['visitas']))
    errs = j.get('errores') or []
    print('\nLO QUE SE ROMPIO EN LA PAGINA, 7 DIAS' + ('' if errs else ': nada'))
    for e in errs[:12]:
        print('  %3d veces · %s · %s' % (e.get('n') or 0, str(e.get('donde'))[:40], str(e.get('msg'))[:90]))
    print('\nLO QUE MAS LEYO EL OBJETO')
    fi = j.get('filas') or {}
    print('\n'.join(filas_txt(fi.get('hoy'))))
    print('\n'.join(filas_txt(fi.get('ayer'), 8)))


if __name__ == '__main__':
    main()

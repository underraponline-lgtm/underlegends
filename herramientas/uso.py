# -*- coding: utf-8 -*-
"""CUANTA GENTE USA LA PAGINA Y EL BOT, y que consulta lee mas.

    python herramientas/uso.py          por semana y por dia, y lo que mas leyo el objeto hoy
    python herramientas/uso.py --json   lo mismo, crudo, para armar un informe
    python herramientas/uso.py --auto   el self-check, sin red

Dlx, 04/11/2026: *«traeme un informe acerca de cuanta gente esta usando la pagina en estos momentos vs antes»*. Los
numeros ya estaban en Dashboard → Numeros, pero solo se leian con su sesion. Esto los pide con la clave del ciclo
(`/avisos/uso-ciclo` en `bot/avisos.js`): son cuentas, nunca quien.

⚠️ QUE CUENTA CADA COLUMNA, porque no son lo mismo:

    personas   cuentas de Discord distintas que usaron el bot o hicieron algo en la pagina con su cuenta. La semana
               entera, sin repetir: por eso no es la suma de bot y web. Se guardan 35 dias (`USO_DIAS`)
    visitas    una por navegador y por dia, tengan cuenta o no. La misma persona en el celular y en la compu son dos.
               Se guardan 90 dias
    k          lo mismo, pero solo los primeros dias de esa semana: para comparar una semana que va por la mitad
"""
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, os.path.join(BASE, 'bot'))

WORKER = 'https://liga-global-bot.liga-global-ul.workers.dev'
#: lo que el objeto puede leer por dia de Cloudflare (`cuotas.LIM`)
TOPE_FILAS = 5_000_000


def semanas_txt(semanas):
    """Las filas de la tabla por semana, de la mas vieja a la de ahora."""
    out = []
    for w in semanas:
        k = w.get('k') or {}
        n = lambda v: '—' if v is None else str(v)
        out.append('%s   personas %4s (bot %4s · web %4s)   visitas %4s   a igual dia: personas %4s, visitas %4s' % (
            w.get('lunes'), n(w.get('personas')), n(w.get('bot')), n(w.get('web')), n(w.get('visitas')),
            n(k.get('personas')), n(k.get('visitas'))))
    return out


def filas_txt(medida, cuantas=15):
    """Lo que mas leyo el objeto ese dia, con su parte de lo medido."""
    filas = (medida or {}).get('filas') or {}
    tot = sum(filas.values())
    if not tot:
        return ['(todavia no hay nada medido)']
    out = ['%s: %s filas medidas, %d %% del tope' % (medida.get('dia'), format(tot, ','), round(100 * tot / TOPE_FILAS))]
    for q, n in sorted(filas.items(), key=lambda x: -x[1])[:cuantas]:
        out.append('  %9s  %3d %%  %s' % (format(n, ','), round(100 * n / tot), q[:90]))
    return out


def _auto():
    s = semanas_txt([{'lunes': '2026-11-02', 'personas': 3, 'bot': 2, 'web': 2, 'visitas': 9, 'k': {'personas': 1, 'visitas': 4}},
                     {'lunes': '2026-08-03', 'personas': None, 'bot': None, 'web': None, 'visitas': 5, 'k': {}}])
    assert '2026-11-02' in s[0] and 'personas    3' in s[0] and 'visitas    9' in s[0], s[0]
    assert 'personas    —' in s[1], s[1]
    f = filas_txt({'dia': '2026-11-04', 'filas': {'SELECT a': 300, 'SELECT b': 100}})
    assert '400 filas' in f[0] and 'SELECT a' in f[1] and '75 %' in f[1], f
    assert filas_txt(None) == ['(todavia no hay nada medido)']
    print('✅ uso: las tablas se arman bien')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    if '--auto' in sys.argv:
        return _auto()
    import requests
    import clave_ciclo as CC
    import fotos as F
    tok = F.env('DISCORD_TOKEN', obligatorio=False)
    if not tok:
        sys.exit('falta DISCORD_TOKEN en .env')
    r = requests.get(WORKER + '/avisos/uso-ciclo', headers={'x-lg-ciclo': CC.clave(tok)}, timeout=30)
    if r.status_code == 404:
        sys.exit('el Worker desplegado todavia no tiene esta ruta: corre `python bot/desplegar.py`')
    r.raise_for_status()
    j = r.json()
    if '--json' in sys.argv:
        print(json.dumps(j, ensure_ascii=False, indent=1))
        return
    print('\nPOR SEMANA (de lunes a domingo, hora del este)')
    print('\n'.join(semanas_txt(j.get('semanas') or [])))
    print('\nLOS ULTIMOS 14 DIAS')
    for d in (j.get('dias') or [])[-14:]:
        print('%s   bot %4d   web %4d   visitas %4d' % (d['dia'], d['bot'], d['web'], d['visitas']))
    print('\nLO QUE MAS LEYO EL OBJETO')
    fi = j.get('filas') or {}
    print('\n'.join(filas_txt(fi.get('hoy'))))
    print('\n'.join(filas_txt(fi.get('ayer'), 8)))


if __name__ == '__main__':
    main()

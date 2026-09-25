"""CUANTO DEL PLAN GRATIS ESTAMOS USANDO.

    python bot/cuotas.py

⚠️ EXISTE PORQUE EL PROYECTO ENTERO SE DISEÑO ALREDEDOR DE UN LIMITE QUE NUNCA
SE HABIA MEDIDO. `CLAUDE.md` lo dice en primera linea: *«el limite que manda
son 10 ms de CPU por request, no los 100.000 requests diarios. El numero
grande no molesta; el chiquito decide todo»*. Por ese 10 el Worker no lee el
Sheet, no parsea un blob con las 138, construye las URL en vez de
consultarlas y guarda todo el estado en el `custom_id`.

Todo eso se decidio **razonando**. Esto lo mide.

⚠️ `cpuTimeP50` VIENE EN MICROSEGUNDOS, aunque el nombre no lo diga. Se
comprueba solo: si fueran milisegundos, un p50 de 1.055 ya estaria 100 veces
por encima del limite y TODAS las peticiones fallarian — y el mismo informe
dice 0 errores. Un numero que no puede ser lo que parece hay que leerlo bien
antes de asustarse o de quedarse tranquilo.
"""
import datetime
import io
import json
import os
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, SCR)

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
WORKER = 'liga-global-bot'

# Los limites del plan gratis, para que el numero medido signifique algo.
LIM = {
    'r2_gb': 10, 'r2_escrituras_mes': 1_000_000, 'r2_lecturas_mes': 10_000_000,
    'kv_escrituras_dia': 1_000, 'kv_lecturas_dia': 100_000,
    'worker_peticiones_dia': 100_000, 'worker_cpu_ms': 10,
}


def barra(usado, total, ancho=28):
    n = min(ancho, int(round(ancho * usado / total))) if total else 0
    return '[%s%s] %5.1f%%' % ('#' * n, '·' * (ancho - n), 100 * usado / total)


def kv_hoy(s):
    """`{'write': n, 'read': m, ...}` de KV hoy (UTC). `{}` si no se sabe."""
    hoy = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    q = ('{ viewer { accounts(filter:{accountTag:"%s"}) {'
         ' kvOperationsAdaptiveGroups(limit:50, filter:{date_geq:"%s"}) {'
         ' sum { requests } dimensions { actionType } } } } }' % (CUENTA, hoy))
    try:
        gk = requests.post('https://api.cloudflare.com/client/v4/graphql',
                           headers=dict(s.headers), json={'query': q}, timeout=40)
        return {f['dimensions']['actionType']: f['sum']['requests']
                for f in gk.json()['data']['viewer']['accounts'][0]
                ['kvOperationsAdaptiveGroups']}
    except Exception:                                    # noqa: BLE001
        return {}


def main():
    from subir_cartas import sesion, listar
    s = sesion()

    print('\nR2 — las cartas')
    objs = listar(s)
    gb = sum(int(o['size']) for o in objs) / 1024 ** 3
    print('   %d objetos · %.2f GB   %s' % (len(objs), gb, barra(gb, LIM['r2_gb'])))
    # ⚠️ A 1,14 MB por carta, una temporada son ~2 GB. Cuatro temporadas
    # llenan el plan gratis. WEBP q90 las deja en ~140 KB: el mismo set
    # ocuparia 250 MB. No es solo velocidad, es cuantas temporadas entran.
    print('   a este ritmo entran ~%.1f temporadas mas antes de los 10 GB'
          % ((LIM['r2_gb'] - gb) / gb if gb else 0))

    print('\nKV — quien es quien')
    r = s.get('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces'
              % CUENTA, timeout=30)
    for n in (r.json().get('result') or []) if r.ok else []:
        rr = s.get('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/'
                   'namespaces/%s/keys' % (CUENTA, n['id']),
                   params={'limit': 1000}, timeout=30)
        k = (rr.json().get('result') or []) if rr.ok else []
        print('   %-18s %d claves' % (n['title'], len(k)))
    # ⚠️ LO QUE SE GASTO HOY, NO LO QUE UNA CORRIDA COSTARIA. El 17/09/2026
    # la cuota se acabo de verdad —1.209 de 1.000— y el sello no se pudo
    # escribir: 276 cartas recien subidas quedaron invisibles por UNA clave.
    # Un limite que solo se conoce en teoria se cruza sin que nadie lo vea.
    hoy = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
    ops = kv_hoy(s)
    if ops:
        print('   HOY (UTC %s):' % hoy)
        print('      escrituras %5d   %s'
              % (ops.get('write', 0), barra(ops.get('write', 0), LIM['kv_escrituras_dia'])))
        print('      lecturas   %5d   %s'
              % (ops.get('read', 0), barra(ops.get('read', 0), LIM['kv_lecturas_dia'])))
        if ops.get('write', 0) >= LIM['kv_escrituras_dia']:
            falta = (datetime.datetime.now(datetime.timezone.utc)
                     .replace(hour=0, minute=0, second=0, microsecond=0)
                     + datetime.timedelta(days=1)
                     - datetime.datetime.now(datetime.timezone.utc))
            print('      🔴 AGOTADA. Vuelve a las 00:00 UTC, en %.1f h'
                  % (falta.total_seconds() / 3600))
    print('   una corrida de subir_datos.py escribe SOLO lo que cambio:')
    print('   con todo igual son 0 escrituras y 241 lecturas, que es la cuota')
    print('   que sobra (100.000 al dia contra 1.000).')

    print('\nEL WORKER — las ultimas 24 h')
    desde = (datetime.datetime.now(datetime.timezone.utc)
             - datetime.timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ')
    q = ('{ viewer { accounts(filter:{accountTag:"%s"}) {'
         ' workersInvocationsAdaptive(limit:100, filter:{datetime_geq:"%s"}) {'
         ' sum { requests errors subrequests }'
         ' quantiles { cpuTimeP50 cpuTimeP99 }'
         ' dimensions { scriptName } } } } }' % (CUENTA, desde))
    g = requests.post('https://api.cloudflare.com/client/v4/graphql',
                      headers=dict(s.headers), json={'query': q}, timeout=40)
    try:
        filas = g.json()['data']['viewer']['accounts'][0]['workersInvocationsAdaptive']
    except Exception:
        print('   no pude leer analytics: %s' % str(g.text)[:160])
        return
    if not filas:
        print('   sin datos en la ventana')
    for f in filas:
        if f['dimensions']['scriptName'] != WORKER:
            continue
        pet, err = f['sum']['requests'], f['sum']['errors']
        p50 = f['quantiles']['cpuTimeP50'] / 1000.0      # us -> ms
        p99 = f['quantiles']['cpuTimeP99'] / 1000.0
        print('   %d peticiones   %s' % (pet, barra(pet, LIM['worker_peticiones_dia'])))
        print('   %d errores%s' % (err, '   ✅' if err == 0 else '   ⚠️'))
        print('   subpeticiones %d  (las invitaciones salen por aca)'
              % f['sum']['subrequests'])
        print('\n   CPU POR PETICION, contra los 10 ms que deciden todo:')
        print('      p50  %5.2f ms   %s' % (p50, barra(p50, LIM['worker_cpu_ms'])))
        print('      p99  %5.2f ms   %s' % (p99, barra(p99, LIM['worker_cpu_ms'])))
        if p99 > LIM['worker_cpu_ms'] * 0.8:
            print('      ⚠️ el p99 pasa el 80% del presupuesto')
    print('')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

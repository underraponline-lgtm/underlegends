"""BAJAR KV ENTERO A UN ARCHIVO, para poder correr el Worker contra lo real.

    python bot/volcar_kv.py            -> bot/_kv_volcado.json

⚠️ EXISTE PARA CERRAR EL UNICO HUECO QUE QUEDABA EN LAS PRUEBAS. Las 88
pruebas locales corren el Worker contra un KV de MENTIRA de tres claves, y
`bot/verificar.py` comprueba que los servicios esten bien pero **no ejecuta el
Worker**. O sea que nadie estaba corriendo el codigo de verdad contra los
datos de verdad — y ahi viven los errores que ninguna de las dos ve:

  · `norm()` esta escrito DOS VECES, en Python y en JavaScript. Si dejan de
    coincidir para un nombre con tilde, con ñ o con espacio, el Worker busca
    una clave que no existe y contesta «no tengo cartas» de alguien que si
    esta. Con tres nombres de prueba no se nota.
  · el indice `d:<discord_id>` puede apuntar a una persona que ya no esta.
  · el `custom_id` tiene un tope de 100 caracteres y lleva el nombre adentro.

Lee las claves, no escribe ninguna: no gasta del presupuesto de escritura.
"""
import concurrent.futures as cf
import io
import json
import os
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
KV = 'a87399a3a0b647b0803aa90509ccce56'
API = ('https://api.cloudflare.com/client/v4/accounts/%s/storage/kv/namespaces/%s'
       % (CUENTA, KV))


def env(clave):
    for l in io.open(os.path.join(BASE, '.env'), encoding='utf-8'):
        if l.strip().startswith(clave + '='):
            return l.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def main():
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')

    # ⚠️ PAGINA. El listado da 1.000 por llamada; hoy son 240 pero el dia que
    # el padron crezca esto se pasa sin avisar -- el mismo limite que ya mordio
    # en R2.
    claves, cursor = [], None
    while True:
        pars = {'limit': 1000}
        if cursor:
            pars['cursor'] = cursor
        j = s.get(API + '/keys', params=pars).json()
        if not j.get('success'):
            sys.exit('no pude listar: %s' % j.get('errors'))
        claves += [k['name'] for k in j.get('result') or []]
        cursor = (j.get('result_info') or {}).get('cursor')
        if not cursor:
            break

    # 🔴 SE LEE POR `bulk/get`, NO POR `/values/<clave>`. El segundo sirve una
    # copia CACHEADA, y este archivo es la entrada de `bot/simular.mjs`: un
    # volcado viejo hace que la simulación pruebe datos que ya no existen y
    # conteste que todo está bien.
    #
    # Medido el 20/09/2026, volcando justo después de escribir 140 claves: el
    # simulador contó **92** versus con veredicto verificado, y el mismo
    # archivo leído después daba **436**. O sea que la corrida que decía «TODO
    # BIEN» había probado un cuarto de lo que creía, sin avisar de nada.
    #
    # ⚠️ Es la TERCERA vez hoy que el mismo endpoint miente en un lugar
    # distinto: ya pasó en la comprobación de `subir_datos.py` y en su `--ver`.
    # El arreglo llegaba a un camino por vez.
    #
    # ⚠️ Y `bulk/get` TAMPOCO ES DE LECTURA INMEDIATA: devuelve el valor real
    # y no el de la caché, pero un segundo después de escribir todavía puede
    # dar el anterior. Por eso el volcado avisa cuando encuentra claves vacías
    # en vez de escribirlas como si nada.
    #
    # ⚠️ De a 100 porque es el tope del endpoint.
    def leer(lote):
        r = s.post('%s/bulk/get' % API, json={'keys': lote}, timeout=40)
        if not r.ok:
            return {k: None for k in lote}
        vals = ((r.json().get('result') or {}).get('values') or {})
        return {k: (vals.get(k) if isinstance(vals.get(k), str)
                    else (json.dumps(vals[k], ensure_ascii=False)
                          if vals.get(k) is not None else None))
                for k in lote}

    lotes = [claves[i:i + 100] for i in range(0, len(claves), 100)]
    volcado = {}
    with cf.ThreadPoolExecutor(max_workers=8) as pool:
        for d in pool.map(leer, lotes):
            volcado.update(d)
    vacias = [k for k, v in volcado.items() if v is None]
    if vacias:
        print('  ⚠️ %d clave(s) vinieron vacías —KV todavía no las servía—: %s'
              % (len(vacias), ', '.join(vacias[:6])))
        print('     volvé a correrlo en unos segundos antes de simular.')

    faltan = [k for k, v in volcado.items() if v is None]
    p = os.path.join(SCR, '_kv_volcado.json')
    with open(p, 'w', encoding='utf-8') as f:
        json.dump(volcado, f, ensure_ascii=False, indent=0, sort_keys=True)
    print('%d clave(s) en KV -> %s' % (len(volcado), os.path.relpath(p, BASE)))
    print('  p:%d  ·  d:%d  ·  meta:%d'
          % (sum(1 for k in volcado if k.startswith('p:')),
             sum(1 for k in volcado if k.startswith('d:')),
             sum(1 for k in volcado if k == 'meta')))
    if faltan:
        print('  ⚠️ %d no se pudieron leer: %s' % (len(faltan), faltan[:5]))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

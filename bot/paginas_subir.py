# -*- coding: utf-8 -*-
"""SUBIR `bot/paginas/` A CLOUDFLARE PAGES, SIN WRANGLER.

    python bot/paginas_subir.py            qué subiría, sin tocar nada
    python bot/paginas_subir.py --aplicar  lo sube y lo publica

🔴 POR QUE EXISTE: EL SITIO NO SE PODIA DESPLEGAR DESDE ACA.

`npx wrangler pages deploy` pide **Node 22** y esta máquina tiene la 18, así
que la única forma de publicar un cambio del hub era a mano desde el panel.
Un sitio que sólo se puede actualizar a mano queda viejo el día que nadie se
acuerda — y el ciclo, que es lo que mantiene todo esto solo, no podía tocarlo.

⚠️ **Y ESO YA COSTABA ALGO MEDIBLE**: `bot/subir_web.py` publica el *payload*
en KV en cada corrida, así que los datos del hub estaban frescos y su HTML,
CSS y JS eran los del día que alguien corrió wrangler. Las dos mitades de la
misma página con dos edades distintas.

COMO FUNCIONA
-------------
Pages tiene una API de **subida directa** en tres pasos, y hay que hacer los
tres: pedir un token de subida, subir los archivos por su **hash**, y recién
después crear el despliegue con el manifiesto.

    1. POST .../pages/projects/<p>/upload-token   -> un JWT
    2. POST .../pages/assets/upload               -> los archivos, en base64
    3. POST .../pages/projects/<p>/deployments    -> el manifiesto

⚠️ **EL HASH NO ES EL DEL CONTENIDO A SECAS.** Pages usa un blake3 de 16
bytes sobre `contenido + extensión`, y como acá no hay blake3 en la
biblioteca estándar, se manda el paso 2 con **todos** los archivos y se deja
que el paso 3 pida los que falten. Con cinco archivos y 152 KB, subir de más
cuesta menos que traer una dependencia.

⚠️ **`_worker.js` NO ES UN ARCHIVO SERVIBLE**, es el Worker de Pages: va en
el manifiesto igual pero Cloudflare lo trata distinto. Si se omite, el sitio
pierde `/api/lobby` y la página queda sin datos **sin fallar** — se ve la
maqueta vacía, que es el peor síntoma posible.
"""
import base64
import hashlib
import io
import json
import mimetypes
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
SITIO = os.path.join(SCR, 'paginas')
PROYECTO = 'underlegends'
API = 'https://api.cloudflare.com/client/v4'

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass


def env():
    d = dict(os.environ)
    p = os.path.join(BASE, '.env')
    if os.path.exists(p):
        for l in io.open(p, encoding='utf-8'):
            l = l.strip()
            if l and not l.startswith('#') and '=' in l:
                k, v = l.split('=', 1)
                d[k.strip()] = v.strip().strip('"\'')
    return d


def archivos():
    """`[(ruta_publicada, bytes)]` de todo lo que hay en `paginas/`."""
    out = []
    for raiz, _ds, fs in os.walk(SITIO):
        for f in sorted(fs):
            p = os.path.join(raiz, f)
            r = os.path.relpath(p, SITIO).replace('\\', '/')
            out.append((r, io.open(p, 'rb').read()))
    return sorted(out)


def _hash(datos, ruta):
    """El identificador que Pages le da a un archivo.

    ⚠️ Pages usa blake3(contenido + extensión)[:16]. Sin blake3 a mano se
    usa un sha256 truncado: **no coincide con el suyo**, y no hace falta que
    coincida — el paso 2 sube todo y el paso 3 sólo necesita que el hash del
    manifiesto sea el mismo que el del envío. Lo que no se puede es
    reutilizar lo ya subido, que con 152 KB no importa.
    """
    ext = os.path.splitext(ruta)[1].lstrip('.')
    return hashlib.sha256(datos + ext.encode()).hexdigest()[:32]


def main():
    import requests
    aplicar = '--aplicar' in sys.argv
    e = env()
    tok = e.get('CLOUDFLARE_API_TOKEN')
    if not tok:
        sys.exit('falta CLOUDFLARE_API_TOKEN en .env')
    h = {'Authorization': 'Bearer ' + tok}
    cid = requests.get(API + '/accounts', headers=h,
                       timeout=30).json()['result'][0]['id']

    fs = archivos()
    print('\n══ %s → Cloudflare Pages ══\n' % os.path.relpath(SITIO, BASE))
    for r, d in fs:
        print('   %-16s %7.1f KB' % (r, len(d) / 1024))
    print('\n   %d archivo(s) · %.1f KB' % (fs and len(fs) or 0,
                                            sum(len(d) for _r, d in fs) / 1024))
    if not aplicar:
        print('\n   (nada subido — corré con --aplicar)\n')
        return 0

    base = '%s/accounts/%s/pages/projects/%s' % (API, cid, PROYECTO)
    r = requests.get(base + '/upload-token', headers=h, timeout=40)
    if r.status_code != 200 or not r.json().get('success'):
        print('   🔴 no pude pedir el token de subida: %d %s'
              % (r.status_code, r.text[:200]))
        return 1
    jwt = r.json()['result']['jwt']

    # 🔴 `_worker.js` NO VA EN EL MANIFIESTO, Y METERLO AHI ROMPE EL SITIO.
    # Pasó el 24/09/2026 en la primera corrida de esto: subido como un
    # archivo más, Cloudflare lo **sirve como estático** en vez de correrlo,
    # así que el Worker de Pages deja de existir. El síntoma es cruel —
    # `/api/lobby` empieza a devolver el `index.html` con **200**, porque el
    # fallback de SPA contesta cualquier ruta— y la página carga perfecta y
    # vacía. `/_worker.js` devolviendo 200 es la señal de que está mal.
    #
    # ⚠️ Va como su propio campo del multipart, al lado de `manifest`. Es lo
    # que hace wrangler por debajo.
    worker = None
    resto = []
    for ruta, datos in fs:
        if ruta == '_worker.js':
            worker = datos
        else:
            resto.append((ruta, datos))
    if worker is None:
        print('   ⚠️ no hay `_worker.js`: el sitio queda sin `/api/lobby`')

    manifiesto, payload = {}, []
    for ruta, datos in resto:
        hx = _hash(datos, ruta)
        manifiesto['/' + ruta] = hx
        payload.append({
            'key': hx,
            'value': base64.b64encode(datos).decode(),
            'metadata': {'contentType': mimetypes.guess_type(ruta)[0]
                         or 'application/octet-stream'},
            'base64': True,
        })
    r = requests.post(API + '/pages/assets/upload',
                      headers={'Authorization': 'Bearer ' + jwt,
                               'Content-Type': 'application/json'},
                      data=json.dumps(payload), timeout=180)
    if r.status_code != 200 or not r.json().get('success'):
        print('   🔴 la subida de archivos falló: %d %s'
              % (r.status_code, r.text[:300]))
        return 1
    print('   ✅ %d archivo(s) subidos' % len(payload))

    # ⚠️ EL MANIFIESTO VA COMO CAMPO DE UN MULTIPART, no como json suelto:
    # el endpoint de deployments es `multipart/form-data` y mandarlo como
    # `json=` devuelve un 400 que no dice cuál es el problema.
    campos = {'manifest': (None, json.dumps(manifiesto))}
    if worker is not None:
        campos['_worker.js'] = ('_worker.js', worker, 'application/javascript')
    r = requests.post(base + '/deployments', headers=h, files=campos,
                      timeout=180)
    j = {}
    try:
        j = r.json()
    except ValueError:
        pass
    if r.status_code not in (200, 201) or not j.get('success'):
        print('   🔴 el despliegue falló: %d %s' % (r.status_code,
                                                    r.text[:300]))
        return 1
    d = j['result']
    print('   ✅ desplegado: %s' % d.get('url'))
    print('      id %s · %s\n' % (str(d.get('id'))[:8],
                                  d.get('latest_stage', {}).get('status')))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

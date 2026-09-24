# -*- coding: utf-8 -*-
"""¿PUEDE CLOUDFLARE DIBUJAR NUESTRA CARTA? El primer paso del bajo demanda.

    python herramientas/probar_navegador.py            solo el permiso
    python herramientas/probar_navegador.py --carta    dibuja una de verdad

⚠️ LA PREGUNTA NO ES SI LA API EXISTE: ES SI DIBUJA **NUESTRA** CARTA. Por
eso `--carta` no manda un `<h1>hola</h1>`: manda el HTML real de una carta de
Servidor y compara el PNG que vuelve contra el que sale local. Si no salen
iguales, todo lo que se construya encima esta apoyado en un supuesto.

Es la regla de este repo aplicada acá: los dos errores que ya se comio
—`KeyError: 'URBF'` que tumbaba las 138 por 2 personas, y una carpeta con su
copia vieja del pool— **los dos pasan la lectura del codigo**. El que los
encuentra es generar y mirar.

EL PERMISO
----------
Medido el 20/09/2026: el token tiene KV, R2 y Workers, y Browser Rendering
da 401. Se arregla en el panel, sin cambiar el valor del token:

    My Profile -> API Tokens -> editar el token -> + Add more
    Account · Browser Rendering · Edit -> Save

Ver `docs/bajo_demanda.md`.
"""
import io
import os
import sys

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

CUENTA = 'a85733396fd158a8e9660b02e20f33c8'
API = 'https://api.cloudflare.com/client/v4/accounts/%s' % CUENTA


def env(clave):
    p = os.path.join(BASE, '.env')
    for linea in io.open(p, encoding='utf-8'):
        if linea.strip().startswith(clave + '='):
            return linea.split('=', 1)[1].strip().strip('"\'')
    sys.exit('falta %s en .env' % clave)


def sesion():
    s = requests.Session()
    s.headers['Authorization'] = 'Bearer ' + env('CLOUDFLARE_API_TOKEN')
    return s


def permisos(s):
    """Que puede tocar el token. Se prueba con un GET a cada servicio.

    ⚠️ NO ALCANZA CON `/user/tokens/verify`: ese dice que el token es valido,
    no que tenga el permiso. El nuestro sale `active` y aun asi no puede
    abrir un navegador.
    """
    print('\n══ QUE PUEDE EL TOKEN ══\n')
    faltan = []
    for etq, ruta in (('KV', '/storage/kv/namespaces'),
                      ('R2', '/r2/buckets'),
                      ('Workers', '/workers/scripts'),
                      ('Browser Rendering', '/browser-rendering/screenshot')):
        c = s.get(API + ruta, timeout=30).status_code
        # el GET a screenshot no es una ruta valida (es POST), asi que un 405
        # o un 400 ya significan «el permiso esta»: lo que niega es el 401.
        ok = c != 401 and c != 403
        print('   %-20s %s  %s' % (etq, c, '✅' if ok else '🔴 sin permiso'))
        if not ok:
            faltan.append(etq)
    return faltan


def html_de_una_carta():
    """El HTML real de una carta de Servidor, autocontenido."""
    import importlib.util
    from comun import respaldo
    antes = os.getcwd()
    os.chdir(os.path.join(BASE, '03_Servidor'))
    try:
        spec = importlib.util.spec_from_file_location('svgen', 'generar.py')
        G = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(G)
        TS = G.TS
        G.montar([{'nombre': 'Konan', 'sv': 'DRA', 'rango': 'S', 'cc': 'ar',
                   'pos_sv': 3, 'tot_sv': 18, 'pos_pais': 5, 'tot_pais': 33,
                   'rango_pos': (2, 9), 'ovr': 74, 'titulos': 2, 'podios': 8,
                   'eventos': 30, 'racha': '3/7', 'duelos': '4/6',
                   'foto': respaldo.avatar('Konan', '')}])
        with io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                     encoding='utf-8') as f:
            fuentes = f.read()
        return ('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
                + fuentes + TS.CSS + '</style></head><body style="margin:0">'
                + TS.carta(0, 'g0') + '</body></html>'), TS
    finally:
        os.chdir(antes)


def dibujar(s):
    print('\n══ UNA CARTA DE VERDAD ══\n')
    html, TS = html_de_una_carta()
    print('   el HTML pesa %.0f KB' % (len(html.encode('utf-8')) / 1024))
    r = s.post(API + '/browser-rendering/screenshot',
               json={
                   'html': html,
                   'viewport': {'width': TS.W, 'height': TS.ALTO,
                                'deviceScaleFactor': TS.ESCALA},
                   'screenshotOptions': {'omitBackground': True,
                                         'type': 'png'},
               }, timeout=180)
    tipo = r.headers.get('content-type') or ''
    if 'image' not in tipo:
        print('   🔴 %s  %s' % (r.status_code, r.text[:300]))
        return 1
    dest = os.path.join(BASE, 'salida', '_nube_konan.png')
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, 'wb') as f:
        f.write(r.content)
    from PIL import Image
    im = Image.open(dest)
    print('   ✅ volvio %d KB  ·  %s  ·  %s'
          % (len(r.content) / 1024, im.size, im.mode))
    # ⚠️ LAS CUATRO ESQUINAS, IGUAL QUE EL EXPORTADOR. Los dos errores que
    # este formato admite sin quejarse son el rectangulo y el vacio.
    if im.mode == 'RGBA':
        w, h = im.size
        esq = [im.getpixel(p)[3] for p in
               ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1))]
        print('   alfa en las esquinas: %s  %s'
              % (esq, '✅ transparente' if max(esq) == 0 else
                 '🔴 salio una CAJA, no la silueta'))
    else:
        print('   🔴 volvio en %s: perdio la transparencia' % im.mode)
    print('   guardado en salida/_nube_konan.png')
    return comparar_con_local(html, TS, dest)


def comparar_con_local(html, TS, nube):
    """EL PASO QUE DECIDE. Que el PNG tenga el tamaño correcto y las esquinas
    transparentes NO dice que sea la misma carta.

    ⚠️ SE RENDERIZA EL MISMO HTML, de las dos maneras, y se restan. Es la
    regla de este repo: los errores que importan —una fuente que no cargo,
    una imagen que fallo, un degrade distinto— salen todos iguales de
    «valido» y se ven recien al restar.
    """
    import asyncio
    print('\n══ CONTRA EL RENDER LOCAL ══\n')
    local = os.path.join(BASE, 'salida', '_local_konan.png')

    async def dibujar_local():
        from playwright.async_api import async_playwright
        tmp = os.path.join(BASE, 'salida', '_tmp_nube.html')
        with io.open(tmp, 'w', encoding='utf-8') as f:
            f.write(html)
        async with async_playwright() as pw:
            b = await pw.chromium.launch(args=['--no-sandbox'])
            pg = await b.new_page(viewport={'width': TS.W, 'height': TS.ALTO},
                                  device_scale_factor=TS.ESCALA)
            await pg.goto('file://' + tmp.replace(os.sep, '/'))
            await pg.evaluate('''async () => {
                await document.fonts.ready;
                await Promise.all([...document.images].filter(i => !i.complete)
                    .map(i => new Promise(r => { i.onload = i.onerror = r; })));
            }''')
            await pg.screenshot(path=local, omit_background=True)
            await b.close()
        os.remove(tmp)

    try:
        asyncio.run(dibujar_local())
    except Exception as e:                               # noqa: BLE001
        print('   no pude dibujar local: %s' % str(e)[:90])
        return 1

    from PIL import Image
    import numpy as np
    a = Image.open(local).convert('RGBA')
    b = Image.open(nube).convert('RGBA')
    print('   local %s   ·   nube %s' % (a.size, b.size))
    if a.size != b.size:
        print('   🔴 SALEN DE DISTINTO TAMAÑO')
        return 1
    A = np.asarray(a, dtype=np.int16)
    B = np.asarray(b, dtype=np.int16)
    d = np.abs(A - B)
    dist = (d.sum(axis=2) > 0)
    n = int(dist.sum())
    tot = a.size[0] * a.size[1]
    if n == 0:
        print('   ✅ IDENTICAS pixel a pixel')
        return 0
    print('   %d px distintos (%.2f %%)  ·  dif media %.2f/255  ·  max %d'
          % (n, 100.0 * n / tot, d[d > 0].mean(), int(d.max())))
    # ⚠️ DONDE difieren dice QUE fallo. Una fuente que no cargo mueve texto
    # y las filas distintas se agrupan; una imagen que fallo deja un bloque.
    filas = np.where(dist.any(axis=1))[0]
    cols = np.where(dist.any(axis=0))[0]
    print('   la diferencia vive entre las filas %d-%d y las columnas %d-%d'
          % (filas.min(), filas.max(), cols.min(), cols.max()))
    if int(d.max()) < 24 and 100.0 * n / tot > 40:
        print('\n   ⚠️ Mucha superficie y poca amplitud: eso es ANTIALIASING,')
        print('      no una pieza que falto. Los dos Chromium no tienen por')
        print('      que rasterizar igual.')
    else:
        print('\n   🔴 Poca superficie y mucha amplitud: eso es algo que NO')
        print('      CARGO. Mirá esas filas en las dos imagenes.')
    print('\n   las dos en salida/: _local_konan.png y _nube_konan.png')
    return 0


def main():
    s = sesion()
    faltan = permisos(s)
    if 'Browser Rendering' in faltan:
        print('\n   🔴 Falta el permiso. En el panel, sin cambiar el token:')
        print('      My Profile -> API Tokens -> editar -> + Add more')
        print('      Account · Browser Rendering · Edit -> Save')
        print('\n   (editar un token NO cambia su valor: el .env queda igual)\n')
        return 1
    if '--carta' not in sys.argv:
        print('\n   El permiso esta. Para dibujar una carta de verdad:')
        print('      python herramientas/probar_navegador.py --carta\n')
        return 0
    return dibujar(s)


if __name__ == '__main__':
    sys.exit(main())

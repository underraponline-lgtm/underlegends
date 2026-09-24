"""
PNG SUELTO DE UNA TARJETA TEMPORADA, con fondo transparente
============================================================

    python3 exportar_png.py Konan
    python3 exportar_png.py Konan salida.png

DOS TRAMPAS que hay que esquivar, las dos descubiertas a los golpes:

1. `.card` tiene `box-shadow: 0 16px 38px`. Si no se apaga, la sombra pinta
   toda la caja y el PNG sale como un rectangulo gris en vez de la carta con
   sus esquinas redondeadas.

2. Chromium NO llega al CDN de Discord ni a Google Fonts desde este entorno.
   Hay que embeber avatares, banderas, escudos Y fuentes en base64 antes de
   renderizar. Python si tiene salida a internet, por eso se bajan aca.

A diferencia de la Competitiva, esta carta es rectangular y nada se le sale
de la caja, asi que alcanza con capturar el elemento.
"""
import asyncio
import base64
import importlib.util as iu
import json
import os
import re
import sys

import requests
from playwright.async_api import async_playwright

BASE = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'Mozilla/5.0'}
_cache = {}


sys.path.insert(0, os.path.dirname(BASE))
from comun import respaldo


def _embeber(url):
    if url not in _cache:
        r = requests.get(url, headers=UA, timeout=30)
        mime = r.headers.get('content-type', 'image/png').split(';')[0]
        _cache[url] = 'data:%s;base64,%s' % (mime, base64.b64encode(r.content).decode())
    return _cache[url]


def _pool():
    # el pool vive en datos/, no en esta carpeta. Ver generar.py
    p = os.path.join(os.path.dirname(BASE), 'datos', 'temporada_pool.json')
    return {d['raw']: d for d in json.load(open(p, encoding='utf-8'))}


def armar_html(quien, pool):
    """El HTML de una carta. Separado del navegador a propósito.

    ⚠️ ASI SE PUEDEN EXPORTAR VARIAS CON UN SOLO CHROMIUM. Arrancarlo cuesta
    ~5 s y dibujar una carta ~1.5 s: de a una, las 138 son 12 minutos y en
    tanda son 4. `03_Servidor/generar.py` y `04_Pais/exportar_png.py` ya lo
    hacían así; estos dos eran los que faltaban.
    """
    if quien not in pool:
        return None
    c = dict(pool[quien])

    # ⚠️ LA COPIA DEL REPO PRIMERO, NO COMO RESCATE. La regla vive en
    # `comun/respaldo.avatar()` y ahi esta el porque: preguntar por el repo
    # SOLO cuando habia una URL rota dejaba sin cara a 82 de 101, porque la
    # gente nueva no tiene URL en el pool y esa rama no la alcanzaba.
    _antes = c.get('av', '')
    c['av'] = respaldo.avatar(quien, _antes)
    if not c['av'] and _antes:
        print('el avatar de %s no esta ni en el repo ni en el pool: va con iniciales'
              % quien)
    # Si no quedo mas remedio que la URL del pool, hay que comprobar que viva:
    # su hash caduca cuando la persona cambia la foto.
    if c['av'].startswith('http'):
        if requests.get(c['av'].replace('?size=128', '?size=512'),
                        headers=UA, timeout=20).status_code != 200:
            print('el avatar de %s no responde y no hay copia: va con iniciales'
                  % quien)
            c['av'] = ''

    sp = iu.spec_from_file_location('nv3', os.path.join(BASE, 'normal_v3.py'))
    m = iu.module_from_spec(sp); sp.loader.exec_module(m)

    css = open(os.path.join(BASE, 'normal_v3.css'), encoding='utf-8').read()
    css = re.sub(r"@import url\([^)]*\);", '', css)      # fuera el @import remoto
    # ⚠️ LAS FUENTES VIVEN EN comun/, NO EN LA CARPETA DE LA CARTA. Habia
    # una copia identica por carta —cuatro archivos de 543 KB con el mismo
    # md5— y eso es lo que CLAUDE.md prohibe: lo que comparten las cartas
    # vive en comun/. BASE es la carpeta de ESTA carta, asi que la raiz es
    # su dirname.
    _fnt = os.path.join(os.path.dirname(BASE), 'comun', 'fonts', 'embed.css')
    fuentes = open(_fnt, encoding='utf-8').read()
    cuerpo = re.sub(r'src="(https?://[^"]+)"',
                    lambda x: 'src="%s"' % _embeber(x.group(1)), m.render([c]))
    return ('<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'
            + fuentes + css + 'body{margin:0;background:transparent}</style>'
            '</head><body>' + cuerpo + '</body></html>')


async def _capturar(pg, html, salida):
    tmp = os.path.join(BASE, '_tmp.html')
    open(tmp, 'w', encoding='utf-8').write(html)
    await pg.goto('file://' + tmp)
    await pg.wait_for_timeout(1000)
    # sin la sombra: si no, el PNG sale rectangular
    await pg.add_style_tag(content='.card{box-shadow:none!important}')
    await pg.wait_for_timeout(300)
    el = await pg.query_selector('.card')
    await el.screenshot(path=salida, omit_background=True)
    os.remove(tmp)


async def main(quien, salida):
    pool = _pool()
    html = armar_html(quien, pool)
    if html is None:
        print('no esta en el pool:', quien); return
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 600, 'height': 700},
                              device_scale_factor=3)
        await _capturar(pg, html, salida)
        await b.close()
    print('->', salida)


async def varias(quienes, patron):
    """Un solo Chromium para muchas. `patron` lleva %s con el nombre."""
    pool = _pool()
    hechas, faltan = [], []
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 600, 'height': 700},
                              device_scale_factor=3)
        for q in quienes:
            html = armar_html(q, pool)
            if html is None:
                faltan.append(q); continue
            sal = patron % q
            os.makedirs(os.path.dirname(sal) or '.', exist_ok=True)
            await _capturar(pg, html, sal)
            hechas.append(sal)
            print('   %-18s %s' % (q[:18], os.path.basename(sal)))
        await b.close()
    if faltan:
        print('   no estan en el pool: %s' % ', '.join(faltan))
    return hechas


#: el destino de siempre, con %s para el nombre.
def _patron():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        'salida', 'temporada_%s.png')


if __name__ == '__main__':
    # --todas <patron>  exporta el pool entero reusando el navegador
    if len(sys.argv) > 1 and sys.argv[1] == '--todas':
        pat = sys.argv[2] if len(sys.argv) > 2 else _patron()
        asyncio.run(varias(sorted(_pool()), pat))
    else:
        args = [a for a in sys.argv[1:] if not a.startswith('-')] or ['Konan']
        # 🔴 VARIOS NOMBRES SON VARIOS NOMBRES, NO UN NOMBRE Y UNA RUTA.
        # `bot/pipeline.py` llama con los diez de la tanda en una sola
        # linea —`exportar_png.py Agus Camila ELSOLAR …`— y esto leia
        # `argv[2]` como el destino, asi que dibujaba SOLO a Agus y lo
        # escribia en un archivo llamado `Camila`. Playwright saca el
        # formato de la extension, asi que reventaba con
        # `path: unsupported mime type ""` y las diez figuraban como
        # fallidas. Medido en la corrida del 23/09/2026: **38 cartas**,
        # 10 de temporada y 28 de competitivo.
        #
        # ⚠️ NINGUNA DE LAS DOS MITADES ESTABA MAL: el pipeline manda
        # varios nombres porque asi reusa el navegador, y el exportador
        # aceptaba `<quien> <salida.png>` porque lo dice su README. Es la
        # forma de «las dos piezas pueden estar bien y la composicion
        # mal», y no la encuentra leer ninguno de los dos archivos.
        #
        # ⚠️ EL `.png` ES EL QUE DECIDE, y no la cantidad: es lo unico que
        # distingue un destino de un nombre. Nadie se llama `algo.png`.
        if len(args) == 2 and args[1].lower().endswith('.png'):
            asyncio.run(main(args[0], args[1]))
        elif len(args) == 1:
            # ⚠️ EL MISMO DESTINO Y EL MISMO NOMBRE QUE `--todas`. Antes una
            # carta suelta caia como `DLX_temporada.png` EN EL DIRECTORIO
            # DESDE DONDE SE LLAMO —o sea en la raiz del repo si se corre
            # desde ahi— y la tanda entera en `salida/temporada_dlx.png`.
            # Dos destinos y dos ordenes de nombre para la misma carta: el
            # que regenera una sola despues no la encuentra donde estan las
            # otras, y la raiz se llena de PNG.
            asyncio.run(main(args[0], _patron() % args[0]))
        else:
            asyncio.run(varias(args, _patron()))

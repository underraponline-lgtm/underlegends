# -*- coding: utf-8 -*-
"""LA WEB CONTRA SUS CASOS DE BORDE: pool vacio, uno sin carta, API caida.

    python herramientas/web_en_borde.py

🔴 «EL POOL VACIO ES UN ESTADO, NO UN ERROR» — es una regla de
`CLAUDE.md`, y esa prueba encontro **cuatro** bugs en los generadores el
22/09/2026. La pagina nunca la habia pasado, y el estado va a volver:
pasa cada vez que arranca una temporada.

Encontro dos, los dos del mismo tipo —nada explota, todo se ve bien—:

· `pintaPaises()` tenia un `return` temprano cuando no habia paises, y
  ese `return` se llevaba puesto el apagado de las crews: con el pool
  vacio la vista de Mundo quedaba con UN panel «Las crews» sin nada.
  Con datos de verdad ese camino no se recorre nunca.

· Con la API caida la pagina encendia **todos** los paneles: quedaban
  ONCE secciones vacias con sus titulos y nada adentro. Parecia una liga
  sin nadie, que es peor que decir que no cargo.

⚠️ Y LA PRUEBA MISMA SE EQUIVOCO DOS VECES, las dos midiendo mal:

1. Por `file://` el navegador rechaza el `fetch` antes de que Playwright
   pueda interceptarlo, asi que se probaba el rechazo del esquema y no
   la pagina. Va por HTTP, con un servidor local.
2. `innerText` devuelve el texto **renderizado** y el `<h2>` lleva
   `text-transform:uppercase`: buscar la frase tal como se escribio daba
   que no estaba, con el panel dibujado perfecto al lado.

Necesita un servidor sobre `bot/paginas/`. Lo levanta solo.
"""
import asyncio
import io
import json
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
WEB = os.path.join(BASE, 'bot', 'paginas')
PUERTO = 8731

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

VACIO = {
    'temporada': 'T2', 'gente': 0, 'tabla': [], 'proximos': [],
    'r2': 'https://x/', 'cartas': ['temporada'], 'svs': [], 'paises': [],
    'rangos': [], 'duelos': [], 'rachas': [], 'crews': [], 'records': [],
    'requisitos': [], 'sello': '2026-09-24T05:00:00Z', 'leido': '',
}

UNO = dict(VACIO, gente=1, tabla=[{
    'n': 'Solo', 'pos': 1, 'sv': '', 'cc': '', 'pts': 0, 'ev': 1,
    'rg': '', 'rgc': '', 'ovr': 0, 'wr': '', 'pod': 0, 'oro': 0,
    'seg': 0, 'ter': 0, 'sem': 0, 'crew': '', 'k': 'solo', 'c': [],
}])

CASOS = {'vacio': VACIO, 'uno_sin_carta': UNO, 'api_caida': None}


async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mal = 0
        for nombre, datos in CASOS.items():
            pg = await b.new_page(viewport={'width': 1280, 'height': 900})
            errs = []
            pg.on('pageerror', lambda e: errs.append('JS: ' + str(e)[:110]))
            pg.on('console', lambda m: errs.append('C: ' + m.text[:110])
                  if m.type == 'error' else None)

            # ⚠️ UN SOLO PARAMETRO. Playwright llama al handler con
            # `(route, request)` si acepta dos, así que el `d=datos` que
            # yo creía un default quedaba pisado por el Request — y el
            # `json.dumps` reventaba con «Object of type Request is not
            # JSON serializable». El dato entra por cierre, no por firma.
            cuerpo = (None if datos is None
                      else json.dumps(datos, ensure_ascii=False))

            async def ruta(r):
                if cuerpo is None:
                    await r.fulfill(status=503, body='no')
                else:
                    await r.fulfill(status=200,
                                    content_type='application/json',
                                    body=cuerpo)
            await pg.route('**/api/lobby*', ruta)
            # ⚠️ POR HTTP Y NO POR `file://`: el navegador rechaza un
            # `fetch('/api/lobby')` desde un archivo local antes de que
            # Playwright pueda interceptarlo, así que la prueba probaba
            # el rechazo del esquema y no la página.
            await pg.goto('http://127.0.0.1:8731/index.html',
                          wait_until='domcontentloaded')
            await pg.wait_for_timeout(1500)

            # se recorren TODAS las vistas: el bug puede estar en una sola
            for r in ('', 'ranking', 'tarjetas', 'duelos', 'mundo', 'guia'):
                await pg.evaluate('location.hash="#/%s"' % r)
                await pg.wait_for_timeout(450)

            vivas = await pg.evaluate(
                "[...document.querySelectorAll('section[id]')]"
                ".filter(s => !s.hidden).map(s => s.id)")
            # ⚠️ Lo que importa no es que no explote: es que no quede una
            # seccion vacia diciendo nada. «Sin dato no hay pieza.»
            huecos = await pg.evaluate(
                "[...document.querySelectorAll('.blk')]"
                ".filter(b => !b.closest('[hidden]') && b.offsetParent"
                " && b.innerText.trim().split('\\n').length < 2)"
                ".map(b => b.id || b.className)")
            # ⚠️ UN 503 EN LA CONSOLA NO ES UN BUG EN EL CASO DE LA API
            # CAIDA: es el navegador informando lo que la prueba provocó.
            # Lo que hay que exigir ahí es OTRA cosa —que la página lo
            # diga— y contar el 503 como fallo hacía que ese caso no
            # pudiera pasar nunca, por bien resuelto que estuviera.
            # ⚠️ EN MINUSCULAS, PORQUE `innerText` DEVUELVE EL TEXTO
            # **RENDERIZADO**: el `<h2>` lleva `text-transform:uppercase`,
            # así que la frase llega como «NO PUDE CARGAR LOS DATOS» y
            # buscarla tal cual la escribí daba que no estaba. El panel se
            # dibujaba perfecto —display block, alto 124 px— y la prueba
            # decía que no. Medir la cosa equivocada se parece mucho a
            # medir bien.
            texto = (await pg.evaluate("document.body.innerText")).lower()
            aviso = "no pude cargar" in texto
            esperado = nombre == "api_caida" and all("503" in e for e in errs)
            print("\n== %s" % nombre)
            print("   secciones vivas: %s" % (vivas or "ninguna"))
            print("   paneles sin contenido: %s" % (huecos or "ninguno"))
            print("   errores: %s" % (errs[:3] or "ninguno"))
            if nombre == "api_caida":
                print("   avisa que no cargo: %s" % ("si" if aviso else "NO"))
            duro = [e for e in errs if e.startswith("JS:")]
            rompio = bool(duro or huecos)
            if errs and not esperado:
                rompio = True
            if nombre == "api_caida" and not aviso:
                rompio = True
            if rompio:
                mal += 1
            await pg.screenshot(path=os.path.join(BASE, 'salida', 'borde_%s.png' % nombre), full_page=True)
            await pg.close()
        await b.close()
        print('\n  %s\n' % ('los tres casos limpios' if not mal
                            else '🔴 %d caso(s) con problemas' % mal))
        return mal


def servir():
    """Un servidor local sobre `bot/paginas/`, en un hilo.

    ⚠️ HACE FALTA UN SERVIDOR DE VERDAD. Por `file://` el navegador
    rechaza el `fetch('/api/lobby')` antes de que Playwright pueda
    interceptarlo — la prueba probaria el rechazo del esquema.
    """
    import functools
    import http.server
    import threading
    h = functools.partial(http.server.SimpleHTTPRequestHandler,
                          directory=WEB)
    sv = http.server.ThreadingHTTPServer(('127.0.0.1', PUERTO), h)
    sv.daemon_threads = True
    threading.Thread(target=sv.serve_forever, daemon=True).start()
    return sv


if __name__ == '__main__':
    _sv = servir()
    try:
        raise SystemExit(asyncio.run(main()))
    finally:
        _sv.shutdown()

# -*- coding: utf-8 -*-
"""🧩 LAS PIEZAS DE LAS CARTAS: lo que se saca y se pone, como la ropa de un personaje.

Dlx, 16/11/2026, al Inventario: *«cuando tú seleccionas algo en el inventario, un tag, ese tiene que cambiar de la
tarjeta misma… previsualizar tu personaje completamente, como si estuviésemos cambiando la ropa»* y *«haz que todo sea
removable… vamos a añadir más tags, efectos, fondos, colores, formas y marcos… que el inventario sea capaz de resistir
todo eso»*: la Tienda va a vender piezas de carta.

🔑 CÓMO: cada generador dibuja su carta como siempre y, al lado, CADA VARIANTE de cada pieza ya dibujada con su propio
código (`variantes()`), en un `<script type="application/json" class="piezas">` que no pinta nada. La página carga la
carta armable (`comun/armable.py`) y cambia la pieza reemplazando el elemento `[data-pieza="<tipo>"]` por la variante:
sale idéntica a la imagen de /card, porque es el mismo HTML del mismo generador. Ninguna lógica de las cartas se copia
a JavaScript: la página no sabe cómo se dibuja un TAG de la Servidor, sólo lo cambia.

Una pieza nueva (un efecto, un fondo, una forma) es: el generador marca su elemento con `data-pieza` y agrega sus
variantes acá. El Inventario las muestra solas.

Hoy: `tag`. El marco va por fuera de la carta (lo dibuja la página alrededor, y `bot/con_marco.py` en /card).
"""
import html
import io
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT_WEB = os.path.join(RAIZ, 'web', 'src', 'tags_catalogo.json')
GANADOS = os.path.join(RAIZ, 'datos', 'tags_ganados.json')
GUARDA = ('siempre', 'temporada')
_c = {}


def _json(ruta):
    if ruta not in _c:
        try:
            with io.open(ruta, encoding='utf-8') as f:
                _c[ruta] = json.load(f)
        except (OSError, ValueError):
            _c[ruta] = {}
    return _c[ruta]


def _sin_num(t):
    return t.replace(' x%d', '').replace(' DE %d', '')


def _titulos():
    """`{título del Pase: carta}`. Del Pase de verdad; sin poder leerlo, ninguno (el resto de las piezas sigue)."""
    # ⚠️ se LEE de bot/pase.py, no se importa: importarlo trae el ciclo entero (sus módulos hermanos) a cada carta
    if '_tit' not in _c:
        try:
            import ast
            with io.open(os.path.join(RAIZ, 'bot', 'pase.py'), encoding='utf-8') as f:
                arbol = ast.parse(f.read())
            val = next(n.value for n in arbol.body if isinstance(n, ast.Assign)
                       and any(getattr(t, 'id', '') == 'TITULO_CARTA' for t in n.targets))
            _c['_tit'] = dict(ast.literal_eval(val))
        except Exception:  # noqa: BLE001 - un Pase que no se lee no deja la carta sin TAGs
            _c['_tit'] = {}
    return _c['_tit']


def opciones_tag(carta, clave):
    """`[(llave, texto, nivel)]`: TODOS los TAGs que se guardan de `carta` (también los que `clave` todavía no ganó:
    la Tienda y «Por ganar» los muestran puestos), con el texto que lleva en su carta si ya lo ganó (con su número,
    «CAMPEÓN x8»), y los títulos del Pase que van en esa carta. La llave es la del Inventario: el texto del catálogo,
    o `pase:<título>`."""
    gan = ((_json(GANADOS).get(str(clave or '')) or {}).get(carta)) or {}
    out = []
    for t, n, _p, g in (_json(CAT_WEB).get('cat') or {}).get(carta, []):
        if g in GUARDA:
            x = gan.get(t)
            out.append((t, x[0] if isinstance(x, list) and x else _sin_num(t), n))
    for tit, c in _titulos().items():
        if c == carta:
            out.append(('pase:' + tit, '✨ ' + tit.upper(), 't1'))
    return out


def variantes(carta, clave, dibujar, auto=None):
    """`{llave: html}` de la pieza TAG: `dibujar(texto, nivel)` es la función del generador que la dibuja, con todo su
    contexto (el color de tu servidor, tu bandera, dónde cae). `auto` es lo que sale con «Automático» (la cascada)."""
    out = {}
    for llave, texto, nivel in opciones_tag(carta, clave):
        out[llave] = dibujar(texto, nivel)
    if auto:
        out['auto'] = dibujar(auto[0], auto[1])
    return out


def script(piezas):
    """El `<script>` que viaja con la carta y no pinta nada: `{tipo: {llave: html}}`. `</` escapado para que un texto
    no cierre el script."""
    s = json.dumps(piezas, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    return '<script type="application/json" class="piezas">%s</script>' % s


def marca(tipo):
    """El atributo que marca el elemento de una pieza: `data-pieza="tag"`."""
    return 'data-pieza="%s"' % html.escape(tipo, quote=True)


def _self_check():
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    bien = True

    def ok(c, t):
        nonlocal bien
        print(('  ✅ ' if c else '  🔴 ') + t)
        bien = bien and c
    ops = opciones_tag('temporada', '__nadie__')
    ok(len(ops) > 20 and all(len(o) == 3 for o in ops), 'todos los TAGs de la Temporada, también sin haber ganado ninguno (%d)' % len(ops))
    ok(all('%d' not in o[1] for o in ops), 'sin «x%d» en el texto de los que no se ganaron')
    v = variantes('temporada', '__nadie__', lambda t, n: '<b %s class="%s">%s</b>' % (marca('tag'), n, t), auto=('AUTO', 't4'))
    ok('auto' in v and len(v) == len(ops) + 1, 'una variante por TAG, y la de «Automático»')
    s = script({'tag': {'x': '</script><i>'}})
    ok('</script><i>' not in s[:-9] and s.endswith('</script>'), 'un texto no puede cerrar el script')
    print('✅ las piezas' if bien else '🔴 las piezas')
    sys.exit(0 if bien else 1)


if __name__ == '__main__':
    _self_check()

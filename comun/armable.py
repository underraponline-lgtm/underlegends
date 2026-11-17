# -*- coding: utf-8 -*-
"""🧩 LA CARTA ARMABLE: la misma carta del PNG, como documento que la página dibuja y viste (16/11/2026).

Dlx: *«cuando seleccionas un tag, ese tiene que cambiar de la tarjeta misma… como si estuviésemos cambiando la ropa a
un personaje»*. Cada exportador, después de sacar la foto de una carta, guarda al lado `<archivo>.armable.html`: el
elemento de esa carta (`outerHTML`, con sus imágenes adentro) y todo el CSS de la página tal como lo leyó el navegador,
MENOS las fuentes. `bot/subir_cartas.py` lo sube como `<persona>/<carta>.html` y el Inventario lo carga en un iframe
(`web/src/cartaviva.jsx`), donde cambia las piezas (`[data-pieza]`, ver `comun/piezas.py`).

⚠️ UN IFRAME Y NO EL SHADOW ROOT DE LA PÁGINA: el CSS de cada carta usa `body`, `:root` y selectores de la hoja
entera; adentro de un iframe todo eso vale igual que en el exportador, y nada se mezcla con el CSS de la página.

⚠️ LAS FUENTES VAN APARTE, UNA VEZ: son 579 KB (`comun/fonts/embed.css`) y la carta sin ellas pesa ~115. El documento
pide `/cartas/fuentes.css`, que `web/montar.py` copia de `comun/fonts/embed.css` (la misma, no otra).

⚠️ EL CSS SE LEE DEL NAVEGADOR (CSSOM) Y NO CON REGEX: se saltean las reglas `@font-face` y los `@import` (Google
Fonts, que en la carta no anda). Nada de regex sobre el CSS: ya se comió reglas enteras dos veces.
"""
import base64
import hashlib
import os
import re

FUENTES = '/cartas/fuentes.css'
#: ⚠️ LO PESADO Y COMPARTIDO VA APARTE, UNA VEZ (16/11/2026): medido, la Servidor de Makmah pesaba 2,4 MB por la textura
#: del fondo de su servidor (700 KB, dos veces) y el escudo a tamaño completo (465 KB) — los mismos para todo el
#: servidor. Toda imagen de más de `PESADA` caracteres sale a `_activos/<huella>.<ext>` y la carta la nombra por su
#: huella: `{{R2}}/cartas/a/<huella>.<ext>`. `bot/subir_cartas.py` la sube una sola vez y pone la dirección de R2
PESADA = 12000
R2 = '{{R2}}'
_DATA = re.compile(r'data:(image/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)')
_EXT = {'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg'}


def afuera(doc, carpeta):
    """Las imágenes pesadas del documento, a `carpeta/_activos/` y nombradas por su huella. Devuelve el documento."""
    def uno(m):
        tipo, b64 = m.group(1), m.group(2)
        if len(b64) < PESADA or tipo not in _EXT:
            return m.group(0)
        h = hashlib.sha1(b64.encode('ascii')).hexdigest()[:20]
        nombre = '%s.%s' % (h, _EXT[tipo])
        dest = os.path.join(carpeta, '_activos', nombre)
        if not os.path.exists(dest):
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as f:
                f.write(base64.b64decode(b64))
        return '%s/cartas/a/%s' % (R2, nombre)
    return _DATA.sub(uno, doc)


def activos_de(doc):
    """Los nombres de `_activos/` que nombra un documento ya armado."""
    return sorted(set(re.findall(re.escape(R2) + r'/cartas/a/([0-9a-f]{20}\.[a-z]+)', doc)))

# Lo que corre en la página del exportador: el CSS sin fuentes y la carta. `caja` es el recorte del PNG cuando la carta
# tiene cosas que cuelgan por fuera (los chips, los rombos): la carta va corrida adentro igual que en la foto. Y las
# piezas (`script.piezas`), aunque el generador las haya dejado al lado de la carta y no adentro
_JS = r"""(el, caja) => {
  const css = [];
  for (const s of document.styleSheets) {
    let rs; try { rs = s.cssRules; } catch (e) { continue; }
    for (const r of rs) {
      if (r.type === CSSRule.FONT_FACE_RULE || r.type === CSSRule.IMPORT_RULE) continue;
      css.push(r.cssText);
    }
  }
  const b = el.getBoundingClientRect();
  let html = el.tagName === 'BODY' ? el.innerHTML : el.outerHTML;
  if (!el.querySelector('script.piezas')) {
    let a = el.parentElement;
    while (a && !a.querySelector('script.piezas')) a = a.parentElement;
    const s = a && a.querySelector('script.piezas');
    if (s) html += s.outerHTML;
  }
  const c = caja || { x: b.x, y: b.y, width: b.width, height: b.height };
  return { css: css.join('\n'), html, w: Math.ceil(c.width), h: Math.ceil(c.height),
    l: Math.round((b.x - c.x) * 100) / 100, t: Math.round((b.y - c.y) * 100) / 100 };
}"""


def documento(css, html, w, h, l=0, t=0):
    """El documento armable. `w`×`h` es la caja de la foto (la página la usa para escalarla sin medir); `l`/`t`, dónde
    cae la carta adentro de esa caja."""
    return ('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="carta" content="%dx%d">'
            '<link rel="stylesheet" href="%s"><style>%s\n'
            'html,body{margin:0!important;padding:0!important;background:transparent!important;overflow:hidden}'
            'body{position:relative;width:%dpx;height:%dpx}'
            '.armable-pos{position:absolute;left:%spx;top:%spx}</style></head>'
            '<body><div class="armable-pos">%s</div></body></html>') % (w, h, FUENTES, css, w, h, l, t, html)


def ruta_de(png):
    """`salida/temporada_konan.png` -> `salida/temporada_konan.armable.html`."""
    return os.path.splitext(png)[0] + '.armable.html'


async def guardar(el, png, caja=None):
    """Guarda la armable de la carta `el` (un ElementHandle de Playwright) al lado de su PNG. Si algo falla, avisa y
    sigue: la carta y su PNG valen igual, y la página cae a la imagen."""
    try:
        d = await el.evaluate(_JS, caja)
        with open(ruta_de(png), 'w', encoding='utf-8') as f:
            f.write(afuera(documento(d['css'], d['html'], d['w'], d['h'], d['l'], d['t']), os.path.dirname(png)))
        return True
    except Exception as e:  # noqa: BLE001 - la armable no puede tumbar la carta
        print('🧩 sin armable para %s: %s' % (os.path.basename(png), str(e)[:160]))
        return False

"""
🖼️ LAS PORTADAS DE LOS MENSAJES DEL BOT: una franja de 1200×300 por familia (20/11/2026).

Dlx, a la maqueta de los comandos rehechos: «B» (la portada en todos) y «que sea más visual». Cada respuesta del bot lleva
arriba, adentro de su recuadro, la franja de su familia (Tienda, Drops, Crews, Ajustes…): negra, con la trama fina en
diagonal de las portadas de la página, el corte magenta y verde de la Liga y el título en Anton.

    python herramientas/portadas_discord.py            dibuja las que faltan o cambiaron, en bot/paginas/discord/
    python herramientas/portadas_discord.py --todas    las vuelve a dibujar todas
    python herramientas/portadas_discord.py --hoja X   además deja una hoja con todas juntas en X (un PNG)
    python herramientas/portadas_discord.py --auto     el self-check: no dibuja, mira lo que hay

🔑 LAS FAMILIAS SALEN DE `bot/vista.js` (`FAMILIAS`), que es el que arma la dirección de cada franja: si se escribieran
acá también, una familia nueva en el bot apuntaría a una imagen que nadie dibujó —y Discord no avisa de una imagen que no
carga—. `--auto` revisa justo eso: que cada familia tenga su PNG, de 1200×300 y liviano.

⚠️ VIVEN EN PAGES, NO EN R2: `bot/paginas/` se despliega solo al pushear (web.yml) y Pages sirve estáticos gratis, así
que no tocan el presupuesto del Worker. ⚠️ Discord guarda las imágenes POR DIRECCIÓN: si se redibujan, hay que subir
`PORTADA_V` en `bot/vista.js` o seguirá mostrando las de antes.

⚠️ SIN INTERNET: las fuentes van adentro —Archivo y Barlow Condensed de `comun/fonts/embed.css`, Anton del archivo que ya
sirve la página (`bot/paginas/inicio/f/`)— y el logo, de `bot/paginas/ul-blanco.png`.
"""
import base64
import io
import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(AQUI)
VISTA = os.path.join(BASE, 'bot', 'vista.js')
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'discord')
ANCHO, ALTO = 1200, 300
#: lo más que puede pesar una (en el celular se baja con cada mensaje)
TOPE_KB = 120


def familias():
    """`{familia: título}` de `FAMILIAS` en bot/vista.js."""
    s = io.open(VISTA, encoding='utf-8').read()
    m = re.search(r'export const FAMILIAS = \{(.*?)\};', s, re.S)
    if not m:
        sys.exit('no encuentro FAMILIAS en bot/vista.js')
    return dict(re.findall(r"([a-z]+):\s*'([^']+)'", m.group(1)))


def _b64(ruta):
    return base64.b64encode(io.open(ruta, 'rb').read()).decode('ascii')


def html(titulo):
    """La franja, como página: 1200×300, todo adentro."""
    fuentes = io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    anton = _b64(os.path.join(BASE, 'bot', 'paginas', 'inicio', 'f', 'anton-latin-400-normal.woff2'))
    anton_ext = _b64(os.path.join(BASE, 'bot', 'paginas', 'inicio', 'f', 'anton-latin-ext-400-normal.woff2'))
    logo = _b64(os.path.join(BASE, 'bot', 'paginas', 'ul-blanco.png'))
    t = (titulo.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
{fuentes}
@font-face{{font-family:'Anton';font-weight:400;src:url(data:font/woff2;base64,{anton}) format('woff2');
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}}
@font-face{{font-family:'Anton';font-weight:400;src:url(data:font/woff2;base64,{anton_ext}) format('woff2');
  unicode-range:U+0100-02AF,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF}}
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:{ANCHO}px;height:{ALTO}px;background:#0B0A0E}}
#f{{position:relative;width:{ANCHO}px;height:{ALTO}px;overflow:hidden;color:#fff;
  background:
    repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 2px,transparent 2px 9px),
    linear-gradient(100deg,#0B0A0E 0 58%,#E41373 58% 61%,#0B0A0E 61% 66%,#29B298 66% 67.5%,#14121a 67.5%);}}
#f .ojo{{position:absolute;left:64px;bottom:166px;font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;
  text-transform:uppercase;color:#bdb9c8}}
#f .ojo b{{color:#E41373;font-weight:700}}
#f h1{{position:absolute;left:60px;bottom:46px;font:400 98px/.9 'Anton','Archivo',sans-serif;text-transform:uppercase;
  letter-spacing:.01em;white-space:nowrap;max-width:620px}}
#f img{{position:absolute;right:92px;top:50%;width:150px;transform:translateY(-50%);opacity:.92}}
</style></head><body><div id="f"><div class="ojo">Under Legends <b>·</b> Liga Global</div><h1>{t}</h1>
<img src="data:image/png;base64,{logo}" alt=""></div></body></html>"""


def achicar(png):
    """El PNG con menos colores si se pasa del tope (la trama y el degradé del texto lo aguantan sin que se note)."""
    from PIL import Image
    if len(png) <= TOPE_KB * 1024:
        return png
    im = Image.open(io.BytesIO(png)).convert('RGB')
    for colores in (256, 128, 64):
        out = io.BytesIO()
        im.quantize(colors=colores, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(out, 'PNG', optimize=True)
        if out.tell() <= TOPE_KB * 1024:
            return out.getvalue()
    return out.getvalue()


def dibujar(fams, todas=False):
    """Dibuja las franjas que faltan (o todas). Devuelve `[(familia, ruta, kb)]`."""
    from playwright.sync_api import sync_playwright
    os.makedirs(SALIDA, exist_ok=True)
    hechas = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pag = b.new_page(viewport={'width': ANCHO, 'height': ALTO}, device_scale_factor=1)
        for fam, titulo in fams.items():
            ruta = os.path.join(SALIDA, 'portada-%s.png' % fam)
            pag.set_content(html(titulo), wait_until='load')
            pag.evaluate('document.fonts.ready')
            # ⚠️ que el título entre: si no, se achica la letra hasta que entre (nunca se corta)
            pag.evaluate("""() => { const h = document.querySelector('h1'); let t = 98;
              while (h.scrollWidth > 620 && t > 50) { t -= 4; h.style.fontSize = t + 'px'; } }""")
            png = achicar(pag.locator('#f').screenshot(type='png'))
            viejo = io.open(ruta, 'rb').read() if os.path.exists(ruta) else b''
            if todas or viejo != png:
                io.open(ruta, 'wb').write(png)
            hechas.append((fam, ruta, len(png) / 1024))
        b.close()
    return hechas


def hoja(destino, fams):
    """Todas las franjas una debajo de la otra, con un respiro, para mirarlas juntas."""
    from PIL import Image
    ims = [Image.open(os.path.join(SALIDA, 'portada-%s.png' % f)).convert('RGB') for f in fams]
    aire = 24
    h = Image.new('RGB', (ANCHO + 2 * aire, len(ims) * (ALTO + aire) + aire), (242, 241, 244))
    for k, im in enumerate(ims):
        h.paste(im, (aire, aire + k * (ALTO + aire)))
    h.save(destino, optimize=True)
    return destino


def auto():
    """El self-check: cada familia de bot/vista.js tiene su franja, de 1200×300 y por debajo del tope. No dibuja nada."""
    from PIL import Image
    fams = familias()
    mal = []
    if len(fams) < 8:
        mal.append('FAMILIAS de bot/vista.js tiene %d (¿se leyó mal?)' % len(fams))
    for f in fams:
        ruta = os.path.join(SALIDA, 'portada-%s.png' % f)
        if not os.path.exists(ruta):
            mal.append('falta %s' % os.path.relpath(ruta, BASE))
            continue
        kb = os.path.getsize(ruta) / 1024
        tam = Image.open(ruta).size
        if tam != (ANCHO, ALTO):
            mal.append('%s mide %dx%d' % (f, tam[0], tam[1]))
        if kb > TOPE_KB:
            mal.append('%s pesa %.0f KB (tope %d)' % (f, kb, TOPE_KB))
        print('  %-9s %4.0f KB  %dx%d' % (f, kb, tam[0], tam[1]))
    sobran = sorted(set(re.findall(r'portada-([a-z]+)\.png', ' '.join(os.listdir(SALIDA)))) - set(fams)) if os.path.isdir(SALIDA) else []
    if sobran:
        print('  (sobran, nadie las pide: %s)' % ', '.join(sobran))
    if mal:
        print('🔴 ' + ' · '.join(mal))
        return 1
    print('✅ las %d portadas están, de %dx%d y por debajo de %d KB' % (len(fams), ANCHO, ALTO, TOPE_KB))
    return 0


def main():
    if '--auto' in sys.argv:
        return auto()
    fams = familias()
    hechas = dibujar(fams, todas='--todas' in sys.argv)
    for fam, ruta, kb in hechas:
        print('  %-9s %5.1f KB  %s' % (fam, kb, os.path.relpath(ruta, BASE)))
    if '--hoja' in sys.argv:
        k = sys.argv.index('--hoja')
        if k + 1 < len(sys.argv):
            print('  la hoja: %s' % hoja(sys.argv[k + 1], list(fams)))
    print('⚠️ si alguna cambió, sube PORTADA_V en bot/vista.js: Discord guarda las imágenes por dirección')
    return auto()


if __name__ == '__main__':
    sys.exit(main())

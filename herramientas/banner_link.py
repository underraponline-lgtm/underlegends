# -*- coding: utf-8 -*-
"""LA IMAGEN GRANDE DE LA VISTA PREVIA DEL LINK (1200×630).

    python herramientas/banner_link.py                -> bot/paginas/og.png
    python herramientas/banner_link.py --servidores   -> bot/paginas/og/<sv>.png, una por servidor

🔑 Y UNA POR SERVIDOR (Dlx, 12/10/2026: «si el link está en un servidor, que la foto de portada tenga temática de ese
servidor; si no se puede, quitá ese thumbnail»). Misma piel, con el color y el logo de ese servidor, y al lado una página
chiquita, `bot/paginas/s/<sv>/index.html`, que sólo tiene la vista previa de ese servidor (su imagen, su nombre y su
color en la barrita de Discord) y lleva a la Liga al toque. El bot manda ese link en el chat de cada servidor
(`bot/debutantes.py`).

⚠️ UNA PÁGINA FIJA Y NO EL WORKER: desde el 04/10/2026 las páginas las sirve Pages directo (`_routes.json` sólo deja
pasar la API por `_worker.js`). Cambiar la vista previa de la portada según `?sv=` obligaba a mandar cada visita de la
Liga por el Worker. Discord no sigue el `refresh` ni el script: lee la vista previa de esta página; la persona, no la
ve. El color sale de `datos/colores_sv_marca.json` y el logo de `bot/paginas/logos/`.

🔑 Dlx, 28/09/2026, a «¿una imagen grande en la vista previa del link?»:
*«Siii»*. Hasta ese día el link pegado en Discord salía con el logo chico a
la derecha (`og:image` de 512×512 y `twitter:card=summary`). Con una imagen
de 1200×630 y `summary_large_image`, Discord la pone grande abajo del texto.

⚠️ ES LA PIEL DE LA PÁGINA, NO UNA NUEVA: el mismo negro, la trama de texto
«UNDER LEGENDS» (`.trama` de `bot/paginas/estilo.css`), el verde y el
magenta, Archivo y Barlow Condensed, y el logo de siempre. Las fuentes van
embebidas (`comun/fonts/embed.css`): Chromium no llega a Google Fonts desde
un entorno aislado.

⚠️ Discord guarda la vista previa de cada link un tiempo: un link que ya se
pegó antes puede seguir mostrando la vieja. Los links nuevos la toman sola.
"""
import base64
import io
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'og.png')


def _servidores():
    """`[(sigla, nombre, color, ruta del logo)]` de los servidores con logo en la página."""
    import json
    d = json.load(io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8'))['servidores']
    col = (json.load(io.open(os.path.join(BASE, 'datos', 'colores_sv_marca.json'), encoding='utf-8')).get('usar') or {})
    out = []
    for sv, x in d.items():
        logo = os.path.join(BASE, 'bot', 'paginas', 'logos', sv.lower() + '.webp')
        if os.path.exists(logo):
            out.append((sv, x.get('nombre') or sv, col.get(sv) or '#29B298', logo))
    return out


def _esc(t):
    import html as H
    return H.escape(str(t or ''))


WEB = 'https://underlegends.pages.dev'
LIGA = '/freestyle-rap/'


def pagina_sv(sv):
    """La página chiquita de un servidor, `(sigla, nombre, color, logo)`: su vista previa, y a la Liga."""
    s, nom, col = sv[0].lower(), _esc(sv[1]), _esc(sv[2])
    desc = 'Sus eventos, su gente y sus tarjetas, en el ranking mundial del freestyle online.'
    # 🏟️ Y LLEVA A LA PÁGINA DE ESE SERVIDOR, no a la portada (Dlx, 14/10/2026, con FRZ: «asegurate que FRZ tenga su
    # link propio… con su thumbnail personalizado»): `/freestyle-rap/sv/<SIGLA>`, que también tiene esta vista previa
    # (`vistaServidor()` de bot/paginas/_worker.js)
    import json
    _x = (json.load(io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8'))['servidores'].get(sv[0])
          or {})
    # ⚠️ sólo los de la Liga tienen página: los demás (TWR, TFC, FTN, EFA) siguen yendo a la portada
    LIGA = ('/freestyle-rap/sv/' + str(_x.get('sigla') or sv[0]).upper()) if _x.get('confirmado') else '/freestyle-rap/'
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
            '<title>%(nom)s · Liga Global de Freestyle</title>\n'
            '<meta name="description" content="%(desc)s">\n'
            '<meta name="theme-color" content="%(col)s">\n'
            '<meta property="og:title" content="%(nom)s en la Liga Global de Freestyle">\n'
            '<meta property="og:description" content="%(desc)s">\n'
            '<meta property="og:type" content="website">\n'
            '<meta property="og:site_name" content="Under Legends">\n'
            '<meta property="og:url" content="%(web)s/s/%(s)s/">\n'
            '<meta property="og:image" content="%(web)s/og/%(s)s.png">\n'
            '<meta property="og:image:width" content="1200">\n'
            '<meta property="og:image:height" content="630">\n'
            '<meta name="twitter:card" content="summary_large_image">\n'
            '<meta name="twitter:image" content="%(web)s/og/%(s)s.png">\n'
            '<meta http-equiv="refresh" content="0;url=%(liga)s">\n'
            '<script>location.replace(%(ligaj)s)</script>\n'
            '</head><body><a href="%(liga)s">Liga Global de Freestyle</a></body></html>\n'
            % {'nom': nom, 'desc': desc, 'col': col, 'web': WEB, 's': s, 'liga': LIGA, 'ligaj': "'" + LIGA + "'"})


def html(sv=None):
    """La de la Liga, o con `sv = (sigla, nombre, color, logo)` la de ese servidor."""
    with io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8') as f:
        fuentes = f.read()
    with open(sv[3] if sv else os.path.join(BASE, 'bot', 'paginas', 'ul.png'), 'rb') as f:
        logo = base64.b64encode(f.read()).decode()
    mime = 'image/webp' if sv else 'image/png'
    filas = ''.join('<i>UNDER LEGENDS UNDER LEGENDS UNDER LEGENDS</i>' for _ in range(9))
    # 🎨 el color del servidor reemplaza al verde de la Liga (el magenta queda: es la marca de la Liga)
    c = sv[2] if sv else '#29B298'
    r_, g_, b_ = (int(c[i:i + 2], 16) for i in (1, 3, 5))
    etq = (sv[1] + ' · Liga Global') if sv else 'Under Legends · Temporada 1'
    titulo = ('%s<span>en la Liga Global</span>' % _esc(sv[1])) if sv else 'Liga Global<span>de Freestyle</span>'
    tam = 86 if not sv or len(sv[1]) <= 14 else 70 if len(sv[1]) <= 20 else 58
    texto = ('Sus eventos, su gente y sus tarjetas, en el ranking mundial del freestyle online.' if sv else
             'Los rankings de los mejores servidores de rap online, en una sola tabla mundial.')
    return '''<!doctype html><html><head><meta charset="utf-8"><style>
%(fuentes)s
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#030304;overflow:hidden;position:relative;
  font-family:Archivo,sans-serif;color:#EDEDF2}
.luz{position:absolute;inset:-80px;filter:blur(60px);
  background:radial-gradient(520px 420px at 16%% 20%%,rgba(%(rgb)s,.34),transparent 70%%),
             radial-gradient(560px 440px at 88%% 8%%,rgba(228,19,115,.32),transparent 68%%),
             radial-gradient(700px 360px at 60%% 105%%,rgba(%(rgb)s,.16),transparent 70%%)}
.trama{position:absolute;inset:-30px -120px;display:flex;flex-direction:column;
  justify-content:space-between;font:900 74px/1.02 Archivo,sans-serif;letter-spacing:-.025em;
  white-space:nowrap}
.trama i{display:block;font-style:normal}
.trama i:nth-child(4n+1){color:#E41373;opacity:.11}
.trama i:nth-child(4n+2){color:transparent;-webkit-text-stroke:1.5px %(c)s;opacity:.22}
.trama i:nth-child(4n+3){color:%(c)s;opacity:.08}
.trama i:nth-child(4n+4){color:transparent;-webkit-text-stroke:1.5px #E41373;opacity:.18}
.velo{position:absolute;inset:0;
  background:radial-gradient(120%% 90%% at 30%% 50%%,rgba(3,3,4,.55),rgba(3,3,4,.92) 70%%,#030304)}
.caja{position:absolute;inset:0;display:flex;align-items:center;gap:48px;padding:0 68px}
.logo{width:260px;height:260px;flex:0 0 auto;border-radius:10px;
  box-shadow:0 0 0 4px #030304,0 0 0 6px rgba(%(rgb)s,.55),0 30px 80px rgba(0,0,0,.6);object-fit:cover}
.txt{display:flex;flex-direction:column;gap:18px}
.etq{font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase;
  color:%(c)s}
h1{font:900 %(tam)dpx/.94 Archivo,sans-serif;white-space:nowrap;letter-spacing:-.03em;text-transform:uppercase}
h1 span{display:block;color:#E41373}
p{font:500 27px/1.3 Archivo,sans-serif;color:#9CAAA7;max-width:640px}
.pie{display:flex;gap:14px;align-items:center;white-space:nowrap;font:700 24px/1 'Barlow Condensed',sans-serif;
  letter-spacing:.12em;text-transform:uppercase;color:#EDEDF2}
.pie b{color:%(c)s;font-weight:700}
.url{font:800 30px/1 Archivo,sans-serif;color:%(c)s;letter-spacing:-.01em}
.raya{position:absolute;left:0;right:0;bottom:0;height:8px;
  background:linear-gradient(90deg,%(c)s,%(c)s 50%%,#E41373 50%%,#E41373)}
</style></head><body>
<div class="luz"></div><div class="trama">%(filas)s</div><div class="velo"></div>
<div class="caja">
  <img class="logo" src="data:%(mime)s;base64,%(logo)s" alt="">
  <div class="txt">
    <div class="etq">%(etq)s</div>
    <h1>%(titulo)s</h1>
    <p>%(texto)s</p>
    <div class="pie">Rankings <b>·</b> Tarjetas <b>·</b> Llaves en vivo <b>·</b> Eventos</div>
    <div class="url">underlegends.pages.dev</div>
  </div>
</div>
<div class="raya"></div>
<script>/* el nombre más largo se achica hasta entrar: «DISCORD RAP ESPAÑOL» se cortaba */
var h=document.querySelector("h1"),f=parseInt(getComputedStyle(h).fontSize,10);
while(h.getBoundingClientRect().right>1160&&f>40){f-=2;h.style.fontSize=f+"px";}</script>
</body></html>''' % {'fuentes': fuentes, 'filas': filas, 'logo': logo, 'mime': mime, 'c': c,
                       'rgb': '%d,%d,%d' % (r_, g_, b_), 'etq': _esc(etq), 'titulo': titulo, 'texto': texto, 'tam': tam}


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    from playwright.sync_api import sync_playwright
    trabajos = [(None, SALIDA)]
    if '--servidores' in sys.argv:
        os.makedirs(os.path.join(BASE, 'bot', 'paginas', 'og'), exist_ok=True)
        trabajos = [(s, os.path.join(BASE, 'bot', 'paginas', 'og', s[0].lower() + '.png')) for s in _servidores()]
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for sv, ruta in trabajos:
            pg.set_content(html(sv))
            pg.wait_for_timeout(300)
            pg.screenshot(path=ruta)
            print('   ✅ %s (%d KB)' % (os.path.relpath(ruta, BASE), os.path.getsize(ruta) // 1024))
            if sv:
                d = os.path.join(BASE, 'bot', 'paginas', 's', sv[0].lower())
                os.makedirs(d, exist_ok=True)
                with io.open(os.path.join(d, 'index.html'), 'w', encoding='utf-8', newline='\n') as f:
                    f.write(pagina_sv(sv))
        b.close()


if __name__ == '__main__':
    main()

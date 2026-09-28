# -*- coding: utf-8 -*-
"""LA IMAGEN GRANDE DE LA VISTA PREVIA DEL LINK (1200×630).

    python herramientas/banner_link.py        -> bot/paginas/og.png

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


def html():
    with io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8') as f:
        fuentes = f.read()
    with open(os.path.join(BASE, 'bot', 'paginas', 'ul.png'), 'rb') as f:
        logo = base64.b64encode(f.read()).decode()
    filas = ''.join('<i>UNDER LEGENDS UNDER LEGENDS UNDER LEGENDS</i>' for _ in range(9))
    return '''<!doctype html><html><head><meta charset="utf-8"><style>
%s
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#030304;overflow:hidden;position:relative;
  font-family:Archivo,sans-serif;color:#EDEDF2}
.luz{position:absolute;inset:-80px;filter:blur(60px);
  background:radial-gradient(520px 420px at 16%% 20%%,rgba(41,178,152,.34),transparent 70%%),
             radial-gradient(560px 440px at 88%% 8%%,rgba(228,19,115,.32),transparent 68%%),
             radial-gradient(700px 360px at 60%% 105%%,rgba(41,178,152,.16),transparent 70%%)}
.trama{position:absolute;inset:-30px -120px;display:flex;flex-direction:column;
  justify-content:space-between;font:900 74px/1.02 Archivo,sans-serif;letter-spacing:-.025em;
  white-space:nowrap}
.trama i{display:block;font-style:normal}
.trama i:nth-child(4n+1){color:#E41373;opacity:.11}
.trama i:nth-child(4n+2){color:transparent;-webkit-text-stroke:1.5px #29B298;opacity:.22}
.trama i:nth-child(4n+3){color:#29B298;opacity:.08}
.trama i:nth-child(4n+4){color:transparent;-webkit-text-stroke:1.5px #E41373;opacity:.18}
.velo{position:absolute;inset:0;
  background:radial-gradient(120%% 90%% at 30%% 50%%,rgba(3,3,4,.55),rgba(3,3,4,.92) 70%%,#030304)}
.caja{position:absolute;inset:0;display:flex;align-items:center;gap:48px;padding:0 68px}
.logo{width:260px;height:260px;flex:0 0 auto;border-radius:10px;
  box-shadow:0 0 0 4px #030304,0 0 0 6px rgba(41,178,152,.55),0 30px 80px rgba(0,0,0,.6)}
.txt{display:flex;flex-direction:column;gap:18px}
.etq{font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase;
  color:#29B298}
h1{font:900 86px/.94 Archivo,sans-serif;white-space:nowrap;letter-spacing:-.03em;text-transform:uppercase}
h1 span{display:block;color:#E41373}
p{font:500 27px/1.3 Archivo,sans-serif;color:#9CAAA7;max-width:640px}
.pie{display:flex;gap:14px;align-items:center;white-space:nowrap;font:700 24px/1 'Barlow Condensed',sans-serif;
  letter-spacing:.12em;text-transform:uppercase;color:#EDEDF2}
.pie b{color:#29B298;font-weight:700}
.url{font:800 30px/1 Archivo,sans-serif;color:#29B298;letter-spacing:-.01em}
.raya{position:absolute;left:0;right:0;bottom:0;height:8px;
  background:linear-gradient(90deg,#29B298,#29B298 50%%,#E41373 50%%,#E41373)}
</style></head><body>
<div class="luz"></div><div class="trama">%s</div><div class="velo"></div>
<div class="caja">
  <img class="logo" src="data:image/png;base64,%s" alt="">
  <div class="txt">
    <div class="etq">Under Legends · Temporada 1</div>
    <h1>Liga Global<span>de Freestyle</span></h1>
    <p>Los rankings de los mejores servidores de rap online, en una sola tabla mundial.</p>
    <div class="pie">Rankings <b>·</b> Tarjetas <b>·</b> Llaves en vivo <b>·</b> Eventos</div>
    <div class="url">underlegends.pages.dev</div>
  </div>
</div>
<div class="raya"></div>
</body></html>''' % (fuentes, filas, logo)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1200, 'height': 630})
        pg.set_content(html())
        pg.wait_for_timeout(300)
        pg.screenshot(path=SALIDA)
        b.close()
    print('   ✅ %s (%d KB)' % (os.path.relpath(SALIDA, BASE), os.path.getsize(SALIDA) // 1024))


if __name__ == '__main__':
    main()

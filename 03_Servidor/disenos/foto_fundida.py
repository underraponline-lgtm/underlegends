"""Como se funde la foto con la carta.

Sobre el panel 2, que es el elegido. Lo unico que cambia aca es COMO TERMINA
LA FOTO.

⚠️ EL ERROR: yo metia la foto en un rectangulo con canto duro. En las
referencias la foto NO TIENE BORDE: se desvanece contra el fondo, asi que no
hay caja. Por eso las suyas se ven integradas y la mia se veia como una foto
pegada encima de un fondo.

Y no es un detalle de acabado: es lo que decide si la carta es UNA PIEZA o
son dos cosas superpuestas. Un canto duro dice "aca termina la foto y
empieza la carta". Un fundido dice que la foto ES la carta.

⚠️ NUESTRO CASO ES PEOR QUE EL DE ELLOS, y por eso el fundido importa mas.
Sus fotos vienen RECORTADAS SIN FONDO: el jugador esta calado y detras se ve
la carta, asi que no hay borde que disimular. Las nuestras son fotos
rectangulares de Discord, con su propio fondo adentro. El fundido es lo
unico que evita que se lea el rectangulo.

Se hace con mask-image, no bajando la opacidad: bajar la opacidad apaga la
foto entera y el rectangulo se sigue viendo igual, solo que mas debil.
"""
import asyncio
import base64
import os
import re
import sys

from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from los_nueve import defs
from paneles import panel_pie, panel_col, PIE, COL

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = defs()[SV]
t = emblema.tono


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
# av_valen.png si esta, y un cartel que DICE «MUESTRA» si no.
# Antes era `b64(os.path.join(SCR, 'av_valen.png'))` en 44 archivos,
# y al importar cualquiera de ellos se leia del disco la foto de una
# persona. Ver 03_Servidor/disenos/_muestra.py.
from _muestra import cara_muestra
FOTO = cara_muestra()
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
BAN = 'https://flagcdn.com/w80/ar.png'
STATS = [('11', 'RCH'), ('305K', 'PTS'), ('57.3', 'WR%'),
         ('18', 'DUE'), ('35', 'POD'), ('80', 'EVT')]


def m(g):
    return f'-webkit-mask-image:{g};mask-image:{g};' \
           '-webkit-mask-composite:source-in;mask-composite:intersect'


ABAJO = 'linear-gradient(180deg,#000 0%,#000 58%,transparent 100%)'
DOS = ('linear-gradient(180deg,#000 0%,#000 56%,transparent 100%),'
       'linear-gradient(270deg,#000 0%,#000 74%,transparent 100%)')
CUATRO = ('radial-gradient(ellipse 86% 82% at 42% 42%,#000 46%,transparent 100%)')
FUERTE = ('radial-gradient(ellipse 78% 74% at 40% 40%,#000 28%,transparent 96%)')
SUAVE_ABAJO = 'linear-gradient(180deg,#000 0%,#000 38%,transparent 92%)'

CASOS = [
 ('1 · canto duro · lo que estaba mal', '', 'radius'),
 ('2 · fundido abajo, hacia la placa', m(ABAJO), ''),
 ('3 · fundido abajo y hacia la columna', m(DOS), ''),
 ('4 · fundido en los cuatro bordes', m(CUATRO), ''),
 ('5 · fundido fuerte · casi sin caja', m(FUERTE), ''),
 ('6 · fundido largo · la foto sube y sangra', m(SUAVE_ABAJO), 'sangra'),
]


def carta(i, etq, mask, modo):
    cid = f'f{i}'
    dpie, dcol = panel_pie(PIE), panel_col(*COL, 'der')
    clase = 'foto' + (' dura' if modo == 'radius' else '') + \
            (' sangra' if modo == 'sangra' else '')
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>
    {f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''}
    {f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''}
    <div class="{clase}" style="{mask}"><img src="{FOTO}"></div>
    <svg class="pan" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
      <defs>
        <linearGradient id="gp{i}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".05"/>
          <stop offset="1" stop-color="#000" stop-opacity=".52"/></linearGradient>
        <linearGradient id="gc{i}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".05"/>
          <stop offset="1" stop-color="#000" stop-opacity=".52"/></linearGradient>
      </defs>
      <path d="{dcol}" fill="url(#gc{i})"/>
      <path d="{dpie}" fill="url(#gp{i})"/>
    </svg>
    <div class="colu">
      <div class="num">81</div><div class="rng">S</div>
      <img class="ban" src="{BAN}">
      <div class="mini"><b>#2</b><u>COMP</u></div>
      <div class="mini"><b>#4</b><u>TEMP</u></div>
    </div>
    <div class="pie"><div class="nom">VALEN</div><div class="seis">""" + ''.join(
        f'<div><b>{v}</b><u>{k}</u></div>' for v, k in STATS) + f"""</div></div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'f{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:34px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1010px;line-height:1.55}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
.foto{{position:absolute;left:12px;right:96px;top:{MARGEN + 40}px;height:262px;
  z-index:3;overflow:hidden}}
.foto.dura{{border-radius:3px}}
.foto.sangra{{left:0;top:{MARGEN + 24}px;height:290px}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 14%}}
.pan{{position:absolute;inset:0;z-index:4;pointer-events:none}}
.colu{{position:absolute;top:{MARGEN + 44}px;right:14px;width:74px;z-index:5;
  display:flex;flex-direction:column;align-items:center;gap:5px}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2.1rem;font-weight:900;
  color:#fff;line-height:.9;text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.82rem;font-weight:900;
  color:{B};line-height:1;text-shadow:0 1px 3px rgba(0,0,0,.95)}}
.ban{{width:26px;height:19px;border-radius:3px;object-fit:cover;margin-top:3px;
  box-shadow:0 2px 5px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.75)}}
.mini{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.mini b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.92rem;
  font-weight:700;color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.95)}}
.mini u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.3rem;
  font-weight:900;letter-spacing:.6px;color:#fff;opacity:.7}}
.pie{{position:absolute;left:0;right:0;top:{MARGEN + PIE + 8}px;z-index:5;
  display:flex;flex-direction:column;align-items:center;gap:4px}}
.nom{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.24rem;font-weight:900;
  color:#fff;line-height:1;text-shadow:0 2px 4px rgba(0,0,0,.9)}}
.seis{{display:grid;grid-template-columns:repeat(6,1fr);width:262px}}
.seis div{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.seis b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.9rem;font-weight:700;
  color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.9)}}
.seis u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.29rem;
  font-weight:900;letter-spacing:.5px;color:#fff;opacity:.72}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">CÓMO TERMINA LA FOTO</div>'
           '<div class="aviso">Sobre el panel 2, que es el elegido. Lo único que '
           'cambia es cómo la foto se encuentra con la carta.<br><br>'
           'En las referencias <b>la foto no tiene borde</b>: se desvanece contra el '
           'fondo. Un canto duro dice «acá termina la foto y empieza la carta»; un '
           'fundido dice que la foto <b>es</b> la carta.<br><br>'
           '⚠️ Y nuestro caso es peor que el de ellos: sus fotos vienen <b>recortadas '
           'sin fondo</b>, así que no hay borde que disimular. Las nuestras son '
           'fotos rectangulares de Discord con su propio fondo adentro, y el fundido '
           'es lo único que evita que se lea el rectángulo. Va con máscara y no '
           'bajando la opacidad: la opacidad apaga la foto entera y el rectángulo se '
           'sigue viendo igual, solo que más débil.</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'foto_fundida.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1000},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'foto_fundida.png'), full_page=True)
        await b.close()
    print('-> foto_fundida.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())

"""Recrear la estructura de las cartas de referencia, adaptada a la Servidor.

LO QUE TIENEN ESAS CARTAS, que es lo que hay que reproducir:

  COLUMNA IZQUIERDA   franja vertical angosta, del tope a dos tercios, con
                      una PILA: numero arriba y debajo una cosa tras otra.
                      Va separada del cuerpo por un filete.
  BANDA INFERIOR      bloque horizontal al pie, con FONDO DISTINTO al del
                      cuerpo —mas claro, casi otro material—, donde va el
                      nombre. No flota sobre la foto: es una placa.
  LA FOTO             ocupa el centro y la derecha.

DOS COSAS QUE NO SE PUEDEN COPIAR TAL CUAL:

⚠️ LA BANDA NO PUEDE IR A TODO LO ANCHO ABAJO. Nuestra silueta cierra en
punta: debajo de y=356 se angosta hasta un vertice. La banda entra ENCIMA de
esa merma, y el pie queda para el UL, que ya vive ahi.

⚠️ EN LAS REFERENCIAS ESAS ZONAS NO LLEVAN STATS, LLEVAN IDENTIDAD. Columna:
numero, posicion, escudo, bandera. Banda: el nombre. Ninguna de esas cartas
muestra stats. Nosotros tenemos SEIS, asi que meterlas ahi es reutilizar las
zonas: por eso las variantes 3 y 4 prueban las dos formas de hacerlo.

Y el caso que decide: 118 de 138 NO TIENEN AVATAR. La 2 es esa.
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
FOTO = b64(os.path.join(SCR, 'av_valen.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{SV.lower()}.png'))
BAN = 'https://flagcdn.com/w80/ar.png'

STATS = [('11', 'RCH'), ('305K', 'PTS'), ('57.3', 'WR%'),
         ('18', 'DUE'), ('35', 'POD'), ('80', 'EVT')]


def foto(hay):
    if hay:
        return f'<div class="foto"><img src="{FOTO}"></div>'
    return '<div class="foto vacia"></div>'


def columna(items):
    return '<div class="colu">' + items + '</div>'


PILA_ID = (f'<div class="num">81</div><div class="rng">S</div>'
           f'<img class="ban" src="{BAN}">'
           f'<div class="mini"><b>#2</b><u>COMP</u></div>'
           f'<div class="mini"><b>#4</b><u>TEMP</u></div>')

PILA_STATS = ('<div class="num">81</div><div class="rng">S</div>'
              + ''.join(f'<div class="mini"><b>{v}</b><u>{k}</u></div>'
                        for v, k in STATS))


def banda(interior):
    return f'<div class="banda">{interior}</div>'


NOM = '<div class="nom">VALEN</div>'
NOM_STATS = ('<div class="nom chico">VALEN</div><div class="seis">'
             + ''.join(f'<div><b>{v}</b><u>{k}</u></div>' for v, k in STATS)
             + '</div>')

CASOS = [
 ('1 · la estructura, con foto',
  columna(PILA_ID) + foto(True) + banda(NOM)),
 ('2 · la misma, SIN foto · 118 de 138',
  columna(PILA_ID) + foto(False) + banda(NOM)),
 ('3 · las seis stats en la banda',
  columna(PILA_ID) + foto(True) + banda(NOM_STATS)),
 ('4 · las seis stats en la columna',
  columna(PILA_STATS) + foto(True)
  + banda(NOM + f'<img class="ban-b" src="{BAN}">')),
]


def carta(i, etq, dentro):
    cid = f'e{i}'
    cap = f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''
    rem = f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>{cap}{rem}
    <div class="dentro">{dentro}</div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'e{i}')}
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
.dentro{{position:absolute;left:0;right:0;top:{MARGEN}px;height:{PICO.h}px;z-index:5}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}

/* ── LA COLUMNA IZQUIERDA: pila, con filete que la separa del cuerpo ── */
.colu{{position:absolute;left:10px;top:40px;width:70px;bottom:112px;
  display:flex;flex-direction:column;align-items:center;gap:5px;
  border-right:1.5px solid rgba(255,255,255,.26);
  background:linear-gradient(90deg,rgba(0,0,0,.30),rgba(0,0,0,.10))}}
.num{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:2.1rem;font-weight:900;
  color:#fff;line-height:.9;text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.rng{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.82rem;font-weight:900;
  color:{B};line-height:1;margin-top:-2px;text-shadow:0 1px 3px rgba(0,0,0,.95)}}
.ban{{width:26px;height:19px;border-radius:3px;object-fit:cover;margin-top:3px;
  box-shadow:0 2px 5px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.75)}}
.mini{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.mini b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.92rem;font-weight:700;
  color:#fff;text-shadow:0 2px 4px rgba(0,0,0,.95)}}
.mini u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.3rem;
  font-weight:900;letter-spacing:.6px;color:#fff;opacity:.7}}

/* ── LA FOTO: centro y derecha ── */
.foto{{position:absolute;left:88px;right:14px;top:40px;bottom:112px;
  overflow:hidden;border-radius:4px}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 14%}}
.foto.vacia{{background:repeating-linear-gradient(45deg,
  rgba(255,255,255,.05) 0 8px,transparent 8px 16px);
  border:1px dashed rgba(255,255,255,.20)}}

/* ── LA BANDA INFERIOR: placa de otro material, encima de la merma ── */
.banda{{position:absolute;left:10px;right:10px;bottom:52px;padding:7px 0 9px;
  background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(226,226,236,.88));
  border-radius:3px;box-shadow:0 4px 14px rgba(0,0,0,.55);
  display:flex;flex-direction:column;align-items:center;gap:3px}}
.nom{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:1.34rem;font-weight:900;
  color:{t(A,-.30)};line-height:1;letter-spacing:.5px}}
.nom.chico{{font-size:1.06rem}}
.seis{{display:grid;grid-template-columns:repeat(6,1fr);width:100%;
  padding:0 6px;box-sizing:border-box}}
.seis div{{display:flex;flex-direction:column;align-items:center;line-height:1}}
.seis b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-size:.92rem;
  font-weight:700;color:{t(A,-.36)}}}
.seis u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.3rem;
  font-weight:900;letter-spacing:.5px;color:{t(A,-.10)};opacity:.9}}
.ban-b{{width:24px;height:17px;border-radius:2px;object-fit:cover;
  box-shadow:0 0 0 1px rgba(0,0,0,.3)}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    cuerpo = ''.join(carta(i, *c) for i, c in enumerate(CASOS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LA ESTRUCTURA DE LAS REFERENCIAS, EN NUESTRA CARTA</div>'
           '<div class="aviso"><b>Columna izquierda</b>: franja angosta con una pila '
           '—número arriba y debajo una cosa tras otra—, separada del cuerpo por un '
           'filete. <b>Banda inferior</b>: placa de otro material, más clara, donde '
           'va el nombre. <b>La foto</b> ocupa el centro y la derecha.<br><br>'
           '⚠️ <b>La banda no puede ir a todo lo ancho abajo</b>: la silueta cierra '
           'en punta, así que va encima de la merma y el pie queda para el UL.<br>'
           '⚠️ <b>En las referencias esas zonas no llevan stats, llevan identidad</b> '
           '—número, posición, escudo, bandera, nombre—. Ninguna muestra stats. '
           'Nosotros tenemos seis: la 3 las mete en la banda y la 4 en la columna.'
           '</div>'
           '<div class="fila">' + cuerpo + '</div></body></html>')
    out = os.path.join(SCR, 'estructura_fifa.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 800},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'estructura_fifa.png'),
                            full_page=True)
        await b.close()
    print('-> estructura_fifa.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())

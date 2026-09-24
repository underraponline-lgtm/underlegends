"""Donde van las stats y el avatar.

TRES DATOS QUE DECIDEN ESTO ANTES QUE EL GUSTO:

1. 118 DE 138 NO TIENEN AVATAR, y 6 de los 20 que si dan 404. En la enorme
   mayoria de las cartas la foto NO VA A EXISTIR. Por eso cada layout se
   dibuja dos veces, con foto y sin foto: si sin foto queda un agujero, el
   layout no sirve por mas lindo que se vea con ella.

2. AGRANDAR EL AVATAR YA SE PROBO Y SE DESCARTO, y no por gusto: las cartas
   de FIFA ponen la foto grande porque el jugador viene RECORTADO SIN FONDO.
   Los nuestros son fotos rectangulares, asi que agrandarlas tapa el fondo
   del servidor, que es lo que venimos construyendo. Esta en el LEEME.

3. EL LUGAR DEL AVATAR AHORA LO OCUPA EL EMBLEMA. Esta centrado arriba y su
   base llega a y=44 de la carta.

LA CAJA UTIL, medida sobre la silueta:

    y  31 .. 356   ancho completo
    y 356 .. 405   se cierra en punta, ahi solo entra el UL
    y   0 ..  31   los hombros suben al pico, y el centro lo tapa el emblema

Las seis stats son RCH, PTS, WR%, DUE, POD y EVT. Ojo que DUE hoy es 0/0 en
casi todos: los duelos son reales en 4 raperos.
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
D9 = defs()
SV = 'TFC'
B, A, FONDO, EXTRA, REMATE, _ = D9[SV]
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

STATS = [('11', 'RCH'), ('305K', 'PTS'), ('57.3', 'WR%'),
         ('18', 'DUE'), ('35', 'POD'), ('80', 'EVT')]


def av(clase, foto):
    if not foto:
        return f'<div class="{clase} sinfoto"><span>VA</span></div>'
    return f'<div class="{clase}"><img src="{FOTO}"></div>'


def stats(clase):
    return f'<div class="{clase}">' + ''.join(
        f'<div><b>{v}</b><u>{k}</u></div>' for v, k in STATS) + '</div>'


def rk(clase='rk'):
    return (f'<div class="{clase}"><span><b>#2</b><u>COMP</u></span>'
            f'<span><b>#4</b><u>TEMP</u></span></div>')


BAN = '<img class="ban" src="https://flagcdn.com/w80/ar.png">'


def L1(f):   # centrado clasico, stats 2x3
    return (f'<div class="num n-izq">81</div><div class="rng r-izq">S</div>'
            + av('foto f-centro', f) +
            f'<div class="bl-izq">{BAN}{rk()}</div>'
            '<div class="nom nom-1">VALEN</div>' + stats('st st-2x3'))


def L2(f):   # sin depender de la foto: numero grande, stats en fila de seis
    return (f'<div class="num n-grande">81</div><div class="rng r-grande">S</div>'
            + av('foto f-chica', f) +
            f'<div class="bl-der">{BAN}{rk()}</div>'
            '<div class="nom nom-2">VALEN</div>' + stats('st st-fila'))


def L3(f):   # patron de la Competitiva: fila de seis abajo
    return (f'<div class="num n-izq2">81</div><div class="rng r-izq2">S</div>'
            + av('foto f-der', f) +
            f'<div class="bl-pie">{BAN}{rk("rk h")}</div>'
            '<div class="nom nom-3">VALEN</div>' + stats('st st-fila2'))


def L4(f):   # medallon circular a la izquierda
    return (av('foto f-med', f) +
            f'<div class="num n-der">81</div><div class="rng r-der">S</div>'
            f'<div class="bl-pie">{BAN}{rk("rk h")}</div>'
            '<div class="nom nom-3">VALEN</div>' + stats('st st-2x3b'))


def L5(f):   # dos columnas arriba, stats abajo a lo ancho
    return ('<div class="col-izq"><div class="num n-col">81</div>'
            f'<div class="rng r-col">S</div>{BAN}{rk()}</div>'
            + av('foto f-col', f) +
            '<div class="nom nom-4">VALEN</div>' + stats('st st-fila3'))


def L6(f):   # sin foto por diseño: la foto es un detalle chico al pie
    return (f'<div class="num n-centro">81</div><div class="rng r-centro">S</div>'
            '<div class="nom nom-5">VALEN</div>' + stats('st st-2x3c') +
            av('foto f-pie', f) + f'<div class="bl-pie2">{BAN}{rk("rk h")}</div>')


LAYOUTS = [
 ('1 · centrado clásico · stats 2×3', L1),
 ('2 · número grande · stats en fila', L2),
 ('3 · patrón Competitiva · seis en fila', L3),
 ('4 · medallón a la izquierda', L4),
 ('5 · dos columnas arriba', L5),
 ('6 · la foto al pie, chica', L6),
]


def carta(i, etq, fn, foto):
    cid = f'c{i}'
    cap = f'<div class="cap" style="{EXTRA}"></div>' if EXTRA else ''
    rem = f'<div class="rem" style="{REMATE}"></div>' if REMATE else ''
    return f"""<div class="col"><div class="et">{etq}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{FONDO}"></div>{cap}{rem}
    <div class="dentro">{fn(foto)}</div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'c{i}')}
  {emblema.pieza(SV, A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:28px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;
  margin-bottom:16px;min-height:30px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:16px 0 8px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1010px;line-height:1.55}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
/* todo el contenido va corrido por el margen del emblema */
.dentro{{position:absolute;left:0;right:0;top:{MARGEN}px;height:{PICO.h}px;z-index:5}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}

.num,.rng,.nom,.st b,.st u,.rk b,.rk u{{position:relative;color:#fff;
  text-shadow:0 2px 5px rgba(0,0,0,.95)}}
.num{{position:absolute;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;line-height:.82}}
.rng{{position:absolute;font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;
  line-height:1;color:{B}}}
.nom{{position:absolute;left:0;right:0;text-align:center;
  font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;color:#fff;
  text-shadow:0 2px 4px rgba(0,0,0,.95),0 4px 16px rgba(0,0,0,.78)}}
.foto{{position:absolute;overflow:hidden;border:2.5px solid {B};
  box-shadow:0 6px 18px rgba(0,0,0,.82)}}
.foto img{{width:100%;height:100%;object-fit:cover;object-position:center 16%}}
.sinfoto{{display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.34)}}
.sinfoto span{{font-family:'Archivo','LigaEmoji',sans-serif;font-weight:900;color:#fff;
  opacity:.72;font-size:1.5rem;letter-spacing:1px}}
.ban{{width:22px;height:16px;border-radius:3px;object-fit:cover;display:block;
  box-shadow:0 2px 5px rgba(0,0,0,.8),0 0 0 1.5px rgba(255,255,255,.75)}}
.rk{{display:flex;flex-direction:column;gap:3px;margin-top:5px}}
.rk.h{{flex-direction:row;gap:5px;margin-top:0}}
.rk span{{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.48);
  border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:1px 5px 2px}}
.rk b{{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.58rem;font-weight:900}}
.rk u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.26rem;
  font-weight:900;letter-spacing:.6px;opacity:.66}}
.st{{position:absolute}}
.st div{{display:flex;align-items:baseline;gap:4px;justify-content:center}}
.st b{{font-family:'Barlow Condensed','LigaEmoji',sans-serif;font-weight:700}}
.st u{{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-weight:900;
  letter-spacing:.7px;opacity:.74}}

/* ── 1 · centrado clasico ── */
.n-izq{{top:56px;left:24px;font-size:2rem}}
.r-izq{{top:88px;left:25px;font-size:.78rem}}
.f-centro{{top:52px;left:50%;transform:translateX(-50%);width:104px;height:96px;
  border-radius:13px}}
.bl-izq{{position:absolute;top:106px;left:24px}}
.nom-1{{top:166px;font-size:1.34rem}}
.st-2x3{{top:206px;left:34px;right:34px;display:grid;
  grid-template-columns:1fr 1fr;row-gap:7px;column-gap:8px}}
.st-2x3 b{{font-size:1.12rem}} .st-2x3 u{{font-size:.35rem}}

/* ── 2 · numero grande, stats en fila ── */
.n-grande{{top:50px;left:24px;font-size:3.1rem}}
.r-grande{{top:100px;left:26px;font-size:1rem}}
.f-chica{{top:52px;right:22px;width:78px;height:74px;border-radius:11px}}
.bl-der{{position:absolute;top:134px;right:22px;align-items:flex-end;
  display:flex;flex-direction:column}}
.nom-2{{top:196px;font-size:1.4rem}}
.st-fila{{top:246px;left:12px;right:12px;display:grid;
  grid-template-columns:repeat(6,1fr);column-gap:2px}}
.st-fila div{{flex-direction:column;gap:1px}}
.st-fila b{{font-size:.94rem}} .st-fila u{{font-size:.32rem}}

/* ── 3 · patron Competitiva ── */
.n-izq2{{top:54px;left:22px;font-size:2.5rem}}
.r-izq2{{top:96px;left:23px;font-size:.9rem}}
.f-der{{top:54px;right:20px;width:96px;height:90px;border-radius:12px}}
.nom-3{{top:180px;font-size:1.44rem}}
.st-fila2{{top:222px;left:10px;right:10px;display:grid;
  grid-template-columns:repeat(6,1fr);column-gap:2px}}
.st-fila2 div{{flex-direction:column;gap:2px}}
.st-fila2 u{{font-size:.34rem;order:-1;opacity:.8}}
.st-fila2 b{{font-size:1.18rem}}
.bl-pie{{position:absolute;top:282px;left:0;right:0;display:flex;
  justify-content:center;align-items:center;gap:8px}}

/* ── 4 · medallon ── */
.f-med{{top:56px;left:22px;width:92px;height:92px;border-radius:50%}}
.n-der{{top:62px;right:26px;font-size:2.4rem}}
.r-der{{top:104px;right:30px;font-size:.88rem}}
.st-2x3b{{top:194px;left:26px;right:26px;display:grid;
  grid-template-columns:1fr 1fr;row-gap:6px;column-gap:8px}}
.st-2x3b b{{font-size:1.1rem}} .st-2x3b u{{font-size:.35rem}}

/* ── 5 · dos columnas ── */
.col-izq{{position:absolute;top:52px;left:24px;display:flex;
  flex-direction:column;align-items:flex-start}}
.n-col{{position:relative;font-size:2.2rem}}
.r-col{{position:relative;font-size:.82rem;margin:2px 0 6px}}
.f-col{{top:52px;right:24px;width:110px;height:104px;border-radius:13px}}
.nom-4{{top:174px;font-size:1.34rem}}
.st-fila3{{top:216px;left:16px;right:16px;display:grid;
  grid-template-columns:repeat(3,1fr);row-gap:10px;column-gap:4px}}
.st-fila3 div{{flex-direction:column;gap:1px}}
.st-fila3 b{{font-size:1.08rem}} .st-fila3 u{{font-size:.33rem}}

/* ── 6 · la foto al pie ── */
.n-centro{{top:56px;left:0;right:0;text-align:center;font-size:3.2rem}}
.r-centro{{top:112px;left:0;right:0;text-align:center;font-size:1rem}}
.nom-5{{top:146px;font-size:1.3rem}}
.st-2x3c{{top:186px;left:30px;right:30px;display:grid;
  grid-template-columns:1fr 1fr;row-gap:6px;column-gap:8px}}
.st-2x3c b{{font-size:1.1rem}} .st-2x3c u{{font-size:.35rem}}
.f-pie{{top:292px;left:26px;width:52px;height:50px;border-radius:9px}}
.bl-pie2{{position:absolute;top:300px;right:26px;display:flex;
  align-items:center;gap:6px}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()
    con = ''.join(carta(i, e, f, True) for i, (e, f) in enumerate(LAYOUTS))
    sin = ''.join(carta(20 + i, e, f, False) for i, (e, f) in enumerate(LAYOUTS))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">DÓNDE VAN LAS STATS Y EL AVATAR</div>'
           '<div class="aviso"><b>118 de 138 no tienen avatar</b>, y 6 de los 20 '
           'que sí dan 404. En la mayoría de las cartas la foto no va a existir, '
           'así que cada layout va dibujado dos veces. Si sin foto queda un agujero, '
           'el layout no sirve por más lindo que se vea con ella.<br><br>'
           'Agrandar el avatar ya se descartó con motivo: las cartas de FIFA ponen '
           'la foto grande porque el jugador viene <b>recortado sin fondo</b>. Los '
           'nuestros son fotos rectangulares y al agrandarlas tapan el fondo del '
           'servidor.</div>'
           '<div class="rot">CON FOTO</div><div class="fila">' + con + '</div>'
           '<div class="rot">SIN FOTO · el caso de 118 de 138</div>'
           '<div class="fila">' + sin + '</div></body></html>')
    out = os.path.join(SCR, 'contenido.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1400, 'height': 1200},
                              device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2800)
        await pg.screenshot(path=os.path.join(SCR, 'contenido.png'), full_page=True)
        await b.close()
    print('-> contenido.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())

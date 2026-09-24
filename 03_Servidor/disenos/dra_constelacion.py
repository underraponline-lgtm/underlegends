"""DRA · la idea de Drako: cielo y constelacion.

⚠️ EL CHOQUE, y no es de gusto: LA CARTA YA USA ESTRELLAS. Arriba del
emblema una estrella significa UN INTERSERVER GANADO. Si el fondo se llena
de estrellas, la del emblema deja de leerse como medalla. Es la misma logica
por la que solo se resalta el 100 en las stats: si se resalta todo, no
resalta nada.

Se resuelve separandolas POR FORMA, no por tamaño:

    fondo     PUNTOS REDONDOS, sin contorno, sin degrade
    medalla   la unica de CINCO PUNTAS, con contorno y degrade metalico

Un punto y una estrella de cinco puntas no se confunden a ningun tamaño. Si
alguna vez se ponen estrellitas de cinco puntas en el fondo, se rompe.

UN ARGUMENTO A FAVOR QUE APARECIO MIDIENDO: DRA es la carta MAS CLARA de las
nueve, con luz media 92.4. El orden va FFA 17.8 · TFC 23.0 · FRZ 67.6 ·
URBF 69.4 · TWR 70.0 · FTN 79.3 · EFA 83.5 · SR 87.7 · DRA 92.4. Entre 23 y
67 no hay nadie. Un cielo nocturno mete a DRA justo en ese hueco en vez de
amontonarla arriba con SR y EFA.

LA CONSTELACION NO ES GENERICA: dibuja el logo de DRA. La corona y los
microfonos cruzados salen de su propio escudo, asi que la carta dice "DRA"
aunque se tape el emblema. Es lo mismo que hace TWR con su fantasma, pero
con lineas en vez de una silueta.

Las tres lineas al pie no se tocan.
"""
import asyncio
import base64
import io
import os
import random
import re
import sys

from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(SCR, 'texturas')
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema
from dra_limpio import medir

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_dra.png'))
t = emblema.tono

A, B = '#3D5BFF', '#FFFFFF'
LINEAS = ('background:linear-gradient(180deg,transparent 0 70%,'
          'rgba(255,255,255,.90) 70% 71.4%,transparent 71.4% 73%,'
          'rgba(255,255,255,.90) 73% 74.4%,transparent 74.4% 76%,'
          'rgba(255,255,255,.90) 76% 77.4%,transparent 77.4%)')

CIELO = f'linear-gradient(172deg,{t(A,-.42)} 0%,{t(A,-.70)} 46%,#04040E 100%)'
CIELO_CLARO = f'linear-gradient(172deg,{t(A,-.10)} 0%,{t(A,-.48)} 48%,{t(A,-.82)} 100%)'
AZUL = f'linear-gradient(166deg,{t(A,.40)} 0%,{A} 42%,{t(A,-.70)} 100%)'


def polvo(n=150, semilla=7, brillo=1.0):
    """Puntos REDONDOS. Nunca de cinco puntas: eso es la medalla."""
    r = random.Random(semilla)
    p = []
    for _ in range(n):
        x = r.uniform(4, W - 4)
        y = r.uniform(MARGEN + 6, MARGEN + PICO.h - 40)
        rad = r.choice([0.7, 0.7, 0.9, 0.9, 1.1, 1.4, 1.8])
        op = r.uniform(.28, .95) * brillo * (0.6 if rad < 1 else 1)
        p.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad}" fill="#fff" '
                 f'opacity="{op:.2f}"/>')
    return ''.join(p)


# la corona del escudo de DRA, como constelacion
CORONA = [(82, 236), (98, 172), (118, 208), (150, 156), (182, 208),
          (202, 172), (218, 236)]
# los dos microfonos cruzados
MICROS = [(88, 260), (196, 148)], [(212, 260), (104, 148)]


def constelacion(pts, cerrar=False, r=2.6):
    d = 'M' + ' L'.join('%g,%g' % (x, y + MARGEN) for x, y in pts) + (' Z' if cerrar else '')
    nodos = ''.join(f'<circle cx="{x}" cy="{y + MARGEN}" r="{r}" fill="#fff" '
                    f'opacity=".92"/>' for x, y in pts)
    return (f'<path d="{d}" fill="none" stroke="#fff" stroke-width="1.2" '
            f'opacity=".55" stroke-linejoin="round"/>' + nodos)


def micros():
    out = ''
    for pts in MICROS:
        out += constelacion(pts, r=2.2)
    # las capsulas de los dos microfonos, mas gordas
    for x, y in ((196, 148), (104, 148)):
        out += (f'<circle cx="{x}" cy="{y + MARGEN}" r="7" fill="none" '
                f'stroke="#fff" stroke-width="1.2" opacity=".6"/>')
    return out


CASOS = [
 ('1 · actual · el azul con óxido', AZUL, '', ''),
 ('2 · cielo solo · polvo de estrellas', CIELO, polvo(), ''),
 ('3 · cielo + constelación de la corona', CIELO,
  polvo(120) + constelacion(CORONA), ''),
 ('4 · cielo + micrófonos cruzados', CIELO, polvo(120) + micros(), ''),
 ('5 · cielo + retícula de carta estelar', CIELO, polvo(130),
  'repeating-linear-gradient(90deg,rgba(255,255,255,.055) 0 1px,transparent 1px 30px),'
  'repeating-linear-gradient(0deg,rgba(255,255,255,.055) 0 1px,transparent 1px 30px)'),
 ('6 · cielo + vía láctea al pie', CIELO, polvo(170),
  'radial-gradient(ellipse 92% 26% at 50% 82%,rgba(150,180,255,.30),transparent 70%)'),
 ('7 · cielo más claro + corona', CIELO_CLARO,
  polvo(120, brillo=.85) + constelacion(CORONA), ''),
 ('8 · sin oscurecer · constelación sobre el azul', AZUL,
  polvo(110, brillo=.9) + constelacion(CORONA), ''),
 ('9 · cielo + corona + vía láctea', CIELO,
  polvo(150) + constelacion(CORONA),
  'radial-gradient(ellipse 92% 24% at 50% 84%,rgba(150,180,255,.26),transparent 70%)'),
]


def carta(i, etq, fondo, svg, capa, med=None):
    cid = f'c{i}'
    c = f'<div class="cap" style="background:{capa}"></div>' if capa else ''
    nota = (f'<div class="nu">mancha {med[1]:.2f} · grano {med[0]:.2f}</div>'
            if med else '')
    return f"""<div class="col"><div class="et">{etq}</div>{nota}
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})" id="m{i}">
    <div class="fondo" style="background:{fondo}"></div>{c}
    <svg class="cielo" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">{svg}</svg>
    <div class="rem" style="{LINEAS}"></div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'c{i}')}
  {emblema.pieza('DRA', A, B, ESC)}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:32px;flex-wrap:wrap;align-items:flex-start}}
.col{{text-align:center;width:{W}px;margin-bottom:30px}}
.et{{color:#EDEDF5;font-size:12.5px;font-weight:800;letter-spacing:1.1px;min-height:30px}}
.nu{{color:#8A8AA0;font-size:11px;margin:3px 0 14px}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 8px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0;font-size:13px}}
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:1000px;line-height:1.55}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1}}
.cielo{{position:absolute;inset:0;z-index:2}}
.rem{{position:absolute;inset:0;z-index:3}}
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'),
                   encoding='utf-8').read()

    def pagina(med=None):
        cuerpo = ''.join(carta(i, *c, med[i] if med else None)
                         for i, c in enumerate(CASOS))
        return ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
                + fuentes + CSS + '</style></head><body>'
                '<div class="rot">DRA · CIELO Y CONSTELACIÓN '
                '<span>— la idea de Drako</span></div>'
                '<div class="aviso"><b>El fondo va con puntos redondos, nunca con '
                'estrellas de cinco puntas.</b> Arriba del emblema una estrella '
                'significa un Interserver ganado: si el fondo se llena de estrellas, '
                'esa deja de leerse como medalla. Separadas por forma no se '
                'confunden a ningún tamaño.<br><br>'
                'Y hay un argumento a favor que apareció midiendo: DRA es la carta '
                '<b>más clara de las nueve</b> (luz 92.4). Entre TFC en 23 y FRZ en '
                '67 no hay nadie, así que el cielo la mete en un hueco vacío en vez '
                'de amontonarla arriba con SR y EFA.<br><br>'
                'La constelación <b>dibuja el logo de DRA</b> —su corona, sus '
                'micrófonos cruzados—, así que la carta dice DRA aunque se tape el '
                'emblema. Es lo que hace TWR con su fantasma, pero con líneas.</div>'
                '<div class="fila">' + cuerpo + '</div></body></html>')

    out = os.path.join(SCR, 'dra_constelacion.html')
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1200},
                              device_scale_factor=2)
        open(out, 'w', encoding='utf-8').write(pagina())
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        med = {}
        for i in range(len(CASOS)):
            el = await pg.query_selector(f'#m{i}')
            med[i] = medir(Image.open(io.BytesIO(await el.screenshot())))
        open(out, 'w', encoding='utf-8').write(pagina(med))
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'dra_constelacion.png'),
                            full_page=True)
        await b.close()
    print('-> dra_constelacion.png')

if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())

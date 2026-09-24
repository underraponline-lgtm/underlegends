"""DRA: sacarle las manchas. Drako dice que parece sucio, y la medicion coincide.

    grano   DRA 8.23   ·   8 de 9 de los nueve fondos
            solo EFA estaba peor, y a EFA ya lo bajamos

Su textura es OXIDO, que es de manchas grandes y blandas. A eso se le suma
que va con mix-blend-mode:overlay al 38%, o sea bien visible. La combinacion
—mancha grande + mucha opacidad— es exactamente lo que se lee como
suciedad, no como material.

LA DIRECCION: cambiar mancha por TRAMA. Las texturas del proyecto se parten
en dos familias y hasta ahora las mezclabamos sin darnos cuenta:

    de mancha       oxido · humo · craquelado · salpicadura · cuero
    de trama fina   fibra · tela · rayones · papel · trama · estatica

Las de mancha ensucian cuando se ven; las de trama dan material sin que se
note el dibujo. DRA venia de la familia equivocada.

Se conservan las TRES LINEAS AL PIE, que son lo aprobado de DRA y funcionan
como el puño de una manga. Lo unico que se mueve es la textura.

Cada variante se mide. El objetivo es meterse en la banda baja, donde estan
TFC, TWR, SR y FTN.
"""
import asyncio
import base64
import io
import os
import re
import sys

import numpy as np
from PIL import Image
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(SCR, 'texturas')
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun.siluetas import PICO
from comun import emblema

W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN
SIL = re.sub(r'(-?[\d.]+),(-?[\d.]+)',
             lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + MARGEN), PICO.d)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
ESC = b64(os.path.join(BASE, 'comun', 'escudos_cuad', 'sv_dra.png'))
def tx(n): return b64(os.path.join(TEX, n + '.png'))
t = emblema.tono

A, B = '#3D5BFF', '#FFFFFF'
GRAD = f'linear-gradient(166deg,{t(A,.40)} 0%,{A} 42%,{t(A,-.70)} 100%)'
# las tres lineas al pie: lo aprobado de DRA, no se tocan
LINEAS = ('background:linear-gradient(180deg,transparent 0 70%,'
          'rgba(255,255,255,.90) 70% 71.4%,transparent 71.4% 73%,'
          'rgba(255,255,255,.90) 73% 74.4%,transparent 74.4% 76%,'
          'rgba(255,255,255,.90) 76% 77.4%,transparent 77.4%)')


def cap(tex, tam, mez, op):
    return (f'background-image:url({tx(tex)});background-size:{tam};'
            f'background-repeat:repeat;background-position:center;'
            f'mix-blend-mode:{mez};opacity:{op}')


CASOS = [
 ('1 · actual · óxido al 38%', GRAD, cap('oxido', 'cover', 'overlay', '.38')),
 ('2 · sin textura · solo el degradé', GRAD, ''),
 ('3 · fibra fina', GRAD, cap('fibra', '190px', 'soft-light', '.30')),
 ('4 · tela', GRAD, cap('tela', '160px', 'soft-light', '.34')),
 ('5 · trama', GRAD, cap('trama', '150px', 'overlay', '.16')),
 ('6 · rayones al sesgo', GRAD, cap('rayones', '200%', 'overlay', '.18')),
 ('7 · papel', GRAD, cap('papel', '220px', 'soft-light', '.30')),
 ('8 · franjas verticales anchas, sin textura',
  f'repeating-linear-gradient(90deg,{t(A,.10)} 0 36px,{t(A,-.20)} 36px 72px),'
  + GRAD, ''),
 ('9 · corte diagonal, sin textura',
  f'linear-gradient(200deg,transparent 0 46%,{t(A,.30)} 46% 49%,'
  f'{t(A,-.44)} 49% 100%),' + GRAD, ''),
]


def _media(lum, k):
    pad = np.pad(lum, k // 2, mode='edge')
    ac = np.pad(np.cumsum(np.cumsum(pad, 0), 1), ((1, 0), (1, 0)))
    s = (ac[k:, k:] - ac[:-k, k:] - ac[k:, :-k] + ac[:-k, :-k]) / (k * k)
    return s[:lum.shape[0], :lum.shape[1]]


def medir(img):
    """Devuelve (grano, mancha). SON DOS COSAS DISTINTAS.

    ⚠️ Esto lo corrigio la propia medicion. Yo venia usando el grano —desvio
    contra el promedio de un vecindario de 9 px— como si midiera "se ve
    sucio", y NO LO MIDE. El grano capta lo de alta frecuencia: una trama
    fina lo dispara aunque se vea limpia. Las manchas del oxido son grandes
    y blandas, asi que a 9 px casi no aparecen.

    Es el mismo error que ya esta anotado en CLAUDE.md al reves: alli la
    ventana era mas grande que lo medido; aca es mas chica. En los dos casos
    el numero que sale no contesta la pregunta que se hizo.

    MANCHA se mide a 61 px: cuanto se aparta la imagen ya suavizada de su
    propio degrade. Eso si separa mancha de trama, porque una trama fina
    promedia a plano y una mancha no.
    """
    a = np.array(img.convert('RGB')).astype(float)
    lum = .2126 * a[:, :, 0] + .7152 * a[:, :, 1] + .0722 * a[:, :, 2]
    grano = np.abs(lum - _media(lum, 9)).mean()
    suave = _media(lum, 21)                  # borra la trama, deja la mancha
    mancha = np.abs(suave - _media(suave, 61)).mean()
    return grano, mancha


def carta(i, etq, fondo, capa, medida=None):
    cid = f'd{i}'
    c = f'<div class="cap" style="{capa}"></div>' if capa else ''
    nota = (f'<div class="nu">mancha <b>{medida[1]:.2f}</b> · grano {medida[0]:.2f}</div>'
            if medida is not None else '')
    return f"""<div class="col"><div class="et">{etq}</div>{nota}
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})" id="m{i}">
    <div class="fondo" style="background:{fondo}"></div>{c}
    <div class="rem" style="{LINEAS}"></div>
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(1, W, sufijo=f'd{i}')}
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
.aviso{{color:#8A8AA0;font-size:12.5px;margin:0 0 22px;max-width:980px;line-height:1.55}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1}}
.rem{{position:absolute;inset:0;z-index:2}}
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
                '<div class="rot">DRA · SACARLE LAS MANCHAS '
                '<span>— Drako dice que parece sucio</span></div>'
                '<div class="aviso">Su textura es óxido, que es de manchas grandes, '
                'al 38% de opacidad. Las nueve texturas del proyecto se parten en '
                'dos familias: las de mancha (óxido, humo, craquelado, salpicadura, '
                'cuero) ensucian cuando se ven; las de trama fina (fibra, tela, '
                'rayones, papel, trama) dan material sin que se note el dibujo. '
                'Las tres líneas al pie no se tocan: son lo aprobado de DRA.<br><br>'
                '<b>Mirá la columna «mancha», no la de «grano».</b> El grano mide '
                'contraste a 9 px y una trama fina lo dispara aunque se vea limpia; '
                'las manchas del óxido son grandes y blandas, así que a esa escala '
                'casi no aparecen. La mancha se mide a 61 px sobre la imagen ya '
                'suavizada, y ahí sí se separan las dos familias.</div>'
                '<div class="fila">' + cuerpo + '</div></body></html>')

    out = os.path.join(SCR, 'dra_limpio.html')
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
            print('%-46s mancha %5.2f   grano %5.2f'
                  % (CASOS[i][0], med[i][1], med[i][0]))
        open(out, 'w', encoding='utf-8').write(pagina(med))
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'dra_limpio.png'), full_page=True)
        await b.close()
    print('\n-> dra_limpio.png')


# Guardado para que medir() se pueda IMPORTAR sin disparar el render entero.
# Sin esto, cualquier hoja que quiera la medida vuelve a generar esta.
if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())

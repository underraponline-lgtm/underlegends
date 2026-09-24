"""v10 — el layout de FIFA Mobile, con esquirlas y gema al pie.

EL MAPA, leido de las cartas que paso Dlx:
    columna izquierda   numero grande · rango · bandera · #COMP y #TEMP
    foto                grande, a la derecha
    stats               donde estaba el nombre
    nombre              en banda, mas abajo
    logo del servidor   dentro de la GEMA, al pie
    UL                  arriba al centro, chico

COMO SE DIFERENCIA DE LA COMPETITIVA, que era el riesgo:
    la Competitiva  escudo trazado · rayos desde un punto · metal por RANGO ·
                    chips colgando a la derecha · rombos a la izquierda
    la Servidor     escudo biselado · arte por SERVIDOR · esquirlas de cristal
                    rompiendo el marco · gema al pie · columna izquierda
    No comparten ni la silueta, ni el criterio del metal, ni los colgantes.

Las esquirlas van FUERA del clip-path: por eso la carta se envuelve en un
wrapper. Dentro del clip serian invisibles, que fue el problema que ya nos
paso con los rayos.
"""
import asyncio, base64, json, os, re, subprocess, sys
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
SILD = os.path.join(BASE, 'comun', 'logos_sv')
CUAD = os.path.join(BASE, 'comun', 'escudos_cuad')
EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'), encoding='utf-8'))['estrellas_por_servidor']

PAL = {
 'TFC':  ('#600816', '#F2E9E9'), 'SR':   ('#C2540A', '#FFB03A'),
 'DRA':  ('#3D5BFF', '#FFFFFF'), 'FTN':  ('#2A3982', '#E8C86A'),
 'TWR':  ('#C40E45', '#FF5C8A'), 'FRZ':  ('#178C88', '#CFFAF4'),
 'URBF': ('#7B44BF', '#FFFFFF'), 'EFA':  ('#1A120C', '#E8A144'),
 'FFA':  ('#1A0630', '#EC48DC'),
}

# esquirlas: cada servidor con su propia forma, cantidad y ubicacion
ESQ = {
 'TFC':  [(-3, 8, 20, 46, 'polygon(0 0,100% 12%,74% 100%,0 78%)', -8),
          (97, 62, 17, 40, 'polygon(0 14%,100% 0,100% 86%,22% 100%)', 6)],
 'SR':   [(-6, 30, 26, 30, 'polygon(0 40%,64% 0,100% 52%,40% 100%)', -14),
          (94, 14, 22, 26, 'polygon(0 0,100% 34%,66% 100%,10% 62%)', 18),
          (86, 74, 18, 22, 'polygon(0 30%,100% 0,80% 100%)', -6)],
 'DRA':  [(-4, 20, 14, 56, 'polygon(0 0,100% 8%,100% 92%,0 100%)', 0),
          (96, 20, 14, 56, 'polygon(0 8%,100% 0,100% 100%,0 92%)', 0)],
 'FTN':  [(-5, 6, 18, 26, 'polygon(0 0,100% 20%,60% 100%)', -12),
          (95, 6, 18, 26, 'polygon(0 20%,100% 0,40% 100%)', 12),
          (-5, 66, 18, 26, 'polygon(0 100%,100% 80%,60% 0)', 12),
          (95, 66, 18, 26, 'polygon(0 80%,100% 100%,40% 0)', -12)],
 'TWR':  [(-9, 16, 30, 24, 'polygon(0 22%,72% 0,100% 60%,30% 100%)', -20),
          (90, 40, 28, 22, 'polygon(0 0,100% 28%,74% 100%,14% 66%)', 24),
          (-4, 66, 22, 20, 'polygon(0 50%,100% 0,86% 100%)', 8)],
 'FRZ':  [(-7, 10, 24, 30, 'polygon(0 30%,58% 0,100% 40%,44% 100%)', -10),
          (92, 26, 24, 34, 'polygon(0 0,100% 36%,70% 100%,8% 58%)', 14),
          (-5, 60, 20, 26, 'polygon(0 44%,100% 0,74% 100%)', 6),
          (90, 70, 20, 24, 'polygon(0 0,100% 40%,58% 100%)', -18)],
 'URBF': [(-8, 24, 28, 26, 'polygon(0 34%,66% 0,100% 46%,36% 100%)', -16),
          (91, 56, 26, 24, 'polygon(0 0,100% 30%,72% 100%,12% 64%)', 20)],
 'EFA':  [(-4, 12, 16, 24, 'polygon(50% 0,100% 50%,50% 100%,0 50%)', 0),
          (96, 12, 16, 24, 'polygon(50% 0,100% 50%,50% 100%,0 50%)', 0),
          (-4, 64, 16, 24, 'polygon(50% 0,100% 50%,50% 100%,0 50%)', 0),
          (96, 64, 16, 24, 'polygon(50% 0,100% 50%,50% 100%,0 50%)', 0)],
 'FFA':  [(-7, 18, 24, 34, 'polygon(0 26%,60% 0,100% 44%,40% 100%)', -12),
          (93, 34, 22, 30, 'polygon(0 0,100% 32%,68% 100%)', 16),
          (44, -4, 14, 12, 'polygon(50% 0,100% 100%,0 100%)', 0)],
}


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
def sil(sv): return b64(os.path.join(SILD, 'sv_%s.png' % sv.lower()))
def esc(sv): return b64(os.path.join(CUAD, 'sv_%s.png' % sv.lower()))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


def fondo(sv, a, b):
    if sv == 'TFC':  return 'repeating-linear-gradient(180deg,%s 0 30px,%s 30px 60px)' % (a, t(a,-.34))
    if sv == 'SR':   return 'linear-gradient(146deg,%s 0 54%%,%s 54%% 58%%,#1C1408 58%% 100%%)' % (t(a,.14), b)
    if sv == 'FRZ':  return 'linear-gradient(180deg,%s 0 43%%,%s 43%% 45%%,%s 45%% 100%%)' % (b, t(a,-.72), t(a,-.12))
    if sv == 'EFA':  return 'radial-gradient(circle at 50%% 30%%,%s 0%%,%s 22%%,%s 48%%,%s 100%%)' % (t(b,.20), t(b,-.40), t(a,.32), a)
    if sv == 'FFA':  return 'linear-gradient(168deg,%s 0%%,%s 52%%,#0C0518 100%%)' % (t(a,.28), a)
    if sv == 'TWR':  return 'linear-gradient(126deg,%s 0 30%%,%s 30%% 46%%,%s 46%% 72%%,%s 72%% 100%%)' % (t(a,-.55), a, t(b,-.15), t(a,-.4))
    return 'linear-gradient(168deg,%s 0%%,%s 100%%)' % (t(a,.20), t(a,-.44))


def css(cid, sv):
    a, b = PAL[sv]; s = sil(sv)
    r = []; add = r.append
    add('.card{--grad:transparent!important;background:linear-gradient(150deg,%s,%s,%s,%s)!important;'
        'padding:0!important}' % (t(a,.55), t(a,-.55), t(b,-.30), t(a,-.42)))
    add('.c-clip,.c-bg{inset:5px!important}')
    add('.c-edge{background:none!important;box-shadow:inset 0 0 0 2.5px %s,'
        'inset 0 0 0 4px rgba(0,0,0,.6)!important}' % b)
    add('.c-bg{background:%s!important}' % fondo(sv, a, b))
    add('.c-colwash,.c-scrim{display:none!important}')
    add('.c-vig{opacity:.26!important}')
    add('.c-tex{display:block!important;background-image:url(%s)!important;background-size:34px!important;'
        'opacity:.24!important;mix-blend-mode:soft-light!important}' % s)
    add('.c-shine{background:none!important;background-image:url(%s)!important;'
        'background-size:104%%!important;background-position:center 34%%!important;'
        'background-repeat:no-repeat!important;opacity:.20!important;mix-blend-mode:overlay!important}' % s)
    # FOTO grande a la derecha, sangrando
    add('.c-photo{top:5%!important;left:26%!important;right:-4%!important;width:auto!important;'
        'height:52%!important;transform:none!important;border:none!important;border-radius:0!important;'
        'z-index:3!important;-webkit-mask-image:linear-gradient(200deg,#000 0%,#000 62%,transparent 96%)!important;'
        'mask-image:linear-gradient(200deg,#000 0%,#000 62%,transparent 96%)!important}')
    add('.c-photo::after{display:none!important}')
    add('.c-photo img{object-position:center 12%!important}')
    add('.c-logo{display:none!important}')
    # COLUMNA IZQUIERDA
    add('.c-left{top:6%!important;left:7.5%!important;z-index:7!important;align-items:flex-start!important}')
    add('.c-ovr{font-size:2.45rem!important;line-height:.80!important}')
    add('.c-rank{font-size:.78rem!important;color:%s!important;margin-top:1px!important}' % b)
    add('.c-flag{width:26px!important;height:19px!important;border-radius:3px!important;'
        'margin-top:6px!important}')
    add('.c-sep{display:none!important}')
    # STATS donde estaba el nombre
    add('.c-stats{top:52%!important;left:7%!important;right:7%!important;row-gap:3px!important;z-index:6!important}')
    add('.c-vdiv{background:%s!important;opacity:.4!important}' % b)
    add('.c-val{font-size:1.02rem!important}')
    add('.c-lbl{font-size:.34rem!important}')
    # NOMBRE en banda, abajo
    add('.c-name{top:76%!important;font-size:1.16rem!important;z-index:6!important;'
        'letter-spacing:0!important}')
    add('.c-rule{top:73.5%%!important;background:linear-gradient(90deg,transparent,%s,transparent)!important}' % b)
    add('.c-band{display:none!important}')
    add('.c-foot{font-size:0!important;height:0!important}')
    return '\n'.join('#%s %s' % (cid, x) for x in r)


def esquirlas(sv, a, b):
    out = ''
    for (x, y, w, h, forma, rot) in ESQ[sv]:
        out += ('<i style="left:%s%%;top:%s%%;width:%s%%;height:%s%%;clip-path:%s;'
                'transform:rotate(%sdeg);background:linear-gradient(140deg,%s,%s,%s)"></i>'
                % (x, y, w, h, forma, rot, t(b,.30), t(b,-.35), t(a,.20)))
    return '<div class="esq">%s</div>' % out


def piezas(sv):
    a, b = PAL[sv]
    n = EST.get(sv, 0)
    est = ''.join('<i>&#9733;</i>' for _ in range(n))
    return ('<img class="ul-mini" src="%s">'
            '<div class="rk"><span><b>#2</b><u>COMP</u></span><span><b>#4</b><u>TEMP</u></span></div>'
            '<div class="estr">%s</div>') % (UL, est)


def gema(sv):
    a, b = PAL[sv]
    return ('<div class="gema" style="background:linear-gradient(145deg,%s,%s,%s)">'
            '<img src="%s"></div>' % (t(b,.35), t(b,-.42), t(b,.10), esc(sv)))


async def main():
    subprocess.run([sys.executable, os.path.join(BASE, '03_Servidor', 'normal_gen.py')],
                   capture_output=True, cwd=os.path.join(BASE, '03_Servidor'))
    h = open(os.path.join(BASE, '03_Servidor', 'salida', 'tarjeta_servidor.html'),
             encoding='utf-8').read()
    h = re.sub(r'@import url\([^)]*\);', '', h)
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    css_base = '\n'.join(re.findall(r'<style>(.*?)</style>', h, re.S))
    cartas = {}
    for m in re.finditer(r'<div>\s*(<div class="card.*?</div>)\s*<div class="tag">', h, re.S):
        nn = re.search(r'class="c-name">([^<]+)<', m.group(1))
        if nn: cartas[nn.group(1).strip().upper()] = m.group(1)

    ST = [('11','RCH'), ('305K','PTS'), ('57.3','WR%'), ('18','DUE'), ('35','POD'), ('80','EVT')]
    fs = ''.join('<div class="c-stat" style="grid-column:%d"><span class="c-val">%s</span>'
                 '<span class="c-lbl">%s</span></div>' % (1 if i % 2 == 0 else 3, v, l)
                 for i, (v, l) in enumerate(ST))

    reglas, filas = [], ''
    for i, sv in enumerate(['TFC','SR','TWR','FFA','FTN','DRA','FRZ','URBF','EFA']):
        cid = 'm%d' % i
        a, b = PAL[sv]
        reglas.append(css(cid, sv))
        c = cartas['VALEN']
        c = re.sub(r'(<div class="c-stats"><div class="c-vdiv"></div>).*?(</div>\s*<div class="c-foot">)',
                   r'\1' + fs + r'\2', c, flags=re.S)
        c = re.sub(r'(<div class="c-foot">)', piezas(sv) + r'\1', c, count=1)
        filas += ('<div class="col"><div class="et">%s · %d&#9733;</div>'
                  '<div class="wrap" id="%s">%s%s%s</div></div>'
                  % (sv, EST.get(sv,0), cid, esquirlas(sv, a, b), c, gema(sv)))

    pag = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
%s
%s
%s
body{background:#0B0B11;margin:0;padding:30px;font-family:system-ui,sans-serif}
.fila{display:flex;gap:40px;flex-wrap:wrap}
.col{text-align:center}
.et{color:#9A9AB0;font-size:11px;letter-spacing:1.2px;margin-bottom:14px;text-transform:uppercase}
.rot{color:#EDEDF5;font-size:14px;font-weight:700;letter-spacing:1px;margin:6px 0 16px}
.rot span{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}
/* WRAPPER: las esquirlas viven FUERA del clip-path de la carta */
.wrap{position:relative;width:300px;height:438px}
.esq{position:absolute;inset:0;z-index:0;pointer-events:none}
.esq i{position:absolute;display:block;filter:drop-shadow(0 3px 7px rgba(0,0,0,.65))}
.ul-mini{position:absolute;left:50%%;top:1.6%%;transform:translateX(-50%%);width:9%%;
  z-index:8;opacity:.9;filter:drop-shadow(0 2px 4px rgba(0,0,0,.9))}
/* rankings en la columna izquierda, debajo de la bandera */
.rk{position:absolute;left:7.5%%;top:26%%;z-index:7;display:flex;flex-direction:column;gap:3px}
.rk span{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.42);
  border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:1px 5px 2px}
.rk b{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.62rem;font-weight:900;color:#fff}
.rk u{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.26rem;font-weight:900;
  letter-spacing:.6px;opacity:.6;color:#fff}
/* estrellas: fila, arriba de la gema */
.estr{position:absolute;left:0;right:0;top:83.5%%;text-align:center;z-index:7;line-height:1}
.estr i{font-style:normal;font-size:.94rem;color:#fff;margin:0 1.5px;
  text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 8px rgba(255,255,255,.8)}
/* GEMA al pie, con el logo dentro */
.gema{position:absolute;left:50%%;bottom:-3%%;transform:translateX(-50%%) rotate(45deg);
  width:23%%;height:23%%;z-index:9;border-radius:7px;
  box-shadow:0 5px 16px rgba(0,0,0,.85),inset 0 0 0 2px rgba(255,255,255,.35);
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.gema img{width:78%%;transform:rotate(-45deg);border-radius:4px}
</style></head><body>
<div class="rot">v10 · EL LAYOUT DE FIFA MOBILE <span>— columna izquierda · foto grande sangrando · stats donde iba el nombre · nombre en banda · gema al pie con el logo · esquirlas rompiendo el marco</span></div>
<div class="fila">%s</div>
</body></html>""" % (fuentes, css_base, '\n'.join(reglas), filas)

    out = os.path.join(SCR, 'v10.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        bb = await p.chromium.launch(args=['--no-sandbox'])
        pg = await bb.new_page(viewport={'width': 1600, 'height': 1400}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(3400)
        await pg.screenshot(path=os.path.join(SCR, 'v10.png'), full_page=True)
        await bb.close()
    print('-> v10.png')

asyncio.run(main())

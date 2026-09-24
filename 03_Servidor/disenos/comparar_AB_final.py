"""A vs B, ojo con ojo.

A · LAYOUT NUEVO, FOTO CONTENIDA
    columna izquierda · foto en panel a la derecha, SIN sangrar · stats donde
    iba el nombre · nombre en banda · gema al pie.
    La foto se contiene porque nuestros avatares son fotos rectangulares con
    fondo, no recortes del personaje: al sangrar tapaban la carta entera.

B · AVATAR CHICO CENTRADO
    lo que ya funcionaba, mas la columna izquierda y la gema.
    avatar cuadrado centrado arriba · stats en rejilla 2x3 · nombre · gema.

Mismos servidores, mismos datos, uno al lado del otro.
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
 'URBF': ('#7B44BF', '#FFFFFF'), 'EFA':  ('#3A2412', '#E8A144'),
 'FFA':  ('#1A0630', '#EC48DC'),
}

# esquirlas facetadas: dos capas por esquirla, una clara y una oscura, para
# que se lea como cristal y no como banderita plana
ESQ = {
 'TFC':  [(-4, 10, 17, 40, -8), (98, 58, 15, 34, 7)],
 'SR':   [(-7, 28, 22, 26, -14), (95, 12, 19, 24, 18), (88, 70, 15, 19, -6)],
 'DRA':  [(-4, 22, 12, 50, 0), (97, 22, 12, 50, 0)],
 'FTN':  [(-5, 8, 15, 22, -12), (95, 8, 15, 22, 12), (-5, 62, 15, 22, 12), (95, 62, 15, 22, -12)],
 'TWR':  [(-9, 14, 26, 21, -20), (91, 38, 24, 19, 24), (-4, 64, 19, 17, 8)],
 'FRZ':  [(-7, 10, 21, 26, -10), (93, 24, 21, 30, 14), (-5, 58, 17, 22, 6), (91, 68, 17, 21, -18)],
 'URBF': [(-8, 22, 24, 23, -16), (92, 54, 22, 21, 20)],
 'EFA':  [(-4, 12, 14, 21, 0), (97, 12, 14, 21, 0), (-4, 62, 14, 21, 0), (97, 62, 14, 21, 0)],
 'FFA':  [(-7, 16, 21, 30, -12), (94, 32, 19, 26, 16), (45, -3, 12, 10, 0)],
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
    if sv == 'EFA':  return 'radial-gradient(circle at 50%% 30%%,%s 0%%,%s 24%%,%s 52%%,%s 100%%)' % (t(b,.16), t(b,-.30), t(a,.22), t(a,-.30))
    if sv == 'FFA':  return 'linear-gradient(168deg,%s 0%%,%s 52%%,#0C0518 100%%)' % (t(a,.28), a)
    if sv == 'TWR':  return 'linear-gradient(126deg,%s 0 30%%,%s 30%% 46%%,%s 46%% 72%%,%s 72%% 100%%)' % (t(a,-.55), a, t(b,-.15), t(a,-.4))
    return 'linear-gradient(168deg,%s 0%%,%s 100%%)' % (t(a,.20), t(a,-.44))


def comun(sv, a, b):
    s = sil(sv)
    return [
      '.card{--grad:transparent!important;background:linear-gradient(150deg,%s,%s,%s,%s)!important;'
      'padding:0!important}' % (t(a,.55), t(a,-.55), t(b,-.30), t(a,-.42)),
      '.c-clip,.c-bg{inset:5px!important}',
      '.c-edge{background:none!important;box-shadow:inset 0 0 0 2.5px %s,'
      'inset 0 0 0 4px rgba(0,0,0,.6)!important}' % b,
      '.c-bg{background:%s!important}' % fondo(sv, a, b),
      '.c-colwash,.c-scrim{display:none!important}',
      '.c-vig{opacity:.26!important}',
      '.c-tex{display:block!important;background-image:url(%s)!important;background-size:34px!important;'
      'opacity:.26!important;mix-blend-mode:soft-light!important}' % s,
      '.c-shine{background:none!important;background-image:url(%s)!important;'
      'background-size:104%%!important;background-position:center 36%%!important;'
      'background-repeat:no-repeat!important;opacity:.22!important;mix-blend-mode:overlay!important}' % s,
      '.c-photo::after{display:none!important}',
      '.c-logo{display:none!important}',
      '.c-sep{display:none!important}',
      '.c-band{display:none!important}',
      '.c-foot{font-size:0!important;height:0!important}',
      '.c-vdiv{background:%s!important;opacity:.4!important}' % b,
    ]


def css_A(cid, sv):
    a, b = PAL[sv]
    r = comun(sv, a, b)
    r += [
      # foto CONTENIDA en panel a la derecha.
      # OJO con el %: esta cadena SI lleva formateo (% b), asi que los por
      # ciento literales van dobles. Ya me comi este error tres veces.
      '.c-photo{top:7%%!important;left:34%%!important;right:6%%!important;width:auto!important;'
      'height:32%%!important;transform:none!important;border-radius:12px!important;'
      'border:2.5px solid %s!important;overflow:hidden!important;z-index:4!important;'
      '-webkit-mask-image:none!important;mask-image:none!important;'
      'box-shadow:0 6px 16px rgba(0,0,0,.8)!important}' % b,
      '.c-photo img{object-position:center 14%!important}',
      '.c-left{top:7%!important;left:8%!important;z-index:7!important;align-items:flex-start!important}',
      '.c-ovr{font-size:2.35rem!important;line-height:.80!important}',
      '.c-rank{font-size:.76rem!important;color:%s!important}' % b,
      '.c-flag{width:25px!important;height:18px!important;border-radius:3px!important;margin-top:5px!important}',
      '.c-stats{top:47%!important;left:7%!important;right:7%!important;row-gap:4px!important;z-index:6!important}',
      '.c-val{font-size:1.06rem!important}', '.c-lbl{font-size:.35rem!important}',
      # esta NO lleva formateo, asi que va un solo %
      '.c-name{top:73%!important;font-size:1.2rem!important;z-index:6!important;letter-spacing:0!important}',
      '.c-rule{top:70.5%%!important;background:linear-gradient(90deg,transparent,%s,transparent)!important}' % b,
    ]
    return '\n'.join('#%s %s' % (cid, x) for x in r)


def css_B(cid, sv):
    a, b = PAL[sv]
    r = comun(sv, a, b)
    r += [
      # avatar chico CENTRADO, lo que ya funcionaba
      '.c-photo{top:13%%!important;left:50%%!important;right:auto!important;'
      'transform:translateX(-50%%)!important;width:36%%!important;height:23%%!important;'
      'border-radius:14px!important;overflow:hidden!important;'
      '-webkit-mask-image:none!important;mask-image:none!important;'
      'border:2.5px solid %s!important;box-shadow:0 6px 18px rgba(0,0,0,.85)!important;'
      'z-index:4!important}' % b,
      '.c-photo img{object-position:center 16%!important}',
      '.c-left{top:6.5%!important;left:7%!important;z-index:7!important;align-items:flex-start!important}',
      '.c-ovr{font-size:2.0rem!important;line-height:.82!important}',
      '.c-rank{font-size:.72rem!important;color:%s!important}' % b,
      '.c-flag{width:22px!important;height:16px!important;border-radius:3px!important;margin-top:4px!important}',
      '.c-name{top:38.5%!important;font-size:1.36rem!important;z-index:6!important}',
      '.c-rule{top:45%%!important;background:linear-gradient(90deg,transparent,%s,transparent)!important}' % b,
      '.c-stats{top:48%!important;left:9%!important;right:9%!important;row-gap:5px!important;z-index:6!important}',
      '.c-val{font-size:1.1rem!important}',
    ]
    return '\n'.join('#%s %s' % (cid, x) for x in r)


def esquirlas(sv, a, b):
    out = ''
    for (x, y, w, h, rot) in ESQ[sv]:
        out += ('<i style="left:%s%%;top:%s%%;width:%s%%;height:%s%%;transform:rotate(%sdeg);'
                'background:linear-gradient(130deg,%s 0%%,%s 38%%,%s 62%%,%s 100%%)"></i>'
                % (x, y, w, h, rot, t(b,.45), t(b,-.15), t(a,-.35), t(b,.20)))
    return '<div class="esq">%s</div>' % out


def piezas(sv, modo):
    n = EST.get(sv, 0)
    est = ''.join('<i>&#9733;</i>' for _ in range(n))
    top = '26%' if modo == 'A' else '24%'
    return ('<img class="ul-mini" src="%s">'
            '<div class="rk" style="top:%s"><span><b>#2</b><u>COMP</u></span>'
            '<span><b>#4</b><u>TEMP</u></span></div>'
            '<div class="estr">%s</div>') % (UL, top, est)


def gema(sv):
    a, b = PAL[sv]
    return ('<div class="gema" style="background:linear-gradient(145deg,%s,%s,%s)">'
            '<img src="%s"></div>' % (t(b,.40), t(b,-.45), t(b,.12), esc(sv)))


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

    reglas, bloques = [], ''
    for sv in ['SR', 'TFC', 'FRZ', 'FFA', 'DRA']:
        a, b = PAL[sv]
        par = ''
        for modo in ('A', 'B'):
            cid = '%s%s' % (modo.lower(), sv.lower())
            reglas.append(css_A(cid, sv) if modo == 'A' else css_B(cid, sv))
            c = cartas['VALEN']
            c = re.sub(r'(<div class="c-stats"><div class="c-vdiv"></div>).*?(</div>\s*<div class="c-foot">)',
                       r'\1' + fs + r'\2', c, flags=re.S)
            c = re.sub(r'(<div class="c-foot">)', piezas(sv, modo) + r'\1', c, count=1)
            etq = ('A · foto contenida a la derecha' if modo == 'A'
                   else 'B · avatar chico centrado')
            par += ('<div class="col"><div class="et">%s</div>'
                    '<div class="wrap" id="%s">%s%s%s</div></div>'
                    % (etq, cid, esquirlas(sv, a, b), c, gema(sv)))
        bloques += '<div class="rot">%s · %d&#9733;</div><div class="fila">%s</div>' % (
            sv, EST.get(sv, 0), par)

    # Plantilla SIN formateo %: se rellena con replace. Asi los porcentajes de
    # CSS no chocan nunca con el formateo de Python, que es el error que ya
    # cometi tres veces en esta sesion.
    PLANTILLA = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
@@FUENTES@@
@@CSSBASE@@
@@REGLAS@@
body{background:#0B0B11;margin:0;padding:30px;font-family:system-ui,sans-serif}
.fila{display:flex;gap:52px;margin-bottom:30px}
.col{text-align:center}
.et{color:#9A9AB0;font-size:11px;letter-spacing:1.1px;margin-bottom:13px;text-transform:uppercase}
.rot{color:#EDEDF5;font-size:15px;font-weight:700;letter-spacing:1.5px;margin:10px 0 12px}
.wrap{position:relative;width:300px;height:438px}
.esq{position:absolute;inset:0;z-index:0;pointer-events:none}
.esq i{position:absolute;display:block;
  clip-path:polygon(0 34%,58% 0,100% 42%,44% 100%);
  filter:drop-shadow(0 3px 8px rgba(0,0,0,.7))}
.ul-mini{position:absolute;left:50%;top:1.6%;transform:translateX(-50%);width:9%;
  z-index:8;opacity:.9;filter:drop-shadow(0 2px 4px rgba(0,0,0,.9))}
.rk{position:absolute;left:7.5%;z-index:7;display:flex;flex-direction:column;gap:3px}
.rk span{display:flex;align-items:baseline;gap:3px;background:rgba(0,0,0,.44);
  border:1px solid rgba(255,255,255,.28);border-radius:5px;padding:1px 5px 2px}
.rk b{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.6rem;font-weight:900;color:#fff}
.rk u{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.25rem;font-weight:900;
  letter-spacing:.6px;opacity:.6;color:#fff}
.estr{position:absolute;left:0;right:0;top:82%;text-align:center;z-index:7;line-height:1}
.estr i{font-style:normal;font-size:.96rem;color:#fff;margin:0 1.5px;
  text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 8px rgba(255,255,255,.8)}
.gema{position:absolute;left:50%;bottom:1.5%;transform:translateX(-50%) rotate(45deg);
  width:20%;height:20%;z-index:9;border-radius:6px;
  box-shadow:0 5px 15px rgba(0,0,0,.9),inset 0 0 0 2px rgba(255,255,255,.4);
  display:flex;align-items:center;justify-content:center;overflow:hidden}
.gema img{width:76%;transform:rotate(-45deg);border-radius:4px}
</style></head><body>@@CUERPO@@</body></html>"""
    pag = (PLANTILLA.replace('@@FUENTES@@', fuentes)
                    .replace('@@CSSBASE@@', css_base)
                    .replace('@@REGLAS@@', '\n'.join(reglas))
                    .replace('@@CUERPO@@', bloques))

    out = os.path.join(SCR, 'comparar_AB_final.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        bb = await p.chromium.launch(args=['--no-sandbox'])
        pg = await bb.new_page(viewport={'width': 820, 'height': 1400}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(3400)
        await pg.screenshot(path=os.path.join(SCR, 'comparar_AB_final.png'), full_page=True)
        await bb.close()
    print('-> comparar_AB_final.png')

asyncio.run(main())

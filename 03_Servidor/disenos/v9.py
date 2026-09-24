"""v8 â€” los ajustes que pidio Dlx.

  FTN vs DRA   se separan de verdad: FTN azul PROFUNDO con orla dorada
               ornamental; DRA azul VIVO y limpio con placa blanca.
  FRZ          era raro y plano: ahora facetado de hielo, esquirlas angulares
               en varios tonos, que es el recurso "cristalino" de FUT.
  URBF         era muy basica: capas de grafiti desfasadas, banda de spray
               diagonal y contorno de pegatina.
  EFA          estaba bien pero apagada: cobre mas vivo, estallido radial y
               destellos calidos.
  FFA          se queda como estaba.
  SR           se queda (la favorita), solo se rebalancea el negro de abajo
               para que las stats no floten en el vacio.

Escudos: los nueve normalizados de comun/escudos_norm/ -- mismo diametro,
mismo encuadre, tinta al 70%% en todos.
"""
import asyncio, base64, json, os, re, subprocess, sys
from playwright.async_api import async_playwright

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
SILD = os.path.join(BASE, 'comun', 'logos_sv')
NORM = os.path.join(BASE, 'comun', 'escudos_norm')
EST = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'), encoding='utf-8'))['estrellas_por_servidor']

PAL = {
 'TFC':  ('#600816', '#F2E9E9'),
 'SR':   ('#C2540A', '#FFB03A'),
 'DRA':  ('#3D5BFF', '#FFFFFF'),   # azul VIVO
 'FTN':  ('#2A3982', '#E8C86A'),   # azul del logo (el anterior, que gustaba) + oro
 'TWR':  ('#C40E45', '#FF5C8A'),
 'FRZ':  ('#178C88', '#CFFAF4'),
 'URBF': ('#7B44BF', '#FFFFFF'),
 'EFA':  ('#1A120C', '#E8A144'),   # cobre mas vivo
 'FFA':  ('#1A0630', '#EC48DC'),
}


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))
def sil(sv): return b64(os.path.join(SILD, 'sv_%s.png' % sv.lower()))
def esc(sv): return b64(os.path.join(NORM, 'sv_%s.png' % sv.lower()))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


def estructura(sv, a, b):
    """(canto, filete, inset, fondo, capa extra)."""
    if sv == 'TFC':
        return (t(a,-.62), 'inset 0 0 0 2px %s' % b, 4,
                'repeating-linear-gradient(180deg,%s 0 30px,%s 30px 60px)' % (a, t(a,-.34)), '')
    if sv == 'SR':
        # rebalanceado: el negro arranca mas abajo asi las stats no flotan
        return ('#1A1208', 'inset 0 0 0 2px %s' % b, 3,
                'linear-gradient(146deg,%s 0 54%%,%s 54%% 58%%,#1C1408 58%% 100%%)' % (t(a,.14), b), '')
    if sv == 'DRA':
        # PLACA limpia, azul vivo, blanco
        return (t(a,-.42), 'inset 0 0 0 4px %s,inset 0 0 0 7px %s,inset 0 0 0 11px %s'
                % (b, t(a,-.30), b), 13,
                'linear-gradient(168deg,%s 0%%,%s 100%%)' % (t(a,.22), t(a,-.16)),
                'background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.09) 0 2px,transparent 2px 26px)')
    if sv == 'FTN':
        # ORLA ornamental dorada sobre azul profundo, con doble filete y esquinas
        return ('linear-gradient(150deg,%s,%s,%s,%s,%s)' % (b, t(b,-.5), b, t(b,-.35), t(b,.15)),
                'inset 0 0 0 3px rgba(0,0,0,.75),inset 0 0 0 5px %s,'
                'inset 0 0 0 7px rgba(0,0,0,.55)' % t(b,-.2), 17,
                'linear-gradient(168deg,%s 0%%,%s 100%%)' % (t(a,.10), t(a,-.5)),
                'background-image:repeating-linear-gradient(45deg,rgba(232,200,106,.13) 0 1px,transparent 1px 14px),'
                'repeating-linear-gradient(-45deg,rgba(232,200,106,.13) 0 1px,transparent 1px 14px)')
    if sv == 'TWR':
        return ('transparent', 'none', 0,
                'linear-gradient(126deg,%s 0 30%%,%s 30%% 46%%,%s 46%% 72%%,%s 72%% 100%%)'
                % (t(a,-.55), a, t(b,-.15), t(a,-.4)), '')
    if sv == 'FRZ':
        # FACETADO DE HIELO: esquirlas angulares en varios tonos
        return ('linear-gradient(120deg,%s,%s,%s)' % (b, t(a,-.6), t(b,-.3)),
                'inset 0 0 0 2px rgba(255,255,255,.85),inset 0 0 0 5px %s' % t(a,-.65), 6,
                'linear-gradient(168deg,%s 0%%,%s 100%%)' % (t(a,.18), t(a,-.5)),
                'background-image:'
                'linear-gradient(118deg,%s 0 22%%,transparent 22%%),'
                'linear-gradient(-134deg,%s 0 30%%,transparent 30%%),'
                'linear-gradient(150deg,transparent 0 58%%,%s 58%% 74%%,transparent 74%%),'
                'linear-gradient(-96deg,transparent 0 66%%,%s 66%% 100%%)'
                % ('rgba(255,255,255,.22)', 'rgba(0,0,0,.30)',
                   'rgba(255,255,255,.16)', 'rgba(0,0,0,.24)'))
    if sv == 'URBF':
        # GRAFITI EN CAPAS: banda de spray, marcas desfasadas, contorno pegatina
        return ('#FFFFFF', 'inset 0 0 0 3px rgba(0,0,0,.9)', 10,
                'linear-gradient(168deg,%s 0%%,%s 100%%)' % (t(a,.24), t(a,-.5)),
                # OJO: un solo % â€” a esta cadena NO se le aplica formateo, asi
                # que %% quedaria literal y el navegador descarta la regla.
                'background-image:'
                'linear-gradient(104deg,rgba(0,0,0,.42) 0 26%,transparent 26%),'
                'linear-gradient(-104deg,rgba(255,255,255,.16) 0 20%,transparent 20%),'
                'repeating-linear-gradient(72deg,rgba(255,255,255,.07) 0 2px,transparent 2px 11px),'
                'radial-gradient(circle at 78% 22%,rgba(255,255,255,.22),transparent 42%)')
    if sv == 'EFA':
        # MEDALLA VIVA: estallido radial + destellos calidos
        return ('linear-gradient(150deg,%s,%s,%s,%s)' % (b, t(b,-.55), t(b,.2), t(b,-.4)),
                'inset 0 0 0 3px rgba(0,0,0,.82),inset 0 0 0 5px %s' % t(b,-.3), 8,
                'radial-gradient(circle at 50%% 32%%,%s 0%%,%s 20%%,%s 46%%,%s 100%%)'
                % (t(b,.24), t(b,-.35), t(a,.30), a),
                # un solo % por lo mismo que en URBF
                'background-image:'
                'repeating-conic-gradient(from 0deg at 50% 30%,rgba(232,161,68,.26) 0deg 4deg,transparent 4deg 9deg),'
                'radial-gradient(circle at 50% 30%,rgba(255,196,104,.30),transparent 38%)')
    if sv == 'FFA':
        return ('#0A0410', 'inset 0 0 0 2px %s,inset 0 0 26px rgba(236,72,220,.55)' % b, 4,
                'linear-gradient(168deg,%s 0%%,%s 52%%,#0C0518 100%%)' % (t(a,.28), a), '')
    return (t(a,-.5), 'inset 0 0 0 4px rgba(0,0,0,.5)', 5,
            'linear-gradient(168deg,%s,%s)' % (t(a,.15), t(a,-.45)), '')


def css(cid, sv):
    a, b = PAL[sv]; s = sil(sv)
    canto, filete, inset, fondo, extra = estructura(sv, a, b)
    r = []; add = r.append
    # --grad es el degrade del RANGO que trae el generador. En la Servidor el
    # color ya no viene del rango, y .c-colwash lo pintaba enmascarado arriba a
    # la izquierda: esa era la "luz rara" dorada de EFA y URBF. Se neutraliza.
    add('.card{--grad:transparent!important;background:%s!important;padding:0!important}' % canto)
    add('.c-clip,.c-bg{inset:%dpx!important}' % inset)
    add('.c-edge{background:none!important;box-shadow:%s!important}' % filete)
    add('.c-bg{background:%s!important}' % fondo)
    if extra:
        add('.c-colwash{display:block!important;%s!important;inset:%dpx!important;z-index:1!important}'
            % (extra, inset))
    else:
        add('.c-colwash{display:none!important}')
    add('.c-scrim{display:none!important}')
    add('.c-vig{opacity:.24!important}')
    add('.c-tex{display:block!important;background-image:url(%s)!important;background-size:36px!important;'
        'opacity:.26!important;mix-blend-mode:soft-light!important}' % s)
    add('.c-shine{background:none!important;background-image:url(%s)!important;'
        'background-size:110%%!important;background-position:center 40%%!important;'
        'background-repeat:no-repeat!important;opacity:.22!important;'
        'mix-blend-mode:overlay!important}' % s)
    add('.c-photo{top:13%%!important;left:50%%!important;right:auto!important;'
        'transform:translateX(-50%%)!important;width:36%%!important;height:23%%!important;'
        'border-radius:14px!important;overflow:hidden!important;'
        '-webkit-mask-image:none!important;mask-image:none!important;'
        'border:2.5px solid %s!important;box-shadow:0 6px 18px rgba(0,0,0,.85)!important;'
        'z-index:4!important}' % b)
    add('.c-photo::after{display:none!important}')
    add('.c-photo img{object-position:center 16%!important}')
    add('.c-logo{display:none!important}')
    add('.c-left{top:6.5%!important;left:7%!important;z-index:7!important}')
    add('.c-ovr{font-size:2.05rem!important;line-height:.82!important}')
    add('.c-rank{font-size:.72rem!important;color:%s!important}' % b)
    add('.c-flag{width:19px!important;height:19px!important;margin-top:3px!important}')
    add('.c-sep{display:none!important}')
    add('.c-name{top:38.5%!important;font-size:1.4rem!important;z-index:6!important}')
    add('.c-rule{top:45.5%%!important;background:linear-gradient(90deg,transparent,%s,transparent)!important}' % b)
    add('.c-stats{top:48.5%!important;left:9%!important;right:9%!important;row-gap:5px!important;z-index:6!important}')
    add('.c-vdiv{background:%s!important;opacity:.45!important}' % b)
    add('.c-band{display:none!important}')
    add('.c-foot{font-size:0!important;height:0!important}')
    return '\n'.join('#%s %s' % (cid, x) for x in r)


def piezas(sv):
    n = EST.get(sv, 0)
    est = ''.join('<i>&#9733;</i>' for _ in range(n))
    return ('<img class="ul-top" src="%s">'
            '<div class="chips-pos"><span class="chip-pos"><b>#2</b><u>COMP</u></span>'
            '<span class="chip-pos"><b>#4</b><u>TEMP</u></span></div>'
            '<div class="estrellas-fila">%s</div>'
            '<img class="escudo-pie" src="%s">') % (UL, est, esc(sv))


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

    NUEVAS = [('11','RCH'), ('305K','PTS'), ('57.3','WR%'), ('18','DUE'), ('35','POD'), ('80','EVT')]
    fs = ''.join('<div class="c-stat" style="grid-column:%d"><span class="c-val">%s</span>'
                 '<span class="c-lbl">%s</span></div>' % (1 if i % 2 == 0 else 3, v, l)
                 for i, (v, l) in enumerate(NUEVAS))

    reglas, filas = [], ''
    for i, sv in enumerate(['FTN','DRA','FRZ','URBF','EFA','FFA','SR','TFC','TWR']):
        cid = 'q%d' % i
        reglas.append(css(cid, sv))
        c = cartas['VALEN']
        c = re.sub(r'(<div class="c-stats"><div class="c-vdiv"></div>).*?(</div>\s*<div class="c-foot">)',
                   r'\1' + fs + r'\2', c, flags=re.S)
        c = re.sub(r'(<div class="c-foot">)', piezas(sv) + r'\1', c, count=1)
        filas += ('<div class="col"><div class="et">%s</div><div id="%s">%s</div></div>' % (sv, cid, c))

    pag = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
%s
%s
%s
body{background:#0B0B11;margin:0;padding:26px;font-family:system-ui,sans-serif}
.fila{display:flex;gap:24px;flex-wrap:wrap}
.col{text-align:center}
.et{color:#9A9AB0;font-size:11px;letter-spacing:1.2px;margin-bottom:10px;text-transform:uppercase}
.rot{color:#EDEDF5;font-size:14px;font-weight:700;letter-spacing:1px;margin:6px 0 14px}
.rot span{color:#8A8AA0;font-weight:400;letter-spacing:0;text-transform:none}
.ul-top{position:absolute;left:50%%;top:2%%;transform:translateX(-50%%);width:12%%;
  z-index:8;opacity:.92;filter:drop-shadow(0 2px 4px rgba(0,0,0,.92))}
.chips-pos{position:absolute;right:6%%;top:6.5%%;z-index:7;display:flex;flex-direction:column;gap:4px}
.chip-pos{display:flex;flex-direction:column;align-items:center;line-height:1;
  background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.32);border-radius:7px;padding:3px 7px 4px}
.chip-pos b{font-family:'Archivo','LigaEmoji',sans-serif;font-size:.8rem;font-weight:900;color:#fff}
.chip-pos u{font-family:'Archivo','LigaEmoji',sans-serif;text-decoration:none;font-size:.3rem;
  font-weight:900;letter-spacing:.8px;opacity:.6;color:#fff;margin-top:1px}
.estrellas-fila{position:absolute;left:0;right:0;top:70%%;text-align:center;z-index:7;line-height:1}
.estrellas-fila i{font-style:normal;font-size:1.24rem;color:#fff;margin:0 2px;
  text-shadow:0 1px 2px rgba(0,0,0,.95),0 0 10px rgba(255,255,255,.8),0 0 22px rgba(255,255,255,.4)}
.escudo-pie{position:absolute;left:50%%;top:75.5%%;transform:translateX(-50%%);width:22%%;
  z-index:7;filter:drop-shadow(0 5px 14px rgba(0,0,0,.85))}
</style></head><body>
<div class="rot">v8 Â· LOS AJUSTES <span>â€” FTN azul profundo + oro vs DRA azul vivo + blanco Â· FRZ facetado de hielo Â· URBF grafiti en capas Â· EFA cobre vivo Â· escudos normalizados</span></div>
<div class="fila">%s</div>
</body></html>""" % (fuentes, css_base, '\n'.join(reglas), filas)

    out = os.path.join(SCR, 'v9.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1560, 'height': 1250}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(3400)
        await pg.screenshot(path=os.path.join(SCR, 'v9.png'), full_page=True)
        await b.close()
    print('-> v9.png')

asyncio.run(main())


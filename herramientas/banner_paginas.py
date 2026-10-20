# -*- coding: utf-8 -*-
"""LA IMAGEN DE LA VISTA PREVIA DE CADA PÁGINA (1200×630), UNA POR PÁGINA.

    python herramientas/banner_paginas.py            -> bot/paginas/og/p/<pagina>.png, las once
    python herramientas/banner_paginas.py crews ranking   sólo ésas
    python herramientas/banner_paginas.py --html     deja también el HTML de cada una, para mirarlo en el navegador

🔑 Dlx, 19/10/2026, con el link de /crews pegado en Discord y el cartel de la Liga abajo: *«quiero que cada página como
la de crews tenga su propio thumbnail. Usá 21st para ejemplos de diseños para ser únicos»*. Hasta ese día las once
páginas del menú compartían `og.png`; la de cada perfil y la de cada servidor ya tenían la suya (`vistaPerfil()` y
`vistaServidor()` en `bot/paginas/_worker.js`). Ahora `vistaPagina()` le pone a cada página su imagen, y éste las dibuja.

⚠️ LA MISMA PIEL QUE `banner_link.py` —el negro, la trama «UNDER LEGENDS», el verde, el magenta, Archivo y Barlow
Condensed, la raya de abajo— y LO QUE CAMBIA ES LA ILUSTRACIÓN: cada página lleva a la derecha una pieza propia, hecha en
HTML y CSS, que dice de qué va sin leer el texto. Las ideas salieron de buscar en 21st (sólo búsquedas, que no gastan el
cupo; ver `docs/remake/21st-log.md`): el ranking como «Rank Bars» (una fila héroe acentuada y barras), los eventos como
un ticket con talón perforado («Admit One Ticket»), las crews como una grilla de escudos («badge grid»), las
publicaciones como tarjetas de post apiladas. Ninguna copia código: son composiciones nuestras.

⚠️ SIN EMOJIS: las fuentes embebidas no los traen y Chromium aislado dibujaría cuadrados. Lo que parece ícono es CSS.
⚠️ LOS COLORES DE RANGO SALEN DE `comun/rangos.py` (`ACENTO`), como en todo el proyecto; los de servidor, de su logo.
⚠️ Discord guarda la vista previa de cada link un tiempo: un link que ya se pegó puede seguir mostrando la vieja.
"""
import base64
import io
import json
import os
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
SALIDA = os.path.join(BASE, 'bot', 'paginas', 'og', 'p')
VERDE, MAGENTA, TINTA, GRIS = '#29B298', '#E41373', '#EDEDF2', '#9CAAA7'


def _esc(t):
    import html as H
    return H.escape(str(t or ''))


def _b64(ruta):
    with open(ruta, 'rb') as f:
        return base64.b64encode(f.read()).decode()


def _rangos():
    from comun import rangos as R
    return R.ACENTO


def _siglas_crews(n=6):
    """Las siglas de las crews con más gente (`datos/crews_vivas.json`); sin sigla, las primeras letras del nombre."""
    try:
        d = json.load(io.open(os.path.join(BASE, 'datos', 'crews_vivas.json'), encoding='utf-8'))
        crews = d.get('crews', d)
        crews = list(crews.values()) if isinstance(crews, dict) else list(crews)
    except (OSError, ValueError):
        crews = []
    crews.sort(key=lambda c: -len(c.get('gente') or []))
    out = []
    for c in crews:
        s = (c.get('sigla') or '').strip().upper() or ''.join(ch for ch in str(c.get('nombre') or '') if ch.isalnum())[:4].upper()
        if s and s not in out:
            out.append(s[:4])
        if len(out) == n:
            break
    while len(out) < n:
        out.append(['CREW', 'LIGA', 'UL', 'T1', 'ORO', 'TOP'][len(out)])
    return out


def _logos_servidores(n=9):
    """`[(sv, base64 webp)]` de los servidores confirmados con logo en la página."""
    d = json.load(io.open(os.path.join(BASE, 'datos', 'servidores.json'), encoding='utf-8'))['servidores']
    out = []
    for sv, x in d.items():
        ruta = os.path.join(BASE, 'bot', 'paginas', 'logos', sv.lower() + '.webp')
        if x.get('confirmado') and os.path.exists(ruta):
            out.append((sv, _b64(ruta)))
    return out[:n]


# ── las ilustraciones: una por página, sólo HTML y CSS ─────────────────────────────────────────────────────────────

def _ranking():
    A = _rangos()
    filas = [('1', 'SSS', 100, '2.340'), ('2', 'SS', 76, '1.980'), ('3', 'S', 63, '1.610'), ('4', 'A', 54, '1.390'), ('5', 'B', 46, '1.120')]
    f = ''.join('<div class="fila%s"><b>#%s</b><span style="--c:%s">%s</span><i><u style="width:%d%%"></u></i><em>%s</em></div>'
                % (' hero' if i == 0 else '', p, A.get(r, VERDE), r, w, pts) for i, (p, r, w, pts) in enumerate(filas))
    css = '''
.lb{display:grid;gap:12px;width:440px}
.fila{display:grid;grid-template-columns:52px 66px 1fr 84px;align-items:center;gap:12px;height:62px;padding:0 16px;
  border:2px solid rgba(237,237,242,.14);background:rgba(3,3,4,.72)}
.fila.hero{border-color:#E41373;box-shadow:inset 0 0 0 1px #E41373,0 18px 40px rgba(0,0,0,.5);transform:scale(1.04)}
.fila b{font:900 26px/1 Archivo,sans-serif;color:#EDEDF2}
.fila span{justify-self:start;padding:6px 10px;border-radius:4px;background:var(--c);color:#030304;
  font:800 17px/1 'Barlow Condensed',sans-serif;letter-spacing:.06em}
.fila i{display:block;height:14px;background:rgba(237,237,242,.1)}
.fila u{display:block;height:100%;background:#29B298}
.fila.hero u{background:#E41373}
.fila em{font:700 22px/1 'Barlow Condensed',sans-serif;font-style:normal;color:#9CAAA7;text-align:right;font-variant-numeric:tabular-nums}
'''
    return '<div class="lb">%s</div>' % f, css


def _crews():
    siglas = _siglas_crews(6)
    tiers = [('ORO', '#F5C542'), ('PLATA', '#C9C9CE'), ('ORO', '#F5C542'), ('BRONCE', '#C47A3A'), ('PLATA', '#C9C9CE'), ('BRONCE', '#C47A3A')]
    esc = ''.join('<div class="esc" style="--c:%s"><b>%s</b><small>%s</small></div>' % (tiers[i][1], _esc(s), tiers[i][0])
                  for i, s in enumerate(siglas))
    css = '''
.crews{display:grid;grid-template-columns:repeat(3,140px);gap:18px;width:456px}
.esc{position:relative;height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;
  background:rgba(3,3,4,.85);clip-path:polygon(50% 0,100% 16%,100% 64%,50% 100%,0 64%,0 16%)}
.esc::before{content:"";position:absolute;inset:0;background:var(--c);clip-path:polygon(50% 0,100% 16%,100% 64%,50% 100%,0 64%,0 16%);z-index:-1}
.esc::after{content:"";position:absolute;inset:4px;background:#0B0B0F;clip-path:polygon(50% 0,100% 16%,100% 64%,50% 100%,0 64%,0 16%);z-index:-1}
.esc{z-index:0}
.esc b{font:900 34px/1 Archivo,sans-serif;letter-spacing:-.02em;color:#EDEDF2}
.esc small{font:700 14px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:var(--c)}
.crews .esc:nth-child(2){transform:translateY(-14px)}
.crews .esc:nth-child(5){transform:translateY(-14px)}
'''
    return '<div class="crews">%s</div>' % esc, css


def _eventos():
    html = '''<div class="tk">
  <div class="cuerpo">
    <small>HOY · 9:00 PM</small>
    <b>VOL. 24<br>1 vs 1</b>
    <div class="tags"><span>FFA</span><span class="m">x2 ESTA SEMANA</span></div>
  </div>
  <div class="talon"><span>LLAVE EN VIVO</span></div>
</div>
<div class="cal"><b>LUN</b><em>20</em></div>'''
    css = '''
.tk{display:flex;width:440px;height:250px;transform:rotate(-4deg);filter:drop-shadow(0 24px 40px rgba(0,0,0,.6))}
.cuerpo{flex:1;display:flex;flex-direction:column;justify-content:space-between;padding:26px 30px;background:#EDEDF2;color:#030304;
  border-radius:14px 0 0 14px}
.cuerpo small{font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:#E41373}
.cuerpo b{font:900 58px/.92 Archivo,sans-serif;letter-spacing:-.03em}
.tags{display:flex;gap:8px}
.tags span{padding:7px 10px;background:#030304;color:#EDEDF2;font:800 16px/1 'Barlow Condensed',sans-serif;letter-spacing:.1em;border-radius:3px}
.tags span.m{background:#E41373}
.talon{width:92px;display:flex;align-items:center;justify-content:center;background:#29B298;color:#030304;border-radius:0 14px 14px 0;
  border-left:3px dashed #030304}
.talon span{writing-mode:vertical-rl;transform:rotate(180deg);font:800 22px/1 'Barlow Condensed',sans-serif;letter-spacing:.2em}
.cal{position:absolute;right:-6px;bottom:62px;display:grid;justify-items:center;width:104px;padding:0 0 10px;background:#030304;
  border:3px solid #EDEDF2;border-radius:10px;transform:rotate(6deg)}
.cal b{width:100%;padding:6px 0;text-align:center;background:#E41373;font:800 18px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;border-radius:5px 5px 0 0}
.cal em{font:900 50px/1 Archivo,sans-serif;font-style:normal;color:#EDEDF2}
'''
    return html, css


def _tarjetas():
    A = _rangos()
    # (letra, color, giro, corrimiento en x, en y): la del medio arriba y derecha, las otras dos abiertas como una mano
    cartas = [('B', A.get('B', VERDE), -16, -130, 24), ('SSS', A.get('SSS', MAGENTA), 0, 0, -26), ('A', A.get('A', MAGENTA), 16, 130, 24)]
    c = ''.join('<div class="carta" style="--c:%s;--r:%ddeg;--x:%dpx;--y:%dpx"><i></i><b>%s</b><small>%s</small><u></u></div>'
                % (col, r, x, y, l, ovr) for (l, col, r, x, y), ovr in zip(cartas, ('81', '94', '87')))
    css = '''
.mano{position:relative;width:460px;height:420px}
.carta{position:absolute;left:50%;top:50%;width:176px;height:252px;margin:-126px 0 0 -88px;
  transform:translate(var(--x),var(--y)) rotate(var(--r));
  background:#0B0B0F;border:4px solid var(--c);border-radius:12px;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:6px;box-shadow:0 22px 50px rgba(0,0,0,.65)}
.carta:nth-child(2){z-index:2}
.carta i{position:absolute;inset:8px;border:1px solid rgba(237,237,242,.15);border-radius:7px}
.carta b{font:900 56px/1 Archivo,sans-serif;letter-spacing:-.03em;color:var(--c)}
.carta small{font:700 16px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;color:#9CAAA7}
.carta small::before{content:"OVR "}
.carta u{position:absolute;left:14px;right:14px;bottom:16px;height:10px;background:var(--c);opacity:.9}
'''
    return '<div class="mano">%s</div>' % c, css


def _pase():
    nodos = ''.join('<i class="%s"><b>%s</b></i>' % ('on' if n <= 12 else '', n) for n in (1, 5, 10, 20, 30))
    html = '''<div class="pase">
  <div class="niv"><small>TU NIVEL</small><b>12</b></div>
  <div class="xp"><u style="width:46%%"></u></div>
  <div class="nodos">%s</div>
  <div class="tareas"><span><i></i>2 diarias</span><span><i></i>5 semanales</span><span class="m"><i></i>+300 XP</span></div>
</div>''' % nodos
    css = '''
.pase{display:grid;gap:22px;width:450px;padding:30px;background:rgba(3,3,4,.8);border:2px solid rgba(237,237,242,.16);border-radius:10px}
.niv{display:flex;align-items:baseline;gap:14px}
.niv small{font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;color:#29B298}
.niv b{font:900 96px/.9 Archivo,sans-serif;letter-spacing:-.04em;color:#EDEDF2}
.xp{height:18px;background:rgba(237,237,242,.12);border-radius:3px;overflow:hidden}
.xp u{display:block;height:100%;background:#E41373}
.nodos{display:flex;justify-content:space-between}
.nodos i{width:52px;height:52px;border-radius:50%;border:3px solid rgba(237,237,242,.25);display:flex;align-items:center;justify-content:center;
  font-style:normal;background:#030304}
.nodos i.on{border-color:#29B298;background:#29B298}
.nodos b{font:800 20px/1 'Barlow Condensed',sans-serif;color:#EDEDF2}
.nodos i.on b{color:#030304}
.tareas{display:flex;gap:10px;flex-wrap:wrap}
.tareas span{display:inline-flex;align-items:center;gap:8px;padding:8px 12px;border:2px solid rgba(237,237,242,.2);border-radius:4px;
  font:700 18px/1 'Barlow Condensed',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#EDEDF2}
.tareas i{width:12px;height:12px;background:#29B298;border-radius:2px}
.tareas span.m{border-color:#E41373;color:#E41373}
.tareas span.m i{background:#E41373}
'''
    return html, css


def _ligas():
    # el fixture de una liga: las fechas jugadas, la de hoy y la que viene
    fechas = [('FECHA 1', 'jugada', 'ok'), ('FECHA 2', 'jugada', 'ok'), ('FECHA 3', 'HOY · 9 PM', 'hoy'), ('FECHA 4', '27/10', '')]
    f = ''.join('<div class="f %s"><i></i><b>%s</b><span>%s</span></div>' % (cl, n, e) for n, e, cl in fechas)
    html = '''<div class="fix">
  <div class="cab"><small>LIGA DE UN SERVIDOR</small><b>TEMPORADA 1</b></div>%s
  <div class="lider"><small>LÍDER</small><b>9 PTS</b><em>3 fechas · 3 ganadas</em></div>
</div>''' % f
    css = '''
.fix{width:440px;display:grid;gap:10px;padding:24px 26px;background:rgba(3,3,4,.82);border:2px solid rgba(237,237,242,.16);border-radius:10px;transform:rotate(2deg)}
.fix .cab{display:flex;justify-content:space-between;align-items:baseline;padding-bottom:12px;border-bottom:2px solid rgba(237,237,242,.2)}
.fix .cab small{font:700 16px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:#29B298}
.fix .cab b{font:900 20px/1 Archivo,sans-serif;letter-spacing:-.02em;color:#EDEDF2}
.fix .f{display:grid;grid-template-columns:24px 1fr auto;align-items:center;gap:14px;height:50px;padding:0 14px;border:2px solid rgba(237,237,242,.12)}
.fix .f i{width:16px;height:16px;border-radius:50%;border:3px solid rgba(237,237,242,.3)}
.fix .f.ok i{background:#29B298;border-color:#29B298}
.fix .f.hoy{border-color:#E41373;background:rgba(228,19,115,.12)}
.fix .f.hoy i{background:#E41373;border-color:#E41373;box-shadow:0 0 0 4px rgba(228,19,115,.3)}
.fix .f b{font:900 22px/1 Archivo,sans-serif;letter-spacing:-.02em;color:#EDEDF2}
.fix .f span{font:700 18px/1 'Barlow Condensed',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#9CAAA7}
.fix .f.hoy span{color:#E41373}
.lider{display:grid;grid-template-columns:auto auto 1fr;align-items:baseline;gap:12px;margin-top:6px;padding:12px 14px;background:#F5C542;color:#030304;border-radius:6px}
.lider small{font:800 15px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em}
.lider b{font:900 30px/1 Archivo,sans-serif;letter-spacing:-.03em}
.lider em{font:600 16px/1 'Barlow Condensed',sans-serif;font-style:normal;letter-spacing:.06em;text-align:right}
'''
    return html, css


def _tienda():
    html = '''<div class="tienda">
  <div class="moneda"><b>5.000</b><small>PUNTOS DE TIENDA</small></div>
  <div class="etiq a"><small>PRECIO POR CABEZA</small><b>1.200</b></div>
  <div class="etiq b"><small>+1 SEMANA DE PROMO</small><b>2.500</b></div>
</div>'''
    css = '''
.tienda{position:relative;width:460px;height:430px}
.moneda{position:absolute;left:30px;top:40px;width:270px;height:270px;border-radius:50%;background:#F5C542;
  box-shadow:inset 0 0 0 12px #D9A72A,inset 0 0 0 16px #F5C542,0 30px 60px rgba(0,0,0,.6);display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:4px;color:#030304;transform:rotate(-8deg)}
.moneda b{font:900 72px/1 Archivo,sans-serif;letter-spacing:-.04em}
.moneda small{font:800 15px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em}
.etiq{position:absolute;display:grid;gap:4px;padding:14px 18px 14px 34px;background:#EDEDF2;color:#030304;border-radius:6px;
  clip-path:polygon(18px 0,100% 0,100% 100%,18px 100%,0 50%);box-shadow:0 18px 36px rgba(0,0,0,.5)}
.etiq::before{content:"";position:absolute;left:22px;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:#030304}
.etiq small{font:700 14px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:#E41373}
.etiq b{font:900 40px/1 Archivo,sans-serif;letter-spacing:-.03em}
.etiq.a{right:0;top:52px;transform:rotate(8deg)}
.etiq.b{right:30px;bottom:30px;transform:rotate(-5deg);background:#29B298;color:#030304}
.etiq.b small{color:#030304}
'''
    return html, css


def _publicaciones():
    html = '''<div class="muro">
  <div class="post atras"><small>CREW · SUBE A ORO</small><b>LA FORMULA</b><span>semana del 20/10</span></div>
  <div class="post"><small>CAMPEÓN · FFA</small><b>VOL. 24</b><span>el lunes a la noche</span>
    <div class="ap"><i></i><em>23</em> felicitaron</div></div>
</div>'''
    css = '''
.muro{position:relative;width:430px;height:400px}
.post{position:absolute;left:0;right:12px;display:grid;gap:8px;padding:24px 26px;background:#0B0B0F;border:2px solid rgba(237,237,242,.18);border-radius:10px;
  box-shadow:0 22px 44px rgba(0,0,0,.6)}
.post.atras{top:0;transform:rotate(-3deg) scale(.94);opacity:.85}
.post:not(.atras){top:120px;transform:rotate(2deg)}
.post small{font:700 18px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:#E41373}
.post.atras small{color:#29B298}
.post b{font:900 46px/1 Archivo,sans-serif;letter-spacing:-.03em;color:#EDEDF2}
.post span{font:500 19px/1.2 Archivo,sans-serif;color:#9CAAA7}
.ap{display:inline-flex;align-items:center;gap:10px;justify-self:start;margin-top:6px;padding:10px 14px;border:2px solid #29B298;border-radius:4px;
  font:700 18px/1 'Barlow Condensed',sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#EDEDF2}
.ap i{width:18px;height:18px;background:#29B298;clip-path:polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)}
.ap em{font-style:normal;color:#29B298;font-size:22px}
'''
    return html, css


def _socios():
    logos = _logos_servidores(9)
    l = ''.join('<img src="data:image/webp;base64,%s" alt="">' % b for _, b in logos)
    css = '''
.socios{display:grid;grid-template-columns:repeat(3,118px);gap:16px;width:386px;transform:rotate(-4deg)}
.socios img{width:118px;height:118px;object-fit:cover;border-radius:16px;background:#030304;box-shadow:0 0 0 3px #030304,0 0 0 5px rgba(41,178,152,.6),0 18px 36px rgba(0,0,0,.6)}
.socios img:nth-child(even){box-shadow:0 0 0 3px #030304,0 0 0 5px rgba(228,19,115,.6),0 18px 36px rgba(0,0,0,.6)}
'''
    return '<div class="socios">%s</div>' % l, css


def _guia():
    html = '''<div class="pasos">
  <div class="paso"><b>1</b><div><strong>VERIFICATE</strong><span>con tu cuenta de Discord</span></div></div>
  <div class="paso"><b>2</b><div><strong>JUGÁ</strong><span>en cualquier servidor socio</span></div></div>
  <div class="paso"><b>3</b><div><strong>SUBÍ DE RANGO</strong><span>de E a SSS, con el Score</span></div></div>
</div>'''
    css = '''
.pasos{display:grid;gap:16px;width:420px}
.paso{display:flex;align-items:center;gap:20px;padding:18px 22px;background:#0B0B0F;border:2px solid rgba(237,237,242,.16);border-radius:10px}
.paso:nth-child(1){transform:translateX(-22px)}
.paso:nth-child(3){transform:translateX(18px)}
.paso b{flex:none;width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#29B298;color:#030304;
  font:900 34px/1 Archivo,sans-serif}
.paso:nth-child(2) b{background:#E41373;color:#EDEDF2}
.paso:nth-child(3) b{background:#EDEDF2}
.paso strong{display:block;font:900 26px/1 Archivo,sans-serif;letter-spacing:-.02em;color:#EDEDF2}
.paso span{display:block;margin-top:4px;font:500 18px/1.2 Archivo,sans-serif;color:#9CAAA7}
'''
    return html, css


def _salon():
    html = '''<div class="placa">
  <i class="estrella"></i>
  <small>MES AWARDS · OCTUBRE</small>
  <b>RAPERO<br>DEL MES</b>
  <div class="lineas"><span></span><span></span><span></span></div>
</div>'''
    css = '''
.placa{position:relative;display:grid;justify-items:center;gap:14px;width:420px;padding:54px 30px 40px;background:#0B0B0F;
  border:4px solid #F5C542;border-radius:14px;box-shadow:inset 0 0 0 10px #0B0B0F,inset 0 0 0 12px rgba(245,197,66,.5),0 26px 60px rgba(0,0,0,.65);transform:rotate(-3deg)}
.estrella{width:90px;height:90px;background:#F5C542;clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
  filter:drop-shadow(0 0 18px rgba(245,197,66,.55))}
.placa small{font:700 20px/1 'Barlow Condensed',sans-serif;letter-spacing:.18em;color:#F5C542}
.placa b{font:900 58px/.92 Archivo,sans-serif;letter-spacing:-.03em;text-align:center;color:#EDEDF2}
.lineas{display:flex;gap:8px}
.lineas span{width:70px;height:6px;background:rgba(237,237,242,.25)}
.lineas span:nth-child(2){background:#E41373}
'''
    return html, css


# ── las once: etiqueta, título en dos líneas (blanca y magenta), bajada e ilustración ──────────────────────────────
PAGINAS = {
    'ranking': ('Temporada 1 · Ranking', 'El ranking', 'de la temporada', 'Los mejores del freestyle online, de todos los servidores, en una sola tabla.', _ranking),
    'crews': ('Liga Global · Crews', 'Las crews', 'de la Liga', 'Armá la tuya, invitá a tu gente y subí de tier cada semana.', _crews),
    'eventos': ('Liga Global · Eventos', 'Los eventos', 'de hoy', 'Qué se juega hoy en cada servidor, con la llave en vivo y la campana.', _eventos),
    'tarjetas': ('Liga Global · Tarjetas', 'Tu tarjeta', 'estilo FIFA', 'Temporada, Competitiva, Servidor y País: tus números, en una carta.', _tarjetas),
    'pase': ('Liga Global · Pase rapero', 'El Pase', 'de rapero', 'Tareas diarias y semanales, XP y niveles: subí y desbloqueá.', _pase),
    'ligas': ('Liga Global · Ligas', 'Las ligas', 'de cada servidor', 'Fechas, tablas y campeones de las ligas de los servidores socios.', _ligas),
    'tienda': ('Liga Global · Tienda', 'La Tienda', 'de la Liga', 'Cazá cabezas, apostá en vivo y gastá tus Puntos de Tienda.', _tienda),
    'publicaciones': ('Liga Global · Publicaciones', 'Lo que pasa', 'en la Liga', 'Campeones, rachas y crews que suben: el muro de todos los servidores.', _publicaciones),
    'socios': ('Liga Global · Socios', 'Los servidores', 'socios', 'Los servidores de rap online que suman al ranking mundial.', _socios),
    'guia': ('Liga Global · Guía', 'Cómo funciona', 'la Liga', 'Puntos, rangos, tarjetas y TAGs, explicados en una página.', _guia),
    'salon': ('Liga Global · Salón de la fama', 'El Salón', 'de la fama', 'Los MES AWARDS, las promos y los que hicieron historia.', _salon),
}


def html(pagina):
    etq, t1, t2, desc, ilus = PAGINAS[pagina]
    cuerpo, css = ilus()
    with io.open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8') as f:
        fuentes = f.read()
    logo = _b64(os.path.join(BASE, 'bot', 'paginas', 'ul.png'))
    filas = ''.join('<i>UNDER LEGENDS UNDER LEGENDS UNDER LEGENDS</i>' for _ in range(9))
    # 🎨 la piel: la misma de herramientas/banner_link.py (si se cambia una, se cambia la otra)
    piel = '''
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#030304;overflow:hidden;position:relative;font-family:Archivo,sans-serif;color:#EDEDF2}
.luz{position:absolute;inset:-80px;filter:blur(60px);
  background:radial-gradient(520px 420px at 16% 20%,rgba(41,178,152,.30),transparent 70%),
             radial-gradient(560px 440px at 88% 8%,rgba(228,19,115,.30),transparent 68%),
             radial-gradient(700px 360px at 60% 105%,rgba(41,178,152,.14),transparent 70%)}
.trama{position:absolute;inset:-30px -120px;display:flex;flex-direction:column;justify-content:space-between;
  font:900 74px/1.02 Archivo,sans-serif;letter-spacing:-.025em;white-space:nowrap}
.trama i{display:block;font-style:normal}
.trama i:nth-child(4n+1){color:#E41373;opacity:.11}
.trama i:nth-child(4n+2){color:transparent;-webkit-text-stroke:1.5px #29B298;opacity:.22}
.trama i:nth-child(4n+3){color:#29B298;opacity:.08}
.trama i:nth-child(4n+4){color:transparent;-webkit-text-stroke:1.5px #E41373;opacity:.18}
.velo{position:absolute;inset:0;background:radial-gradient(120% 90% at 30% 50%,rgba(3,3,4,.55),rgba(3,3,4,.92) 70%,#030304)}
.caja{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;gap:36px;padding:0 64px 0 68px}
.txt{display:flex;flex-direction:column;gap:18px;width:620px;flex:none}
.etq{font:700 26px/1 'Barlow Condensed',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#29B298}
h1{font:900 84px/.94 Archivo,sans-serif;white-space:nowrap;letter-spacing:-.03em;text-transform:uppercase}
h1 span{display:block;color:#E41373}
p{font:500 26px/1.3 Archivo,sans-serif;color:#9CAAA7;max-width:600px}
.url{display:flex;align-items:center;gap:14px;font:800 30px/1 Archivo,sans-serif;color:#29B298;letter-spacing:-.01em}
.url img{width:46px;height:46px;border-radius:8px}
.ilus{position:relative;flex:none;width:470px;height:470px;display:flex;align-items:center;justify-content:center}
.raya{position:absolute;left:0;right:0;bottom:0;height:8px;background:linear-gradient(90deg,#29B298,#29B298 50%,#E41373 50%,#E41373)}
'''
    return ('<!doctype html><html><head><meta charset="utf-8"><style>' + fuentes + piel + css + '</style></head><body>'
            '<div class="luz"></div><div class="trama">' + filas + '</div><div class="velo"></div>'
            '<div class="caja"><div class="txt">'
            '<div class="etq">' + _esc(etq) + '</div>'
            '<h1>' + _esc(t1) + '<span>' + _esc(t2) + '</span></h1>'
            '<p>' + _esc(desc) + '</p>'
            '<div class="url"><img src="data:image/png;base64,' + logo + '" alt="">underlegends.pages.dev</div>'
            '</div><div class="ilus">' + cuerpo + '</div></div>'
            '<div class="raya"></div>'
            '<script>/* el título se achica hasta entrar en su columna: `scrollWidth`, porque la caja mide 620 aunque el '
            'texto (nowrap) se salga («DE LA TEMPORADA» pisaba la ilustración) */'
            'var h=document.querySelector("h1"),f=parseInt(getComputedStyle(h).fontSize,10);'
            'while(h.scrollWidth>620&&f>44){f-=2;h.style.fontSize=f+"px";}</script>'
            '</body></html>')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    pedidas = [a for a in sys.argv[1:] if not a.startswith('--')]
    malas = [p for p in pedidas if p not in PAGINAS]
    if malas:
        print('   ⚠️ no existe: %s · las que hay: %s' % (', '.join(malas), ', '.join(PAGINAS)))
        sys.exit(1)
    os.makedirs(SALIDA, exist_ok=True)
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1200, 'height': 630})
        for pagina in (pedidas or list(PAGINAS)):
            h = html(pagina)
            if '--html' in sys.argv:
                with io.open(os.path.join(SALIDA, pagina + '.html'), 'w', encoding='utf-8', newline='\n') as f:
                    f.write(h)
            pg.set_content(h)
            pg.wait_for_timeout(300)
            ruta = os.path.join(SALIDA, pagina + '.png')
            pg.screenshot(path=ruta)
            print('   ✅ %s (%d KB)' % (os.path.relpath(ruta, BASE), os.path.getsize(ruta) // 1024))
        b.close()


if __name__ == '__main__':
    main()

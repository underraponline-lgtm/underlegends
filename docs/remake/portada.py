# -*- coding: utf-8 -*-
"""La portada nueva de Under Legends: la ESTRUCTURA de las páginas de la escena, en estilo Calle.

    python docs/remake/portada.py <carpeta_salida>

Escribe `portada_clara.html`, `portada_noche.html` y sus `_pc` (computadora). Las
capturas las saca `maquetas_capturas.py`, igual que las otras maquetas.

Dlx, 29/09/2026: *«las de la escena de freestyle tienen una estructura muy
diferente»*. Lo que cambia respecto de las maquetas anteriores no es el color:
la portada es de la marca y se arma como las de Red Bull Batalla, la FMS o
Urban Roosters. Arriba, lo que está pasando ahora; después, una tira de fechas,
noticias, los raperos que mandan, tu temporada, el ranking, los buscados y los
servidores. Y un menú flotante para saltar entre secciones.

⚠️ NO ES CÓDIGO DE LA WEB: es sólo para mirar. Los nombres son inventados; los
logos de los servidores y las banderas salen de `bot/paginas/`.
"""
import base64
import io
import os
import sys

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
PAG = os.path.join(RAIZ, 'bot', 'paginas')
RANGO = {'SSS': '#C77DFF', 'SS': '#8FE8FF', 'S': '#FFD24A', 'A': '#FF6B7A',
         'B': '#5CE6A5', 'C': '#6B8FE8', 'D': '#D8DEE8', 'E': '#C98A4B'}      # comun/rangos.py


def dato(ruta, tipo):
    with open(os.path.join(PAG, ruta), 'rb') as f:
        return 'data:%s;base64,%s' % (tipo, base64.b64encode(f.read()).decode())


def logo_ul():
    from PIL import Image
    im = Image.open(os.path.join(PAG, 'ul.png')).convert('RGBA').resize((128, 128), Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


UL = logo_ul()
SV = {k: dato('logos/%s.webp' % k, 'image/webp') for k in
      ('ffa', 'frz', 'dra', 'tfc', 'sr', 'twr', 'efa', 'ffs', 'ftn', 'urbf')}
BANDERA = {k: dato('banderas/g/%s.webp' % k, 'image/webp') for k in ('pe', 'ar', 'cl', 'co', 'mx', 've')}

# ── el contenido (inventado) ────────────────────────────────────────────────
RAPEROS = [  # nombre, cc, país, rango, ovr, puntos, eventos, podios
    ('Kairos', 'pe', 'Perú', 'A', 87, '12.450', 14, 5),
    ('Mística', 'ar', 'Argentina', 'S', 89, '11.980', 13, 6),
    ('Nébula', 'cl', 'Chile', 'B', 84, '10.300', 12, 3),
    ('Tinta Fina', 'co', 'Colombia', 'B', 83, '9.870', 11, 2),
    ('El Profe', 'mx', 'México', 'C', 81, '9.400', 12, 2),
]
FECHAS = [  # día, mes, hora, servidor, evento, detalle, en vivo
    ('29', 'SEP', 'AHORA', 'ffa', 'TOKYO VOL 16', 'Cuartos · 24 raperos', True),
    ('29', 'SEP', '21:00', 'frz', 'FRZ FECHA 7', '1 vs 1 · 24 inscriptos', False),
    ('30', 'SEP', '20:00', 'dra', 'DRA NOCTURNA', '2 vs 2 · 16 inscriptos', False),
    ('01', 'OCT', '22:00', 'tfc', 'TFC SEMANAL 9', '1 vs 1 · 32 cupos', False),
    ('02', 'OCT', '21:30', 'sr', 'SR CLÁSICA', '1 vs 1 · abierta', False),
]
NOTAS = [  # categoría, título, cuándo, imagen
    ('RANGO', 'Mística sube a rango S y queda a 470 puntos de la cima', 'Hace 5 h', 'rg-S'),
    ('SE BUSCA', 'Nébula vale 800 puntos: quien la elimine, cobra', 'Hace 6 h', 'sv-ffa'),
    ('EVENTO', 'FRZ anunció su FECHA 7 para esta noche', 'Hace 8 h', 'sv-frz'),
]
BUSCADOS = [('Nébula', 'NÉ', '800'), ('Caos MC', 'CM', '650'), ('Rima Suelta', 'RS', '500')]


def mono(n):
    p = n.replace(' MC', '').split()
    return (p[0][0] + p[1][0]).upper() if len(p) > 1 else n[:2].upper()


def carta(nombre, rg, ovr, pais, pts, ev, pod, zoom=1.0):
    """La carta de ejemplo: la MISMA pieza en todos lados (las cartas no cambian)."""
    c = RANGO[rg]
    return ('<div class="carta" style="zoom:%.2f;--rg:%s">'
            '<div class="c-ovr">%d</div><div class="c-rk">%s</div><div class="c-temp">TEMPORADA<br>1</div>'
            '<div class="c-cara">%s</div><div class="c-nom">%s</div><div class="c-pais">%s</div>'
            '<div class="c-st"><div><b>%s</b><i>PTS</i></div><div><b>%d</b><i>EV</i></div><div><b>%d</b><i>POD</i></div></div>'
            '<div class="c-pie">UNDER LEGENDS</div></div>' % (zoom, c, ovr, rg, mono(nombre), nombre, pais.upper(), pts, ev, pod))


def ico(n, t=20):
    d = {
        'inicio': '<path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z"/>',
        'eventos': '<rect x="3.5" y="5" width="17" height="15" rx="1"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
        'ranking': '<path d="M5 20V10M12 20V4M19 20v-7"/>',
        'raperos': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.5-5.5 6.5-5.5s5.5 1.9 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
        'mas': '<path d="M4 7h16M4 12h16M4 17h16"/>',
        'campana': '<path d="M6 16V11a6 6 0 1112 0v5l2 2H4z"/><path d="M10 20a2 2 0 004 0"/>',
        'buscar': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
        'flecha': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    }[n]
    return ('<svg class="ico" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (t, t, d))


def rango(rg):
    return '<span class="rg" style="background:%s">%s</span>' % (RANGO[rg], rg)


def seccion(id_, titulo, enlace, cuerpo, extra=''):
    return ('<section class="sec %s" id="%s"><div class="sec-t"><h2>%s</h2><a>%s %s</a></div>%s</section>'
            % (extra, id_, titulo, enlace, ico('flecha', 16), cuerpo))


# ── las piezas ───────────────────────────────────────────────────────────────
def hero(pc):
    k, m = RAPEROS[0], RAPEROS[2]
    z = 1.0 if pc else 0.62
    lista = ''
    if pc:
        lista = ('<aside class="hero-lista"><div class="hl-t">CRUCES DE CUARTOS</div>'
                 '<ol><li class="on"><span>Kairos</span><em>vs</em><span>Nébula</span><b>AHORA</b></li>'
                 '<li><span>Tinta Fina</span><em>vs</em><span>El Profe</span><b>SIGUE</b></li>'
                 '<li class="hecho"><span>Mística</span><em>vs</em><span>Lupa</span><b>2-0</b></li>'
                 '<li class="hecho"><span>Caos MC</span><em>vs</em><span>Brasa</span><b>2-1</b></li></ol>'
                 '<div class="hl-pie">Actualizado hace 1 min · la llave se completa sola</div></aside>')
    return ('<section class="hero" id="envivo"><div class="hero-in"><div class="hero-main">'
            '<div class="hero-t"><span class="tag">EN VIVO AHORA</span><span class="hero-meta">FFA · CUARTOS · RONDA 3 DE 4</span></div>'
            '<h1 class="hero-ev">TOKYO VOL 16</h1>'
            '<div class="versus">%s<b class="vs">VS</b>%s</div>'
            '<div class="hero-acc"><a class="btn verde">Ver la llave en vivo</a><a class="btn borde">%sQuiero aviso</a></div>'
            '%s</div>%s</div></section>'
            % (carta(k[0], k[3], k[4], k[2], k[5], k[6], k[7], z), carta(m[0], m[3], m[4], m[2], m[5], m[6], m[7], z),
               ico('campana', 18), '' if pc else '<div class="sig">SIGUE · Tinta Fina vs El Profe</div>', lista))


def ir_a():
    secciones = [('envivo', 'En vivo'), ('fechas', 'Fechas'), ('noticias', 'Noticias'), ('raperos', 'Raperos'),
                 ('ranking', 'Ranking'), ('sebusca', 'Se busca'), ('servidores', 'Servidores')]
    return ('<nav class="ir-a" aria-label="Ir a"><span class="ir-t">IR A</span>%s</nav>'
            % ''.join('<a href="#%s">%s</a>' % s for s in secciones))


def fechas():
    return seccion('fechas', 'Próximas fechas', 'Calendario', '<div class="rail">%s</div>' % ''.join(
        '<article class="fecha%s"><div class="f-dia"><b>%s</b><span>%s</span></div><img alt="" src="%s">'
        '<b class="f-ev">%s</b><span class="f-hora">%s</span><small>%s</small></article>'
        % (' vivo' if v else '', d, m, SV[s], ev, ('● EN VIVO' if v else h + ' · tu hora'), det)
        for d, m, h, s, ev, det, v in FECHAS))


def noticias():
    k = RAPEROS[0]
    dest = ('<article class="destacada"><div class="d-img">%s<span class="sticker">CAMPEÓN</span></div>'
            '<div class="d-txt"><span class="cat">RESULTADO</span><h3>Kairos se queda con TOKYO VOL 15 y ya es el 1 de la temporada</h3>'
            '<small>Hace 2 h · FFA</small></div></article>' % carta(k[0], k[3], k[4], k[2], k[5], k[6], k[7], 0.55))
    items = []
    for cat, tit, cuando, img in NOTAS:
        if img.startswith('rg-'):
            vis = '<span class="n-vis rgv" style="background:%s">%s</span>' % (RANGO[img[3:]], img[3:])
        else:
            vis = '<img class="n-vis" alt="" src="%s">' % SV[img[3:]]
        items.append('<li>%s<div><span class="cat">%s</span><b>%s</b><small>%s</small></div></li>' % (vis, cat, tit, cuando))
    return seccion('noticias', 'Lo último', 'Todas', '<div class="notas-g">%s<ul class="notas">%s</ul></div>' % (dest, ''.join(items)))


def raperos(pc):
    z = 0.8 if pc else 0.6
    return seccion('raperos', 'Los que mandan', 'Todos los raperos', '<div class="rail mcs">%s</div>' % ''.join(
        '<article class="mc"><div class="mc-carta">%s</div><div class="mc-pie"><span class="mc-pais"><img alt="" src="%s">%s</span>'
        '<b>%s</b><small>#%d · %s PTS</small></div></article>'
        % (carta(n, rg, ovr, pa, pts, ev, pod, z), BANDERA[cc], pa, n, i + 1, pts)
        for i, (n, cc, pa, rg, ovr, pts, ev, pod) in enumerate(RAPEROS)), 'oscura')


def tu_temporada():
    return ('<section class="tu" id="tu"><div class="tu-t">TU TEMPORADA</div>'
            '<div class="tu-fila"><div class="tu-pos"><b>#47</b><small>3.120 pts · ▲5 esta semana</small></div>'
            '<span class="rg sinletra">?</span></div>'
            '<div class="tu-prog"><div class="barra10">%s</div><small>Todavía sin letra: 7 de 10 eventos. Te faltan 3 para tu rango.</small></div>'
            '<a class="btn negro">Ver mi perfil</a></section>' % ''.join('<i class="%s"></i>' % ('si' if i < 7 else '') for i in range(10)))


def ranking_top():
    filas = ''.join(
        '<li class="p%d"><span class="r-pos">%d</span><img class="r-flag" alt="" src="%s"><span class="r-nom">%s</span>%s<span class="r-pts">%s</span></li>'
        % (i + 1, i + 1, BANDERA[cc], n, rango(rg), pts) for i, (n, cc, pa, rg, ovr, pts, ev, pod) in enumerate(RAPEROS))
    return seccion('ranking', 'Ranking', 'Temporada 1 completa', '<ol class="top5">%s</ol>' % filas)


def buscados():
    return seccion('sebusca', 'Se busca', 'Most Wanted', '<div class="posters">%s</div>' % ''.join(
        '<article class="poster"><span class="p-t">SE BUSCA</span><span class="p-mono">%s</span><b>%s</b>'
        '<span class="p-precio">%s PTS</span><small>hasta el domingo</small></article>' % (m, n, p) for n, m, p in BUSCADOS))


def servidores():
    nombres = {'ffa': 'FFA', 'frz': 'FRZ', 'dra': 'DRA', 'tfc': 'TFC', 'sr': 'SR', 'twr': 'TWR', 'efa': 'EFA',
               'ffs': 'FFS', 'ftn': 'FTN', 'urbf': 'URBF'}
    return seccion('servidores', 'Los servidores de la liga', 'Mundo', '<div class="svs">%s</div>' % ''.join(
        '<figure><img alt="" src="%s"><figcaption>%s</figcaption></figure>' % (SV[k], v) for k, v in nombres.items()))


def pie():
    return ('<footer class="pie"><div class="pie-marca"><img alt="" src="%s"><span>UNDER LEGENDS<small>LIGA GLOBAL · TEMPORADA 1</small></span></div>'
            '<nav><a>Guía</a><a>Publicaciones</a><a>Tienda</a><a>Mundo</a><a>Privacidad</a></nav>'
            '<small>Los datos se actualizan solos cada media hora.</small></footer>' % UL)


def cabecera(pc):
    if pc:
        return ('<header class="cab"><div class="marca"><img alt="" src="%s"><span>UNDER LEGENDS<small>LIGA GLOBAL · T1</small></span></div>'
                '<nav class="menu"><a class="on">Inicio</a><a>Eventos</a><a>Ranking</a><a>Raperos</a><a>Liga Global</a><a>Tienda</a></nav>'
                '<div class="cab-der"><span class="buscar">%s Buscar rapero</span><span class="btn-ico">%s</span>'
                '<a class="btn negro chico">Entrar</a></div></header>' % (UL, ico('buscar', 18), ico('campana', 20)))
    return ('<header class="cab"><div class="marca"><img alt="" src="%s"><span>UNDER LEGENDS<small>LIGA GLOBAL · T1</small></span></div>'
            '<div class="cab-der"><span class="btn-ico">%s</span></div></header>' % (UL, ico('campana', 20)))


def tabbar():
    return '<nav class="tabbar">%s</nav>' % ''.join(
        '<a class="%s">%s<span>%s</span></a>' % ('on' if i == 0 else '', ico(k, 22), n)
        for i, (n, k) in enumerate([('Inicio', 'inicio'), ('Eventos', 'eventos'), ('Ranking', 'ranking'),
                                    ('Raperos', 'raperos'), ('Más', 'mas')]))


CSS = r"""
*{box-sizing:border-box}html,body{margin:0;background:#888}a{color:inherit;text-decoration:none}h1,h2,h3,p{margin:0}
.ico{flex:none}
.app{--verde:#29B298;--magenta:#E41373;background:var(--fondo);color:var(--tinta);font:400 15px/1.45 Archivo,sans-serif;position:relative}
.clara{--fondo:#FFFFFF;--tinta:#030304;--linea:#030304;--suave:#E2E2DE;--gris:#6E6E6A;--caja:#F3F3F0;--inv:#030304;--inv-tinta:#F6F6F6;
  --escenario:#030304;--esc-tinta:#F6F6F6;--esc-gris:#A5A5A0;--esc-linea:#2A2A2C;--oscura:#030304;--osc-tinta:#F6F6F6}
.noche{--fondo:#030304;--tinta:#F6F6F6;--linea:#F6F6F6;--suave:#232326;--gris:#A5A5A0;--caja:#101012;--inv:#F6F6F6;--inv-tinta:#030304;
  --escenario:#121214;--esc-tinta:#F6F6F6;--esc-gris:#A5A5A0;--esc-linea:#2A2A2C;--oscura:#E41373;--osc-tinta:#FFFFFF;color-scheme:dark}
.movil{width:360px}.pc{width:1280px}
.barra-ul{height:6px;background:linear-gradient(90deg,var(--verde) 50%,var(--magenta) 50%)}
.cab{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-bottom:2px solid var(--linea)}
.marca{display:flex;align-items:center;gap:10px;font:900 17px/.95 Archivo,sans-serif;font-stretch:125%;text-transform:uppercase}
.marca img{width:40px;height:40px;border-radius:50%}
.marca small{display:block;font:700 11px/1.2 "Space Mono",monospace;letter-spacing:.12em;margin-top:4px;color:var(--gris)}
.cab-der{display:flex;align-items:center;gap:10px}
.btn-ico{width:44px;height:44px;display:grid;place-items:center;border:2px solid var(--linea)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 18px;font:800 14px/1 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase;letter-spacing:.02em;border:2px solid transparent;white-space:nowrap}
.btn.verde{background:var(--verde);color:#030304}
.btn.borde{border-color:var(--esc-tinta);color:var(--esc-tinta)}
.btn.negro{background:var(--inv);color:var(--inv-tinta)}
.btn.chico{min-height:44px;padding:0 16px}
/* el escenario: lo que pasa ahora */
.hero{background:var(--escenario);color:var(--esc-tinta);padding:18px 16px 22px;position:relative;overflow:hidden}
.hero:before{content:"";position:absolute;right:-60px;top:-40px;width:260px;height:260px;border-radius:50%;background:var(--magenta);opacity:.16}
.hero:after{content:"";position:absolute;left:-80px;bottom:-90px;width:240px;height:240px;border-radius:50%;background:var(--verde);opacity:.14}
.hero-in{position:relative;z-index:1}
.hero-t{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
.tag{display:inline-flex;align-items:center;gap:8px;font:700 12px/1 "Space Mono",monospace;letter-spacing:.12em;background:var(--magenta);color:#fff;padding:7px 9px}
.tag:before{content:"";width:9px;height:9px;background:var(--verde)}
.hero-meta{font:700 11px/1.2 "Space Mono",monospace;letter-spacing:.1em;color:var(--esc-gris)}
.hero-ev{font:900 40px/.92 Archivo,sans-serif;font-stretch:125%;text-transform:uppercase;margin:14px 0 16px}
.versus{display:flex;align-items:center;justify-content:space-between;gap:6px}
.vs{font:900 40px/1 Archivo,sans-serif;font-stretch:125%;color:var(--magenta)}
.sig{margin:14px 0 0;font:700 11px/1.3 "Space Mono",monospace;letter-spacing:.08em;color:var(--esc-gris)}
.hero-acc{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.ir-a{display:flex;gap:6px;overflow:hidden;padding:10px 16px;border-bottom:2px solid var(--linea);background:var(--fondo);white-space:nowrap}
.ir-a a{font:700 12px/1 "Space Mono",monospace;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid var(--linea);padding:9px 10px;flex:none}
.ir-t{font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--gris);align-self:center;margin-right:4px}
/* secciones */
.sec{padding:22px 16px 6px}
.sec-t{display:flex;align-items:baseline;justify-content:space-between;gap:12px;border-top:2px solid var(--linea);padding-top:12px;margin-bottom:14px}
.sec-t h2{font:900 22px/1 Archivo,sans-serif;font-stretch:125%;text-transform:uppercase}
.sec-t a{display:inline-flex;align-items:center;gap:6px;font:700 11px/1 "Space Mono",monospace;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.rail{display:grid;grid-auto-flow:column;grid-auto-columns:150px;gap:10px;overflow:hidden}
.fecha{border:2px solid var(--linea);padding:12px;display:grid;gap:6px;align-content:start;background:var(--fondo)}
.fecha.vivo{background:var(--magenta);border-color:var(--magenta);color:#fff}
.f-dia{display:flex;align-items:baseline;gap:6px}
.f-dia b{font:900 34px/1 Archivo,sans-serif;font-stretch:125%}
.f-dia span{font:700 12px/1 "Space Mono",monospace;letter-spacing:.1em}
.fecha img{width:40px;height:40px;border-radius:50%;border:2px solid var(--linea)}
.fecha.vivo img{border-color:#fff}
.f-ev{font:900 15px/1.05 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase}
.f-hora{font:700 11px/1.2 "Space Mono",monospace;letter-spacing:.06em}
.fecha small{font-size:13px;opacity:.8}
.notas-g{display:grid;gap:14px}
.destacada{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;border:2px solid var(--linea);padding:12px;background:var(--caja)}
.d-img{position:relative}
.sticker{position:absolute;right:-12px;bottom:10px;font:900 12px/1 Archivo,sans-serif;font-stretch:120%;background:var(--verde);color:#030304;padding:6px 7px;transform:rotate(-8deg);border:2px solid #030304}
.cat{display:inline-block;font:700 11px/1 "Space Mono",monospace;letter-spacing:.1em;color:var(--magenta);margin-bottom:6px}
.destacada h3{font:900 16px/1.1 Archivo,sans-serif;font-stretch:108%;text-transform:uppercase}
.d-txt small,.notas small{display:block;margin-top:6px;font:700 11px/1.3 "Space Mono",monospace;letter-spacing:.06em;color:var(--gris)}
.notas{list-style:none;margin:0;padding:0}
.notas li{display:flex;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--suave)}
.notas li:first-child{border-top:0}
.n-vis{width:52px;height:52px;flex:none;border:2px solid var(--linea);object-fit:cover}
.rgv{display:grid;place-items:center;font:900 22px/1 Archivo,sans-serif;font-stretch:120%;color:#030304}
.notas b{display:block;font:800 15px/1.2 Archivo,sans-serif}
.oscura{background:var(--oscura);color:var(--osc-tinta);margin-top:18px;padding-bottom:22px}
.oscura .sec-t{border-top-color:var(--osc-tinta)}
.mcs{grid-auto-columns:128px}
.mc{display:grid;gap:8px}
.mc-carta{display:grid;place-items:start}
.mc-pie b{display:block;font:900 15px/1.1 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase}
.mc-pais{display:flex;align-items:center;gap:6px;font:700 11px/1 "Space Mono",monospace;letter-spacing:.06em;margin-bottom:4px}
.mc-pais img{width:21px;height:14px}
.mc-pie small{font:700 11px/1.3 "Space Mono",monospace;opacity:.8}
.tu{margin:22px 16px 6px;border:2px solid var(--linea);padding:14px;display:grid;gap:12px;background:var(--caja)}
.tu-t{font:700 11px/1 "Space Mono",monospace;letter-spacing:.14em;color:var(--magenta)}
.tu-fila{display:flex;align-items:center;justify-content:space-between;gap:12px}
.tu-pos b{display:block;font:900 44px/.9 Archivo,sans-serif;font-stretch:125%}
.tu-pos small{font:700 11px/1.3 "Space Mono",monospace;color:var(--gris)}
.rg{display:inline-grid;place-items:center;width:34px;height:28px;font:700 12px/1 "Space Mono",monospace;color:#030304;border:1.5px solid #030304}
.rg.sinletra{width:52px;height:46px;font-size:22px;background:repeating-linear-gradient(135deg,transparent 0 5px,rgba(128,128,128,.25) 5px 7px);color:var(--gris);border:2px dashed var(--gris)}
.barra10{display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-bottom:6px}
.barra10 i{height:16px;border:2px solid var(--linea)}
.barra10 i.si{background:var(--verde)}
.tu-prog small{font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
.top5{list-style:none;margin:0;padding:0;border-top:2px solid var(--linea)}
.top5 li{display:grid;grid-template-columns:40px 26px 1fr 34px 70px;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--suave)}
.r-pos{font:900 20px/1 Archivo,sans-serif;font-stretch:125%;text-align:center;padding:6px 0}
.p1 .r-pos{background:var(--verde);color:#030304}.p2 .r-pos{background:var(--magenta);color:#fff}.p3 .r-pos{background:var(--inv);color:var(--inv-tinta)}
.r-flag{width:24px;height:16px}
.r-nom{font:800 15px/1.2 Archivo,sans-serif}
.r-pts{text-align:right;font:800 15px/1 Archivo,sans-serif;font-variant-numeric:tabular-nums}
.posters{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.poster{background:#030304;color:#F6F6F6;padding:10px 8px 12px;display:grid;justify-items:center;gap:6px;text-align:center;border:2px solid #030304}
.noche .poster{border-color:#F6F6F6}
.p-t{font:900 12px/1 Archivo,sans-serif;font-stretch:125%;color:var(--magenta);letter-spacing:.02em}
.p-mono{width:52px;height:52px;display:grid;place-items:center;border:2px solid #F6F6F6;font:900 18px/1 Archivo,sans-serif;font-stretch:120%}
.poster b{font:900 13px/1.05 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.p-precio{font:900 15px/1 Archivo,sans-serif;font-stretch:120%;background:var(--magenta);color:#fff;padding:5px 6px;transform:rotate(-4deg)}
.poster small{font:700 10.5px/1.2 "Space Mono",monospace;opacity:.75}
.svs{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.svs figure{margin:0;display:grid;justify-items:center;gap:5px}
.svs img{width:52px;height:52px;border-radius:50%;border:2px solid var(--linea)}
.svs figcaption{font:700 11px/1 "Space Mono",monospace;letter-spacing:.06em}
.pie{margin-top:26px;padding:20px 16px 18px;border-top:2px solid var(--linea);display:grid;gap:14px}
.pie-marca{display:flex;align-items:center;gap:10px;font:900 16px/1 Archivo,sans-serif;font-stretch:125%}
.pie-marca img{width:36px;height:36px;border-radius:50%}
.pie-marca small{display:block;font:700 11px/1.3 "Space Mono",monospace;letter-spacing:.1em;color:var(--gris);margin-top:4px}
.pie nav{display:flex;flex-wrap:wrap;gap:8px 16px;font:700 12px/1 "Space Mono",monospace;letter-spacing:.06em;text-transform:uppercase}
.pie>small{font-size:13px;color:var(--gris)}
.tabbar{display:grid;grid-template-columns:repeat(5,1fr);border-top:2px solid var(--linea);background:var(--fondo)}
.tabbar a{display:grid;justify-items:center;gap:4px;padding:10px 0 12px;font:700 11px/1 "Space Mono",monospace;letter-spacing:.04em;text-transform:uppercase}
.tabbar a.on{background:var(--inv);color:var(--inv-tinta);box-shadow:inset 0 -4px 0 var(--verde)}
/* la carta de ejemplo (la misma en todo) */
.carta{width:200px;height:292px;position:relative;border-radius:10px;overflow:hidden;text-align:center;color:#fff;font-family:"Barlow Condensed",sans-serif;flex:none;
  background:linear-gradient(160deg,#27172a 0%,#120c18 55%,#07070b 100%);box-shadow:inset 0 0 0 3px var(--rg),inset 0 0 0 5px #120c18,inset 0 0 0 6px var(--rg)}
.c-ovr{position:absolute;left:16px;top:12px;font:800 46px/1 "Barlow Condensed",sans-serif}
.c-rk{position:absolute;left:18px;top:62px;font:800 16px/1 Archivo,sans-serif;background:var(--rg);color:#1C1917;padding:3px 7px;border-radius:3px}
.c-temp{position:absolute;right:14px;top:16px;font:700 11px/1.1 "Barlow Condensed",sans-serif;letter-spacing:.12em;text-align:right;opacity:.8}
.c-cara{position:absolute;left:50%;top:44px;transform:translateX(-50%);width:104px;height:104px;border-radius:50%;background:#2d1d2a;box-shadow:0 0 0 3px var(--rg);display:grid;place-items:center;font:800 40px/1 Archivo,sans-serif;color:var(--rg)}
.c-nom{position:absolute;left:0;right:0;top:162px;font:900 24px/1 Archivo,sans-serif;text-transform:uppercase}
.c-pais{position:absolute;left:0;right:0;top:194px;font:700 12px/1 "Barlow Condensed",sans-serif;letter-spacing:.2em;opacity:.8}
.c-st{position:absolute;left:14px;right:14px;top:218px;display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(255,255,255,.3);padding-top:8px}
.c-st b{display:block;font:800 21px/1 "Barlow Condensed",sans-serif}
.c-st i{font:700 10px/1.4 "Barlow Condensed",sans-serif;font-style:normal;letter-spacing:.14em;opacity:.75}
.c-pie{position:absolute;left:0;right:0;bottom:10px;font:700 10px/1 "Barlow Condensed",sans-serif;letter-spacing:.3em;opacity:.55}
"""

CSS_PC = r"""
.pc .cab{padding:14px 40px}
.pc .menu{display:flex;gap:26px;white-space:nowrap;font:800 14px/1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.pc .menu a{padding:8px 0}
.pc .menu a.on{box-shadow:inset 0 -4px 0 var(--verde)}
.pc .buscar{display:flex;align-items:center;gap:8px;border:2px solid var(--linea);min-height:44px;padding:0 12px;min-width:220px;color:var(--gris);font-weight:600}
.pc .hero{padding:34px 40px 40px}
.pc .hero:before{width:520px;height:520px;right:-120px;top:-160px}
.pc .hero:after{width:420px;height:420px;left:-160px;bottom:-220px}
.pc .hero-in{display:grid;grid-template-columns:1fr 360px;gap:40px;align-items:start}
.pc .hero-ev{font-size:72px;margin:18px 0 22px}
.pc .versus{justify-content:flex-start;gap:26px}
.pc .vs{font-size:64px}
.hero-lista{border:2px solid var(--esc-linea);padding:16px;background:rgba(255,255,255,.03);margin-top:52px}
.hl-t{font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--esc-gris);margin-bottom:10px}
.hero-lista ol{list-style:none;margin:0;padding:0}
.hero-lista li{display:grid;grid-template-columns:1fr auto 1fr 56px;gap:8px;align-items:center;padding:11px 0;border-top:1px solid var(--esc-linea);font:800 15px/1.2 Archivo,sans-serif}
.hero-lista li:first-child{border-top:0}
.hero-lista em{font:700 11px/1 "Space Mono",monospace;font-style:normal;color:var(--verde)}
.hero-lista b{font:700 11px/1 "Space Mono",monospace;text-align:right;letter-spacing:.06em}
.hero-lista li.on b{color:var(--magenta)}
.hero-lista li.hecho{color:var(--esc-gris)}
.hl-pie{margin-top:10px;font:700 11px/1.4 "Space Mono",monospace;color:var(--esc-gris)}
.pc .ir-a{position:relative;z-index:5;width:max-content;margin:-28px auto 0;border:2px solid var(--linea);padding:8px 10px;gap:4px;box-shadow:0 0 0 4px var(--fondo)}
.pc .ir-a a{border:0;padding:9px 12px}
.pc .ir-a a:first-of-type{background:var(--inv);color:var(--inv-tinta)}
.pc .sec{padding:30px 40px 6px}
.pc .sec-t h2{font-size:30px}
.pc .rail{grid-auto-flow:row;grid-template-columns:repeat(5,1fr);overflow:visible}
.pc .notas-g{grid-template-columns:1.25fr 1fr;align-items:start;gap:24px}
.pc .destacada{padding:18px;gap:22px}
.pc .destacada h3{font-size:28px}
.pc .mcs{grid-template-columns:repeat(5,1fr)}
.pc .oscura{padding-bottom:34px}
.pc .fila2{display:grid;grid-template-columns:1.2fr 1fr;gap:28px;padding:0 40px}
.pc .fila2 .sec{padding-left:0;padding-right:0}
.pc .fila2 .tu{margin:30px 0 0}
.pc .svs{grid-template-columns:repeat(10,1fr)}
.pc .pie{padding:24px 40px 28px;grid-template-columns:auto 1fr auto;align-items:center}
.pc .pie nav{justify-content:center}
"""


def pagina(tema, pc):
    if pc:
        cuerpo = (cabecera(True) + hero(True) + ir_a() + fechas() + noticias() + raperos(True)
                  + '<div class="fila2"><div>%s</div><div>%s%s</div></div>' % (ranking_top(), tu_temporada(), buscados())
                  + servidores() + pie())
    else:
        cuerpo = (cabecera(False) + hero(False) + ir_a() + fechas() + noticias() + tu_temporada() + raperos(False)
                  + ranking_top() + buscados() + servidores() + pie() + tabbar())
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=%d,initial-scale=1">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900'
            '&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@700;800&display=block">'
            '<style>%s%s</style></head><body><div class="app %s %s"><div class="barra-ul"></div>%s</div></body></html>'
            % (1280 if pc else 360, CSS, CSS_PC if pc else '', tema, 'pc' if pc else 'movil', cuerpo))


def main():
    salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida')
    os.makedirs(salida, exist_ok=True)
    for tema in ('clara', 'noche'):
        for pc in (False, True):
            nombre = 'portada_%s%s.html' % (tema, '_pc' if pc else '')
            io.open(os.path.join(salida, nombre), 'w', encoding='utf-8', newline='\n').write(pagina(tema, pc))
    print('ok · 4 páginas en', salida)


if __name__ == '__main__':
    main()

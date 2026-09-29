# -*- coding: utf-8 -*-
"""El sitio como lo vio Dlx: qué boceto es cada página.

    python docs/remake/sitio.py <carpeta_salida>

Dlx, 29/09/2026: *«que INICIO sea la escena completa pero que tenga los
servidores arriba como en feed, y los seguidores y seguidos… el feed como está
que sea publicaciones… tu liga podría ser tu perfil, exceptuando de la escena»*.

| página        | sale de                                              |
|---------------|------------------------------------------------------|
| Inicio        | Boceto 1 (`portada.py`) + la fila de historias arriba, y abajo la Tienda y la Mercancía |
| Eventos       | Boceto 2, el tablero, mezclado con la web de hoy: la llave en cuadro, el mes y la campana |
| Publicaciones | Boceto 3, el feed, como está                          |
| Yo            | Boceto 4, tu liga, sin «De la escena», con «Tus cartas» para elegir la del perfil |

El menú de abajo pasa a ser Inicio · Eventos · Ranking · Publicaciones · Yo;
Raperos, Liga Global, Tienda, Mundo y Guía van en el menú de arriba: detrás
del ☰ en el celular, y en una segunda fila en la computadora.

Arriba dice «Discord Rap En Español / Liga Global · T1» (Dlx, 29/09 ~2:45 PM):
es el nombre de DRA, y DRA es la Liga Global. Under Legends queda en el logo y
en el pie, como Red Bull en la página de Red Bull Batalla.

⚠️ NO ES CÓDIGO DE LA WEB: es sólo para mirar. Los raperos son inventados, y
las prendas de la Mercancía son de muestra: no hay ninguna decidida.
"""
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bocetos as B  # noqa: E402
import portada as P  # noqa: E402

TABS = [('Inicio', 'inicio'), ('Eventos', 'eventos'), ('Ranking', 'ranking'), ('Publicaciones', 'publicaciones'), ('Yo', 'yo')]
MENU = ['Inicio', 'Eventos', 'Ranking', 'Publicaciones', 'Raperos', 'Liga Global', 'Tienda', 'Mundo', 'Guía']
ARRIBA = ['Raperos', 'Liga Global', 'Tienda', 'Mundo', 'Guía']  # en el celular, detrás del ☰


def ico(n, t=22):
    extra = {
        'publicaciones': '<path d="M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 010 6"/>',
        'yo': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
        'menu': '<path d="M4 7h16M4 12h16M4 17h16"/>',
    }
    if n not in extra:
        return P.ico(n, t)
    return ('<svg class="ico" width="%d" height="%d" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">%s</svg>' % (t, t, extra[n]))


def tabbar(activa):
    return '<nav class="tabbar">%s</nav>' % ''.join(
        '<a class="%s">%s<span>%s</span></a>' % ('on' if k == activa else '', ico(k), n) for n, k in TABS)


def menu(activa):
    return '<nav class="menu">%s</nav>' % ''.join('<a class="%s">%s</a>' % ('on' if n == activa else '', n) for n in MENU)


def historias(pc):
    """Arriba del Inicio, como en el feed: los servidores y la gente que seguís o que te sigue."""
    svs = [('vivo', 'EN VIVO', 'ffa'), ('', 'FRZ', 'frz'), ('', 'DRA', 'dra'), ('', 'TFC', 'tfc'), ('', 'SR', 'sr')]
    if pc:
        svs += [('', 'TWR', 'twr'), ('', 'EFA', 'efa'), ('', 'FTN', 'ftn')]
    gente = [('nuevo', 'Kairos', 'seguís'), ('nuevo', 'Mística', 'seguís'), ('', 'Nébula', 'te sigue'),
             ('', 'Tinta Fina', 'te sigue')]
    if pc:
        gente += [('', 'El Profe', 'seguís'), ('', 'Caos MC', 'te sigue')]
    h = ''.join('<a class="h %s"><span class="h-c"><img alt="" src="%s"></span><small>%s</small></a>' % (c, P.SV[k], t)
                for c, t, k in svs)
    h += '<span class="h-sep" aria-hidden="true"></span>'
    h += ''.join('<a class="h gente %s"><span class="h-c">%s</span><small>%s</small><em>%s</em></a>' % (c, P.mono(n), n, rel)
                 for c, n, rel in gente)
    return '<nav class="historias" aria-label="Servidores y gente">%s</nav>' % h


CSS_SITIO = r"""
.h-sep{width:2px;align-self:stretch;background:var(--suave);flex:none;margin:4px 2px}
.h.gente .h-c{box-shadow:0 0 0 3px var(--suave);background:var(--inv);color:var(--inv-tinta)}
.h.gente.nuevo .h-c{box-shadow:0 0 0 3px var(--verde)}
.h em{font:700 10.5px/1 "Space Mono",monospace;font-style:normal;color:var(--gris);margin-top:-2px}
.pc .historias{padding:14px 40px;gap:18px}
.movil .historias{gap:10px}
.movil .historias .h-c{width:50px;height:50px;font-size:14px}
.movil .historias small{font-size:10.5px}
.pc .menu{gap:18px;font-size:13px}
.pc .buscar{min-width:160px}
.pc .marca{font-size:15px}
"""


def inicio(pc):
    if pc:
        cuerpo = (P.cabecera(True) + historias(True) + P.hero(True) + P.ir_a() + P.fechas() + P.noticias() + P.raperos(True)
                  + '<div class="fila2"><div>%s</div><div>%s%s</div></div>' % (P.ranking_top(), P.tu_temporada(), P.buscados())
                  + '<div class="fila3"><div>%s</div><div>%s</div></div>' % (tienda(), mercancia())
                  + P.servidores() + P.pie())
    else:
        cuerpo = (P.cabecera(False) + historias(False) + P.hero(False) + P.ir_a() + P.fechas() + P.noticias()
                  + P.tu_temporada() + P.raperos(False) + P.ranking_top() + P.buscados() + tienda() + mercancia()
                  + P.servidores() + P.pie()
                  + tabbar('inicio'))
    return re.sub(r'<nav class="ir-a".*?</nav>', ir_a(), cuerpo, flags=re.S)


# ── Eventos: el tablero + lo que ya tiene la página de hoy ─────────────────
def llave():
    """La llave de TOKYO VOL 16 como cuadro: la vista que hoy abre «Ver llave»."""
    def m(a, b, estado='', cls='', ga=False, gb=False, xa=False, xb=False):
        return ('<div class="m %s"><span class="%s">%s</span><span class="%s">%s</span>%s</div>'
                % (cls, 'g' if ga else ('x' if xa else ''), a, 'g' if gb else ('x' if xb else ''), b,
                   '<b>%s</b>' % estado if estado else ''))
    return ('<div class="llave-cab"><span>CUADRO</span><span class="apag">POR RONDAS</span><span class="apag">PANTALLA COMPLETA</span></div>'
            '<div class="llave-wrap"><div class="llave">'
            '<div class="ronda"><h4>Cuartos</h4>%s%s%s%s</div>'
            '<div class="ronda"><h4>Semis</h4>%s%s</div>'
            '<div class="ronda"><h4>Final</h4>%s</div>'
            '</div></div><small class="desliza">Deslizá para ver hasta la final → · tocá un nombre y se ilumina su camino</small>'
            % (m('Kairos', 'Nébula', 'AHORA', 'on'), m('Tinta Fina', 'El Profe', 'SIGUE'),
               m('Mística', 'Lupa', '2-0', 'hecho', ga=True, xb=True), m('Caos MC', 'Brasa', '2-1', 'hecho', ga=True, xb=True),
               m('Kairos o Nébula', 'Tinta Fina o El Profe', '', 'vacia'), m('Mística', 'Caos MC', '21:10'),
               m('—', '—', '', 'vacia')))


def mes():
    """El calendario del mes, como hoy: un punto por evento, del color de su servidor."""
    puntos = {1: ['#26045B'], 3: ['#26B3A6', '#5964E0'], 6: ['#26045B'], 8: ['#600816'], 10: ['#26B3A6'],
              13: ['#26045B', '#E0670B'], 15: ['#5964E0'], 17: ['#26045B'], 20: ['#600816', '#26B3A6'], 22: ['#26045B'],
              24: ['#5964E0'], 27: ['#26045B', '#E0670B'], 29: ['#26045B', '#26B3A6', '#5964E0'], 30: ['#5964E0']}
    celdas = ''.join('<span></span>' for _ in range(1))  # septiembre 2026 arranca martes
    for d in range(1, 31):
        pts = ''.join('<i style="background:%s"></i>' % c for c in puntos.get(d, []))
        celdas += '<span class="%s">%d<em>%s</em></span>' % ('hoy' if d == 29 else '', d, pts)
    return ('<section class="sec mes"><div class="sec-t"><h2>Septiembre</h2><a>Mes %s</a></div>'
            '<div class="mes-g"><b>L</b><b>M</b><b>M</b><b>J</b><b>V</b><b>S</b><b>D</b>%s</div></section>'
            % (P.ico('flecha', 16), celdas))


def campeones():
    ult = [('TOKYO VOL 15', 'Kairos', 'ffa'), ('DRA NOCTURNA 8', 'Mística', 'dra'), ('FRZ FECHA 6', 'Nébula', 'frz'),
           ('TFC SEMANAL 8', 'El Profe', 'tfc')]
    return ('<section class="sec"><div class="sec-t"><h2>Últimos campeones</h2><a>Todas las llaves %s</a></div>'
            '<div class="rail camp">%s</div></section>' % (P.ico('flecha', 16), ''.join(
                '<article class="cp"><img alt="" src="%s"><small>%s</small><span class="cp-m">%s</span><b>%s</b><a>Ver llave</a></article>'
                % (P.SV[sv], ev, P.mono(n), n) for ev, n, sv in ult)))


def avisos():
    chips = ''.join('<span class="%s">%s%s</span>' % ('on' if on else '', ('✓ ' if on else ''), t)
                    for t, on in [('FFA', True), ('FRZ', True), ('DRA', False), ('TFC', False), ('SR', False), ('Todos', False)])
    return ('<section class="sec avisos"><div class="sec-t"><h2>La campana</h2><a>Cómo funciona %s</a></div>'
            '<p class="av-p">Te avisa al minuto de que un servidor anuncia un evento.</p><div class="av-chips">%s</div>'
            '<a class="btn negro">%s Activar la campana</a>'
            '<div class="av-cal"><a>+ Google Calendar</a><a>+ Apple · Outlook</a><a>Copiar el link</a></div></section>'
            % (P.ico('flecha', 16), chips, P.ico('campana', 18)))


def eventos(pc):
    dias = '<nav class="dias"><a>Ayer</a><a class="on">Hoy · 29</a><a>Mañana</a><a>Jue 1</a><a>Vie 2</a><a>Mes</a></nav>'
    vivo = ('<section class="grupo"><h3 class="g-t vivo">● En vivo</h3><article class="t-ev es-vivo"><header><img alt="" src="%s">'
            '<div><b>TOKYO VOL 16</b><small>FFA · 24 raperos · empezó 19:30 · ×2 esta semana</small></div><span class="t-est">CUARTOS</span>'
            '</header><div class="t-llave">%s</div></article></section>' % (P.SV['ffa'], llave()))
    tarde = ('<section class="grupo"><h3 class="g-t">Más tarde</h3>'
             '<article class="t-ev"><header><img alt="" src="%s"><div><b>FRZ FECHA 7</b><small>1 vs 1 · 24 inscriptos · en 2 h 14 min</small></div>'
             '<span class="t-est">21:00</span></header><div class="t-acc"><a class="btn verde chico">%s Quiero aviso</a><a>+ Calendario</a><a>Discord ↗</a></div></article>'
             '<article class="t-ev"><header><img alt="" src="%s"><div><b>DRA NOCTURNA</b><small>2 vs 2 · 16 inscriptos</small></div>'
             '<span class="t-est">MAÑ 20:00</span></header></article></section>' % (P.SV['frz'], P.ico('campana', 16), P.SV['dra']))
    hechos = ('<section class="grupo"><h3 class="g-t">Terminados</h3><article class="t-ev"><header><img alt="" src="%s">'
              '<div><b>TOKYO VOL 15</b><small>FFA · ayer · 28 raperos</small></div><span class="t-est">FINAL</span></header>'
              '<ol class="podio2"><li><b>1</b>Kairos<em>+3.000</em></li><li><b>2</b>Mística<em>+2.000</em></li><li><b>3</b>Nébula<em>+1.250</em></li></ol>'
              '<div class="t-acc"><a class="btn borde2 chico">Ver llave</a></div></article></section>' % P.SV['ffa'])
    if pc:
        return (P.cabecera(True) + '<div class="t3"><aside class="t-izq">%s%s<div class="t-svs"><b>Servidores</b>%s</div></aside>'
                '<main class="t-centro">%s%s%s</main><aside class="t-der">%s%s</aside></div>'
                % (dias, mes(), ''.join('<a><img alt="" src="%s">%s</a>' % (P.SV[k], k.upper()) for k in ('ffa', 'frz', 'dra', 'tfc', 'sr')),
                   vivo, tarde, hechos, avisos(), campeones()))
    return P.cabecera(False) + dias + vivo + tarde + hechos + campeones() + mes() + avisos() + tabbar('eventos')


# ── Yo: elegir qué carta mostrar ───────────────────────────────────────────
def selector_cartas():
    cartas = [('Temporada', '', 'on'), ('Competitiva', '🔒 7/10 eventos', 'bloq'), ('Servidor', '', ''), ('País', '🔒 2/3 duelos', 'bloq')]
    return ('<section class="sec elegir"><div class="sec-t"><h2>Tus cartas</h2><a>Compartir %s</a></div><div class="mis-cartas">%s</div>'
            '<small class="el-nota">Tocá una para verla. La que dejes marcada es la que ven los demás en tu perfil.</small></section>'
            % (P.ico('flecha', 16), ''.join(
                '<a class="mc2 %s"><span class="mc2-img">%s</span><b>%s</b><small>%s</small></a>'
                % (cls, '✓' if cls == 'on' else ('🔒' if cls == 'bloq' else ''), n, extra or ('Tu carta principal' if cls == 'on' else 'Ver'))
                for n, extra, cls in cartas)))


def yo(pc):
    cuerpo = B.tuliga(pc, con_escena=False)
    i = cuerpo.index('</section>', cuerpo.index('class="yo-hero"')) + len('</section>')
    return cuerpo[:i] + selector_cartas() + cuerpo[i:]


CSS_EVENTOS = r"""
.llave-cab{display:flex;gap:8px;padding:10px 12px 0;font:700 11px/1 "Space Mono",monospace;letter-spacing:.06em}
.llave-cab span{border:1.5px solid var(--linea);padding:7px 8px;background:var(--inv);color:var(--inv-tinta)}
.llave-cab span.apag{background:transparent;color:var(--tinta)}
.llave-wrap{overflow:hidden;padding:12px}
.llave{display:grid;grid-template-columns:repeat(3,150px);gap:16px}
.ronda{display:flex;flex-direction:column;justify-content:space-around;gap:10px}
.ronda h4{margin:0;font:700 11px/1 "Space Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--gris)}
.m{border:2px solid var(--linea);display:grid;position:relative;background:var(--fondo)}
.m span{padding:7px 8px;font:800 13px/1.15 Archivo,sans-serif;border-bottom:1px solid var(--suave)}
.m span:last-of-type{border-bottom:0}
.m span.g{background:rgba(41,178,152,.22)}
.m span.x{color:var(--gris);text-decoration:line-through}
.m b{position:absolute;right:-2px;top:-11px;font:700 10.5px/1 "Space Mono",monospace;background:var(--inv);color:var(--inv-tinta);padding:3px 5px}
.m.on{border-color:var(--magenta)}
.m.on b{background:var(--magenta);color:#fff}
.m.vacia span{color:var(--gris);font-weight:600;font-size:12px}
.desliza{display:block;padding:0 12px 12px;font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
.t-acc{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:0 12px 12px;font:700 11px/1 "Space Mono",monospace;letter-spacing:.04em;text-transform:uppercase}
.t-acc a:not(.btn){text-decoration:underline;text-underline-offset:4px}
.podio2{list-style:none;margin:0;padding:4px 12px 10px;display:grid;gap:4px}
.podio2 li{display:grid;grid-template-columns:26px 1fr auto;gap:8px;align-items:center;font:800 14px/1.2 Archivo,sans-serif}
.podio2 b{display:grid;place-items:center;height:24px;background:var(--inv);color:var(--inv-tinta);font:700 11px/1 "Space Mono",monospace}
.podio2 li:first-child b{background:var(--verde);color:#030304}
.podio2 em{font:700 11px/1 "Space Mono",monospace;font-style:normal;color:var(--gris)}
.camp{grid-auto-columns:140px}
.cp{border:2px solid var(--linea);padding:10px;display:grid;gap:6px;justify-items:start}
.cp img{width:32px;height:32px;border-radius:50%;border:2px solid var(--linea)}
.cp small{font:700 10.5px/1.2 "Space Mono",monospace;color:var(--gris)}
.cp-m{width:40px;height:40px;display:grid;place-items:center;background:var(--verde);color:#030304;font:900 14px/1 Archivo,sans-serif;font-stretch:120%}
.cp b{font:900 14px/1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.cp a{font:700 11px/1 "Space Mono",monospace;text-decoration:underline;text-underline-offset:4px}
.mes-g{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}
.mes-g b{font:700 11px/1 "Space Mono",monospace;color:var(--gris);padding-bottom:4px}
.mes-g span{display:grid;justify-items:center;gap:3px;padding:6px 0;font:800 13px/1 Archivo,sans-serif;border:1px solid var(--suave);min-height:40px}
.mes-g span:empty{border:0}
.mes-g span.hoy{background:var(--inv);color:var(--inv-tinta)}
.mes-g em{display:flex;gap:2px;font-style:normal}
.mes-g i{width:6px;height:6px;border-radius:50%}
.av-p{margin:0 0 10px;color:var(--gris);font-size:14px}
.av-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.av-chips span{font:700 11px/1 "Space Mono",monospace;border:1.5px solid var(--linea);padding:8px 9px}
.av-chips span.on{background:var(--verde);border-color:var(--verde);color:#030304}
.av-cal{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;font:700 11px/1 "Space Mono",monospace;letter-spacing:.04em;text-transform:uppercase}
.av-cal a{text-decoration:underline;text-underline-offset:4px}
.t-izq .mes{padding:10px 16px}
.t-izq .mes .sec-t h2{font-size:16px}
.t-izq .mes-g span{min-height:32px;font-size:12px}
.pc .t-llave .llave{grid-template-columns:repeat(3,1fr)}
.mis-cartas{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.mc2{display:grid;gap:5px;justify-items:center;text-align:center}
.mc2-img{width:100%;aspect-ratio:5/7;display:grid;place-items:center;font-size:18px;border:2px solid var(--linea);
  background:linear-gradient(160deg,#27172a,#07070b);color:#fff}
.mc2.on .mc2-img{outline:3px solid var(--verde);outline-offset:3px;font:900 22px/1 Archivo,sans-serif;color:var(--verde)}
.mc2.bloq .mc2-img{background:repeating-linear-gradient(135deg,transparent 0 6px,rgba(128,128,128,.25) 6px 8px);border-style:dashed;color:var(--gris)}
.mc2 b{font:800 12px/1.1 Archivo,sans-serif}
.mc2 small{font:700 10.5px/1.2 "Space Mono",monospace;color:var(--gris)}
.el-nota{display:block;margin-top:10px;font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
"""


# ── Inicio: la marca arriba, la Tienda y la Mercancía (Dlx, 29/09 ~2:45 PM) ──
MARCA_VIEJA = '<span>UNDER LEGENDS<small>LIGA GLOBAL · T1</small></span>'
MARCA_NUEVA = ('<span class="lockup"><b>DISCORD RAP</b> <b>EN ESPAÑOL</b>'
               '<small class="lg">LIGA GLOBAL · T1</small></span>')


def ir_a():
    secciones = [('envivo', 'En vivo'), ('fechas', 'Fechas'), ('noticias', 'Noticias'), ('raperos', 'Raperos'),
                 ('ranking', 'Ranking'), ('sebusca', 'Se busca'), ('tienda', 'Tienda'), ('merch', 'Mercancía'),
                 ('servidores', 'Servidores')]
    return ('<nav class="ir-a" aria-label="Ir a"><span class="ir-t">IR A</span>%s</nav>'
            % ''.join('<a href="#%s">%s</a>' % x for x in secciones))


def tienda():
    return ('<section class="sec" id="tienda"><div class="sec-t"><h2>Tienda</h2><a>Ir a la tienda %s</a></div>'
            '<div class="tienda-g"><div class="billetera"><span class="b-t">TUS PUNTOS DE TIENDA</span><b>5.000 PT</b>'
            '<small>Todos arrancan con 5.000. No son los puntos del ranking.</small></div>'
            '<div class="usos"><article><b>Ponele precio a una cabeza</b><small>Quien la caza en Se busca cobra lo que pusiste.</small>'
            '<a class="btn negro chico">Poner precio</a></article>'
            '<article class="pronto"><b>Canjes</b><small>Próximamente: lo que se compra con los puntos.</small></article></div>'
            '</div></section>' % P.ico('flecha', 16))


def _prenda(tipo):
    """Siluetas simples de las prendas, con el dragón de UL."""
    forma = {
        'remera': '<path d="M30 12 L44 6 Q50 14 56 6 L70 12 L88 28 L77 40 L70 34 L70 92 L30 92 L30 34 L23 40 L12 28 Z"/>',
        'buzo': '<path d="M36 10 Q50 -2 64 10 L72 14 L88 32 L78 44 L72 38 L72 92 L28 92 L28 38 L22 44 L12 32 L28 14 Z"/>'
                '<path d="M40 60 L60 60 L60 76 L40 76 Z" fill="#1a1a1c"/>',
        'gorra': '<path d="M18 62 Q20 26 52 24 Q82 26 84 60 Z"/><path d="M18 62 L96 62 Q96 70 84 70 L18 70 Z"/>',
        'stickers': '<circle cx="36" cy="40" r="22"/><rect x="50" y="46" width="36" height="36" transform="rotate(12 68 64)"/>',
    }[tipo]
    logo = {'remera': (40, 30, 20), 'buzo': (40, 26, 20), 'gorra': (41, 32, 20), 'stickers': (24, 28, 24)}[tipo]
    x, y, t = logo
    return ('<svg viewBox="0 0 100 100" class="prenda" aria-hidden="true"><defs><clipPath id="dr-%s">'
            '<circle cx="%g" cy="%g" r="%g"/></clipPath></defs><g fill="#030304">%s</g>'
            '<image href="%s" x="%d" y="%d" width="%d" height="%d" clip-path="url(#dr-%s)"/></svg>'
            % (tipo, x + t / 2, y + t / 2, t / 2, forma, P.UL, x, y, t, t, tipo))


def mercancia():
    prods = [('remera', 'Remera UL', 'El dragón en el pecho'), ('buzo', 'Buzo UL', 'Negro, con capucha'),
             ('gorra', 'Gorra UL', 'Visera plana'), ('stickers', 'Stickers', 'Pack de la liga')]
    return ('<section class="sec merch" id="merch"><div class="sec-t"><h2>Mercancía</h2><a>Próximamente</a></div>'
            '<div class="rail prods">%s</div><a class="btn verde">%s Avisame cuando salga</a></section>'
            % (''.join('<article class="prod"><div class="p-img">%s</div><b>%s</b><small>%s</small></article>'
                       % (_prenda(t), n, d) for t, n, d in prods), P.ico('campana', 18)))


CSS_TIENDA = r"""
.marca b{display:block;font:inherit}
.marca small.lg{color:var(--magenta);margin-top:5px}
.hamb{background:none;color:inherit;padding:0;cursor:pointer}
.tienda-g{display:grid;gap:12px}
.billetera{background:#030304;color:#F6F6F6;border:2px solid var(--linea);padding:16px;display:grid;gap:6px}
.b-t{font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--verde)}
.billetera b{font:900 40px/.95 Archivo,sans-serif;font-stretch:125%;white-space:nowrap}
.billetera small{font:700 11px/1.4 "Space Mono",monospace;opacity:.75}
.usos{display:grid;gap:10px}
.usos article{border:2px solid var(--linea);padding:12px;display:grid;gap:6px;justify-items:start}
.usos b{font:900 16px/1.1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.usos small{font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
.usos .pronto{border-style:dashed}
.prods{grid-auto-columns:150px;margin-bottom:14px}
.prod{display:grid;gap:4px}
.p-img{aspect-ratio:1;background:#ECECE8;border:2px solid var(--linea);display:grid;place-items:center}
.prenda{width:78%;height:78%}
.prod b{font:900 14px/1.1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.prod small{font:700 11px/1.3 "Space Mono",monospace;color:var(--gris)}
.pc .tienda-g{grid-template-columns:1fr}
.pc .usos{grid-template-columns:1fr 1fr}
.pc .prods{grid-auto-flow:row;grid-template-columns:repeat(4,1fr)}
.pc .fila3{display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:0 40px}
.pc .marca b{display:inline}
.pc .cab{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"marca der" "menu menu";padding:14px 40px 0}
.pc .cab .marca{grid-area:marca;font-size:19px}
.pc .cab .cab-der{grid-area:der;justify-self:end}
.pc .cab .menu{grid-area:menu;margin-top:14px;border-top:2px solid var(--suave);gap:30px;font-size:14px}
.pc .cab .menu a{padding:13px 0 12px}
.pc .cab .buscar{min-width:240px}
.pc .fila3 .sec{padding-left:0;padding-right:0}
"""


def rehacer_navegacion(cuerpo, activa_tab, activa_menu):
    cuerpo = cuerpo.replace(MARCA_VIEJA, MARCA_NUEVA)
    if '<nav class="menu">' not in cuerpo:  # el celular: lo del menú de arriba va detrás del ☰
        cuerpo = cuerpo.replace('</div></header>', '<button class="btn-ico hamb" type="button" aria-label="Menú">%s</button>'
                                '</div></header>' % ico('menu', 22), 1)
    cuerpo = re.sub(r'<nav class="tabbar">.*?</nav>', tabbar(activa_tab), cuerpo, flags=re.S)
    return re.sub(r'<nav class="menu">.*?</nav>', menu(activa_menu), cuerpo, flags=re.S)


def pagina(que, pc, tema='clara'):
    if que == 'inicio':
        cuerpo = rehacer_navegacion(inicio(pc), 'inicio', 'Inicio')
    elif que == 'eventos':
        cuerpo = rehacer_navegacion(eventos(pc), 'eventos', 'Eventos')
    elif que == 'publicaciones':
        cuerpo = rehacer_navegacion(B.feed(pc), 'publicaciones', 'Publicaciones')
    else:
        cuerpo = rehacer_navegacion(yo(pc), 'yo', '')
    css = P.CSS + (P.CSS_PC if (pc and que == 'inicio') else '') + B.CSS_B + CSS_SITIO + CSS_EVENTOS + CSS_TIENDA
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=%d,initial-scale=1">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900'
            '&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@700;800&display=block">'
            '<style>%s</style></head><body><div class="app %s %s"><div class="barra-ul"></div>%s</div></body></html>'
            % (1280 if pc else 360, css, tema, 'pc' if pc else 'movil', cuerpo))


def main():
    salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida')
    os.makedirs(salida, exist_ok=True)
    for que in ('inicio', 'eventos', 'publicaciones', 'yo'):
        for pc in (False, True):
            io.open(os.path.join(salida, 'sitio_%s%s.html' % (que, '_pc' if pc else '')), 'w', encoding='utf-8',
                    newline='\n').write(pagina(que, pc))
    print('ok · 8 páginas en', salida)


if __name__ == '__main__':
    main()

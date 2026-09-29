# -*- coding: utf-8 -*-
"""El sitio como lo vio Dlx: qué boceto es cada página.

    python docs/remake/sitio.py <carpeta_salida>

Dlx, 29/09/2026: *«que INICIO sea la escena completa pero que tenga los
servidores arriba como en feed, y los seguidores y seguidos… el feed como está
que sea publicaciones… tu liga podría ser tu perfil, exceptuando de la escena»*.

| página        | sale de                                              |
|---------------|------------------------------------------------------|
| Inicio        | Boceto 1 (`portada.py`) + la fila de historias arriba |
| Eventos       | Boceto 2, el tablero (propuesto, sin confirmar)      |
| Publicaciones | Boceto 3, el feed, como está                          |
| Yo            | Boceto 4, tu liga, sin «De la escena»                 |

El menú de abajo pasa a ser Inicio · Eventos · Ranking · Publicaciones · Yo;
Raperos, Liga Global, Tienda, Mundo y Guía van en el menú de arriba.

⚠️ NO ES CÓDIGO DE LA WEB: es sólo para mirar. Los raperos son inventados.
"""
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bocetos as B  # noqa: E402
import portada as P  # noqa: E402

TABS = [('Inicio', 'inicio'), ('Eventos', 'eventos'), ('Ranking', 'ranking'), ('Publicaciones', 'publicaciones'), ('Yo', 'yo')]
MENU = ['Inicio', 'Eventos', 'Ranking', 'Publicaciones', 'Raperos', 'Liga Global', 'Tienda']


def ico(n, t=22):
    extra = {
        'publicaciones': '<path d="M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 010 6"/>',
        'yo': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
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
                  + P.servidores() + P.pie())
    else:
        cuerpo = (P.cabecera(False) + historias(False) + P.hero(False) + P.ir_a() + P.fechas() + P.noticias()
                  + P.tu_temporada() + P.raperos(False) + P.ranking_top() + P.buscados() + P.servidores() + P.pie()
                  + tabbar('inicio'))
    return cuerpo


def rehacer_navegacion(cuerpo, activa_tab, activa_menu):
    cuerpo = re.sub(r'<nav class="tabbar">.*?</nav>', tabbar(activa_tab), cuerpo, flags=re.S)
    return re.sub(r'<nav class="menu">.*?</nav>', menu(activa_menu), cuerpo, flags=re.S)


def pagina(que, pc):
    if que == 'inicio':
        cuerpo = rehacer_navegacion(inicio(pc), 'inicio', 'Inicio')
    elif que == 'eventos':
        cuerpo = rehacer_navegacion(B.tablero(pc), 'eventos', 'Eventos')
    elif que == 'publicaciones':
        cuerpo = rehacer_navegacion(B.feed(pc), 'publicaciones', 'Publicaciones')
    else:
        cuerpo = rehacer_navegacion(B.tuliga(pc, con_escena=False), 'yo', '')
    css = P.CSS + (P.CSS_PC if (pc and que == 'inicio') else '') + B.CSS_B + CSS_SITIO
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=%d,initial-scale=1">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900'
            '&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@700;800&display=block">'
            '<style>%s</style></head><body><div class="app clara %s"><div class="barra-ul"></div>%s</div></body></html>'
            % (1280 if pc else 360, css, 'pc' if pc else 'movil', cuerpo))


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

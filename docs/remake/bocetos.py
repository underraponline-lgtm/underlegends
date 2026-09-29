# -*- coding: utf-8 -*-
"""Otras estructuras para la portada, para comparar y combinar con el Boceto 1 (`portada.py`).

    python docs/remake/bocetos.py <carpeta_salida>

Dlx, 29/09/2026: *«me gusta por donde vas… pero guarda este boceto y piensa en
otros a ver si vemos mejores ideas o cosas para combinar»*, y *«también
podríamos poner información de freestyle, rap, hip hop, noticias verdaderas»*.

- **Boceto 2 · El tablero**: la portada como marcador en vivo (Promiedos,
  FotMob): ayer / hoy / mañana, lo que se juega ahora arriba.
- **Boceto 3 · El feed**: todo como tarjetas de momentos que se deslizan, con
  las noticias reales de la escena mezcladas.
- **Boceto 4 · Tu liga**: primero vos: tu carta, tu próxima batalla, tus rivales
  y los que seguís.

Las tres usan el estilo Calle (el mismo CSS de `portada.py`), así lo que se
compara es la ESTRUCTURA. Las noticias de la escena son titulares reales de los
RSS de Mundo Freestyle y Urban Roosters News, leídos el 29/09/2026: en la web se
leerían solos en cada corrida del ciclo (título, fuente, fecha y link; nunca el
texto de la nota).

⚠️ NO ES CÓDIGO DE LA WEB: es sólo para mirar. Los raperos son inventados.
"""
import io
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import portada as P  # noqa: E402

ESCENA = [  # fuente, fecha, titular — de sus RSS, 29/09/2026
    ('Mundo Freestyle', '24 sep', 'FMS 2026/27: estos son los line-ups confirmados de España, México, Argentina, Colombia y Chile'),
    ('Urban Roosters News', '23 sep', 'Chuty estará en FMS México con un line-up histórico que debutará en Ecatepec'),
    ('Mundo Freestyle', '20 sep', 'Estos son los 6 clasificados a la Final Internacional de Red Bull Batalla 2027'),
    ('Mundo Freestyle', '20 sep', '¡Hammer campeón! Resultados del Torneo de Plazas de Red Bull Batalla 2026'),
]


def escena(n=3, titulo='De la escena'):
    items = ''.join('<li><span class="e-f">%s · %s</span><b>%s</b></li>' % (f, d, t) for f, d, t in ESCENA[:n])
    return ('<section class="sec escena"><div class="sec-t"><h2>%s</h2><a>Más %s</a></div><ul class="e-lista">%s</ul>'
            '<small class="e-nota">Titulares de Mundo Freestyle y Urban Roosters News. Se actualizan solos.</small></section>'
            % (titulo, P.ico('flecha', 16), items))


def cab(pc, avatar=False):
    der = ('<span class="av-chip">KA</span>' if avatar else '<span class="btn-ico">%s</span>' % P.ico('campana', 20))
    if pc:
        return ('<header class="cab"><div class="marca"><img alt="" src="%s"><span>UNDER LEGENDS<small>LIGA GLOBAL · T1</small></span></div>'
                '<nav class="menu"><a class="on">Inicio</a><a>Eventos</a><a>Ranking</a><a>Raperos</a><a>Liga Global</a><a>Tienda</a></nav>'
                '<div class="cab-der"><span class="buscar">%s Buscar rapero</span>%s</div></header>' % (P.UL, P.ico('buscar', 18), der))
    return ('<header class="cab"><div class="marca"><img alt="" src="%s"><span>UNDER LEGENDS<small>LIGA GLOBAL · T1</small></span></div>'
            '<div class="cab-der">%s</div></header>' % (P.UL, der))


def tabbar(activa=0):
    return '<nav class="tabbar">%s</nav>' % ''.join(
        '<a class="%s">%s<span>%s</span></a>' % ('on' if i == activa else '', P.ico(k, 22), n)
        for i, (n, k) in enumerate([('Inicio', 'inicio'), ('Eventos', 'eventos'), ('Ranking', 'ranking'),
                                    ('Raperos', 'raperos'), ('Más', 'mas')]))


def mini_tabla(n=5):
    return ('<section class="sec"><div class="sec-t"><h2>La tabla</h2><a>Completa %s</a></div><ol class="top5">%s</ol></section>'
            % (P.ico('flecha', 16), ''.join(
                '<li class="p%d"><span class="r-pos">%d</span><img class="r-flag" alt="" src="%s"><span class="r-nom">%s</span>%s'
                '<span class="r-pts">%s</span></li>' % (i + 1, i + 1, P.BANDERA[cc], nm, P.rango(rg), pts)
                for i, (nm, cc, pa, rg, ovr, pts, ev, pod) in enumerate(P.RAPEROS[:n]))))


# ── Boceto 2 · El tablero ────────────────────────────────────────────────────
def partido(a, b, estado, cls=''):
    return '<li class="%s"><span>%s</span><em>vs</em><span>%s</span><b>%s</b></li>' % (cls, a, b, estado)


def evento_tablero(sv, nombre, estado, detalle, cruces, abierto=False, cls=''):
    lista = '<ol class="t-cruces">%s</ol>' % ''.join(partido(*c) for c in cruces) if cruces else ''
    return ('<article class="t-ev %s"><header><img alt="" src="%s"><div><b>%s</b><small>%s</small></div><span class="t-est">%s</span></header>'
            '%s</article>' % (cls, P.SV[sv], nombre, detalle, estado, lista if abierto else ''))


def tablero(pc):
    dias = '<nav class="dias"><a>Ayer</a><a class="on">Hoy · 29</a><a>Mañana</a><a>Jue 1</a><a>Vie 2</a></nav>'
    vivo = ('<section class="grupo"><h3 class="g-t vivo">● En vivo</h3>%s</section>'
            % evento_tablero('ffa', 'TOKYO VOL 16', 'CUARTOS', 'FFA · 24 raperos · empezó 19:30', [
                ('Kairos', 'Nébula', 'AHORA', 'on'), ('Tinta Fina', 'El Profe', 'SIGUE', ''),
                ('Mística', 'Lupa', '2-0', 'hecho'), ('Caos MC', 'Brasa', '2-1', 'hecho')], True, 'es-vivo'))
    tarde = ('<section class="grupo"><h3 class="g-t">Más tarde</h3>%s%s</section>'
             % (evento_tablero('frz', 'FRZ FECHA 7', '21:00', '1 vs 1 · 24 inscriptos · en 2 h 14 min', []),
                evento_tablero('dra', 'DRA NOCTURNA', 'MAÑ 20:00', '2 vs 2 · 16 inscriptos', [])))
    hechos = ('<section class="grupo"><h3 class="g-t">Terminados</h3>%s</section>'
              % evento_tablero('ffa', 'TOKYO VOL 15', 'FINAL', 'Campeón: Kairos · finalista: Mística', []))
    tus = ('<section class="sec tus"><div class="sec-t"><h2>Tus raperos</h2><a>Editar %s</a></div><ul class="tus-l">'
           '<li><span class="mono-c">KA</span><b>Kairos</b><span class="t-vivo">JUEGA AHORA</span></li>'
           '<li><span class="mono-c">NÉ</span><b>Nébula</b><span class="t-vivo">JUEGA AHORA</span></li>'
           '<li><span class="mono-c">RS</span><b>Rima Suelta</b><span>HOY 21:00</span></li></ul></section>' % P.ico('flecha', 16))
    if pc:
        cuerpo = (cab(True) + '<div class="t3"><aside class="t-izq">%s<div class="t-svs"><b>Servidores</b>%s</div></aside>'
                  '<main class="t-centro">%s%s%s</main><aside class="t-der">%s%s%s</aside></div>'
                  % (dias, ''.join('<a><img alt="" src="%s">%s</a>' % (P.SV[k], k.upper()) for k in ('ffa', 'frz', 'dra', 'tfc', 'sr', 'twr')),
                     vivo, tarde, hechos, tus, mini_tabla(5), escena(3)))
    else:
        cuerpo = cab(False) + dias + vivo + tus + tarde + hechos + mini_tabla(3) + escena(3) + tabbar(0)
    return cuerpo


# ── Boceto 3 · El feed ───────────────────────────────────────────────────────
def historias():
    items = [('vivo', 'EN VIVO', P.SV['ffa']), ('', 'FRZ', P.SV['frz']), ('', 'DRA', P.SV['dra']),
             ('', 'Kairos', None), ('', 'Mística', None), ('', 'TFC', P.SV['tfc'])]
    return '<nav class="historias">%s</nav>' % ''.join(
        '<a class="h %s"><span class="h-c">%s</span><small>%s</small></a>'
        % (c, ('<img alt="" src="%s">' % img) if img else P.mono(t), t) for c, t, img in items)


def tarjeta(tipo, cuerpo, pie=''):
    return '<article class="f-card"><span class="f-tipo">%s</span>%s%s</article>' % (tipo, cuerpo, pie)


def feed(pc):
    k, m = P.RAPEROS[0], P.RAPEROS[2]
    z = 0.62 if not pc else 0.8
    reac = '<div class="reac"><span>🔥 128</span><span>👀 64</span><span>🎤 31</span><a>Compartir</a></div>'
    t_vivo = tarjeta('<b class="rojo">● EN VIVO</b> · FFA',
                     '<h3 class="f-h">TOKYO VOL 16 · CUARTOS</h3><div class="versus chico">%s<b class="vs">VS</b>%s</div>'
                     '<div class="f-acc"><a class="btn verde">Ver la llave</a><a class="btn borde2">Quiero aviso</a></div>'
                     % (P.carta(k[0], k[3], k[4], k[2], k[5], k[6], k[7], z * 0.9), P.carta(m[0], m[3], m[4], m[2], m[5], m[6], m[7], z * 0.9)), reac)
    t_res = tarjeta('RESULTADO · FFA · hace 2 h',
                    '<div class="f-fila">%s<div><h3 class="f-h">Kairos se queda con TOKYO VOL 15</h3>'
                    '<p class="f-p">Le ganó la final a Mística y quedó 1 de la temporada.</p>'
                    '<ol class="podio"><li><b>1</b> Kairos</li><li><b>2</b> Mística</li><li><b>3</b> Nébula</li></ol></div></div>'
                    % P.carta(k[0], k[3], k[4], k[2], k[5], k[6], k[7], 0.5), reac)
    t_esc = tarjeta('DE LA ESCENA · Mundo Freestyle · 24 sep',
                    '<h3 class="f-h">%s</h3><a class="f-link">Leer en mundofreestyle.com %s</a>' % (ESCENA[0][2], P.ico('flecha', 16)))
    t_rg = tarjeta('RANGO · hace 5 h',
                   '<div class="f-fila"><span class="rg-g" style="background:%s">S</span><div><h3 class="f-h">Mística sube a rango S</h3>'
                   '<p class="f-p">Score 63,1. Está a 470 puntos de la cima.</p></div></div>' % P.RANGO['S'], reac)
    t_enc = tarjeta('ENCUESTA · El Elegido · cierra el domingo',
                    '<h3 class="f-h">¿A quién ponemos en Se busca esta semana?</h3>'
                    '<ul class="opciones"><li><span>Kairos</span><i style="width:46%%"></i><b>46%%</b></li>'
                    '<li><span>Mística</span><i style="width:33%%"></i><b>33%%</b></li>'
                    '<li><span>Tinta Fina</span><i style="width:21%%"></i><b>21%%</b></li></ul>'
                    '<a class="btn negro chico">Votar</a>')
    t_esc2 = tarjeta('DE LA ESCENA · Urban Roosters News · 23 sep',
                     '<h3 class="f-h">%s</h3><a class="f-link">Leer en urbanroosters.news %s</a>' % (ESCENA[1][2], P.ico('flecha', 16)))
    t_busca = tarjeta('SE BUSCA · Most Wanted',
                      '<div class="f-fila"><div class="poster"><span class="p-t">SE BUSCA</span><span class="p-mono">NÉ</span>'
                      '<b>NÉBULA</b><span class="p-precio">800 PTS</span></div><div><h3 class="f-h">Quien elimine a Nébula cobra 800 puntos</h3>'
                      '<p class="f-p">Juega ahora en TOKYO VOL 16.</p></div></div>')
    tarjetas = t_vivo + t_res + t_esc + t_rg + t_enc + t_esc2 + t_busca
    if pc:
        return (cab(True) + '<div class="f3"><aside class="f-izq">%s</aside><main class="f-centro">%s%s</main>'
                '<aside class="f-der">%s%s</aside></div>'
                % (P.tu_temporada(), historias(), tarjetas, P.fechas().replace('class="rail"', 'class="rail vertical"'), mini_tabla(5)))
    return cab(False) + historias() + '<div class="f-lista">%s</div>' % tarjetas + tabbar(0)


# ── Boceto 4 · Tu liga ───────────────────────────────────────────────────────
def carta_sin_letra(nombre, ovr, pais, pts, ev, pod, zoom):
    """Quien tiene menos de 10 eventos no tiene rango: su carta va sin letra y con el marco neutro."""
    c = P.carta(nombre, 'E', ovr, pais, pts, ev, pod, zoom)
    return c.replace('<div class="c-rk">E</div>', '').replace('--rg:%s' % P.RANGO['E'], '--rg:#8A8A86')


def tuliga(pc, con_escena=True):
    yo = ('Rima Suelta', 'uy', 'Uruguay', 'C', 78, '3.120', 7, 1)
    heroe = ('<section class="yo-hero"><div class="yo-carta">%s<span class="sticker2">TU CARTA</span></div>'
             '<div class="yo-dat"><span class="yo-hola">HOLA, RIMA SUELTA</span><b class="yo-pos">#47</b>'
             '<small>3.120 pts · ▲5 esta semana</small><div class="yo-prog"><div class="barra10">%s</div>'
             '<small>Todavía sin letra: te faltan 3 eventos.</small></div>'
             '<div class="yo-acc"><a class="btn verde">Compartir mi carta</a><a class="btn borde2">Mi perfil</a></div></div></section>'
             % (carta_sin_letra(yo[0], yo[4], yo[2], yo[5], yo[6], yo[7], 0.75 if not pc else 1.0),
                ''.join('<i class="%s"></i>' % ('si' if i < 7 else '') for i in range(10))))
    prox = ('<section class="sec"><div class="sec-t"><h2>Tu próxima batalla</h2><a>Calendario %s</a></div>'
            '<article class="prox"><img alt="" src="%s"><div><b>FRZ FECHA 7</b><small>Hoy 21:00 · estás inscripto · 1 vs 1</small></div>'
            '<span class="prox-c">2 H 14 MIN</span></article></section>' % (P.ico('flecha', 16), P.SV['frz']))
    rivales = ('<section class="sec"><div class="sec-t"><h2>Tus rivales</h2><a>Cara a cara %s</a></div><ul class="rivales">'
               '<li><span class="mono-c">NÉ</span><b>Nébula</b><span class="rec">2 - 1</span><small>ganaste la última</small></li>'
               '<li><span class="mono-c">EP</span><b>El Profe</b><span class="rec">1 - 1</span><small>la próxima desempata</small></li>'
               '<li><span class="mono-c">CM</span><b>Caos MC</b><span class="rec perd">0 - 2</span><small>te tiene de hijo</small></li>'
               '</ul></section>' % P.ico('flecha', 16))
    siguen = ('<section class="sec"><div class="sec-t"><h2>Los que seguís</h2><a>Editar %s</a></div><ul class="tus-l">'
              '<li><span class="mono-c">KA</span><b>Kairos</b><span class="t-vivo">JUEGA AHORA</span></li>'
              '<li><span class="mono-c">MÍ</span><b>Mística</b><span>SUBIÓ A S</span></li>'
              '<li><span class="mono-c">TF</span><b>Tinta Fina</b><span>HOY 21:00</span></li></ul></section>' % P.ico('flecha', 16))
    semana = ('<section class="sec"><div class="sec-t"><h2>Tu semana</h2><a>Racha %s</a></div><div class="casillas3">'
              '<div class="v"><b>2</b><small>eventos</small></div><div><b>+1.250</b><small>puntos</small></div>'
              '<div><b>3</b><small>semanas de racha</small></div></div></section>' % P.ico('flecha', 16))
    vivo = ('<a class="aviso-vivo"><span class="tag">EN VIVO</span><b>TOKYO VOL 16 · Kairos vs Nébula</b>%s</a>' % P.ico('flecha', 18))
    if pc:
        return (cab(True, True) + vivo + '<div class="yo2"><div class="yo-izq">%s%s</div><div class="yo-der">%s%s%s%s</div></div>'
                % (heroe, semana, prox, rivales, siguen, escena(3) if con_escena else ''))
    return (cab(False, True) + vivo + heroe + prox + semana + rivales + siguen + (escena(2) if con_escena else '')
            + tabbar(0))


CSS_B = r"""
.pc .cab{padding:14px 40px}
.pc .menu{display:flex;gap:26px;white-space:nowrap;font:800 14px/1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.pc .menu a{padding:8px 0}
.pc .menu a.on{box-shadow:inset 0 -4px 0 var(--verde)}
.pc .buscar{display:flex;align-items:center;gap:8px;border:2px solid var(--linea);min-height:44px;padding:0 12px;min-width:220px;color:var(--gris);font-weight:600}
.escena .e-lista{list-style:none;margin:0;padding:0;border-top:2px solid var(--linea)}
.e-lista li{padding:10px 0;border-bottom:1px solid var(--suave);display:grid;gap:4px}
.e-f{font:700 11px/1 "Space Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--magenta)}
.e-lista b{font:800 15px/1.25 Archivo,sans-serif}
.e-nota{display:block;margin-top:8px;font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
.av-chip{width:44px;height:44px;display:grid;place-items:center;background:var(--verde);color:#030304;font:900 14px/1 Archivo,sans-serif;font-stretch:120%;border:2px solid var(--linea)}
/* tablero */
.dias{display:flex;gap:6px;overflow:hidden;padding:12px 16px;border-bottom:2px solid var(--linea);white-space:nowrap}
.dias a{font:700 12px/1 "Space Mono",monospace;letter-spacing:.06em;text-transform:uppercase;border:1.5px solid var(--linea);padding:9px 11px;flex:none}
.dias a.on{background:var(--inv);color:var(--inv-tinta)}
.grupo{padding:14px 16px 0}
.g-t{font:700 12px/1 "Space Mono",monospace;letter-spacing:.12em;text-transform:uppercase;margin:0 0 8px;color:var(--gris)}
.g-t.vivo{color:var(--magenta)}
.t-ev{border:2px solid var(--linea);margin-bottom:10px;background:var(--fondo)}
.t-ev header{display:grid;grid-template-columns:40px 1fr auto;gap:10px;align-items:center;padding:10px 12px}
.t-ev header img{width:40px;height:40px;border-radius:50%;border:2px solid var(--linea)}
.t-ev header b{display:block;font:900 16px/1.05 Archivo,sans-serif;font-stretch:115%;text-transform:uppercase}
.t-ev header small{font:700 11px/1.3 "Space Mono",monospace;color:var(--gris)}
.t-est{font:700 11px/1 "Space Mono",monospace;letter-spacing:.06em;border:1.5px solid var(--linea);padding:6px 7px;white-space:nowrap}
.es-vivo{border-color:var(--magenta)}
.es-vivo .t-est{background:var(--magenta);border-color:var(--magenta);color:#fff}
.t-cruces{list-style:none;margin:0;padding:0 12px 6px;border-top:1px solid var(--suave)}
.t-cruces li{display:grid;grid-template-columns:1fr auto 1fr 58px;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--suave);font:800 14px/1.2 Archivo,sans-serif}
.t-cruces li:last-child{border-bottom:0}
.t-cruces em{font:700 11px/1 "Space Mono",monospace;font-style:normal;color:var(--gris)}
.t-cruces b{font:700 11px/1 "Space Mono",monospace;text-align:right}
.t-cruces li.on b{color:var(--magenta)}
.t-cruces li.hecho{color:var(--gris)}
.tus-l{list-style:none;margin:0;padding:0}
.tus-l li{display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--suave)}
.tus-l b{font:800 15px/1.2 Archivo,sans-serif}
.tus-l span:last-child{font:700 11px/1 "Space Mono",monospace;letter-spacing:.04em;color:var(--gris)}
.tus-l .t-vivo{color:var(--magenta)!important}
.mono-c{width:36px;height:36px;display:grid;place-items:center;background:var(--inv);color:var(--inv-tinta);font:700 12px/1 "Space Mono",monospace}
.t3{display:grid;grid-template-columns:220px 1fr 340px;gap:0}
.t-izq{border-right:2px solid var(--linea);padding:10px 0}
.t-izq .dias{flex-direction:column;border:0;padding:6px 16px}
.t-svs{padding:14px 16px;display:grid;gap:6px}
.t-svs b{font:700 11px/1 "Space Mono",monospace;letter-spacing:.12em;color:var(--gris);margin-bottom:4px}
.t-svs a{display:flex;align-items:center;gap:10px;font:800 14px/1 Archivo,sans-serif;padding:6px 0}
.t-svs img{width:30px;height:30px;border-radius:50%;border:2px solid var(--linea)}
.t-centro{padding:6px 24px 24px;border-right:2px solid var(--linea)}
.t-der .sec{padding:18px 20px 4px}
/* feed */
.historias{display:flex;gap:12px;overflow:hidden;padding:14px 16px;border-bottom:2px solid var(--linea)}
.h{display:grid;justify-items:center;gap:5px;flex:none}
.h-c{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;padding:3px;background:var(--fondo);box-shadow:0 0 0 3px var(--verde);font:900 16px/1 Archivo,sans-serif;font-stretch:120%;overflow:hidden}
.h-c img{width:100%;height:100%;border-radius:50%}
.h.vivo .h-c{box-shadow:0 0 0 3px var(--magenta)}
.h small{font:700 11px/1 "Space Mono",monospace;letter-spacing:.04em}
.f-lista{padding:6px 0}
.f-card{margin:12px 16px;border:2px solid var(--linea);padding:14px;display:grid;gap:10px;background:var(--fondo)}
.f-tipo{font:700 11px/1 "Space Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--gris)}
.rojo{color:var(--magenta)}
.f-h{font:900 19px/1.1 Archivo,sans-serif;font-stretch:112%;text-transform:uppercase}
.f-p{margin:6px 0 0;color:var(--gris);font-size:14px}
.versus.chico{justify-content:center;gap:10px}
.versus.chico .vs{font-size:30px}
.f-acc{display:flex;flex-wrap:wrap;gap:8px}
.btn.borde2{border-color:var(--linea);color:var(--tinta)}
.reac{display:flex;gap:14px;align-items:center;border-top:1px solid var(--suave);padding-top:10px;font:700 12px/1 "Space Mono",monospace}
.reac a{margin-left:auto;text-decoration:underline;text-underline-offset:4px}
.f-fila{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center}
.podio{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px;font:800 14px/1.2 Archivo,sans-serif}
.podio b{display:inline-grid;place-items:center;width:22px;height:22px;background:var(--inv);color:var(--inv-tinta);font:700 11px/1 "Space Mono",monospace;margin-right:6px}
.podio li:first-child b{background:var(--verde);color:#030304}
.f-link{display:inline-flex;align-items:center;gap:6px;font:700 11px/1 "Space Mono",monospace;letter-spacing:.06em;text-transform:uppercase;text-decoration:underline;text-underline-offset:4px}
.rg-g{width:64px;height:64px;display:grid;place-items:center;font:900 30px/1 Archivo,sans-serif;font-stretch:120%;color:#030304;border:2px solid #030304}
.opciones{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.opciones li{position:relative;display:flex;justify-content:space-between;align-items:center;border:1.5px solid var(--linea);padding:10px 12px;font:800 14px/1 Archivo,sans-serif;overflow:hidden}
.opciones i{position:absolute;left:0;top:0;bottom:0;background:var(--verde);opacity:.35;z-index:0}
.opciones span,.opciones b{position:relative;z-index:1}
.opciones b{font:700 12px/1 "Space Mono",monospace}
.f-card .poster{width:112px}
.f3{display:grid;grid-template-columns:300px 1fr 340px;gap:0}
.f-izq{padding:0 0 20px;border-right:2px solid var(--linea)}
.f-izq .tu{margin:20px}
.f-centro{max-width:640px;margin:0 auto;width:100%}
.f-der{border-left:2px solid var(--linea)}
.f-der .sec{padding:18px 18px 4px}
.rail.vertical{grid-auto-flow:row;grid-template-columns:1fr;overflow:visible}
/* tu liga */
.aviso-vivo{display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--escenario);color:var(--esc-tinta);font:800 14px/1.2 Archivo,sans-serif}
.aviso-vivo .ico{margin-left:auto}
.yo-hero{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:start;padding:18px 16px;background:var(--caja);border-bottom:2px solid var(--linea)}
.yo-carta{position:relative}
.sticker2{position:absolute;left:-6px;top:-8px;font:900 11px/1 Archivo,sans-serif;font-stretch:120%;background:var(--magenta);color:#fff;padding:5px 6px;transform:rotate(-6deg)}
.yo-hola{font:700 11px/1.2 "Space Mono",monospace;letter-spacing:.1em;color:var(--gris)}
.yo-pos{display:block;font:900 48px/.95 Archivo,sans-serif;font-stretch:125%;margin-top:6px}
.yo-dat>small{font:700 11px/1.3 "Space Mono",monospace;color:var(--gris)}
.yo-prog{margin:12px 0}
.yo-prog small{font:700 11px/1.4 "Space Mono",monospace;color:var(--gris)}
.yo-acc{display:grid;gap:8px}
.prox{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;border:2px solid var(--linea);padding:12px}
.prox img{width:44px;height:44px;border-radius:50%;border:2px solid var(--linea)}
.prox b{display:block;font:900 16px/1.05 Archivo,sans-serif;font-stretch:115%}
.prox small{font:700 11px/1.3 "Space Mono",monospace;color:var(--gris)}
.prox-c{font:900 16px/1 Archivo,sans-serif;font-stretch:120%;background:var(--magenta);color:#fff;padding:8px 9px;white-space:nowrap}
.casillas3{display:grid;grid-template-columns:repeat(3,1fr);border:2px solid var(--linea)}
.casillas3 div{padding:12px 10px;border-left:2px solid var(--linea)}
.casillas3 div:first-child{border-left:0}
.casillas3 .v{background:var(--verde);color:#030304}
.casillas3 b{display:block;font:900 24px/1 Archivo,sans-serif;font-stretch:120%;margin-bottom:6px}
.casillas3 small{font:700 11px/1.25 "Space Mono",monospace;text-transform:uppercase;display:block}
.rivales{list-style:none;margin:0;padding:0}
.rivales li{display:grid;grid-template-columns:36px 1fr auto;grid-template-rows:auto auto;column-gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid var(--suave)}
.rivales .mono-c{grid-row:span 2}
.rivales b{font:800 15px/1.2 Archivo,sans-serif}
.rec{font:900 18px/1 Archivo,sans-serif;font-stretch:120%;grid-row:span 2;background:var(--verde);color:#030304;padding:6px 8px}
.rec.perd{background:var(--magenta);color:#fff}
.rivales small{font:700 11px/1.3 "Space Mono",monospace;color:var(--gris)}
.yo2{display:grid;grid-template-columns:520px 1fr;gap:0}
.yo-izq{border-right:2px solid var(--linea)}
.yo-izq .yo-hero{grid-template-columns:auto 1fr;padding:26px}
.yo-der .sec{padding:22px 30px 4px}
"""


def pagina(boceto, pc):
    cuerpo = {'boceto2': tablero, 'boceto3': feed, 'boceto4': tuliga}[boceto](pc)
    return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=%d,initial-scale=1">'
            '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900'
            '&family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@700;800&display=block">'
            '<style>%s%s</style></head><body><div class="app clara %s"><div class="barra-ul"></div>%s</div></body></html>'
            % (1280 if pc else 360, P.CSS, CSS_B, 'pc' if pc else 'movil', cuerpo))


def main():
    salida = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'salida')
    os.makedirs(salida, exist_ok=True)
    for b in ('boceto2', 'boceto3', 'boceto4'):
        for pc in (False, True):
            io.open(os.path.join(salida, '%s_clara%s.html' % (b, '_pc' if pc else '')), 'w', encoding='utf-8',
                    newline='\n').write(pagina(b, pc))
    print('ok · 6 páginas en', salida)


if __name__ == '__main__':
    main()

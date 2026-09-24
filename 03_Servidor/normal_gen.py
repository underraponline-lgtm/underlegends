
import os as _osruta
RAIZ = _osruta.path.dirname(_osruta.path.abspath(__file__))
def _r(*p): return _osruta.path.join(RAIZ, *p)
import json
C = json.load(open(_r('normal_datos.json'), encoding='utf-8'))

GRAD = {
 'S': ("linear-gradient(168deg,#FFF6C4 0%,#F5D43F 30%,#D9AE18 62%,#A87F0C 100%)", True),
 'A': ("linear-gradient(168deg,#FF9494 0%,#E63333 34%,#A81F1F 68%,#5E1010 100%)", False),
 'B': ("linear-gradient(168deg,#A3B0FF 0%,#5966F2 34%,#333DA8 68%,#171B52 100%)", False),
 'C': ("linear-gradient(168deg,#8FEDAC 0%,#33BF5A 34%,#1B7C39 68%,#0C3F1D 100%)", False),
 'D': ("linear-gradient(168deg,#DDE1EA 0%,#9AA1B2 34%,#616879 68%,#2C303B 100%)", False),
 'E': ("linear-gradient(168deg,#CFA57E 0%,#9C6838 34%,#68431F 68%,#31200D 100%)", False),
}
# El escudo (icono de Discord, o silueta si no hay) vive en comun/escudos.py,
# compartido con las otras dos cartas. Ver el docstring de ese modulo.
import sys as _sys
_sys.path.insert(0, _osruta.path.dirname(RAIZ))
from comun.escudos import LOGO, escudo
# la bandera sale del repo, no de flagcdn. Ver comun/banderas.py
from comun.banderas import src as bandera

def tag(c):
    """Devuelve (texto, tier). El tier define el efecto visual del TAG.
       t1 dorado = legendario · t2 púrpura = épico · t3 azul = raro · t4 gris = común
       El orden ES la prioridad: gana el primero que cumple."""
    if c['oro'] >= 20:      return ('👑 DINASTÍA', 't1')
    if c['pts'] >= 200000:  return ('💯 LEYENDA', 't1')
    if c['racha'] >= 7:     return ('🔥 RACHA DE %d' % c['racha'], 't1')
    if c['oro'] >= 10:      return ('⭐ DECACAMPEÓN', 't2')
    if c['pts'] >= 100000:  return ('💯 CENTENARIO', 't2')
    if c['racha'] >= 5:     return ('🔥 RACHA DE %d' % c['racha'], 't2')
    if c['oro'] >= 5:       return ('⭐ PENTACAMPEÓN', 't2')
    if c['srv'] >= 5:       return ('🌍 TROTAMUNDOS', 't3')
    if c['ev'] >= 20:       return ('🎖️ VETERANO', 't3')
    if c['oro'] >= 1:       return ('👑 CAMPEÓN x%d' % c['oro'], 't3')
    if c['ev'] >= 10:       return ('🔟 DOBLE DÍGITO', 't4')
    return ('🎤 COMPETIDOR', 't4')

def clase_nombre(n):
    """Misma escalera que la Temporada y la Competitiva."""
    L = len(n)
    return 'n6' if L <= 6 else 'n8' if L <= 8 else 'n10' if L <= 10 else 'n12'


def card(c):
    g, bright = GRAD[c['rango']]
    tg = tag(c)
    av  = c['av'].replace('?size=128', '?size=512')
    ini = c['raw'][0].upper()
    # ⚠️ Ver comun/respaldo.hay_foto(): un `data:` URI es una foto valida y un
    # `startswith('http')` lo descarta sin decir nada. Este es el layout viejo
    # —vive detras de `exportar_png.py --viejo`— y tenia la misma linea rota
    # que la Competitiva. Se arregla igual: una carta que ya casi no se emite
    # y sale mal es peor que una que no existe, porque parece que funciona.
    from comun.respaldo import hay_foto as _hay_foto
    foto = ('<img src="%s" onerror="this.parentNode.innerHTML=\'<div class=&quot;c-initials&quot;>%s</div>\'">'
            % (av, ini)) if _hay_foto(av) else '<div class="c-initials">%s</div>' % ini
    pts = ('%.0fK' % (c['pts']/1000)) if c['pts'] >= 10000 else ('%.1fK' % (c['pts']/1000))
    wr  = c['wr'].replace('%','') if '%' in c['wr'] else '—'
    efi = round(c['pts']/c['ev']/100)      # eficiencia en centenas: 4971 -> 50
    st  = [(pts,'PTS'), (str(c['ev']),'EVT'), (wr,'WR%'),
           (str(c['pod']),'POD'), (str(c['oro']),'CAM'), (str(c['racha']),'RCH')]
    filas = ''.join('<div class="c-stat" style="grid-column:%d"><span class="c-val">%s</span>'
                    '<span class="c-lbl">%s</span></div>' % (1 if i%2==0 else 3, v, l)
                    for i,(v,l) in enumerate(st))
    return """  <div>
  <div class="card%s %s %s" style="--grad:%s">
    <div class="c-bg"></div>
    <div class="c-tex"></div><div class="c-shine"></div><div class="c-vig"></div>
    <div class="c-photo">%s</div>
    <div class="c-colwash"></div><div class="c-scrim"></div><div class="c-edge"></div>
    <div class="c-band %s">%s</div>
    <div class="c-left">
      <div class="c-ovr">%d</div>
      <div class="c-rank">%s</div>
      <div class="c-sep"></div>
      <img class="c-flag" src="%s">
      <img class="c-logo" src="%s">
    </div>
    <div class="c-name">%s</div>
    <div class="c-rule"></div>
    <div class="c-stats"><div class="c-vdiv"></div>%s</div>
    <div class="c-foot">LIGA GLOBAL · UNDER LEGENDS</div>
  </div>
  <div class="tag">Rango %s · %s</div>
  </div>
""" % (' bright' if bright else '', tg[1], clase_nombre(c['raw']), g, foto, tg[1], tg[0], c['ovr'], c['rango'],
       bandera(c['cc']), escudo(c['sv']), c['raw'].upper(), filas,
       c['rango'], c['sv'])


# ═══ MATRIZ DE COMPATIBILIDAD: cada tier sobre cada color de carta ═══
TAGS = [('👑 DINASTÍA','t1'), ('💯 LEYENDA','t1'), ('🔥 RACHA DE 11','t1'),
        ('⭐ DECACAMPEÓN','t2'), ('💯 CENTENARIO','t2'), ('⭐ PENTACAMPEÓN','t2'),
        ('🌍 TROTAMUNDOS','t3'), ('🎖️ VETERANO','t3'), ('👑 CAMPEÓN x10','t3'),
        ('🔟 DOBLE DÍGITO','t4'), ('🎤 COMPETIDOR','t4')]

def matriz_html():
    filas = ''
    for rg in ['S','A','B','C','D','E']:
        grd, br = GRAD[rg]
        celdas = ''
        for txt, tier in TAGS:
            celdas += ('<div class="mx-cell"><div class="mx-card%s" style="--grad:%s">'
                       '<div class="mx-bg"></div><div class="c-band %s" style="position:relative;'
                       'top:auto;left:auto;transform:none;display:inline-block">%s</div></div></div>'
                       % (' bright' if br else '', grd, tier, txt))
        filas += '<div class="mx-row"><div class="mx-lbl">%s</div>%s</div>' % (rg, celdas)
    return ('<div class="sec"><h2>Matriz de compatibilidad</h2>'
            '<p class="sub">Los 11 TAGs sobre los 6 colores de carta — 66 combinaciones</p></div>'
            '<div class="mx">%s</div>' % filas)

cards = ''.join(card(c) for c in C)
LEY = ('<div class="ley"><b>PTS</b> puntos &nbsp;·&nbsp; <b>EVT</b> eventos jugados &nbsp;·&nbsp; '
       '<b>WR%</b> win rate ponderado &nbsp;·&nbsp; <b>POD</b> podios 🥇🥈🥉 &nbsp;·&nbsp; '
       '<b>CAM</b> campeonatos &nbsp;·&nbsp; <b>RCH</b> mejor racha de top-4 seguidos</div>'
       '<div class="ley" style="margin-top:8px">TAG por rareza: '
       '<span class="lg t1">LEGENDARIO</span> <span class="lg t2">ÉPICO</span> '
       '<span class="lg t3">RARO</span> <span class="lg t4">COMÚN</span></div>')

def bloque(cls, tit, sub):
    return ('<div class="sec"><h2>%s</h2><p class="sub">%s</p></div>\n'
            '<div class="rack %s">\n%s</div>\n%s\n' % (tit, sub, cls, cards, LEY))

CSS = open(_r('normal_card.css'), encoding='utf-8').read()
BLOQUES = [
 ('a','Tarjeta NORMAL','Diseño cerrado — datos y avatares reales del Operativo'),
]
html = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Tarjeta Normal — ediciones</title><style>%s</style></head><body>
<h1>Tarjeta NORMAL</h1>
<p class="sub2">Layout FIFA · TAG por rareza · seis rangos</p>
%s%s
</body></html>""" % (CSS, ''.join(bloque(*b) for b in BLOQUES), matriz_html())
_osruta.makedirs(_r('salida'), exist_ok=True) or open(_r('salida', 'tarjeta_servidor.html'),'w',encoding='utf-8').write(html)
print("generado")


import os as _osruta
RAIZ = _osruta.path.dirname(_osruta.path.abspath(__file__))
def _r(*p): return _osruta.path.join(RAIZ, *p)
# 🔴 LA RAIZ AL PATH **ACA ARRIBA**, Y ESTABA OCHO LINEAS DEBAJO DEL
# PRIMER `import comun`. El `from comun.temporada import SELLO` de mas
# abajo corria antes de este insert, asi que solo funcionaba cuando el
# cwd ya era la raiz del proyecto — que es como lo corre el ciclo
# (`python bot/pipeline.py`), y por eso nunca se vio.
#
# ⚠️ `CLAUDE.md` dice que **cada carta corre desde su propia carpeta**.
# Corrido asi —`cd 01_Temporada && python generar.py`— reventaba con
# `ModuleNotFoundError: No module named 'comun'`. Medido el 22/09/2026 con
# `herramientas/puedo_generar.py`, que es justo la herramienta que existe
# para que un fallo asi no se descubra en produccion.
#
# ⚠️ Y NO SE VEIA MIENTRAS EL POOL ESTABA EN 0: el generador salia antes
# de importar nada con «no quedo nadie que dibujar». Aparecio en cuanto
# entraron las 6 primeras personas de la T1.
import sys as _sys
if _osruta.path.dirname(RAIZ) not in _sys.path:
    _sys.path.insert(0, _osruta.path.dirname(RAIZ))
import json
C = []

# Se sumaron SS y SSS: antes el rango S abarcaba 35 puntos (65-100) y el B
# solo 11, asi que Konan 91 y Tuca 66 compartian color.
#   SSS 82+ · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E resto
GRAD = {
 # SSS negro · SS naranja · S rosado · A rojo · B azul · C verde · D gris · E marron
 #
 # La primera parada va MUY clara (casi blanca) a proposito: esa zona
 # queda detras de la foto, y si el color arranca saturado le tapa la
 # cara al avatar. El color pleno recien aparece pasado el 30%, que es
 # donde la mascara de .c-photo empieza a desvanecerla.
 'SSS':("linear-gradient(168deg,#D8D4E0 0%,#4A4552 30%,#1A1822 62%,#000000 100%)", False),
 'SS': ("linear-gradient(168deg,#FFEBD2 0%,#FFA04A 30%,#D96A12 62%,#7A3305 100%)", False),
 'S':  ("linear-gradient(168deg,#FFDCEC 0%,#F573AE 30%,#C43574 62%,#66123A 100%)", False),
 'A':  ("linear-gradient(168deg,#FF9494 0%,#E63333 34%,#A81F1F 68%,#5E1010 100%)", False),
 'B':  ("linear-gradient(168deg,#A3B0FF 0%,#5966F2 34%,#333DA8 68%,#171B52 100%)", False),
 'C':  ("linear-gradient(168deg,#8FEDAC 0%,#33BF5A 34%,#1B7C39 68%,#0C3F1D 100%)", False),
 'D':  ("linear-gradient(168deg,#DDE1EA 0%,#9AA1B2 34%,#616879 68%,#2C303B 100%)", False),
 'E':  ("linear-gradient(168deg,#CFA57E 0%,#9C6838 34%,#68431F 68%,#31200D 100%)", False),
}
# EL RANGO SALE DEL SCORE COMPETITIVO. Siempre, en las tres cartas.
# La unica forma de subir de rango es en el competitivo: ser primero de la
# temporada no te hace primero del competitivo. Son cosas distintas.
#   SSS 82+ · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E resto
# Son los MISMOS umbrales que usa la Competitiva, a proposito: el rango es
# uno solo por persona y tiene que dar igual en todas sus cartas.
#
# Consecuencia asumida: en esta carta el numero y el color dicen cosas
# distintas. El color dice QUIEN SOS (tu nivel competitivo), el numero dice
# QUE HICISTE en la temporada. Bloody es #1 de temporada con OVR 92 y carta
# de rango A, y esta bien que asi sea.
UMBRAL = [('SSS',82),('SS',73),('S',62),('A',48),('B',37),('C',26),('D',18)]

# El COLOR y el NUMERO son otra cosa: los dos hablan de la TEMPORADA, que no
# es lo mismo que el competitivo (la temporada tiene eventos bonus, cacerias,
# multiplicadores). Por eso el gradiente se elige con el OVR y con sus propios
# umbrales, no con los del Score.
#   SSS 88+ · SS 82 · S 74 · A 67 · B 61 · C 56 · D 52 · E resto
UMBRAL_COLOR = [('SSS',88),('SS',82),('S',74),('A',67),('B',61),('C',56),('D',52)]

def rango(score):
    """La LETRA. Sale del Score competitivo, siempre."""
    for k, v in UMBRAL:
        if score >= v:
            return k
    return 'E'


def letra_rango(c):
    """La letra de esa persona, o `''` si todavía no la ganó.

    🔴 EL RANGO ES EL DEL COMPETITIVO, Y EL COMPETITIVO PIDE 10 EVENTOS.
    Dlx, 23/09/2026: *«sin 10 eventos no hay letra en ninguna carta»*.
    Con 1 evento esta carta decía **A** mientras el Ranking Competitivo
    estaba vacío y la página pública decía «Falta 9 EV» — la misma
    persona con dos respuestas, que es lo que `CLAUDE.md` marca como el
    error más grave del proyecto.

    ⚠️ EL PISO SALE DE `comun/requisitos.py`, no se escribe acá: es el
    mismo número que decide si se emite la carta Competitiva, y tenerlo
    dos veces es tenerlo mal una vez.

    ⚠️ Y SI NO SE PUEDE PREGUNTAR, SE MUESTRA. Un fallo al importar no
    puede dejar sin letra a quien sí la tiene: el hueco es para el que
    no llegó, no para el que no se pudo medir.
    """
    try:
        import os as _os
        import sys as _sys
        _sys.path.insert(0, _os.path.dirname(_os.path.dirname(
            _os.path.abspath(__file__))))
        from comun.requisitos import minimo
        if (c.get('ev') or 0) < minimo('competitivo', 'ev'):
            return ''
    except Exception:                                    # noqa: BLE001
        pass
    return rango(c['score'])

def tier_color(ovr):
    """El COLOR de la carta. Sale del OVR de temporada."""
    for k, v in UMBRAL_COLOR:
        if ovr >= v:
            return k
    return 'E'

# 🔴 SALE DE `comun/temporada.py`, NO SE ESCRIBE ACA. Estuvo a mano
# en CUATRO archivos y los cuatro decian «un solo lugar para
# cambiarlo»: el dia del reset las cuatro cartas siguieron diciendo
# PRE con la T1 ya empezada. No fallaba, imprimia otra temporada.
from comun.temporada import SELLO as TEMPORADA  # noqa: E402,F401

UL = open(_r('ul_b64.txt'), encoding='utf-8').read().strip()   # logo Under Legends

# El escudo (icono de Discord, o silueta si no hay) vive en comun/escudos.py,
# compartido con las otras dos cartas. Estaba duplicado en las tres y una se
# quedo sin el fallback: ver el docstring de ese modulo.
# (la raíz ya está en el path: se pone arriba del archivo, ver el comentario)
from comun.escudos import LOGO, escudo
# ⚠️ Y LA BANDERA TAMBIEN SALE DE comun/. Esta carta la pedia a flagcdn
# teniendola en el repo: 04_Pais/banderas/ tiene las dieciseis oficiales
# bajadas de ese mismo CDN. Pedirla afuera significa que la carta no se dibuja
# sin internet, que en Chromium aislado sale sin bandera y sin avisar, y que
# se usa una imagen de 80 px de ancho donde el repo tiene una de 1280.
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
    if c.get('caz',0) >= 3: return ('🎯 CAZADOR', 't2')
    if c['srv'] >= 5:       return ('🌍 TROTAMUNDOS', 't3')
    if c['ev'] >= 20:       return ('🎖️ VETERANO', 't3')
    if c['oro'] >= 1:       return ('👑 CAMPEÓN x%d' % c['oro'], 't3')
    if c['ev'] >= 10:       return ('🔟 DOBLE DÍGITO', 't4')
    return ('🎤 COMPETIDOR', 't4')

def clase_nombre(n):
    """El nombre se achica solo si hace falta. MISMA escalera que la
       Competitiva (clase_nombre en gencomp.py): las dos cartas del mismo
       rapero tienen que tratar el nombre igual.
       Medido sobre los 138: 103 tienen <=6 caracteres, 28 tienen 7-8,
       4 tienen 9-10 y 3 tienen 11+. """
    L = len(n)
    return 'n6' if L <= 6 else 'n8' if L <= 8 else 'n10' if L <= 10 else 'n12'


def _hay_foto(av):
    """⚠️ TAMBIEN VALE UN data: URI, NO SOLO UN http.

    El exportador, cuando la URL de Discord da 404, mete en `av` la copia que
    ya esta en el repo —hay diez fotos bajadas y versionadas, ver
    `comun/respaldo.py`—. Con un `startswith('http')` a secas esa foto se
    descartaba en silencio y la carta salia con la INICIAL teniendo la foto.
    """
    # ⚠️ LA DEFINICION VIVE EN comun/respaldo.py desde el 17/09/2026: esta
    # misma linea estaba mal escrita en otros DOS archivos (gencomp.py y
    # normal_gen.py) y arreglarla aca tapo los otros dos, porque la carta de
    # Temporada ya salia bien y nadie volvio a buscarla.
    from comun.respaldo import hay_foto
    return hay_foto(av)


def card(c):
    # 🔴 SIN 10 EVENTOS NO HAY LETRA. Dlx, 23/09/2026, mirando esta
    # misma carta: *«no — sin 10 eventos no hay letra en ninguna carta»*.
    # El rango **es** el competitivo, y el competitivo pide 10; mostrarlo
    # con 1 evento es darle una letra que todavia no gano.
    #
    # ⚠️ Y ESTA ES LA UNICA CARTA QUE IMPRIME UNA LETRA debajo de los 10.
    # La Competitiva tambien la imprime pero **no se emite** sin el
    # requisito, asi que nunca se ve. Pais y Servidor muestran el rango
    # como GEMA y como color de la carta, no como letra: ahi no se toca
    # nada — sacarlo dejaria la carta sin color.
    #
    # ⚠️ EL COLOR DE ESTA NO DEPENDE DEL RANGO, y por eso el hueco no
    # rompe nada: sale del OVR (la linea de abajo). Es la regla de
    # `CLAUDE.md` —*«el color sale del OVR y la letra del Score»*— que
    # justamente por estar separadas deja quitar una sin tocar la otra.
    rg = letra_rango(c)
    g, bright = GRAD[tier_color(c['ovr'])]   # el COLOR sale del OVR de temporada
    tg = tag(c)
    av  = c['av'].replace('?size=128', '?size=512')
    ini = c['raw'][0].upper()
    foto = ('<img src="%s" onerror="this.parentNode.innerHTML=\'<div class=&quot;c-initials&quot;>%s</div>\'">'
            % (av, ini)) if _hay_foto(av) else '<div class="c-initials">%s</div>' % ini
    pts = ('%.0fK' % (c['pts']/1000)) if c['pts'] >= 10000 else ('%.1fK' % (c['pts']/1000))
    # SET B — las seis se leen por tema, de a pares por fila:
    #   volumen (PTS EVT) · logro (POD SEM) · most wanted (CAZ MW)
    # Fuera WR% y SRV. WR% NO se pierde: sigue pesando 16% dentro del OVR,
    # solo deja de ocupar casilla. Entran SEM (semis, 81% de cobertura) y MW.
    #
    # MW = sobrevivio / veces que fue objetivo del Most Wanted. Va como par
    # y no como dos casillas porque 🛡️ solo lo tienen 6 personas en todo el
    # Sheet: en casillas separadas, 133 de 138 cartas mostrarian dos ceros.
    # El formato 'a/b' es el que ya usa la columna 🔥, que guarda 'actual/maxima'.
    mw  = '%d/%d' % (c.get('sob',0), c.get('sob',0) + c.get('czd',0))
    st  = [(pts,'PTS'),                 (str(c['ev']),'EVT'),
           (str(c['pod']),'POD'),       (str(c.get('sem',0)),'SEM'),
           (str(c.get('caz',0)),'CAZ'), (mw,'MW')]
    filas = ''.join('<div class="c-stat" style="grid-column:%d"><span class="c-val">%s</span>'
                    '<span class="c-lbl">%s</span></div>' % (1 if i%2==0 else 3, v, l)
                    for i,(v,l) in enumerate(st))
    return """  <div>
  <div class="card%s %s %s" style="--grad:%s">
    <div class="c-bg"></div>
    <div class="c-tex"></div><div class="c-shine"></div><div class="c-vig"></div>
    <div class="c-photo">%s</div>
    <div class="c-edge"></div>
    <div class="c-pos">#%d</div>
    <div class="c-fila">
      <div class="c-season">%s</div>
      <div class="c-band %s">%s</div>
      <img class="c-ul" src="%s">
    </div>
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
    <div class="c-frame"></div>
  </div>
  <div class="tag">Rango %s · %s</div>
  </div>
""" % (' bright' if bright else '', tg[1], clase_nombre(c['raw']), g, foto, c.get('pos',0), TEMPORADA, tg[1], tg[0], UL,
       c['ovr'], rg,
       bandera(c['cc']), escudo(c['sv']), c['raw'].upper(), filas, rg, c['sv'])




def render(datos):
    return ''.join(card(c) for c in datos)


import os as _osruta
RAIZ = _osruta.path.dirname(_osruta.path.dirname(_osruta.path.abspath(__file__)))
CARD = _osruta.path.dirname(_osruta.path.abspath(__file__))
def _r(*p): return _osruta.path.join(RAIZ, *p)
import json, sys
sys.path.insert(0, _r('v2'))
from shield import OUT, VW, VH

C = json.load(open(_r('comp.json'), encoding='utf-8'))

# acento · metal del marco (6 paradas) · base oscura
# PALETA DE METALES — cada rango es un material, de mas noble a mas comun.
# Distinta de la Normal a proposito: ahi el color dice el rango sobre fondo
# pleno; aca es un acento metalico sobre base oscura, asi las dos cartas de
# la misma persona no se confunden.
#   (acento, 6 paradas del marco, base oscura)
ACC = {
 'SSS': ('#C77DFF', ['#F3E4FF','#C77DFF','#5A2A8C','#E8D0FF','#9448D0','#F3E4FF'], '#160828'),
 'SS' : ('#8FE8FF', ['#FFFFFF','#A8EEFF','#2E7A96','#E4FAFF','#5EBEDC','#FFFFFF'], '#06161E'),
 'S'  : ('#FFD24A', ['#FFF8DC','#FFD024','#8A6400','#FFEFA8','#C89A10','#FFF8DC'], '#221A06'),
 'A'  : ('#FF6B7A', ['#FFE0E4','#FF6B7A','#8C0F1E','#FFC9CF','#D0303F','#FFE0E4'], '#260810'),
 'B'  : ('#5CE6A5', ['#DFFFF0','#5CE6A5','#0F6B47','#B8F5DA','#2AA877','#DFFFF0'], '#042014'),
 'C'  : ('#6B8FE8', ['#DDE6FF','#6B8FE8','#1A3A7A','#B8CBFF','#3A5FBF','#DDE6FF'], '#0A1230'),
 'D'  : ('#D8DEE8', ['#FFFFFF','#CED8E4','#5E6874','#EEF3F9','#909AA8','#FFFFFF'], '#12161C'),
 'E'  : ('#C98A4B', ['#F2DCC0','#C98A4B','#6B4318','#E4C39A','#9A6630','#F2DCC0'], '#1A1006'),
}
# El escudo vive en comun/escudos.py, compartido con las otras dos cartas.
# Antes esta carta hacia LOGO[sv] directo y sin fallback: URBF tiraba KeyError
# y tumbaba las 138 por 2 personas. Ver el docstring de ese modulo.
sys.path.insert(0, _osruta.path.dirname(RAIZ))
from comun.escudos import LOGO, escudo
DIMS = ['EFI','CON','DOM','RCH','DIV','EVT']   # RCH = Racha (rework A5: era TCH/Techo; el calculo no cambia)

# ══ LA COLUMNA IZQUIERDA ══════════════════════════════════════════════
# Solo eventos. El estilo y la crew se mudaron a la fila de abajo.
# El borde toma --acc (color del rango); el NIVEL va en el punto del vertice.
import os, base64

def _b64(ruta, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(open(ruta,'rb').read()).decode())

_DIR = os.path.dirname(os.path.abspath(__file__))
ICONOS = {}
for _n, _f, _m in [('interserver', 'ev_bl.png', 'image/png'),
                   ('follombia',   'foll_v3.png', 'image/png'),
                   ('ks',          'ks_bl.png', 'image/png')]:
    _ruta_ic = _r(_f)
    if os.path.exists(_ruta_ic):
        ICONOS[_n] = _b64(_ruta_ic, _m)

# Los estilos ahora son PNG, no SVG: se extraen del rombo dorado de las
# tarjetas originales con extraer_estilos.py, que los recorta y normaliza.
ESTILOS = {}
_e = os.path.join(_DIR, 'estilos')
if os.path.isdir(_e):
    for _f in sorted(os.listdir(_e)):
        if _f.endswith('.png'):
            ESTILOS[_f[:-4]] = _b64(os.path.join(_e, _f), 'image/png')
        elif _f.endswith('.svg'):
            ESTILOS[_f[:-4]] = _b64(os.path.join(_e, _f), 'image/svg+xml')

# ══ EVENTOS INSIGNIA ══════════════════════════════════════════════════
# eventos.json tiene un bloque por evento con su icono y la lista de
# participantes con su resultado (oro / plata / bronce / negro).
# De ahi sale la columna izquierda: hasta TRES rombos, ordenados por
# resultado, el mejor arriba.
# ⚠️ DE LOS CINCO EVENTOS SOLO ENTRABA UNO, Y NO AVISABA. El JSON guarda el
# icono como ruta relativa —'ev_bl.png' y 'logos_sv/sv_tfc.png'— y esto la
# resolvia contra 02_Competitivo/. Ahi existe ev_bl.png y NO existe logos_sv/:
# las siluetas viven en comun/logos_sv/ desde que se unificaron. Resultado:
# EVENTOS cargaba ['interserver'] y los otros cuatro caian por el `continue`.
#
# O sea que el oro de Konan en la TFC Champions, el de Bloody en el DRA, el de
# MCO en Urban Nations y el de Ceko en la FRZ NO SE DIBUJABAN. La regla de
# CLAUDE.md sobre como se ordenan los rombos describia algo que en esta carta
# no pasaba nunca, porque nunca habia mas de uno.
#
# Es el mismo error que CLAUDE.md ya documenta de procesar_logos.py —"apuntaba
# a herramientas/logos_sv/, que no existe, asi que regenerar las siluetas no
# llegaba a ninguna de las tres cartas"—. La misma ruta muerta, en otro
# archivo, callada por un `continue`.
#
# ⚠️ Y EL JSON SALE DE datos/, no de la copia local. 02_Competitivo/eventos.json
# era un duplicado byte a byte: hoy coincide y manana no tiene por que.
EVENTOS = []
_FALTAN_EV = []


def _icono(rel):
    """La ruta del icono de un evento. Primero la carta, despues comun/."""
    for base in (RAIZ, _r('..', 'comun')):
        p = _osruta.path.join(base, rel)
        if _osruta.path.exists(p):
            return p
    return None


_e = _r('..', 'datos', 'eventos.json')
if os.path.exists(_e):
    _d = json.load(open(_e, encoding='utf-8'))
    for _k, _v in _d.items():
        if _k.startswith('_') or not isinstance(_v, dict) or 'participantes' not in _v:
            continue
        _ruta = _icono(_v['icono'])
        if not _ruta:
            _FALTAN_EV.append((_k, _v['icono']))
            continue
        EVENTOS.append({
            'clave': _k,
            'nombre': _v['nombre'],
            'prioridad': _v.get('prioridad', 99),
            'icono': _b64(_ruta, 'image/png'),
            'gente': {k.lower(): v for k, v in _v['participantes'].items()},
        })

ORDEN_NIVEL = {'oro': 0, 'plata': 1, 'bronce': 2, 'negro': 3}

# a que crew pertenece cada uno. Los que no estan, no llevan rombo de crew.
# ⚠️ SALE DE datos/crews.json, NO DE UN DICT ACA. Habia uno escrito a mano con
# 13 personas y dos crews, de antes de que Dlx pasara la lista el 20/08/2026:
# 48 personas y 16 crews. Contra el pool eso dejaba a 24 sin su rombo y le
# ponia la crew EQUIVOCADA a dos —Juanpa y Kyss figuraban en Follombia—. Pais
# y Servidor ya leian el JSON, asi que la misma persona tenia una crew en una
# carta y otra en otra. Ver comun/crews.py.
sys.path.insert(0, RAIZ)
from comun import crews as _CW
# ⚠️ LA BANDERA SALE DE comun/banderas.py, NO DE flagcdn. Mismo caso que los
# escudos y las crews: el repo tiene las dieciseis oficiales en
# 04_Pais/banderas/, y a 1280 px de ancho contra los 80 del `w80` del CDN.
from comun.banderas import src as _bandera
CREWS = {k: v.lower() for k, v in _CW.DE_CADA_UNO.items()}
# ⚠️ EL PUESTO DENTRO DE LA CREW NO ESTA EN EL POOL. El builder lo calcula
# —construir_pool_competitivo.py deja pos_crew— pero el JSON en disco es del
# 29/07 y la lista de crews del 20/08, asi que ninguna fila lo trae. Se
# calcula aca con la misma regla: por Score y con el umbral de 3.
_PUESTO_CREW = {}

# estilo asignado por rapero. VACIO a proposito: el evento de estilos
# todavia no se hizo, asi que hoy nadie lleva el rombo del medio.
ESTILO_DE = {}   # vacio: hoy nadie tiene estilo asignado. Se llena cuando
                 # se haga el evento de estilos. Los 16 iconos ya estan en
                 # v2/estilos, extraidos del rombo y normalizados.


# UMBRALES con SSS y SS. Antes el rango S abarcaba 35 puntos (65-100) y el
# B solo 11, asi que Konan 91 y Tuca 66 compartian color. Ahora:
#   SSS 82+ · SS 73 · S 62 · A 48 · B 37 · C 26 · D 18 · E resto
UMBRAL = [('SSS', 82), ('SS', 73), ('S', 62), ('A', 48),
          ('B', 37), ('C', 26), ('D', 18)]


def rango_metal(score):
    """El rango base, que es el que elige el COLOR de la carta."""
    for k, v in UMBRAL:
        if score >= v:
            return k
    return 'E'


# ── SUBRANGOS ─────────────────────────────────────────────────────────
# Cada rango con signo se parte en tercios: A- / A / A+.
# SSS, SS, S y E NO llevan signo. Son los extremos: arriba porque ya son
# distinciones finas de por si, abajo porque E es "el resto".
# El signo cambia la PASTILLA, no el color: el material sigue saliendo del
# rango base, asi que un A- y un A+ comparten carta de rubi.
LIMITES = [('SSS', 82, 101), ('SS', 73, 82), ('S', 62, 73), ('A', 48, 62),
           ('B', 37, 48), ('C', 26, 37), ('D', 18, 26), ('E', 0, 18)]
CON_SIGNO = {'A', 'B', 'C', 'D'}


def subrango(score):
    for k, a, b in LIMITES:
        if a <= score < b:
            if k not in CON_SIGNO:
                return k
            t = (b - a) / 3.0
            return k + '-' if score < a + t else (k if score < a + 2 * t else k + '+')
    return 'E' 


def _num(pos):
    """El <b> con el puesto, o nada. El builder deja pos_* vacio cuando el
       grupo tiene menos de 3: ser '1 de 1' no dice nada, en pais, servidor
       o crew. Los tres usan el mismo umbral a proposito."""
    return ('<b>%s</b>' % str(pos).split('/')[0]) if pos else ''


def fila_abajo(c):
    """La fila de abajo, todo en circulos.
       bandera y servidor llevan ARO QUE MIDE: se completa segun tu puesto
       dentro de esa categoria (arc_pais / arc_sv, 0 a 100).
       estilo y crew van con aro apagado, porque todavia no miden nada."""
    k = c['raw'].lower()
    p = []
    # Sin dato no hay pieza: si no tiene pais, el circulo NO se dibuja, igual
    # que la crew. Con cc vacio la URL quedaba 'flagcdn.com/w80/.png' -> 404,
    # y el navegador pintaba su icono de imagen rota, que es peor que nada.
    if c.get('cc'):
        p.append('<span class="ar" style="--p:%d">'
                 '<img class="fl" src="%s">%s</span>'
                 % (c.get('arc_pais', 0), _bandera(c['cc']),
                    _num(c.get('pos_pais'))))
    est = ESTILO_DE.get(k)
    if est and est in ESTILOS:
        p.append('<i class="ci" style="--m:url(%s)"></i>' % ESTILOS[est])
    p.append('<span class="ar" style="--p:%d">'
             '<img class="cl" src="%s">%s</span>'
             % (c.get('arc_sv', 0), escudo(c['sv']), _num(c.get('pos_sv'))))
    # la crew va como IMAGEN llena, igual que la bandera y el servidor, con
    # su aro. Lleva numero solo si la crew tiene 3 o mas en el ranking: en una
    # de un solo integrante, ser primero no dice nada.
    cr = CREWS.get(_CW.norm(c['raw']))
    if cr and cr in ICONOS:
        # ⚠️ NO SE USA c['pos_crew'] AUNQUE EXISTA. El pool en disco es del
        # 29/07 y la lista de crews del 20/08, asi que sus 10 filas con
        # pos_crew salieron del dict viejo: ahi Bloody es 5/9 y con la lista
        # de verdad es 2/9. Y el problema de fondo no es la fecha: si la
        # IDENTIDAD sale de comun/crews.py y el NUMERO del pool, los dos
        # pueden discrepar —era justo el caso de Bloody—. Los dos salen del
        # mismo lugar. Cuando el builder se vuelva a correr, coinciden.
        _pc = _PUESTO_CREW.get(_CW.norm(c['raw']), '')
        p.append('<span class="ar"><img class="cl" src="%s">%s</span>'
                 % (ICONOS[cr], _num(_pc)))
    return ''.join(p)


def rombos(c):
    """La columna izquierda: SOLO EVENTOS.
       El estilo y la crew vivian aca y se mudaron a la fila de abajo,
       cada uno en su circulo. Dejarlos tambien aca los mostraba dos veces
       en la misma carta."""
    k = c['raw'].lower()
    out = []
    for ev in EVENTOS:
        if k in ev['gente']:
            out.append((ev['prioridad'], ev['gente'][k], ev['icono']))
    # ORDEN: manda la importancia del EVENTO, no el resultado del rapero.
    # El Interserver va primero siempre, por ser de toda la Hermandad; el
    # resto sigue el tamano del servidor (ver _orden en eventos.json).
    # Consecuencia asumida: alguien puede tener el rombo de plata arriba y
    # el de oro abajo, si el de plata es de un evento mas importante.
    out.sort(key=lambda x: x[0])
    # ⚠️ EL ORDEN LO MANDA EL EVENTO; EL CORTE LO MANDA LA MEDALLA. Son dos
    # preguntas distintas y hasta ahora habia una sola respuesta para las dos.
    #
    # Mientras entraba un solo evento —el icono de los otros cuatro apuntaba a
    # una carpeta que no existe— el tope de 3 NO SE ALCANZABA NUNCA, asi que
    # nadie habia mirado que se lleva el corte. Con los cinco cargados salta
    # solo: MCO tiene 4 eventos y su unico ORO es de Urban Nations, prioridad
    # 9, o sea el menos importante. Cortando por prioridad su carta mostraba
    # TRES PARTICIPACIONES y escondia la medalla.
    #
    # Dlx: que las medallas no se corten. Entre los tres que sobreviven sigue
    # mandando la importancia del evento —la regla de CLAUDE.md no se toca, y
    # Konan sigue con la plata arriba y el oro abajo—; lo unico que cambia es
    # CUALES tres sobreviven cuando hay mas de tres.
    #
    # ⚠️ Y ESTO IMPORTA MAS CADA VEZ: hoy es una persona de 24, y cada evento
    # nuevo mete gente por encima del tope.
    if len(out) > 3:
        medalla = [x for x in out if x[1] != 'negro']
        resto = [x for x in out if x[1] == 'negro']
        out = sorted(medalla[:3] + resto[:max(0, 3 - len(medalla))],
                     key=lambda x: x[0])
    out = [(n, u) for _, n, u in out][:3]
    if not out:
        return ''
    # la clase k1/k2 dice cuantos hay: el CSS agranda el rombo si son pocos
    return '<div class="skills k%d">%s</div>' % (
        len(out), ''.join('<i class="ic lv-%s" style="--m:url(%s)"></i>' % (n, u)
                          for n, u in out))


def clase_nombre(n):
    """El nombre se achica solo si hace falta. Ver card.css"""
    L = len(n)
    return 'n6' if L <= 6 else 'n8' if L <= 8 else 'n10' if L <= 10 else 'n12'

# 🔴 SALE DE `comun/temporada.py`, NO SE ESCRIBE ACA. Estuvo a mano
# en CUATRO archivos y los cuatro decian «un solo lugar para
# cambiarlo»: el dia del reset las cuatro cartas siguieron diciendo
# PRE con la T1 ya empezada. No fallaba, imprimia otra temporada.
from comun.temporada import SELLO as TEMPORADA  # noqa: E402,F401
UL = open(_r('ul_b64.txt'), encoding='utf-8').read().strip()   # logo Under Legends

# ── VARIANTES DEL BLOQUE SUPERIOR ──
VAR = '2'   # 1 sin tag · 2 tag abajo · 3 tag en la corona

# TAGs del COMPETITIVO: hablan del nivel, no del volumen.
def TAG(c):
    if c['pos'] == 1:   return ('🏆 #1 COMPETITIVO','t1')
    if c['pos'] <= 3:   return ('🥇 TOP 3','t1')
    if c['pos'] <= 10:  return ('⭐ TOP 10','t1')
    if c['pos'] <= 25:  return ('◆ TOP 25','t2')
    if max(c['E'],c['C'],c['Dm'],c['T'],c['V']) >= 85: return ('⚡ ESPECIALISTA','t2')
    if c['pos'] <= 50:  return ('◇ TOP 50','t3')
    if min(c['E'],c['C'],c['Dm'],c['T'],c['V']) >= 30: return ('🎯 COMPLETO','t3')
    return ('🎤 CLASIFICADO','t4')

# El número grande de ESTA carta es el SCORE, no el OVR mapeado.
# El OVR pertenece a la carta de Temporada: cada carta muestra lo que mide.
def TAG_ABAJO(c):
    if VAR != '2': return ''
    t, k = TAG(c)
    return '<div class="tagbot %s">%s</div>' % (k, t)

def TAG_CORONA(c):
    if VAR != '3': return ''
    t, k = TAG(c)
    return '<div class="tagtop %s">%s</div>' % (k, t)

def BLOQUE_TL(c):
    # La pastilla dice el RANGO, no el nombre del material. El material es
    # solo la paleta; lo que el rapero necesita leer es en que rango esta.
    return ('<div class="ovr">%d</div><div class="rkbox">RANGO %s</div>'
            % (round(c['score']), subrango(c['score'])))

def BLOQUE_TR(c):
    # el chip del Score ya no hace falta: pasa a estar arriba
    #
    # 🔴 SIN DUELOS NO HAY WR, Y ESO ES UN ESTADO — NO UN ERROR. Esto
    # hacia `float(c['wr'].replace('%',''))` directo y con `wr` vacio
    # levantaba `ValueError: could not convert string to float: ''`,
    # tumbando **las 15 cartas**.
    #
    # ⚠️ Y VACIO ES LO NORMAL AL ARRANCAR UNA TEMPORADA. Medido el
    # 22/09/2026: el primer evento de la T1 fue 3v3, y por equipos las
    # batallas no cuentan como duelos —regla de Dlx— asi que `1v1` tiene
    # cero filas y NADIE tiene Win%. El generador no fallo antes porque
    # el pool estaba vacio; fallo en cuanto entro la primera persona.
    #
    # ⚠️ Se dibuja `—`, que es lo que esta carta ya hace con las otras
    # piezas que no se pueden llenar. Un `0.0` diria que peleo y perdio
    # todos.
    try:
        wr = '%.1f' % float(str(c.get('wr') or '').replace('%', ''))
    except ValueError:
        wr = '—'
    return ('<span class="chip on">#%d</span><span class="chip cf">%s<u>WR</u></span>'
            % (c['pos'], wr))


def card(c,i):
    rg = rango_metal(c['score'])       # el rango del competitivo, con SSS/SS
    acc, met, base = ACC[rg]
    ini = c['raw'][0].upper()
    # 🔴 LA FOTO SE PIDE POR NOMBRE, NO SE LEE DEL POOL. Medido el
    # 20/09/2026: de los 82 del pool que YA tienen su foto guardada en
    # `comun/fotos/<temporada>/`, esta carta mostraba **14**. Los otros 68 la
    # tenian en disco y salian con la inicial.
    #
    # La causa era el orden: `c['av']` esta vacia en **118 de las 138**
    # —el Sheet no guarda avatares y el pool los arrastra de si mismo— y
    # `hay_foto('')` es falso, asi que se decidia dibujar la inicial
    # **antes** de preguntarle al respaldo. El exportador tiene un rescate
    # (`respaldo.para(url)`) pero actua sobre un `src="http..."` que en ese
    # caso nunca se llega a escribir.
    #
    # Es la forma de siempre de este repo: **el dato estaba y la pregunta no
    # iba a buscarlo**. `respaldo.avatar()` pregunta primero por el repo y
    # cae en la URL del pool solo si no hay copia, que es lo que ya hacen la
    # Temporada, la Servidor y la de Pais.
    from comun.respaldo import avatar as _avatar, hay_foto as _hay_foto
    av = _avatar(c['raw'], (c.get('av') or '').replace('?size=128', '?size=512'))
    foto = ('<img src="%s" onerror="this.parentNode.innerHTML=\'<b>%s</b>\'">' % (av,ini)) \
           if _hay_foto(av) else '<b>%s</b>' % ini
    stops = ''.join('<stop offset="%s" stop-color="%s"/>' % (o,c_)
                    for o,c_ in zip(['0','0.20','0.42','0.60','0.80','1'], met))
    vals = [c['E'],c['C'],c['Dm'],c['T'],c['V'],c['ev']]
    lbls = ''.join('<span>%s</span>' % d for d in DIMS)
    # un 100 en una dimension = lidera esa dimension en todo el pool -> .top
    # los primeros 5 son dimensiones normalizadas; el 6to (ev) es conteo crudo
    nums = ''.join('<span%s>%d</span>' % (' class="top"' if (j < 5 and v == 100) else '', v)
                   for j, v in enumerate(vals))
    rb   = rombos(c)
    return """
<div class="wrap">
  <div class="card %s" style="--acc:%s;--base:%s">
    %s
    <div class="clip">
      <div class="bg"></div><div class="rays"></div><div class="bloom"></div>
      <div class="photo">%s</div><div class="veil"></div>
      <span class="temp">%s</span>
    </div>
    <svg class="frame" viewBox="0 0 %d %d">
      <defs>
        <linearGradient id="m%d" x1="0.08" y1="0" x2="0.92" y2="1">%s</linearGradient>
        <clipPath id="c%d"><path d="%s"/></clipPath>
      </defs>
      <g clip-path="url(#c%d)">
        <path d="%s" fill="none" stroke="%s" stroke-width="27" opacity="0.85"/>
        <path d="%s" fill="none" stroke="var(--base)" stroke-width="23"/>
        <path d="%s" fill="none" stroke="url(#m%d)" stroke-width="18"/>
      </g>
    </svg>

    <div class="tl">%s</div>
    %s
    <div class="tr">%s</div>
    <div class="mr">
      <span class="chip on du">%d<em>/</em>%d<u>D</u></span>
      <span class="chip sm">%d<em>/</em>%d<u>R</u></span>
    </div>
    <div class="name">%s</div>
    <div class="stats"><div class="lb">%s</div><div class="nb">%s</div></div>
    %s
    <div class="chem">%s</div>
    <img class="ul" src="%s">
  </div>
  <div class="cap">Rango %s · #%d de %d · Score %s</div>
</div>""" % (clase_nombre(c['raw']), acc, base, TAG_CORONA(c), foto, TEMPORADA, VW, VH, i, stops, i, OUT, i,
       OUT, acc, OUT, OUT, i,
       BLOQUE_TL(c), rb, BLOQUE_TR(c),
       c['duel_v'], c['duel_t'], c['rch_act'], c['rch_max'], c['raw'].upper(), lbls, nums,
       TAG_ABAJO(c), fila_abajo(c), UL,
       rg, c['pos'], c['total'], c['score'])

# ⚠️ CONTRA EL POOL ENTERO, NO CONTRA LO QUE SE ESTA DIBUJANDO. Lo tenia
# calculado sobre `C`, y `C` es lo que haya en comp.json: ocho personas al
# correr el script suelto y UNA cuando exportar_png.py lo pisa con la persona
# pedida. O sea que el puesto en la crew cambiaba segun cuanta gente se
# dibujaba, y con una sola Follombia tenia "1 miembro" y caia por el umbral de
# 3. Un puesto se mide contra su grupo COMPLETO, siempre; es la misma razon
# por la que el builder lo calcula sobre las 138.
try:
    with open(_r('..', 'datos', 'competitivo_pool.json'), encoding='utf-8') as _f:
        _POOL = json.load(_f)
except Exception:
    _POOL = C
_PUESTO_CREW.update({k: ('%d/%d' % (pos, tot)) if pos else ''
                     for k, (_cr, pos, tot) in _CW.puestos(_POOL).items()})
if _FALTAN_EV:
    # ⚠️ NUNCA EN SILENCIO. Un evento que no carga se lleva puestos los rombos
    # de todos sus participantes, y la carta sale igual de valida.
    print('AVISO: %d evento(s) sin icono, sus rombos NO se dibujan:' % len(_FALTAN_EV))
    for _k, _ic in _FALTAN_EV:
        print('   %-22s %s' % (_k, _ic))
cards = ''.join(card(c,i) for i,c in enumerate(C))
CSS = open(_osruta.path.join(CARD, 'card.css'), encoding='utf-8').read().replace('__OUT__', OUT)
html = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Tarjeta Competitiva</title><style>%s</style></head><body>
<h1>Tarjeta COMPETITIVA</h1>
<p class="sub">Sin TAG · con duelos · el nombre recupera tamaño · el número grande es el <b>Score</b> · el rango en pastilla · a la derecha puesto y win rate</p>
<div class="rack">%s</div>
<div class="ley"><b>EFI</b> eficiencia · <b>CON</b> consistencia · <b>DOM</b> dominancia ·
<b>RCH</b> racha · <b>DIV</b> diversidad · <b>EVT</b> eventos<br>
Derecha: puesto competitivo · Score &nbsp;|&nbsp; R de racha · actual/máxima<br>
Abajo: bandera · temporada · servidor</div>
</body></html>""" % (CSS, cards)
_osruta.makedirs(_r('salida'), exist_ok=True) or open(_r('salida', 'tarjeta_competitiva.html'),'w',encoding='utf-8').write(html)
print("generado")

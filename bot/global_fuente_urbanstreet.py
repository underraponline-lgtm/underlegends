# -*- coding: utf-8 -*-
"""🗞️ URBAN STREET (urbanstreet.com.pe): LAS LLAVES QUE LA PRENSA DE FREESTYLE PUBLICA COMO TEXTO, PARA EL RANKING GLOBAL.

    python bot/global_fuente_urbanstreet.py --ver     lee en vivo y muestra un resumen (notas, eventos, batallas, avisos)
    python bot/global_fuente_urbanstreet.py --auto    self-check sin red, con bot/global_casos/urbanstreet_*.json
    python bot/global_fuente_urbanstreet.py --casos   vuelve a bajar los casos y los recorta (cuando cambie el sitio)

`leer(desde, hasta, red)` devuelve `{'batallas': [...], 'mvp': [], 'avisos': [...]}`. Lo que vale de esta fuente es el
under: las regionales y nacionales de Red Bull, el Torneo de Plazas, Supremacía, las ligas de Venezuela, las finales de
plaza y sus campeones, que el sitio publica como texto 1 a 3 días después de cada evento.

🔑 SE LEE LA API DE WORDPRESS, ABIERTA (`/wp-json/wp/v2/posts`; robots.txt no la bloquea). Dos pasos: la lista de notas
en la ventana (`after=`, 100 por página, sólo id, fecha, título y categorías: unos 20 KB cada una) y, de las que por el
título traen resultados, el texto en un solo pedido (`include=`). Unos 7 pedidos por semana, uno por segundo.

🔑 FMS NO SE LEE ACÁ (lo trae su lector desde fms.tv: contaría dos veces), tampoco la World Cup de FMS. La Liga Bazooka
y las «escritas» son batallas escritas, no improvisadas. Exhibiciones, «contra todos», 2vs2, duplas y triples, afuera.
Todo lo que se salta se nombra en los avisos.

🔑 LO QUE EL TEXTO NO DICE, NO SE INVENTA. El ganador sale de lo que la nota dice («le ganó a», «venció a», «cayó ante»,
«Ganador: X», una tabla con su columna de ganador, el podio). Si no lo dice y la llave muestra quién pasó de ronda, se
deduce y se avisa; si tampoco, `gana` queda en None.

⚠️ SÓLO LAS FRASES QUE ARRANCAN UNA LÍNEA (o un rótulo «Octavos de final:», o una negrita). Las notas mezclan el evento
con la historia de cada uno («en enero ganó la Final Nacional ante JC Snake»): esas frases van en medio de un párrafo y
casi nunca empiezan por el nombre, así que no entran.

⚠️ DOS NOTAS DEL MISMO EVENTO SE JUNTAN (la de resultados y la del campeón): mismo día ±1 (±3 si una no dice la fecha) y
el mismo nombre o una batalla en común. Y A VECES SE CONTRADICEN: las dos de Verso Final 2026 traen cuadros distintos.
Quien aparece dos veces en la misma ronda tira esas batallas (las dos versiones) y se avisa: es preferible perder una
batalla que contar una que no pasó.

⚠️ LA RONDA SÓLO SI LA NOTA LA NOMBRA («Octavos de final», la columna «Cuartos 2», «en la gran final»). El orden de una
lista no alcanza: la tabla del camino de KG en Supremacía 2026 pone a Viti antes que a Flama y el canal de Supremacía
los tiene al revés. Una jornada de liga (Venezuela) no tiene ronda: va en None. Y ojo, global_ranking junta dos fuentes
por par Y ronda, así que una batalla sin ronda acá no se junta con la misma de YouTube o Freestylestats: se avisa.

⚠️ EN LA DUDA, DOS PERFILES: el id es el nombre (`us:<clave>`), y si el mismo nombre trae dos países, van separados.
"""
import datetime as dt
import html as _html
import io
import json
import os
import re
import sys
import time
import unicodedata
from html.parser import HTMLParser

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
for _p in (SCR, BASE):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from comun import claves  # noqa: E402

SITIO = 'https://urbanstreet.com.pe'
API = '/wp-json/wp/v2/posts'
CABECERAS = {'User-Agent': 'Mozilla/5.0 (compatible; ranking-bot/1.0)'}
CASOS = os.path.join(SCR, 'global_casos')
PAUSA = 1.0          # ~1 pedido por segundo
ESPERA = 30          # timeout de cada pedido
POR_PAGINA = 100     # el tope de WordPress
MAX_PAGINAS = 20     # 2.000 notas: una temporada entera con margen
DESPUES = 4          # la nota de un evento del último día de la ventana puede salir hasta 4 días después
ANTES = 10           # una fecha del texto es la del evento si cae hasta 10 días antes de la nota
JUNTAS = 1           # dos notas son del mismo evento si sus fechas están a esto o menos…
JUNTAS_SIN_FECHA = 3  # …o a esto, si una usa la fecha de la nota porque el texto no la dice

# Las categorías de FMS y de la Liga Bazooka. Si cambian de número, igual las agarra el título (`_FMS`, `_ESCRITAS`).
CAT_FMS = {513, 5985, 5986, 5987, 5988, 5989, 5990, 5991, 5992, 5993, 5994}
CAT_ESCRITAS = {5995}
# Perfiles, guías y polémicas: hablan de la historia de alguien, no de un evento de esa semana
CAT_PERFIL = {4, 283, 6003, 6004, 6005, 6006}

RONDAS = ('filtro', '32avos', '16avos', 'octavos', 'cuartos', 'semifinal', 'tercer', 'final')
ORDEN = ('filtro', '32avos', '16avos', 'octavos', 'cuartos', 'semifinal', 'final')

# ── el título: qué notas se piden ────────────────────────────────────────────────────────────────────────────────────
# «campeón» sí, «campeones» no: «Batalla de Campeones» es el nombre de un evento que todavía no se jugó
_RESULTADO = re.compile(r'resultad|campe[oó]n\b|campeona\b|se coron|se consagr|conquista|\bgan[aó]\b|\bvence\b|venci[oó]|'
                        r'derrot|ganador|podio|cuadro completo|\bllaves?\b', re.I)
# lo que sí o sí habla de un resultado: un perfil sólo se lee si su título dice esto
_RESULTADO_FUERTE = re.compile(r'resultados|vence a|venci[oó] a|derrot[aó] a|se coron|se consagr', re.I)
_PREVIA = re.compile(r'\bhoy\b|d[oó]nde ver|en vivo|predicci|horario|confirmad|line-?up|cartelera|participantes|'
                     r'qui[eé]n ganar|jurados?\b|\bhosts?\b|entradas|t[ií]tulos|trofeos|estad[ií]stica|historia|legado|'
                     r'trayectoria|qui[eé]n es\b|rivalidad|todos los campeones|lista actualizada|apunta a|chatgpt|'
                     r'\bia\b|ranking|elegid[oa]|favorit[oa]|cuestiona|pol[eé]mica|rumor|'
                     r'¿\s*(?:habr|qui[eé]n\s+ser|qui[eé]n\s+ganar|podr)|ser[aá]\s+el\s+campe', re.I)
_FMS = re.compile(r'\bfms\b|freestyle world cup|world cup de freestyle|fms world', re.I)
_ESCRITAS = re.compile(r'bazooka|escritas?\b', re.I)
_EXHIB = re.compile(r'exhibici[oó]n|contra todos|showcase', re.I)
_EQUIPOS = re.compile(r'\b[234]\s?vs\.?\s?[234]\b|\bduplas?\b|\bparejas\b|\btriples?\b|\btr[ií]os\b|por equipos|'
                      r'\b[23]x[23]\b', re.I)
_OTRO = re.compile(r'dance your style|breaking|break ?dance|beatbox|campo de marte|skate|graffiti|b-?boy|boxeo|'
                   r'f[uú]tbol|grammy|\bnba\b|\bnfl\b|gta|\bufc\b|apost|us\$|d[oó]lares|millones|billboard|[aá]lbum|'
                   r'canci[oó]n|concierto', re.I)

# ── texto ────────────────────────────────────────────────────────────────────────────────────────────────────────────
_BANDERA = re.compile('[\U0001F1E6-\U0001F1FF]{2}')
_PAISES = {
    'argentina': 'ar', 'bolivia': 'bo', 'chile': 'cl', 'colombia': 'co', 'costa rica': 'cr', 'cuba': 'cu',
    'ecuador': 'ec', 'el salvador': 'sv', 'espana': 'es', 'estados unidos': 'us', 'guatemala': 'gt',
    'honduras': 'hn', 'mexico': 'mx', 'nicaragua': 'ni', 'panama': 'pa', 'paraguay': 'py', 'peru': 'pe',
    'puerto rico': 'pr', 'republica dominicana': 'do', 'uruguay': 'uy', 'venezuela': 've', 'brasil': 'br',
}
_PAIS_RE = re.compile(r'\b(%s)\b' % '|'.join(sorted(_PAISES, key=len, reverse=True)))
_MESES = {'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
          'septiembre': 9, 'setiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12}
_FECHA = re.compile(r'(\d{1,2})\s+de\s+(%s)(?:\s+(?:de|del)\s+(\d{4}))?' % '|'.join(_MESES))


def _plano(s):
    """Sin tildes y en minúsculas, CON EL MISMO LARGO: una posición hallada acá vale en el texto original."""
    out = []
    for c in str(s or ''):
        b = unicodedata.normalize('NFD', c)[0]
        lo = b.lower()
        out.append(lo[0] if len(lo) == 1 else b)
    return ''.join(out)


def _iso(bandera):
    return ''.join(chr(ord(c) - 0x1F1E6 + 97) for c in bandera)


def _pais_de(texto):
    """«Perú», «(Costa Rica)», «🇨🇱» → ISO-2; cualquier otra cosa, None."""
    m = _BANDERA.search(texto or '')
    if m:
        return _iso(m.group(0))
    m = _PAIS_RE.search(_plano(texto))
    return _PAISES[m.group(1)] if m else None


# ── el nombre de un rapero ───────────────────────────────────────────────────────────────────────────────────────────
# Mayúscula o número al principio («99», «1Tobi», «R16», «Valles-T»); hasta cuatro palabras, con «de/del/la/el/en» sólo
# si la que sigue también empieza con mayúscula («El Demonio en Bici», pero no «Vuscooh en la gran final»).
_TOK = r"[A-ZÀ-ÖØ-Þ0-9][\wÀ-ÿ'’\-]*(?:\.[\wÀ-ÿ]+)*"
NOMBRE = r"%s(?:[ \t]+(?:(?:de|del|la|el|en|los|las)[ \t]+)?%s){0,3}" % (_TOK, _TOK)
_FLAG = r"(?:[ \t]*[\U0001F1E6-\U0001F1FF]{2})?"
_PALABRAS_NO = {'el', 'la', 'los', 'las', 'un', 'una', 'con', 'en', 'por', 'tras', 'su', 'sus', 'este', 'esta', 'ese',
                'esa', 'asi', 'ahora', 'luego', 'despues', 'mientras', 'ademas', 'sin', 'al', 'del', 'de', 'y', 'pero',
                'finalmente', 'ambos', 'nadie', 'quien', 'el', 'ella', 'cada', 'otro', 'otra', 'todos', 'hoy', 'ayer',
                'mc', 'ronda', 'batalla', 'final', 'gran', 'octavos', 'cuartos', 'semifinal', 'semifinales'}
# lo que ocupa el lugar de alguien que todavía no tiene nombre («Cupo DEM», «Ganador de…»)
_HUECO = re.compile(r'^(?:cupo|clasificad[oa]|por definir|tbd|rival|ganador|perdedor|bye|invitad[oa]|libre)\b', re.I)


def _limpio(nombre):
    """(nombre, país): sin banderas, sin «(Perú)», sin negritas ni puntuación de más."""
    s = str(nombre or '')
    pais = None
    m = _BANDERA.search(s)
    if m:
        pais = _iso(m.group(0))
    s = _BANDERA.sub('', s)
    m = re.search(r'\(([^)]*)\)', s)
    if m:
        p2 = _pais_de(m.group(1))
        if p2:
            pais = pais or p2
        s = s[:m.start()] + s[m.end():]
    s = re.sub(r'\s+', ' ', s.replace('*', '')).strip(' .,:;!¡?¿-–—"«»“”')
    return s, pais


def _es_nombre(s):
    t = _plano(s).split()
    if not t or len(t) > 4:
        return False
    if any(re.fullmatch(r'(?:19|20)\d\d', w) for w in t):
        return False        # «Nueva Historia 2025» es un evento, no alguien
    if t[0] in _PALABRAS_NO and len(t) == 1:
        return False
    return any(c.isalnum() for c in s)


# ── las rondas ───────────────────────────────────────────────────────────────────────────────────────────────────────
_RONDA_RE = re.compile(
    r'(?P<tercer>(?:batalla\s+(?:por|del)\s+(?:el\s+)?)?(?:tercer(?:o)?|3er|3ro|3\.?\s*[ºo°])\s+(?:y\s+cuarto\s+)?'
    r'(?:puesto|lugar))'
    r'|(?P<semifinal>\bsemi[\s-]?finales\b|\bsemi[\s-]?final\b|\bsemis\b)'
    r'|(?P<cuartos>\bcuartos(?:\s+de\s+final)?\b|\b4tos\b)'
    r'|(?P<octavos>\boctavos(?:\s+de\s+final)?\b|\b8vos\b)'
    r'|(?P<d16>\bdieciseisavos(?:\s+de\s+final)?\b|\b16avos\b|\b16vos\b)'
    r'|(?P<d32>\btreintaidosavos\b|\b32avos\b)'
    r'|(?P<filtro>\bfiltros?\b|\bpreliminar(?:es)?\b|\brepechaje\b)'
    r'|(?P<final>\b(?:gran\s+)?final\b(?!\s+(?:nacional|internacional|regional|mundial))(?!istas?))')
_RONDA_NOMBRE = {'d16': '16avos', 'd32': '32avos'}


def _ronda_en(texto, desde=0):
    """`(ronda, inicio, fin)` de la primera ronda nombrada en el texto, o `(None, None, None)`."""
    for m in _RONDA_RE.finditer(_plano(texto), desde):
        antes = _plano(texto)[max(0, m.start() - 5):m.start()]
        if re.search(r'\b(?:una|otra|esa)\s$', antes):
            continue                                          # «una final con sabor a revancha» no es la final
        k = m.lastgroup
        return _RONDA_NOMBRE.get(k, k), m.start(), m.end()
    return None, None, None


# ── el HTML, a bloques ───────────────────────────────────────────────────────────────────────────────────────────────
class _Bloques(HTMLParser):
    """La nota como una lista de bloques: cada párrafo, ítem, título y fila de tabla, con sus negritas.

    ⚠️ Lo que está suelto adentro de un `<div>` no es un bloque: es el cartel de «HOY» que el sitio pega arriba de la
    nota («Arranca FMS Argentina: Mecha vs Dybbuk»), que si no se colaría como una batalla del evento.
    """
    BLOQUE = {'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'dt', 'dd'}
    FUERA = {'script', 'style', 'blockquote', 'figcaption', 'iframe', 'noscript', 'svg', 'button', 'form'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.bloques = []
        self.fuera = 0
        self.tipo = None
        self.t, self.neg, self.ini, self.nb = '', [], None, 0
        self.fila, self.celda, self.tabla, self.thead = None, None, 0, False

    def _abrir(self, tipo):
        self.tipo, self.t, self.neg, self.ini, self.nb = tipo, '', [], None, 0

    def _empaquetar(self):
        t = self.t
        if self.ini is not None:
            self.neg.append((self.ini, len(t)))
        lead = len(t) - len(t.lstrip())
        txt = t.strip()
        neg = []
        for a, b in self.neg:
            a, b = max(0, a - lead), min(len(txt), b - lead)
            while a < b and txt[a] == ' ':
                a += 1
            while b > a and txt[b - 1] == ' ':
                b -= 1
            if b > a:
                neg.append((a, b))
        return {'t': txt, 'neg': neg}

    def _cerrar(self):
        if self.tipo and self.celda is None:
            b = self._empaquetar()
            if b['t']:
                b['tipo'] = self.tipo
                self.bloques.append(b)
        self.tipo = None
        self.t, self.neg, self.ini, self.nb = '', [], None, 0

    def handle_starttag(self, tag, attrs):
        if tag in self.FUERA:
            self.fuera += 1
            return
        if self.fuera:
            return
        if tag == 'table':
            self._cerrar()
            self.tabla += 1
        elif tag == 'thead':
            self.thead = True
        elif tag == 'tr':
            self.fila = {'tipo': 'fila', 'celdas': [], 'cab': self.thead, 'tabla': self.tabla}
        elif tag in ('td', 'th') and self.fila is not None:
            self.celda = tag
            self.t, self.neg, self.ini, self.nb = '', [], None, 0
        elif tag in self.BLOQUE and self.celda is None:
            self._cerrar()
            self._abrir('h' if tag[0] == 'h' else tag)
        elif tag == 'br':
            if self.celda is not None:
                self.t += ' '
            elif self.tipo:
                tipo = self.tipo
                self._cerrar()       # una línea por <br>: los cuadros vienen así, «Octavos<br>A le ganó a B<br>…»
                self._abrir(tipo)
        elif tag in ('strong', 'b'):
            self.nb += 1
            if self.nb == 1:
                self.ini = len(self.t)

    def handle_endtag(self, tag):
        if tag in self.FUERA:
            self.fuera = max(0, self.fuera - 1)
            return
        if self.fuera:
            return
        if tag in ('strong', 'b') and self.nb:
            self.nb -= 1
            if self.nb == 0 and self.ini is not None:
                self.neg.append((self.ini, len(self.t)))
                self.ini = None
        elif tag in ('td', 'th') and self.celda is not None and self.fila is not None:
            c = self._empaquetar()
            c['th'] = self.celda == 'th'
            self.fila['celdas'].append(c)
            self.celda = None
            self.t, self.neg, self.ini, self.nb = '', [], None, 0
        elif tag == 'tr' and self.fila is not None:
            if any(c['t'] for c in self.fila['celdas']):
                self.fila['t'] = ' | '.join(c['t'] for c in self.fila['celdas'])
                self.bloques.append(self.fila)
            self.fila = None
        elif tag == 'thead':
            self.thead = False
        elif tag in self.BLOQUE and self.celda is None:
            self._cerrar()

    def handle_data(self, data):
        if self.fuera or (self.tipo is None and self.celda is None):
            return
        d = re.sub(r'\s+', ' ', data.replace('\xa0', ' '))
        if self.t.endswith(' ') and d.startswith(' '):
            d = d[1:]
        self.t += d


def bloques(contenido, titulo=''):
    p = _Bloques()
    p.feed(contenido or '')
    p.close()
    p._cerrar()
    out = [{'tipo': 'titulo', 't': _html.unescape(re.sub(r'<[^>]+>', '', titulo or '')).strip(), 'neg': []}]
    return out + p.bloques


# ── lo que dice cada frase ───────────────────────────────────────────────────────────────────────────────────────────
_V_GANA = (r"(?:le\s+)?(?:gan[óo]|gana|venci[óo]|vence|derrot[óo]|derrota|super[óo]|supera|elimin[óo]|elimina|"
           r"fren[óo]|frena|dobleg[óo]|doblega|despach[óo]|despacha|se\s+impus[oó]|se\s+impone|"
           r"dej[óo]\s+(?:fuera|en\s+el\s+camino)|gan[óo]\s+la\s+(?:gran\s+)?final|gana\s+la\s+(?:gran\s+)?final)")
_V_PIERDE = (r"(?:cay[óo]|cae|perdi[óo]|pierde|sucumbi[óo]|sucumbe|(?:qued[óo]|queda|fue|result[óo])\s+eliminad[oa])"
             r"(?:\s+eliminad[oa])?")
_MARCADOR = r"(?:\s+(?:por\s+)?\(?(?P<v1>[0-7])\s*[-–]\s*(?P<v2>[0-7])\)?)?"
_RE_GANA = re.compile(r"(?P<a>%s)(?P<fa>%s)\s+(?i:%s)%s\s+(?i:a(?:l)?|ante|sobre|contra)\s+(?P<b>%s)(?P<fb>%s)"
                      % (NOMBRE, _FLAG, _V_GANA, _MARCADOR, NOMBRE, _FLAG))
_RE_PIERDE = re.compile(r"(?P<b>%s)(?P<fb>%s)\s+(?i:%s)%s\s+(?i:ante|frente\s+a|contra|con|a\s+manos\s+de|por)\s+"
                        r"(?P<a>%s)(?P<fa>%s)" % (NOMBRE, _FLAG, _V_PIERDE, _MARCADOR, NOMBRE, _FLAG))
_RE_VS = re.compile(r"(?P<a>%s)(?P<fa>%s)\s+(?:vs\.?|VS\.?|Vs\.?|versus)\s+(?P<b>%s)(?P<fb>%s)"
                    % (NOMBRE, _FLAG, NOMBRE, _FLAG))
_RE_SCORE = re.compile(r"(?P<a>%s)(?P<fa>%s)\s+(?P<v1>[0-7])\s*[-–]\s*(?P<v2>[0-7])\s+(?P<b>%s)(?P<fb>%s)"
                       % (NOMBRE, _FLAG, NOMBRE, _FLAG))
# lo que sigue a «A vs B» y dice quién ganó: «— victoria de A», «→ A», «: gana A», «Ganador: A»
_RE_COLA = re.compile(r"\s*(?:[—–\-:|,(]+\s*)?(?:victoria\s+(?:de|para)|gan[óoa]|ganador(?:a)?\s*:?|campe[oó]n(?:a)?\s*:?|"
                      r"avanz[óoa]|pas[óoa])\s+(?P<g>%s)|\s*(?:→|->|=>)\s*(?P<g2>%s)" % (NOMBRE, NOMBRE))
_RE_GANADOR = re.compile(r"(?i:ganador(?:a)?)\s*:\s*(?P<g>%s)(?P<resto>.*)" % NOMBRE)
_RE_JUEZ = re.compile(r"(?P<j>%s)\s*:\s*\d+(?:[.,]\d+)?\s*[-–]\s*\d+(?:[.,]\d+)?\s*,?\s*(?:para\s+(?P<g>%s)|"
                      r"(?P<r>r[eé]plica))" % (NOMBRE, NOMBRE))
_RE_PODIO = re.compile(r"(?P<k>(?i:campe[oó]n(?:a)?|subcampe[oó]n(?:a)?|tercer(?:o)?\s+(?:puesto|lugar)|"
                       r"[123]\s*\.?\s*[ºo°]?\s*(?:lugar|puesto)|segundo\s+(?:lugar|puesto)|finalistas?))\s*:\s*"
                       r"(?P<n>%s)%s(?:\s*\([^)]*\))?(?:\s+y\s+(?P<n2>%s)%s)?\s*(?P<resto>.*)$"
                       % (NOMBRE, _FLAG, NOMBRE, _FLAG))
_RE_CAMPEON = re.compile(
    r"(?P<n>%s)(?P<fn>%s)\s*,?\s+(?P<v>(?:se\s+)?(?:consagr|coron|proclam)\w*\s+(?:como\s+)?|(?:es|fue)\s+|)"
    r"(?:el\s+|la\s+)?(?:nuev[oa]\s+)?(?:bi|tri|tetra)?campe[oó]n(?:a)?\b(?P<resto>.*)" % (NOMBRE, _FLAG))
_RE_EL_CAMPEON = re.compile(r"(?i:el\s+campe[oó]n)\b[^.]{0,60}?\s(?:fue|es)\s+(?:el\s+)?(?P<n>%s)" % NOMBRE)
_RE_SUB = re.compile(r"(?P<n>%s)%s\s+(?:se\s+qued[óo]\s+con\s+el\s+subcampeonato|termin[óo]\s+como\s+subcampe[oó]n|"
                     r"(?:es|fue)\s+(?:el\s+)?subcampe[oó]n)" % (NOMBRE, _FLAG))
_RE_TERCERO = re.compile(r"(?P<n>%s)%s\s+se\s+qued[óo]\s+con\s+"
                         r"(?:la\s+tercera\s+posici[oó]n|el\s+tercer\s+(?:puesto|lugar))"
                         % (NOMBRE, _FLAG))
# después de «X se coronó campeón…»: «tras vencer a Y en la gran final», «tras una gran final ante Y»
_RE_TRAS = re.compile(r"(?:tras|despu[eé]s\s+de|luego\s+de|al)\s+"
                      r"(?:(?:vencer|derrotar|superar|imponerse|ganarle|ganar)\s+(?:a|ante)"
                      r"(?:l)?|una\s+(?:gran\s+)?final\s+(?:ante|contra|frente\s+a))\s+(?:(?:[a-zñáéíóú]+)\s+){0,2}"
                      r"(?P<n>%s)" % NOMBRE)
# el camino del campeón en una línea: «venció a BTI, 99, Nitro y Anubis»
_RE_CAMINO = re.compile(r"(?i:venci[óo]|derrot[óo]|super[óo]|victorias?\s+(?:frente\s+a|ante|sobre|contra))\s+(?:a\s+)?"
                        r"(?P<l>%s(?:\s*,\s*%s){1,5}\s+y\s+(?:a\s+)?%s)" % (NOMBRE, NOMBRE, NOMBRE))
_RE_REPLICA = re.compile(r'tras\s+r[eé]plica|con\s+r[eé]plica|en\s+(?:la\s+)?r[eé]plica', re.I)


def _inicios(t, neg):
    """Dónde puede empezar una frase que cuenta: la línea, tras un rótulo con dos puntos, una negrita, un punto."""
    pos = {0}
    for m in re.finditer(r':\s+', t):
        pos.add(m.end())
    for a, _ in neg:
        pos.add(a)
    for m in re.finditer(r'[.!?]\s+(?=[A-ZÀ-Þ0-9*])', t):
        pos.add(m.end())
    out = []
    for p in sorted(pos):
        while p < len(t) and not (t[p].isalnum()):
            p += 1          # emojis, viñetas, comillas
        if p < len(t):
            out.append(p)
    return sorted(set(out))


def _lado_de(txt, a, b):
    """'a' o 'b' según a quién nombra `txt` («Lou T», «Luca tras réplica», «Lancer» por «Lancer Lirical»)."""
    k = claves.clave(_limpio(re.sub(_RE_REPLICA, '', txt or ''))[0])
    ka, kb = claves.clave(a), claves.clave(b)
    if not k or k == 'sinnombre':
        return None
    if k == ka and k != kb:
        return 'a'
    if k == kb and k != ka:
        return 'b'
    pa = len(k) >= 3 and (ka.startswith(k) or k.startswith(ka))
    pb = len(k) >= 3 and (kb.startswith(k) or k.startswith(kb))
    if pa != pb:
        return 'a' if pa else 'b'
    return None


def _ronda_titular(t):
    """La ronda de un título de sección, si la nombra al principio («Cuartos de final: …», «Resultados de octavos…»).
    Una que aparece al final («Mecha elimina a Teorema y consigue el pase a la final») habla de lo que viene."""
    r, ini, _ = _ronda_en(t)
    if r is None:
        return None
    if ini <= 4 or re.match(r'\W*(?:los\s+)?resultados?\s+(?:de\s+|del\s+)?(?:la\s+|los\s+|las\s+)?$', _plano(t)[:ini]):
        return r
    return None


def _ronda_cerca(t, fin):
    """«… vence a Horus en la Gran Final de …»: la ronda que nombra lo que sigue a la batalla."""
    m = re.match(r'[^.;]{0,6}?\s*en\s+(?:la\s+|los\s+|las\s+)?', t[fin:fin + 40])
    if not m:
        return None
    r, ini, _ = _ronda_en(t[fin + m.end():fin + m.end() + 30])
    return r if ini == 0 else None


def _es_titular(b):
    """Un título de sección: un h2/h3, o una línea corta toda en negrita («Octavos de Final»)."""
    if b['tipo'] in ('h', 'titulo'):
        return True
    t = b['t']
    if b['tipo'] in ('p', 'li') and len(t) <= 120 and b['neg']:
        en_negrita = sum(y - x for x, y in b['neg'])
        if en_negrita >= len(t.replace(' ', '')) * 0.9:
            return True
    return b['tipo'] in ('p', 'li') and len(t) <= 40 and _ronda_en(t)[1] == 0


# ── una nota ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def _fecha_de(texto, base):
    """Las fechas del texto: «sábado 24 de octubre de 2026», «este 26 de septiembre» (el año, el de la nota)."""
    out = []
    for m in _FECHA.finditer(_plano(texto)):
        anio = int(m.group(3)) if m.group(3) else base.year
        try:
            d = dt.date(anio, _MESES[m.group(2)], int(m.group(1)))
        except ValueError:
            continue
        if not m.group(3) and d > base + dt.timedelta(days=3):
            d = d.replace(year=d.year - 1)    # «28 de diciembre» en una nota de enero
        out.append(d)
    return out


def leer_nota(post):
    """Una nota → lo que dice: batallas, podio, fecha, nombre del evento y lo que no entró. Sin red."""
    titulo = _html.unescape(re.sub(r'<[^>]+>', '', (post.get('title') or {}).get('rendered') or '')).strip()
    contenido = (post.get('content') or {}).get('rendered') or ''
    dia_nota = dt.date.fromisoformat(str(post.get('date'))[:10])
    bl = bloques(contenido, titulo)
    nota = {'id': post['id'], 'url': post.get('link') or '', 'titulo': titulo, 'dia_nota': dia_nota,
            'batallas': [], 'podio': {}, 'campeones': [], 'exhib': set(), 'equipos': 0, 'huecos': [],
            'fecha': None, 'fecha_de': 'nota', 'avisos': []}
    bats = nota['batallas']
    seccion = None
    ultimo = None
    fechas_rotulo, fechas = [], []

    def par(b):
        return frozenset((claves.clave(b['a'][0]), claves.clave(b['b'][0])))

    def nueva(a, b, gana, ronda, r_src, votos=None, replica=None, g_src='texto'):
        (na, pa), (nb, pb) = _limpio(a), _limpio(b)
        if not (_es_nombre(na) and _es_nombre(nb)) or claves.clave(na) == claves.clave(nb):
            return None
        for n in (na, nb):
            if _HUECO.match(n):
                nota['huecos'].append('%s vs %s' % (na, nb))
                return None
        x = {'a': (na, pa), 'b': (nb, pb), 'gana': gana, 'g_src': g_src if gana else None, 'ronda': ronda,
             'r_src': r_src if ronda else None, 'votos': votos, 'replica': replica, 'nota': post['id'],
             'url': nota['url'], 'n': len(bats)}
        for y in bats:      # la misma batalla dos veces en la nota (la sección y el «resumen» del final)
            if par(y) == par(x):
                _juntar(y, x, nota['avisos'], titulo)
                return y
        bats.append(x)
        return x

    def campeon(n, peso, pais=None):
        nn, pp = _limpio(n)
        if _es_nombre(nn):
            nota['campeones'].append((peso, nn, pais or pp))
            if pais or pp:
                nota.setdefault('paises', {})[claves.clave(nn)] = pais or pp    # «Campeón | KG (Perú)»

    for i, b in enumerate(bl):
        t = b['t']
        pl = _plano(t)
        titular = _es_titular(b)
        if b['tipo'] == 'fila':
            _fila(b, bl, i, nota, nueva, seccion, fechas_rotulo, campeon)
            continue
        # la fecha: primero la del rótulo («Fecha: sábado 24 de octubre de 2026»), si no la que el texto nombre
        if re.match(r'\W*fecha\s*:', pl):
            fechas_rotulo += _fecha_de(t, dia_nota)
        else:
            fechas += _fecha_de(t, dia_nota)
        if titular:
            seccion = _ronda_titular(t)
            if seccion:
                ultimo = None    # «Votación de los jueces» es un subtítulo de la misma batalla; una ronda nueva, no
        hubo = False
        vistos = []
        for p0 in _inicios(t, b['neg']):
            if any(a <= p0 < z for a, z in vistos):
                continue
            resto = t[p0:]
            antes = t[:p0]
            # el rótulo de la ronda pegado adelante: «Octavos de final: Jotaka supera a Deco»
            r_rot = None
            mr = re.search(r'([^:]{1,40}):\s*$', antes)
            if mr:
                rr, ini, _ = _ronda_en(mr.group(1))
                if rr and ini is not None and ini <= 3:
                    r_rot = rr
            # el podio: «Campeón: Draker», «Tercer puesto: Erreka», «Finalistas: Elemece y Rodamiento»
            m = _RE_PODIO.match(resto)
            if m and not _RE_GANA.match(m.group('resto') or '') and not re.match(r'\s*(?:vs\.?|vence|venci|derrot)',
                                                                                    m.group('resto') or '', re.I):
                k = _plano(m.group('k'))
                if k.startswith('final'):
                    if m.group('n2'):
                        nota['podio'].setdefault('finalistas', (_limpio(m.group('n'))[0], _limpio(m.group('n2'))[0]))
                elif k.startswith('sub') or k.startswith('2') or k.startswith('segundo'):
                    nota['podio'].setdefault('sub', _limpio(m.group('n'))[0])
                elif k.startswith('ter') or k.startswith('3'):
                    nota['podio'].setdefault('tercero', _limpio(m.group('n'))[0])
                else:
                    campeon(m.group('n'), 3 if titular else 2, _pais_de(m.group(0)))
                vistos.append((p0, p0 + m.end()))
                continue
            # «Ganador: Reilly (+3 puntos)» y «Horus: 74.5-74, réplica»: de la batalla de esta sección
            m = _RE_GANADOR.match(resto)
            if m and ultimo is not None:
                g = _lado_de(m.group('g'), ultimo['a'][0], ultimo['b'][0])
                if g:
                    _juntar(ultimo, {'a': ultimo['a'], 'b': ultimo['b'], 'gana': g, 'g_src': 'texto', 'ronda': None,
                                     'r_src': None, 'votos': None,
                                     'replica': True if _RE_REPLICA.search(m.group('resto')) else None},
                            nota['avisos'], titulo)
                    vistos.append((p0, p0 + m.end()))
                    continue
            m = _RE_JUEZ.match(resto)
            if m and ultimo is not None:
                ultimo.setdefault('jueces', [0, 0, 0])
                if m.group('g'):
                    g = _lado_de(m.group('g'), ultimo['a'][0], ultimo['b'][0])
                    if g:
                        ultimo['jueces']['ab'.index(g)] += 1
                else:
                    ultimo['jueces'][2] += 1
                vistos.append((p0, p0 + m.end()))
                continue
            # «El campeón de la edición fue Mecha», «Mecha se consagró campeón … tras vencer a El Menor en la final»
            m = _RE_EL_CAMPEON.match(resto)
            if m:
                campeon(m.group('n'), 2 if titular else 1)
            m = _RE_CAMPEON.match(resto)
            if m and (m.group('v') or titular) and not re.match(r'\s*(?:nacional|argentino|chileno)?\s*(?:en|de)\s+\d{4}',
                                                                  m.group('resto')):
                if not re.search(r'\b(?:19|20)\d\d\b', m.group('resto')[:6]) or titular:
                    campeon(m.group('n'), 3 if b['tipo'] == 'titulo' else 2 if titular else 1)
                    mt = _RE_TRAS.search(m.group('resto'))
                    if mt and mt.start() < 160:
                        # «tras vencer a Y»: campeón que le gana a alguien es la final; si lo dice, mejor
                        dice = 'final' in _plano(mt.group(0)) or re.match(r'[^.;]{0,25}\bfinal\b',
                                                                          _plano(m.group('resto')[mt.end():]))
                        x = nueva(m.group('n') + (m.group('fn') or ''), mt.group('n'), 'a', 'final',
                                  'texto' if dice else 'deducida')
                        hubo = hubo or bool(x)
                    _camino(m.group('n'), m.group('resto'), nueva)
                    vistos.append((p0, p0 + m.end()))
                    continue
            m = _RE_SUB.match(resto)
            if m:
                nota['podio'].setdefault('sub', _limpio(m.group('n'))[0])
            m = _RE_TERCERO.match(resto)
            if m:
                nota['podio'].setdefault('tercero', _limpio(m.group('n'))[0])
            # las batallas
            x = None
            for rx, quien in ((_RE_GANA, 'a'), (_RE_PIERDE, 'a'), (_RE_SCORE, None), (_RE_VS, None)):
                m = rx.match(resto)
                if not m:
                    continue
                # «A y B vs C y D», «A & B vs C»: no es un 1 contra 1. Con «y» hacen falta los dos lados, porque
                # «Fat N vs. KG y Hammer vs. JM Serna» es una lista de batallas
                despues_ = resto[m.end():]
                junto_antes = re.search(r'%s\s+y\s+$' % _TOK, antes)
                junto_despues = re.match(r'\s+y\s+%s(?!%s*\s+(?:vs|VS|Vs)\b)' % (_TOK, r"[\wÀ-ÿ'’\- ]"), despues_)
                if re.search(r'[&+/]\s*$', antes) or re.match(r'\s*[&+/]\s*\S', despues_) \
                        or (junto_antes and junto_despues):
                    nota['equipos'] += 1
                    vistos.append((p0, p0 + m.end()))
                    break
                fin = m.end()
                v1, v2 = (m.groupdict().get('v1'), m.groupdict().get('v2'))
                votos = sorted([int(v1), int(v2)], reverse=True) if v1 and v2 else None
                gana, g_src = quien, 'texto' if quien else None
                if rx is _RE_SCORE and votos and v1 != v2:
                    votos = [int(v1), int(v2)]
                    gana, g_src = ('a' if votos[0] > votos[1] else 'b'), 'texto'
                elif votos and quien == 'a':
                    votos = [max(votos), min(votos)]
                cola = t[p0 + fin:]
                if rx is _RE_VS:
                    mc = _RE_COLA.match(cola)
                    if mc:
                        g = _lado_de(mc.group('g') or mc.group('g2'), m.group('a'), m.group('b'))
                        if g:
                            gana, g_src = g, 'texto'
                    if not gana:
                        # el ganador en negrita, cuando sólo uno de los dos lo está
                        na, nb = (p0 + m.start('a'), p0 + m.end('a')), (p0 + m.start('b'), p0 + m.end('b'))
                        ena = any(x0 <= na[0] and na[1] <= x1 for x0, x1 in b['neg'])
                        enb = any(x0 <= nb[0] and nb[1] <= x1 for x0, x1 in b['neg'])
                        if ena != enb:
                            gana, g_src = ('a' if ena else 'b'), 'texto'
                    if not (gana or titular or b['tipo'] == 'li' or r_rot or p0 == 0):
                        break     # «A vs B» suelto en medio de un párrafo no es un resultado
                ronda, r_src = r_rot, 'texto'
                if not ronda:
                    ronda = _ronda_cerca(t, p0 + fin)
                if not ronda:
                    ronda, r_src = seccion, 'seccion'
                replica = True if _RE_REPLICA.search(cola[:40]) else None
                x = nueva(m.group('a') + (m.group('fa') or ''), m.group('b') + (m.group('fb') or ''), gana, ronda,
                          r_src, votos, replica, g_src or 'texto')
                vistos.append((p0, p0 + fin))
                # una exhibición lo dice en la misma frase («Chang ganó la exhibición ante Alfabeto»)
                ini_f = max(t.rfind('. ', 0, p0), 0)
                fin_f = t.find('. ', p0 + fin)
                if x is not None and _EXHIB.search(t[ini_f:fin_f if fin_f >= 0 else len(t)]):
                    nota['exhib'].add(par(x))
                break
            if x is not None:
                hubo = True
                if titular or rx is _RE_VS:
                    ultimo = x
        # el camino en una línea suelta: «Su camino hacia el título incluyó victorias frente a A, B, C y D»
        if not hubo and _RE_CAMINO.search(t):
            nota.setdefault('caminos', []).append(t)
    # la fecha del evento
    rango = [d for d in fechas_rotulo if dia_nota - dt.timedelta(days=ANTES) <= d <= dia_nota]
    if rango:
        nota['fecha'], nota['fecha_de'] = max(rango), 'texto'
    else:
        rango = [d for d in fechas if dia_nota - dt.timedelta(days=ANTES) <= d <= dia_nota]
        if rango:
            cuenta = {}
            for d in rango:
                cuenta[d] = cuenta.get(d, 0) + 1
            nota['fecha'] = max(cuenta, key=lambda d: (cuenta[d], d))
            nota['fecha_de'] = 'texto'
        else:
            nota['fecha'] = dia_nota
    # el campeón: el del título manda; si dos se pelean el primer lugar, ninguno
    if nota['campeones']:
        top = max(p for p, _, _ in nota['campeones'])
        nombres = {claves.clave(n): (n, pa) for p, n, pa in nota['campeones'] if p == top}
        if len(nombres) == 1:
            nota['podio']['campeon'] = list(nombres.values())[0][0]
        else:
            nota['avisos'].append('%s: la nota nombra campeones distintos (%s); no uso ninguno'
                                  % (titulo, ', '.join(n for n, _ in nombres.values())))
    for t in nota.get('caminos') or []:
        if nota['podio'].get('campeon'):
            _camino(nota['podio']['campeon'], t, nueva, exige=True)
    # ⚠️ la tabla del camino del campeón NO dice la ronda de cada fila, y su orden no alcanza: la de Supremacía 2026
    # pone a Viti antes que a Flama y el canal de Supremacía los tiene al revés (Flama en octavos, Viti en cuartos).
    # Queda la final, que la tabla marca; el resto, sin ronda
    nota.pop('camino_tabla', None)
    for x in bats:
        j = x.pop('jueces', None)
        if j and x['gana'] and j[0] + j[1] > 0:
            v = [j[0], j[1]]
            if v['ab'.index(x['gana'])] > v[1 - 'ab'.index(x['gana'])]:
                x['votos'] = v            # jueces a favor de cada uno; el que pidió réplica no cuenta para nadie
    return nota


def _camino(campeon, texto, nueva, exige=False):
    """«venció a BTI, 99, Nitro y Anubis»: el camino del campeón termina en la final; las demás quedan sin ronda,
    porque el orden de una lista no la dice (ver la tabla de Supremacía en `leer_nota`).

    ⚠️ Suelta en un párrafo (`exige`), la frase o la anterior tienen que nombrar al campeón: «Su recorrido hasta la
    final incluyó victorias ante Krayzi…» es el del subcampeón, que la nota nombra justo antes.
    """
    m = _RE_CAMINO.search(texto)
    if not m:
        return
    if exige:
        frases = re.split(r'(?<=[.!?])\s+', texto[:m.start()])
        cerca = ' '.join(frases[-2:])
        if claves.clave(campeon) not in claves.clave(cerca) or re.search(r'hasta\s+la\s+final|llegar\s+a\s+la\s+final',
                                                                          _plano(texto[m.start() - 60:m.end()])):
            return
    nombres = [n.strip() for n in re.split(r'\s*,\s*|\s+y\s+(?:a\s+)?', m.group('l')) if n.strip()]
    if not 3 <= len(nombres) <= 6:
        return
    for i, n in enumerate(nombres):
        x = nueva(campeon, n, 'a', 'final' if i == len(nombres) - 1 else None, 'deducida')
        if x is not None and i < len(nombres) - 1:
            x['camino'] = True


def _fila(b, bl, i, nota, nueva, seccion, fechas_rotulo, campeon):
    """Una fila de tabla. Las columnas se entienden por su cabecera («MC 1», «Ganador», «Rival»…) o por su contenido."""
    celdas = b['celdas']
    textos = [c['t'] for c in celdas]
    planos = [_plano(x) for x in textos]
    # la cabecera de esta tabla: la del <thead> o la primera fila toda en negrita con palabras de cabecera
    cab = None
    for j in range(i - 1, -1, -1):
        o = bl[j]
        if o.get('tipo') != 'fila' or o.get('tabla') != b['tabla']:
            break
        if _es_cabecera(o):
            cab = [_rol(c['t']) for c in o['celdas']]
            break
    if _es_cabecera(b):
        return
    # la ficha: «Fecha | Sábado 14 de noviembre de 2026», «Campeón | KG (Perú)»
    if len(celdas) == 2 and not any(' vs' in p for p in planos):
        k = planos[0].strip(' :')
        if k == 'fecha':
            fechas_rotulo += _fecha_de(textos[1], nota['dia_nota'])
            return
        if k in ('campeon', 'campeona', 'ganador', 'ganadora') and not any(cab or []):
            campeon(textos[1], 3, _pais_de(textos[1]))
            return
        if k in ('subcampeon', 'subcampeona'):
            nota['podio'].setdefault('sub', _limpio(textos[1])[0])
            return
        if k.startswith('tercer'):
            nota['podio'].setdefault('tercero', _limpio(textos[1])[0])
            return
    roles = cab or [None] * len(celdas)
    roles = (roles + [None] * len(celdas))[:len(celdas)]
    a = bb = None
    i_par = None
    for j, p in enumerate(planos):
        if re.search(r'\s(?:vs\.?|versus)\s', p):
            lados = re.split(r'\s+(?:vs\.?|VS\.?|Vs\.?|versus)\s+', textos[j], maxsplit=1)
            if len(lados) == 2:
                a, bb, i_par = lados[0], lados[1], j
                break
    if a is None and 'a' in roles and 'b' in roles:
        a, bb = textos[roles.index('a')], textos[roles.index('b')]
    camino = 'rival' in roles and a is None
    ganador_txt = None
    if 'gana' in roles:
        ganador_txt = textos[roles.index('gana')]
    exhib = any('exhibici' in p for p in planos)
    replica = True if any(_RE_REPLICA.search(x) for x in textos) else None
    ronda = None
    for j, p in enumerate(planos):
        if j != i_par and roles[j] not in ('a', 'b', 'gana', 'rival', 'pais'):
            r, ini, _ = _ronda_en(p)
            if r and ini is not None and ini <= 2:
                ronda = r
                break
    if camino:
        # «Rival | País | … | Resultado»: el camino del campeón, «Victoria de KG (final)»
        rival = textos[roles.index('rival')]
        res = ganador_txt or ''
        mg = re.search(r'(?i:victoria\s+(?:de|para))\s+(%s)' % NOMBRE, res)
        if not mg:
            return
        yo = mg.group(1)
        pais_rival = _pais_de(textos[roles.index('pais')]) if 'pais' in roles else None
        x = nueva(yo, rival + (' (%s)' % textos[roles.index('pais')] if pais_rival else ''), 'a',
                  'final' if re.search(r'\(\s*final\s*\)', _plano(res)) else None, 'texto')
        if x is not None:
            nota.setdefault('camino_tabla', []).append(x)
        return
    if a is None or bb is None:
        return
    if _EQUIPOS.search(a + ' ' + bb) or re.search(r'\s+y\s+|[&+/]', _limpio(a)[0] + ' ' + _limpio(bb)[0]):
        nota['equipos'] += 1
        return
    na, nb = _limpio(a)[0], _limpio(bb)[0]
    gana = None
    if ganador_txt is not None:
        g = re.sub(r'(?i)^\s*(?:ganador(?:a)?|campe[oó]n(?:a)?|avanz[óo]|victoria\s+de)\s*:?\s*', '', ganador_txt)
        gana = _lado_de(re.sub(r'\(.*?\)|\+\d.*$', '', g), na, nb)
    if gana is None:
        for j, x in enumerate(textos):
            if j != i_par and roles[j] not in ('a', 'b'):
                g = _lado_de(re.sub(r'(?i)^\s*(?:ganador(?:a)?|campe[oó]n(?:a)?)\s*:?\s*', '', x), na, nb)
                if g:
                    gana = g
                    break
    if gana is None and i_par is not None:
        c = celdas[i_par]
        ka, kb = c['t'].find(na), c['t'].rfind(nb)
        ena = any(x0 <= ka and ka + len(na) <= x1 for x0, x1 in c['neg']) if ka >= 0 else False
        enb = any(x0 <= kb and kb + len(nb) <= x1 for x0, x1 in c['neg']) if kb >= 0 else False
        if ena != enb:
            gana = 'a' if ena else 'b'
    x = nueva(a, bb, gana, ronda or seccion, 'texto' if ronda else 'seccion', None, replica)
    if x is not None and exhib:
        nota['exhib'].add(frozenset((claves.clave(x['a'][0]), claves.clave(x['b'][0]))))


_CABECERA = re.compile(r'^\W*(?:batalla|enfrentamiento|cruce|duelo|mc\s*[12]|freestyler\s*[12]|ganador|resultado|'
                       r'avanz|rival|pa[ií]s|puntos|ronda|fase|instancia|campe[oó]n|vencedor|c[oó]mo\s+lleg)', re.I)


def _es_cabecera(fila):
    cs = fila['celdas']
    if any(re.search(r'\s(?:vs\.?|versus)\s', _plano(c['t'])) for c in cs):
        return False
    if fila.get('cab') or all(c.get('th') for c in cs):
        return True
    toda_negrita = all(c['neg'] and sum(y - x for x, y in c['neg']) >= len(c['t'].replace(' ', '')) * 0.9
                       for c in cs if c['t'])
    return toda_negrita and sum(1 for c in cs if _CABECERA.match(c['t'])) >= max(2, len(cs) - 1)


def _rol(t):
    p = _plano(re.sub(r'[^\w\s]', ' ', t)).strip()
    if re.match(r'(?:mc|freestyler|competidor)\s*1\b|local\b', p):
        return 'a'
    if re.match(r'(?:mc|freestyler|competidor)\s*2\b|visitante\b', p):
        return 'b'
    if re.match(r'ganador|resultado|vencedor|avanz|pasa\b|clasific|campeon', p):
        return 'gana'
    if re.match(r'rival|oponente', p):
        return 'rival'
    if re.match(r'pais', p):
        return 'pais'
    if re.match(r'puntos?', p):
        return 'pts'
    return None


_PESO_R = {'texto': 3, 'seccion': 2, 'deducida': 1, None: 0}


def _juntar(y, x, avisos, donde):
    """Lo que trae la segunda vez que aparece una batalla, sobre la primera. Si dicen ganadores distintos, ninguno."""
    if x.get('gana'):
        if not y.get('gana') or (y.get('g_src') == 'deducido' and x.get('g_src') == 'texto'):
            if not y.get('conflicto'):
                y['gana'], y['g_src'] = _orientar(x, y), x.get('g_src')
        elif _orientar(x, y) != y['gana'] and x.get('g_src') == 'texto' and y.get('g_src') == 'texto':
            avisos.append('%s: %s vs %s, dos ganadores distintos según dónde se lea; queda sin ganador'
                          % (donde, y['a'][0], y['b'][0]))
            y['gana'], y['g_src'], y['conflicto'] = None, None, True
    if x.get('ronda') and _PESO_R.get(x.get('r_src'), 0) > _PESO_R.get(y.get('r_src'), 0):
        y['ronda'], y['r_src'] = x['ronda'], x['r_src']
    elif x.get('ronda') and y.get('ronda') and x['ronda'] != y['ronda'] and x.get('r_src') == y.get('r_src') == 'texto':
        avisos.append('%s: %s vs %s figura en %s y en %s; dejo %s' % (donde, y['a'][0], y['b'][0], y['ronda'],
                                                                      x['ronda'], y['ronda']))
    for k in ('votos', 'replica'):
        if y.get(k) is None and x.get(k) is not None:
            y[k] = x[k] if k != 'votos' or _orientar(x, y) == 'a' or not x.get('gana') else x[k][::-1]
    for lado in ('a', 'b'):
        if not y[lado][1]:
            otro = x['a'] if claves.clave(x['a'][0]) == claves.clave(y[lado][0]) else x['b']
            if claves.clave(otro[0]) == claves.clave(y[lado][0]) and otro[1]:
                y[lado] = (y[lado][0], otro[1])
    if x.get('jueces') and not y.get('jueces'):
        y['jueces'] = x['jueces']


def _orientar(x, y):
    """El ganador de `x` dicho en los lados de `y` (la misma batalla puede venir con los nombres al revés)."""
    if not x.get('gana'):
        return None
    nombre = x[x['gana']][0]
    return 'a' if claves.clave(nombre) == claves.clave(y['a'][0]) else 'b'


# ── el evento ────────────────────────────────────────────────────────────────────────────────────────────────────────
_SOBRA_TITULO = re.compile(r'^(?:resultados?\s+(?:completos\s+)?(?:de\s+la\s+|del\s+|de\s+)?)|\s+(?:resultados?|hoy)\s*$',
                           re.I)
_CORTE_EVENTO = re.compile(r'\s+(?:en\s+la\s+previa|tras|ante|y\s+se|y\s+gana|y\s+completa|y\s+consigue|y\s+apunta|'
                           r'frente|con\s+\w+\s+como|para)\b.*$', re.I)


def nombre_evento(titulo):
    """El nombre del evento, sacado del título de la nota: «Combate Mortal Freestyle 2026: Resultados…» → el principio."""
    t = re.sub(r'\s+', ' ', titulo).strip()
    pl = _plano(t)
    m = re.match(r'(?:%s)%s\s*,?\s+(?:(?:se\s+)?(?:consagr|coron|proclam)\w*\s+|(?:es|fue)\s+)?(?:el\s+|la\s+)?'
                 r'(?:nuev[oa]\s+)?(?:bi|tri)?campe[oó]n(?:a)?(?:\s+(?:nacional|internacional|regional))?'
                 r'(?:\s+\d{4})?\s+(?:de|del|en)\s+(?:la\s+|el\s+)?(?P<ev>.+)$' % (NOMBRE, _FLAG), t)
    if not m:
        m = re.match(r'(?:%s)\s+(?:vence|venci[óo]|derrota|derrot[óo])\s+a\s+(?:%s)\s+(?:y\s+se\s+corona\s+\w*campe[oó]n'
                     r'\w*\s+(?:de|del)|en\s+la\s+(?:gran\s+)?final\s+(?:de|del))\s+(?:la\s+|el\s+)?(?P<ev>.+)$'
                     % (NOMBRE, NOMBRE), t)
    if not m:
        m = re.match(r'(?:%s)\s+(?:gana|gan[óo]|conquista|conquist[óo])\s+(?:la\s+|el\s+)?(?P<ev>.+)$' % NOMBRE, t)
    if m:
        ev = m.group('ev')
        ev = ev.split(':')[0]
    else:
        ev = t.split(':')[0] if ':' in t and not re.match(r'\s*resultados?\b', pl) else t
        if re.match(r'\s*resultados?\b', pl) and ':' in t:
            ev = t.split(':')[0]
    ev = _CORTE_EVENTO.sub('', ev)
    ev = _SOBRA_TITULO.sub('', ev).strip(' .,-–—')
    ev = re.sub(r'\s+en\s+(?:%s)$' % '|'.join(x.title() for x in _PAISES), '', ev)
    ev = re.sub(r'(?i)\s+en\s+(?:per[uú]|m[eé]xico|espa[ñn]a|panam[aá])$', '', ev)
    return ev.strip() or t


def _fichas(s):
    pl = _plano(s)
    return {w for w in re.findall(r'[a-z0-9]+', pl)
            if w not in {'de', 'del', 'la', 'el', 'los', 'las', 'y', 'en', 'mc', 'freestyle'}
            and not re.fullmatch(r'(?:19|20)\d\d(?:\d\d)?', w)}


def _parecidos(a, b):
    fa, fb = _fichas(a), _fichas(b)
    if not fa or not fb:
        return False
    if (fa <= fb or fb <= fa) and min(len(fa), len(fb)) >= 1:
        return True
    return len(fa & fb) / float(len(fa | fb)) >= 0.8


def _tipo(nombre, titulos):
    """`(tipo, pais)`. Las reglas son las mismas que `datos/global_canales.json` le da a esos circuitos en YouTube: si
    no coinciden, la misma batalla en las dos fuentes no se junta (global_ranking pide el mismo tipo)."""
    pn = ' '.join(sorted(_fichas(nombre)))
    todo = _plano(nombre + ' ' + ' '.join(titulos))
    m = _PAIS_RE.search(_plano(nombre)) or _PAIS_RE.search(_plano(' '.join(titulos)))
    pais = _PAISES[m.group(1)] if m else None
    inter = bool(re.search(r'internacional|international|final mundial|world final', todo))
    if 'red bull' in todo and ('red' in pn and 'bull' in pn or 'torneo de plazas' in _plano(nombre)
                                or 'regional' in pn):
        if 'torneo de plazas' in _plano(nombre):
            return 'plazas_final', None
        if 'regional' in pn:
            return 'rb_regional', pais
        if inter and not pais:
            return 'rb_internacional', None
        if re.search(r'internacional|final mundial', _plano(nombre)):
            return 'rb_internacional', None
        return 'rb_nacional', pais
    if 'supremacia' in pn:
        if inter:
            return 'independiente', None
        if 'nacional' in todo:
            return 'independiente', pais
        return 'plaza', pais
    if re.search(r'\bdem\b', pn):
        return ('independiente' if 'nacional' in todo else 'plaza'), pais
    if re.search(r'\b(?:inmortal|hypnotic|raptablo|funko|plazas?|parque)\b', pn):
        return 'plaza', pais
    # un torneo de plaza que reparte cupos a una final de Red Bull: «… y completa los clasificados a la Final de Red Bull»
    if re.search(r'clasificad\w*\s+(?:a|para)\s+(?:la\s+)?final\s+(?:nacional\s+)?de\s+red\s+bull|cupo\s+(?:a|para)\s+'
                 r'(?:la\s+final\s+de\s+)?red\s+bull', todo):
        return 'plaza', pais
    return 'independiente', (None if inter else pais)


def _slug(s):
    return re.sub(r'[^a-z0-9]+', '-', _plano(s)).strip('-')[:70] or 'evento'


def _unificar(bats):
    """Dentro de un evento, «Tobi» y «1Tobi» o «Lancer» y «Lancer Lirical» son la misma persona: el nombre más usado."""
    cuenta, nombre = {}, {}
    for x in bats:
        for lado in ('a', 'b'):
            k = claves.clave(x[lado][0])
            cuenta[k] = cuenta.get(k, 0) + 1
            nombre.setdefault(k, x[lado])
    rivales = {}
    for x in bats:
        ka, kb = claves.clave(x['a'][0]), claves.clave(x['b'][0])
        rivales.setdefault(ka, set()).add(kb)
        rivales.setdefault(kb, set()).add(ka)
    a_cual = {}
    ks = sorted(cuenta, key=len)
    for i, s in enumerate(ks):
        for l in ks[i + 1:]:
            if len(s) >= 3 and len(l) - len(s) <= 8 and (l.startswith(s) or l.endswith(s)) \
                    and l not in rivales.get(s, ()):
                dest = l if (cuenta[l], len(l)) >= (cuenta[s], len(s)) else s
                a_cual[s if dest == l else l] = dest
    for x in bats:
        for lado in ('a', 'b'):
            k = claves.clave(x[lado][0])
            if k in a_cual:
                x[lado] = (nombre[a_cual[k]][0], x[lado][1] or nombre[a_cual[k]][1])
    return a_cual


def _evento(notas, avisos):
    """Un grupo de notas del mismo evento → (evento, batallas). Junta, revisa la llave y deduce lo que falta."""
    principal = max(notas, key=lambda n: (bool(re.match(r'\s*resultados?\b', _plano(n['titulo']))
                                               or 'resultados' in _plano(n['titulo'])), len(n['batallas']), -n['id']))
    nombre = nombre_evento(principal['titulo'])
    con_fecha = [n for n in notas if n['fecha_de'] == 'texto']
    if con_fecha:
        cuenta = {}
        for n in con_fecha:
            cuenta[n['fecha']] = cuenta.get(n['fecha'], 0) + 1
        fecha = max(cuenta, key=lambda d: (cuenta[d], -d.toordinal()))
        fecha_de = 'texto'
    else:
        fecha, fecha_de = min(n['dia_nota'] for n in notas), 'nota'
    titulos = [n['titulo'] for n in notas]
    tipo, pais = _tipo(nombre, titulos)
    eid = 'us-' + _slug(nombre) + ('' if re.search(r'\b(?:19|20)\d\d\b', nombre) else '-' + fecha.isoformat())
    ev = {'id': eid, 'nombre': nombre, 'tipo': tipo, 'pais': pais, 'fecha': fecha.isoformat()}
    av = []
    # 1. juntar las batallas de todas las notas (la principal primero: su id es el que queda)
    bats, exhib, podio = [], set(), {}
    for n in sorted(notas, key=lambda n: n is not principal):
        for k, v in n['podio'].items():
            podio.setdefault(k, v)
        exhib |= n['exhib']
        av += n['avisos']
        for x in n['batallas']:
            x = dict(x)
            k = frozenset((claves.clave(x['a'][0]), claves.clave(x['b'][0])))
            y = next((y for y in bats if frozenset((claves.clave(y['a'][0]), claves.clave(y['b'][0]))) == k), None)
            if y is None:
                bats.append(x)
            else:
                _juntar(y, x, av, nombre)
    a_cual = _unificar(bats)
    if a_cual:
        # tras unificar puede quedar la misma batalla dos veces
        vistas, unicas = {}, []
        for x in bats:
            k = frozenset((claves.clave(x['a'][0]), claves.clave(x['b'][0])))
            if k in vistas:
                _juntar(vistas[k], x, av, nombre)
            else:
                vistas[k] = x
                unicas.append(x)
        bats = unicas
        ex2 = set()
        for k in exhib:
            ex2.add(frozenset(a_cual.get(z, z) for z in k))
        exhib = ex2
    for k in ('campeon', 'sub', 'tercero'):
        if podio.get(k):
            kk = claves.clave(podio[k])
            podio[k] = next((x[l][0] for x in bats for l in 'ab' if claves.clave(x[l][0]) == a_cual.get(kk, kk)),
                            podio[k])
    # 2. lo que no cuenta: exhibiciones
    fuera = [x for x in bats if frozenset((claves.clave(x['a'][0]), claves.clave(x['b'][0]))) in exhib]
    if fuera:
        av.append('%s: %d exhibición(es) afuera: %s' % (nombre, len(fuera), ', '.join(
            '%s vs %s' % (x['a'][0], x['b'][0]) for x in fuera)))
        bats = [x for x in bats if x not in fuera]
    # 3. quien juega dos veces la misma ronda: las notas no coinciden, se tiran las dos versiones
    malas = set()
    for r in ORDEN + ('tercer',):
        de = {}
        for x in bats:
            if x['ronda'] == r:
                for l in 'ab':
                    de.setdefault(claves.clave(x[l][0]), []).append(x)
        for k, xs in de.items():
            if len(xs) > 1:
                malas.update(id(x) for x in xs)
                av.append('%s: %s aparece %d veces en %s (%s); las notas no coinciden y no cuento ninguna' % (
                    nombre, xs[0]['a'][0] if claves.clave(xs[0]['a'][0]) == k else xs[0]['b'][0], len(xs), r,
                    '; '.join('%s vs %s' % (x['a'][0], x['b'][0]) for x in xs)))
    bats = [x for x in bats if id(x) not in malas]
    # 4. la final y el tercer puesto que sólo da el podio («Gran Final: Draker vs. Nano» + «Campeón: Draker»)
    fin = [x for x in bats if x['ronda'] == 'final']
    if not fin and podio.get('campeon') and (podio.get('sub') or podio.get('finalistas')):
        sub = podio.get('sub') or next((f for f in podio['finalistas'] if claves.clave(f) != claves.clave(
            podio['campeon'])), None)
        if sub and claves.clave(sub) != claves.clave(podio['campeon']):
            y = {'a': (podio['campeon'], None), 'b': (sub, None), 'gana': 'a', 'g_src': 'texto', 'ronda': 'final',
                 'r_src': 'texto', 'votos': None, 'replica': None, 'nota': principal['id'], 'url': principal['url'],
                 'n': 900 + len(bats)}
            bats.append(y)
            av.append('%s: la final sale del podio (campeón %s, subcampeón %s)' % (nombre, podio['campeon'], sub))
    _cerrar_llave(bats, podio, nombre, av)
    # 5. el país de cada uno: la bandera o la tabla (si en una batalla del evento la trae, vale para todas las suyas);
    # en un nacional o regional de Red Bull, el del evento
    de_pais = {}
    for n in notas:
        for kk, p in (n.get('paises') or {}).items():
            de_pais.setdefault(a_cual.get(kk, kk), set()).add(p)
    for x in bats:
        for l in 'ab':
            if x[l][1]:
                de_pais.setdefault(claves.clave(x[l][0]), set()).add(x[l][1])
    for x in bats:
        for l in 'ab':
            ps = de_pais.get(claves.clave(x[l][0])) or set()
            if not x[l][1] and len(ps) == 1:
                x[l] = (x[l][0], list(ps)[0])
            elif not x[l][1] and tipo in ('rb_nacional', 'rb_regional') and pais:
                x[l] = (x[l][0], pais)
    # en un torneo de llave, lo que quedó sin ronda se nombra: global_ranking junta dos fuentes por par Y ronda
    if any(x['ronda'] for x in bats):
        sin_r = ['%s vs %s' % (x['a'][0], x['b'][0]) for x in bats if not x['ronda']]
        if sin_r:
            av.append('%s: %d batalla(s) sin ronda (la nota no dice en cuál fue): %s'
                      % (nombre, len(sin_r), ', '.join(sin_r[:8])))
    dedu = ['%s vs %s' % (x['a'][0], x['b'][0]) for x in bats if x['ronda'] == 'final' and x['r_src'] == 'deducida']
    if dedu:
        av.append('%s: la final sale de «X campeón tras vencer a Y» o del camino del campeón, no de un rótulo: %s'
                  % (nombre, ', '.join(dedu)))
    return ev, bats, av, fecha_de, notas


def _cerrar_llave(bats, podio, nombre, avisos):
    """Deduce lo que falta con la llave y revisa que cierre: quien gana una ronda juega la siguiente; el podio, la final."""
    por = {}
    for x in bats:
        por.setdefault(x['ronda'], []).append(x)
    presentes = [r for r in ORDEN if r in por]

    def k(x, l):
        return claves.clave(x[l][0])

    def despues(r):
        if r not in presentes:
            return set()
        return {k(x, l) for rr in presentes[presentes.index(r) + 1:] for x in por[rr] for l in 'ab'}

    kc = claves.clave(podio['campeon']) if podio.get('campeon') else None
    k3 = claves.clave(podio['tercero']) if podio.get('tercero') else None
    for x in bats:
        if x['gana']:
            continue
        g, como = None, None
        if x['ronda'] == 'final' and kc:
            g = next((l for l in 'ab' if k(x, l) == kc), None)
            como = 'el campeón que nombra la nota'
        elif x['ronda'] == 'tercer' and k3:
            g = next((l for l in 'ab' if k(x, l) == k3), None)
            como = 'el tercer puesto que nombra la nota'
        elif x['ronda'] in presentes and not x.get('conflicto'):
            s = despues(x['ronda'])
            if x['ronda'] == 'semifinal' and por.get('tercer'):
                t3 = {k(y, l) for y in por['tercer'] for l in 'ab'}
                en = [l for l in 'ab' if k(x, l) in s or k(x, l) not in t3 and (k(x, 'b' if l == 'a' else 'a') in t3)]
            else:
                en = [l for l in 'ab' if k(x, l) in s]
            g = en[0] if len(en) == 1 else None
            como = 'quién pasó de ronda'
        if g:
            x['gana'], x['g_src'] = g, 'deducido'
            avisos.append('%s: %s vs %s (%s) no dice quién ganó; lo deduje por %s: %s'
                          % (nombre, x['a'][0], x['b'][0], x['ronda'], como, x[g][0]))
    for r1, r2 in zip(presentes, presentes[1:]):
        if any(not x['gana'] for x in por[r1]):
            continue
        ganaron = {k(x, x['gana']): x[x['gana']][0] for x in por[r1]}
        juegan = {k(x, l): x[l][0] for x in por[r2] for l in 'ab'}
        # con la ronda anterior incompleta (sólo el camino del campeón) no se puede pedir que todos vengan de ahí
        de_mas = [n for kk, n in juegan.items() if kk not in ganaron] if len(por[r1]) >= len(juegan) else []
        de_menos = [n for kk, n in ganaron.items() if kk not in juegan] if len(por[r2]) * 2 >= len(por[r1]) else []
        if de_mas or de_menos:
            avisos.append('%s: la llave no cierra entre %s y %s%s%s' % (
                nombre, r1, r2, ('; juegan sin haber ganado: ' + ', '.join(de_mas)) if de_mas else '',
                ('; ganaron y no siguen: ' + ', '.join(de_menos)) if de_menos else ''))
    for x in por.get('final', [])[:1]:
        if x['gana'] and kc and k(x, x['gana']) != kc:
            avisos.append('%s: la final la gana %s pero la nota dice que el campeón es %s'
                          % (nombre, x[x['gana']][0], podio['campeon']))


def _agrupar(notas):
    """Las notas del mismo evento: mismo día (±1, ±3 si una no lo dice) y mismo nombre o una batalla en común."""
    grupos = []
    for n in sorted(notas, key=lambda n: (n['fecha'], n['id'])):
        nom = nombre_evento(n['titulo'])
        pares = {frozenset((claves.clave(x['a'][0]), claves.clave(x['b'][0]))) for x in n['batallas']}
        for g in grupos:
            tol = JUNTAS if n['fecha_de'] == 'texto' and all(m['fecha_de'] == 'texto' for m in g) else JUNTAS_SIN_FECHA
            if not any(abs((n['fecha'] - m['fecha']).days) <= tol for m in g):
                continue
            mismos = any(_parecidos(nom, nombre_evento(m['titulo'])) for m in g)
            comun = any(pares & {frozenset((claves.clave(x['a'][0]), claves.clave(x['b'][0]))) for x in m['batallas']}
                        for m in g)
            campeon = n['podio'].get('campeon') and any(
                claves.clave(m['podio'].get('campeon') or '') == claves.clave(n['podio']['campeon']) for m in g) and \
                any(len(_fichas(nom) & _fichas(nombre_evento(m['titulo']))) >= 1 for m in g)
            if mismos or comun or campeon:
                g.append(n)
                break
        else:
            grupos.append([n])
    return grupos


# ── qué notas se leen ────────────────────────────────────────────────────────────────────────────────────────────────
def clasificar(item):
    """`(qué, por qué)` para una nota de la lista: 'leer', 'fms', 'escritas', 'exhib', 'equipos' o None (no es)."""
    t = _html.unescape(re.sub(r'<[^>]+>', '', ((item.get('title') or {}).get('rendered')) or '')).strip()
    cats = set(item.get('categories') or [])
    if item.get('lang') not in (None, '', 'es'):
        return None, t
    if _OTRO.search(t):
        return None, t
    es_res = bool(_RESULTADO.search(t)) and not _PREVIA.search(t)
    # de lo que se salta, se nombran sólo las notas de resultados: el aviso es para saber qué no entró
    nombrar = es_res and bool(re.search(r'resultad|\bvence\b|venci[oó]|\bgan[oó]\b|derrot', t, re.I))
    if cats & CAT_FMS or _FMS.search(t):
        return ('fms' if nombrar else None), t
    if cats & CAT_ESCRITAS or _ESCRITAS.search(t):
        return ('escritas' if nombrar else None), t
    if not es_res:
        return None, t
    if _EXHIB.search(t):
        return 'exhib', t
    if _EQUIPOS.search(t):
        return 'equipos', t
    if cats and cats <= CAT_PERFIL and not _RESULTADO_FUERTE.search(t):
        return None, t
    return 'leer', t


# ── la red ───────────────────────────────────────────────────────────────────────────────────────────────────────────
class _Red:
    """Un pedido por vez, con un segundo de pausa, y un solo reintento si el sitio tropieza."""

    def __init__(self):
        import requests
        self.s = requests.Session()
        self.s.headers.update(CABECERAS)
        self.ultimo = 0.0
        self.pedidos = 0

    def get(self, ruta, params):
        for intento in (1, 2):
            falta = PAUSA * intento - (time.monotonic() - self.ultimo)
            if falta > 0:
                time.sleep(falta)
            self.pedidos += 1
            try:
                r = self.s.get(SITIO + ruta, params=params, timeout=ESPERA)
                codigo = r.status_code
                datos = r.json() if codigo == 200 else None     # r.json() mira los bytes: nunca `r.text`
                total = r.headers.get('X-WP-TotalPages')
            except Exception as e:  # noqa: BLE001  la red falla de muchas formas; todas se reintentan una vez
                codigo, datos, total = None, str(e), None
            self.ultimo = time.monotonic()
            if codigo == 200:
                return 200, datos, total
            if codigo not in (None, 429, 500, 502, 503, 504):
                break
        return codigo, datos, None


def _lista(red, desde, hasta, avisos):
    """Todas las notas en español de la ventana, sólo con lo que hace falta para decidir si se leen."""
    out, pag = [], 1
    antes = (dt.date.fromisoformat(hasta) + dt.timedelta(days=DESPUES)).isoformat()
    while pag <= MAX_PAGINAS:
        codigo, datos, total = red.get(API, {'after': desde + 'T00:00:00', 'before': antes + 'T23:59:59',
                                             'per_page': POR_PAGINA, 'page': pag, 'lang': 'es',
                                             'orderby': 'date', 'order': 'asc',
                                             '_fields': 'id,date,link,title,categories,lang'})
        if codigo != 200 or not isinstance(datos, list):
            if pag == 1 or codigo != 400:     # el 400 es «no hay más páginas»
                avisos.append('🔴 la lista de notas (página %d) respondió %s' % (pag, codigo))
            break
        out += datos
        if len(datos) < POR_PAGINA or (total and pag >= int(total)):
            break
        pag += 1
    return out


def _textos(red, ids, avisos):
    out = []
    for i in range(0, len(ids), POR_PAGINA):
        tanda = ids[i:i + POR_PAGINA]
        codigo, datos, _ = red.get(API, {'include': ','.join(map(str, tanda)), 'per_page': POR_PAGINA,
                                         '_fields': 'id,date,link,title,content,categories'})
        if codigo != 200 or not isinstance(datos, list):
            avisos.append('🔴 el texto de %d nota(s) respondió %s; no las leo' % (len(tanda), codigo))
            continue
        out += datos
    return out


# ── lo que se llama de afuera ────────────────────────────────────────────────────────────────────────────────────────
def _casos():
    lista, notas = [], []
    if not os.path.isdir(CASOS):
        return lista, notas
    for f in sorted(os.listdir(CASOS)):
        if f.startswith('urbanstreet_') and f.endswith('.json'):
            with io.open(os.path.join(CASOS, f), encoding='utf-8') as fh:
                c = json.load(fh)
            lista += c.get('lista') or []
            notas += c.get('notas') or []
    return lista, notas


#: lo de la última lectura (lo muestra --ver)
ULTIMA = {'pedidos': 0, 'lista': 0, 'leidas': 0, 'eventos': []}


def leer(desde='2026-09-22', hasta='2026-12-31', red=True):
    """Returns {'batallas': [...], 'mvp': [], 'avisos': [...]} for battles dated within [desde, hasta]."""
    avisos = []
    if red:
        try:
            r = _Red()
        except ImportError:
            return {'batallas': [], 'mvp': [], 'avisos': ['🔴 falta `requests`: no puedo leer urbanstreet.com.pe']}
        lista = _lista(r, desde, hasta, avisos)
    else:
        r = None
        lista, guardadas = _casos()
    saltos = {}
    pedir = []
    for it in lista:
        que, t = clasificar(it)
        if que == 'leer':
            pedir.append(it['id'])
        elif que:
            saltos.setdefault(que, []).append(t)
    if red:
        posts = _textos(r, pedir, avisos) if pedir else []
        ULTIMA['pedidos'] = r.pedidos
    else:
        posts = [p for p in guardadas if p['id'] in set(pedir)]
    ULTIMA.update(lista=len(lista), leidas=len(posts))
    motivo = {'fms': 'de FMS (las lee global_fuente_fms desde fms.tv)', 'escritas': 'de batallas escritas (Bazooka)',
              'exhib': 'de exhibiciones o «contra todos»', 'equipos': 'de equipos (2vs2, duplas, triples)'}
    for que, ts in saltos.items():
        avisos.append('salto %d nota(s) %s: %s' % (len(ts), motivo[que], ' · '.join(x[:70] for x in ts[:8])))
    notas = []
    for p in posts:
        try:
            notas.append(leer_nota(p))
        except Exception as e:  # noqa: BLE001 — una nota rara no tumba las demás
            avisos.append('🔴 no pude leer la nota %s (%s: %s)' % (p.get('id'), type(e).__name__, str(e)[:120]))
    vacias = [n for n in notas if not n['batallas'] and not n['podio'].get('campeon')]
    if vacias:
        avisos.append('%d nota(s) de resultados sin ninguna batalla que se pueda leer: %s' % (
            len(vacias), ' · '.join(n['titulo'][:60] for n in vacias[:8])))
    batallas, eventos = [], []
    d0, d1 = dt.date.fromisoformat(desde), dt.date.fromisoformat(hasta)
    for g in _agrupar([n for n in notas if n['batallas'] or n['podio'].get('campeon')]):
        ev, bats, av, fecha_de, ns = _evento(g, avisos)
        if not (d0 <= dt.date.fromisoformat(ev['fecha']) <= d1):
            continue
        equipos = sum(n['equipos'] for n in ns)
        huecos = [h for n in ns for h in n['huecos']]
        avisos.extend(av)
        if equipos:
            avisos.append('%s: %d cruce(s) de equipos afuera' % (ev['nombre'], equipos))
        if huecos:
            avisos.append('%s: %d batalla(s) con un rival sin nombre, afuera: %s' % (ev['nombre'], len(huecos),
                                                                                       ', '.join(huecos[:4])))
        recs = []
        for x in sorted(bats, key=lambda x: (x['nota'], x['n'])):
            recs.append({'id': 'us:%s:%s' % (x['nota'], x['n']), 'fuente': 'urbanstreet', 'url': x['url'],
                         'evento': dict(ev), 'ronda': x['ronda'],
                         'a': {'nombre': x['a'][0], 'id': 'us:' + claves.clave(x['a'][0]), 'pais': x['a'][1]},
                         'b': {'nombre': x['b'][0], 'id': 'us:' + claves.clave(x['b'][0]), 'pais': x['b'][1]},
                         'gana': x['gana'], 'replica': x['replica'], 'votos': x['votos'], 'pts': None})
        sin = [y for y in recs if not y['gana']]
        avisos.append('%s (%s, %s; fecha %s): %d batalla(s), %d con ganador%s · notas %s' % (
            ev['nombre'], ev['tipo'], ev['pais'] or '—', ev['fecha'] + (' del texto' if fecha_de == 'texto'
                                                                         else ' de la nota: el texto no la dice'),
            len(recs), len(recs) - len(sin), ('; sin ganador: ' + ', '.join('%s vs %s' % (y['a']['nombre'],
                                                                                         y['b']['nombre'])
                                                                           for y in sin[:6])) if sin else '',
            ', '.join(str(n['id']) for n in ns)))
        eventos.append((ev, recs, fecha_de, ns))
        batallas += recs
    # ⚠️ en la duda, dos perfiles: el mismo nombre con dos países distintos son dos personas
    paises = {}
    for b in batallas:
        for l in 'ab':
            paises.setdefault(claves.clave(b[l]['nombre']), set()).add(b[l]['pais'])
    dobles = sorted(k for k, ps in paises.items() if len(ps - {None}) > 1)
    for b in batallas:
        for l in 'ab':
            k = claves.clave(b[l]['nombre'])
            if k in dobles and b[l]['pais']:
                b[l]['id'] = 'us:%s-%s' % (k, b[l]['pais'])
    if dobles:
        avisos.append('mismo nombre con dos países, van como dos personas: ' + ', '.join(dobles[:12]))
    ULTIMA['eventos'] = eventos
    if red and not batallas and not any(a.startswith('🔴') for a in avisos):
        avisos.append('no hay resultados que se puedan leer entre %s y %s' % (desde, hasta))
    return {'batallas': batallas, 'mvp': [], 'avisos': avisos}


# ── los casos (fixtures) ─────────────────────────────────────────────────────────────────────────────────────────────
class _Recorte(HTMLParser):
    """Copia el HTML con sólo las etiquetas que el lector mira, sin atributos ni embebidos (Instagram pesa 6 KB)."""
    QUEDA = {'p', 'li', 'ul', 'ol', 'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'strong', 'b', 'br',
             'div'}

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out, self.fuera = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in _Bloques.FUERA:
            self.fuera += 1
        elif not self.fuera and tag in self.QUEDA:
            self.out.append('<%s>' % tag)

    def handle_endtag(self, tag):
        if tag in _Bloques.FUERA:
            self.fuera = max(0, self.fuera - 1)
        elif not self.fuera and tag in self.QUEDA and tag != 'br':
            self.out.append('</%s>' % tag)

    def handle_data(self, data):
        if not self.fuera:
            self.out.append(data)

    def handle_entityref(self, name):
        if not self.fuera:
            self.out.append('&%s;' % name)

    def handle_charref(self, name):
        if not self.fuera:
            self.out.append('&#%s;' % name)


def recortar(post):
    p = _Recorte()
    p.feed((post.get('content') or {}).get('rendered') or '')
    p.close()
    html = re.sub(r'\n\s*\n+', '\n', ''.join(p.out))
    html = re.sub(r'<(p|li|h2|h3|h4)>\s*</\1>', '', html)
    return {'id': post['id'], 'date': post['date'], 'link': post.get('link'), 'categories': post.get('categories'),
            'title': {'rendered': (post.get('title') or {}).get('rendered')}, 'content': {'rendered': html.strip()}}


#: los casos que baja `--casos`: archivo → notas. La lista de títulos sale de esas mismas notas más `LISTA_EXTRA`.
CASOS_VIVOS = {
    'urbanstreet_redbull.json': (6261, 6271, 6239, 7130, 7125, 6734, 6748, 7440, 7444, 8158, 8177, 4688, 4697),
    'urbanstreet_independientes.json': (7738, 7737, 8528, 8530, 7825, 7818, 6016, 5953, 6477),
    'urbanstreet_ligas.json': (8535, 6015),
}
#: notas que sólo van en la lista (no se leen): FMS, Bazooka, exhibiciones, previas, música, inglés
LISTA_EXTRA = (8537, 7157, 7507, 8096, 8483, 8489, 7420, 7115, 6309, 7468, 8381, 8905, 8918, 7338, 6102, 6255, 5302,
               6213)


def _bajar_casos():
    r = _Red()
    ids = sorted({i for v in CASOS_VIVOS.values() for i in v} | set(LISTA_EXTRA))
    codigo, datos, _ = r.get(API, {'include': ','.join(map(str, ids)), 'per_page': POR_PAGINA,
                                   '_fields': 'id,date,link,title,content,categories,lang'})
    if codigo != 200 or not isinstance(datos, list):
        print('🔴 la API respondió %s' % codigo)
        return 1
    por_id = {p['id']: p for p in datos}
    os.makedirs(CASOS, exist_ok=True)
    primero = True
    for archivo, ids_ in CASOS_VIVOS.items():
        notas = [recortar(por_id[i]) for i in ids_ if i in por_id]
        lista = [{'id': p['id'], 'date': p['date'], 'link': p.get('link'), 'title': p['title'],
                  'categories': p.get('categories'), 'lang': por_id[p['id']].get('lang', 'es')} for p in notas]
        if primero:
            lista += [{'id': i, 'date': por_id[i]['date'], 'link': por_id[i].get('link'),
                       'title': {'rendered': por_id[i]['title']['rendered']}, 'categories': por_id[i].get('categories'),
                       'lang': por_id[i].get('lang', 'es')} for i in LISTA_EXTRA if i in por_id]
            primero = False
        ruta = os.path.join(CASOS, archivo)
        with io.open(ruta, 'w', encoding='utf-8', newline='\n') as fh:
            json.dump({'_leeme': 'Notas reales de urbanstreet.com.pe, recortadas por `global_fuente_urbanstreet.py '
                                 '--casos`: sólo las etiquetas que lee el lector. Las usa su --auto.',
                       'lista': lista, 'notas': notas}, fh, ensure_ascii=False, indent=1)
            fh.write('\n')
        print('✅ %-34s %2d notas, %6d bytes' % (archivo, len(notas), os.path.getsize(ruta)))
    return 0


# ── --ver y --auto ───────────────────────────────────────────────────────────────────────────────────────────────────
def _ver():
    from comun import temporada
    d0, d1 = temporada.FECHAS[temporada.ACTUAL]
    t0 = time.monotonic()
    res = leer(d0, d1, red=True)
    print('\n══ URBAN STREET, EN VIVO · %s → %s (%d pedidos, %.0f s) ══\n' % (d0, d1, ULTIMA['pedidos'],
                                                                         time.monotonic() - t0))
    print('  %d notas en la ventana, %d leídas por el título\n' % (ULTIMA['lista'], ULTIMA['leidas']))
    for ev, recs, fecha_de, ns in sorted(ULTIMA['eventos'], key=lambda e: e[0]['fecha']):
        con = sum(1 for b in recs if b['gana'])
        print('  %s%s %-50s %-15s %-3s %2d batallas, %2d con ganador' % (
            ev['fecha'], ' ' if fecha_de == 'texto' else '~', ev['nombre'][:50], ev['tipo'], ev['pais'] or '—',
            len(recs), con))
    print('\n  (~ = fecha de la nota: el texto no dice la del evento)\n\n  ejemplos:')
    for ev, recs, _, _ in ULTIMA['eventos'][:8]:
        for b in recs[:2]:
            g = b[b['gana']]['nombre'] if b['gana'] else '¿?'
            print('    %-10s %-18s vs %-18s → %-14s %s%s' % (b['ronda'] or '—', b['a']['nombre'][:18],
                                                            b['b']['nombre'][:18], g[:14],
                                                            '%d-%d' % tuple(b['votos']) if b['votos'] else '',
                                                            ' R' if b['replica'] else ''))
    print('\n  avisos (%d):' % len(res['avisos']))
    for a in res['avisos']:
        print('    · ' + a)
    print('\n  %d batallas en %d eventos\n' % (len(res['batallas']), len(ULTIMA['eventos'])))
    return 0 if res['batallas'] or not any(a.startswith('🔴') for a in res['avisos']) else 1


def _self_check():
    print('\n══ URBAN STREET ══\n')
    mal = 0

    def ok(c, q, extra=''):
        nonlocal mal
        mal += not c
        print('   %s %s%s' % ('✅' if c else '🔴', q, ('  ' + str(extra)[:400]) if extra and not c else ''))

    falta = [f for f in CASOS_VIVOS if not os.path.exists(os.path.join(CASOS, f))]
    ok(not falta, 'están los casos guardados', falta)
    if falta:
        print('\n  🔴 sin casos no hay prueba\n')
        return 1

    # las piezas chicas
    ok(_ronda_en('Octavos de Final')[0] == 'octavos' and _ronda_en('Cuartos de final: x')[0] == 'cuartos'
       and _ronda_en('Gran Final: Draker vs. Nano')[0] == 'final' and _ronda_en('Semifinales')[0] == 'semifinal'
       and _ronda_en('Tercer puesto: Joqerr vence a Drose')[0] == 'tercer'
       and _ronda_en('clasifican a la Final Nacional')[0] is None and _ronda_en('una final con sabor')[0] is None
       and _ronda_en('Finalistas: A y B')[0] is None, 'las rondas, y «Final Nacional» no es una ronda')
    ok(_limpio('Fat N 🇨🇴') == ('Fat N', 'co') and _limpio('KG (Perú)') == ('KG', 'pe')
       and _limpio('**Mecha**.') == ('Mecha', None), 'el nombre: bandera y país entre paréntesis')
    ok(nombre_evento('Combate Mortal Freestyle 2026: Resultados completos, campeón y todas las batallas')
       == 'Combate Mortal Freestyle 2026'
       and nombre_evento('Resultados de Verso Final 2026: Acertijo se corona campeón tras vencer a Anubis en la final')
       == 'Verso Final 2026'
       and nombre_evento('Draker es campeón de la Regional Sur de Red Bull Batalla Chile 2026')
       == 'Regional Sur de Red Bull Batalla Chile 2026'
       and nombre_evento('Erreka vence a Blackcode y se corona bicampeón de Dragones del Freestyle')
       == 'Dragones del Freestyle'
       and nombre_evento('Mecha es campeón de DEM Santa Cruz en la previa a Red Bull Batalla Argentina')
       == 'DEM Santa Cruz', 'el nombre del evento sale del título',
       [nombre_evento('Mecha es campeón de DEM Santa Cruz en la previa a Red Bull Batalla Argentina')])

    # qué notas se leen
    lista, notas = _casos()
    cl = {}
    for it in lista:
        cl[it['id']] = clasificar(it)[0]
    ok(cl.get(8537) == 'fms' and cl.get(7157) == 'fms', 'FMS se salta (lo lee fms.tv) y se nombra', cl)
    ok(cl.get(7507) == 'escritas', 'la Liga Bazooka (escritas) se salta')
    ok(cl.get(8096) != 'leer' and cl.get(6309) != 'leer'
       and clasificar({'title': {'rendered': 'Chang ganó la exhibición ante KG'}, 'categories': [3]})[0] == 'exhib',
       'Gazir contra todos y las exhibiciones, afuera')
    ok(cl.get(8483) is None and cl.get(8489) is None and cl.get(7420) is None, 'las previas («HOY», «dónde ver») no')
    ok(cl.get(7468) is None and cl.get(8381) is None, 'el baile y los Grammy no son freestyle')
    ok(cl.get(7338) is None and cl.get(6102) is None and cl.get(5302) is None, 'los perfiles y las polémicas, no')
    ok(all(cl.get(i) == 'leer' for v in CASOS_VIVOS.values() for i in v), 'las notas de resultados sí',
       {i: cl.get(i) for v in CASOS_VIVOS.values() for i in v if cl.get(i) != 'leer'})

    res = leer('2026-09-01', '2026-12-31', red=False)
    bs = res['batallas']
    claves_ok = {'id', 'fuente', 'url', 'evento', 'ronda', 'a', 'b', 'gana', 'replica', 'votos', 'pts'}
    ok(set(res) == {'batallas', 'mvp', 'avisos'} and res['mvp'] == [], 'la forma de la respuesta')
    ok(bs and all(set(b) == claves_ok for b in bs), 'cada batalla trae exactamente las claves pedidas')
    ok(all(b['fuente'] == 'urbanstreet' and re.fullmatch(r'us:\d+:\d+', b['id']) and b['url'].startswith(SITIO)
           and b['a']['id'].startswith('us:') and b['ronda'] in RONDAS + (None,) and b['gana'] in ('a', 'b', None)
           and b['pts'] is None and b['evento']['id'].startswith('us-')
           and b['evento']['tipo'] in ('rb_internacional', 'rb_nacional', 'rb_regional', 'plazas_final',
                                       'independiente', 'plaza') for b in bs), 'ids, fuente, rondas y tipos válidos')
    ok(len({b['id'] for b in bs}) == len(bs), 'ningún id repetido')

    def ev(pal):
        return [b for b in bs if pal in _plano(b['evento']['nombre'])]

    def una(a, b_, lista=None):
        for b in lista or bs:
            if {claves.clave(b['a']['nombre']), claves.clave(b['b']['nombre'])} == {claves.clave(a), claves.clave(b_)}:
                return b
        return None

    def gan(b):
        return b and b['gana'] and b[b['gana']]['nombre']

    ar = ev('argentina')
    f = una('Mecha', '1Tobi', ar)
    ok(len(ar) == 15 and gan(f) == 'Mecha' and f['ronda'] == 'final' and ar[0]['evento']['tipo'] == 'rb_nacional'
       and ar[0]['evento']['pais'] == 'ar' and ar[0]['evento']['fecha'] == '2026-10-02',
       'Red Bull Argentina: la tabla MC 1 / MC 2 / Ganador, 15 batallas, Mecha campeón el 2/10', (len(ar), f))
    ok(len({b['evento']['id'] for b in ar}) == 1 and all(b['a']['pais'] == 'ar' for b in ar),
       'sus tres notas son un solo evento, y en un nacional de Red Bull el país es el del evento')
    co = ev('colombia')
    lit = una('Lit Ignis', 'Coffy', co)
    ok(len(co) == 15 and gan(lit) == 'Lit Ignis' and lit['replica'] is True and lit['ronda'] == 'octavos'
       and gan(una('Marithea', 'Horus', co)) == 'Marithea',
       'Red Bull Colombia: «venció a», «tras réplica», y la final del título de sección', (len(co), lit))
    ok(not una('Mecha', 'Dybbuk', co), 'el cartel de «HOY» (Mecha vs Dybbuk de FMS) no es del evento')
    cen = ev('regional centro')
    ok(gan(una('Joqerr', 'Drose', cen)) == 'Joqerr' and una('Joqerr', 'Drose', cen)['ronda'] == 'tercer'
       and gan(una('Elemece', 'Rodamiento', cen)) == 'Elemece',
       'Regional Centro: el tercer puesto y la final «Elemece vs. Rodamiento: Elemece derroto a…»')
    ok(not una('El Barto', 'Eskai', cen) and not una('Elemece', 'El Barto', cen)
       and any('El Barto aparece 2 veces en cuartos' in a for a in res['avisos']),
       'la nota pone a El Barto dos veces en cuartos: esas dos no cuentan, y se avisa')
    # el caso armado, sobre la tabla de Red Bull Argentina: un ganador borrado y otro cambiado
    arg = dict(next(n for n in notas if n['id'] == 6261))
    html = arg['content']['rendered']
    html = html.replace('<td>Nasir Catriel</td><td>Dybbuk</td><td>Dybbuk</td>',
                        '<td>Nasir Catriel</td><td>Dybbuk</td><td></td>')
    html = html.replace('<td>Dybbuk</td><td>Sophia</td><td>Dybbuk</td>', '<td>Dybbuk</td><td>Sophia</td><td>Sophia</td>')
    arg['content'] = {'rendered': html}
    av = []
    _, bats, av2, _, _ = _evento([leer_nota(arg)], av)
    o1 = next((x for x in bats if {x['a'][0], x['b'][0]} == {'Nasir Catriel', 'Dybbuk'}), None)
    ok(o1 and o1['gana'] and o1[o1['gana']][0] == 'Dybbuk' and any('lo deduje por quién pasó de ronda: Dybbuk' in a
                                                                    for a in av2),
       'sin ganador en la tabla: se deduce de quién pasó de ronda, y se avisa', av2)
    ok(any('la llave no cierra entre cuartos y semifinal' in a and 'juegan sin haber ganado: Dybbuk' in a
           and 'ganaron y no siguen: Sophia' in a for a in av2), 'y una llave que no cierra se avisa', av2)
    sur = ev('regional sur')
    ok(len(sur) == 1 and gan(sur[0]) == 'Draker' and sur[0]['ronda'] == 'final' and sur[0]['evento']['fecha']
       == '2026-10-24' and sur[0]['evento']['tipo'] == 'rb_regional' and sur[0]['evento']['pais'] == 'cl',
       'Regional Sur: «Gran Final: Draker vs. Nano» + «Campeón: Draker», del 24/10 (el rótulo «Fecha:»)', sur)
    nor = ev('regional norte')
    ok(gan(una('Jotaka', 'Deco', nor)) == 'Jotaka' and una('Jotaka', 'Deco', nor)['ronda'] == 'octavos'
       and gan(una('Aries', 'Jokker', nor)) == 'Aries' and gan(una('Jotaka', 'Vuscooh', nor)) == 'Jotaka'
       and len({b['evento']['id'] for b in nor}) == 1,
       'Regional Norte: los títulos «Octavos de final: Jotaka supera a Deco» y «Jokker cae eliminado ante Aries»', nor)
    pl = ev('torneo de plazas')
    ok(len(pl) == 15 and gan(una('Hammer', 'Fat N', pl)) == 'Hammer' and pl[0]['evento']['tipo'] == 'plazas_final'
       and pl[0]['evento']['pais'] is None, 'Torneo de Plazas: plazas_final, 15 batallas y Hammer campeón', len(pl))
    ok(not leer('2026-09-22', '2026-12-31', red=False)['batallas'] or not any(
        'plazas' in _plano(b['evento']['nombre']) for b in leer('2026-09-22', '2026-12-31', red=False)['batallas']),
       'el Torneo de Plazas del 19/09 queda afuera de la T1')
    cm = ev('combate mortal')
    ok(len(cm) == 15 and gan(una('Mecha', 'El Menor', cm)) == 'Mecha' and una('Fat N', 'Numenosis', cm)['a']['pais']
       == 'co' and una('Fat N', 'Numenosis', cm)['b']['pais'] == 'do' and cm[0]['evento']['tipo'] == 'independiente',
       'Combate Mortal: las banderas dan el país de cada uno', (len(cm), cm[:1]))
    su = ev('supremacia')
    ok(len(su) == 4 and gan(una('KG', 'Dexo', su)) == 'KG' and una('KG', 'Dexo', su)['ronda'] == 'final'
       and una('KG', 'Viti', su)['ronda'] is None and una('KG', 'Flama', su)['ronda'] is None
       and una('KG', 'Viti', su)['b']['pais'] == 'es' and una('KG', 'Dexo', su)['a']['pais'] == 'pe'
       and su[0]['evento']['fecha'] == '2026-11-14' and su[0]['evento']['pais'] is None
       and any('Supremacía MC 2026: 3 batalla(s) sin ronda' in a for a in res['avisos']),
       'Supremacía: la tabla «Rival | País | … | Victoria de KG (final)»: la final sí; el orden no da las otras rondas '
       '(el canal de Supremacía pone a Flama en octavos y a Viti en cuartos)', su)
    vf = ev('verso final')
    ok(gan(una('Acertijo', 'Anubis', vf)) == 'Acertijo' and gan(una('Acertijo', 'Nitro', vf)) == 'Acertijo'
       and not una('Nitro', 'JNO', vf) and not una('Nitro', 'Metalingüística', vf)
       and una('Cristofebril', 'Fusok', vf) and una('Cristofebril', 'Fusok', vf)['gana'] is None
       and not any(b for b in vf if 'cupo' in _plano(b['a']['nombre'] + b['b']['nombre'])),
       'Verso Final: las dos notas no coinciden; lo que discrepa no cuenta y «Cupo DEM» no es nadie',
       [(b['a']['nombre'], b['b']['nombre'], b['ronda'], b['gana']) for b in vf])
    dr = ev('dragones')
    ok(len(dr) == 1 and gan(dr[0]) == 'Erreka' and dr[0]['ronda'] == 'final', 'Dragones: la final sale del título', dr)
    dem = ev('dem santa cruz')
    ok(len(dem) == 1 and gan(dem[0]) == 'Mecha' and dem[0]['evento']['fecha'] == '2026-09-26'
       and dem[0]['evento']['tipo'] == 'plaza', 'DEM Santa Cruz: «este 26 de septiembre», y DEM es plaza (como en '
       'YouTube)', dem)
    rp = ev('reyes del parque')
    ok(len(rp) == 1 and gan(rp[0]) == 'Nitro' and any('Reyes del Parque' in a and 'de la nota' in a
                                                      for a in res['avisos']),
       'Reyes del Parque: sin fecha en el texto, la de la nota, y se avisa', rp)
    j4 = ev('jornada 04')
    ok(len(j4) == 5 and not una('Chang', 'Alfabeto', j4) and gan(una('Luca', 'Inmigrante', j4)) == 'Luca'
       and una('Luca', 'Inmigrante', j4)['replica'] is True and j4[0]['evento']['pais'] == 've'
       and all(b['ronda'] is None for b in j4),
       'Liga de Venezuela J4: la exhibición afuera, «Luca tras réplica»; una liga no tiene ronda', j4)
    j3 = ev('jornada 3')
    rs = una('Reilly', 'Sipno', j3)
    ok(len(j3) == 5 and gan(rs) == 'Reilly' and rs['votos'] == [4, 0]
       and una('Imigrante', 'Blackstter', j3)['replica'] is True and not una('Lancer Lirical', 'DAFP', j3),
       'Liga de Venezuela J3: «Ganador:» y los votos de cada juez (4-0, el de la réplica no cuenta)', (len(j3), rs))
    ok(not any(una('KG', 'JC Snake', [b]) or una('KG', 'Necia', [b]) or una('Dexo', 'Berzerk', [b]) for b in bs),
       'la historia de cada uno («en enero ganó ante JC Snake») no se cuela como batalla')
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d problema(s)' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    if '--auto' in sys.argv:
        sys.exit(_self_check())
    if '--casos' in sys.argv:
        sys.exit(_bajar_casos())
    if '--ver' in sys.argv:
        sys.exit(_ver())
    print(__doc__)

# -*- coding: utf-8 -*-
"""🎭 LOS ESTILOS DE JUEGO DE LA COMPETITIVA: el catálogo, de quién es cada uno y cómo se dibuja la columna.

Dlx, 16/11/2026: *«Realmente es complicado detectar cuales son los mejores eventos de cada servidor, por eso…
mi idea era implementar los playstyles a la competitiva»* y *«la idea de los playstyles es reemplazar los eventos
del competitivo»*. O sea que **la columna izquierda deja de ser los eventos** (los rombos con medalla) y pasa a ser
**hasta tres estilos**, con estas reglas, todas suyas o decididas con su «como tú decidas» del mismo día:

  · **18 estilos en tres familias**: ATAQUE (rombo), FOCO —el medio campo— (círculo) y CABEZA (escudo). «Cazaflá» se
    queda; Técnicas y Estructuras van separadas. El research está en `reports/Estilos de juego del freestyle.md`
    del repo privado.
  · **Tres lugares**: el 1.º lo elige cada uno en la página (una vez por temporada); el 2.º y el 3.º se ganan en los
    eventos de estilo de DRA (Dlx, 17/11/2026: «que el segundo y tercero se ganen por un evento específico en DRA y
    ya está»; Competencias quedó afuera).
  · **Niveles del 0 al 3**: 0 elegido sin nada más · 1 jugaste un evento de ese estilo · y cada vez que quedas en el
    cuarto de arriba de la llave (la regla de la Racha) subes uno. Vuelven a 0 cada temporada; lo desbloqueado queda.
  · **Nunca toca el Score**: el número de cada carta mide lo que esa carta mide.

DE DÓNDE SALE: `datos/estilos.json`, `{clave: [[estilo, nivel], …]}` en el orden de los lugares (1, 2, 3). Hoy está
vacío —nadie eligió todavía—, así que la columna no dibuja nada: *sin dato no hay pieza*. Lo llenan la página (el 1.º)
y el ciclo (el 2.º y el 3.º, `bot/juegos.py`).

⚠️ VIVE EN LA CARPETA DE LA COMPETITIVA Y NO EN `comun/`, A PROPÓSITO. Todo lo de `comun/` y de
`02_Competitivo/v2/estilos/` entra en la huella de las CUATRO cartas (`comun/huella_codigo.py`): ponerlo ahí redibujaba
la Temporada, la Servidor y la de País sin cambiarles un píxel. Por lo mismo los dos íconos nuevos (Showman y Frío)
van acá como SVG y no como archivos en `estilos/`. El día que otra carta los use, se mudan a `comun/` y se paga.

⚠️ CÓMO SE POSICIONA —Dlx: «bien posicionado, acuérdate»—, medido en la carta de verdad:
    la pastilla del rango termina en y=143,2 · la fila de stats («EFI») empieza en y=299,2 · la línea del marco está
    en x=10,5 (la misma que centraba los rombos de eventos)
  → banda libre con 6 px de aire: y 149,2 a 293,2 (144 px). Tres LUGARES FIJOS, y el tamaño sale del PEOR caso —tres
    estilos en nivel 3, con sus dos aros— para que ni así se toquen (3 px entre uno y otro). Cada forma se centra por
    su TINTA (con el aro), no por la caja. Los aros son un corrimiento parejo del contorno —trazos apilados con
    esquina redonda— y no la forma agrandada desde el centro: así el del escudo va a la misma distancia arriba, al
    costado y en la punta.
"""
import io
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARCH = os.path.join(RAIZ, 'datos', 'estilos.json')

# ── el catálogo ─────────────────────────────────────────────────────────────────────────────────────────────────────
# clave -> (nombre, familia, ícono, qué es). El ícono es el nombre del archivo de `estilos/` o una clave de `SVG`.
CATALOGO = {
    'punchline':   ('Punchline', 'ATAQUE', 'punchline', 'Cierra cada patrón con un remate que pega'),
    'burla':       ('Burla', 'ATAQUE', 'humor', 'Hace reír a todos a costa del rival'),
    'agresividad': ('Agresividad', 'ATAQUE', 'agresividad', 'Encara al rival y no le da respiro'),
    'showman':     ('Showman', 'ATAQUE', 'showman', 'Se gana al público y al chat con personaje y actitud'),
    'delivery':    ('Delivery', 'ATAQUE', 'delivery', 'Voz firme, énfasis y seguridad en cada barra'),
    'poeta':       ('Poeta', 'ATAQUE', 'filosofico', 'Metáforas e ideas que de pronto se roban la ronda'),
    'flow':        ('Flow', 'FOCO', 'flow', 'Se acomoda a la base: ritmo, cadencia y silencios'),
    'doble_tempo': ('Doble tempo', 'FOCO', 'dobletempo', 'Rapea al doble de velocidad sin salirse del ritmo'),
    'metrica':     ('Métrica', 'FOCO', 'metricas', 'Juega con las sílabas y encaja todo al milímetro'),
    'estructuras': ('Estructuras', 'FOCO', 'estructuras', 'Ordena las rimas: internas, multisílabas y esquemas largos'),
    'tecnicas':    ('Técnicas', 'FOCO', 'tecnicas', 'Recursos: encadenados, aliteraciones, rimas espejo'),
    'cazafla':     ('Cazaflá', 'FOCO', 'cazafla', 'Va a la música y al flow antes que al remate'),
    'respuesta':   ('Respuesta', 'CABEZA', 'respuesta', 'Contesta en el momento lo que acaba de decir el rival'),
    'ingenio':     ('Ingenio', 'CABEZA', 'ingenio', 'Juegos de palabras y dobles sentidos que nadie ve venir'),
    'coherencia':  ('Coherencia', 'CABEZA', 'coherencia', 'Sus barras tienen hilo: un argumento, no rimas sueltas'),
    'conceptos':   ('Conceptos', 'CABEZA', 'conceptos', 'Toma una idea o la temática y la desarrolla'),
    'referencias': ('Referencias', 'CABEZA', 'referencias', 'Mete cine, series, anime o fútbol en sus barras'),
    'frio':        ('Frío', 'CABEZA', 'frio', 'No se altera nunca: aguanta la presión'),
}
FAMILIAS = ('ATAQUE', 'FOCO', 'CABEZA')
FORMA_DE = {'ATAQUE': 'rombo', 'FOCO': 'circulo', 'CABEZA': 'escudo'}
NIVELES = (0, 1, 2, 3)
LUGARES = 3

_RAMAS = ''.join('<g transform="rotate(%d 50 50)"><line x1="50" y1="50" x2="50" y2="7"/>'
                 '<polyline points="37,17 50,29 63,17"/></g>' % a for a in range(0, 360, 60))
SVG = {
    # un copo de seis brazos: la calma
    'frio': ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g stroke="#fff" stroke-width="8" '
             'stroke-linecap="round" stroke-linejoin="round" fill="none">%s</g><circle cx="50" cy="50" r="9" '
             'fill="#fff"/></svg>' % _RAMAS),
    # una galera con un destello: el que hace show
    'showman': ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#fff">'
                '<path d="M30 12 Q50 6 70 12 L67 50 L33 50 Z"/><path d="M33 58 L67 58 L66 70 L34 70 Z"/>'
                '<path d="M6 74 Q50 62 94 74 Q92 86 50 88 Q8 86 6 74 Z"/>'
                '<path d="M84 8 L87 17 L96 20 L87 23 L84 32 L81 23 L72 20 L81 17 Z"/></g></svg>'),
}

# ── la geometría (viewBox de 100) ───────────────────────────────────────────────────────────────────────────────────
FORMA = {
    'rombo':   'M50 4 L96 50 L50 96 L4 50 Z',
    'circulo': 'M50 5 A45 45 0 1 1 49.9 5 Z',
    'escudo':  'M14 6 L86 6 L86 34 Q86 60 50 97 Q14 60 14 34 Z',
}
CAJA = {'rombo': (4, 4, 96, 96), 'circulo': (5, 5, 95, 95), 'escudo': (14, 6, 86, 97)}   # la tinta de cada camino
ICO = {'rombo': 46, 'circulo': 56, 'escudo': 50}        # el ícono, en % del lado (el rombo tiene menos lugar adentro)
ICO_Y = {'rombo': 50, 'circulo': 50, 'escudo': 42}      # el centro óptico del escudo está más arriba
SALE = {0: 2, 1: 2.5, 2: 7, 3: 12}                      # cuánto sale el trazo más externo de cada nivel, en unidades
MARGEN = 14                                             # el viewBox va de -14 a 114: la caja cubre los aros

BANDA = (149.2, 293.2)
LINEA_X = 10.5
HUECO = 3.0
ALTO_MAX = max(y1 - y0 for _, y0, _, y1 in CAJA.values())                      # 92 u
LUGAR = (BANDA[1] - BANDA[0] - (LUGARES - 1) * HUECO) / LUGARES                # 46 px
LADO = LUGAR / (ALTO_MAX + 2 * SALE[3]) * 100                                  # 39,7 px: el lado del viewBox
CENTRO = tuple(BANDA[0] + LUGAR / 2 + i * (LUGAR + HUECO) for i in range(LUGARES))
OSC = 'rgba(10,10,18,.94)'

# ── de quién es cada uno ────────────────────────────────────────────────────────────────────────────────────────────
_cache = None


def todos():
    """`{clave: [[estilo, nivel], …]}`, o `{}` sin archivo."""
    global _cache
    if _cache is None:
        try:
            with io.open(ARCH, encoding='utf-8') as f:
                d = json.load(f)
            _cache = d if isinstance(d, dict) else {}
        except (OSError, ValueError):
            _cache = {}
    return _cache


def de(clave):
    """Los estilos de `clave`, en orden de lugar: `[(estilo, nivel), …]` (hasta 3). Lo que no está en el catálogo, un
    nivel raro o un estilo repetido se saltea: la carta no dibuja un dato que no se entiende."""
    x = todos().get(str(clave or ''))
    out, vistos = [], set()
    for e in x if isinstance(x, list) else []:
        if (isinstance(e, (list, tuple)) and len(e) == 2 and e[0] in CATALOGO and e[1] in NIVELES
                and e[0] not in vistos):
            out.append((e[0], e[1]))
            vistos.add(e[0])
    return out[:LUGARES]


def sello(clave):
    """Lo que entra al sello de la Competitiva (`bot/que_cambio.huellas()`): elegir o subir un estilo la redibuja."""
    return tuple(de(clave))


# ── el dibujo ───────────────────────────────────────────────────────────────────────────────────────────────────────
def _icono_url(icono, archivos):
    if icono in SVG:
        import base64
        return 'data:image/svg+xml;base64,' + base64.b64encode(SVG[icono].encode('utf-8')).decode()
    return archivos.get(icono, '')


def _cuerpo(forma, nivel, g):
    """El cuerpo y sus aros, y cómo va el ícono: (svg, opacidad, color)."""
    d = FORMA[forma]
    j = 'stroke-linejoin="round"'
    if nivel == 0:      # elegido, sin nada más: el cuerpo oscuro del 1, con el borde punteado y el ícono un poco apagado
        # 🔆 hasta el 19/11/2026 era casi transparente —el relleno al 55 %, el borde al 60 % y el ícono al 45 %— y sobre la
        # carta no se veía (Dlx: «ese playstyle nivel 0 quisiera que no sea transparente, que se note un poco más»). Lo que lo
        # separa del 1 sigue siendo el borde punteado. La página lo dibuja igual (`Insignia` de web/src/juego.jsx)
        return ('<path d="%s" fill="url(#%s)" style="stroke:var(--acc)" stroke-width="4.5" stroke-dasharray="8 5" %s/>'
                % (d, g, j)), .8, '#fff'
    if nivel == 1:      # oscuro, como los rombos de antes
        return ('<path d="%s" fill="url(#%s)" style="stroke:var(--acc)" stroke-width="5" %s/>' % (d, g, j)), 1, '#fff'
    if nivel == 2:      # media luz y un aro
        aro = ('<path d="%s" fill="none" style="stroke:var(--acc)" stroke-width="14" %s/>'
               '<path d="%s" fill="none" stroke="%s" stroke-width="8" %s/>' % (d, j, d, OSC, j))
        return (aro + '<path d="%s" fill="url(#%s)"/><path d="%s" style="fill:var(--acc);stroke:var(--acc)" '
                'fill-opacity=".42" stroke-width="5" %s/>' % (d, g, d, j)), 1, '#fff'
    # 3: lleno del color del rango, con un aro blanco y otro del rango
    aros = ('<path d="%s" fill="none" style="stroke:var(--acc)" stroke-width="24" %s/>'
            '<path d="%s" fill="none" stroke="%s" stroke-width="18" %s/>'
            '<path d="%s" fill="none" stroke="#fff" stroke-width="14" %s/>'
            '<path d="%s" fill="none" stroke="%s" stroke-width="8" %s/>' % (d, j, d, OSC, j, d, j, d, OSC, j))
    return aros + '<path d="%s" style="fill:var(--acc);stroke:#fff" stroke-width="5" %s/>' % (d, j), 1, '#0b0b12'


def insignia(estilo, nivel, uid, archivos, lugar=None, lado=None):
    """Un estilo, dibujado. Con `lugar` va posicionado en la columna de la carta; sin él, suelto (la página)."""
    nombre, familia, icono, _ = CATALOGO[estilo]
    forma = FORMA_DE[familia]
    L = lado or LADO
    g = 'eg' + uid
    cuerpo, op, col = _cuerpo(forma, nivel, g)
    caja = L * (100 + 2 * MARGEN) / 100                 # px de la caja, aros incluidos
    pos = ''
    if lugar is not None:
        x0, y0, x1, y1 = CAJA[forma]
        cx, cy = (x0 + x1) / 2 + MARGEN, (y0 + y1) / 2 + MARGEN       # centro de la tinta, en la caja con margen
        pos = 'left:%.2fpx;top:%.2fpx;' % (LINEA_X - cx * L / 100, CENTRO[lugar] - cy * L / 100)
    s = ICO[forma] * L / 100
    icx, icy = (50 + MARGEN) * L / 100, (ICO_Y[forma] + MARGEN) * L / 100
    return ('<div class="eb" title="%s · nivel %d" style="%swidth:%.2fpx;height:%.2fpx">'
            '<svg viewBox="-%d -%d %d %d"><defs><linearGradient id="%s" x1="0" y1="0" x2="1" y2="1">'
            '<stop offset="0" stop-color="#090910"/><stop offset="1" stop-color="#22223a"/></linearGradient></defs>'
            '%s</svg><i style="--m:url(%s);left:%.2fpx;top:%.2fpx;width:%.2fpx;height:%.2fpx;opacity:%s;'
            'background:%s"></i></div>'
            % (nombre, nivel, pos, caja, caja, MARGEN, MARGEN, 100 + 2 * MARGEN, 100 + 2 * MARGEN, g, cuerpo,
               _icono_url(icono, archivos), icx - s / 2, icy - s / 2, s, s, op, col))


def columna(estilos, uid, archivos):
    """La columna izquierda de la carta. Sin estilos, nada (sin dato no hay pieza)."""
    if not estilos:
        return ''
    return '<div class="est">%s</div>' % ''.join(
        insignia(e, n, '%s_%d' % (uid, i), archivos, lugar=i) for i, (e, n) in enumerate(estilos[:LUGARES]))


WEB = os.path.join(RAIZ, 'web', 'src', 'estilos_juego.json')


def para_la_web():
    """El catálogo para el Inventario de la página (`web/src/estilos_juego.json`): familias, formas y cada estilo con su
    ícono chico embebido (96 px: alcanza para la grilla y pesa poco). Se regenera con `--web` y se commitea, como
    `tags_catalogo.json`. ⚠️ No dice de quién es cada uno: eso lo pide la página con tu sesión (`/avisos/juego-mio`)."""
    import base64
    from PIL import Image
    est = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'estilos')
    iconos = {}
    for k, (_, _, icono, _) in CATALOGO.items():
        if icono in SVG:
            iconos[k] = 'data:image/svg+xml;base64,' + base64.b64encode(SVG[icono].encode('utf-8')).decode()
            continue
        im = Image.open(os.path.join(est, icono + '.png')).convert('RGBA')
        im.thumbnail((96, 96), Image.LANCZOS)
        # es una máscara: sólo importa el alfa. Blanco parejo + alfa (LA) pesa la mitad que el RGBA
        la = Image.merge('LA', (Image.new('L', im.size, 255), im.getchannel('A')))
        b = io.BytesIO()
        la.save(b, 'PNG', optimize=True)
        iconos[k] = 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
    return {
        'familias': [[f, FORMA_DE[f]] for f in FAMILIAS],
        'formas': FORMA, 'caja': CAJA, 'ico': ICO, 'ico_y': ICO_Y, 'margen': MARGEN,
        'estilos': [[k, v[0], v[1], v[3], iconos[k]] for k, v in CATALOGO.items()],
    }


def _juegos_del_worker():
    """La copia de la lista que tiene el Worker (`JUEGOS` en `bot/avisos.js`), o None si no se encuentra."""
    import re
    try:
        with io.open(os.path.join(RAIZ, 'bot', 'avisos.js'), encoding='utf-8') as f:
            m = re.search(r"export const JUEGOS = \[([^\]]*)\]", f.read())
    except OSError:
        return None
    return re.findall(r"'([a-z_]+)'", m.group(1)) if m else None


def _self_check():
    import sys
    mal = 0

    def ok(c, que):
        nonlocal mal
        print('   %s %s' % ('✅' if c else '❌', que))
        mal += 0 if c else 1

    fam = {f: [k for k, v in CATALOGO.items() if v[1] == f] for f in FAMILIAS}
    ok(len(CATALOGO) == 18 and all(len(v) == 6 for v in fam.values()), '18 estilos, seis por familia')
    est = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'estilos')
    sin = [k for k, v in CATALOGO.items() if v[2] not in SVG and not os.path.exists(os.path.join(est, v[2] + '.png'))]
    ok(not sin, 'cada estilo tiene su ícono%s' % (' (faltan: %s)' % sin if sin else ''))
    global _cache
    _cache = {'ana': [['punchline', 3], ['flow', 9], ['inventado', 1], ['punchline', 2], ['frio', 0], ['burla', 1],
                      ['ingenio', 2]],
              'beto': 'roto'}
    ok(de('ana') == [('punchline', 3), ('frio', 0), ('burla', 1)],
       'de(): saltea el nivel raro, lo que no está en el catálogo y el repetido, y corta en tres')
    ok(de('beto') == [] and de('nadie') == [] and columna([], 'x', {}) == '', 'sin estilos, la columna no dibuja nada')
    # la geometría: el peor caso entra en la banda y no se toca
    alto3 = (ALTO_MAX + 2 * SALE[3]) * LADO / 100
    arriba, abajo = CENTRO[0] - alto3 / 2, CENTRO[-1] + alto3 / 2
    ok(arriba >= BANDA[0] - .01 and abajo <= BANDA[1] + .01,
       'tres en nivel 3 entran en la banda (%.1f a %.1f, la banda es %.1f a %.1f)' % (arriba, abajo, *BANDA))
    huecos = [CENTRO[i + 1] - CENTRO[i] - alto3 for i in range(LUGARES - 1)]
    ok(all(h >= HUECO - .01 for h in huecos), 'y no se tocan: %s px entre uno y otro' % ', '.join('%.1f' % h for h in huecos))
    # la caja con margen cubre el aro más grande (si no, el exportador lo recorta: mide las cajas, no la tinta)
    ok(all(CAJA[f][0] - SALE[3] >= -MARGEN and CAJA[f][2] + SALE[3] <= 100 + MARGEN
           and CAJA[f][1] - SALE[3] >= -MARGEN and CAJA[f][3] + SALE[3] <= 100 + MARGEN for f in CAJA),
       'la caja de cada estilo cubre sus aros')
    h = insignia('respuesta', 2, 't', {'respuesta': 'data:x'}, lugar=1)
    x0, y0, x1, y1 = CAJA['escudo']
    izq = float(h.split('left:')[1].split('px')[0])
    centro_x = izq + ((x0 + x1) / 2 + MARGEN) * LADO / 100
    ok(abs(centro_x - LINEA_X) < .05, 'la tinta queda centrada sobre la línea del marco (x=%.2f)' % centro_x)
    # la copia del Worker: si se separan, en la página se elige un estilo que la carta no conoce (o al revés)
    jw = _juegos_del_worker()
    ok(jw == list(CATALOGO), 'la lista del Worker (`JUEGOS` en bot/avisos.js) es la misma y en el mismo orden'
       + ('' if jw == list(CATALOGO) else ' — allá: %s' % jw))
    # y la de la página: el JSON commiteado tiene que ser el de hoy (se regenera con `--web`)
    try:
        with io.open(WEB, encoding='utf-8') as f:
            w = json.load(f)
        igual = [e[:4] for e in w.get('estilos', [])] == [[k, v[0], v[1], v[3]] for k, v in CATALOGO.items()]
    except (OSError, ValueError):
        igual = False
    ok(igual, 'el catálogo de la página (`web/src/estilos_juego.json`) está al día — si no: `python %s --web`'
       % os.path.relpath(os.path.abspath(__file__), RAIZ).replace('\\', '/'))
    _cache = None
    print('   %s' % ('todo bien' if not mal else '%d mal' % mal))
    sys.exit(1 if mal else 0)


if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    if '--web' in sys.argv:
        with io.open(WEB, 'w', encoding='utf-8', newline='\n') as f:
            json.dump(para_la_web(), f, ensure_ascii=False, separators=(',', ':'))
            f.write('\n')
        print('escribí %s (%d KB)' % (os.path.relpath(WEB, RAIZ), os.path.getsize(WEB) // 1024))
        sys.exit(0)
    _self_check()

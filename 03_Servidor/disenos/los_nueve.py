"""LOS NUEVE FONDOS APROBADOS de la carta Servidor.

DEFINICION CANONICA. Si algo se rehace, sale de aca.

    python los_nueve.py     ->  los_nueve.png

Cerrado el 31/07/2026. Los nueve estan decididos. Lo que sigue son los MARCOS,
de a uno, y SIN METAL: ese lenguaje es de la Competitiva y confundiria las dos
cartas de la misma persona.

Tres se rehicieron sobre el final y esta es la version buena:

  TWR   franjas espejadas a 215 (antes 126)
  FRZ   dos cortes con filos encendidos, SIN esmerilado
  FFA   halftone de puntos magenta sobre casi negro
"""
import asyncio, base64, json, math, os, re, sys
from playwright.async_api import async_playwright

# 🔴 SE CALCULA, NO SE CLAVA. Aca habia una ruta absoluta a la
# maquina de Dlx, y este archivo NO es exploracion: esta en el camino
# vivo de `03_Servidor/generar.py`. Lo destapo la primera corrida del
# ciclo en Actions con trabajo de verdad -- 12 cartas de 13 con
# FileNotFoundError y una ruta de Windows adentro de un runner Linux.
# Ver la nota larga en `todos_sv.py`.
SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(SCR))
TEX = os.path.join(SCR, 'texturas')
sys.path.insert(0, BASE)
from comun.siluetas import PICO
from comun import emblema, divisor as DIV

# La silueta NO se define aca: sale de comun/siluetas.py. Antes esta hoja
# tenia su propio polygon del escudo biselado, y cuando la carta paso al
# pico trazado esta se quedo dibujando la forma vieja sin avisar. Una
# silueta copiada se separa de la original: por eso ahora se importa.
W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN


def mover(d, dy):
    """Baja un path sumandole dy a cada Y. Todos los pares vienen 'x,y'."""
    return re.sub(r'(-?[\d.]+),(-?[\d.]+)',
                  lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + dy), d)


# Se mueve UNA vez y se usa igual en el recorte y en el borde. Poner el
# desplazamiento como transform en los dos lados no da lo mismo: el
# clip-path de un <g> se evalua en el espacio que deja su propio transform,
# y el borde termina cortado a los costados.
SIL = mover(PICO.d, MARGEN)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))


def cara_muestra():
    """La cara de las hojas de diseño, o un cartel si no está.

    🔴 ESTO ERA `FOTO = b64(.../av_valen.png)` AL NIVEL DEL MODULO, Y
    TIRABA EL GENERADOR DE PRODUCCION. `03_Servidor/generar.py` importa
    `todos_sv`, que importa esto: sin `av_valen.png` en disco, la carta
    Servidor de las 59 personas **no se dibuja**, con un
    `FileNotFoundError` en un `import`.

    ⚠️ Y `FOTO` no la usaba nadie — era la unica linea que la leia. Un
    dato muerto cargado al importar, que ademas es **la foto de una
    persona real**: se cayo al armar el arbol del repo publico, donde esa
    foto no va justamente porque es de alguien.

    ⚠️ ES PEREZOSA A PROPOSITO. Importar un modulo no tiene que tocar el
    disco: lo que decide si hace falta la cara es *dibujar una hoja de
    diseño*, no *importar*. Es la misma regla que el navegador y el
    espejo de las caras — la precondicion es dibujar, no arrancar.

    ⚠️ Y SI FALTA, EL CARTEL LO DICE. Poner otra foto con el mismo nombre
    en silencio seria peor: el que compara una hoja contra la referencia
    veria otra cara sin saber por que.
    """
    p = os.path.join(SCR, 'av_valen.png')
    if os.path.exists(p):
        return b64(p)
    import base64 as _b64
    import io as _io
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (256, 256), (34, 37, 46))
    d = ImageDraw.Draw(im)
    d.ellipse((88, 54, 168, 134), fill=(62, 67, 80))
    d.ellipse((48, 148, 208, 300), fill=(62, 67, 80))
    d.text((60, 214), 'MUESTRA', fill=(150, 156, 170))
    d.text((34, 230), 'no es una foto real', fill=(110, 116, 130))
    b = _io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + _b64.b64encode(b.getvalue()).decode()


def esc(sv):
    return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))


def sil(sv): return b64(os.path.join(BASE, 'comun', 'logos_sv', f'sv_{sv.lower()}.png'))
def tx(n): return b64(os.path.join(TEX, n + '.png'))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


#: DDF: (base, acento). Ver su fondo en `defs()`
DDF_COLORES = ('#005E80', '#5FA8FF')
#: 🌌 LA LÍNEA DE OTRO COLOR QUE LA BASE: el marco y la curva salen de este propio y no de la base.
#: DDF: su logo es MORADO y el morado de la carta era el de FFA (ΔE 2,6). Dlx, 03/10/2026: «debería
#: aún tener el color morado en la línea pero otro tono, más fuerte o menos, no todo celeste». Con
#: #720BD9 la línea da #B16BF8: a ΔE 20 del marco de FFA, 13 del de FFS y 12 del magenta de FFA
LINEA = {'DDF': '#720BD9'}


#: 🏛️ LA ACADEMIA: (amarillo de su logo, dorado claro de acento). Ver su fondo en `acad_fondo()`
ACAD_COLORES = ('#EACB0C', '#FFE066')


def acad_templo():
    """La base del templo de la ACADEMIA, en SVG: dos columnas estriadas y la escalinata.

    ⚠️ EN SVG Y NO CON DEGRADÉS, porque con degradés no se leía: la primera vuelta (04/10/2026) eran bandas
    de CSS y salían tres rayas al pie —lo mismo que las tres líneas de DRA— y unas barras sueltas arriba.
    Un fuste con estrías, su basa y escalones con cara y contrahuella se leen como templo aun chicos.
    Las coordenadas son las de la carta (300 × 467).
    """
    oro = '#F2D33C'

    def columna(x):
        # el fuste (24 de ancho), sus estrías, la luz dorada del lado de adentro y la basa
        adentro = 'url(#luzI)' if x < 150 else 'url(#luzD)'
        estrias = ''.join(f'<rect x="{x + k:.1f}" y="296" width="1.6" height="92" fill="#0B0A05" opacity=".75"/>'
                          for k in (4.5, 9.5, 14.5, 19.5))
        return (f'<rect x="{x}" y="296" width="24" height="92" fill="url(#fuste)"/>{estrias}'
                f'<rect x="{x}" y="296" width="24" height="92" fill="{adentro}"/>'
                f'<rect x="{x - 3}" y="384" width="30" height="5" fill="url(#piedra)"/>'
                f'<rect x="{x - 3}" y="384" width="30" height="1.2" fill="{oro}" opacity=".85"/>')

    def escalon(x, y, w, h):
        return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="url(#piedra)"/>'
                f'<rect x="{x}" y="{y}" width="{w}" height="1.4" fill="{oro}"/>')

    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 467" width="300" height="467"><defs>'
           '<linearGradient id="fuste" x1="0" x2="1"><stop offset="0" stop-color="#1A170C"/>'
           '<stop offset=".5" stop-color="#2E2914"/><stop offset="1" stop-color="#14120A"/></linearGradient>'
           f'<linearGradient id="luzI" x1="0" x2="1"><stop offset=".55" stop-color="{oro}" stop-opacity="0"/>'
           f'<stop offset="1" stop-color="{oro}" stop-opacity=".55"/></linearGradient>'
           f'<linearGradient id="luzD" x1="0" x2="1"><stop offset="0" stop-color="{oro}" stop-opacity=".55"/>'
           f'<stop offset=".45" stop-color="{oro}" stop-opacity="0"/></linearGradient>'
           '<linearGradient id="piedra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A4227"/>'
           '<stop offset=".35" stop-color="#2A2514"/><stop offset="1" stop-color="#0E0C06"/></linearGradient></defs>'
           + columna(9) + columna(267)
           + escalon(46, 389, 208, 9) + escalon(26, 398, 248, 10) + escalon(8, 408, 284, 11)
           + '</svg>')
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode('utf-8')).decode()


def acad_fondo(A):
    """El templo de la ACADEMIA, de noche, sobre mármol negro.

    🏛️ Dlx, 04/10/2026: *«colores amarillo y negro para la tarjeta»* y *«hazla con un diseño único como lo
    que hiciste con DDF»*. Su logo es un templo griego —el frontón y cuatro columnas— en un círculo amarillo.

    🔑 EL TECHO EN PUNTA DE LA CARTA YA ES EL FRONTÓN y el escudo, su remate. Arriba manda el amarillo —el
    brillo y el lavado salen del color propio, y la foto tapa el medio—, así que el templo vive en el PANEL DE
    ABAJO, que se ve entero: una columna estriada en cada borde, con la luz dorada del lado de adentro, paradas
    sobre la escalinata. El TAG queda sobre el escalón de arriba y la escalinata no toca el UL (lo que Dlx le
    pidió al planeta de DDF). Ver `acad_templo()`.

    ⚠️ El mármol —las vetas doradas— va en la capa extra, encima de todo esto.
    """
    return ','.join([
        f'url({acad_templo()}) 0 0/300px 467px no-repeat',
        # la luz que baja de la lámpara del frontón, apenas
        'radial-gradient(ellipse 70% 26% at 50% 16%,rgba(234,203,12,.16),transparent 72%)',
        'linear-gradient(172deg,#24211A 0%,#121109 46%,#060605 100%)',
    ])


def ddf_fondo(A, B):
    """La galaxia de DDF: estrellas sin grilla, la nebulosa y el planeta al pie.

    ⚠️ LAS ESTRELLAS SON CINCO MOSAICOS DE TAMAÑOS QUE NO SE DIVIDEN ENTRE SÍ
    (97×89, 71×67, 43×53, 37×31, 173×151): así no se arma una grilla a la vista, que
    es justo lo que hace la trama de FFA. Sin imagen: es CSS y pesa nada.
    """
    def est(x, y, r, c, tw, th):
        return (f'radial-gradient(circle at {x}px {y}px,{c} 0 {r}px,transparent {r + .7:.1f}px) '
                f'0 0/{tw}px {th}px')
    h = B.lstrip('#')
    rb = ','.join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))
    return ','.join([
        est(23, 31, .9, 'rgba(255,255,255,.95)', 97, 89),
        est(61, 13, .7, 'rgba(235,225,255,.70)', 71, 67),
        est(11, 42, .5, 'rgba(255,255,255,.42)', 43, 53),
        est(29, 7, .45, 'rgba(255,255,255,.30)', 37, 31),
        est(120, 70, 1.3, f'rgba({rb},.95)', 173, 151),
        # el planeta: oscuro adentro y con el borde encendido, saliendo al pie
        f'radial-gradient(ellipse 165% 46% at 50% 112%,#06030E 0 60%,rgba({rb},.90) 60.5%,'
        f'rgba({rb},.42) 61.6%,rgba({rb},.16) 63.4%,rgba({rb},.05) 66%,transparent 70%)',
        # la nebulosa, en la mitad de abajo: arriba va la foto
        f'radial-gradient(ellipse 72% 34% at 80% 66%,rgba(156,21,214,.50),transparent 72%)',
        f'radial-gradient(ellipse 62% 30% at 16% 80%,rgba(72,96,255,.30),transparent 74%)',
        f'linear-gradient(170deg,{t(A, .22)} 0%,{A} 42%,#07040F 100%)',
    ])


def _linea(x):
    """La línea que separa la foto del panel, en el marco de la carta de verdad (300 × 487).

    Es la cuenta de `todos_sv.camino()` —el perfil de `comun/divisor.py` sobre la silueta— hecha acá,
    porque `todos_sv` importa este archivo. Medido contra `camino()`: 0,12 px de diferencia, como mucho.
    """
    base, sube = DIV.Y_EXTREMOS * PICO.h, DIV.RECORRIDO * PICO.w * 1.3
    return base - DIV.altura(x / 300) * sube + emblema.MARGEN


#: 🎨 los chorreados de URBAN: (x, ancho, largo), puestos a mano. Ver `urbf_pared()`
URBF_CHORROS = ((9, 9.5, 128), (24, 5, 64), (38, 10.5, 96), (55, 4.5, 30), (70, 7.5, 22), (88, 5, 13),
                (118, 6, 8), (171, 5, 10), (206, 6, 16), (226, 8, 20), (243, 4.5, 26), (259, 10, 104),
                (276, 5.5, 46), (291, 9, 136))


def urbf_pared():
    """La pared de URBAN: la línea de la carta chorrea pintura naranja sobre concreto oscuro.

    🎨 Dlx, 04/10/2026, mirando la vista previa: *«me gusta la nueva»*. Sale de su logo, la «UK» con corona,
    que tiene los chorreados naranjas. Arriba manda la foto, así que el gesto vive en el PANEL: el borde de
    la pintura sigue la línea y de ahí cuelgan catorce chorreados, cada uno con su brillo y su gota.

    ⚠️ ESTÁN PUESTOS A MANO, NO AL AZAR. Al azar salían parejos —un PEINE: fue la primera vuelta— y cada
    corrida daba otra carta. En el medio son cortos para que se lea el nombre; en las puntas, largos.
    Entre x=62 y 240 ninguno baja de y=350, así que no tocan los círculos aunque sean cuatro, ni el TAG
    ni el UL (lo que Dlx le pidió al planeta de DDF).

    ⚠️ VA EN EL MARCO DE LA CARTA DE VERDAD (300 × 487), no en el de 467 de las hojas de este archivo:
    ahí se calcula la línea (`_linea()`), y ahí se midió que el borde le cae justo debajo.
    """
    def chorro(x, w, largo):
        # el cuello que sale del borde, el tallo y la gota de abajo, un poco más ancha
        r, y0 = w / 2, _linea(x) + 5
        rb = r * 1.22
        yb = y0 + largo - rb
        d = (f'M{x - r - 3.5:.1f},{y0 - 1:.1f} Q{x - r:.1f},{y0 - 1:.1f} {x - r:.1f},{y0 + 4:.1f} '
             f'L{x - r:.1f},{yb:.1f} A{rb:.1f},{rb:.1f} 0 1 0 {x + r:.1f},{yb:.1f} '
             f'L{x + r:.1f},{y0 + 4:.1f} Q{x + r:.1f},{y0 - 1:.1f} {x + r + 3.5:.1f},{y0 - 1:.1f} Z')
        out = (f'<path d="{d}" fill="#000" opacity=".45" transform="translate(1.2 1.8)" filter="url(#som)"/>'
               f'<path d="{d}" fill="url(#pin)"/>')
        if largo > 9:
            # el brillo: una raya clara a la izquierda del tallo y un punto en la gota
            out += (f'<path d="M{x - r * .42:.1f},{y0 + 3:.1f} L{x - r * .42:.1f},{yb - 1:.1f}" '
                    f'stroke="#FFE6BF" stroke-width="{max(.8, w * .16):.1f}" stroke-linecap="round" opacity=".75"/>'
                    f'<circle cx="{x - rb * .38:.1f}" cy="{yb + rb * .05:.1f}" r="{max(.7, rb * .22):.1f}" '
                    'fill="#FFF1D9" opacity=".8"/>')
        return out

    linea = ' L'.join(f'{x},{_linea(x):.1f}' for x in range(0, 301, 5))
    # el borde mojado ondula un poco: no es una regla
    arriba = ' L'.join(f'{x},{_linea(x) - 2:.1f}' for x in range(0, 301, 5))
    abajo = ' L'.join(f'{x},{_linea(x) + 5.5 + 1.6 * math.sin(x / 9) + 1.1 * math.sin(x / 3.7):.1f}'
                      for x in range(300, -1, -5))
    borde = f'M{arriba} L{abajo} Z'
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 487" width="300" height="487"><defs>'
           '<linearGradient id="pin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFA432"/>'
           '<stop offset=".55" stop-color="#F07E0C"/><stop offset="1" stop-color="#C95603"/></linearGradient>'
           '<linearGradient id="mur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1F1915"/>'
           '<stop offset="1" stop-color="#0C0A08"/></linearGradient>'
           '<filter id="som" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.1"/>'
           '</filter></defs>'
           f'<path d="M{linea} L300,487 L0,487 Z" fill="url(#mur)"/>'
           f'<path d="{borde}" fill="#000" opacity=".45" transform="translate(0 1.6)" filter="url(#som)"/>'
           f'<path d="{borde}" fill="url(#pin)"/>'
           + ''.join(chorro(*c) for c in URBF_CHORROS)
           # dos gotas que se soltaron
           + '<circle cx="24" cy="412" r="1.9" fill="#E9740A"/><circle cx="276" cy="398" r="1.6" fill="#E9740A"/>'
           + '</svg>')
    return 'data:image/svg+xml;base64,' + base64.b64encode(svg.encode('utf-8')).decode()


# ══ LA DEFINICION CANONICA DE CADA FONDO ══
# sv: (acento, color base, fondo css, capa extra css, remate css, descripcion)
def defs():
    d = {}

    A, B = '#600816', '#F2E9E9'
    d['TFC'] = (B, A,
        f'repeating-linear-gradient(180deg,{A} 0 30px,{t(A,-.34)} 30px 60px)',
        '', '', 'bandas horizontales anchas')

    # ⚠️ EL CORTE SE CORRE A LA DERECHA: 54/58 -> 68/72. Dlx lo pidio.
    # El degrade va a 146deg —abajo y a la derecha— asi que subir las paradas
    # lo mueve en ESA direccion: se va a la derecha y tambien un poco abajo.
    # No hay forma de moverlo solo en horizontal sin cambiar el angulo, y
    # cambiar el angulo cambiaria la inclinacion del corte, que es lo que le
    # da caracter. Se prefirio conservar la inclinacion.
    A, B = '#C2540A', '#FFB03A'
    d['SR'] = (B, A,
        f'linear-gradient(146deg,{t(A,.14)} 0 62%,{B} 62% 66%,#1C1408 66% 100%)',
        '', '', 'corte diagonal naranja sobre negro, corrido a la derecha')

    # FFA · halftone de puntos + filo de neon + grano de estatica.
    # El anterior era solo un degrade de neon y quedaba muy cerca de TWR en
    # valor. El halftone le da material propio sin pasar por una textura.
    A, B = '#1A0630', '#EC48DC'
    d['FFA'] = (B, A,
        # La luz fosforescente SUBE DESDE EL PIE. Antes estaba arriba al
        # centro, que es justo donde va el emblema: quedaba tapada por el.
        'radial-gradient(circle at 1.5px 1.5px,rgba(236,72,220,.22) 1.1px,transparent 1.2px) 0 0/8px 8px,'
        'radial-gradient(ellipse 82% 30% at 50% 100%,rgba(236,72,220,.58),transparent 66%),'
        'linear-gradient(168deg,#190630 0%,#090315 100%)',
        f'background-image:url({tx("estatica")});background-size:cover;'
        'mix-blend-mode:soft-light;opacity:.14',
        'box-shadow:inset 0 0 0 2px rgba(236,72,220,.80),'
        'inset 0 0 30px rgba(236,72,220,.24)',
        'halftone magenta + filo de neón + grano')

    # TWR · las franjas van a 215, no a 126: espejadas, para que el rincon
    # oscuro caiga atras del numero y no al reves.
    A, B = '#C40E45', '#FF5C8A'
    d['TWR'] = (B, A,
        f'linear-gradient(215deg,{t(A,-.52)} 0 30%,{A} 30% 46%,'
        f'{t(B,-.15)} 46% 72%,{t(A,-.4)} 72% 100%)',
        f'background-image:url({sil("TWR")});background-size:128%;'
        'background-position:center 74%;background-repeat:no-repeat;'
        'opacity:.26;mix-blend-mode:overlay',
        '', 'franjas espejadas a 215° + fantasma de su silueta')

    A, B = '#2A3982', '#E8C86A'
    d['FTN'] = (B, A,
        f'linear-gradient(122deg,transparent 0 46%,rgba(232,200,106,.90) 46% 51%,'
        f'rgba(232,200,106,.26) 51% 66%,transparent 66%),'
        f'linear-gradient(166deg,{t(A,.22)} 0%,{A} 44%,{t(A,-.58)} 100%)',
        '', '', 'banda dorada al sesgo, ancha y baja')

    # FRZ · dos cortes al sesgo con los filos ENCENDIDOS, sobre el degrade
    # oscuro parejo. NO lleva esmerilado: era la unica carta clara de las
    # nueve y la textura la aclaraba todavia mas.
    A, B = '#0E5F5E', '#8FE8E0'
    d['FRZ'] = (B, A,
        f'linear-gradient(214deg,{t(A,.28)} 0 26%,{B} 26% 27.2%,transparent 27.2%),'
        f'linear-gradient(214deg,transparent 0 72%,{B} 72% 73.2%,{t(A,-.34)} 73.2% 100%),'
        f'linear-gradient(168deg,{t(A,.22)} 0%,{t(A,-.42)} 48%,{t(A,-.80)} 100%)',
        '', '', 'dos cortes al sesgo con filos encendidos')

    # URBF · corte blanco duro. Era el unico de los nueve sin textura ni
    # gesto duro: sus "tres capas de pegatina" eran tres degrades encimados,
    # o sea mas de lo mismo sobre un campo violeta grande y plano.
    #
    # 🟠 NARANJA DESDE EL 25/09/2026, y la textura es la misma. Dlx: «el
    # color de la tarjeta al naranja pero que la textura sea la misma». Su
    # logo nuevo —la «UK» con corona— es naranja, y #EA7206 es el tono mas
    # vivo del archivo (`comun/logos_color/urbf.png`). Era #7B44BF.
    #
    # 🎨 Y DESDE EL 04/10/2026 ES UNA PARED, no un corte. Dlx: «solo
    # reworkea el de URB» y, mirando la vista previa, «me gusta la nueva».
    # El panel es concreto oscuro y la línea divisoria chorrea pintura
    # naranja, como los chorreados de la «UK» de su logo: ver `urbf_pared()`.
    # La textura pasó de los rayones al concreto, que es la pared.
    #
    # ⚠️ SNAKE RAP TAMBIEN ES NARANJA (#C2540A) y los separa el dibujo, no el
    # tono: el suyo es un corte diagonal ancho sobre negro; este, la pintura
    # que chorrea sobre la pared.
    A, B = '#EA7206', '#FFFFFF'
    d['URBF'] = (B, A,
        f'url({urbf_pared()}) 0 0/300px 487px no-repeat,'
        f'linear-gradient(166deg,{t(A,.46)} 0%,{A} 42%,{t(A,-.50)} 100%)',
        f'background-image:url({tx("concreto")});background-size:cover;'
        'background-position:center;mix-blend-mode:overlay;opacity:.40',
        '', 'la pared: la línea chorrea pintura naranja sobre concreto oscuro')

    A, B = '#3D5BFF', '#FFFFFF'
    d['DRA'] = (B, A,
        f'linear-gradient(166deg,{t(A,.40)} 0%,{A} 42%,{t(A,-.70)} 100%)',
        f'background-image:url({tx("oxido")});background-size:cover;'
        'background-position:center;mix-blend-mode:overlay;opacity:.38',
        'background:linear-gradient(180deg,transparent 0 70%,'
        'rgba(255,255,255,.90) 70% 71.4%,transparent 71.4% 73%,'
        'rgba(255,255,255,.90) 73% 74.4%,transparent 74.4% 76%,'
        'rgba(255,255,255,.90) 76% 77.4%,transparent 77.4%)',
        'textura de óxido + tres líneas al pie')

    # EFA · el cobre de SU LOGO, no el marron que tenia.
    #
    # datos/colores_sv_marca.json ya decia EFA = #A95225 "del logo · cobre",
    # y la carta usaba #3A2412: 57.9 puntos de luz de diferencia. Medido
    # sobre la tinta del logo, sus dominantes son #A84800, #601800, #A87830
    # y #C09048; el #3A2412 no aparece por ningun lado.
    #
    # El cuero baja de cover/0.55 a 150px/0.30. Con el mosaico estirado a
    # 300x405 sus manchas quedaban enormes y se leia como camuflaje, no como
    # cuero. OJO: achicar el mosaico SUBE el grano medido —mas chico es mas
    # frecuencia—; lo que lo baja es la opacidad. Son dos cosas distintas y
    # aca se movieron las dos a proposito.
    A, B = '#A95225', '#E8A144'
    d['EFA'] = (B, A,
        f'linear-gradient(166deg,{t(A,.16)} 0%,{t(A,-.18)} 44%,{t(A,-.72)} 100%)',
        # ⚠️ background-repeat:repeat va EXPLICITO. La clase .cap trae
        # no-repeat, que hasta ahora daba igual porque todas las texturas
        # usaban cover o un porcentaje mayor a 100: se dibujaban una vez y
        # tapaban todo. Con un mosaico de 150px el no-repeat deja un solo
        # parche en el medio y el resto liso. Cada capa declara su repeat.
        f'background-image:url({tx("cuero")});background-size:150px;'
        'background-repeat:repeat;'
        'background-position:center;mix-blend-mode:soft-light;opacity:.30',
        'box-shadow:inset 0 0 0 4px #E8A144,inset 0 0 0 6px rgba(0,0,0,.55)',
        'cuero fino sobre el cobre del logo + vivo al borde')

    # FFS · Future Free Series (FFS LEAGUE), la décima. Dlx, 28/09/2026: «A ·
    # sí, como los otros cuatro», y el color «A · periwinkle claro #8E9BFF».
    #
    # ⚠️ SU LOGO ES EL MISMO LAVANDA QUE DRA (#6C6CE4 contra #5964E0, ΔE 3.8),
    # así que la carta no puede ser «otro azul»: va con un AÑIL más violeta y
    # oscuro que DRA (#2E2A78), y lo que la separa es el gesto —un GALÓN DE
    # ASCENSO, la V invertida que sube hacia el emblema: su liga tiene tabla
    # de ascenso— y el periwinkle claro de acento. La tela, porque es camiseta
    # (ninguna de las nueve la usa).
    A, B = '#2E2A78', '#8E9BFF'
    _g = f'transparent 0 calc(50% - 7px),{B} calc(50% - 7px) calc(50% + 7px),transparent calc(50% + 7px)'
    d['FFS'] = (B, A,
        f'linear-gradient(to bottom right,{_g}) left bottom/50% 44% no-repeat,'
        f'linear-gradient(to bottom left,{_g}) right bottom/50% 44% no-repeat,'
        f'linear-gradient(166deg,{t(A,.30)} 0%,{A} 44%,{t(A,-.72)} 100%)',
        f'background-image:url({tx("tela")});background-size:cover;'
        'background-position:center;mix-blend-mode:soft-light;opacity:.34',
        '', 'galón de ascenso periwinkle + tela de camiseta')

    # DDF · Dimensión del Freestyle, la undécima. Dlx, 03/10/2026: «Haz todo lo
    # necesario para que esta sea una buena inclusión», etiqueta ESPECTÁCULO.
    #
    # ⚠️ SU LOGO ES UNA GALAXIA VIOLETA, Y EL VIOLETA YA ESTÁ TOMADO. La primera
    # versión fue violeta y Dlx lo vio en seguida: «el morado ese es el mismo que
    # FFA». Medido donde se ve —el marco, `marco.claro(base)`— quedaba a ΔE 2,6
    # de FFA. Va con el AZUL ELÉCTRICO del borde del planeta de su logo (el
    # claro #00ADEC queda a 18 o más de los otros diez marcos); el violeta se
    # queda en la nebulosa. Y el gesto —un cielo de estrellas finas, la nebulosa
    # y el borde del planeta, que pasa detrás del tag y no toca el UL (Dlx)— lo
    # separa del resto: FFA es una trama de puntos
    # en grilla y un filo de neón; acá las estrellas no tienen grilla (cinco
    # mosaicos de tamaños que no se dividen entre sí) y no hay filo.
    A, B = DDF_COLORES
    d['DDF'] = (B, A, ddf_fondo(A, B), '', '', 'galaxia: estrellas, nebulosa y el borde de un planeta al pie')

    # ACAD · la Academia de Rap, la duodécima. Dlx, 04/10/2026: «Tag ponle ACADEMIA. Colores amarillo y negro
    # para la tarjeta» y «hazla con un diseño único como lo que hiciste con DDF».
    #
    # 🏛️ UN TEMPLO DE NOCHE SOBRE MÁRMOL NEGRO, como su logo (el frontón y las columnas en un círculo amarillo).
    # El amarillo es su COLOR PROPIO —el marco, la línea, los aros y las pastillas salen de ahí— y el negro lo
    # pone el fondo, como en Snake Rap. El mármol, con vetas finas teñidas de dorado (`texturas/marmol.png`, de
    # `marmol.py`): ninguna de las otras once es de piedra.
    #
    # ⚠️ SU AMARILLO NO ES EL MIEL DE URBAN: medido como los demás, la marca queda a ΔE 23,9 de URBF y el marco
    # (#F8E675) a 33 del suyo. Y el gesto los separa igual: URBF es una pared con pintura que chorrea.
    A, B = ACAD_COLORES
    d['ACAD'] = (B, A, acad_fondo(A),
                 f'background:url({tx("marmol")}) center/cover,#D9B20A;background-blend-mode:multiply;'
                 'mix-blend-mode:screen;opacity:.34',
                 '', 'templo de noche: frontón, columnas y escalinata, sobre mármol negro con vetas doradas')

    # RZ · Rap Zone. Servidor ASOCIADO, no de la Hermandad.
    #
    # Su fuego NO esta simulado: sale extraido de su propio logo con
    # herramientas/extraer_fuego_rz.py. El fuego simulado da lenguas de
    # fogata y el de su marca son vetas y remolinos, sin punta.
    #
    # Y entra con SU PROPIO COLOR, no como mascara teñida. Medida la rampa
    # del logo: #000323 → #000740 → #0014A1 → #0657F6 → #3A96F2. NUNCA
    # LLEGA AL BLANCO, porque el azul no pasa por amarillo al calentarse
    # como el naranja. Por eso el acento es #3A96F2, su punto mas caliente.
    #
    # ⚠️ Su tono es 232°, casi el mismo que FTN (230°) y DRA (231°). Lo que
    # lo separa es la LUZ: 0.20 contra 0.34 y 0.62. Si DRA se va a cielo
    # nocturno, DRA y RZ quedan mismo tono Y misma luz. Las dos cosas no
    # pueden pasar.
    A, B = '#08145C', '#3A96F2'
    f_rz = tx('fuego_rz')
    d['RZ'] = (B, A,
        'linear-gradient(170deg,#0B1550 0%,#070B2E 48%,#03050F 100%)',
        f'background-image:url({f_rz}),url({f_rz});'
        'background-size:108% auto,150% auto;'
        'background-position:center 60%,center;'
        'background-repeat:no-repeat,no-repeat;mix-blend-mode:screen',
        'box-shadow:inset 0 0 0 2px rgba(58,150,242,.85),'
        'inset 0 0 34px rgba(58,150,242,.30)',
        'el fuego de su propio logo, en dos capas')

    return d


D = defs()
ORDEN = ['SR', 'TFC', 'TWR', 'FTN', 'DRA', 'FRZ', 'URBF', 'EFA', 'FFA', 'FFS', 'DDF', 'ACAD', 'RZ']


ESTRELLAS = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                           encoding='utf-8'))['estrellas_por_servidor']
# La geometria del emblema —el escudo, su lugar y las estrellas— vive en
# comun/emblema.py. Aca solo se dibuja.


def carta(i, sv, claro=False, pleno=False):
    B, A, fondo, extra, remate, desc = D[sv]
    cid = f'sv{i}'
    cap = f'<div class="cap" style="{extra}"></div>' if extra else ''
    rem = f'<div class="rem" style="{remate}"></div>' if remate else ''
    desc = '' if claro else desc
    return f"""<div class="col{' claro' if claro else ''}">
<div class="et">{sv}</div><div class="de">{desc}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>{cap}{rem}
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(ESTRELLAS[sv], W, sufijo=f'{i}_')}
  {emblema.pieza(sv, A, B, esc(sv))}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap}}
.col{{text-align:center;width:300px}}
.et{{color:#EDEDF5;font-size:14px;font-weight:800;letter-spacing:1.6px;margin-bottom:3px}}
.de{{color:#8A8AA0;font-size:10.5px;margin-bottom:12px;min-height:26px}}
.col.claro{{background:#FFFFFF;border-radius:10px;padding:10px 0 14px}}
.claro .et{{color:#1A1A22}}
.claro .de{{min-height:6px;margin-bottom:6px}}
.claro .cuerpo{{filter:drop-shadow(0 10px 22px rgba(0,0,0,.32))}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:no-repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
/* El UL va DENTRO del recorte, al pie. Es la marca paraguas y ocupa el mismo
   lugar en las tres cartas; el que se mudo arriba fue el escudo del servidor.

   TAMANO IGUAL AL DE LA COMPETITIVA: height 20.7px y ancho automatico, que
   es su regla final en 02_Competitivo/v2/card.css. Se copia el ALTO y no el
   ancho porque el archivo es 744x606, o sea mas ancho que alto: fijando el
   ancho las dos cartas terminaban con logos de distinto alto. Las dos cartas
   miden 300 de ancho, asi que un pixel aca es un pixel alla. */
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    cuerpo = ''.join(carta(i, sv) for i, sv in enumerate(ORDEN))
    # Control sobre blanco. Las estrellas son blancas, asi que este es el
    # caso peor: lo unico que las separa del fondo es su contorno. La carta
    # se exporta en PNG transparente y cae en Discord sobre lo que haya.
    con_est = [sv for sv in ORDEN if ESTRELLAS[sv]]
    claro = ''.join(carta(60 + i, sv, True) for i, sv in enumerate(con_est))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LOS NUEVE '
           '<span>— el escudo lleno, con el fondo puesto por la carta en el '
           'tono de su servidor</span></div>'
           '<div class="fila">' + cuerpo + '</div>'
           '<div class="rot">SOBRE BLANCO '
           '<span>— la estrella es blanca, así que acá lo único que la sostiene '
           'es su contorno</span></div>'
           '<div class="fila">' + claro + '</div></body></html>')
    out = os.path.join(SCR, 'los_nueve.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1800}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'los_nueve.png'), full_page=True)
        await b.close()
    print('-> los_nueve.png')


# Guardado para que defs() se pueda IMPORTAR sin disparar el render.
# Sin esto, cualquier script que quiera los nueve fondos tiene que copiarlos,
# y una definicion copiada se separa de la original tarde o temprano.
if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())

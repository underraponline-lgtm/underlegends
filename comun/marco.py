"""EL BORDE de color de la carta Servidor.

⚠️ ARREGLA UNA FALLA QUE YO YA HABIA DIAGNOSTICADO Y NO TERMINE DE APLICAR.
En comun/brillo.py esta escrito, con la medicion al lado, que EL ACENTO NO
TIENE COLOR EN TRES DE DIEZ:

    TFC  #F2E9E9  croma   9
    URBF #FFFFFF  croma   0
    DRA  #FFFFFF  croma   0

Cuando lo encontre cambie SOLO el brillo. El borde seguia usando stroke={B}
—el acento— asi que en esos tres quedo blanco. Dlx lo vio: "los bordes de
colores desaparecieron, tienen que seguir el color del servidor". Medido
sobre la carta dibujada, el croma del borde daba 25, 22 y 42 contra 125-172
de los otros siete.

LA LECCION, y va a ESTADO.md: cuando aparece una causa, hay que buscar TODOS
los lugares donde pega. Yo arregle el que estaba mirando y di el problema por
cerrado.


LA REGLA: UN SOLO COLOR, OSCURO CONTRA CLARO
--------------------------------------------
⚠️ ESTO REEMPLAZA LA REGLA ANTERIOR, que iba del propio encendido AL ACENTO.
Dlx: "en todos los bordes en general te digo, de la tarjeta incluida, que solo
sea el color principal pero contraste, y recuerda no metalico".

Ahora el borde no mezcla dos colores: sale entero del COLOR DEL LOGO, oscuro
en las puntas y claro en el medio.

    DRA   #3550E0 -> #94A4FF     azul oscuro a azul claro
    FRZ   #0C5352 -> #7AA7A6     el que Dlx eligio como referencia
    FTN   #243272 -> #7983B0     ya no pasa por el amarillo

⚠️ POR QUE SE CAMBIO. Mezclar propio y acento obliga a VIAJAR de un color a
otro, y cuando esos dos son opuestos el camino cruza el eje neutro. Medido a
lo largo del recorrido, en FTN —amarillo contra azul— el croma caia a 3 a
mitad de camino: ese era el gris que se veia. Y en los tres servidores cuyo
acento es blanco —TFC, URBF, DRA— el borde terminaba blanco en las puntas.
Dlx vio las dos cosas.

⚠️ NO ES METALICO, que es lo que hay que evitar porque ese lenguaje es de la
Competitiva. Metalico seria alternar claro-oscuro-claro-oscuro fingiendo
reflejos. Esto es UN solo tramo: oscuro, claro, oscuro.

⚠️ Y LA LINEA DEL DIVISOR USA ESTAS MISMAS DOS FUNCIONES, no una copia con los
mismos numeros. Dlx pidio que los lados se sincronicen con la linea de abajo,
y dos definiciones iguales en dos archivos se separan sola a la primera
tanda: es lo que ya paso con DESPL_ESC y con la posicion del nombre.

⚠️ EL DEGRADE VA AL SESGO, no vertical: la luz de esta carta entra de arriba a
la izquierda —las estrellas, las figuras de rango, los iconos y el escudo ya
lo hacen— asi que el borde tiene que abrirse del mismo lado.

⚠️ EL ACENTO NO DESAPARECE DE LA CARTA: sigue rellenando la pastilla del rango
y dibujando el borde del TAG. Deja de estar en los BORDES, que es lo que se
pidio.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from comun.brillo import encender


def croma(c):
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return max(r, g, b) - min(r, g, b)


OSCURO = -.12       # cuanto se baja el propio para las puntas
CLARO = .45         # cuanto se sube para el medio, como maximo
TECHO = 2.81        # contraste maximo del medio contra el propio
GRIS = 40           # debajo de este croma el medio se lee gris


def _lum(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= .03928 else ((x + .055) / 1.055) ** 2.4 for x in c]
    return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]


def _ct(a, b):
    la, lb = _lum(a), _lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


def oscuro(propio):
    """La punta del degrade: LA VERSION OSCURA del color del logo.

    ⚠️ NO SE MEZCLA CON NEGRO NI CON BLANCO. Dlx lo dijo derecho: "solo
    tendria que estar el color principal, su version clara y luego oscura".
    Mezclar con blanco o negro cambia la SATURACION ademas de la luz, y por
    eso aparecian grises. Bajar la L en HSL deja el color donde esta y solo
    cambia cuanta luz tiene.
    """
    return _aclarar(propio, OSCURO)


def _aclarar(c, f):
    """Sube la LUZ sin tocar la saturacion. No es lo mismo que mezclar blanco.

    ⚠️ ESTE ES EL ARREGLO DE FFA. tono() mezcla con blanco, y mezclar con
    blanco BAJA la saturacion: a FFA, que parte de un violeta oscuro con croma
    42, le dejaba 28 y se leia gris. Subir la L en HSL mueve la claridad y
    deja la saturacion donde estaba, asi que el violeta sigue siendo violeta.

    A los que ya tienen croma alto casi no los cambia —su saturacion ya era
    alta y sigue igual—, asi que arregla FFA sin tocar a los demas.
    """
    import colorsys
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    # f>0 sube hacia la luz, f<0 baja hacia la sombra. La saturacion NO se
    # toca en ninguno de los dos casos: eso es lo que lo separa de mezclar.
    ll = ll + (1 - ll) * f if f >= 0 else ll * (1 + f)
    r, g, b = colorsys.hls_to_rgb(hh, ll, ss)
    return '#%02X%02X%02X' % tuple(round(x * 255) for x in (r, g, b))


def claro(propio):
    """El medio del degrade. NO sube lo mismo en los diez.

    ⚠️ SUBIR UNA FRACCION FIJA LES CAE DISTINTO. Hacia el blanco, el mismo
    porcentaje mueve mucho mas —en luz— a un color oscuro que a uno claro, y
    los cuatro que quedaban mas lavados eran los cuatro propios mas oscuros:
    FFA 4.41, RZ 4.16, TFC 3.62, FTN 3.43. FRZ, el que Dlx eligio, estaba en
    2.81, asi que ESE es el techo: no lo elegi yo.

    ⚠️ ES UN TECHO Y NO UN OBJETIVO. Llevar a los diez a 2.81 tambien SUBIRIA
    a los vividos —SR, TWR y DRA estan en 2.05-2.18— y les meteria blanco
    justo a los que menos tienen: su croma caeria de ~100 a ~74. Como la queja
    era que sobra blanco, esto solo baja.
    """
    # ⚠️ LA EXCEPCION PARA FFA SE FUE, Y ESTABA MAL PLANTEADA. Yo habia hecho
    # el medio mezclando con blanco y despues le puse un caso especial a FFA
    # porque se agrisaba. Dlx lo corto de raiz: "porque dices que mezclar con
    # blanco? Yo te dije que solo tendria que estar el color principal, su
    # version clara y luego oscura".
    #
    # Tenia razon y yo me estaba contradiciendo: mezclar con blanco NO da la
    # version clara de un color, da el color LAVADO. Por eso hacia falta el
    # parche —el gris de FFA era el sintoma de la regla equivocada, no un caso
    # raro—. Con la version clara de verdad no hay excepcion que hacer.
    #
    # ⚠️ ESTO CAMBIA A FRZ, y hay que decirlo porque es el que Dlx eligio como
    # referencia: su medio pasa de #7AA7A6 a un teal mas vivo. No es un
    # descuido — es que FRZ tambien estaba lavado, solo que menos.
    if _ct(_aclarar(propio, CLARO), propio) <= TECHO:
        return _aclarar(propio, CLARO)
    lo, hi = 0.0, CLARO
    for _ in range(40):
        m = (lo + hi) / 2
        if _ct(_aclarar(propio, m), propio) < TECHO:
            lo = m
        else:
            hi = m
    return _aclarar(propio, hi)


def tinta(propio):
    """El texto que va ENCIMA de claro(propio). Del mismo color, muy oscuro.

    ⚠️ NI BLANCO NI NEGRO. Toda la carta se pinta con el color del logo en sus
    versiones clara y oscura, y el texto del titulo no es la excepcion. Se
    baja la L en HSL hasta que pase el umbral de texto (4.5:1) contra el
    relleno, empezando por -.55 y oscureciendo si hace falta.
    """
    # ⚠️ LA DIRECCION NO ES SIEMPRE HACIA ABAJO. El relleno es claro(propio),
    # y en los propios mas oscuros ese "claro" sigue siendo oscuro: FFA queda
    # en #7B1DE3 y RZ en #304BED. Contra esos, ni el negro llega a 4.5 —da
    # 3.11 y 3.31—. Ahi el texto tiene que ir MAS CLARO, no mas oscuro.
    # Medido: con la direccion elegida por luminancia, los diez pasan.
    # ⚠️ SE PRUEBAN LAS DOS DIRECCIONES Y GANA LA QUE MAS SEPARA. Habia puesto
    # un umbral de luminancia para decidir si el texto iba mas oscuro o mas
    # claro, y TFC cayo justo del lado equivocado: su relleno es #E11333, el
    # umbral lo mando hacia arriba y quedo en 3.93 cuando hacia abajo daba
    # 4.28. Elegir por umbral falla en los bordes; elegir por resultado no.
    fondo = claro(propio)
    mejor, mejor_ct = None, 0
    for f in (-.55, -.68, -.80, -.90, -.96, .62, .74, .84, .92):
        c = _aclarar(propio, f)
        v = _ct(c, fondo)
        if v > mejor_ct:
            mejor, mejor_ct = c, v
    return mejor


def paradas(propio, acento=None):
    """(medio, puntas). El acento ya no entra: se deja por compatibilidad."""
    return claro(propio), oscuro(propio)


def defs_svg(propio, acento, sufijo):
    """El <linearGradient> del borde, para meter en <defs>."""
    a, b = paradas(propio, acento)
    return (f'<linearGradient id="mk{sufijo}" x1="0.1" y1="0" x2="0.9" y2="1">'
            f'<stop offset="0" stop-color="{b}"/>'
            f'<stop offset=".45" stop-color="{a}"/>'
            f'<stop offset="1" stop-color="{b}"/></linearGradient>')


def stroke(sufijo):
    return f'url(#mk{sufijo})'


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    from importlib import import_module
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), '03_Servidor', 'disenos'))
    D = import_module('los_nueve').defs()
    print('EL BORDE: del propio encendido al acento\n')
    print('  %-6s %-9s %5s   %-9s %5s   %-9s %5s'
          % ('sv', 'acento', 'crom', 'propio', 'crom', 'encendido', 'crom'))
    print('  ' + '-' * 62)
    ciegos = []
    for sv, d in D.items():
        B, A = d[0], d[1]
        e = encender(A, .30)
        if croma(B) < 20:
            ciegos.append(sv)
        print('  %-6s %-9s %5d   %-9s %5d   %-9s %5d%s'
              % (sv, B, croma(B), A, croma(A), e, croma(e),
                 '   <- acento sin color' if croma(B) < 20 else ''))
    print('\n  ⚠️ el acento no tiene color en %d de %d: %s'
          % (len(ciegos), len(D), ', '.join(ciegos)))
    print('     en esos tres el borde era BLANCO. Con el degrade, el color')
    print('     propio siempre esta y el acento aporta donde puede.')

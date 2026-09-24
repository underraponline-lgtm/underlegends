"""EL BRILLO DE ARRIBA de la carta Servidor: el tope encendido tras el escudo.

DEFINICION CANONICA. Todo lo que decide como se ve y con que color esta aca.

    from comun.brillo import arriba
    ...
    {arriba(propio)}          # propio = el color base del servidor

Vive en comun/ por la misma razon que divisor.py y emblema.py: es una pieza
CERRADA de la carta. Lo cerrado tiene definicion canonica y no se vuelve a
derivar de un script de exploracion. Este proyecto ya pago tres veces la
duplicacion —la funcion de escudo, las siluetas y los pools— y las tres
veces el sintoma fue el mismo: dos copias, una se arregla y la otra no.


QUE ES
------
El panel del pie enciende su filo mirando hacia arriba. El tope hace el
mismo gesto mirando hacia abajo, hasta la altura del escudo del servidor.

⚠️ MISMO GESTO, NO SIMETRIA EXACTA. Abajo el brillo esta EN UNA LINEA —el
divisor— y lo que ilumina es su propio filo. Arriba no hay linea que
iluminar: el borde ya lo tiene el marco. Lo que se enciende es EL AIRE
DETRAS DEL ESCUDO. Copiarlo literal —un trazo encendido cruzando el tope—
competiria con el marco, que ya corre por ahi.


⚠️ SALE DEL COLOR PROPIO, NO DEL ACENTO
---------------------------------------
La primera version usaba el acento y mix-blend-mode:screen, y salio
INVISIBLE. Medido en la franja del hombro (y=70..112 del lienzo, sacando el
escudo), como cambio contra la carta sin brillo:

                              FOTO CLARA        FOTO OSCURA
    variante                luz     color      luz     color
    acento screen .40      +4.4     -1.3     +24.7     +0.7
    propio velo+tinte .55 -61.3    +12.3      -2.4    +17.9

1. SOBRE UNA FOTO CLARA NO SE PUEDE AGREGAR LUZ. screen satura: +4.4 sobre
   211. Lo unico que todavia entra ahi es COLOR.

2. EL ACENTO NO TIENE COLOR EN TRES DE DIEZ:

       TFC  #F2E9E9  croma   9      URBF #FFFFFF  croma 0
       DRA  #FFFFFF  croma   0

   En esos tres el brillo no estaba flojo: NO PODIA TEÑIR NADA. Subirle la
   opacidad a ojo lo habria dejado igual de invisible.

El color propio tiene croma en los diez —el mas pobre es FFA con 42— asi que
el brillo sale de ahi. El procedimiento esta en
03_Servidor/disenos/medir_brillo.py.


⚠️ EL VELO NO ES UN AGREGADO
----------------------------
El brillo del pie se lee porque cae sobre EL MATERIAL DE LA CARTA, que es
oscuro. Arriba no hay material: hay foto. Para que la luz tenga donde
apoyarse hay que empujar la foto hacia atras primero, igual que hace VELO
abajo. Eso cuesta los -61 de luz sobre la foto clara, y es EL MISMO PRECIO
QUE YA PAGA EL PIE.

Sacar el velo y dejar solo el tinte no aclara la carta: apaga el brillo.


⚠️ LA CAPA VA ENCIMA DE LA FOTO
-------------------------------
Debajo de la foto no se ve: la foto va a sangre y la tapa entera.
"""
# ⚠️ LA CONSOLA DE WINDOWS ES cp1252 Y NO PUEDE ESCRIBIR UN EMOJI.
# Este self-check imprimia todas sus tablas bien y MORIA en la linea del
# aviso —«acento SIN COLOR en N de M»—, o sea que pasaba cuando no habia
# nada que reportar y reventaba cuando SI. Se lee como «el script esta
# roto» en vez de «encontro un problema», que es al reves.
import sys

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

# ── la intensidad, elegida ───────────────────────────────────────────────
# Dlx sobre la tanda de brillo_arriba.png: "como estan los de abajo estan
# perfecto". Los de abajo eran los cuatro servidores a intensidad MEDIA.
INTEN = 0.55     # cuanto tiñe
HASTA = 24       # hasta que % del alto llega
VELO = 0.30      # cuanto empuja la foto hacia atras

# El escudo baja hasta y=44, o sea 10.9% del alto. HASTA llega mas abajo a
# proposito, para que el escudo quede DENTRO de la luz y no apoyado en su
# borde.


def encender(c, f=.42):
    """Sube un color hacia su version encendida SIN lavarlo.

    ⚠️ NO USAR emblema.tono() PARA ESTO. tono() aclara hacia el BLANCO, y eso
    le saca justo el croma que es lo unico que se ve sobre una foto clara: el
    color encendido con tono() vuelve a ser el caso del acento blanco, que no
    puede teñir nada.

    Aca sube el canal mas alto hacia el tope y los otros en proporcion, asi
    que la luz sube y el color se mantiene.
    """
    h = c.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    k = 1 + (255 / max(r, g, b, 1) - 1) * f
    return '#%02X%02X%02X' % tuple(min(255, int(x * k)) for x in (r, g, b))


def _rgba(c, a):
    h = c.lstrip('#')
    return 'rgba(%d,%d,%d,%.3f)' % (int(h[0:2], 16), int(h[2:4], 16),
                                    int(h[4:6], 16), a)


def fondo(propio, inten=None, hasta=None, velo=None):
    """El valor CSS de background de la capa de luz."""
    i = INTEN if inten is None else inten
    hs = HASTA if hasta is None else hasta
    v = VELO if velo is None else velo
    if not i and not v:
        return ''
    col = encender(propio)
    return (f'radial-gradient(ellipse 62% {hs}% at 50% 0%,'
            f'{_rgba(col, i)} 0%,{_rgba(col, i * .34)} 45%,transparent 76%),'
            f'linear-gradient(180deg,rgba(0,0,0,{v:.3f}) 0%,transparent {hs}%)')


def arriba(propio, clase='luz', **kw):
    """El div de la capa de luz, listo para pegar ENCIMA de la foto."""
    bg = fondo(propio, **kw)
    return f'<div class="{clase}" style="background:{bg}"></div>' if bg else ''


def css(clase='luz', top=0, alto=405):
    """La regla de posicion. `top` es el margen del lienzo, `alto` el de la carta."""
    return (f'.{clase}{{position:absolute;top:{top}px;left:0;right:0;'
            f'height:{alto}px;pointer-events:none}}')


if __name__ == '__main__':
    import json
    import os
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from importlib import import_module
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(
        os.path.abspath(__file__))), '03_Servidor', 'disenos'))
    D = import_module('los_nueve').defs()

    def croma(c):
        h = c.lstrip('#')
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        return max(r, g, b) - min(r, g, b)

    print('EL BRILLO DE ARRIBA')
    print('  intensidad %.2f  ·  llega al %d%%  ·  velo %.2f\n'
          % (INTEN, HASTA, VELO))
    print('  %-6s %-9s %5s   %-9s %5s   %-9s' %
          ('sv', 'acento', 'crom', 'propio', 'crom', 'encendido'))
    print('  ' + '-' * 56)
    for sv, d in D.items():
        print('  %-6s %-9s %5d   %-9s %5d   %-9s'
              % (sv, d[0], croma(d[0]), d[1], croma(d[1]), encender(d[1])))
    ciegos = [sv for sv, d in D.items() if croma(d[0]) < 20]
    print('\n  ⚠️ acento SIN COLOR en %d de %d: %s'
          % (len(ciegos), len(D), ', '.join(ciegos)))
    print('     por eso el brillo sale del propio, no del acento')

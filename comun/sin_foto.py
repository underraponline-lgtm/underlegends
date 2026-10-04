# -*- coding: utf-8 -*-
"""LA CARA DE QUIEN NO TIENE FOTO: una silueta de rapero, en negro.

    python comun/sin_foto.py        el self-check, y la escribe en salida/ para mirarla

🔑 Dlx, 03/10/2026, con la Temporada de Oasis (foto oculta) en la mano: *«para
aquellas personas sin fotos, ya sea que lo eligieron esa opción o que no tienen
nada, usar una silueta de un rapero en negro en las tarjetas»*. Hasta ahí iba la
INICIAL gigante y tenue —el 13 % de blanco—, que sobre una carta clara casi no
se veía: la carta parecía vacía, no «sin foto».

⚠️ VA EN EL MISMO LUGAR QUE LA FOTO, COMO UNA FOTO MÁS. Es una imagen (`URI`),
no un dibujo aparte: así cada carta le aplica su propio tratamiento —el recorte,
el encuadre, los fundidos de los bordes, el apagado de la Bloqueada— y la
silueta se integra igual que una cara. Lo usan las cinco: Temporada,
Competitiva, Servidor, País y la Bloqueada.

⚠️ DE PERFIL, CON GORRA Y MICRÓFONO, porque en negro sólo queda el contorno: de
frente, el micrófono se pierde contra la cara. Lo que la hace legible es el
AIRE —entre la reja y la boca, entre el puño y el mentón—, no los detalles.

⚠️ EL CONTRALUZ NO ES ADORNO. Negro sobre la carta negra (el OVR más alto) o
sobre la Bloqueada no se ve: un borde claro y difuso (28 %) la recorta del
fondo oscuro, y sobre uno claro no se nota.

⚠️ SE ELIGE ACÁ Y EN NINGÚN OTRO LADO. Si se cambia el dibujo, se cambia este
archivo y redibujan las cinco: vive en `comun/`, que entra entero en la huella
de cada carta (`comun/huella_codigo.py`).
"""
import base64
import os

SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><filter id="luz" x="-8%" y="-8%" width="116%" height="116%">
<feMorphology in="SourceAlpha" operator="dilate" radius="2" result="d"/>
<feGaussianBlur in="d" stdDeviation="3.5" result="b"/>
<feFlood flood-color="#ffffff" flood-opacity=".28"/>
<feComposite in2="b" operator="in" result="g"/>
<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter></defs>
<g fill="#0a0a0d" filter="url(#luz)">
<path d="M30,512 C40,458 92,418 172,404 C210,398 244,396 272,394 L364,390 C404,396 446,410 474,436 C496,456 506,484 508,512 Z"/>
<path d="M344,326 C380,326 414,346 420,378 C424,398 410,406 386,402 L352,398 Z"/>
<path d="M262,340 C268,362 272,380 274,398 L366,394 C356,372 350,350 348,326 Z"/>
<path d="M378,196 C380,250 374,296 354,324 C336,350 302,358 272,354 C254,352 240,348 232,342 C224,336 222,330 224,324 C220,320 220,316 224,312 C218,308 216,304 220,300 C214,296 214,292 220,288 C222,286 224,284 226,282 C216,282 206,278 206,272 C208,264 216,256 224,248 C226,242 224,236 226,230 C228,222 230,212 232,196 Z"/>
<path d="M226,216 C222,164 256,124 302,120 C346,116 378,148 382,194 C383,206 378,214 370,218 C330,210 276,208 226,218 Z"/>
<path d="M248,194 C216,192 180,195 154,201 C140,205 140,218 152,221 C182,224 218,222 250,220 Z"/>
<circle cx="174" cy="298" r="26"/>
<path d="M161,314 L188,318 L180,360 L154,356 Z"/>
<path d="M140,358 C146,348 160,344 172,346 C176,340 186,338 192,344 C200,350 208,362 206,376 C206,392 196,404 180,408 C164,412 148,406 140,396 C132,386 132,368 140,358 Z"/>
<path d="M142,390 C154,402 184,410 204,398 C194,438 176,480 168,512 L58,512 C78,466 108,420 142,390 Z"/>
</g></svg>'''

#: la silueta como imagen, para el `src` de un `<img>`. Base64 y no `utf8,`: va
#: adentro de atributos con comillas simples y dobles (el `onerror` de la
#: Temporada y la Competitiva), y en base64 no hay ninguna de las dos
URI = 'data:image/svg+xml;base64,' + base64.b64encode(SVG.encode('utf-8')).decode('ascii')


def img(clase='sil'):
    """El `<img>` de la silueta, con su clase para el encuadre de cada carta."""
    return '<img class="%s" src="%s" alt="">' % (clase, URI)


def onerror(clase='sil'):
    """El `onerror` de una foto que no carga: cae en la silueta, una sola vez."""
    return "this.onerror=null;this.className='%s';this.src='%s'" % (clase, URI)


def _self_check():
    import xml.etree.ElementTree as ET
    mal = 0

    def ok(c, que):
        nonlocal mal
        mal += not c
        print('   %s %s' % ('ok' if c else '🔴', que))
    print('\n  sin_foto.py — self-check\n')
    try:
        raiz = ET.fromstring(SVG)
        ok(raiz.get('viewBox') == '0 0 512 512', 'el SVG se lee y es cuadrado, como un avatar')
    except ET.ParseError as e:
        ok(False, 'el SVG no se lee: %s' % e)
    ok("'" not in URI and '"' not in URI, 'la URI no trae comillas: entra en cualquier atributo')
    ok(len(URI) < 6000, 'pesa poco (%d caracteres): va adentro de cada carta' % len(URI))
    ok(URI in onerror() and 'this.onerror=null' in onerror(), 'el onerror cae una sola vez')
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'salida')
    try:
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, 'sin_foto.svg'), 'w', encoding='utf-8') as f:
            f.write(SVG)
    except OSError:
        pass
    print('\n  %s\n' % ('todo ok' if not mal else '🔴 %d mal' % mal))
    return 1 if mal else 0


if __name__ == '__main__':
    raise SystemExit(_self_check())

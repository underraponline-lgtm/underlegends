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

🔑 LA FIGURA ES LA «2» DE PIXABAY, NO UNA DIBUJADA ACÁ. La primera la dibujé a
mano (de perfil, gorra y micrófono) y Dlx, 04/10/2026: *«la verdad no me
gusta… buscá en Google imágenes»*. Google pidió un CAPTCHA, así que salió de
Pixabay —licencia de Pixabay: uso libre, sin atribución obligatoria—, entre
cinco que vio: *«la segunda»*. Es **silhouette-3391415** (pixabay.com, PNG de
1280 px): sombrero y micrófono en alto. Se trazó a vector con
`herramientas/trazar_figura.py` (el comando está arriba de `FIGURA`): sale
nítida a cualquier tamaño y pesa 3 KB.

⚠️ LO QUE LA HACE LEGIBLE ES EL AIRE, no los detalles: en negro sólo queda el
contorno, y el hueco entre el brazo levantado y el micrófono es lo que dice
«está rapeando». Por eso el trazador guarda los huecos (`evenodd`).

⚠️ EL CONTRALUZ NO ES ADORNO. Negro sobre la carta negra (el OVR más alto) o
sobre la Bloqueada no se ve: un borde claro y difuso (28 %) la recorta del
fondo oscuro, y sobre uno claro no se nota.

⚠️ SE ELIGE ACÁ Y EN NINGÚN OTRO LADO. Si se cambia el dibujo, se cambia este
archivo y redibujan las cinco: vive en `comun/`, que entra entero en la huella
de cada carta (`comun/huella_codigo.py`).
"""
import base64
import os

#: el trazo de la figura: `python herramientas/trazar_figura.py silhouette-3391415_1280.png`
FIGURA = ('M506.0,1279.2 32.0,1274.1 29.0,1273.3 27.5,1272.0 25.1,1265.0 7.0,1242.3 5.3,1239.0 5.5,1236.0 6.9,1233.0 90.9,1065.0 253.1,785.0 255.4,780.0 249.7,765.0 245.9,752.0 236.8,706.0 235.5,703.0 34.7,501.0 33.5,499.0 33.3,496.0 39.2,480.0 39.2,477.0 0.0,422.2 0.0,416.2 17.7,356.0 24.9,335.0 33.7,313.0 42.6,293.0 53.0,272.0 65.0,250.2 83.9,219.0 104.8,187.0 130.0,150.5 199.0,55.4 223.2,30.0 239.0,15.3 252.0,5.7 264.0,-0.0 276.0,-0.1 284.0,3.7 291.6,9.0 311.0,25.2 341.0,43.8 351.0,51.3 358.0,59.1 363.0,69.0 364.6,79.0 364.2,84.0 363.0,89.0 359.0,97.0 352.6,104.0 345.0,109.3 334.0,114.3 324.0,117.3 309.0,120.3 266.0,125.2 264.0,125.9 242.0,147.6 225.0,165.5 209.8,183.0 196.9,200.0 185.9,217.0 176.9,234.0 169.7,251.0 161.7,274.0 154.8,299.0 149.5,322.0 150.0,323.5 151.0,323.8 158.0,324.8 253.0,347.2 256.0,346.6 268.0,340.6 278.0,336.7 287.0,334.8 293.0,335.0 297.0,335.9 301.5,338.0 317.0,349.4 323.0,352.4 331.0,353.7 350.0,354.2 358.0,355.7 362.0,357.4 366.0,360.0 372.0,366.5 377.0,375.7 382.7,390.0 396.8,396.0 405.6,401.0 413.9,408.0 421.0,416.0 426.2,423.0 426.5,427.0 415.4,465.0 414.0,467.8 412.0,469.3 409.0,469.7 405.0,469.3 382.0,465.1 365.0,460.2 345.0,453.4 343.0,453.9 335.0,461.7 329.0,466.2 322.9,469.0 312.2,472.0 311.9,475.0 317.9,517.0 320.0,531.0 321.0,533.1 367.0,552.7 369.0,552.6 385.0,545.9 394.0,544.2 403.0,545.1 408.0,546.8 415.0,550.4 417.0,550.4 418.0,549.0 427.6,523.0 431.9,514.0 436.6,506.0 441.0,500.1 448.0,492.4 466.5,477.0 466.9,443.0 468.7,423.0 470.6,416.0 472.8,411.0 476.0,406.4 480.0,402.5 480.5,401.0 477.3,395.0 475.8,390.0 475.3,384.0 476.1,376.0 477.9,368.0 480.8,360.0 484.7,352.0 488.7,346.0 493.0,341.2 497.0,337.9 502.0,334.9 507.0,332.9 519.0,330.5 540.0,330.5 542.0,329.8 575.0,300.0 576.8,281.0 578.5,273.0 581.8,265.0 586.0,259.8 589.0,257.6 593.0,255.9 601.0,254.6 611.0,255.4 627.0,258.9 629.0,258.9 631.0,257.1 647.0,236.4 657.0,225.9 668.0,217.6 677.0,213.7 685.0,212.8 690.0,213.5 694.0,214.8 702.6,220.0 711.1,228.0 719.3,238.0 728.3,251.0 739.1,269.0 752.3,293.0 753.9,295.0 772.0,297.4 784.0,300.9 790.0,303.9 796.0,307.8 805.0,316.4 810.2,323.0 815.2,331.0 820.2,341.0 824.3,351.0 831.1,372.0 838.0,402.0 841.5,425.0 844.0,449.3 844.0,471.8 841.6,491.0 839.0,502.9 834.1,516.0 828.1,526.0 821.0,534.0 814.0,539.5 806.0,544.1 796.0,548.2 785.0,551.1 774.0,553.1 757.0,554.6 738.0,555.2 735.2,556.0 717.2,594.0 710.0,605.9 703.0,614.9 695.6,622.0 686.8,628.0 676.0,633.1 663.0,637.3 661.0,639.0 655.1,669.0 655.3,672.0 684.0,705.5 700.3,726.0 714.4,746.0 725.4,765.0 733.2,783.0 736.0,792.0 738.2,802.0 739.2,811.0 739.2,819.0 738.7,826.0 737.1,835.0 732.2,850.0 723.2,868.0 713.3,883.0 698.0,902.0 672.4,929.0 645.0,955.0 633.0,966.0 589.0,1002.6 563.0,1027.0 548.1,1043.0 538.0,1055.4 528.5,1069.0 520.9,1082.0 514.0,1097.0 508.9,1112.0 504.9,1129.0 502.2,1150.0 501.2,1178.0 502.2,1205.0 506.3,1248.0 508.7,1268.0 510.2,1273.0 510.0,1275.0 509.0,1276.9ZM226.6,466.0 227.2,428.0 228.8,416.0 232.2,403.0 231.6,401.0 156.0,362.3 154.0,360.4 153.1,358.0 153.9,352.0 152.8,351.0 148.0,349.4 145.0,348.8 144.0,349.1 142.7,352.0 135.2,385.0 134.9,387.0 135.9,389.0 223.0,465.0 225.0,466.5Z')

SVG = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-217.5 0 1280 1280">'
       '<defs><filter id="luz" x="-8%" y="-8%" width="116%" height="116%">'
       '<feMorphology in="SourceAlpha" operator="dilate" radius="5" result="d"/>'
       '<feGaussianBlur in="d" stdDeviation="8.75" result="b"/>'
       '<feFlood flood-color="#ffffff" flood-opacity=".28"/>'
       '<feComposite in2="b" operator="in" result="g"/>'
       '<feMerge><feMergeNode in="g"/><feMergeNode in="SourceGraphic"/></feMerge>'
       '</filter></defs>'
       '<path fill="#0a0a0d" fill-rule="evenodd" filter="url(#luz)" d="' + FIGURA + '"/></svg>')

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
        _x, _y, w, h = (float(v) for v in raiz.get('viewBox').split())
        ok(w == h, 'el SVG se lee y es cuadrado, como un avatar (%gx%g)' % (w, h))
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

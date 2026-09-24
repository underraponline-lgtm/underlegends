"""Prepara las banderas para la proporcion de la carta SIN deformar el escudo.

    python herramientas/banderas_carta.py

    04_Pais/banderas/       las oficiales, 3:2, como se bajaron
    04_Pais/banderas_carta/ las mismas a 600x926, listas para la carta


EL PROBLEMA
-----------
La carta es 300x463 y una bandera es 3:2, asi que llenarla estira la imagen
2.32 veces en vertical. Drako lo vio de una: "como que estan muy estiradas".
Y tenia razon — yo habia escrito 1.54 en el commit anterior y el numero es
2.32: (463/300) / (2/3).

Recortar en vez de estirar tampoco sirve: con background-size cover se ve el
43% central de la bandera, y ahi PERU DESAPARECE. Sus rojos quedan en los dos
extremos de esa franja y el recorte de la silueta mas el marco se los comen,
asi que la carta muestra un rectangulo blanco.


LO QUE SI SIRVE
---------------
Una bandera no es una sola cosa: son FRANJAS y a veces un ESCUDO.

    las franjas   son planas. Estirarlas no se nota, porque estirar un color
                  liso da el mismo color liso.
    el escudo     es un dibujo. Estirarlo se nota siempre.

Asi que se separan: la base de franjas se estira hasta llenar la carta y el
escudo se pega encima a su proporcion, escalado por el ANCHO. Las franjas
conservan sus proporciones relativas y el escudo su forma.


COMO SE SEPARAN, SIN SABER DONDE ESTA EL ESCUDO
----------------------------------------------
No hace falta reconocerlo: alcanza con que una bandera de franjas es, por
definicion, uniforme a lo largo de cada franja. Se toma la MEDIANA de cada
fila —o de cada columna, segun por donde vayan las franjas— y se reconstruye
la bandera sin nada encima. Lo que sobra al restar es el escudo.

La mediana y no el promedio: el escudo arrastraria el promedio de su fila
hacia sus colores, y la mediana lo ignora mientras ocupe menos de la mitad.


LAS QUE NO SE PUEDEN TRATAR, Y POR QUE
--------------------------------------
No todo lo que sobresale de las franjas es un escudo. Chile y Estados Unidos
tienen un CANTON —un bloque macizo pegado a la esquina— y Dominicana, Panama y
Puerto Rico tienen una cruz, cuatro cuartos y un triangulo. Esos son
ESTRUCTURA, no un dibujo apoyado encima: su tamaño esta definido CONTRA la
bandera, asi que sacarlos de la deformacion los deja flotando. Se probo y se
vio: el canton de Chile quedaba como un cuadradito perdido arriba a la
izquierda, y el de Estados Unidos como una calcomania sobre las barras.

⚠️ LO QUE LOS SEPARA ES SI TOCAN UN BORDE, y no hace falta ningun umbral.
Medido en las dieciseis:

    no tocan   ar bo ec es gt hn mx ve   escudos sueltos, se tratan
    tocan      cl do pa pr us uy         estructura, se estiran enteras

Un escudo esta apoyado en el medio de la bandera y no llega a ningun borde;
una estructura, por definicion, arranca en uno.


LA SEGUNDA PASADA: LO QUE VIVE ADENTRO DE LA ESTRUCTURA
-------------------------------------------------------
⚠️ ESTIRAR LA ESTRUCTURA ENTERA ESTIRA TAMBIEN LO QUE TIENE ADENTRO, y eso son
DIBUJOS. Dlx: "algunos simbolos o escudos de los paises tienen que ser
ajustados, por ejemplo las estrellas de Estados Unidos". Las seis estructurales
tienen todas un dibujo adentro:

    cl  una estrella blanca en el canton
    do  el escudo, donde se cruza la cruz
    pa  dos estrellas, una por cuarto blanco
    pr  una estrella dentro del triangulo
    us  cincuenta estrellas en el canton
    uy  el Sol de Mayo en el canton

Estirados 2.3x las estrellas dejan de ser estrellas y el sol de Uruguay queda
ovalado. Era lo mismo que Drako habia visto de los escudos, un nivel mas
adentro.

⚠️ Y LA REGLA NO CAMBIA: SE APLICA A REGIONES, NO A LA MASCARA ENTERA. Antes
se preguntaba "¿toca un borde ALGO de lo que sobresale?" y con un solo si la
bandera entera se daba por estructura. Ahora se etiquetan las REGIONES PLANAS
—cada franja, el canton, cada cuarto, cada estrella— y se pregunta una por una.
Una franja toca un borde: estructura. Un canton toca un borde: estructura. Una
estrella no toca ninguno: dibujo. **El mismo criterio, sin un numero nuevo.**

⚠️ LOS DIBUJOS CERCANOS SE AGRUPAN POR CONTENCION. El sol de Uruguay son dos
regiones —los rayos y la cara— y hay que escalarlas JUNTAS o la cara se le va
del sol. Las cincuenta estrellas de EEUU, en cambio, tienen que escalarse por
separado: agrupadas quedarian todas apretadas en un rincon del canton en vez de
repartidas. Lo que los separa es si una cae DENTRO de la caja de la otra: la
cara esta adentro del sol, y ninguna estrella esta adentro de otra.
"""
import os
import sys

import numpy as np
from PIL import Image

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIG = os.path.join(BASE, '04_Pais', 'banderas')
DEST = os.path.join(BASE, '04_Pais', 'banderas_carta')
W, H = 600, 926          # el doble de la carta, para que aguante el escalado


def separar(a):
    """(base de franjas, mascara del escudo, horizontal?)."""
    # ⚠️ LA VARIACION DENTRO DE UNA FRANJA ES LA QUE MANDA. Si las franjas son
    # horizontales, cada FILA es de un solo color y su desvio es casi cero,
    # mientras que una columna las cruza todas. Se elige el eje con menos
    # variacion adentro; al reves daria la base equivocada y el "escudo"
    # saldria siendo la bandera entera.
    horiz = a.std(axis=1).mean() < a.std(axis=0).mean()
    eje = 1 if horiz else 0
    base = np.median(a, axis=eje, keepdims=True)
    base = np.repeat(base, a.shape[eje], axis=eje)
    m = np.abs(a - base).sum(axis=2) > 60
    return base, m, horiz


# ══ LAS REGIONES PLANAS DE UNA BANDERA ══
# ⚠️ LOS DOS NUMEROS DE ACA SON DE RASTERIZADO, NO DE DISEÑO. No deciden que es
# dibujo y que es estructura —eso lo sigue decidiendo el borde—: sacan basura
# del antialiasing y juntan las partes de un mismo dibujo.
#
#   FINO   el borde entre dos colores deja hilitos de un color intermedio, de
#          uno o dos pixeles de ancho. Se filtra por el LADO MENOR de la caja y
#          no por el area: una estrella de EEUU mide 500 px sobre 860.000, o
#          sea que por area caia como ruido, y es justo lo que hay que salvar.
#   JUNTA  cuanto se dilata antes de agrupar. El escudo de Dominicana son
#          cinco pedazos pegados y el sol de Uruguay dos; las cincuenta
#          estrellas de EEUU estan separadas por mucho mas. Medido: los huecos
#          internos de un escudo son de 1 a 3 px y la separacion entre
#          estrellas es de 15 a 20 sobre 1280.
FINO = 4          # px del lado menor
JUNTA = 0.005     # del ancho de la bandera


def regiones(a):
    """Etiqueta las regiones planas: cada franja, el canton, cada estrella."""
    from scipy import ndimage
    h, w = a.shape[:2]
    # los colores de la bandera: los que ocupan algo. Una bandera son cuatro o
    # cinco colores planos, asi que redondear y contar alcanza.
    # ⚠️ LA CLAVE SE DECODIFICA CON LA MISMA BASE CON LA QUE SE CODIFICA. Con
    # base 1000 por canal el redondeo a 24 niveles entra de sobra; con una base
    # que no divide a la de arriba, el color que sale no es el que entro y la
    # paleta colapsa a una sola entrada.
    q = (a / 24).round().astype(np.int64)
    key = (q[..., 0] * 1000000 + q[..., 1] * 1000 + q[..., 2])
    vals, cnt = np.unique(key, return_counts=True)
    dom = vals[cnt > h * w * 0.004]
    if len(dom) == 0:
        dom = vals[np.argsort(-cnt)[:6]]
    paleta = np.array([[(v // 1000000), (v // 1000) % 1000, v % 1000]
                       for v in dom], dtype=float) * 24
    d = ((a[:, :, None, :] - paleta[None, None, :, :]) ** 2).sum(axis=3)
    idx = d.argmin(axis=2)
    lab = np.zeros((h, w), int)
    n = 0
    for k in range(len(paleta)):
        l, cuantos = ndimage.label(idx == k)
        lab[l > 0] = l[l > 0] + n
        n += cuantos
    return lab, n


def dibujos(a):
    """Las regiones que NO tocan ningun borde, agrupadas por cercania."""
    from scipy import ndimage
    h, w = a.shape[:2]
    lab, n = regiones(a)
    borde = set(lab[0].tolist()) | set(lab[-1].tolist())         | set(lab[:, 0].tolist()) | set(lab[:, -1].tolist())
    sueltas = np.zeros((h, w), bool)
    for sl, i in zip(ndimage.find_objects(lab, n), range(1, n + 1)):
        if sl is None or i in borde:
            continue
        if min(sl[0].stop - sl[0].start, sl[1].stop - sl[1].start) < FINO:
            continue
        sueltas[sl] |= lab[sl] == i
    if not sueltas.any():
        return []
    # ⚠️ SE AGRUPA DILATANDO, NO POR CONTENCION. Probe contencion primero —"lo
    # que cae adentro de la caja de otro es del otro"— y el escudo de
    # Dominicana salia partido en CINCO, porque sus pedazos estan uno al lado
    # del otro y no uno adentro del otro. Dilatar y volver a etiquetar junta
    # lo que se toca y deja separado lo que no, que es exactamente la
    # diferencia entre un escudo y un campo de estrellas.
    r = max(2, round(w * JUNTA))
    g, k = ndimage.label(ndimage.binary_dilation(sueltas, iterations=r))
    out = []
    for i in range(1, k + 1):
        m = sueltas & (g == i)
        if not m.any():
            continue
        ys, xs = np.nonzero(m)
        out.append((m, xs.min(), xs.max() + 1, ys.min(), ys.max() + 1))
    return out


def sin_dibujos(a, ds):
    """La bandera con los dibujos borrados, pintados del color de alrededor.

    ⚠️ SE BORRA UNA VERSION DILATADA, NO LA MASCARA JUSTA, Y SIN ESO QUEDA UN
    FANTASMA. El halo antialiaseado del dibujo NO esta en la mascara —cada
    pixel de ese halo se clasifico al color del fondo—, asi que sobrevivia al
    borrado, se estiraba con la bandera y se veia detras del dibujo bien
    dibujado: un sol alto y palido atras del sol redondo. Medido en Uruguay,
    Chile y Dominicana, en las tres.

    El anillo del que se saca el color se toma MAS AFUERA por lo mismo: si se
    tomara pegado al dibujo traeria su propio halo y pintaria un borde sucio.
    """
    from scipy import ndimage
    b = a.copy()
    for m, x0, x1, y0, y1 in ds:
        gordo = ndimage.binary_dilation(m, iterations=4)
        anillo = ndimage.binary_dilation(gordo, iterations=4) & ~gordo
        if not anillo.any():
            continue
        b[gordo] = np.median(a[anillo], axis=0)
    return b


def pegar(fondo, a, ds, w, h):
    """Cada dibujo a su proporcion, centrado donde estaba.

    ⚠️ LA MASCARA SE DILATA ANTES DE PEGAR, Y SIN ESO EL SOL DE URUGUAY SALE
    PALIDO. `regiones()` clasifica cada pixel al color mas cercano de la
    paleta, y el borde antialiaseado de un rayo fino cae del lado del FONDO.
    El nucleo del sol entraba entero y los rayos entraban a medias, asi que al
    achicarlos quedaban casi transparentes. Dilatando dos pixeles el rayo entra
    con su borde, que es lo que le da cuerpo al achicar.
    """
    from scipy import ndimage
    k = W / w
    for m, x0, x1, y0, y1 in ds:
        m = ndimage.binary_dilation(m, iterations=2)
        ys, xs = np.nonzero(m)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        rec = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8))
        tam = (max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k)))
        esc = rec.resize(tam, Image.LANCZOS)
        mm = Image.fromarray((m[y0:y1, x0:x1] * 255).astype(np.uint8)).resize(
            tam, Image.LANCZOS)
        cx, cy = (x0 + x1) / 2 / w * W, (y0 + y1) / 2 / h * H
        fondo.paste(esc, (round(cx - esc.width / 2), round(cy - esc.height / 2)), mm)
    return fondo


def una(cc):
    a = np.array(Image.open(os.path.join(ORIG, cc + '.png')).convert('RGB'))
    a = a.astype(float)
    h, w = a.shape[:2]
    base, m, horiz = separar(a)
    if not m.any():
        Image.fromarray(base.astype(np.uint8)).resize(
            (W, H), Image.LANCZOS).save(os.path.join(DEST, cc + '.png'))
        return 'plana', m.mean()
    ys, xs = np.nonzero(m)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    if x0 == 0 or y0 == 0 or x1 == w or y1 == h:
        # ⚠️ ESTRUCTURA — PERO LO QUE TIENE ADENTRO NO LO ES. Antes se estiraba
        # entera y se acababa ahi, y con ella las estrellas de EEUU y el sol de
        # Uruguay. Segunda pasada: se etiquetan las regiones planas y las que
        # NO tocan ningun borde son dibujos. Misma regla, un nivel mas adentro.
        ds = dibujos(a)
        if not ds:
            Image.fromarray(a.astype(np.uint8)).resize(
                (W, H), Image.LANCZOS).save(os.path.join(DEST, cc + '.png'))
            return 'estructura', m.mean()
        limpia = sin_dibujos(a, ds)
        fondo = Image.fromarray(limpia.astype(np.uint8)).resize(
            (W, H), Image.LANCZOS)
        pegar(fondo, a, ds, w, h).save(os.path.join(DEST, cc + '.png'))
        return 'estructura+%d' % len(ds), m.mean()
    fondo = Image.fromarray(base.astype(np.uint8)).resize((W, H), Image.LANCZOS)
    # ⚠️ EL ESCUDO SE ESCALA POR EL ANCHO Y NADA MAS. Es lo que lo deja sin
    # deformar: conserva su proporcion y ocupa en la carta la misma fraccion
    # del ancho que ocupaba en la bandera. Escalarlo por el alto lo agrandaria
    # 2.32 veces, que es justo lo que se esta arreglando.
    k = W / w
    esc = Image.fromarray(a[y0:y1, x0:x1].astype(np.uint8)).resize(
        (max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))),
        Image.LANCZOS)
    # el centro del escudo cae en la misma fraccion de la carta que en la
    # bandera, asi que un escudo centrado sigue centrado
    cx, cy = (x0 + x1) / 2 / w * W, (y0 + y1) / 2 / h * H
    px, py = round(cx - esc.width / 2), round(cy - esc.height / 2)
    # ⚠️ SE PEGA CON MASCARA Y NO ENTERO: el recorte trae el color de la franja
    # en sus esquinas, y sobre una base ya estirada esas esquinas caerian en
    # otro sitio y se verian como un parche rectangular.
    mm = Image.fromarray((m[y0:y1, x0:x1] * 255).astype(np.uint8)).resize(
        esc.size, Image.LANCZOS)
    fondo.paste(esc, (px, py), mm)
    fondo.save(os.path.join(DEST, cc + '.png'))
    return 'escudo', m.mean()


def main():
    os.makedirs(DEST, exist_ok=True)
    print('  pais   trato        el escudo ocupa')
    for f in sorted(os.listdir(ORIG)):
        if not f.endswith('.png'):
            continue
        cc = f[:-4]
        trato, frac = una(cc)
        print('  %-4s   %-12s %8.0f%%' % (cc, trato, 100 * frac))


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

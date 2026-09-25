"""Escudos CUADRADOS y del mismo tamano optico.

POR QUE EL FZ SE VEIA FORZADO: normalizaba por CAJA, no por AREA. La tinta de
FRZ son dos letras macizas de 353x385, asi que al llevar su caja al 70%% del
lado, las letras ocupan casi todo. El TFC tiene la misma caja pero adentro
lleva un crest completo con anillo de texto, asi que su "letra" queda chica.
Misma caja, peso optico completamente distinto.

LA CORRECCION: normalizar por FRACCION DE AREA CON TINTA. Se escala cada logo
para que sus pixeles opacos cubran la misma porcion del cuadro. Asi una marca
maciza se achica y una liviana crece, y los nueve pesan igual.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

"""
SALEN SOLO CON TINTA, CON FONDO TRANSPARENTE. El fondo del escudo NO se
hornea aca: lo pone la carta.

Por que. Probamos las dos alternativas y las dos fallaban por el mismo lado:

  · placa unica oscura -> el escudo nunca se pelea con la carta, pero los
    logos cuyo COLOR VIVE EN EL FONDO lo pierden. DRA quedaba en blanco y
    negro: sus microfonos son blancos y todo su color era el azul de atras.
  · fondo del archivo -> cada logo conserva su color, pero mete el color de
    SU ARCHIVO al lado del de la carta. TFC y FTN traian su negro contra
    cartas que no son negras, y ademas su tinta quedaba chica adentro de
    ese negro: el cuadro se llenaba, el logo no.

La salida es que el fondo lo ponga la CARTA, con el tono del servidor. Asi
DRA tiene azul —el suyo, el de su carta, no el del archivo—, ninguno trae
un color ajeno, y la tinta se puede agrandar hasta llenar porque ya no
compite con un margen horneado.
"""
# 🔴 ERA UNA RUTA ESCRITA A MANO al repo viejo (el privado): corrida desde el
# público leía y escribía los escudos de OTRA carpeta, sin avisar. Pasó el
# 25/09/2026 al rehacer el de URBF. Sale de dónde está el archivo.
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(BASE, 'comun', 'logos_color')
DST = os.path.join(BASE, 'comun', 'escudos_cuad')
os.makedirs(DST, exist_ok=True)

LADO = 512
# La tinta AHORA LLENA. Con el fondo horneado no se podia: el logo tenia que
# dejar aire para que se viera su placa. Sin placa, el limite lo pone la caja
# y no el area, asi que casi todos cortan por TOPE_CAJA. La normalizacion por
# area sigue sirviendo para los que son puro trazo, que a este tamano se irian
# de escala: por eso queda, y por eso queda la tabla de AJUSTE.
AREA_OBJ = 0.62
TOPE_CAJA = 0.88

# ── LA PLACA ES UNA SOLA, IGUAL EN LOS NUEVE ──────────────────────────────
# Antes cada escudo sacaba el color de placa del borde de su propio archivo,
# y eso traia dos problemas:
#
#   · el de DRA quedaba AZUL, y su carta tambien es azul: dos azules
#     distintos pegados, que es lo que no encajaba;
#   · el de SR quedaba en rgb(16,10,4) mientras el fondo del logo es
#     rgb(3,0,2). Dos negros casi iguales pero no iguales, o sea la juntura
#     visible que se leia como "dos negros".
#
# Con una placa unica el color del servidor lo dan el aro y la carta, y el
# escudo nunca puede pelearse con su propio fondo.
PLACA = (16, 16, 22)

# Ajuste fino a ojo, despues de medir. La normalizacion por area acerca a los
# nueve pero no alcanza sola: el peso OPTICO depende del caracter de la marca.
# FRZ son dos glifos aislados y macizos, asi que a igual area de tinta se ve
# mucho mas grande que un crest con anillo de texto. URBF y TWR son marcas de
# trazo grueso y pasa parecido. Con nueve logos, una tabla es mas honesta que
# seguir inventando formulas.
AJUSTE = {'FRZ': 0.68, 'URBF': 0.86, 'FFA': 0.90, 'SR': 0.90, 'DRA': 0.88}

# TWR va con SU BALDOSA ENTERA, no con la tinta suelta. Se probo separarle
# las letras por saturacion y sale, pero el resultado no es su marca: su
# icono ES la pared de graffiti con las letras encima, y las letras solas
# sobre el degrade de la carta no se leen como TWR. Es el mismo criterio que
# hizo que DRA volviera a tener azul: cuando el fondo es parte de la marca,
# sacarlo no limpia, borra.
#
# RZ entra por lo mismo: su icono es el lobo y las letras SOBRE fuego azul,
# y ese fuego es el logo tanto como el lobo. Separarlo por color deja las
# letras blancas solas, que podrian ser de cualquiera.
A_SANGRE = {'TWR', 'RZ'}


def alfa_por_color(a, fondo):
    """Convierte un logo OPACO en tinta con alfa, quitandole su fondo plano.

    Siete de los nueve archivos vienen 100%% opacos: su fondo es del archivo,
    no del logo. Antes se recortaba la caja de tinta y se pegaba ENTERA sobre
    la placa, fondo incluido, y ahi aparecia la juntura entre los dos.

    Dos cuidados, los dos aprendidos midiendo:

    · RAMPA, no umbral. Un corte duro deja el borde escalonado, que a 68 px
      en la carta se ve como suciedad. La rampa da un borde limpio.
    · RELLENAR HUECOS. El crest de TFC es blanco sobre negro y la parte
      negra de ADENTRO tambien es fondo por color. Sin rellenar, el crest
      quedaba calado y se le veia la placa por el medio. binary_fill_holes
      marca todo lo encerrado por tinta como tinta.
    """
    d = np.abs(a[:, :, :3].astype(int) - np.array(fondo)).sum(axis=2)
    return _alfa(np.clip((d - 26) / 44.0, 0, 1), d > 55)


def alfa_por_saturacion(a, umbral=0.30):
    """Para fondos con TEXTURA, donde no hay un color plano que quitar.

    Separa por cuanto color tiene el pixel, no por cuanto se parece al
    fondo. Sirve cuando el dibujo es vivo y el fondo del mismo tono pero
    apagado, que es exactamente el caso de TWR: letras rosa sobre pared.
    """
    r = a[:, :, :3].astype(float)
    mx, mn = r.max(axis=2), r.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    return _alfa(np.clip((sat - umbral) / 0.18, 0, 1), sat > umbral + 0.12)


def _alfa(suave, duro):
    """Rampa + relleno de huecos, comun a las dos formas de separar.

    · RAMPA y no umbral: un corte duro deja el borde escalonado, y a 68 px
      en la carta eso se lee como suciedad.
    · RELLENAR HUECOS: el crest de TFC es blanco sobre negro y ese negro de
      ADENTRO tambien es fondo. Sin rellenar el crest sale calado.
    """
    try:
        from scipy import ndimage
        suave = np.maximum(suave, ndimage.binary_fill_holes(duro).astype(float))
    except ImportError:
        pass
    return (suave * 255).astype(np.uint8)

# TWR era el unico que quedaba RELLENO, y no por capricho: su fondo no es un
# color plano sino una pared de graffiti, asi que quitarselo por color no
# hace nada. Pero SI se puede separar por SATURACION: las letras son rosa
# vivo y la pared es oscura y apagada. Es el mismo criterio que ya usa
# herramientas/procesar_logos.py en su modo "vivo", justamente para TWR.
POR_SATURACION = {'TWR'}


def sin_manchitas(m, minimo=0.02):
    """Borra las manchas sueltas de menos del 2% de la mancha mas grande.

    ⚠️ ESTO NO ES COSMETICO: MUEVE EL CENTRO. El archivo de DRA trae una
    marca de agua pegada a la esquina. Como el centrado se hace por caja de
    tinta, esa manchita estira la caja hasta el borde derecho y el centro se
    va de x=511.5 a x=603.5 sobre 1024, o sea 46 px sobre 512. El logo queda
    corrido A LA IZQUIERDA sin que nada parezca roto.

    Es exactamente el mismo caso que ya arreglo procesar_logos.py para las
    siluetas, y esta anotado en CLAUDE.md con estos mismos numeros. Pero
    aquel entra por logos_originales/ y este por logos_color/, asi que el
    arreglo no llegaba hasta aca. Dos scripts, el mismo archivo con el mismo
    defecto, y solo uno lo sabia.
    """
    try:
        from scipy import ndimage
    except ImportError:
        return m
    et, n = ndimage.label(m)
    if n <= 1:
        return m
    tam = ndimage.sum(m, et, range(1, n + 1))
    vivos = [i + 1 for i, t in enumerate(tam) if t >= minimo * tam.max()]
    return np.isin(et, vivos)


def mascara(a):
    if (a[:, :, 3] < 250).mean() > 0.02:
        return a[:, :, 3] > 40
    b = np.concatenate([a[0, :, :3], a[-1, :, :3], a[:, 0, :3], a[:, -1, :3]])
    f = np.median(b, axis=0)
    return np.abs(a[:, :, :3].astype(int) - f).sum(axis=2) > 55


print('%-6s %-11s %-11s %-9s %-9s %s' % ('sv', 'origen', 'caja tinta', 'area', 'escala', 'motivo'))
print('-' * 74)
# `python herramientas/escudos_cuadrados.py URBF` rehace sólo ése: los demás
# quedan como están, byte a byte
SOLO = {x.upper() for x in __import__('sys').argv[1:]}
for f in sorted(os.listdir(SRC)):
    sv = os.path.splitext(f)[0].upper()
    if SOLO and sv not in SOLO:
        continue
    if sv.endswith('_ALT') or sv.endswith('_ANIMADO') or f.lower().endswith('.gif'):
        continue
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    a = np.array(im)
    opaco = (a[:, :, 3] < 250).mean() <= 0.02
    if opaco and sv not in A_SANGRE:
        a = a.copy()
        if sv in POR_SATURACION:
            a[:, :, 3] = alfa_por_saturacion(a)
        else:
            b = np.concatenate([a[0, :, :3], a[-1, :, :3],
                                a[:, 0, :3], a[:, -1, :3]])
            a[:, :, 3] = alfa_por_color(a, np.median(b, axis=0))
        im = Image.fromarray(a)
    m = sin_manchitas(a[:, :, 3] > 40)
    if sv not in A_SANGRE:
        a = a.copy()
        a[:, :, 3] = (a[:, :, 3] * m).astype(np.uint8)
        im = Image.fromarray(a)
    ys, xs = np.where(m)
    if not len(xs):
        continue
    x0, x1 = np.percentile(xs, [0.3, 99.7]).astype(int)
    y0, y1 = np.percentile(ys, [0.3, 99.7]).astype(int)
    mw, mh = max(x1-x0, 1), max(y1-y0, 1)
    rec = im.crop((x0, y0, x1+1, y1+1))
    mrec = m[y0:y1+1, x0:x1+1]

    # densidad: que fraccion de la caja es tinta de verdad
    dens = mrec.mean()
    # el lado que hace que la tinta cubra AREA_OBJ del cuadro
    lado_area = (AREA_OBJ * LADO * LADO / max(dens, 1e-6)) ** 0.5
    # ...pero sin que la caja se pase del tope
    lado_tope = TOPE_CAJA * LADO
    lado_fin = min(lado_area, lado_tope) * AJUSTE.get(sv, 1.0)
    motivo = ('por area' if lado_area <= lado_tope else 'tope de caja')
    if sv in AJUSTE:
        motivo += ' x%.2f a mano' % AJUSTE[sv]

    if sv in A_SANGRE:
        rec, nw, nh = im, LADO, LADO
        esc, motivo = LADO / max(im.size), 'a sangre · su baldosa entera'
    else:
        esc = lado_fin / max(mw, mh)
        nw, nh = max(int(mw*esc), 1), max(int(mh*esc), 1)
    rec = rec.resize((nw, nh), Image.LANCZOS)

    # SIN PLACA: la tinta sola, centrada, sobre transparente.
    out = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))
    out.alpha_composite(rec, ((LADO-nw)//2, (LADO-nh)//2))
    out.save(os.path.join(DST, 'sv_%s.png' % sv.lower()))

    print('%-6s %-11s %-11s %-9s %-9s %s'
          % (sv, '%dx%d' % im.size, '%dx%d' % (mw, mh), '%.0f%%' % (100*dens),
             '%.2fx' % esc, motivo))

print()
print('-> %s  ·  %dx%d  ·  solo tinta, sin fondo' % (DST, LADO, LADO))

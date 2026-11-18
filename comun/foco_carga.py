# -*- coding: utf-8 -*-
"""DÓNDE QUEDA LA CARA DEL MC EN «LA BATALLA», EL FONDO DE LA PANTALLA DE CARGA (17/11/2026).

Dlx: *«que cada imagen de la intro, al menos los cuadros de los videos, tenga buen cuadro: a veces sale borrosa, no se ve
al MC, en todas las resoluciones y dispositivos»*.

Lo usan los dos lados, y por eso vive acá y no en ninguno de los dos:

- `herramientas/fondos_carga.py` arma la imagen: recorta la franja del teléfono CENTRADA EN LA CARA y, si la cara está
  muy arriba, BAJA el cuadro (`baja`) para que no caiga debajo del título.
- `web/montar.py` le pasa a la página la caja de la cara en la imagen final (`caja()`), y la página elige el
  `background-position` con ella (`encuadre()` en montar.py): la cara en el mismo lugar relativo que en la imagen y,
  si la pantalla recorta arriba y abajo, corrida lo justo para que quede ENTRE EL TÍTULO Y LA BARRA, medidos.

🔴 ANTES ESTO NO PASABA Y SE PERDÍA EL MC. La página centraba la imagen. Una ventana más angosta que 16:9 (una compu
con la ventana a medias, una tablet acostada 4:3) se comía los costados, y una más ancha (21:9) o una tablet parada,
arriba y abajo: el MC que no estaba en el medio salía cortado o debajo del título. Y la franja del teléfono se recortaba
en un `cx` mirado a ojo que no era la cara: a Kourier le quedaba media cara afuera.

`cara` es la caja de la cara en el cuadro del video, en fracciones (x0, y0, x1, y1), mirada sobre el cuadro con una
grilla (de las cejas al mentón: la gorra puede quedar debajo del título). `baja` es cuánto se baja el cuadro en cada
formato; lo de arriba queda en negro con un fundido. Si no está, se calcula (`baja()`): lo justo para que la cara
arranque debajo del título. Sumar un momento es poner su `seg` y su `cara`.

📐 CUATRO FORMATOS PARA «LA BATALLA» (17/11/2026, Dlx: «sí, todas»): además de la compu (`pc`) y el teléfono parado
(`cel`), que tienen los cinco fondos, la batalla trae la TABLET PARADA (`tab`, 3:4) y las pantallas de más de 2900 px
reales (`hd`, 3840×2160). Medido en la página: en una tablet parada se usaba la del teléfono estirada (0,79–0,84
píxeles de imagen por píxel de pantalla) y en una Mac de 1440×900 la de la compu (0,90). Los otros fondos siguen con
dos: lo del Competitivo no se toca (Dlx, 17/11/2026).

    python comun/foco_carga.py     la tabla y el chequeo: ninguna cara debajo del título, en ninguna forma de pantalla

⚠️ El chequeo usa el título APROXIMADO (`titulo()`); el de verdad lo mide la página. La prueba que manda es la de
Playwright sobre la página construida (la sesión del 17/11/2026 la corrió en 13 pantallas × 8 batallas).
"""
import io
import json
import os

#: el ancho sobre el alto de cada formato de fondo (los de `FORMATOS` de herramientas/fondos_carga.py) y del cuadro
ASPECTO = {'pc': 1600 / 900, 'cel': 432 / 936, 'tab': 3 / 4, 'hd': 16 / 9}
CUADRO = 16 / 9
#: lo que dura el fundido del cuadro bajado, y el aire entre la cara y el título o la barra (como en la página)
FUNDIDO = .10
AIRE = .02


def recorte(b, fmt):
    """(x0, ancho) de lo que se usa del cuadro, en fracciones: en la compu, todo; en el teléfono, una franja vertical
    centrada en la cara (o en `cx`, si la batalla lo fija)."""
    if ASPECTO[fmt] >= CUADRO - 1e-6:
        return 0.0, 1.0
    ancho = ASPECTO[fmt] / CUADRO
    c = b['cara']
    cx = float(b.get('cx', (c[0] + c[2]) / 2))
    return min(max(cx - ancho / 2, 0.0), 1.0 - ancho), ancho


#: hasta dónde llega el título en la imagen de cada formato, con aire (ver `titulo()`): la cara arranca debajo. En la
#: compu, sólo si la cara cae en el ancho del título (30–70 %); en el teléfono y la tablet, el título va de lado a lado
ARRANCA = {'pc': .31, 'hd': .31, 'cel': .235, 'tab': .215}


def baja(b, fmt):
    """Cuánto se baja el cuadro: lo de `baja` en carga.json o, si no está, lo justo para que la cara arranque debajo
    del título. El `hd` es la `pc` más grande y la `tab` baja como el teléfono si no dice otra cosa"""
    dada = b.get('baja') or {}
    if fmt in dada:
        return float(dada[fmt])
    if fmt == 'hd' and 'pc' in dada:
        return float(dada['pc'])
    c = b['cara']
    if fmt in ('pc', 'hd') and (c[2] <= .30 or c[0] >= .70):
        return 0.0
    return round(max(0.0, ARRANCA[fmt] - c[1]), 2)


def caja(b, fmt):
    """La caja de la cara en la imagen final [x0, y0, x1, y1], en fracciones: lo que la página recibe."""
    x0, ancho = recorte(b, fmt)
    c, dy = b['cara'], baja(b, fmt)
    return [round((c[0] - x0) / ancho, 3), round(c[1] + dy, 3), round((c[2] - x0) / ancho, 3), round(min(c[3] + dy, 1), 3)]


def titulo(aspecto):
    """Hasta dónde llega el título (y desde dónde arranca la barra), en fracciones del alto: medido con Playwright sobre
    la página (17/11/2026). En la compu el título va al 26–28 %; en el teléfono parado, al ~20 %; en la tablet parada, al
    ~18 %. La barra, del 88 % para abajo."""
    if aspecto >= .8:
        return .285, .88
    return (.205 if aspecto < .6 else .185), .88


def posicion(b, fmt, aspecto):
    """La caja de la cara en una pantalla de esa forma, con la MISMA regla que `encuadre()` de la página: `cover`, la
    cara en su lugar relativo y, si sobra imagen arriba y abajo, corrida para quedar entre el título y la barra."""
    x0, y0, x1, y1 = caja(b, fmt)
    a = ASPECTO[fmt]
    # el tamaño de la imagen en unidades de la pantalla (ancho 1 = ancho de la pantalla, alto 1 = alto)
    iw, ih = (1.0, aspecto / a) if aspecto > a else (a / aspecto, 1.0)
    ox, oy = iw - 1, ih - 1
    px, py = (x0 + x1) / 2, (y0 + y1) / 2
    if oy > .001:
        t, p = titulo(aspecto)
        lo, hi = (y1 * ih - (p - AIRE)) / oy, (y0 * ih - (t + AIRE)) / oy
        py = min(max(py, lo), hi)
        py = min(max(py, 0.0), 1.0)
    return (-ox * px + x0 * iw, -oy * py + y0 * ih, -ox * px + x1 * iw, -oy * py + y1 * ih)


#: las formas de pantalla que se revisan: compu 16:9, 16:10, 4:3, 21:9, cuadrada y media pantalla; teléfono parado
#: (tres) y tablet parada (dos). Debajo de 0,8 la página usa el fondo del teléfono
#: (la página usa la `tab` de 0,6 a 0,8 y la `cel` debajo de 0,6; la `hd`, con las formas de la compu)
FORMAS = {'pc': (16 / 9, 16 / 10, 4 / 3, 21 / 9, 1.0, .8), 'hd': (16 / 9, 16 / 10, 21 / 9),
          'cel': (390 / 844, 360 / 740, 412 / 915, .59), 'tab': (3 / 4, 820 / 1180, 1024 / 1366, .79, .6)}


def problemas(conf):
    """Las caras que caen debajo del título o de la barra, o se salen de la pantalla, en alguna forma de pantalla."""
    mal = []
    for b in conf['batallas']:
        for fmt in ASPECTO:
            for asp in FORMAS[fmt]:
                t, p = titulo(asp)
                x0, y0, x1, y1 = posicion(b, fmt, asp)
                # en la compu el título va al centro (30–70 % del ancho); en el teléfono y la tablet, casi de lado a lado
                cruza = x1 > .30 and x0 < .70 if asp >= .8 else True
                if cruza and y0 < t:
                    mal.append('%s %s %.2f: la cara arranca en el %.0f %% del alto, debajo del título (hasta el %.0f %%)' % (
                        b['id'], fmt, asp, y0 * 100, t * 100))
                if x0 < -.02 or x1 > 1.02 or y1 > 1.02:
                    mal.append('%s %s %.2f: la cara se sale de la pantalla (%.2f %.2f %.2f %.2f)' % (b['id'], fmt, asp, x0, y0, x1, y1))
    return mal


if __name__ == '__main__':
    import sys
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass
    conf = json.load(io.open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'web', 'carga.json'),
                             encoding='utf-8'))
    for b in conf['batallas']:
        print('%-11s pc %-26s cel %-26s baja %s' % (b['id'], caja(b, 'pc'), caja(b, 'cel'), {f: baja(b, f) for f in ASPECTO}))
    mal = problemas(conf)
    for m in mal:
        print('🔴', m)
    print('✅ ninguna cara debajo del título ni afuera, en %d formas de pantalla' % sum(len(v) for v in FORMAS.values())
          if not mal else '🔴 %d problemas' % len(mal))
    sys.exit(1 if mal else 0)

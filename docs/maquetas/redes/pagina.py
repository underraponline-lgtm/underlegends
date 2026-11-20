# -*- coding: utf-8 -*-
"""Arma la página privada de la maqueta con las imágenes de salida/ embebidas: pagina.html."""
import base64
import io
import os

AQUI = os.path.dirname(os.path.abspath(__file__))
SAL = os.path.join(AQUI, 'salida')


def img(nombre):
    with open(os.path.join(SAL, nombre + '.webp'), 'rb') as f:
        return 'data:image/webp;base64,' + base64.b64encode(f.read()).decode()


DIRS = [
    ('A', 'Póster de pelea', 'El campeón como en el afiche de una velada: un sol negro con el anillo del color del servidor, su tarjeta enorme con '
     'dos ecos, la pegatina con los títulos o la nota y el nombre gigante. Abajo, el ticket con lo que ganó.',
     'La que más grita: en el feed se reconoce de lejos por el sol y el nombre gigante.'),
    ('B', 'Portada de revista', 'La semana del servidor como la tapa de una revista deportiva: el nombre del servidor en la cabecera, '
     'el titular en papel rasgado («se lleva 2 en una semana»), tres números grandes y las fechas abajo, como los títulos de tapa.',
     'La que más cuenta. Cada servidor tiene su cabecera, así que el feed de cada uno se ve propio.'),
    ('C', 'Carta y ticket', 'La tarjeta pegada con cinta sobre papel, con la sombra verde de la Liga, un número gigante al costado y '
     'la entrada del evento con su talón y el sello «Campeón».',
     'La que recomiendo: es el mismo lenguaje de la página y las tarjetas, y la que mejor aguanta al que no tiene tarjeta y a los colores oscuros.'),
]
PIEZAS = [('campeon_FFA', 'Campeón · FFA', 'Valen, con su tarjeta'),
          ('campeon_CH', 'Campeón · Cypherhood', 'Flash no tiene tarjeta: va su silueta'),
          ('top_CH', 'El top 5 · Cypherhood', 'Con dos sin tarjeta y un empate en 7.500'),
          ('story_FFA', 'Historia · FFA', '1080 × 1920, todo dentro de la zona segura')]


def main():
    secciones = []
    for k, nom, que, por in DIRS:
        figs = ''.join(
            '<figure class="pz%s"><button type="button" class="ver" data-src="%s" aria-label="Ver %s en grande">'
            '<img src="%s" alt="%s, dirección %s" loading="lazy"></button><figcaption><b>%s</b><span>%s</span></figcaption></figure>'
            % (' alta' if p.startswith('story') else '', 'i-%s-%s' % (k, p), t, img('%s_%s' % (k, p)), t, nom, t, c)
            for p, t, c in PIEZAS)
        secciones.append(
            '<section class="dir" id="dir-%s"><header class="dir-h"><span class="letra">%s</span><div><h2>%s</h2><p>%s</p>'
            '<p class="por">%s</p></div></header><div class="grilla">%s</div></section>' % (k.lower(), k, nom, que, por, figs))
    largo = ''.join(
        '<figure><button type="button" class="ver" aria-label="Ver %s en grande"><img src="%s" alt="Peor caso, dirección %s" loading="lazy">'
        '</button><figcaption><b>%s · %s</b><span>Nombre de tres palabras y tres eventos</span></figcaption></figure>'
        % (nom, img('%s_campeon_LARGO' % k), nom, k, nom) for k, nom, _q, _p in DIRS)
    feed = ''.join(
        '<div class="feed"><span class="feed-t">%s · %s</span><div class="feed-g">%s</div></div>'
        % (k, nom, ''.join('<img src="%s" alt="">' % img('%s_%s' % (k, p)) for p in ('campeon_FFA', 'top_CH', 'campeon_CH')))
        for k, nom, _q, _p in DIRS)
    html = io.open(os.path.join(AQUI, 'plantilla.html'), encoding='utf-8').read()
    html = html.replace('<!--DIRS-->', ''.join(secciones)).replace('<!--FEED-->', feed).replace('<!--LARGO-->', largo)
    io.open(os.path.join(AQUI, 'pagina.html'), 'w', encoding='utf-8').write(html)
    print('pagina.html', round(len(html) / 1024), 'KB')


if __name__ == '__main__':
    main()

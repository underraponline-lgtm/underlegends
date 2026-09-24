"""Dar de alta a Rap Zone en todos los lugares donde tiene que existir.

Guardar el logo en logos_color/ no alcanza: un servidor vive en varios
archivos y si falta en uno, algo se rompe o se dibuja mal SIN AVISAR. Ya
paso con URBF, que no estaba en el LOGO de escudos.py y tumbaba las 138 por
2 personas.

Donde tiene que estar:

    comun/logos_color/rz.png        el logo a color            (ya estaba)
    comun/escudos_cuad/sv_rz.png    el escudo de la carta      (ya estaba)
    comun/logos_sv/sv_rz.png        la SILUETA, que es el fallback de
                                    comun/escudos.py para los servidores
                                    sin icono de Discord. RZ no tiene, asi
                                    que sin esto escudo() le devuelve ''
    datos/colores_sv_marca.json     su color de marca
    datos/estrellas.json            sus Interserver ganados

⚠️ LO QUE ESTE SCRIPT NO PUEDE ARREGLAR: el pool sale del Google Sheet, y el
servidor de cada rapero se deriva de las columnas por servidor de la hoja
Ranking Temporada. Si RZ no esta en la planilla, NADIE va a recibir esta
carta por mas que este diseñada y dada de alta aca.

La silueta se saca de la tinta CLARA y DESATURADA del logo —el lobo y las
letras— y no de todo lo opaco: si se tomara todo, la silueta seria el
cuadrado entero, porque el fondo del archivo es opaco.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'


def silueta():
    src = os.path.join(BASE, 'comun', 'logos_color', 'rz.png')
    dst = os.path.join(BASE, 'comun', 'logos_sv', 'sv_rz.png')
    a = np.array(Image.open(src).convert('RGB')).astype(float)
    mx, mn = a.max(axis=2), a.min(axis=2)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    lum = .2126 * a[:, :, 0] + .7152 * a[:, :, 1] + .0722 * a[:, :, 2]

    # el lobo y las letras: claros y sin color. El fuego es azul saturado.
    m = (sat < .30) & (lum > 88)
    try:
        from scipy import ndimage
        et, n = ndimage.label(m)
        if n:
            t = ndimage.sum(m, et, range(1, n + 1))
            m = np.isin(et, [i + 1 for i, s in enumerate(t) if s >= .02 * t.max()])
            m = ndimage.binary_fill_holes(m)
    except ImportError:
        pass

    al = Image.fromarray((m * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(0.6))
    blanco = Image.new('L', al.size, 255)
    Image.merge('RGBA', [blanco, blanco, blanco, al]).save(dst)
    print('  silueta   -> comun/logos_sv/sv_rz.png   (%.1f%% de tinta)'
          % (100 * m.mean()))


def json_add(ruta, cambios):
    p = os.path.join(BASE, ruta)
    d = json.load(open(p, encoding='utf-8'))
    tocado = False
    for clave, valor in cambios.items():
        if clave in d and 'RZ' not in d[clave]:
            d[clave]['RZ'] = valor
            tocado = True
    if tocado:
        json.dump(d, open(p, 'w', encoding='utf-8'),
                  ensure_ascii=False, indent=1)
        print('  %-28s -> RZ agregado' % ruta)
    else:
        print('  %-28s    ya estaba' % ruta)


if __name__ == '__main__':
    print('ALTA DE RAP ZONE')
    silueta()
    json_add('datos/colores_sv_marca.json', {
        'usar': '#3A96F2',
        'de_donde_sale': 'del logo · el punto más caliente de su fuego azul',
    })
    json_add('datos/estrellas.json', {'estrellas_por_servidor': 0})
    print('\n  ⚠️ FALTA EN EL SHEET. El servidor de cada rapero se deriva de')
    print('     las columnas por servidor. Si RZ no esta en la planilla,')
    print('     nadie va a recibir esta carta.')

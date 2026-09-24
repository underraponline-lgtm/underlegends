"""
GENERAR LA TARJETA TEMPORADA
=============================

normal_v3.py NO es un script: es un modulo con una funcion `render(lista)`.
Este archivo es el que se corre.

    python3 generar.py                 # los 8 de muestra, uno por rango
    python3 generar.py Konan Valen     # solo esos

Escribe salida/tarjeta_temporada.html
"""
import importlib.util as iu
import json
import os
import sys

BASE = os.path.dirname(os.path.abspath(__file__))

# los 8 de muestra: uno por rango, todos con avatar que carga
MUESTRA = ['Konan', 'Axinu', 'Valen', 'Bloody', 'Humildad', 'Jupiter', 'Trot', 'Benja']


def cargar():
    sp = iu.spec_from_file_location('nv3', os.path.join(BASE, 'normal_v3.py'))
    m = iu.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


def main():
    # una sola fuente de verdad: datos/. Antes cada carpeta tenia su copia y
    # refrescar el pool desde el Sheet no cambiaba nada aca, sin avisar.
    pool_json = os.path.join(os.path.dirname(BASE), 'datos', 'temporada_pool.json')
    pool = {d['raw']: d for d in json.load(open(pool_json, encoding='utf-8'))}
    pedidos = sys.argv[1:] or MUESTRA
    datos = [pool[n] for n in pedidos if n in pool]
    faltan = [n for n in pedidos if n not in pool]
    if faltan:
        print('no estan en el pool:', ', '.join(faltan))
    if not datos:
        print('no quedo nadie que dibujar'); return

    m = cargar()
    css = open(os.path.join(BASE, 'normal_v3.css'), encoding='utf-8').read()
    html = """<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Tarjeta Temporada</title><style>%s
body{background:#07070C;padding:34px 20px}
.rack{display:flex;gap:24px;flex-wrap:wrap;justify-content:center;max-width:1320px;margin:0 auto}
</style></head><body><div class="rack">%s</div></body></html>""" % (css, m.render(datos))

    salida = os.path.join(BASE, 'salida', 'tarjeta_temporada.html')
    os.makedirs(os.path.dirname(salida), exist_ok=True)
    open(salida, 'w', encoding='utf-8').write(html)
    print('%d cartas -> %s' % (len(datos), salida))


if __name__ == '__main__':
    main()

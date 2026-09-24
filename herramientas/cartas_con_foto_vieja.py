# -*- coding: utf-8 -*-
"""QUE CARTAS SE DIBUJARON ANTES DE QUE LA FOTO MEJORARA.

    python herramientas/cartas_con_foto_vieja.py

El 19/09/2026 se rebajaron 288 avatares que estaban a 256 px: la carta los
dibuja a 345, asi que se agrandaban 2.7 veces y se veian blandos. Las cartas
dibujadas ANTES de eso llevan la foto vieja adentro, y eso no se nota mirando
el JSON ni el inventario de R2 — la carta ya esta, y parece bien.

⚠️ SE COMPARA POR FECHA DE ARCHIVO, que es lo unico que distingue «esta carta
tiene la foto nueva» de «esta carta tiene la vieja». El PNG no guarda de donde
salio su avatar.

⚠️ Y SOLO CUENTA SI LA FOTO DE ESA PERSONA MEJORO DE VERDAD. Redibujar 1.100
cartas para que 130 queden igual es una hora y media de nada.
"""
import io
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)

AVATARES = os.path.join(BASE, '03_Servidor', 'disenos', '_avatares')
CARPETAS = (
    ('Servidor',    os.path.join(BASE, '03_Servidor', 'salida'), r'^sv-[a-z0-9]+_(.+)$'),
    ('País',        os.path.join(BASE, '04_Pais', 'salida'),     r'^pais_(.+)$'),
    ('Bloqueadas',  os.path.join(BASE, 'bot', 'salida', 'bloqueadas'),
     r'^bloq-[a-z]+_(.+)$'),
)


def main():
    if not os.path.isdir(AVATARES):
        sys.exit('no encuentro %s' % AVATARES)
    # cuando se rebajo cada foto
    foto_de = {}
    for f in os.listdir(AVATARES):
        if f.endswith('.png'):
            foto_de[re.sub(r'[^a-z0-9]', '', f[:-4].lower())] = os.path.getmtime(
                os.path.join(AVATARES, f))

    print('')
    total_viejas = 0
    for etiqueta, carpeta, patron in CARPETAS:
        if not os.path.isdir(carpeta):
            continue
        rx = re.compile(patron, re.I)
        viejas, nuevas, sin_foto = 0, 0, 0
        for f in os.listdir(carpeta):
            if not f.endswith('.png'):
                continue
            m = rx.match(f[:-4])
            if not m:
                continue
            k = re.sub(r'[^a-z0-9]', '', m.group(1).lower())
            tf = foto_de.get(k)
            if tf is None:
                sin_foto += 1
                continue
            # la carta es mas vieja que la foto -> lleva la foto anterior
            if os.path.getmtime(os.path.join(carpeta, f)) < tf:
                viejas += 1
            else:
                nuevas += 1
        total_viejas += viejas
        print('  %-11s  con la foto NUEVA: %4d   ·   con la VIEJA: %4d   ·   '
              'sin foto: %d' % (etiqueta, nuevas, viejas, sin_foto))
    print('\n  a redibujar: %d cartas\n' % total_viejas)


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

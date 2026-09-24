# -*- coding: utf-8 -*-
"""QUIEN TIENE FOTO Y QUIEN SALE CON LA INICIAL, medido sobre las 469.

    python herramientas/estado_avatares.py

`CLAUDE.md` dice «9 de 138, el 6.5 %» y esa medicion es de antes de que el bot
existiera. Con el token se pueden pedir a Discord, asi que la pregunta hoy es
otra: de quienes tienen carta, ¿a cuantos les falta la foto, y de esos a
cuantos Discord SI se la puede dar?

⚠️ SE MIRA EL ANCHO DE LA IMAGEN, NO SI EL ARCHIVO EXISTE. Los primeros se
bajaron a 128 px y la carta los dibuja a 345: se agrandaban 2.7 veces y se
veian blandos. Un chequeo de «ya esta» por existencia habria dejado esos
adentro para siempre — es la nota que ya esta escrita en `CLAUDE.md`.
"""
import io
import json
import os
import re
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
sys.path.insert(0, BASE)
sys.path.insert(0, os.path.join(BASE, 'sheet'))

AVATARES = os.path.join(BASE, '03_Servidor', 'disenos', '_avatares')
CHICO = 400          # por debajo de esto la carta lo agranda y se ve blando


def limpio(nombre):
    n = re.sub(r'[^\w\s-]', '', nombre, flags=re.UNICODE).strip()
    return re.sub(r'\s+', '_', n).lower() or 'sin_nombre'


def main():
    import construir_padron as PAD
    from PIL import Image

    with io.open(os.path.join(BASE, 'datos', 'cartas_r2.json'), encoding='utf-8') as f:
        inv = json.load(f)
    idx = PAD.por_nombre()
    pools = {}
    with io.open(os.path.join(BASE, 'datos', 'competitivo_pool.json'),
                 encoding='utf-8') as f:
        for x in json.load(f):
            pools[PAD.norm(x['raw'])] = x

    bien, chicos, sin, sin_id = [], [], [], []
    for k in sorted(inv):
        p = pools.get(k) or idx.get(k) or {}
        nom = p.get('raw') or k
        did = (idx.get(k) or {}).get('discord_id')
        ruta = os.path.join(AVATARES, limpio(nom) + '.png')
        if os.path.exists(ruta) and os.path.getsize(ruta) > 1024:
            try:
                w = Image.open(ruta).width
            except Exception:
                w = 0
            (bien if w >= CHICO else chicos).append((nom, w))
        elif did:
            sin.append(nom)
        else:
            sin_id.append(nom)

    tot = len(inv)
    print('\nDe las %d personas con carta:' % tot)
    print('   ✅ foto buena (>= %d px)       %4d   %.1f %%' % (CHICO, len(bien), 100 * len(bien) / tot))
    print('   🟡 foto chica, se ve blanda    %4d   %.1f %%' % (len(chicos), 100 * len(chicos) / tot))
    print('   ❌ sin foto, PERO con ID       %4d   %.1f %%   <- a estos Discord se la puede dar'
          % (len(sin), 100 * len(sin) / tot))
    print('   ⚫ sin foto y sin Discord ID   %4d   %.1f %%   <- estos no tienen arreglo hoy'
          % (len(sin_id), 100 * len(sin_id) / tot))
    if chicos:
        print('\n   las chicas: %s' % ', '.join('%s (%dpx)' % x for x in sorted(chicos)[:14]))
    if sin:
        print('\n   sin foto con ID: %s%s'
              % (', '.join(sorted(sin)[:16]), ' …' if len(sin) > 16 else ''))
    print('\n   El que las baja es: python bot/cartas_nuevas.py --avatares\n')


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    main()

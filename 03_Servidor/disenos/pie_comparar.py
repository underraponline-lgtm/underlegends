"""Que lleva abajo cada carta, y cuanto lugar libre queda en la Servidor.

Dlx: "Resolvamos que puede ir abajo primero, comparalo con lo que lleva
abajo las demas tarjetas".

Las posiciones NO salen de mirar los PNG: salen del CSS y de los modulos
canonicos, que es donde estan escritas. Los PNG estan para ver el gesto, no
para medirlo.

    Temporada     01_Temporada/normal_v3.css
    Competitiva   02_Competitivo/v2/card.css  (.chem .tagbot .ul)
    Servidor      comun/divisor.py + ESTADO.md

⚠️ EL LUGAR LIBRE ES EL DATO QUE MANDA. Se puede proponer cualquier cosa;
lo que decide es cuanto entra. En la Servidor el pie va del divisor al borde
y el UL ya se lleva un pedazo.
"""
import os
import sys

from PIL import Image

BASE = r'C:\Users\tonyd\Downloads\LigaGlobal_Tarjetas'
SCR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
sys.path.insert(0, SCR)
from comun import divisor as DIV
from comun.siluetas import PICO

# ── lo que lleva cada una, con su y en px de su propia carta ─────────────
# (carta, alto, [(y, alto, que es)])
CARTAS = [
    ('Temporada', 438, [
        (389, 14, 'TAG chico a la IZQUIERDA  ("PRE")'),
        (383, 26, 'pastilla de TAG al CENTRO ("DINASTIA")'),
        (386, 22, 'UL a la DERECHA, en la misma linea'),
    ]),
    ('Competitiva', 485, [
        (357, 27, 'fila de CIRCULOS: bandera + servidor,'),
        (357, 27, '   con aro que mide y el puesto adentro'),
        (398, 17, 'pastilla de TAG al centro ("#1 COMPETITIVO")'),
        (429, 21, 'UL al CENTRO'),
    ]),
    ('FINAL REFERENCIA', 485, [
        (0, 0, 'panel VACIO: no lleva nada adentro'),
        (462, 46, 'GEMA hexagonal centrada SOBRE EL BORDE,'),
        (462, 46, '   apoyada en un galon que la abraza'),
    ]),
]

ALTO = PICO.h
UL_Y, UL_H = 372, 20.7          # el mismo de la Competitiva
Y_NOMBRE = 281.6
NOM_H = 25.6                    # 1.6rem con line-height 1


def main():
    extremos = DIV.Y_EXTREMOS * ALTO
    sube = DIV.RECORRIDO * PICO.w * 1.3
    cima = extremos - sube
    nom_top = Y_NOMBRE - 16
    nom_bot = nom_top + NOM_H
    libre_a, libre_b = nom_bot, UL_Y

    print('=' * 66)
    print('QUE LLEVA ABAJO CADA CARTA')
    print('=' * 66)
    for nombre, alto, filas in CARTAS:
        print('\n%s   (carta de %d px de alto)' % (nombre.upper(), alto))
        vistos = set()
        for y, h, que in filas:
            if que.startswith('   '):
                print('        %38s' % '' + que.strip())
                continue
            pos = '' if not h else 'y %3d..%-3d  (%4.1f%%)' % (y, y + h,
                                                              100 * y / alto)
            print('   %-26s %s' % (pos, que))
            vistos.add(que)

    print('\n' + '=' * 66)
    print('LA SERVIDOR: CUANTO LUGAR HAY')
    print('=' * 66)
    print('   carta                 300 x %d' % ALTO)
    print('   divisor  cima          y %6.1f' % cima)
    print('            extremos      y %6.1f' % extremos)
    print('   nombre                 y %6.1f .. %.1f' % (nom_top, nom_bot))
    print('   UL                     y %6.1f .. %.1f' % (UL_Y, UL_Y + UL_H))
    print('   borde de abajo         y %6.1f' % ALTO)
    print()
    print('   >> LIBRE               y %6.1f .. %.1f   =  %.1f px'
          % (libre_a, libre_b, libre_b - libre_a))
    print('      ancho ahi                    ~%d px' % 294)
    print()
    print('   Y DEBAJO DEL UL        y %6.1f .. %d   =  %.1f px'
          % (UL_Y + UL_H, ALTO, ALTO - UL_Y - UL_H))
    print('      ahi la carta se cierra en punta: a y=%d ya mide %d de ancho'
          % (ALTO, 0))

    print('\n' + '=' * 66)
    print('LO QUE ESTO OBLIGA')
    print('=' * 66)
    for t in (
        '1. El circulo del SERVIDOR no se puede repetir. La Competitiva lo',
        '   pone abajo con su aro; aca el servidor YA ES EL EMBLEMA DE',
        '   ARRIBA. Repetirlo abajo es decir dos veces lo mismo en la carta',
        '   que existe justamente para decirlo una vez bien.',
        '',
        '2. La GEMA y el LADO DERECHO se pelean por el mismo trabajo. La',
        '   gema del pie estaba descartada porque "el rango ya esta en la',
        '   columna" — pero la columna es lo que NO esta decidido. Si el',
        '   rango baja a la gema, el lado derecho NO puede volver a',
        '   mostrarlo. Resolver el pie ya decide parte de la derecha.',
        '',
        '3. RACHA y DUELOS POR SERVIDOR NO EXISTEN. rch_act/rch_max son',
        '   globales y duel_real esta en 4 de 138. No es que falten datos:',
        '   es que ese numero no esta calculado en ningun lado. Cualquier',
        '   propuesta que los use hay que construirla en el builder primero.',
        '',
        '4. pos_sv SI EXISTE, 135 de 138, y es EL numero propio de esta',
        '   carta: que puesto ocupa dentro de su servidor.',
    ):
        print('   ' + t if t else '')

    # ── los recortes, para ver el gesto ──────────────────────────────────
    fuentes = [
        ('temporada', os.path.join(BASE, '01_Temporada', 'Konan_temporada.png')),
        ('competitiva', os.path.join(BASE, '02_Competitivo',
                                     'Konan_competitivo.png')),
        ('referencia', os.path.join(BASE, '03_Servidor', 'referencia',
                                    'estructura', 'FINAL REFERENCIA.png')),
    ]
    hechos = []
    for etq, p in fuentes:
        if not os.path.exists(p):
            print('\n   (falta %s)' % p)
            continue
        im = Image.open(p).convert('RGBA')
        w, h = im.size
        rec = im.crop((0, int(h * .70), w, h))
        k = 620 / rec.width
        rec = rec.resize((620, max(1, int(rec.height * k))), Image.LANCZOS)
        d = os.path.join(SCR, '_pie_%s.png' % etq)
        rec.save(d)
        hechos.append(d)
    print('\n   recortes del pie -> %s' % ', '.join(os.path.basename(x)
                                                    for x in hechos))


if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    main()

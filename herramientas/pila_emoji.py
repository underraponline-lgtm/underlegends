# -*- coding: utf-8 -*-
"""AGREGA 'Noto Color Emoji' A TODAS LAS PILAS DE FUENTES DEL PROYECTO.

    python herramientas/pila_emoji.py --ver       que tocaria
    python herramientas/pila_emoji.py --aplicar   lo hace

POR QUE HACE FALTA
------------------
`herramientas/emoji_embed.py` deja los 17 emoji embebidos en
`comun/fonts/embed.css` bajo la familia `'Noto Color Emoji'`. **Eso solo no
alcanza**: si ninguna pila la nombra, el archivo existe y no lo usa nadie —
y el emoji sigue saliendo de la fuente del sistema, distinto en cada maquina.

🔴 SE PROBO EL ATAJO Y ROMPIO. Declarar los emoji bajo `'Archivo'` con su
`unicode-range` habria evitado tocar una sola pila. Medido: el ancho de
«SERVIDOR» a 900/100px paso de **575,31 a 524,38** —el fallback da 520,52—,
o sea que **el texto dejo de usar Archivo**. Un `font-weight:100 1000`
empata con la cara real de 900 y gana por ser la ultima declarada. Y lo
peligroso: **el emoji salia perfecto**, asi que parecia que habia
funcionado; lo que se rompio fue el texto de al lado.

⚠️ ES UN REEMPLAZO DE CADENA, NO UN REGEX SOBRE EL CSS. CLAUDE.md prohibe lo
segundo porque un `^selector {` se come `.card` entero. Aca no se borra ni
se reescribe ninguna regla: se **agrega un nombre de familia** adentro de una
declaracion que ya existe. Y es idempotente — si ya esta, no lo pone dos
veces.
"""
import ast
import io
import os
import sys

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

EMOJI = "'LigaEmoji'"

# ⚠️ LAS DOS FORMAS EN QUE ESTE REPO ESCRIBE LA PILA. Se buscan literales y
# no un patron: un patron que acepte cualquier `font-family:...` tocaria
# tambien las hojas de control y los `print`, que nunca llegan a un PNG.
CAMBIOS = [
    # migracion: el primer intento la llamo 'Noto Color Emoji' y colisiono
    # con la que Cloudflare trae instalada.
    ("'Noto Color Emoji'", EMOJI),
    ("'Archivo',sans-serif", "'Archivo'," + EMOJI + ",sans-serif"),
    # 🔴 ACA VA **SIN COMILLAS**, Y NO ES UN DESCUIDO: ES UN BUG QUE YA
    # ROMPI. Con `'LigaEmoji'` entrecomillado, esta linea de
    # `comun/bloqueada.py`
    #
    #     '.et{color:#EDEDF5;font-family:Archivo,system-ui;font-size:12px;'
    #
    # queda con una comilla simple **adentro de una cadena Python de
    # comillas simples**, y el archivo deja de compilar. Paso exactamente
    # eso: `comun/bloqueada.py:346  SyntaxError`.
    #
    # ⚠️ Y lo encontro `puedo_generar.py`, no la lectura del diff. Los otros
    # dos patrones ya traen comillas en el original, asi que agregarlas no
    # cambia nada; este no las traia. CSS acepta el nombre sin comillas
    # mientras sea un identificador valido, y `LigaEmoji` lo es.
    ('Archivo,system-ui', 'Archivo,' + EMOJI.strip("'") + ',system-ui'),
    ("'Barlow Condensed',sans-serif", "'Barlow Condensed'," + EMOJI + ",sans-serif"),
    # 🔴 CON EL ESPACIO TAMBIEN. `normal_v3.css` escribe
    # `'Barlow Condensed', sans-serif` con un espacio despues de la coma y
    # el literal sin espacio no lo encuentra. Es una linea de la Temporada
    # que se habria quedado con el emoji del sistema **sin avisar**.
    ("'Barlow Condensed', sans-serif", "'Barlow Condensed', " + EMOJI + ", sans-serif"),
]

# Lo que NO se toca: el generador de la fuente (declara la familia, no la
# usa) y este mismo archivo.
SALTEAR = ('herramientas/emoji_embed.py', 'herramientas/pila_emoji.py')


def archivos():
    for raiz, dirs, files in os.walk(BASE):
        dirs[:] = [d for d in dirs
                   if d not in ('.git', '__pycache__', 'salida', 'node_modules',
                                'fonts', 'datos')]
        for f in files:
            # 🔴 LOS `.css` TAMBIEN, Y CASI ME LOS SALTEO. La Temporada y la
            # Competitiva no arman su CSS en Python: lo leen de
            # `01_Temporada/normal_v3.css` y `02_Competitivo/v2/card.css`.
            # Recorriendo solo `.py`, esas **dos cartas de cuatro** se
            # quedaban con el emoji del sistema y el script decia que habia
            # tocado 60 archivos — o sea, habria reportado exito.
            if not (f.endswith('.py') or f.endswith('.css')):
                continue
            p = os.path.join(raiz, f)
            rel = os.path.relpath(p, BASE).replace(os.sep, '/')
            if rel in SALTEAR:
                continue
            yield p, rel


def main():
    ver = '--ver' in sys.argv
    aplicar = '--aplicar' in sys.argv
    if not (ver or aplicar):
        print(__doc__)
        return 0

    tocados, rotos, total, ya = [], [], 0, 0
    for p, rel in archivos():
        s = io.open(p, encoding='utf-8').read()
        n = 0
        nuevo = s
        for viejo, con in CAMBIOS:
            if con in nuevo:
                ya += nuevo.count(con)
            # ⚠️ Solo lo que NO tiene ya el emoji: si no, `'Archivo',sans-serif`
            # dentro de `'Archivo','Noto Color Emoji',sans-serif` no existe,
            # asi que esto ya es idempotente — pero se cuenta igual para
            # poder decirlo.
            c = nuevo.count(viejo)
            if c:
                nuevo = nuevo.replace(viejo, con)
                n += c
        if n:
            # 🔴 SE COMPILA ANTES DE GUARDAR, Y ESTE CHEQUEO FALTABA.
            # Entrecomillando el nombre, `comun/bloqueada.py` quedo con una
            # comilla simple adentro de una cadena de comillas simples y
            # dejo de compilar. El diff se leia perfecto; lo encontro
            # `puedo_generar.py` mucho despues, cuando ya habia 326 cambios
            # encima. Un reemplazo masivo que no compila lo que escribe es
            # un `sed` con mas pasos.
            if p.endswith('.py'):
                try:
                    # ⚠️ SE LE SACA EL BOM ANTES DE PARSEAR. `ast.parse` lo
                    # ve como `invalid non-printable character U+FEFF`,
                    # pero **Python carga ese archivo perfecto** porque
                    # detecta utf-8-sig al importar. Sin este `lstrip`, el
                    # unico .py del repo que tiene BOM
                    # —`03_Servidor/disenos/v9.py`— se daba por roto y
                    # quedaba afuera del reemplazo, en silencio.
                    ast.parse(nuevo.lstrip('﻿'))
                except SyntaxError as e:
                    rotos.append((rel, e.lineno, str(e)[:60]))
                    continue
            tocados.append((rel, n))
            total += n
            if aplicar:
                tmp = p + '.tmp'
                with io.open(tmp, 'w', encoding='utf-8') as f:
                    f.write(nuevo)
                os.replace(tmp, p)

    print('\n══ LAS PILAS DE FUENTES ══\n')
    if rotos:
        # ⚠️ RUIDOSO, Y SIN ESCRIBIR ESOS. Un reemplazo masivo que rompe un
        # archivo y sigue de largo deja el repo peor que antes, con un
        # mensaje de exito arriba.
        print('   🔴 %d archivo(s) NO se tocaron: el cambio los rompia\n'
              % len(rotos))
        for rel, ln, e in rotos:
            print('      %s:%s  %s' % (rel, ln, e))
        print('')
    if ya:
        print('   %d ya tenian %s\n' % (ya, EMOJI))
    if not tocados:
        print('   nada que cambiar.\n')
        return 0
    for rel, n in sorted(tocados, key=lambda x: -x[1]):
        print('   %-44s %2d' % (rel, n))
    print('\n   %-44s %2d  en %d archivo(s)'
          % ('TOTAL', total, len(tocados)))
    if not aplicar:
        print('\n   (esto fue `--ver`: no se cambio nada)\n')
    else:
        print('\n   ✅ aplicado')
        print('\n   ⚠️ Verificar midiendo, no mirando: el ancho de «SERVIDOR»')
        print('      a 900/100px tiene que seguir dando 576 y el emoji tiene')
        print('      que dejar de depender del sistema.\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())

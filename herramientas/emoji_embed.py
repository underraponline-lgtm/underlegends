# -*- coding: utf-8 -*-
"""RECORTA NOTO COLOR EMOJI A LOS EMOJI QUE ESTE PROYECTO USA.

    python herramientas/emoji_embed.py --ver      cuales son y cuanto pesan
    python herramientas/emoji_embed.py --enhtml   cuales DIBUJA cada carta
    python herramientas/emoji_embed.py --armar    los empalma en comun/fonts/embed.css

🔴 POR QUE EXISTE: LAS 138 DEPENDIAN DE LA MAQUINA QUE DIBUJA.
--------------------------------------------------------------
El TAG de cada carta lleva un emoji —hoy 🎤 en 113 personas y 🔥 en 25, o sea
**las 138 de 138**— y ese caracter **no lo dibuja el proyecto**: lo pone la
fuente de emoji del sistema. Medido el 20/09/2026 renderizando la misma
carta local y en Cloudflare:

    la foto              identica
    el texto de Archivo  0 px de corrimiento, solo antialiasing
    la estrella ⭐        OTRO DIBUJO, y 15 px mas ancha
    el texto de al lado  corrido 15 px por culpa de eso

⚠️ Y NO ERA UN PROBLEMA DE CLOUDFLARE: ERA UN BUG QUE NO SE VEIA. En la
arquitectura acordada, despues de cada evento las cartas las dibuja **GitHub
Actions, que corre en Linux**. Ahi el emoji tampoco iba a ser el de la
maquina de Dlx — y si el contenedor no trae fuente de emoji, sale **un
cuadradito vacio** y nadie se entera. No se noto porque hasta hoy todas las
cartas salieron de la misma maquina.

Es exactamente el motivo por el que el repo ya guarda las **9 woff2** en vez
de pedirselas a Google. El emoji se paso por alto.

⚠️ SE ELIGIO LA DE CLOUDFLARE, Y LA ELIGIO DLX MIRANDOLA. Se le mostraron
las dos ampliadas 7x: *«la de la derecha se ve mejor... como lo dibujo
cloudflare, esta bonito»*. La de la derecha es **Noto Color Emoji**, que es
justo la que usan Cloudflare y Linux — asi que ademas es la que iba a salir
sola en Actions.

⚠️ SE RECORTA A LOS 17, Y ESO NO ES AHORRO PORQUE SI. Los siete trozos que
Google sirve pesan **1.196 KB** y `embed.css` hoy pesa 544: embeberlos
enteros mas que duplicaria **cada carta**, y esa cadena ya pesa 1,3 MB. Los
17 que el proyecto puede dibujar entran en una fraccion.

⚠️ LOS 17 SE LEEN DE LAS CADENAS **PARSEADAS**, no con un grep. En
`comun/titulos.py` varios estan escritos como `\\U0001F451`, o sea que en el
TEXTO del archivo son la barra, la U y unos digitos: un grep por caracteres
altos no los ve. Por eso se usa `ast`. Es la forma de siempre — el dato
estaba y la pregunta no iba a buscarlo.
"""
import ast
import base64
import io
import os
import re
import sys
import unicodedata

import requests

SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(SCR)
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except AttributeError:
    pass

# (ya no hay archivo suelto: el bloque se empalma en embed.css)

# 🔴 FAMILIA PROPIA, Y NO LA DE LAS CARTAS. PROBE LO CONTRARIO Y ROMPIO.
#
# La idea era declarar los emoji **bajo `'Archivo'`** con su `unicode-range`:
# se agregarian a la familia y no habria que editar una sola pila de fuentes.
# En teoria el `unicode-range` se evalua primero, asi que para una letra la
# cara de emoji ni se considera.
#
# Medido el 20/09/2026, y no es lo que pasa. Con la cara de emoji declarada
# como `'Archivo'` y `font-weight:100 1000`:
#
#     antes   ancho de «SERVIDOR» 900/100px   575,31   (Archivo de verdad)
#     despues                                 524,38   (el fallback da 520,52)
#
# O sea que **el texto dejo de usar Archivo**. Un rango 100-1000 contiene el
# 900 pedido, asi que empata con la cara real de 900 — y al empatar gana la
# ultima declarada, que era la mia. Despues el caracter no esta en su
# `unicode-range` y termina cayendo al fallback en vez de volver a Archivo.
#
# ⚠️ Y SE VEIA BIEN EN LA MITAD DE LOS CASOS, que es lo peligroso: el emoji
# salio perfecto —por eso parecia que habia funcionado— y lo que se rompio
# fue el texto de al lado. Sin medir el ancho no se distinguia de un cambio
# de antialiasing.
#
# Con nombre propio hay que nombrarla en cada pila —lo hace
# `herramientas/pila_emoji.py`—, que es mas trabajo y no tiene este problema.
#
# 🔴 Y TAMPOCO SIRVE LLAMARLA «Noto Color Emoji». Probe ese y NO ALCANZO: el
# navegador de Cloudflare **tiene una Noto Color Emoji instalada**, y con el
# mismo nombre la estrella seguia saliendo distinta —85,5 % de pixeles y 19
# px de corrimiento— o sea que usaba la suya y no la nuestra. Un nombre que
# no existe en ningun sistema no puede colisionar con nada.
FAMILIAS = ("'LigaEmoji'",)
CSS_GOOGLE = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'}

# Donde pueden nacer TAG y textos con emoji. ⚠️ Si manana una carta nueva
# mete un emoji en otro archivo, hay que agregarlo aca o su glifo no entra
# en el recorte — y va a caer en la fuente del sistema **en silencio**, que
# es justo el bug que esto cierra. El `--ver` avisa si encuentra alguno
# fuera de esta lista.
FUENTES = ['comun/titulos.py', '01_Temporada/normal_v3.py',
           '02_Competitivo/v2/gencomp.py', '03_Servidor/normal_gen.py',
           '03_Servidor/generar.py', '04_Pais/maqueta.py',
           '04_Pais/generar.py', '02_Competitivo/v2/comp.py']

# Alto aunque no sea emoji: puntuacion, cajas de los `print`, y los simbolos
# que este repo usa para hablar (⚠️ 🔴 ✅). Esos NO van a una carta.
NO_EMOJI = set('—–…·«»→←≥≤’‘“”⚠️─═│┌┐└┘├┤┬┴┼🔴✅⬜🟢🟡')


def es_emoji(c):
    o = ord(c)
    if c in NO_EMOJI or c.isspace():
        return False
    return (0x1F000 <= o <= 0x1FAFF or 0x2600 <= o <= 0x27BF
            or o in (0x2B50, 0x2B1B, 0x2B1C) or 0x1F1E6 <= o <= 0x1F1FF)


def del_proyecto():
    """Los emoji que el proyecto puede emitir, y de que archivo salen."""
    vistos = {}
    for rel in FUENTES:
        p = os.path.join(BASE, rel)
        if not os.path.exists(p):
            continue
        try:
            arbol = ast.parse(io.open(p, encoding='utf-8').read())
        except SyntaxError:
            continue
        for n in ast.walk(arbol):
            if isinstance(n, ast.Constant) and isinstance(n.value, str):
                for c in n.value:
                    if es_emoji(c):
                        vistos.setdefault(c, set()).add(rel)
    return vistos


# ⚠️ NO SE MIRA TODO EL REPO: las herramientas y los scripts de exploracion
# estan llenos de emoji que van a la consola y no a una carta. Lo que dibuja
# vive en estas cuatro carpetas mas `comun/`.
DIBUJAN = ('01_Temporada', '02_Competitivo', '03_Servidor', '04_Pais',
           'comun', 'bot')
# Estos emiten emoji a proposito y NO dibujan: son mensajes de Discord y
# texto de consola. Se declaran para que el aviso no grite todos los dias.
#
# ⚠️ DOS DE ELLOS EMITEN EL EMOJI PARA **BORRARLO**, y esa es la unica
# clasificacion que el barrido no puede hacer solo: `todos_sv.py:558` y
# `comun/claves.py:57` lo tienen dentro de un regex que lo saca del nombre
# —`Val ⚡` -> `val`—. Un `❓` ahi no significa que la carta lo dibuje sino
# exactamente lo contrario. Se mira una vez y se anota; el que aparezca
# manana sin estar en esta lista es el que hay que ir a ver.
NO_DIBUJAN = ('bot/perfil.py', 'bot/cuotas.py', 'bot/verificar.py',
              'bot/desplegar.py', 'bot/fotos.py', 'bot/volcar_kv.py',
              '03_Servidor/disenos/todos_sv.py',   # regex que limpia nombres
              'comun/claves.py',                   # idem + fixtures del test
              '03_Servidor/disenos/probar_export.py',   # ✔ de consola
              '03_Servidor/disenos/que_muestra.py')     # 🥇 de consola


def huerfanos():
    """Archivos que dibujan, emiten emoji y NO estan en `FUENTES`.

    🔴 EL COMENTARIO DE `FUENTES` PREDICE ESTE AGUJERO Y NO LO CIERRA:
    *«si manana una carta nueva mete un emoji en otro archivo, hay que
    agregarlo aca o su glifo no entra en el recorte»*. Una lista que hay
    que acordarse de actualizar es la misma forma que este proyecto ya
    documenta tres veces —la decision vive en un lado y el codigo lee de
    otro— y falla igual: **no avisa**, el emoji cae en la fuente del
    sistema y la carta sale bien en esta maquina.

    Buscarlos cuesta un `ast.parse` por archivo. Acordarse, no.
    """
    fuera = {}
    for carp in DIBUJAN:
        d = os.path.join(BASE, carp)
        if not os.path.isdir(d):
            continue
        for raiz, _, archivos in os.walk(d):
            for a in archivos:
                if not a.endswith('.py'):
                    continue
                p = os.path.join(raiz, a)
                rel = os.path.relpath(p, BASE).replace('\\', '/')
                if rel in FUENTES or rel in NO_DIBUJAN:
                    continue
                try:
                    arbol = ast.parse(io.open(p, encoding='utf-8').read())
                except (SyntaxError, UnicodeDecodeError):
                    continue
                e = set()
                for n in ast.walk(arbol):
                    if isinstance(n, ast.Constant) and isinstance(n.value, str):
                        e |= {c for c in n.value if es_emoji(c)}
                if e:
                    fuera[rel] = e
    return fuera


def en_html():
    """Que emoji DIBUJA cada carta, leyendo los `salida/*.html` que haya.

    🔴 EL ESCANEO DEL `.py` SOBRE-REPORTA, Y ESO CUESTA HORAS. Un emoji en
    el archivo no es un emoji en la carta: puede estar en un `print`, en un
    docstring, o —peor— dentro de un regex que lo **borra**, como el `❓` de
    `todos_sv.py`. El 20/09/2026 di por hecho que las 300 cartas de Pais
    del 19/09 habia que redibujarlas *«porque `04_Pais/generar.py` emite
    🥈🥉»*: los emite en un `print`. La carta de Pais dibuja **cero**.

    Lo unico que contesta la pregunta es el HTML generado, y mirando el
    **texto de los nodos** — no el archivo entero, porque el CSS y los
    comentarios tambien traen. Ahorro redibujar 962 cartas.

    ⚠️ Lee lo que ya esta en disco: si una carta no tiene su `.html`
    generado, no aparece. Lo dice al correr en vez de contar 0.
    """
    import glob
    import re
    out = {}
    for p in sorted(glob.glob(os.path.join(BASE, '*', 'salida', '*.html'))):
        try:
            s = io.open(p, encoding='utf-8').read()
        except (OSError, UnicodeDecodeError):
            continue
        cuerpo = re.sub(r'<style.*?</style>', '', s, flags=re.S)
        cuerpo = re.sub(r'<!--.*?-->', '', cuerpo, flags=re.S)
        texto = re.sub(r'<[^>]+>', ' ', cuerpo)
        out[os.path.relpath(p, BASE).replace('\\', '/')] = \
            sorted({c for c in texto if es_emoji(c)})
    return out


def _rangos(spec):
    fuera = []
    for parte in spec.split(','):
        parte = parte.strip().lower().replace('u+', '')
        if '-' in parte:
            a, b = parte.split('-')
            fuera.append((int(a, 16), int(b, 16)))
        else:
            fuera.append((int(parte, 16), int(parte, 16)))
    return fuera


def trozos():
    """Los `@font-face` de Google, con su url y su rango."""
    css = requests.get(CSS_GOOGLE, headers=UA, timeout=30).text
    return [(u, _rangos(r)) for u, r in
            re.findall(r'src: url\((https[^)]+)\) format\([^)]+\);\s*'
                       r'unicode-range: ([^;]+);', css)]


def reparto(quiero):
    """Que trozo cubre cada emoji. Se elige el PRIMERO que lo tiene.

    ⚠️ LOS RANGOS DE GOOGLE SE SOLAPAN. ⚡ ⭐ 🔥 estan en dos archivos
    distintos, asi que bajar todos los que "cubren algo" traeria 1.196 KB
    para 17 glifos. Tomando el primero que sirve, cada emoji viaja una vez.
    """
    tr = trozos()
    plan = {}
    for c in sorted(quiero, key=ord):
        o = ord(c)
        for i, (u, rg) in enumerate(tr):
            if any(a <= o <= b for a, b in rg):
                plan.setdefault(i, {'url': u, 'cps': []})['cps'].append(o)
                break
    return plan


def recortar(datos, cps):
    """Deja en la fuente solo esos codepoints. Devuelve woff2."""
    from fontTools.ttLib import TTFont
    from fontTools.subset import Subsetter, Options
    f = TTFont(io.BytesIO(datos))
    op = Options()
    op.layout_features = ['*']          # las secuencias de emoji los usan
    op.notdef_outline = True
    op.drop_tables = []
    op.passthrough_tables = True        # CBDT/CBLC/COLR/CPAL no se tocan
    s = Subsetter(options=op)
    s.populate(unicodes=cps)
    s.subset(f)
    fuera = io.BytesIO()
    f.flavor = 'woff2'
    f.save(fuera)
    return fuera.getvalue()


def main():
    ver = '--ver' in sys.argv
    armar = '--armar' in sys.argv

    if '--enhtml' in sys.argv:
        print('\n══ QUÉ EMOJI DIBUJA CADA CARTA, EN EL HTML GENERADO ══\n')
        h = en_html()
        if not h:
            print('   no hay ningún `*/salida/*.html` en disco. Generá una '
                  'carta\n   y volvé: esto lee artefactos, no código.\n')
            return 1
        for rel, e in sorted(h.items()):
            print('   %-40s %s' % (rel, ' '.join(e) or '— ninguno'))
        print('\n   ⚠️ Lee lo que hay en disco. Una carta sin su .html no '
              'aparece,\n      y eso NO es lo mismo que «no dibuja emoji».\n')
        return 0

    if not (ver or armar):
        print(__doc__)
        return 0

    quiero = del_proyecto()
    print('\n══ LOS EMOJI QUE EL PROYECTO PUEDE DIBUJAR ══\n')
    print('   %d distintos\n' % len(quiero))
    for c in sorted(quiero, key=ord):
        try:
            nom = unicodedata.name(c)
        except ValueError:
            nom = '?'
        print('   U+%-6X %s  %-32s %s'
              % (ord(c), c, nom[:32],
                 ', '.join(os.path.basename(x) for x in sorted(quiero[c]))))

    fuera = huerfanos()
    if fuera:
        print('\n   🔴 %d archivo(s) que DIBUJAN emiten emoji y no están en '
              'FUENTES:' % len(fuera))
        for rel in sorted(fuera):
            print('      %-38s %s' % (rel, ' '.join(sorted(fuera[rel]))))
        print('      Su glifo no entra en el recorte y cae en la fuente del '
              'sistema, en silencio.')
        print('      Se agregan a FUENTES, o a NO_DIBUJAN si van a consola.')
    else:
        print('\n   ✅ ningún archivo que dibuja emite un emoji fuera de '
              'FUENTES')

    plan = reparto(quiero)
    cubiertos = sum(len(v['cps']) for v in plan.values())
    if cubiertos != len(quiero):
        print('\n   🔴 %d de %d sin trozo que los cubra'
              % (len(quiero) - cubiertos, len(quiero)))
        return 1

    print('\n══ EL RECORTE ══\n')
    piezas, antes, despues = [], 0, 0
    for i in sorted(plan):
        v = plan[i]
        crudo = requests.get(v['url'], headers=UA, timeout=60).content
        antes += len(crudo)
        chico = recortar(crudo, v['cps'])
        despues += len(chico)
        piezas.append((chico, v['cps']))
        print('   %7.1f KB -> %6.1f KB   %s'
              % (len(crudo) / 1024, len(chico) / 1024,
                 ' '.join(chr(o) for o in v['cps'])))
    print('\n   %-22s %7.1f KB' % ('los trozos de Google', antes / 1024))
    print('   %-22s %7.1f KB   (%.0f %% menos)'
          % ('recortados a los %d' % len(quiero), despues / 1024,
             100 * (1 - despues / max(1, antes))))
    print('   %-22s %7.1f KB' % ('embed.css hoy', 543.7))

    if not armar:
        print('\n   (esto fue `--ver`: no se escribio nada)\n')
        return 0

    partes = ['/* Noto Color Emoji, recortada a los %d emoji que este proyecto\n'
              '   puede dibujar. La genera `herramientas/emoji_embed.py`.\n\n'
              '   NO SE EDITA A MANO: si aparece un emoji nuevo en un TAG, se\n'
              '   corre el script de nuevo. Un emoji que no este aca cae en la\n'
              '   fuente del sistema EN SILENCIO, que es el bug que esto cierra.\n\n'
              '   VA DECLARADA BAJO LAS FAMILIAS QUE LAS CARTAS YA PIDEN, no\n'
              '   bajo un nombre nuevo. Un `@font-face` con `unicode-range`\n'
              '   AGREGA esos codepoints a la familia sin tocar el resto, asi\n'
              '   que ningun `font-family:` del proyecto cambia: las cuatro\n'
              '   cartas la toman solas. El nombre nuevo obligaria a editar\n'
              '   cada pila de fuentes, y la que se olvidara caeria en la del\n'
              '   sistema sin avisar.\n\n'
              '   `font-weight:100 1000` porque las cartas piden 800 y 900 y la\n'
              '   cara de emoji es 400: sin el rango, el navegador la descarta\n'
              '   para esos pesos y vuelve a la del sistema. */\n'
              % len(quiero)]
    for chico, cps in piezas:
        rango = ','.join('U+%X' % o for o in cps)
        b64 = base64.b64encode(chico).decode()
        for fam in FAMILIAS:
            partes.append(
                "@font-face{font-family:%s;font-style:normal;"
                "font-weight:100 1000;src:url(data:font/woff2;base64,%s) "
                "format('woff2');unicode-range:%s}\n" % (fam, b64, rango))
    txt = ''.join(partes)
    # ⚠️ NO SE ESCRIBE UN `emoji.css` APARTE, Y LO HACIA. Eran dos copias de
    # lo mismo: una suelta y otra empalmada en `embed.css`. Es la forma que
    # este repo documenta —«un archivo que parece la fuente y no lo es es de
    # donde salen las copias»— y encima nadie leia la suelta. El bloque vive
    # entre marcas adentro de `embed.css`, que es donde se puede mirar.
    print('\n   el bloque de emoji pesa %.1f KB'
          % (len(txt.encode('utf-8')) / 1024))
    return empalmar(txt)


# 🔴 SE EMPALMA DENTRO DE `embed.css` Y NO SE PIDE APARTE. Hay **ocho**
# lugares que leen `embed.css` —los cuatro exportadores, `generar.py` de la
# Servidor, las dos Bloqueadas y la herramienta de prueba— y agregar un
# segundo archivo obligaria a tocar los ocho. El que se olvidara dibujaria
# el emoji del sistema **sin avisar**, que es exactamente el bug que esto
# cierra: la carta saldria bien y con otra estrella.
#
# ⚠️ ES IDEMPOTENTE: el bloque vive entre marcas y se reemplaza entero. Sin
# eso, correr el script dos veces dejaria la fuente duplicada y `embed.css`
# creceria 64 KB por corrida.
MARCA_A = '/* ==== EMOJI: generado por herramientas/emoji_embed.py ==== */'
MARCA_B = '/* ==== fin EMOJI ==== */'


def empalmar(bloque):
    p = os.path.join(BASE, 'comun', 'fonts', 'embed.css')
    s = io.open(p, encoding='utf-8').read()
    antes = len(s.encode('utf-8'))
    nuevo = MARCA_A + '\n' + bloque + MARCA_B + '\n'
    if MARCA_A in s and MARCA_B in s:
        i, j = s.index(MARCA_A), s.index(MARCA_B) + len(MARCA_B) + 1
        s = s[:i] + nuevo + s[j:]
        que = 'reemplazado'
    else:
        s = s.rstrip() + '\n\n' + nuevo
        que = 'agregado'
    tmp = p + '.tmp'
    with io.open(tmp, 'w', encoding='utf-8') as f:
        f.write(s)
    os.replace(tmp, p)
    print('   ✅ comun/fonts/embed.css  %s  (%.1f -> %.1f KB)'
          % (que, antes / 1024, len(s.encode('utf-8')) / 1024))
    print('\n   Los ocho lugares que ya leen embed.css lo toman solos:')
    print('   los cuatro exportadores, 03_Servidor/generar.py, las dos')
    print('   Bloqueadas y herramientas/probar_navegador.py.\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())

"""LOS NUEVE FONDOS APROBADOS de la carta Servidor.

DEFINICION CANONICA. Si algo se rehace, sale de aca.

    python los_nueve.py     ->  los_nueve.png

Cerrado el 31/07/2026. Los nueve estan decididos. Lo que sigue son los MARCOS,
de a uno, y SIN METAL: ese lenguaje es de la Competitiva y confundiria las dos
cartas de la misma persona.

Tres se rehicieron sobre el final y esta es la version buena:

  TWR   franjas espejadas a 215 (antes 126)
  FRZ   dos cortes con filos encendidos, SIN esmerilado
  FFA   halftone de puntos magenta sobre casi negro
"""
import asyncio, base64, json, os, re, sys
from playwright.async_api import async_playwright

# 🔴 SE CALCULA, NO SE CLAVA. Aca habia una ruta absoluta a la
# maquina de Dlx, y este archivo NO es exploracion: esta en el camino
# vivo de `03_Servidor/generar.py`. Lo destapo la primera corrida del
# ciclo en Actions con trabajo de verdad -- 12 cartas de 13 con
# FileNotFoundError y una ruta de Windows adentro de un runner Linux.
# Ver la nota larga en `todos_sv.py`.
SCR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(SCR))
TEX = os.path.join(SCR, 'texturas')
sys.path.insert(0, BASE)
from comun.siluetas import PICO
from comun import emblema

# La silueta NO se define aca: sale de comun/siluetas.py. Antes esta hoja
# tenia su propio polygon del escudo biselado, y cuando la carta paso al
# pico trazado esta se quedo dibujando la forma vieja sin avisar. Una
# silueta copiada se separa de la original: por eso ahora se importa.
W, MARGEN = PICO.w, emblema.MARGEN
ALTO = PICO.h + MARGEN


def mover(d, dy):
    """Baja un path sumandole dy a cada Y. Todos los pares vienen 'x,y'."""
    return re.sub(r'(-?[\d.]+),(-?[\d.]+)',
                  lambda m: '%s,%g' % (m.group(1), float(m.group(2)) + dy), d)


# Se mueve UNA vez y se usa igual en el recorte y en el borde. Poner el
# desplazamiento como transform en los dos lados no da lo mismo: el
# clip-path de un <g> se evalua en el espacio que deja su propio transform,
# y el borde termina cortado a los costados.
SIL = mover(PICO.d, MARGEN)


def b64(p):
    m = 'image/png' if p.lower().endswith('.png') else 'image/jpeg'
    return 'data:%s;base64,%s' % (m, base64.b64encode(open(p, 'rb').read()).decode())


UL = b64(os.path.join(BASE, '02_Competitivo', 'ul_blanco.png'))


def cara_muestra():
    """La cara de las hojas de diseño, o un cartel si no está.

    🔴 ESTO ERA `FOTO = b64(.../av_valen.png)` AL NIVEL DEL MODULO, Y
    TIRABA EL GENERADOR DE PRODUCCION. `03_Servidor/generar.py` importa
    `todos_sv`, que importa esto: sin `av_valen.png` en disco, la carta
    Servidor de las 59 personas **no se dibuja**, con un
    `FileNotFoundError` en un `import`.

    ⚠️ Y `FOTO` no la usaba nadie — era la unica linea que la leia. Un
    dato muerto cargado al importar, que ademas es **la foto de una
    persona real**: se cayo al armar el arbol del repo publico, donde esa
    foto no va justamente porque es de alguien.

    ⚠️ ES PEREZOSA A PROPOSITO. Importar un modulo no tiene que tocar el
    disco: lo que decide si hace falta la cara es *dibujar una hoja de
    diseño*, no *importar*. Es la misma regla que el navegador y el
    espejo de las caras — la precondicion es dibujar, no arrancar.

    ⚠️ Y SI FALTA, EL CARTEL LO DICE. Poner otra foto con el mismo nombre
    en silencio seria peor: el que compara una hoja contra la referencia
    veria otra cara sin saber por que.
    """
    p = os.path.join(SCR, 'av_valen.png')
    if os.path.exists(p):
        return b64(p)
    import base64 as _b64
    import io as _io
    from PIL import Image, ImageDraw
    im = Image.new('RGB', (256, 256), (34, 37, 46))
    d = ImageDraw.Draw(im)
    d.ellipse((88, 54, 168, 134), fill=(62, 67, 80))
    d.ellipse((48, 148, 208, 300), fill=(62, 67, 80))
    d.text((60, 214), 'MUESTRA', fill=(150, 156, 170))
    d.text((34, 230), 'no es una foto real', fill=(110, 116, 130))
    b = _io.BytesIO()
    im.save(b, 'PNG')
    return 'data:image/png;base64,' + _b64.b64encode(b.getvalue()).decode()


def esc(sv):
    return b64(os.path.join(BASE, 'comun', 'escudos_cuad', f'sv_{sv.lower()}.png'))


def sil(sv): return b64(os.path.join(BASE, 'comun', 'logos_sv', f'sv_{sv.lower()}.png'))
def tx(n): return b64(os.path.join(TEX, n + '.png'))


def t(c, f):
    h = c.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    if f >= 0: r, g, b = (int(x + (255-x)*f) for x in (r, g, b))
    else:      r, g, b = (int(x*(1+f)) for x in (r, g, b))
    return '#%02X%02X%02X' % (r, g, b)


# ══ LA DEFINICION CANONICA DE CADA FONDO ══
# sv: (acento, color base, fondo css, capa extra css, remate css, descripcion)
def defs():
    d = {}

    A, B = '#600816', '#F2E9E9'
    d['TFC'] = (B, A,
        f'repeating-linear-gradient(180deg,{A} 0 30px,{t(A,-.34)} 30px 60px)',
        '', '', 'bandas horizontales anchas')

    # ⚠️ EL CORTE SE CORRE A LA DERECHA: 54/58 -> 68/72. Dlx lo pidio.
    # El degrade va a 146deg —abajo y a la derecha— asi que subir las paradas
    # lo mueve en ESA direccion: se va a la derecha y tambien un poco abajo.
    # No hay forma de moverlo solo en horizontal sin cambiar el angulo, y
    # cambiar el angulo cambiaria la inclinacion del corte, que es lo que le
    # da caracter. Se prefirio conservar la inclinacion.
    A, B = '#C2540A', '#FFB03A'
    d['SR'] = (B, A,
        f'linear-gradient(146deg,{t(A,.14)} 0 62%,{B} 62% 66%,#1C1408 66% 100%)',
        '', '', 'corte diagonal naranja sobre negro, corrido a la derecha')

    # FFA · halftone de puntos + filo de neon + grano de estatica.
    # El anterior era solo un degrade de neon y quedaba muy cerca de TWR en
    # valor. El halftone le da material propio sin pasar por una textura.
    A, B = '#1A0630', '#EC48DC'
    d['FFA'] = (B, A,
        # La luz fosforescente SUBE DESDE EL PIE. Antes estaba arriba al
        # centro, que es justo donde va el emblema: quedaba tapada por el.
        'radial-gradient(circle at 1.5px 1.5px,rgba(236,72,220,.22) 1.1px,transparent 1.2px) 0 0/8px 8px,'
        'radial-gradient(ellipse 82% 30% at 50% 100%,rgba(236,72,220,.58),transparent 66%),'
        'linear-gradient(168deg,#190630 0%,#090315 100%)',
        f'background-image:url({tx("estatica")});background-size:cover;'
        'mix-blend-mode:soft-light;opacity:.14',
        'box-shadow:inset 0 0 0 2px rgba(236,72,220,.80),'
        'inset 0 0 30px rgba(236,72,220,.24)',
        'halftone magenta + filo de neón + grano')

    # TWR · las franjas van a 215, no a 126: espejadas, para que el rincon
    # oscuro caiga atras del numero y no al reves.
    A, B = '#C40E45', '#FF5C8A'
    d['TWR'] = (B, A,
        f'linear-gradient(215deg,{t(A,-.52)} 0 30%,{A} 30% 46%,'
        f'{t(B,-.15)} 46% 72%,{t(A,-.4)} 72% 100%)',
        f'background-image:url({sil("TWR")});background-size:128%;'
        'background-position:center 74%;background-repeat:no-repeat;'
        'opacity:.26;mix-blend-mode:overlay',
        '', 'franjas espejadas a 215° + fantasma de su silueta')

    A, B = '#2A3982', '#E8C86A'
    d['FTN'] = (B, A,
        f'linear-gradient(122deg,transparent 0 46%,rgba(232,200,106,.90) 46% 51%,'
        f'rgba(232,200,106,.26) 51% 66%,transparent 66%),'
        f'linear-gradient(166deg,{t(A,.22)} 0%,{A} 44%,{t(A,-.58)} 100%)',
        '', '', 'banda dorada al sesgo, ancha y baja')

    # FRZ · dos cortes al sesgo con los filos ENCENDIDOS, sobre el degrade
    # oscuro parejo. NO lleva esmerilado: era la unica carta clara de las
    # nueve y la textura la aclaraba todavia mas.
    A, B = '#0E5F5E', '#8FE8E0'
    d['FRZ'] = (B, A,
        f'linear-gradient(214deg,{t(A,.28)} 0 26%,{B} 26% 27.2%,transparent 27.2%),'
        f'linear-gradient(214deg,transparent 0 72%,{B} 72% 73.2%,{t(A,-.34)} 73.2% 100%),'
        f'linear-gradient(168deg,{t(A,.22)} 0%,{t(A,-.42)} 48%,{t(A,-.80)} 100%)',
        '', '', 'dos cortes al sesgo con filos encendidos')

    # URBF · corte blanco duro. Era el unico de los nueve sin textura ni
    # gesto duro: sus "tres capas de pegatina" eran tres degrades encimados,
    # o sea mas de lo mismo sobre un campo violeta grande y plano.
    A, B = '#7B44BF', '#FFFFFF'
    d['URBF'] = (B, A,
        f'linear-gradient(200deg,transparent 0 52%,{B} 52% 55%,'
        f'{t(A,-.62)} 55% 100%),'
        f'linear-gradient(166deg,{t(A,.46)} 0%,{A} 40%,{t(A,-.72)} 100%)',
        f'background-image:url({tx("rayones")});background-size:180%;'
        'background-position:center;mix-blend-mode:overlay;opacity:.20',
        '', 'corte blanco duro + rayones')

    A, B = '#3D5BFF', '#FFFFFF'
    d['DRA'] = (B, A,
        f'linear-gradient(166deg,{t(A,.40)} 0%,{A} 42%,{t(A,-.70)} 100%)',
        f'background-image:url({tx("oxido")});background-size:cover;'
        'background-position:center;mix-blend-mode:overlay;opacity:.38',
        'background:linear-gradient(180deg,transparent 0 70%,'
        'rgba(255,255,255,.90) 70% 71.4%,transparent 71.4% 73%,'
        'rgba(255,255,255,.90) 73% 74.4%,transparent 74.4% 76%,'
        'rgba(255,255,255,.90) 76% 77.4%,transparent 77.4%)',
        'textura de óxido + tres líneas al pie')

    # EFA · el cobre de SU LOGO, no el marron que tenia.
    #
    # datos/colores_sv_marca.json ya decia EFA = #A95225 "del logo · cobre",
    # y la carta usaba #3A2412: 57.9 puntos de luz de diferencia. Medido
    # sobre la tinta del logo, sus dominantes son #A84800, #601800, #A87830
    # y #C09048; el #3A2412 no aparece por ningun lado.
    #
    # El cuero baja de cover/0.55 a 150px/0.30. Con el mosaico estirado a
    # 300x405 sus manchas quedaban enormes y se leia como camuflaje, no como
    # cuero. OJO: achicar el mosaico SUBE el grano medido —mas chico es mas
    # frecuencia—; lo que lo baja es la opacidad. Son dos cosas distintas y
    # aca se movieron las dos a proposito.
    A, B = '#A95225', '#E8A144'
    d['EFA'] = (B, A,
        f'linear-gradient(166deg,{t(A,.16)} 0%,{t(A,-.18)} 44%,{t(A,-.72)} 100%)',
        # ⚠️ background-repeat:repeat va EXPLICITO. La clase .cap trae
        # no-repeat, que hasta ahora daba igual porque todas las texturas
        # usaban cover o un porcentaje mayor a 100: se dibujaban una vez y
        # tapaban todo. Con un mosaico de 150px el no-repeat deja un solo
        # parche en el medio y el resto liso. Cada capa declara su repeat.
        f'background-image:url({tx("cuero")});background-size:150px;'
        'background-repeat:repeat;'
        'background-position:center;mix-blend-mode:soft-light;opacity:.30',
        'box-shadow:inset 0 0 0 4px #E8A144,inset 0 0 0 6px rgba(0,0,0,.55)',
        'cuero fino sobre el cobre del logo + vivo al borde')

    # RZ · Rap Zone. Servidor ASOCIADO, no de la Hermandad.
    #
    # Su fuego NO esta simulado: sale extraido de su propio logo con
    # herramientas/extraer_fuego_rz.py. El fuego simulado da lenguas de
    # fogata y el de su marca son vetas y remolinos, sin punta.
    #
    # Y entra con SU PROPIO COLOR, no como mascara teñida. Medida la rampa
    # del logo: #000323 → #000740 → #0014A1 → #0657F6 → #3A96F2. NUNCA
    # LLEGA AL BLANCO, porque el azul no pasa por amarillo al calentarse
    # como el naranja. Por eso el acento es #3A96F2, su punto mas caliente.
    #
    # ⚠️ Su tono es 232°, casi el mismo que FTN (230°) y DRA (231°). Lo que
    # lo separa es la LUZ: 0.20 contra 0.34 y 0.62. Si DRA se va a cielo
    # nocturno, DRA y RZ quedan mismo tono Y misma luz. Las dos cosas no
    # pueden pasar.
    A, B = '#08145C', '#3A96F2'
    f_rz = tx('fuego_rz')
    d['RZ'] = (B, A,
        'linear-gradient(170deg,#0B1550 0%,#070B2E 48%,#03050F 100%)',
        f'background-image:url({f_rz}),url({f_rz});'
        'background-size:108% auto,150% auto;'
        'background-position:center 60%,center;'
        'background-repeat:no-repeat,no-repeat;mix-blend-mode:screen',
        'box-shadow:inset 0 0 0 2px rgba(58,150,242,.85),'
        'inset 0 0 34px rgba(58,150,242,.30)',
        'el fuego de su propio logo, en dos capas')

    return d


D = defs()
ORDEN = ['SR', 'TFC', 'TWR', 'FTN', 'DRA', 'FRZ', 'URBF', 'EFA', 'FFA', 'RZ']


ESTRELLAS = json.load(open(os.path.join(BASE, 'datos', 'estrellas.json'),
                           encoding='utf-8'))['estrellas_por_servidor']
# La geometria del emblema —el escudo, su lugar y las estrellas— vive en
# comun/emblema.py. Aca solo se dibuja.


def carta(i, sv, claro=False, pleno=False):
    B, A, fondo, extra, remate, desc = D[sv]
    cid = f'sv{i}'
    cap = f'<div class="cap" style="{extra}"></div>' if extra else ''
    rem = f'<div class="rem" style="{remate}"></div>' if remate else ''
    desc = '' if claro else desc
    return f"""<div class="col{' claro' if claro else ''}">
<div class="et">{sv}</div><div class="de">{desc}</div>
<div class="wrap">
  <svg class="defs" width="0" height="0"><defs>
    <clipPath id="{cid}" clipPathUnits="userSpaceOnUse"><path d="{SIL}"/></clipPath>
  </defs></svg>
  <div class="cuerpo" style="clip-path:url(#{cid})">
    <div class="fondo" style="background:{fondo}"></div>{cap}{rem}
    <img class="ul" src="{UL}">
  </div>
  <svg class="borde" viewBox="0 0 {W} {ALTO}" width="{W}" height="{ALTO}">
    <g clip-path="url(#{cid})">
      <path d="{SIL}" fill="none" stroke="{B}" stroke-width="9" opacity=".9"/>
      <path d="{SIL}" fill="none" stroke="{t(A,-.74)}" stroke-width="3"/>
    </g>
  </svg>
  {emblema.estrellas(ESTRELLAS[sv], W, sufijo=f'{i}_')}
  {emblema.pieza(sv, A, B, esc(sv))}
</div></div>"""


CSS = f"""
body{{background:#0A0A10;margin:0;padding:32px;font-family:system-ui,sans-serif}}
.fila{{display:flex;gap:30px;flex-wrap:wrap}}
.col{{text-align:center;width:300px}}
.et{{color:#EDEDF5;font-size:14px;font-weight:800;letter-spacing:1.6px;margin-bottom:3px}}
.de{{color:#8A8AA0;font-size:10.5px;margin-bottom:12px;min-height:26px}}
.col.claro{{background:#FFFFFF;border-radius:10px;padding:10px 0 14px}}
.claro .et{{color:#1A1A22}}
.claro .de{{min-height:6px;margin-bottom:6px}}
.claro .cuerpo{{filter:drop-shadow(0 10px 22px rgba(0,0,0,.32))}}
.rot{{color:#EDEDF5;font-size:16px;font-weight:700;letter-spacing:1.4px;margin:6px 0 22px}}
.rot span{{color:#8A8AA0;font-weight:400;letter-spacing:0}}
.wrap{{position:relative;width:{W}px;height:{ALTO}px}}
.defs{{position:absolute}}
.cuerpo{{position:absolute;inset:0;filter:drop-shadow(0 12px 26px rgba(0,0,0,.72))}}
.borde{{position:absolute;inset:0;pointer-events:none}}
.fondo{{position:absolute;inset:0;z-index:0}}
.cap{{position:absolute;inset:0;z-index:1;background-repeat:no-repeat}}
.rem{{position:absolute;inset:0;z-index:2}}
/* El UL va DENTRO del recorte, al pie. Es la marca paraguas y ocupa el mismo
   lugar en las tres cartas; el que se mudo arriba fue el escudo del servidor.

   TAMANO IGUAL AL DE LA COMPETITIVA: height 20.7px y ancho automatico, que
   es su regla final en 02_Competitivo/v2/card.css. Se copia el ALTO y no el
   ancho porque el archivo es 744x606, o sea mas ancho que alto: fijando el
   ancho las dos cartas terminaban con logos de distinto alto. Las dos cartas
   miden 300 de ancho, asi que un pixel aca es un pixel alla. */
.ul{{position:absolute;left:50%;top:424px;transform:translateX(-50%);z-index:6;
  height:20.7px;width:auto;opacity:.94;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.95))}}
""" + emblema.CSS


async def main():
    fuentes = open(os.path.join(BASE, 'comun', 'fonts', 'embed.css'), encoding='utf-8').read()
    cuerpo = ''.join(carta(i, sv) for i, sv in enumerate(ORDEN))
    # Control sobre blanco. Las estrellas son blancas, asi que este es el
    # caso peor: lo unico que las separa del fondo es su contorno. La carta
    # se exporta en PNG transparente y cae en Discord sobre lo que haya.
    con_est = [sv for sv in ORDEN if ESTRELLAS[sv]]
    claro = ''.join(carta(60 + i, sv, True) for i, sv in enumerate(con_est))
    pag = ('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>'
           + fuentes + CSS + '</style></head><body>'
           '<div class="rot">LOS NUEVE '
           '<span>— el escudo lleno, con el fondo puesto por la carta en el '
           'tono de su servidor</span></div>'
           '<div class="fila">' + cuerpo + '</div>'
           '<div class="rot">SOBRE BLANCO '
           '<span>— la estrella es blanca, así que acá lo único que la sostiene '
           'es su contorno</span></div>'
           '<div class="fila">' + claro + '</div></body></html>')
    out = os.path.join(SCR, 'los_nueve.html')
    open(out, 'w', encoding='utf-8').write(pag)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': 1060, 'height': 1800}, device_scale_factor=2)
        await pg.goto('file://' + out); await pg.wait_for_timeout(2600)
        await pg.screenshot(path=os.path.join(SCR, 'los_nueve.png'), full_page=True)
        await b.close()
    print('-> los_nueve.png')


# Guardado para que defs() se pueda IMPORTAR sin disparar el render.
# Sin esto, cualquier script que quiera los nueve fondos tiene que copiarlos,
# y una definicion copiada se separa de la original tarde o temprano.
if __name__ == '__main__':
    # la consola de Windows abre en cp1252 y revienta con los simbolos
    # de aviso. Ya paso dos veces: se arregla de una vez.
    import sys as _s
    try:
        _s.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    asyncio.run(main())
